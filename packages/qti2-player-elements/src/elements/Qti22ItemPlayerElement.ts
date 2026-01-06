import ItemRenderer from '@pie-qti/qti2-assessment-player/components/ItemRenderer.svelte';
import type { QTIRole } from '@pie-qti/qti2-item-player';
import { QTI22_ITEM_PLAYER_TAG } from '../constants.js';
import { safeJsonParse } from '../utils/json.js';
import { BaseSvelteMountElement } from './BaseSvelteMountElement.js';

export type Qti22ItemPlayerResponseChangeDetail = {
	responseId: string;
	value: unknown;
	responses: Record<string, unknown>;
};

export class Qti22ItemPlayerElement extends BaseSvelteMountElement<Record<string, unknown>> {
	static get observedAttributes() {
		return [
			'item-xml',
			'identifier',
			'title',
			'role',
			'extended-text-editor',
			'responses-json',
		];
	}

	protected Component = ItemRenderer;

	#itemXml: string | null = null;
	#identifier = 'item-1';
	#title: string | undefined;
	#role: QTIRole = 'candidate';
	#extendedTextEditor: 'tiptap' | 'textarea' = 'tiptap';
	#responses: Record<string, unknown> = {};

	#updateSeq = 0;

	connectedCallback() {
		super.connectedCallback();
		queueMicrotask(() => {
			this.dispatchEvent(new CustomEvent('ready', { bubbles: true, composed: true }));
		});
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		switch (name) {
			case 'item-xml':
				this.#itemXml = newValue;
				break;
			case 'identifier':
				if (newValue) this.#identifier = newValue;
				break;
			case 'title':
				this.#title = newValue ?? undefined;
				break;
			case 'role':
				if (newValue) this.#role = newValue as QTIRole;
				break;
			case 'extended-text-editor':
				if (newValue === 'tiptap' || newValue === 'textarea') {
					this.#extendedTextEditor = newValue;
				}
				break;
			case 'responses-json': {
				const parsed = safeJsonParse<Record<string, unknown>>(newValue);
				if (parsed) this.#responses = parsed;
				break;
			}
		}

		void this.#syncState();
	}

	/**
	 * Preferred API: set QTI via JS property (attributes are awkward for large XML).
	 */
	get itemXml() {
		return this.#itemXml;
	}
	set itemXml(value: string | null) {
		this.#itemXml = value;
		void this.#syncState();
	}

	get identifier() {
		return this.#identifier;
	}
	set identifier(value: string) {
		this.#identifier = value;
		void this.#syncState();
	}

	get title() {
		return this.#title ?? '';
	}
	set title(value: string) {
		this.#title = value || undefined;
		void this.#syncState();
	}

	get role() {
		return this.#role;
	}
	set role(value: QTIRole) {
		this.#role = value;
		void this.#syncState();
	}

	get extendedTextEditor() {
		return this.#extendedTextEditor;
	}
	set extendedTextEditor(value: 'tiptap' | 'textarea') {
		this.#extendedTextEditor = value;
		void this.#syncState();
	}

	get responses() {
		return { ...this.#responses };
	}
	set responses(value: Record<string, unknown>) {
		this.#responses = value ?? {};
		void this.#syncState();
	}

	/**
	 * Convenience: programmatically set a response.
	 */
	setResponse(responseId: string, value: unknown) {
		this.#responses = { ...this.#responses, [responseId]: value };
		void this.#syncState();
	}

	/**
	 * Async state synchronization method for consistency with assessment player architecture.
	 * Currently synchronous since item player doesn't require async operations,
	 * but using async pattern allows future enhancements (validation, preprocessing, etc.)
	 */
	async #syncState() {
		const seq = ++this.#updateSeq;

		// Future: could add validation, preprocessing, etc. here
		// For now, just proceed to mount/update

		if (seq !== this.#updateSeq) return; // superseded by newer update
		this._mountOrUpdate();
	}

	getProps() {
		return {
			questionRef: {
				identifier: this.#identifier,
				title: this.#title,
				itemXml: this.#itemXml ?? '',
			},
			role: this.#role,
			extendedTextEditor: this.#extendedTextEditor,
			responses: this.#responses,
			onResponseChange: (responseId: string, value: unknown) => {
				this.#responses = { ...this.#responses, [responseId]: value };
				const detail: Qti22ItemPlayerResponseChangeDetail = {
					responseId,
					value,
					responses: { ...this.#responses },
				};
				this.dispatchEvent(
					new CustomEvent<Qti22ItemPlayerResponseChangeDetail>('response-change', {
						detail,
						bubbles: true,
						composed: true,
					}),
				);
			},
		};
	}
}

export function defineQti22ItemPlayerElement() {
	if (!customElements.get(QTI22_ITEM_PLAYER_TAG)) {
		customElements.define(QTI22_ITEM_PLAYER_TAG, Qti22ItemPlayerElement);
	}
}


