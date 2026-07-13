/**
 * Registration-free implementation of the <pie-qti-item-player> custom element.
 *
 * Import `@pie-qti/item-player/element` when registration side effects are
 * desired. Browser runtimes that own registration can import this module and
 * define the class themselves.
 */

import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { I18nProvider } from '@pie-qti/i18n';
import { createSvelteMountController } from '@pie-qti/qti-common';
import { mount, unmount } from 'svelte';
import ItemPlayer from './components/ItemPlayer.svelte';
import type { PnpProfile } from './pnp/types.js';
import type {
	AdaptiveAttemptResult,
	PlayerConfig,
	PlayerSecurityConfig,
	QTIRole,
	ScoringResult,
} from './types/index.js';

const HTMLElementBase: typeof HTMLElement = globalThis.HTMLElement ?? (class {} as typeof HTMLElement);

export type PieQtiItemPlayerResponseMap = Record<string, unknown>;
export type PieQtiItemPlayerSubmissionResult = ScoringResult | AdaptiveAttemptResult;

export interface PieQtiItemPlayerResponseChangeDetail {
	responseId: string;
	value: unknown;
	responses: PieQtiItemPlayerResponseMap;
}

export interface PieQtiItemPlayerSubmitDetail {
	responses: PieQtiItemPlayerResponseMap;
	result: PieQtiItemPlayerSubmissionResult;
}

export interface PieQtiItemPlayerCompleteDetail {
	result: AdaptiveAttemptResult;
}

export interface PieQtiItemPlayerEventMap {
	'response-change': CustomEvent<PieQtiItemPlayerResponseChangeDetail>;
	ready: CustomEvent<void>;
	submit: CustomEvent<PieQtiItemPlayerSubmitDetail>;
	complete: CustomEvent<PieQtiItemPlayerCompleteDetail>;
}

type ItemPlayerElementProps = {
	itemXml: string;
	role: QTIRole;
	disabled: boolean;
	renderItemBodyRubrics: boolean;
	typeset: ((el: HTMLElement) => void) | undefined;
	i18n: I18nProvider | undefined;
	security: PlayerSecurityConfig | undefined;
	pnp: PnpProfile | undefined;
	deliveryContext: ResolvedItemDeliveryContext | undefined;
	resolveProcessingFragment: PlayerConfig['resolveProcessingFragment'];
	processingFragmentLimits: PlayerConfig['processingFragmentLimits'];
	pci: PlayerConfig['pci'];
	responses: PieQtiItemPlayerResponseMap | undefined;
	onResponseChange: (id: string, value: unknown) => void;
	onSubmit: (responses: PieQtiItemPlayerResponseMap, result: PieQtiItemPlayerSubmissionResult) => void;
	showSubmit: boolean;
	onComplete: (result: AdaptiveAttemptResult) => void;
};

type ItemPlayerComponentInstance = {
	submit(countAttempt?: boolean): PieQtiItemPlayerSubmissionResult | undefined;
};

export class PieQtiItemPlayerElement extends HTMLElementBase {
	static get observedAttributes() {
		return ['item-xml', 'role', 'disabled'];
	}

