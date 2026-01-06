import type { AssessmentResults, BackendAdapter, BackendAssessmentPlayerConfig, InitSessionRequest, SecureAssessment } from '@pie-qti/qti2-assessment-player';
import { ReferenceBackendAdapter } from '@pie-qti/qti2-assessment-player';
import AssessmentShell from '@pie-qti/qti2-assessment-player/components/AssessmentShell.svelte';
import { QTI22_ASSESSMENT_PLAYER_TAG } from '../constants.js';
import { parseAssessmentTestXml } from '../qti/parseAssessmentTest.js';
import { type QtiItemMap, resolveItemsForAssessment } from '../qti/resolveItems.js';
import type { ParsedAssessmentSection, ParsedAssessmentTest } from '../qti/types.js';
import { safeJsonParse } from '../utils/json.js';
import { BaseSvelteMountElement } from './BaseSvelteMountElement.js';

export type Qti22AssessmentResponseChangeDetail = {
	responses: Record<string, unknown>;
};

export type Qti22AssessmentItemChangeDetail = {
	itemIndex: number;
	totalItems: number;
};

export type Qti22AssessmentSectionChangeDetail = {
	sectionIndex: number;
	totalSections: number;
};

export type Qti22AssessmentSubmitDetail = {
	results: AssessmentResults;
};

export class Qti22AssessmentPlayerElement extends BaseSvelteMountElement<Record<string, unknown>> {
	static get observedAttributes() {
		return [
			// Pure-QTI inputs
			'assessment-test-xml',
			'assessment-id',
			'candidate-id',
			'item-base-url',
			'items-json',
			// Common
			'config-json',
		];
	}

	protected Component = AssessmentShell;

	#assessmentTestXml: string | null = null;
	#assessmentId: string | undefined;
	#candidateId: string | undefined;
	#itemBaseUrl: string | undefined;
	#items: QtiItemMap | undefined;
	#config: Partial<BackendAssessmentPlayerConfig> = {};

