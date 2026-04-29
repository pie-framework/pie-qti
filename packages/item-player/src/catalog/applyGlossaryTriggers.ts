import type { Player } from '../core/Player.js';

const PLATFORM_USAGES = new Set(['tts-pronunciation', 'signing-definition', 'braille-text', 'audio-description']);

/**
 * Inject glossary/keyword-translation trigger buttons into a rendered item container.
 *
 * When pnp.content.glossaryOnScreen is true, each [data-catalog-idref] element gets a
 * trigger button. Clicking the button looks up the catalog entry and shows a floating
 * popup. Clicking again or pressing Escape closes it.
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
					currentCleanup = mountPopup(wrapper, termEl.textContent ?? idref, html, btn, () => {
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
					currentCleanup = mountPopup(wrapper, termEl.textContent ?? idref, html, btn, () => {
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
	// Small superscript-style indicator
	btn.textContent = usage === 'keyword-translation' ? 'T' : '?';
	return btn;
}

/**
 * Mount a vanilla JS popup adjacent to `anchor`. Returns a cleanup function.
 * Focus is trapped within the popup; Escape and the close button dismiss it.
 */
function mountPopup(
	anchor: HTMLElement,
	label: string,
	html: string,
	triggerBtn: HTMLButtonElement,
	onClose: () => void
): () => void {
	const popup = document.createElement('div');
	popup.className = 'qti-catalog-popup';
	popup.setAttribute('role', 'dialog');
	popup.setAttribute('aria-label', label);
	popup.setAttribute('aria-modal', 'true');

	// Header
	const header = document.createElement('div');
	header.className = 'qti-catalog-popup__header';

	const title = document.createElement('span');
	title.className = 'qti-catalog-popup__title';
	title.textContent = label;

	const closeBtn = document.createElement('button');
	closeBtn.type = 'button';
	closeBtn.className = 'qti-catalog-popup__close';
	closeBtn.setAttribute('aria-label', 'Close');
	closeBtn.textContent = '✕';

	header.appendChild(title);
	header.appendChild(closeBtn);

	// Body
	const body = document.createElement('div');
	body.className = 'qti-catalog-popup__body';

	const isUrl = /^(https?:\/\/|\/)/i.test(html.trim());
	if (isUrl) {
		const img = document.createElement('img');
		img.src = html.trim();
		img.alt = label;
		img.className = 'qti-catalog-popup__img';
		body.appendChild(img);
	} else {
		body.innerHTML = html;
	}

	popup.appendChild(header);
	popup.appendChild(body);
	anchor.appendChild(popup);

	// Focus the close button
	closeBtn.focus();

	const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function getFocusable(): HTMLElement[] {
		return Array.from(popup.querySelectorAll<HTMLElement>(focusableSelector)).filter(
			(el) => el.offsetParent !== null
		);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cleanup();
			return;
		}
		if (e.key === 'Tab') {
			const focusable = getFocusable();
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

	closeBtn.addEventListener('click', () => cleanup());
	popup.addEventListener('keydown', handleKeyDown);

	function cleanup() {
		popup.removeEventListener('keydown', handleKeyDown);
		popup.remove();
		triggerBtn.focus();
		onClose();
	}

	return cleanup;
}
