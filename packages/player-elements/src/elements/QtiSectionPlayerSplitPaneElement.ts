import type {
	QtiSectionDisplaySettingsEvent,
	QtiSectionFrameworkError,
	ResolvedQtiSectionComposition,
} from '@pie-qti/section-player';
import type { I18nProvider } from '@pie-qti/i18n';
import type { PciConfiguration, PlayerSecurityConfig } from '@pie-qti/item-player';
import SectionPlayerSplitPane from '@pie-qti/section-player/components/SectionPlayerSplitPane.svelte';
import { QTI_SECTION_PLAYER_SPLITPANE_TAG } from '../constants.js';
import { parseHeadingLevel } from '../utils/heading-level.js';
import { BaseSvelteMountElement } from './BaseSvelteMountElement.js';

// The section contracts this element's events carry, named where the runtime
// uses them so host-facing facades can re-export the exact types.
export type { QtiSectionDisplaySettingsEvent, QtiSectionFrameworkError };

export type QtiSectionResponseDeltaDetail = {
	sectionIdentifier: string;
	itemIdentifier: string;
	responseIdentifier: string;
	value: unknown;
};

/** The item pane element the layout rendered, for a host's skip links. */
export interface QtiSectionItemPaneReadyDetail {
	element: HTMLElement;
}

export interface QtiSectionPlayerEventMap {
	'qti-section-response-delta': CustomEvent<QtiSectionResponseDeltaDetail>;
	'qti-section-framework-error': CustomEvent<QtiSectionFrameworkError>;
	'qti-section-display-settings': CustomEvent<QtiSectionDisplaySettingsEvent>;
	'qti-section-item-pane-ready': CustomEvent<QtiSectionItemPaneReadyDetail>;
}

type SectionPlayerElementProps = {
	composition: ResolvedQtiSectionComposition;
	security?: PlayerSecurityConfig;
	pci?: PciConfiguration;
	i18n?: I18nProvider;
	typeset?: (root: HTMLElement) => void | Promise<void>;
	headingLevel?: number;
	displaySettings?: boolean;
	onResponseChange: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
	onItemPaneReady?: (element: HTMLElement) => void;
	onFrameworkError?: (error: QtiSectionFrameworkError) => void;
	onDisplaySettingsChange?: (event: QtiSectionDisplaySettingsEvent) => void;
};

/**
 * What a composition is missing before the layouts can render it. The types
 * require these fields, but a hand-built composition assigned to the element
 * arrives untyped and would otherwise throw a TypeError from inside the Svelte
 * render — a blank element with no diagnostic.
 */
function compositionProblemOf(composition: ResolvedQtiSectionComposition): string | null {
	if (!composition || typeof composition !== 'object') return 'The composition is missing.';
	if (!composition.section?.identifier) return 'The composition has no section with an identifier.';
	if (!composition.activeItem?.identifier || typeof composition.activeItem.itemXml !== 'string') {
		return 'The composition has no active item with an identifier and item XML.';
	}
	if (!composition.snapshot?.responses || typeof composition.snapshot.responses !== 'object') {
		return 'The composition has no response snapshot.';
	}
	const sharedContext = composition.sharedContext;
	if (!sharedContext || typeof sharedContext !== 'object') return 'The composition has no shared context.';
	for (const field of ['passages', 'rubricBlocks', 'testFeedback'] as const) {
		if (!Array.isArray(sharedContext[field])) return `The composition's shared context has no ${field} array.`;
	}
	return null;
}

export abstract class QtiSectionPlayerElementBase extends BaseSvelteMountElement<SectionPlayerElementProps> {
	static get observedAttributes() {
		return ['heading-level', 'display-settings'];
	}

