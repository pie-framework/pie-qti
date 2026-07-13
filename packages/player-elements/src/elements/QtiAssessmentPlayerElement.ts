import type { AssessmentResults, BackendAdapter, BackendAssessmentPlayerConfig, InitSessionRequest } from '@pie-qti/assessment-player';
import { ReferenceBackendAdapter } from '@pie-qti/assessment-player';
import type { PciConfiguration, PlayerSecurityConfig } from '@pie-qti/item-player';
import { enforceItemXmlLimits } from '@pie-qti/item-player/security';
import AssessmentShell from '../../../assessment-player/src/components/AssessmentShell.svelte';
import { QTI_ASSESSMENT_PLAYER_TAG } from '../constants.js';
import { parseAssessmentTestXml } from '../qti/parseAssessmentTest.js';
import {
	createAssessmentResourceResolver,
	type QtiItemFetchPolicy,
	type QtiItemMap,
	resolveItemsForAssessment,
} from '../qti/resolveItems.js';
import type { ParsedAssessmentSection, ParsedAssessmentTest } from '../qti/types.js';
import { safeJsonParse } from '../utils/json.js';
import { BaseSvelteMountElement } from './BaseSvelteMountElement.js';

export type QtiAssessmentResponseChangeDetail = {
	responses: Record<string, unknown>;
};

export type QtiAssessmentItemChangeDetail = {
	itemIndex: number;
	totalItems: number;
};

export type QtiAssessmentSectionChangeDetail = {
	sectionIndex: number;
	totalSections: number;
};

export type QtiAssessmentSubmitDetail = {
	results: AssessmentResults;
};

export type QtiAssessmentLoadErrorDetail = {
	message: string;
};

export interface QtiAssessmentPlayerEventMap {
	ready: CustomEvent<void>;
	'load-start': CustomEvent<void>;
	'load-end': CustomEvent<void>;
	'load-error': CustomEvent<QtiAssessmentLoadErrorDetail>;
	'item-change': CustomEvent<QtiAssessmentItemChangeDetail>;
	'section-change': CustomEvent<QtiAssessmentSectionChangeDetail>;
	'response-change': CustomEvent<QtiAssessmentResponseChangeDetail>;
	submit: CustomEvent<QtiAssessmentSubmitDetail>;
	complete: CustomEvent<void>;
}

export class QtiAssessmentPlayerElement extends BaseSvelteMountElement<Record<string, unknown>> {
	static get observedAttributes() {
		return [
			// Pure-QTI inputs
			'assessment-test-xml',
			'reference-mode',
			'assessment-id',
			'candidate-id',
			'item-base-url',
			'items-json',
			// Common
			'config-json',
			'security-json',
		];
	}

	protected Component: any = AssessmentShell;

	#assessmentTestXml: string | null = null;
	#assessmentId: string | undefined;
	#candidateId: string | undefined;
	#itemBaseUrl: string | undefined;
	#items: QtiItemMap | undefined;
	#itemFetchPolicy: QtiItemFetchPolicy | undefined;
	#config: Partial<BackendAssessmentPlayerConfig> = {};
	#security: PlayerSecurityConfig | undefined;
	#pci: PciConfiguration | undefined;
	#referenceMode = false;
	#backend: BackendAdapter | undefined;
	#hostBackend: BackendAdapter | undefined;
	#initSession: InitSessionRequest | undefined;
	#initSessionSource: 'host' | 'local' | undefined;

	#loadSeq = 0;
	#allowMount = false;
	#resourceLoadController: AbortController | undefined;

