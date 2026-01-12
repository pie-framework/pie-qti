import {
	type AreaMapEntry,
	type AreaMapping,
	type BaseType,
	buildOutcomeProcessingAst,
	buildResponseProcessingAst,
	buildTemplateProcessingAst,
	type Cardinality,
	childElements,
	coerceBaseValue,
	DeclarationContext,
	type DeclarationMap,
	evalExpr,
	execProgram,
	findAssessmentItem,
	findDescendants,
	findFirstDescendant,
	getAttr,
	OperatorRegistry,
	type ProcessingProgram,
	parseXml,
	type QtiValue,
	qtiNull,
	qtiValue,
	serializeXml,
	toBoolean,
	toNumber,
	toStringValue,
} from '@pie-qti/qti-processing';
import { parse } from 'node-html-parser';
import type { ExtractionRegistry } from '../extraction/ExtractionRegistry.js';
import { createExtractionRegistry } from '../extraction/ExtractionRegistry.js';
import { ALL_STANDARD_EXTRACTORS, createExtractionContext } from '../extraction/index.js';
import type { VariableDeclaration as ExtractionVariableDeclaration } from '../extraction/types.js';
import type {
	AdaptiveAttemptResult,
	CompletionStatus,
	HtmlContent,
	ModalFeedback,
	PlayerConfig,
	PlayerSecurityConfig,
	QTIRole,
	RubricBlock,
	ScoringResult,
	SessionState,
} from '../types/index.js';
import type { InteractionData, QTIElement } from '../types/interactions.js';
import type { ResponseValidationResult } from '../types/responseValidation.js';
import type { ComponentRegistry } from './ComponentRegistry.js';
import { createComponentRegistry } from './ComponentRegistry.js';
import { enforceItemXmlLimits } from './parsingLimits.js';
import { createSeededRng } from './random.js';
import { sanitizeHtml } from './sanitizer.js';
import { toTrustedHtml } from './trustedTypes.js';
import { sanitizeResourceUrl } from './urlPolicy.js';

type DeclKind = 'response' | 'outcome' | 'template';

export class Player {
	private role: QTIRole;
	private config: PlayerConfig;
	private itemXml: string;
	private doc: Document;
	private assessmentItem: Element;
	private decls: DeclarationMap;
	private ctx: DeclarationContext;
	private rng: () => number;
	private ops: OperatorRegistry;
	private extractionRegistry: ExtractionRegistry;
	private componentRegistry: ComponentRegistry;
	private i18nProvider: any; // I18nProvider from @pie-qti/qti2-i18n

	private responseProcessingProgram: ProcessingProgram | null = null;
	private templateProcessingProgram: ProcessingProgram | null = null;
	private outcomeProcessingProgram: ProcessingProgram | null = null;

	constructor(config: PlayerConfig) {
		this.config = config;
		this.itemXml = config.itemXml ?? '';
		this.role = config.role ?? 'candidate';
		this.rng = config.rng ?? (typeof config.seed === 'number' ? createSeededRng(config.seed) : Math.random);

		// Optional DoS guardrails for untrusted content (compat-by-default; disabled unless enabled).
		enforceItemXmlLimits(this.itemXml, this.config.security);

		this.doc = parseXml(this.itemXml);
		this.assessmentItem = findAssessmentItem(this.doc);

		this.decls = this.buildDeclarations(this.assessmentItem);
		this.ensureBuiltinDeclarations(this.decls);
		this.ctx = new DeclarationContext(this.decls);
		this.ops = new OperatorRegistry();

		// Restore session state (outcomes + responses) before running templateProcessing.
		if (config.sessionState) {
			this.applySessionState(config.sessionState);
		}

		// Extraction + rendering registries (for interaction rendering)
		this.extractionRegistry = (config.extractionRegistry as ExtractionRegistry | undefined) ?? createExtractionRegistry();
		this.componentRegistry = (config.componentRegistry as ComponentRegistry | undefined) ?? createComponentRegistry();

		// I18n provider (defaults to a simple fallback if not provided)
		this.i18nProvider = config.i18nProvider ?? this.createDefaultI18nProvider();

		// Register standard extractors (idempotent per-registry instance)
		for (const ex of ALL_STANDARD_EXTRACTORS) {
			try {
				this.extractionRegistry.register(ex as any);
			} catch {
				// ignore duplicates if a caller pre-registered
			}
		}

		// Plugins can further extend registries
		for (const p of (config.plugins ?? []) as any[]) {
			try {
				p?.registerExtractors?.(this.extractionRegistry);
				p?.registerComponents?.(this.componentRegistry);
			} catch {
				// plugin errors shouldn't prevent core parsing
			}
		}

		// Build ASTs once.
		const templateProcessing = findFirstDescendant(this.assessmentItem, 'templateProcessing');
		if (templateProcessing) {
			this.templateProcessingProgram = buildTemplateProcessingAst(templateProcessing);
			this.execTemplateProcessing();
		}

		const responseProcessing = findFirstDescendant(this.assessmentItem, 'responseProcessing');
		if (responseProcessing) {
			this.responseProcessingProgram = buildResponseProcessingAst(responseProcessing);
		}

		const outcomeProcessing = findFirstDescendant(this.assessmentItem, 'outcomeProcessing');
		if (outcomeProcessing) {
			this.outcomeProcessingProgram = buildOutcomeProcessingAst(outcomeProcessing);
		}

		// Apply initial responses after templateProcessing (so template vars are ready).
		if (config.responses) {
			this.setResponses(config.responses as Record<string, unknown>);
		}
	}

