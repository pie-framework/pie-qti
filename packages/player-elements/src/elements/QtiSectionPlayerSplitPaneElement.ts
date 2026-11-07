import type { I18nProvider } from '@pie-qti/i18n';
import type { PciConfiguration, PlayerSecurityConfig } from '@pie-qti/item-player';
import type { ResolvedQtiSectionComposition } from '@pie-qti/section-player';
import SectionPlayerSplitPane from '../../../section-player/src/components/SectionPlayerSplitPane.svelte';
import { QTI_SECTION_PLAYER_SPLITPANE_TAG } from '../constants.js';
import { parseHeadingLevel } from '../utils/heading-level.js';
import { BaseSvelteMountElement } from './BaseSvelteMountElement.js';

export type QtiSectionResponseDeltaDetail = {
	sectionIdentifier: string;
	itemIdentifier: string;
	responseIdentifier: string;
	value: unknown;
};

export interface QtiSectionPlayerEventMap {
	'qti-section-response-delta': CustomEvent<QtiSectionResponseDeltaDetail>;
}

type SectionPlayerElementProps = {
	composition: ResolvedQtiSectionComposition;
	security?: PlayerSecurityConfig;
	pci?: PciConfiguration;
	i18n?: I18nProvider;
	typeset?: (root: HTMLElement) => void | Promise<void>;
	headingLevel?: number;
	onResponseChange: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
};

export abstract class QtiSectionPlayerElementBase extends BaseSvelteMountElement<SectionPlayerElementProps> {
	static get observedAttributes() {
		return ['heading-level'];
	}

	#composition: ResolvedQtiSectionComposition | null = null;
	#security: PlayerSecurityConfig | undefined;
	#pci: PciConfiguration | undefined;
	#i18n: I18nProvider | undefined;
	#typeset: ((root: HTMLElement) => void | Promise<void>) | undefined;
	#headingLevel: number | undefined;

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (name !== 'heading-level') return;
		this.#headingLevel = parseHeadingLevel(newValue);
		if (this.isConnected) {
			this._mountOrUpdate();
		}
	}

	/**
	 * Heading level (1–6) of the passage and item titles, so they fit the host page
	 * outline. Default 3. Reflects the `heading-level` attribute.
	 */
	get headingLevel(): number | undefined {
		return this.#headingLevel;
	}

	set headingLevel(value: number | undefined) {
		const level = parseHeadingLevel(value === undefined ? null : String(value));
		if (level === undefined) this.removeAttribute('heading-level');
		else this.setAttribute('heading-level', String(level));
	}

	get composition() {
		return this.#composition;
	}

	set composition(value: ResolvedQtiSectionComposition | null) {
		this.#composition = value;
		if (this.isConnected) {
			this._mountOrUpdate();
		}
	}

	get security() {
		return this.#security;
	}

	set security(value: PlayerSecurityConfig | undefined) {
		this.#security = value;
		if (this.isConnected) {
			this._mountOrUpdate();
		}
	}

	/** Portable Custom Interaction trust configuration. JS-only because it contains a resolver. */
	get pci(): PciConfiguration | undefined {
		return this.#pci;
	}

	set pci(value: PciConfiguration | undefined) {
		this.#pci = value;
		if (this.isConnected) {
			this._mountOrUpdate();
		}
	}

	/**
	 * The interface locale provider. It drives the section chrome, the tool
	 * toolkit and the item players the section mounts. JS-only because it is an object.
	 */
	get i18n(): I18nProvider | undefined {
		return this.#i18n;
	}

	set i18n(value: I18nProvider | undefined) {
		this.#i18n = value;
		if (this.isConnected) {
			this._mountOrUpdate();
		}
	}

	get typeset() {
		return this.#typeset;
	}

	set typeset(value: ((root: HTMLElement) => void | Promise<void>) | undefined) {
		this.#typeset = value;
		if (this.isConnected) {
			this._mountOrUpdate();
		}
	}

	protected override _mountOrUpdate() {
		if (!this.#composition) {
			return;
		}
		super._mountOrUpdate();
	}

	addEventListener<K extends keyof QtiSectionPlayerEventMap>(
		type: K,
		listener: (this: QtiSectionPlayerElementBase, event: QtiSectionPlayerEventMap[K]) => unknown,
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

	protected getProps(): SectionPlayerElementProps {
		const composition = this.#composition;
		if (!composition) {
			throw new Error('Cannot mount section player before composition is assigned.');
		}

		return {
			composition,
			security: this.#security ?? composition.security,
			pci: this.#pci,
			i18n: this.#i18n,
			typeset: this.#typeset,
			...(this.#headingLevel === undefined ? {} : { headingLevel: this.#headingLevel }),
			onResponseChange: (itemIdentifier, responseIdentifier, value) => {
				const detail: QtiSectionResponseDeltaDetail = {
					sectionIdentifier: composition.section.identifier,
					itemIdentifier,
					responseIdentifier,
					value,
				};
				this.dispatchEvent(
					new CustomEvent<QtiSectionResponseDeltaDetail>('qti-section-response-delta', {
						detail,
						bubbles: true,
						composed: true,
					}),
				);
			},
		};
	}
}

export class QtiSectionPlayerSplitPaneElement extends QtiSectionPlayerElementBase {
	protected Component: any = SectionPlayerSplitPane;
}

export function defineQtiSectionPlayerSplitPaneElement() {
	if (!customElements.get(QTI_SECTION_PLAYER_SPLITPANE_TAG)) {
		customElements.define(QTI_SECTION_PLAYER_SPLITPANE_TAG, QtiSectionPlayerSplitPaneElement);
	}
}
