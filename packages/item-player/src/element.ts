/**
 * pie-qti-item-player custom element.
 *
 * Side-effect import that registers <pie-qti-item-player>:
 *   import '@pie-qti/item-player/element';
 *
 * String/boolean props map to HTML attributes (item-xml, role, disabled).
 * Complex props (typeset, i18n, security, onResponseChange, onSubmit, onComplete)
 * are JS-only properties — set them on the element instance directly.
 */

import { mount, unmount } from 'svelte';
import ItemPlayer from './components/ItemPlayer.svelte';
import type { AdaptiveAttemptResult, PlayerSecurityConfig, QTIRole } from './types/index.js';
import type { I18nProvider } from '@pie-qti/i18n';

const TAG = 'pie-qti-item-player';

class PieQtiItemPlayerElement extends HTMLElement {
	static observedAttributes = ['item-xml', 'role', 'disabled'];

	#container: HTMLDivElement | null = null;
	#instance: any = null;

	// Attribute-backed props
	#itemXml = '';
	#role: QTIRole = 'candidate';
	#disabled = false;

	// JS-only props
	#typeset: ((el: HTMLElement) => void) | undefined;
	#i18n: I18nProvider | undefined;
	#security: PlayerSecurityConfig | undefined;
	#onResponseChange: ((id: string, value: unknown) => void) | undefined;
	#onSubmit: ((responses: Record<string, unknown>, result: unknown) => void) | undefined;
	#onComplete: ((result: AdaptiveAttemptResult) => void) | undefined;

	// --- JS-only property accessors ---

	get typeset() { return this.#typeset; }
	set typeset(v: ((el: HTMLElement) => void) | undefined) { this.#typeset = v; this.#update(); }

	get i18n() { return this.#i18n; }
	set i18n(v: I18nProvider | undefined) { this.#i18n = v; this.#update(); }

	get security() { return this.#security; }
	set security(v: PlayerSecurityConfig | undefined) { this.#security = v; this.#update(); }

	get onResponseChange() { return this.#onResponseChange; }
	set onResponseChange(v: ((id: string, value: unknown) => void) | undefined) { this.#onResponseChange = v; this.#update(); }

	get onSubmit() { return this.#onSubmit; }
	set onSubmit(v: ((responses: Record<string, unknown>, result: unknown) => void) | undefined) { this.#onSubmit = v; this.#update(); }

	get onComplete() { return this.#onComplete; }
	set onComplete(v: ((result: AdaptiveAttemptResult) => void) | undefined) { this.#onComplete = v; this.#update(); }

	// --- Lifecycle ---

	connectedCallback() {
		this.#mount();
	}

	disconnectedCallback() {
		this.#teardown();
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (name === 'item-xml') this.#itemXml = value ?? '';
		else if (name === 'role') this.#role = (value ?? 'candidate') as QTIRole;
		else if (name === 'disabled') this.#disabled = value !== null;
		this.#update();
	}

	// --- Private helpers ---

	#getProps() {
		return {
			itemXml: this.#itemXml,
			role: this.#role,
			disabled: this.#disabled,
			typeset: this.#typeset,
			i18n: this.#i18n,
			security: this.#security,
			onResponseChange: this.#onResponseChange,
			onSubmit: this.#onSubmit,
			onComplete: this.#onComplete,
		};
	}

	#mount() {
		if (this.#instance) return;
		if (!this.#container) {
			this.#container = document.createElement('div');
			this.#container.style.display = 'contents';
			this.appendChild(this.#container);
		}
		this.#instance = mount(ItemPlayer, { target: this.#container, props: this.#getProps() });
	}

	#update() {
		if (!this.#instance) return;
		if (typeof this.#instance.$set === 'function') {
			this.#instance.$set(this.#getProps());
		} else {
			// Svelte 5 runes components: remount with new props
			this.#teardown();
			this.#mount();
		}
	}

	#teardown() {
		if (this.#instance) {
			try { unmount(this.#instance); } catch { /* ignore */ }
			this.#instance = null;
		}
		if (this.#container) {
			this.#container.remove();
			this.#container = null;
		}
	}
}

if (!customElements.get(TAG)) {
	customElements.define(TAG, PieQtiItemPlayerElement);
}

export { PieQtiItemPlayerElement };