	/** Breaking-change API: returns the typed declaration map */
	public getDeclarations(): DeclarationMap {
		return this.decls;
	}

	public setResponses(responses: Record<string, unknown>): void {
		for (const [id, raw] of Object.entries(responses)) {
			const d = this.decls[id];
			if (!d) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw);
		}
	}

	public processResponses(): ScoringResult {
		// Spec-aligned behavior: each processing run starts from outcome defaults.
		// This prevents stale outcomes when response/outcome processing doesn't set every variable.
		this.resetOutcomesToDefault();

		// Execute response processing if present
		const rpEl = findFirstDescendant(this.assessmentItem, 'responseProcessing');
		if (rpEl) {
			// If responseProcessing has explicit statements, run the compiled program.
			// Otherwise, fall back to template-based processing (responseProcessing@template).
			const hasStatements = childElements(rpEl).length > 0;
			if (hasStatements) {
				this.execResponseProcessingProgram();
			} else {
				const templateUrl = getAttr(rpEl, 'template');
				if (templateUrl) this.execResponseProcessingTemplate(templateUrl);
			}
		}

		// Execute outcome processing if present (runs after responseProcessing)
		this.execOutcomeProcessingProgram();

		const outcomes = this.collectOutcomes();
		const score = Number(outcomes.SCORE ?? 0);
		const maxScore = Number(outcomes.MAXSCORE ?? 1);
		const completionStatus = (outcomes.completionStatus as CompletionStatus | undefined) ?? 'not_attempted';
		const completed = completionStatus === 'completed' || !this.isAdaptive();

		return {
			score,
			maxScore,
			completed,
			outcomeValues: outcomes,
			modalFeedback: this.getModalFeedback(outcomes),
		};
	}

	public getSecurityConfig(): PlayerSecurityConfig | undefined {
		return this.config.security;
	}

	public getTrustedTypesPolicyName(): string | undefined {
		return this.config.security?.trustedTypesPolicyName;
	}

	/**
	 * Get the i18n provider instance
	 * @returns I18nProvider instance
	 */
	public getI18nProvider(): any {
		return this.i18nProvider;
	}

	/**
	 * Create a simple fallback i18n provider when none is provided
	 * This avoids a hard dependency on @pie-qti/qti2-i18n
	 */
	private createDefaultI18nProvider(): any {
		return {
			getLocale: () => 'en-US',
			setLocale: () => {},
			t: (key: string) => key, // Fallback to key
			plural: (key: string) => key,
			formatNumber: (value: number) => value.toString(),
			formatDate: (date: Date) => date.toISOString(),
		};
	}

	private resetOutcomesToDefault(): void {
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'outcome') continue;
			// Built-in stateful variables must survive across processing runs.
			// They are updated by the runtime (adaptive attempt tracking), not by outcome defaults.
			if (d.identifier === 'numAttempts' || d.identifier === 'completionStatus') continue;
			this.ctx.resetToDefault(d.identifier);
		}
	}

	public getItemBodyHtml(): HtmlContent {
		const itemBody = findFirstDescendant(this.assessmentItem, 'itemBody');
		if (!itemBody) return '';

		// Serialize children rather than the container tag itself.
		const inner = childElements(itemBody).map((c) => serializeXml(c)).join('');
		const printed = this.renderPrintedVariables(inner);
		const sanitized = sanitizeHtml(printed, { security: this.config.security });
		return toTrustedHtml(sanitized, this.config.security?.trustedTypesPolicyName);
	}

	/**
	 * Extract rubric blocks for the current role.
	 *
	 * QTI uses `<rubricBlock view="...">` to provide role-specific guidance.
	 * We return sanitized HTML for direct rendering.
	 */
	public getRubrics(): RubricBlock[] {
		const role = this.config.role;
		const rubricEls = findDescendants(this.assessmentItem, 'rubricBlock');
		if (rubricEls.length === 0) return [];

		const blocks: RubricBlock[] = [];
		for (const el of rubricEls) {
			const viewRaw = (getAttr(el, 'view') || '').trim();
			const view = viewRaw ? viewRaw.split(/\s+/).filter(Boolean) : [];

			// If view is specified, show only when it includes the current role.
			if (view.length > 0 && role && !view.includes(role)) continue;

			// Serialize children rather than the container tag itself.
			const contentRaw = childElements(el).map((c) => serializeXml(c)).join('') || (el.textContent || '');
			const printed = this.renderPrintedVariables(contentRaw);
			const sanitized = sanitizeHtml(printed, { security: this.config.security });
			const html = toTrustedHtml(sanitized, this.config.security?.trustedTypesPolicyName);

			blocks.push({ view, html });
		}

		return blocks;
	}

	public getComponentRegistry(): ComponentRegistry {
		return this.componentRegistry;
	}

	public getExtractionRegistry(): ExtractionRegistry {
		return this.extractionRegistry;
	}

	/**
	 * Canonical interaction API (new): extracted, typed interaction data.
	 */
	public getInteractionData(): InteractionData[] {
		const itemBody = findFirstDescendant(this.assessmentItem, 'itemBody');
		if (!itemBody) return [];

		// Parse the original item XML with node-html-parser (extractors depend on its HTMLElement API).
		// Important: using the original XML avoids namespace/serialization artifacts from XMLSerializer.
		enforceItemXmlLimits(this.itemXml, this.config.security);
		const docRoot = parse(this.itemXml, { lowerCaseTagName: false, comment: false }) as any as QTIElement;
		// node-html-parser's CSS selectors match lowercase tag names.
		const parsedItemBody = (docRoot.querySelector?.('itembody') as any as QTIElement | null) ?? null;
		const root = parsedItemBody ?? docRoot;

		const declMap = new Map<string, ExtractionVariableDeclaration>();
		for (const d of Object.values(this.decls)) {
			declMap.set(d.identifier, {
				identifier: d.identifier,
				cardinality: d.cardinality as any,
				baseType: d.baseType,
			});
		}

		// Discover all elements that match any standard extractor elementType
		const tagSet = new Set<string>();
		for (const ex of ALL_STANDARD_EXTRACTORS) {
			for (const t of ex.elementTypes ?? []) tagSet.add(t.toLowerCase());
		}

		const elements: QTIElement[] = [];
		for (const tag of tagSet) {
			try {
				elements.push(...(root.querySelectorAll(tag) as any));
			} catch {
				// ignore selector errors
			}
		}

		const interactions: InteractionData[] = [];
		for (const el of elements) {
			const responseId = el.getAttribute?.('responseIdentifier') || el.getAttribute?.('responseidentifier') || '';
			if (!responseId) continue;

			const ctx = createExtractionContext(el, responseId, root, declMap, this.config);
			const res = this.extractionRegistry.extract<any>(el, ctx);
			if (!res.success) continue;

			interactions.push({
				type: el.rawTagName as any,
				responseId,
				...res.data,
			});
		}

		// Apply URL policy + embed allowances to standard extracted URL fields.
		const policy = this.config.security?.urlPolicy;
		const allowObjectEmbeds = this.config.security?.allowObjectEmbeds === true;
		const ttPolicyName = this.config.security?.trustedTypesPolicyName;

		for (const i of interactions as any[]) {
			// Wrap known HTML injection fields in TrustedHTML (when enabled).
			// Important: do NOT wrap fields that are rendered as plain text in our Svelte components
			// (e.g. prompt) to avoid "[object Object]" rendering.
			if (i.type === 'choiceInteraction' && Array.isArray(i.choices)) {
				for (const c of i.choices) {
					if (typeof c?.text === 'string') c.text = toTrustedHtml(c.text, ttPolicyName);
				}
			}

			// Shared ImageData shape
			if (i.imageData?.src) {
				i.imageData.src = sanitizeResourceUrl(i.imageData.src, policy, 'img') ?? '';
			}
			if (i.imageData?.content && typeof i.imageData.content === 'string') {
				i.imageData.content = toTrustedHtml(i.imageData.content, ttPolicyName);
			}

			// positionObject stages
			if (Array.isArray(i.positionObjectStages)) {
				for (const st of i.positionObjectStages) {
					if (st?.objectData?.src) {
						st.objectData.src = sanitizeResourceUrl(st.objectData.src, policy, 'img') ?? '';
					}
					if (st?.objectData?.content && typeof st.objectData.content === 'string') {
						st.objectData.content = toTrustedHtml(st.objectData.content, ttPolicyName);
					}
				}
			}

			// mediaInteraction
			if (i.type === 'mediaInteraction' && i.mediaElement?.src) {
				const kind = i.mediaElement.type === 'object' ? 'object' : 'media';
				i.mediaElement.src = sanitizeResourceUrl(i.mediaElement.src, policy, kind) ?? '';
				i.allowObjectEmbeds = allowObjectEmbeds;
			}

			// hottextInteraction content is injected via {@html}
			if (i.type === 'hottextInteraction' && typeof i.contentHtml === 'string') {
				i.contentHtml = toTrustedHtml(i.contentHtml, ttPolicyName);
			}
		}

		return interactions;
	}

	/**
	 * Convenience API (used by tests/bench): returns a minimal interaction list with QTI-ish field names.
	 */
	public getInteractions(): Array<{ type: string; responseIdentifier: string } & Record<string, any>> {
		return this.getInteractionData().map((i: any) => ({
			...i,
			responseIdentifier: i.responseId,
		}));
	}

	public getResponseInteractions(): Array<{ type: string; responseIdentifier: string } & Record<string, any>> {
		return this.getInteractions().filter((i) => i.type !== 'endAttemptInteraction');
	}

	public getResponseIdentifiers(): string[] {
		return this.getResponseInteractions().map((i) => i.responseIdentifier);
	}

	public isAdaptive(): boolean {
		return (getAttr(this.assessmentItem, 'adaptive') || '').toLowerCase() === 'true';
	}

	public getNumAttempts(): number {
		return Math.max(0, Math.floor(toNumber(this.ctx.getValue('numAttempts')) || 0));
	}

	public getCompletionStatus(): CompletionStatus {
		const s = (toStringValue(this.ctx.getValue('completionStatus')) || '').trim() as CompletionStatus;
		return (s || 'not_attempted') as CompletionStatus;
	}

	public isCompleted(): boolean {
		return this.getCompletionStatus() === 'completed';
	}

	public submitAttempt(countAttempt: boolean = true): AdaptiveAttemptResult {
		if (this.isCompleted()) {
			throw new Error('Cannot submit: item is already completed');
		}

		// QTI adaptive semantics: numAttempts should reflect the attempt being processed.
		if (this.isAdaptive() && countAttempt) {
			const next = this.getNumAttempts() + 1;
			this.ctx.setValue('numAttempts', qtiValue('integer', 'single', next));
			// Promote completionStatus from not_attempted -> unknown on first submission unless RP sets it.
			if (this.getCompletionStatus() === 'not_attempted') {
				this.ctx.setValue('completionStatus', qtiValue('identifier', 'single', 'unknown'));
			}
		}

		const base = this.processResponses();
		const completionStatus = this.getCompletionStatus();
		const completed = completionStatus === 'completed';
		const canContinue = this.isAdaptive() ? !completed : false;

		return {
			...base,
			completed,
			numAttempts: this.getNumAttempts(),
			completionStatus,
			canContinue,
		};
	}

	public getResponses(): Record<string, any> {
		const out: Record<string, any> = {};
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'response') continue;
			out[d.identifier] = d.value.kind === 'value' ? d.value.value : null;
		}
		return out;
	}

	public getTemplateVariables(): Record<string, any> {
		const out: Record<string, any> = {};
		for (const d of Object.values(this.decls)) {
			if (!d.isTemplate) continue;
			out[d.identifier] = d.value.kind === 'value' ? d.value.value : null;
		}
		return out;
	}

	public setTemplateVariables(vars: Record<string, any>): void {
		for (const [id, raw] of Object.entries(vars)) {
			const d = this.decls[id];
			if (!d?.isTemplate) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw);
		}
	}

	public getSessionState(): SessionState {
		const out: SessionState = {};
		for (const d of Object.values(this.decls)) {
			out[d.identifier] = d.value.kind === 'value' ? d.value.value : null;
		}
		return out;
	}

	public validateResponses(responses: Record<string, any>): ResponseValidationResult {
		const interactions = this.getInteractions();
		const entries: ResponseValidationResult['entries'] = {};
		const issues: ResponseValidationResult['issues'] = [];

		for (const i of interactions) {
			const responseId = i.responseIdentifier;
			const decl = this.decls[responseId];
			const value = responses[responseId];

			const required =
				i.type !== 'endAttemptInteraction' &&
				(i.type !== 'mediaInteraction' || (typeof i.minPlays === 'number' && i.minPlays > 0));

			let complete = !required;
			if (i.type === 'mediaInteraction' && required) {
				const minPlays = Number(i.minPlays || 0);
				complete = Number(value || 0) >= minPlays;
			} else if (required) {
				if (Array.isArray(value)) complete = value.length > 0;
				else complete = value !== null && value !== undefined && value !== '';
			}

			const errors: string[] = [];
			const warnings: string[] = [];

			if (decl) {
				if (decl.cardinality === 'multiple' || decl.cardinality === 'ordered') {
					if (!(value === null || value === undefined || Array.isArray(value))) {
						errors.push(`Expected an array for ${decl.cardinality} response '${responseId}'`);
					}
				} else {
					if (Array.isArray(value)) {
						errors.push(`Expected a single value for response '${responseId}'`);
					}
				}
			}

			const valid = errors.length === 0;
			entries[responseId] = {
				responseId,
				interactionType: i.type,
				required,
				complete,
				valid,
				errors,
				warnings,
			};

			for (const e of errors) {
				issues.push({
					responseId,
					code: 'invalid_shape',
					message: e,
					severity: 'error',
				});
			}
		}

		const allValid = Object.values(entries).every((e) => e.valid);
		return { valid: allValid, entries, issues };
	}

	public getProgress(responses: Record<string, any>): { total: number; answered: number; unanswered: number } {
		const v = this.validateResponses(responses);
		const required = Object.values(v.entries).filter((e) => e.required);
		const answered = required.filter((e) => e.complete).length;
		const total = required.length;
		return { total, answered, unanswered: Math.max(0, total - answered) };
	}

	public canSubmitResponses(responses: Record<string, any>): boolean {
		const v = this.validateResponses(responses);
		const required = Object.values(v.entries).filter((e) => e.required);
		return v.valid && required.every((e) => e.complete);
	}

	/**
	 * True if the learner has made any meaningful interaction, even if submission is not yet allowed.
	 * Used by assessment/session controllers to track "answered" state.
	 */
	public isAttempted(responses: Record<string, any>): boolean {
		for (const i of this.getResponseInteractions()) {
			const id = i.responseIdentifier;
			const v = responses[id];
			if (i.type === 'mediaInteraction') {
				if (Number(v || 0) > 0) return true;
				continue;
			}
			if (Array.isArray(v)) {
				if (v.length > 0) return true;
				continue;
			}
			if (v !== null && v !== undefined && v !== '') return true;
		}
		return false;
	}

	// ----------------------------------------------------------------------------
	// Execution
	// ----------------------------------------------------------------------------

	private execTemplateProcessing(): void {
		if (!this.templateProcessingProgram) return;
		execProgram(
			{
				ctx: this.ctx,
				ops: this.ops,
				rng: this.rng,
				customOperators: this.config.customOperators,
			},
			this.templateProcessingProgram
		);
	}

	private execResponseProcessingProgram(): void {
		if (!this.responseProcessingProgram) return;
		execProgram(
			{
				ctx: this.ctx,
				ops: this.ops,
				rng: this.rng,
				customOperators: this.config.customOperators,
			},
			this.responseProcessingProgram
		);
	}

	private execOutcomeProcessingProgram(): void {
		if (!this.outcomeProcessingProgram) return;
		execProgram(
			{
				ctx: this.ctx,
				ops: this.ops,
				rng: this.rng,
				customOperators: this.config.customOperators,
			},
			this.outcomeProcessingProgram
		);
	}

	private execResponseProcessingTemplate(templateUrl: string): void {
		const name = templateUrl.split('/').pop()?.toLowerCase();
		if (!name) return;

		const responseDeclIds = Object.values(this.decls)
			.filter((d) => (d as any).__kind === 'response')
			.map((d) => d.identifier);

		switch (name) {
			case 'match_correct': {
				const allCorrect = responseDeclIds.every((id) => {
					const expr = { kind: 'expr.match', id: 'tmp', a: { kind: 'expr.variable', id: 'tmp', identifier: id }, b: { kind: 'expr.correct', id: 'tmp', identifier: id } } as any;
					// Use evaluator match semantics by evaluating a constructed MatchExpr
					return toBoolean(
						evalExpr(
							{ ctx: this.ctx, ops: this.ops, rng: this.rng, customOperators: this.config.customOperators },
							expr
						)
					);
				});

				const max = toNumber(this.ctx.getValue('MAXSCORE'));
				this.ctx.setValue('SCORE', qtiValue('float', 'single', allCorrect ? (Number.isFinite(max) ? max : 1) : 0));
				return;
			}
			case 'match_nothing': {
				const isEmptyResponse = (v: QtiValue | undefined): boolean => {
					if (!v) return true;
					if (v.kind === 'null') return true;
					if (v.kind === 'invalid') return false;
					if (v.value === null || v.value === undefined) return true;
					if (Array.isArray(v.value)) return v.value.length === 0;
					if (typeof v.value === 'string') return v.value.trim().length === 0;
					return false;
				};

				const allEmpty = responseDeclIds.every((id) => isEmptyResponse(this.ctx.getValue(id)));
				const max = toNumber(this.ctx.getValue('MAXSCORE'));
				this.ctx.setValue('SCORE', qtiValue('float', 'single', allEmpty ? (Number.isFinite(max) ? max : 1) : 0));
				return;
			}
			case 'map_response': {
				let total = 0;
				for (const id of responseDeclIds) {
					const d = this.decls[id];
					if (!d.mapping) continue;
					const v = evalExpr(
						{ ctx: this.ctx, ops: this.ops, rng: this.rng },
						{ kind: 'expr.mapResponse', id: 'tmp', identifier: id } as any
					);
					total += toNumber(v) || 0;
				}
				this.ctx.setValue('SCORE', qtiValue('float', 'single', total));
				return;
			}
			case 'map_response_point': {
				let total = 0;
				for (const id of responseDeclIds) {
					const d = this.decls[id];
					if (!d.areaMapping) continue;
					const v = evalExpr(
						{ ctx: this.ctx, ops: this.ops, rng: this.rng },
						{ kind: 'expr.mapResponsePoint', id: 'tmp', identifier: id } as any
					);
					total += toNumber(v) || 0;
				}
				this.ctx.setValue('SCORE', qtiValue('float', 'single', total));
				return;
			}
			default:
				return;
		}
	}

	// ----------------------------------------------------------------------------
	// Declarations
	// ----------------------------------------------------------------------------

	private buildDeclarations(root: Element): DeclarationMap {
		const decls: DeclarationMap = {};

		const addDecl = (kind: DeclKind, el: Element) => {
			const identifier = getAttr(el, 'identifier');
			const cardinality = (getAttr(el, 'cardinality') || 'single') as Cardinality;
			const baseType = (getAttr(el, 'baseType') || 'string') as BaseType;
			if (!identifier) return;

			const defaultValue = this.parseDefaultValue(el, baseType, cardinality);
			decls[identifier] = {
				identifier,
				baseType,
				cardinality,
				defaultValue,
				value: defaultValue,
				isTemplate: kind === 'template',
				// @ts-expect-error internal marker for templates
				__kind: kind,
			};

			// Response + outcome declarations may define mappings used by mapResponse/mapOutcome.
			// (Templates do not participate in mapping.)
			if (kind === 'response' || kind === 'outcome') {
				const mappingEl = findFirstDescendant(el, 'mapping');
				if (mappingEl) {
					decls[identifier].mapping = this.parseMapping(mappingEl, baseType);
				}
			}

			// Outcome declarations may define a lookup table (matchTable or interpolationTable)
			// used by the lookupOutcomeValue rule.
			if (kind === 'outcome') {
				const matchTableEl = findFirstDescendant(el, 'matchTable');
				const interpolationTableEl = findFirstDescendant(el, 'interpolationTable');
				if (matchTableEl) {
					decls[identifier].lookupTable = this.parseMatchTable(matchTableEl);
				} else if (interpolationTableEl) {
					decls[identifier].lookupTable = this.parseInterpolationTable(interpolationTableEl);
				}
			}

			if (kind === 'response') {
				const correctEl = findFirstDescendant(el, 'correctResponse');
				if (correctEl) {
					decls[identifier].correctResponse = this.parseCorrectResponse(correctEl, baseType, cardinality);
				}
				const areaMappingEl = findFirstDescendant(el, 'areaMapping');
				if (areaMappingEl) {
					decls[identifier].areaMapping = this.parseAreaMapping(areaMappingEl);
				}
			}
		};

		for (const el of findDescendants(root, 'responseDeclaration')) addDecl('response', el);
		for (const el of findDescendants(root, 'outcomeDeclaration')) addDecl('outcome', el);
		for (const el of findDescendants(root, 'templateDeclaration')) addDecl('template', el);

		return decls;
	}

	private parseMatchTable(el: Element) {
		const defaultValueRaw = (getAttr(el, 'defaultValue') || '').trim();
		const defaultValue = defaultValueRaw ? Number(defaultValueRaw) : undefined;
		return {
			kind: 'table.matchTable' as const,
			defaultValue: Number.isFinite(defaultValue as any) ? defaultValue : undefined,
			entries: findDescendants(el, 'matchTableEntry').map((e) => ({
				sourceValue: (getAttr(e, 'sourceValue') || '').trim(),
				targetValue: (getAttr(e, 'targetValue') || '').trim(),
			})),
		};
	}

	private parseInterpolationTable(el: Element) {
		const defaultValueRaw = (getAttr(el, 'defaultValue') || '').trim();
		const defaultValue = defaultValueRaw ? Number(defaultValueRaw) : undefined;
		const interpolationMethod = (getAttr(el, 'interpolationMethod') || 'linear').trim();
		return {
			kind: 'table.interpolationTable' as const,
			defaultValue: Number.isFinite(defaultValue as any) ? defaultValue : undefined,
			interpolationMethod,
			entries: findDescendants(el, 'interpolationTableEntry')
				.map((e) => ({
					sourceValue: Number((getAttr(e, 'sourceValue') || '').trim()),
					targetValue: Number((getAttr(e, 'targetValue') || '').trim()),
				}))
				.filter((e) => Number.isFinite(e.sourceValue) && Number.isFinite(e.targetValue)),
		};
	}

	private ensureBuiltinDeclarations(decls: DeclarationMap): void {
		// completionStatus + numAttempts are defined in QTI (esp. adaptive items) and commonly used
		// without explicit outcomeDeclaration in authoring content.
		if (!decls.completionStatus) {
			decls.completionStatus = {
				identifier: 'completionStatus',
				baseType: 'identifier',
				cardinality: 'single',
				value: qtiValue('identifier', 'single', 'not_attempted'),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}

		if (!decls.numAttempts) {
			decls.numAttempts = {
				identifier: 'numAttempts',
				baseType: 'integer',
				cardinality: 'single',
				value: qtiValue('integer', 'single', 0),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}

		// Common scoring defaults
		if (!decls.SCORE) {
			decls.SCORE = {
				identifier: 'SCORE',
				baseType: 'float',
				cardinality: 'single',
				value: qtiValue('float', 'single', 0),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}
		if (!decls.MAXSCORE) {
			decls.MAXSCORE = {
				identifier: 'MAXSCORE',
				baseType: 'float',
				cardinality: 'single',
				value: qtiValue('float', 'single', 1),
				isTemplate: false,
				// @ts-expect-error internal marker
				__kind: 'outcome',
			};
		}
	}

	private applySessionState(state: SessionState): void {
		for (const [id, raw] of Object.entries(state)) {
			const d = this.decls[id];
			if (!d) continue;
			d.value = this.coerceToDeclarationValue(d.baseType, d.cardinality, raw);
		}
	}

	private parseDefaultValue(declEl: Element, baseType: BaseType, cardinality: Cardinality): QtiValue {
		const defaultEl = findFirstDescendant(declEl, 'defaultValue');
		if (!defaultEl) return qtiNull(baseType, cardinality);
		const values = findDescendants(defaultEl, 'value').map((v) => (v.textContent || '').trim());
		if (cardinality === 'multiple' || cardinality === 'ordered') {
			return qtiValue(
				baseType,
				cardinality,
				values.map((t) => {
					const v = coerceBaseValue(baseType, t);
					return v.kind === 'value' ? v.value : null;
				})
			);
		}
		return coerceBaseValue(baseType, values[0] ?? '');
	}

	private parseCorrectResponse(correctEl: Element, baseType: BaseType, cardinality: Cardinality): QtiValue {
		const values = findDescendants(correctEl, 'value').map((v) => (v.textContent || '').trim());
		if (cardinality === 'multiple' || cardinality === 'ordered') {
			return qtiValue(
				baseType,
				cardinality,
				values.map((t) => {
					const v = coerceBaseValue(baseType, t);
					return v.kind === 'value' ? v.value : null;
				})
			);
		}
		return coerceBaseValue(baseType, values[0] ?? '');
	}

	private parseMapping(mappingEl: Element, baseType: BaseType) {
		const defaultValue = Number(getAttr(mappingEl, 'defaultValue') || 0);
		const lowerBound = getAttr(mappingEl, 'lowerBound') ? Number(getAttr(mappingEl, 'lowerBound')) : undefined;
		const upperBound = getAttr(mappingEl, 'upperBound') ? Number(getAttr(mappingEl, 'upperBound')) : undefined;
		const mappingCaseSensitive = getAttr(mappingEl, 'caseSensitive') || 'true';
		const entries: Record<string, any> = {};

		const normalizePairKey = (k: string): string => {
			const parts = k.trim().split(/\s+/).filter(Boolean);
			if (parts.length === 2) return [...parts].sort().join(' ');
			return k.trim();
		};

		const normalizeDirectedPairKey = (k: string): string => {
			const parts = k.trim().split(/\s+/).filter(Boolean);
			if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
			return k.trim();
		};

		for (const e of findDescendants(mappingEl, 'mapEntry')) {
			const mapKey = getAttr(e, 'mapKey');
			const mappedValue = getAttr(e, 'mappedValue');
			if (!mapKey || mappedValue === null) continue;
			const effectiveCaseSensitive = getAttr(e, 'caseSensitive') || mappingCaseSensitive || 'true';
			const storedKey =
				baseType === 'pair'
					? normalizePairKey(mapKey)
					: baseType === 'directedPair'
						? normalizeDirectedPairKey(mapKey)
						: mapKey;
			entries[storedKey] = { mapKey: storedKey, mappedValue: Number(mappedValue), caseSensitive: effectiveCaseSensitive };
			if (effectiveCaseSensitive !== 'true') {
				const lowerKey = storedKey.toLowerCase();
				entries[lowerKey] = {
					mapKey: lowerKey,
					mappedValue: Number(mappedValue),
					caseSensitive: effectiveCaseSensitive,
				};
			}
		}

		return { defaultValue, lowerBound, upperBound, caseSensitive: mappingCaseSensitive, entries };
	}

	private parseAreaMapping(areaMappingEl: Element): AreaMapping {
		const defaultValue = Number(getAttr(areaMappingEl, 'defaultValue') || 0);
		const lowerBound = getAttr(areaMappingEl, 'lowerBound')
			? Number(getAttr(areaMappingEl, 'lowerBound'))
			: undefined;
		const upperBound = getAttr(areaMappingEl, 'upperBound')
			? Number(getAttr(areaMappingEl, 'upperBound'))
			: undefined;

		const entries: AreaMapEntry[] = [];
		for (const e of findDescendants(areaMappingEl, 'areaMapEntry')) {
			const shape = (getAttr(e, 'shape') || 'default') as AreaMapEntry['shape'];
			const coords = String(getAttr(e, 'coords') || '');
			const mappedValue = Number(getAttr(e, 'mappedValue') || 0);
			entries.push({ shape, coords, mappedValue });
		}

		return { defaultValue, lowerBound, upperBound, entries };
	}

	private coerceToDeclarationValue(baseType: BaseType, cardinality: Cardinality, raw: unknown): QtiValue {
		if (raw === null || raw === undefined) return qtiNull(baseType, cardinality);

		// Allow callers to pass fully-formed QtiValue (e.g. session restore).
		if (typeof raw === 'object' && raw && 'kind' in raw) {
			return raw as QtiValue;
		}

		if (cardinality === 'multiple' || cardinality === 'ordered') {
			const arr = Array.isArray(raw) ? raw : [raw];
			const coerced = arr
				.map((v) => String(v ?? '').trim())
				.filter((s) => s.length > 0)
				.map((t) => {
					const v = coerceBaseValue(baseType, t);
					return v.kind === 'value' ? v.value : null;
				})
				.filter((v) => v !== null);
			// Multiple/ordered can legitimately be an empty container (distinct from null).
			return qtiValue(baseType, cardinality, coerced);
		}

		const t = String(raw ?? '').trim();
		if (t.length === 0) return qtiNull(baseType, cardinality);
		return coerceBaseValue(baseType, t);
	}

	private collectOutcomes(): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		for (const d of Object.values(this.decls)) {
			if ((d as any).__kind !== 'outcome') continue;
			if (d.value.kind === 'value') out[d.identifier] = d.value.value;
			else if (d.value.kind === 'null') out[d.identifier] = null;
		}
		return out;
	}

	// ----------------------------------------------------------------------------
	// printedVariable + feedback
	// ----------------------------------------------------------------------------

	private renderPrintedVariables(html: string): string {
		const readIdentifier = (attrs: string): string | null => {
			const m = attrs.match(/identifier\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
			return (m?.[1] || m?.[2] || m?.[3] || '').trim() || null;
		};

		const renderId = (id: string | null): string => {
			if (!id) return '';
			const v = this.ctx.getValue(id);
			if (v.kind !== 'value') return '';
			if (Array.isArray(v.value)) return v.value.map(String).join(', ');
			return String(v.value);
		};

		let out = html.replace(/<printedVariable\b([^>]*)>([\s\S]*?)<\/printedVariable>/gi, (_m, attrs) =>
			renderId(readIdentifier(String(attrs)))
		);
		out = out.replace(/<printedVariable\b([^>]*)\/>/gi, (_m, attrs) => renderId(readIdentifier(String(attrs))));
		return out;
	}

	private getModalFeedback(outcomes: Record<string, any>): ModalFeedback[] {
		const feedbackEls = findDescendants(this.assessmentItem, 'modalFeedback');
		const active: ModalFeedback[] = [];

		for (const el of feedbackEls) {
			const identifier = getAttr(el, 'identifier') || '';
			const outcomeIdentifier = getAttr(el, 'outcomeIdentifier') || '';
			const showHide = (getAttr(el, 'showHide') || 'show') as 'show' | 'hide';
			const title = getAttr(el, 'title') || undefined;

			const contentRaw = childElements(el).map((c) => serializeXml(c)).join('') || (el.textContent || '');
			const sanitized = sanitizeHtml(contentRaw, { security: this.config.security });
			const content = toTrustedHtml(sanitized, this.config.security?.trustedTypesPolicyName);

			const outcomeValue = outcomes[outcomeIdentifier];
			const shouldShow = showHide === 'show' ? outcomeValue === identifier : outcomeValue !== identifier;
			if (shouldShow && content) {
				active.push({ identifier, outcomeIdentifier, showHide, content, title });
			}
		}
		return active;
	}
}


