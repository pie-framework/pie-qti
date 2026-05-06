import type { Player } from '../core/Player.js';
import type { CatalogSupportPreference } from '../pnp/types.js';

const PLATFORM_USAGES = [
	{ usage: 'tts-pronunciation', flag: 'ttsPronunciation', label: 'Request pronunciation', text: 'P' },
	{ usage: 'signing-definition', flag: 'signingDefinition', label: 'Request signing definition', text: 'S' },
	{ usage: 'braille-text', flag: 'brailleText', label: 'Request braille text', text: 'B' },
	{ usage: 'audio-description', flag: 'audioDescription', label: 'Request audio description', text: 'A' },
	{ usage: 'extended-description', flag: 'extendedDescription', label: 'Request extended description', text: 'D' },
] as const;
const ILLUSTRATED_GLOSSARY_USAGE = 'illustrated-glossary';
const BUILT_IN_POPUP_USAGES = new Set<string>([
	'glossary-on-screen',
	'keyword-translation',
	ILLUSTRATED_GLOSSARY_USAGE,
]);
const RESERVED_PLATFORM_FLAGS = new Set<string>(PLATFORM_USAGES.map((support) => support.flag));
const RESERVED_PLATFORM_USAGES = new Set<string>(PLATFORM_USAGES.map((support) => support.usage));
const SAFE_CATALOG_USAGE = /^[a-z][a-z0-9._-]*$/;

interface HostCatalogSupport {
	usage: string;
	label: string;
	text: string;
	languageCode?: string;
}

/**
 * Inject glossary/keyword-translation trigger buttons into a rendered item container.
 *
 * When pnp.content.glossaryOnScreen is true, each [data-catalog-idref] element gets a
 * trigger button. Clicking the button looks up the catalog entry and shows a floating
 * popup rendered by the 'catalogPopup' component from the registry (defaults to
 * pie-qti-catalog-popup). Clicking again or pressing Escape closes it.
 *
 * For platform-level usages (tts-pronunciation, signing-definition, braille-text,
 * audio-description) the player fires a `qti-catalog-lookup` CustomEvent instead of
 * mounting a popup — the host application handles those usages.
 */
export function applyGlossaryTriggers(container: HTMLElement, player: Player): () => void {
	cleanupGlossaryTriggers(container);
	const pnp = player.getPnp();
	if (!pnp) return () => cleanupGlossaryTriggers(container);

	const glossaryOn = pnp.content?.glossaryOnScreen === true;
	const kwTranslation = pnp.content?.keywordTranslation;
	const kwOn = kwTranslation?.active === true && !!kwTranslation.languageCode;
	const illustratedOn = pnp.content?.illustratedGlossary === true;
	const platformSupports = pnp.content?.catalogSupports ?? {};
	const hostSupports = getHostCatalogSupports(platformSupports);

	const anyPlatformOn = PLATFORM_USAGES.some((support) => isSupportActive(getPlatformSupportPreference(platformSupports, support)));
	if (!glossaryOn && !kwOn && !illustratedOn && !anyPlatformOn && hostSupports.length === 0) return () => cleanupGlossaryTriggers(container);

	const terms = container.querySelectorAll<HTMLElement>('[data-catalog-idref]');
	if (terms.length === 0) return () => cleanupGlossaryTriggers(container);

	// Track open popup so only one is open at a time
	let currentCleanup: (() => void) | null = null;

	for (const termEl of Array.from(terms)) {
		const idref = termEl.getAttribute('data-catalog-idref');
		if (!idref) continue;

		// Wrap term in a relative-positioned span so we can position popup against it
		const wrapper = document.createElement('span');
		wrapper.className = 'qti-catalog-term';
		wrapper.style.cssText = 'position:relative;display:inline';

		termEl.parentNode?.insertBefore(wrapper, termEl);
		wrapper.appendChild(termEl);

		if (glossaryOn) {
			const btn = createTriggerButton(termEl.textContent ?? idref, 'glossary-on-screen', 'Show definition');
			wrapper.appendChild(btn);

			btn.addEventListener('click', () => {
				if (currentCleanup) {
					currentCleanup();
					currentCleanup = null;
					return;
				}
				const html = player.getCatalogEntry(idref, 'glossary-on-screen');
				if (html !== null) {
					currentCleanup = mountPopup(wrapper, termEl.textContent ?? idref, html, btn, player, () => {
						currentCleanup = null;
					});
				}
			});
		}

		if (kwOn) {
			const lang = kwTranslation!.languageCode;
			const btn = createTriggerButton(termEl.textContent ?? idref, 'keyword-translation', 'Show translation');
			wrapper.appendChild(btn);

			btn.addEventListener('click', () => {
				if (currentCleanup) {
					currentCleanup();
					currentCleanup = null;
					return;
				}
				const html = player.getCatalogEntry(idref, 'keyword-translation', lang);
				if (html !== null) {
					currentCleanup = mountPopup(wrapper, termEl.textContent ?? idref, html, btn, player, () => {
						currentCleanup = null;
					});
				}
			});
		}

		if (illustratedOn) {
			const btn = createTriggerButton(termEl.textContent ?? idref, ILLUSTRATED_GLOSSARY_USAGE, 'Show illustrated glossary');
			wrapper.appendChild(btn);

			btn.addEventListener('click', () => {
				if (currentCleanup) {
					currentCleanup();
					currentCleanup = null;
					return;
				}
				const html = player.getCatalogEntry(idref, ILLUSTRATED_GLOSSARY_USAGE);
				if (html !== null) {
					currentCleanup = mountPopup(wrapper, termEl.textContent ?? idref, html, btn, player, () => {
						currentCleanup = null;
					});
				}
			});
		}

		for (const support of PLATFORM_USAGES) {
			const preference = getPlatformSupportPreference(platformSupports, support);
			if (!isSupportActive(preference)) continue;
			addHostCatalogSupportButton(wrapper, termEl, idref, {
				...support,
				languageCode: getSupportLanguageCode(preference),
			}, player);
		}

		for (const support of hostSupports) {
			addHostCatalogSupportButton(wrapper, termEl, idref, support, player);
		}
	}

	return () => {
		currentCleanup?.();
		cleanupGlossaryTriggers(container);
	};
}