	#composition: ResolvedQtiSectionComposition | null = null;
	#security: PlayerSecurityConfig | undefined;
	#pci: PciConfiguration | undefined;
	#i18n: I18nProvider | undefined;
	#typeset: ((root: HTMLElement) => void | Promise<void>) | undefined;
	#headingLevel: number | undefined;
	#displaySettings: boolean | undefined;
	#lastCompositionProblem: string | null = null;

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (name === 'heading-level') {
			this.#headingLevel = parseHeadingLevel(newValue);
		} else if (name === 'display-settings') {
			this.#displaySettings = parseDisplaySettings(newValue);
		} else {
			return;
		}
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

	/**
	 * Whether the candidate gets the display settings tool. Default true.
	 * `display-settings="false"` turns it off; the attribute reflects the property.
	 */
	get displaySettings(): boolean {
		return this.#displaySettings ?? true;
	}

	set displaySettings(value: boolean) {
		if (value) this.removeAttribute('display-settings');
		else this.setAttribute('display-settings', 'false');
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

	/**
	 * Move focus to the active item, first selecting the question tab when the
	 * panes are stacked. Shells use this for skip links and after navigation.
	 */
	async focusActiveItem(options?: FocusOptions): Promise<boolean> {
		const instance = this._instance as { focusActiveItem?: (options?: FocusOptions) => Promise<boolean> } | null;
		if (!instance?.focusActiveItem) return false;
		return instance.focusActiveItem(options);
	}

	protected override _mountOrUpdate() {
		const composition = this.#composition;
		if (!composition) {
			return;
		}
		const problem = compositionProblemOf(composition);
		if (problem) {
			// An unrenderable composition degrades to a diagnostic instead of an
			// uncaught TypeError from inside the Svelte render; a good composition
			// (or none) clears the report so a new problem is announced again.
			if (problem !== this.#lastCompositionProblem) {
				this.#lastCompositionProblem = problem;
				this.#dispatchSectionEvent('qti-section-framework-error', {
					...(composition.section?.identifier ? { sectionIdentifier: composition.section.identifier } : {}),
					code: 'invalid-composition',
					message: problem,
				});
			}
			return;
		}
		this.#lastCompositionProblem = null;
		super._mountOrUpdate();
	}

	#dispatchSectionEvent<K extends keyof QtiSectionPlayerEventMap>(
		type: K,
		detail: QtiSectionPlayerEventMap[K] extends CustomEvent<infer TDetail> ? TDetail : never,
	) {
		this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
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
			...(this.#displaySettings === undefined ? {} : { displaySettings: this.#displaySettings }),
			onResponseChange: (itemIdentifier, responseIdentifier, value) => {
				const detail: QtiSectionResponseDeltaDetail = {
					sectionIdentifier: composition.section.identifier,
					itemIdentifier,
					responseIdentifier,
					value,
				};
				this.#dispatchSectionEvent('qti-section-response-delta', detail);
			},
			onItemPaneReady: (element) => {
				this.#dispatchSectionEvent('qti-section-item-pane-ready', { element });
			},
			onFrameworkError: (error) => {
				this.#dispatchSectionEvent('qti-section-framework-error', error);
			},
			onDisplaySettingsChange: (event) => {
				this.#dispatchSectionEvent('qti-section-display-settings', event);
			},
		};
	}
}

/**
 * The `display-settings` attribute: `false` (or `off`/`0`) turns the candidate's
 * display settings tool off; anything else, or no attribute, leaves it on.
 */
function parseDisplaySettings(value: string | null): boolean | undefined {
	if (value === null) return undefined;
	return !['false', 'off', '0'].includes(value.trim().toLowerCase());
}

export class QtiSectionPlayerSplitPaneElement extends QtiSectionPlayerElementBase {
	protected Component: any = SectionPlayerSplitPane;
}

export function defineQtiSectionPlayerSplitPaneElement() {
	if (!customElements.get(QTI_SECTION_PLAYER_SPLITPANE_TAG)) {
		customElements.define(QTI_SECTION_PLAYER_SPLITPANE_TAG, QtiSectionPlayerSplitPaneElement);
	}
}