	#backend: BackendAdapter = {
		async initSession(_request) {
			throw new Error('No assessment loaded. Provide `assessment-test-xml`.');
		},
		async submitResponses(_request) {
			return { success: false, error: 'No assessment loaded.' };
		},
		async finalizeAssessment(_request) {
			return { success: false, totalScore: 0, maxScore: 0, itemScores: {}, finalizedAt: Date.now() };
		},
		async saveState(_request) {
			return { success: false, savedAt: Date.now() };
		},
		async queryItemBank(_request) {
			return { items: [], selectedAt: Date.now() };
		},
	};
	#initSession: InitSessionRequest = { assessmentId: 'assessment', candidateId: 'candidate' };

	#loadSeq = 0;

	connectedCallback() {
		super.connectedCallback();
		queueMicrotask(() => {
			this.dispatchEvent(new CustomEvent('ready', { bubbles: true, composed: true }));
		});
	}

	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
		if (name === 'assessment-test-xml') {
			this.#assessmentTestXml = newValue;
		}

		if (name === 'assessment-id') {
			this.#assessmentId = newValue ?? undefined;
		}

		if (name === 'candidate-id') {
			this.#candidateId = newValue ?? undefined;
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

		void this.#syncFromQti();
		// Don't call _mountOrUpdate here - let #syncFromQti handle it when done
	}

	get config() {
		return this.#config;
	}
	set config(value: Partial<BackendAssessmentPlayerConfig>) {
		this.#config = value ?? {};
		this._mountOrUpdate();
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

	async #syncFromQti() {
		if (!this.#assessmentTestXml) return;

		const seq = ++this.#loadSeq;
		this.dispatchEvent(new CustomEvent('load-start', { bubbles: true, composed: true }));

		try {
			const parsed = parseAssessmentTestXml(this.#assessmentTestXml);
			await resolveItemsForAssessment({
				assessment: parsed,
				itemBaseUrl: this.#itemBaseUrl,
				items: this.#items,
			});

			if (seq !== this.#loadSeq) return; // superseded
			const assessmentId = this.#assessmentId ?? parsed.identifier ?? 'assessment';
			const candidateId = this.#candidateId ?? 'candidate';

			const secure = this.#toSecureAssessment(parsed, this.#config.role ?? 'candidate');
			const backend = new ReferenceBackendAdapter();
			backend.registerAssessment(assessmentId, secure);
			this.#backend = backend;
			this.#initSession = { assessmentId, candidateId };

			this.dispatchEvent(new CustomEvent('load-end', { bubbles: true, composed: true }));
			this._mountOrUpdate(); // Mount/update with resolved assessment
		} catch (e) {
			if (seq !== this.#loadSeq) return;
			// Keep current backend/initSession; component will display error.
			this.dispatchEvent(
				new CustomEvent('load-error', {
					detail: { message: e instanceof Error ? e.message : String(e) },
					bubbles: true,
					composed: true,
				}),
			);
			this._mountOrUpdate(); // Mount/update even on error (will show fallback)
		}
	}

	#toSecureAssessment(parsed: ParsedAssessmentTest, role: BackendAssessmentPlayerConfig['role']): SecureAssessment {
		const testParts = parsed.testParts ?? [];
		const first = testParts[0];

		if (!first) {
			return {
				identifier: parsed.identifier ?? 'assessment',
				title: parsed.title ?? 'Assessment',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				testParts: [],
			};
		}

		const flattenSections = (roots: ParsedAssessmentSection[]): ParsedAssessmentSection[] => {
			const out: ParsedAssessmentSection[] = [];
			const stack = [...roots].reverse();
			while (stack.length) {
				const s = stack.pop()!;
				out.push(s);
				if (s.sections && s.sections.length) {
					// depth-first, preserve original order
					for (const child of [...s.sections].reverse()) stack.push(child);
				}
			}
			return out;
		};

		const mapSection = (s: ParsedAssessmentSection) => {
			const items =
				s.questionRefs?.map((q) => {
					if (!q.itemXml) {
						throw new Error(`Missing itemXml for item "${q.identifier}" (provide items-json or item-base-url).`);
					}
					return {
						identifier: q.identifier,
						itemXml: q.itemXml,
						role: role ?? 'candidate',
						required: q.required,
					};
				}) ?? [];

			return {
				identifier: s.identifier,
				title: s.title,
				visible: s.visible ?? true,
				items,
				rubrics: s.rubricBlocks,
			};
		};

		return {
			identifier: parsed.identifier ?? 'assessment',
			title: parsed.title ?? 'Assessment',
			navigationMode: first.navigationMode ?? 'nonlinear',
			submissionMode: first.submissionMode ?? 'simultaneous',
			testParts: testParts.map((p) => ({
				identifier: p.identifier,
				sections: flattenSections(p.sections).map(mapSection),
			})),
		};
	}

	getProps() {
		// Ensure we never expose callback-style config as the public API.
		// Consumers should listen to DOM events instead.
		const baseConfig: Partial<BackendAssessmentPlayerConfig> = {
			...this.#config,
			onItemChange: (itemIndex: number, totalItems: number) => {
				const detail: Qti22AssessmentItemChangeDetail = { itemIndex, totalItems };
				this.dispatchEvent(
					new CustomEvent<Qti22AssessmentItemChangeDetail>('item-change', {
						detail,
						bubbles: true,
						composed: true,
					}),
				);
			},
			onSectionChange: (sectionIndex: number, totalSections: number) => {
				const detail: Qti22AssessmentSectionChangeDetail = { sectionIndex, totalSections };
				this.dispatchEvent(
					new CustomEvent<Qti22AssessmentSectionChangeDetail>('section-change', {
						detail,
						bubbles: true,
						composed: true,
					}),
				);
			},
			onResponseChange: (responses: Record<string, unknown>) => {
				const detail: Qti22AssessmentResponseChangeDetail = { responses: { ...responses } };
				this.dispatchEvent(
					new CustomEvent<Qti22AssessmentResponseChangeDetail>('response-change', {
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
				const detail: Qti22AssessmentSubmitDetail = { results };
				this.dispatchEvent(
					new CustomEvent<Qti22AssessmentSubmitDetail>('submit', {
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

export function defineQti22AssessmentPlayerElement() {
	if (!customElements.get(QTI22_ASSESSMENT_PLAYER_TAG)) {
		customElements.define(QTI22_ASSESSMENT_PLAYER_TAG, Qti22AssessmentPlayerElement);
	}
}