export function cleanupGlossaryTriggers(container: HTMLElement): void {
	for (const wrapper of Array.from(container.querySelectorAll<HTMLElement>('.qti-catalog-term'))) {
		const term = Array.from(wrapper.children).find((child) =>
			(child as HTMLElement).getAttribute?.('data-catalog-idref') !== null
		) as HTMLElement | undefined;
		if (term && wrapper.parentNode) {
			wrapper.parentNode.insertBefore(term, wrapper);
		}
		wrapper.remove();
	}
}

function createTriggerButton(termText: string, usage: string, labelPrefix: string, text?: string): HTMLButtonElement {
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'qti-catalog-trigger';
	btn.setAttribute('aria-label', `${labelPrefix}: ${termText}`);
	btn.setAttribute('data-catalog-usage', usage);
	btn.textContent = text ?? (usage === 'keyword-translation' ? 'T' : usage === ILLUSTRATED_GLOSSARY_USAGE ? 'I' : '?');
	return btn;
}

function addHostCatalogSupportButton(
	wrapper: HTMLElement,
	termEl: HTMLElement,
	idref: string,
	support: HostCatalogSupport,
	player: Player
): void {
	const html = player.getCatalogEntry(idref, support.usage, support.languageCode);
	if (html === null) return;
	const btn = createTriggerButton(termEl.textContent ?? idref, support.usage, support.label, support.text);
	wrapper.appendChild(btn);
	btn.addEventListener('click', () => {
		btn.dispatchEvent(
			new CustomEvent('qti-catalog-lookup', {
				bubbles: true,
				composed: true,
				detail: { idref, usage: support.usage, html, content: html, languageCode: support.languageCode },
			})
		);
	});
}

function getHostCatalogSupports(platformSupports: Record<string, CatalogSupportPreference | undefined>): HostCatalogSupport[] {
	return Object.entries(platformSupports)
		.map(([usage, preference]) => ({ usage: normalizeCatalogUsage(usage), preference }))
		.filter(({ usage, preference }) => usage !== null && isSupportActive(preference) && !isReservedCatalogUsage(usage))
		.map(({ usage, preference }) => ({
			usage: usage!,
			label: `Request ${usage!.replace(/[-_]+/g, ' ')}`,
			text: usage!.slice(0, 1).toUpperCase(),
			languageCode: getSupportLanguageCode(preference),
		}));
}

function getPlatformSupportPreference(
	platformSupports: Record<string, CatalogSupportPreference | undefined>,
	support: (typeof PLATFORM_USAGES)[number]
): CatalogSupportPreference | undefined {
	return platformSupports[support.flag] ?? platformSupports[support.usage];
}

