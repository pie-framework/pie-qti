import type { PlayerSecurityConfig } from '@pie-qti/item-player';
import type { ResolvedQtiSectionComposition } from '@pie-qti/section-player';
import SectionPlayerSplitPane from '../../../section-player/src/components/SectionPlayerSplitPane.svelte';
import { QTI_SECTION_PLAYER_SPLITPANE_TAG } from '../constants.js';
import { BaseSvelteMountElement } from './BaseSvelteMountElement.js';

export type QtiSectionResponseDeltaDetail = {
	sectionIdentifier: string;
	itemIdentifier: string;
	responseIdentifier: string;
	value: unknown;
};

type SectionPlayerElementProps = {
	composition: ResolvedQtiSectionComposition;
	security?: PlayerSecurityConfig;
	typeset?: (root: HTMLElement) => void | Promise<void>;
	onResponseChange: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
};

export abstract class QtiSectionPlayerElementBase extends BaseSvelteMountElement<SectionPlayerElementProps> {
	#composition: ResolvedQtiSectionComposition | null = null;
	#security: PlayerSecurityConfig | undefined;
	#typeset: ((root: HTMLElement) => void | Promise<void>) | undefined;

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

	protected getProps(): SectionPlayerElementProps {
		const composition = this.#composition;
		if (!composition) {
			throw new Error('Cannot mount section player before composition is assigned.');
		}

		return {
			composition,
			security: this.#security ?? composition.security,
			typeset: this.#typeset,
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
