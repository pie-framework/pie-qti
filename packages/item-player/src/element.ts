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
import { createSvelteMountController } from '@pie-qti/qti-common';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { AdaptiveAttemptResult, PlayerSecurityConfig, QTIRole } from './types/index.js';
import type { I18nProvider } from '@pie-qti/i18n';
import type { PnpProfile } from './pnp/types.js';

const TAG = 'pie-qti-item-player';
type ItemResponseMap = Record<string, unknown>;
type ItemPlayerElementProps = {
	itemXml: string;
	role: QTIRole;
	disabled: boolean;
	typeset: ((el: HTMLElement) => void) | undefined;
	i18n: I18nProvider | undefined;
	security: PlayerSecurityConfig | undefined;
	pnp: PnpProfile | undefined;
	deliveryContext: ResolvedItemDeliveryContext | undefined;
	responses: ItemResponseMap | undefined;
	onResponseChange: ((id: string, value: unknown) => void) | undefined;
	onSubmit: ((responses: Record<string, unknown>, result: unknown) => void) | undefined;
	onComplete: ((result: AdaptiveAttemptResult) => void) | undefined;
};

class PieQtiItemPlayerElement extends HTMLElement {
	static observedAttributes = ['item-xml', 'role', 'disabled'];

	#mountController = createSvelteMountController({
		host: this,
		mount: (target, props: ItemPlayerElementProps) =>
			mount(ItemPlayer, { target, props }),
		unmount,
	});

	// Attribute-backed props
	#itemXml = '';
	#role: QTIRole = 'candidate';
	#disabled = false;

	// JS-only props
	#typeset: ((el: HTMLElement) => void) | undefined;
	#i18n: I18nProvider | undefined;
	#security: PlayerSecurityConfig | undefined;
	#pnp: PnpProfile | undefined;
	#deliveryContext: ResolvedItemDeliveryContext | undefined;
	#responses: ItemResponseMap | undefined;
	#onResponseChange: ((id: string, value: unknown) => void) | undefined;
	#onSubmit: ((responses: Record<string, unknown>, result: unknown) => void) | undefined;
	#onComplete: ((result: AdaptiveAttemptResult) => void) | undefined;

	// --- JS-only property accessors ---

	get itemXml() { return this.#itemXml; }
	set itemXml(v: string | undefined) { this.#itemXml = v ?? ''; this.#update(); }

	get role(): string | null { return this.#role; }
	set role(v: string | null) { this.#role = (v ?? 'candidate') as QTIRole; this.#update(); }

	get disabled() { return this.#disabled; }
	set disabled(v: boolean | undefined) { this.#disabled = Boolean(v); this.#update(); }

	get typeset() { return this.#typeset; }
	set typeset(v: ((el: HTMLElement) => void) | undefined) { this.#typeset = v; this.#update(); }

	get i18n() { return this.#i18n; }
	set i18n(v: I18nProvider | undefined) { this.#i18n = v; this.#update(); }

	get security() { return this.#security; }
	set security(v: PlayerSecurityConfig | undefined) { this.#security = v; this.#update(); }

	get pnp() { return this.#pnp; }
	set pnp(v: PnpProfile | undefined) { this.#pnp = v; this.#update(); }

	get deliveryContext() { return this.#deliveryContext; }
	set deliveryContext(v: ResolvedItemDeliveryContext | undefined) { this.#deliveryContext = v; this.#update(); }

	get responses() { return this.#responses; }
	set responses(v: ItemResponseMap | undefined) { this.#responses = v; this.#update(); }

	get onResponseChange() { return this.#onResponseChange; }
	set onResponseChange(v: ((id: string, value: unknown) => void) | undefined) { this.#onResponseChange = v; this.#update(); }

	get onSubmit() { return this.#onSubmit; }
	set onSubmit(v: ((responses: Record<string, unknown>, result: unknown) => void) | undefined) { this.#onSubmit = v; this.#update(); }

	get onComplete() { return this.#onComplete; }
	set onComplete(v: ((result: AdaptiveAttemptResult) => void) | undefined) { this.#onComplete = v; this.#update(); }

	// --- Lifecycle ---

	connectedCallback() {
		this.#mountController.mountOrUpdate(this.#getProps());
	}

	disconnectedCallback() {
		this.#mountController.teardown({ removeContainer: true });
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null) {
		if (name === 'item-xml') this.#itemXml = value ?? '';
		else if (name === 'role') this.#role = (value ?? 'candidate') as QTIRole;
		else if (name === 'disabled') this.#disabled = value !== null;
		this.#update();
	}

	// --- Private helpers ---

	#getProps(): ItemPlayerElementProps {
		return {
			itemXml: this.#itemXml,
			role: this.#role,
			disabled: this.#disabled,
			typeset: this.#typeset,
			i18n: this.#i18n,
			security: this.#security,
			pnp: this.#pnp,
			deliveryContext: this.#deliveryContext,
			responses: this.#responses,
			onResponseChange: this.#onResponseChange,
			onSubmit: this.#onSubmit,
			onComplete: this.#onComplete,
		};
	}

	#update() {
		this.#mountController.update(this.#getProps());
	}
}

if (!customElements.get(TAG)) {
	customElements.define(TAG, PieQtiItemPlayerElement);
}

export { PieQtiItemPlayerElement };