function isSupportActive(preference: CatalogSupportPreference | undefined): boolean {
	if (preference === undefined) return false;
	if (typeof preference === 'boolean') return preference;
	return preference.active !== false;
}

function getSupportLanguageCode(preference: CatalogSupportPreference | undefined): string | undefined {
	if (!preference || typeof preference === 'boolean') return undefined;
	const languageCode = preference.languageCode?.trim();
	if (!languageCode || !/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(languageCode)) return undefined;
	return languageCode;
}

function normalizeCatalogUsage(value: string): string | null {
	const usage = value.trim().toLowerCase();
	if (!SAFE_CATALOG_USAGE.test(usage)) return null;
	return usage;
}

function isReservedCatalogUsage(usage: string): boolean {
	return RESERVED_PLATFORM_FLAGS.has(usage) || RESERVED_PLATFORM_USAGES.has(usage) || BUILT_IN_POPUP_USAGES.has(usage);
}

/**
 * Mount a catalog popup via the component registry. Falls back to a minimal
 * vanilla-JS popup if no 'catalogPopup' component is registered (e.g. in tests
 * that don't load default-components). Returns a cleanup function.
 */
function mountPopup(
	anchor: HTMLElement,
	label: string,
	html: string,
	triggerBtn: HTMLButtonElement,
	player: Player,
	onClose: () => void
): () => void {
	const registry = player.getComponentRegistry();

	let popupEl: HTMLElement;
	let closed = false;

	function cleanup() {
		if (closed) return;
		closed = true;
		popupEl.remove();
		triggerBtn.focus();
		onClose();
	}

	const catalogPopupTag = registry.getTagNameForType('catalogPopup');
	if (catalogPopupTag !== null) {
		const el = document.createElement(catalogPopupTag) as HTMLElement & {
			content: string;
			label: string;
			onClose: () => void;
		};
		el.content = html;
		el.label = label;
		el.onClose = cleanup;
		anchor.appendChild(el);
		popupEl = el;
	} else {
		// Minimal fallback for environments without default-components
		popupEl = buildFallbackPopup(label, html, cleanup);
		anchor.appendChild(popupEl);
	}

	return cleanup;
}

/**
 * Minimal accessible fallback popup used when no catalogPopup component is registered.
 * Uses DaisyUI card classes where available; degrades gracefully without them.
 */
function buildFallbackPopup(label: string, html: string, close: () => void): HTMLElement {
	const popup = document.createElement('div');
	popup.className = 'card card-bordered bg-base-100 shadow-lg qti-catalog-popup';
	popup.setAttribute('role', 'dialog');
	popup.setAttribute('aria-label', label);
	popup.setAttribute('aria-modal', 'true');
	popup.style.cssText = 'position:absolute;z-index:1000;min-width:16rem;max-width:24rem';

	const header = document.createElement('div');
	header.className = 'card-title flex justify-between items-center px-3 py-2 border-b border-base-300 bg-base-200';

	const title = document.createElement('span');
	title.className = 'text-sm font-semibold';
	title.textContent = label;

	const closeBtn = document.createElement('button');
	closeBtn.type = 'button';
	closeBtn.className = 'btn btn-ghost btn-xs';
	closeBtn.setAttribute('aria-label', 'Close');
	closeBtn.textContent = '✕';

	header.appendChild(title);
	header.appendChild(closeBtn);

	const body = document.createElement('div');
	body.className = 'card-body p-3';

	const isUrl = /^(https?:\/\/|\/)/i.test(html.trim());
	if (isUrl) {
		const img = document.createElement('img');
		img.src = html.trim();
		img.alt = label;
		img.className = 'max-w-full h-auto block mx-auto';
		body.appendChild(img);
	} else {
		body.innerHTML = html;
	}

	popup.appendChild(header);
	popup.appendChild(body);

	// Focus trap + Escape
	const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			closeBtn.click();
			return;
		}
		if (e.key === 'Tab') {
			const focusable = Array.from(popup.querySelectorAll<HTMLElement>(focusableSelector)).filter(
				(el) => el.offsetParent !== null
			);
			if (focusable.length === 0) { e.preventDefault(); return; }
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	popup.addEventListener('keydown', handleKeyDown);
	closeBtn.addEventListener('click', () => close());

	// Move focus in on next tick
	setTimeout(() => closeBtn.focus(), 0);

	return popup;
}
