import type { Player } from '../core/Player.js';

const PLATFORM_USAGES = new Set(['tts-pronunciation', 'signing-definition', 'braille-text', 'audio-description']);

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
export function applyGlossaryTriggers(container: HTMLElement, player: Player): void {
	const pnp = player.getPnp();
	if (!pnp) return;

	const glossaryOn = pnp.content?.glossaryOnScreen === true;
	const kwTranslation = pnp.content?.keywordTranslation;
	const kwOn = kwTranslation?.active === true && !!kwTranslation.languageCode;

	if (!glossaryOn && !kwOn) return;

	const terms = container.querySelectorAll<HTMLElement>('[data-catalog-idref]');
	if (terms.length === 0) return;

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
			const btn = createTriggerButton(termEl.textContent ?? idref, 'glossary-on-screen');
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
			const btn = createTriggerButton(termEl.textContent ?? idref, 'keyword-translation');
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

		// Platform-level usages: fire event, no popup
		for (const usage of PLATFORM_USAGES) {
			const html = player.getCatalogEntry(idref, usage);
			if (html !== null) {
				termEl.dispatchEvent(
					new CustomEvent('qti-catalog-lookup', {
						bubbles: true,
						composed: true,
						detail: { idref, usage, html },
					})
				);
			}
		}
	}
}

function createTriggerButton(termText: string, usage: string): HTMLButtonElement {
	const btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'qti-catalog-trigger';
	btn.setAttribute('aria-label', `Show definition: ${termText}`);
	btn.setAttribute('data-catalog-usage', usage);
	btn.textContent = usage === 'keyword-translation' ? 'T' : '?';
	return btn;
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
		popupEl = buildFallbackPopup(label, html);
		anchor.appendChild(popupEl);
	}

	function cleanup() {
		popupEl.remove();
		triggerBtn.focus();
		onClose();
	}

	return cleanup;
}

/**
 * Minimal accessible fallback popup used when no catalogPopup component is registered.
 * Uses DaisyUI card classes where available; degrades gracefully without them.
 */
function buildFallbackPopup(label: string, html: string): HTMLElement {
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
	closeBtn.addEventListener('click', () => popup.remove());

	// Move focus in on next tick
	setTimeout(() => closeBtn.focus(), 0);

	return popup;
}