	#mountController = createSvelteMountController<ItemPlayerElementProps, ItemPlayerComponentInstance>({
		host: this,
		mount: (target, props) => mount(ItemPlayer, { target, props }) as ItemPlayerComponentInstance,
		unmount,
	});

	// Attribute-backed props
	#itemXml = '';
	#role: QTIRole = 'candidate';
	#disabled = false;
	#renderItemBodyRubrics = true;

	// JS-only props
	#typeset: ((el: HTMLElement) => void) | undefined;
	#i18n: I18nProvider | undefined;
	#security: PlayerSecurityConfig | undefined;
	#pnp: PnpProfile | undefined;
	#deliveryContext: ResolvedItemDeliveryContext | undefined;
	#resolveProcessingFragment: PlayerConfig['resolveProcessingFragment'];
	#processingFragmentLimits: PlayerConfig['processingFragmentLimits'];
	#pci: PlayerConfig['pci'];
	#responses: PieQtiItemPlayerResponseMap | undefined;
	#onResponseChange: ((id: string, value: unknown) => void) | undefined;
	#onSubmit: ((responses: PieQtiItemPlayerResponseMap, result: PieQtiItemPlayerSubmissionResult) => void) | undefined;
	#onComplete: ((result: AdaptiveAttemptResult) => void) | undefined;

	get itemXml() {
		return this.#itemXml;
	}
	set itemXml(value: string | undefined) {
		this.#itemXml = value ?? '';
		this.#update();
	}

	get role(): QTIRole {
		return this.#role;
	}
	set role(value: QTIRole | null) {
		this.#role = value ?? 'candidate';
		this.#update();
	}

	get disabled() {
		return this.#disabled;
	}
	set disabled(value: boolean | undefined) {
		this.#disabled = Boolean(value);
		this.#update();
	}

	get renderItemBodyRubrics() {
		return this.#renderItemBodyRubrics;
	}
	set renderItemBodyRubrics(value: boolean | undefined) {
		this.#renderItemBodyRubrics = value !== false;
		this.#update();
	}

	get typeset() {
		return this.#typeset;
	}
	set typeset(value: ((el: HTMLElement) => void) | undefined) {
		this.#typeset = value;
		this.#update();
	}

	get i18n() {
		return this.#i18n;
	}
	set i18n(value: I18nProvider | undefined) {
		this.#i18n = value;
		this.#update();
	}

	get security() {
		return this.#security;
	}
	set security(value: PlayerSecurityConfig | undefined) {
		this.#security = value;
		this.#update();
	}

	get pnp() {
		return this.#pnp;
	}
	set pnp(value: PnpProfile | undefined) {
		this.#pnp = value;
		this.#update();
	}

	get deliveryContext() {
		return this.#deliveryContext;
	}
	set deliveryContext(value: ResolvedItemDeliveryContext | undefined) {
		this.#deliveryContext = value;
		this.#update();
	}

	/**
	 * Portable Custom Interaction trust configuration. Set as a JavaScript property;
	 * functions such as moduleResolver cannot be represented safely as attributes.
	 */
	get pci() {
		return this.#pci;
	}
	set pci(value: PlayerConfig['pci']) {
		this.#pci = value;
		this.#update();
	}

	get resolveProcessingFragment() {
		return this.#resolveProcessingFragment;
	}
	set resolveProcessingFragment(value: PlayerConfig['resolveProcessingFragment']) {
		this.#resolveProcessingFragment = value;
		this.#update();
	}

	get processingFragmentLimits() {
		return this.#processingFragmentLimits;
	}
	set processingFragmentLimits(value: PlayerConfig['processingFragmentLimits']) {
		this.#processingFragmentLimits = value;
		this.#update();
	}

	get responses() {
		return this.#responses;
	}
	set responses(value: PieQtiItemPlayerResponseMap | undefined) {
		this.#responses = value ? { ...value } : undefined;
		this.#update();
	}

	get onResponseChange() {
		return this.#onResponseChange;
	}
	set onResponseChange(value: ((id: string, response: unknown) => void) | undefined) {
		this.#onResponseChange = value;
	}

	get onSubmit() {
		return this.#onSubmit;
	}
	set onSubmit(
		value: ((responses: PieQtiItemPlayerResponseMap, result: PieQtiItemPlayerSubmissionResult) => void) | undefined,
	) {
		this.#onSubmit = value;
		this.#update();
	}

	get onComplete() {
		return this.#onComplete;
	}
	set onComplete(value: ((result: AdaptiveAttemptResult) => void) | undefined) {
		this.#onComplete = value;
	}

	connectedCallback() {
		this.#mountController.mountOrUpdate(this.#getProps());
		queueMicrotask(() => {
			if (!this.isConnected) return;
			this.dispatchEvent(new CustomEvent<void>('ready', { bubbles: true, composed: true }));
		});
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

	/** Score the current responses and emit `submit` (and, when applicable, `complete`). */
	submit(countAttempt = true): PieQtiItemPlayerSubmissionResult | undefined {
		return this.#mountController.instance?.submit(countAttempt);
	}

	addEventListener<K extends keyof PieQtiItemPlayerEventMap>(
		type: K,
		listener: (this: PieQtiItemPlayerElement, event: PieQtiItemPlayerEventMap[K]) => unknown,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void {
		super.addEventListener(type, listener, options);
	}

	#getProps(): ItemPlayerElementProps {
		return {
			itemXml: this.#itemXml,
			role: this.#role,
			disabled: this.#disabled,
			renderItemBodyRubrics: this.#renderItemBodyRubrics,
			typeset: this.#typeset,
			i18n: this.#i18n,
			security: {
				...(this.#security ?? {}),
				parsingLimits: {
					enabled: true,
					...(this.#security?.parsingLimits ?? {}),
				},
			},
			pnp: this.#pnp,
			deliveryContext: this.#deliveryContext,
			resolveProcessingFragment: this.#resolveProcessingFragment,
			processingFragmentLimits: this.#processingFragmentLimits,
			pci: this.#pci,
			responses: this.#responses,
			onResponseChange: (responseId, value) => {
				const responses = { ...(this.#responses ?? {}), [responseId]: value };
				this.#responses = responses;
				this.#onResponseChange?.(responseId, value);
				this.dispatchEvent(
					new CustomEvent<PieQtiItemPlayerResponseChangeDetail>('response-change', {
						detail: { responseId, value, responses: { ...responses } },
						bubbles: true,
						composed: true,
					}),
				);
			},
			onSubmit: (responses, result) => {
				const snapshot = { ...responses };
				this.#responses = snapshot;
				this.#onSubmit?.(snapshot, result);
				this.dispatchEvent(
					new CustomEvent<PieQtiItemPlayerSubmitDetail>('submit', {
						detail: { responses: snapshot, result },
						bubbles: true,
						composed: true,
					}),
				);
			},
			showSubmit: Boolean(this.#onSubmit),
			onComplete: (result) => {
				this.#onComplete?.(result);
				this.dispatchEvent(
					new CustomEvent<PieQtiItemPlayerCompleteDetail>('complete', {
						detail: { result },
						bubbles: true,
						composed: true,
					}),
				);
			},
		};
	}

	#update() {
		this.#mountController.update(this.#getProps());
	}
}