	connectedCallback() {
		super.connectedCallback();
		queueMicrotask(() => {
			if (this.#hostBackend && !this.#initSession) {
				this.#dispatchLoadError(
					'Set `initSession`, or both `assessmentId` and `candidateId`, before using an injected assessment backend.',
				);
			}
			this.dispatchEvent(new CustomEvent('ready', { bubbles: true, composed: true }));
			void this.#syncFromQti();
		});
	}

	disconnectedCallback() {
		this.#loadSeq++;
		this.#resourceLoadController?.abort();
		this.#resourceLoadController = undefined;
		super.disconnectedCallback();
	}

	protected override _mountOrUpdate() {
		// Pure-QTI assessment elements need their XML resolved before the Svelte shell mounts.
		if (!this.#allowMount) {
			return;
		}
		super._mountOrUpdate();
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (name === 'assessment-test-xml') {
			this.#assessmentTestXml = newValue;
		}

		if (name === 'reference-mode') {
			this.#referenceMode = newValue !== null && newValue !== 'false';
		}

		if (name === 'assessment-id') {
			this.#assessmentId = newValue ?? undefined;
			this.#syncInitSessionFromIds();
		}

		if (name === 'candidate-id') {
			this.#candidateId = newValue ?? undefined;
			this.#syncInitSessionFromIds();
		}

		if (name === 'item-base-url') {
			this.#itemBaseUrl = newValue ?? undefined;
		}

		if (name === 'items-json') {
			const parsed = safeJsonParse<QtiItemMap>(newValue);
			if (parsed) this.#items = parsed;
		}

		if (name === 'config-json') {
			const parsed = safeJsonParse<Partial<BackendAssessmentPlayerConfig>>(newValue);
			if (parsed) this.#config = parsed;
		}

		if (name === 'security-json') {
			const parsed = safeJsonParse<PlayerSecurityConfig>(newValue);
			if (parsed) this.#security = parsed;
		}

		void this.#syncFromQti();
		// Don't call _mountOrUpdate here - let #syncFromQti handle it when done
	}

	get config() {
		return this.#config;
	}
	set config(value: Partial<BackendAssessmentPlayerConfig>) {
		this.#config = value ?? {};
		// Let #syncFromQti mount once the assessment backend is ready.
		if (this.#allowMount) {
			this._mountOrUpdate();
		}
	}

	get security() {
		return this.#security;
	}
	set security(value: PlayerSecurityConfig | undefined) {
		this.#security = value;
		// Let #syncFromQti mount once the assessment backend is ready.
		if (this.#allowMount) {
			this._mountOrUpdate();
		}
	}

	/**
	 * Portable Custom Interaction trust configuration. Set as a JavaScript property;
	 * the required resolver function cannot be represented safely as an attribute.
	 */
	get pci(): PciConfiguration | undefined {
		return this.#pci ?? this.#config.pci;
	}
	set pci(value: PciConfiguration | undefined) {
		this.#pci = value;
		if (this.#allowMount) {
			this._mountOrUpdate();
		}
	}

	/**
	 * Production backend boundary. The backend must return candidate-safe item XML
	 * and remain authoritative for scoring, timing, navigation, and persistence.
	 */
	get backend(): BackendAdapter | undefined {
		return this.#hostBackend;
	}
	set backend(value: BackendAdapter | undefined) {
		this.#loadSeq++;
		this.#resourceLoadController?.abort();
		this.#resourceLoadController = undefined;
		this.#allowMount = false;
		this._teardownInstance();
		// A session synthesized for the answer-bearing preview backend is not an
		// authorization decision for a subsequently injected production backend.
		if (this.#initSessionSource === 'local') {
			this.#initSession = undefined;
			this.#initSessionSource = undefined;
		}
		this.#hostBackend = value;
		this.#backend = value;
		if (!value) {
			void this.#syncFromQti();
			return;
		}
		this.#syncSecureBackendMount();
	}

	get initSession(): InitSessionRequest | undefined {
		return this.#initSession ? { ...this.#initSession } : undefined;
	}
	set initSession(value: InitSessionRequest | undefined) {
		this.#initSession = value ? { ...value } : undefined;
		this.#initSessionSource = value ? 'host' : undefined;
		this.#assessmentId = value?.assessmentId;
		this.#candidateId = value?.candidateId;
		this.#syncSecureBackendMount();
	}

	get assessmentId(): string | undefined {
		return this.#assessmentId;
	}
	set assessmentId(value: string | undefined) {
		this.#assessmentId = value;
		this.#syncInitSessionFromIds();
	}

	get candidateId(): string | undefined {
		return this.#candidateId;
	}
	set candidateId(value: string | undefined) {
		this.#candidateId = value;
		this.#syncInitSessionFromIds();
	}

	/**
	 * Explicitly enables the local ReferenceBackendAdapter. This mode exposes item
	 * XML and answer/scoring data to the browser and is only suitable for previews,
	 * demos, and trusted low-stakes content.
	 */
	get referenceMode(): boolean {
		return this.#referenceMode;
	}
	set referenceMode(value: boolean) {
		this.#referenceMode = value === true;
		if (this.#referenceMode) this.setAttribute('reference-mode', '');
		else this.removeAttribute('reference-mode');
		void this.#syncFromQti();
	}

	/**
	 * Pure-QTI API (preferred): supply an assessmentTest XML string and let the element
	 * resolve itemRefs via either an item map (A) or base URL fetching (B).
	 */
	get assessmentTestXml() {
		return this.#assessmentTestXml;
	}
	set assessmentTestXml(value: string | null) {
		this.#assessmentTestXml = value;
		void this.#syncFromQti();
		// Don't call _mountOrUpdate here - let #syncFromQti handle it when done
	}

	get itemBaseUrl() {
		return this.#itemBaseUrl;
	}
	set itemBaseUrl(value: string | undefined) {
		this.#itemBaseUrl = value;
		void this.#syncFromQti();
		// Don't call _mountOrUpdate here - let #syncFromQti handle it when done
	}

	get items() {
		return this.#items;
	}
	set items(value: QtiItemMap | undefined) {
		this.#items = value;
		void this.#syncFromQti();
		// Don't call _mountOrUpdate here - let #syncFromQti handle it when done
	}

	get itemFetchPolicy(): QtiItemFetchPolicy | undefined {
		return this.#itemFetchPolicy;
	}
	set itemFetchPolicy(value: QtiItemFetchPolicy | undefined) {
		this.#itemFetchPolicy = value ? { ...value } : undefined;
		void this.#syncFromQti();
	}

	/**
	 * Imperative API (proxied through `AssessmentShell` exports)
	 */
	async next() {
		return this._instance?.next?.();
	}
	async previous() {
		return this._instance?.previous?.();
	}
	async navigateTo(index: number) {
		return this._instance?.navigateTo?.(index);
	}
	async navigateToSection(sectionIdentifier: string) {
		return this._instance?.navigateToSection?.(sectionIdentifier);
	}
	async submit() {
		return this._instance?.submit?.();
	}
	getResponses() {
		return this._instance?.getResponses?.();
	}
	getState() {
		return this._instance?.getState?.();
	}
	restoreState(state: unknown) {
		return this._instance?.restoreState?.(state);
	}

	addEventListener<K extends keyof QtiAssessmentPlayerEventMap>(
		type: K,
		listener: (this: QtiAssessmentPlayerElement, event: QtiAssessmentPlayerEventMap[K]) => unknown,
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

	async #syncFromQti() {
		const seq = ++this.#loadSeq;
		this.#resourceLoadController?.abort();
		this.#resourceLoadController = undefined;
		if (this.#hostBackend) {
			this.#syncSecureBackendMount();
			return;
		}
		if (!this.#assessmentTestXml) {
			this.#deactivateLocalBackend();
			return;
		}
		if (!this.#referenceMode) {
			this.#deactivateLocalBackend();
			this.#dispatchLoadError(
				'Raw assessment XML uses the local answer-bearing backend. Set `referenceMode = true` for explicit preview/offline delivery, or inject `backend` and `initSession` for authoritative delivery.',
			);
			return;
		}

		// Revoke the previous local player before resolving a replacement. If the
		// replacement fails, stale answer-bearing content must not remain usable.
		this.#deactivateLocalBackend();

		const resourceLoadController = new AbortController();
		this.#resourceLoadController = resourceLoadController;
		this.dispatchEvent(new CustomEvent('load-start', { bubbles: true, composed: true }));

		try {
			const security = this.#effectiveSecurity();
			enforceItemXmlLimits(this.#assessmentTestXml, security);
			const configuredSectionDepth = security.parsingLimits?.enabled
				? security.parsingLimits.maxHtmlDepth
				: undefined;
			const parsed = parseAssessmentTestXml(
				this.#assessmentTestXml,
				configuredSectionDepth === undefined
					? undefined
					: { maxSectionDepth: configuredSectionDepth },
			);
			const resolverItems = this.#resourceItemsForParsedAssessment(parsed);
			const resourceResolver = createAssessmentResourceResolver({
				itemBaseUrl: this.#itemBaseUrl,
				items: resolverItems,
				security,
				fetchPolicy: this.#itemFetchPolicy,
				signal: resourceLoadController.signal,
			});
			await resolveItemsForAssessment({
				assessment: parsed,
				itemBaseUrl: this.#itemBaseUrl,
				items: resolverItems,
				security,
				fetchPolicy: this.#itemFetchPolicy,
				signal: resourceLoadController.signal,
				resourceResolver,
			});

			if (seq !== this.#loadSeq) return; // superseded
			const assessmentId = this.#assessmentId ?? parsed.identifier ?? 'assessment';
			const candidateId = this.#candidateId ?? 'candidate';

			const secure = await ReferenceBackendAdapter.parseAssessmentTestXml(this.#assessmentTestXml, {
				role: this.#config.role ?? 'candidate',
				itemXmlMap: this.#resolvedItemXmlMap(parsed),
				fileResolver: resourceResolver,
				...(configuredSectionDepth === undefined
					? {}
					: { sectionReferenceLimits: { maxDepth: configuredSectionDepth } }),
			});
			const backend = new ReferenceBackendAdapter();
			backend.registerAssessment(assessmentId, secure);
			this.#backend = backend;
			this.#initSession = { assessmentId, candidateId };
			this.#initSessionSource = 'local';

			this.dispatchEvent(new CustomEvent('load-end', { bubbles: true, composed: true }));

			// Allow mounting now that backend is ready
			this.#allowMount = true;
			this._mountOrUpdate();
		} catch (e) {
			if (seq !== this.#loadSeq || resourceLoadController.signal.aborted) return;
			this.#deactivateLocalBackend();
			this.#dispatchLoadError(e instanceof Error ? e.message : String(e));
		} finally {
			if (this.#resourceLoadController === resourceLoadController) {
				this.#resourceLoadController = undefined;
			}
		}
	}

	#effectiveSecurity(): PlayerSecurityConfig {
		return {
			...(this.#security ?? {}),
			parsingLimits: {
				enabled: true,
				...(this.#security?.parsingLimits ?? {}),
			},
		};
	}

	#dispatchLoadError(message: string): void {
		this.dispatchEvent(
			new CustomEvent<QtiAssessmentLoadErrorDetail>('load-error', {
				detail: { message },
				bubbles: true,
				composed: true,
			}),
		);
	}

	#syncInitSessionFromIds(): void {
		if (this.#assessmentId && this.#candidateId) {
			this.#initSession = {
				...(this.#initSession?.resumeSessionId
					? { resumeSessionId: this.#initSession.resumeSessionId }
					: {}),
				assessmentId: this.#assessmentId,
				candidateId: this.#candidateId,
			};
			this.#initSessionSource = 'host';
		} else if (this.#hostBackend) {
			this.#initSession = undefined;
			this.#initSessionSource = undefined;
		}
		this.#syncSecureBackendMount();
	}

	#syncSecureBackendMount(): void {
		if (!this.#hostBackend || !this.#initSession) {
			if (this.#hostBackend) {
				this.#allowMount = false;
				this._teardownInstance();
			}
			return;
		}
		this.#backend = this.#hostBackend;
		this.#allowMount = true;
		if (this.isConnected) this._mountOrUpdate();
	}

	#deactivateLocalBackend(): void {
		this.#allowMount = false;
		this._teardownInstance();
		if (!this.#hostBackend) {
			this.#backend = undefined;
			this.#initSession = undefined;
			this.#initSessionSource = undefined;
		}
	}

	#resourceItemsForParsedAssessment(parsed: ParsedAssessmentTest): QtiItemMap | undefined {
		if (!this.#items) return undefined;
		const map = { ...this.#items };
		const visit = (sections: ParsedAssessmentSection[]): void => {
			for (const section of sections) {
				for (const item of section.assessmentItemRefs ?? []) {
					if (item.href && map[item.href] === undefined && map[item.identifier] !== undefined) {
						map[item.href] = map[item.identifier]!;
					}
				}
				visit(section.sections ?? []);
			}
		};
		for (const part of parsed.testParts ?? []) visit(part.sections ?? []);
		return map;
	}

	#resolvedItemXmlMap(parsed: ParsedAssessmentTest): Record<string, string> {
		const map: Record<string, string> = {};
		const visit = (sections: ParsedAssessmentSection[]): void => {
			for (const section of sections) {
				for (const item of section.assessmentItemRefs ?? []) {
					if (!item.itemXml) {
						throw new Error(`Missing itemXml for item "${item.identifier}" (provide items or itemBaseUrl).`);
					}
					map[item.identifier] = item.itemXml;
					if (item.href) map[item.href] = item.itemXml;
				}
				visit(section.sections ?? []);
			}
		};
		for (const part of parsed.testParts ?? []) visit(part.sections ?? []);
		return map;
	}

	getProps() {
		if (!this.#backend || !this.#initSession) {
			throw new Error('Assessment backend and initSession must be configured before mounting.');
		}
		// Ensure we never expose callback-style config as the public API.
		// Consumers should listen to DOM events instead.
		const baseConfig: Partial<BackendAssessmentPlayerConfig> = {
			...this.#config,
			security: this.#effectiveSecurity(),
			pci: this.#pci ?? this.#config.pci,
			onItemChange: (itemIndex: number, totalItems: number) => {
				const detail: QtiAssessmentItemChangeDetail = { itemIndex, totalItems };
				this.dispatchEvent(
					new CustomEvent<QtiAssessmentItemChangeDetail>('item-change', {
						detail,
						bubbles: true,
						composed: true,
					}),
				);
			},
			onSectionChange: (sectionIndex: number, totalSections: number) => {
				const detail: QtiAssessmentSectionChangeDetail = { sectionIndex, totalSections };
				this.dispatchEvent(
					new CustomEvent<QtiAssessmentSectionChangeDetail>('section-change', {
						detail,
						bubbles: true,
						composed: true,
					}),
				);
			},
			onResponseChange: (responses: Record<string, unknown>) => {
				const detail: QtiAssessmentResponseChangeDetail = { responses: { ...responses } };
				this.dispatchEvent(
					new CustomEvent<QtiAssessmentResponseChangeDetail>('response-change', {
						detail,
						bubbles: true,
						composed: true,
					}),
				);
			},
			onComplete: () => {
				this.dispatchEvent(new CustomEvent('complete', { bubbles: true, composed: true }));
			},
		};

		const props: any = {
			backend: this.#backend,
			initSession: this.#initSession,
			config: baseConfig,
			onSubmit: (results: AssessmentResults) => {
				const detail: QtiAssessmentSubmitDetail = { results };
				this.dispatchEvent(
					new CustomEvent<QtiAssessmentSubmitDetail>('submit', {
						detail,
						bubbles: true,
						composed: true,
					}),
				);
			},
		};
		// Don't pass typeset at all if not provided (passing undefined can cause issues)
		return props;
	}
}

export function defineQtiAssessmentPlayerElement() {
	if (!customElements.get(QTI_ASSESSMENT_PLAYER_TAG)) {
		customElements.define(QTI_ASSESSMENT_PLAYER_TAG, QtiAssessmentPlayerElement);
	}
}
