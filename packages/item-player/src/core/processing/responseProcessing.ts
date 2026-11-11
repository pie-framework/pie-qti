/**
 * Response, template and outcome processing execution: the evaluator environment,
 * the compiled program runs, the standard response-processing templates, the variable
 * resets a new template instance starts from, and the scoring result assembly.
 */
import {
	type DeclarationMap,
	DeclarationContext,
	evalExpr,
	execProgram,
	isNullValue,
	type ProcessingProgram,
	type QtiValue,
	qtiNull,
	qtiValue,
	toBoolean,
	toNumber,
} from '@pie-qti/qti-processing';
import type { AssessmentItemDocument, ResponseProcessingDescriptor } from '../../document/AssessmentItemDocument.js';
import {
	resolveResponseProcessingTemplate,
	UnsupportedResponseProcessingTemplateError,
} from '../responseProcessingTemplates.js';
import type { CompletionStatus, ItemSessionEngineConfig, ModalFeedback, ScoringResult } from '../../types/index.js';
import { cloneValue } from '../../utils/cloneFreeze.js';

/** What response processing execution reads from the session engine. */
export interface ResponseProcessingHost {
	readonly itemDocument: AssessmentItemDocument;
	readonly config: ItemSessionEngineConfig;
	readonly decls: DeclarationMap;
	/** The declarations as compiled from the item source, before any template rule changed them. */
	readonly sourceDeclarations: DeclarationMap;
	readonly ctx: DeclarationContext;
	readonly rng: () => number;
	readonly responseProcessing: ResponseProcessingDescriptor;
	readonly responseProcessingProgram: ProcessingProgram | null;
	readonly templateProcessingProgram: ProcessingProgram | null;
	readonly outcomeProcessingProgram: ProcessingProgram | null;
	/**
	 * End-attempt responses the candidate turned true since the attempt last ended; a response
	 * reset to its default also deactivates (see resetResponsesToDefault).
	 */
	readonly endAttemptActivations: Set<string>;
	/** Set once the implied-zero MAXSCORE warning has fired. */
	warnedImpliedZeroMaxScore: boolean;
	isAdaptive(): boolean;
	getNumAttempts(): number;
	getContentLanguage(): string | undefined;
	updateDuration(): void;
	restorePciResponse(responseIdentifier: string, value: unknown): void;
	qtiValueToPci(value: QtiValue | undefined): unknown;
	qtiValueToPublic(value: QtiValue | undefined): any;
	getModalFeedback(outcomes: Record<string, any>): ModalFeedback[];
}

/**
 * The evaluator's environment, which reads responses in the item's content language and
 * compares strings with the host's string comparison folds.
 */
export function processingEnv(host: ResponseProcessingHost) {
	return {
		ctx: host.ctx,
		rng: host.rng,
		language: host.getContentLanguage(),
		stringComparison: host.config.stringComparison,
		customOperators: host.config.customOperators,
	};
}

export function execTemplateProcessingProgram(host: ResponseProcessingHost): void {
	if (!host.templateProcessingProgram) return;
	execProgram(
		processingEnv(host),
		host.templateProcessingProgram
	);
}

export function execResponseProcessingProgram(host: ResponseProcessingHost): void {
	if (!host.responseProcessingProgram) return;
	execProgram(
		processingEnv(host),
		host.responseProcessingProgram
	);
}

export function execOutcomeProcessingProgram(host: ResponseProcessingHost): void {
	if (!host.outcomeProcessingProgram) return;
	execProgram(
		processingEnv(host),
		host.outcomeProcessingProgram
	);
}

export function execResponseProcessingTemplate(host: ResponseProcessingHost, templateUrl: string): void {
	const name = resolveResponseProcessingTemplate(templateUrl);
	// Compilation rejects unsupported templates; this guards a hand-built prepared definition.
	if (!name) throw unsupportedTemplateError(host, templateUrl);

	const responseMatchesCorrect = (): boolean => {
		const expression = {
			kind: 'expr.match',
			id: 'fixed-template-match',
			a: { kind: 'expr.variable', id: 'fixed-template-response', identifier: 'RESPONSE' },
			b: { kind: 'expr.correct', id: 'fixed-template-correct', identifier: 'RESPONSE' },
		} as any;
		return toBoolean(
			evalExpr(
				processingEnv(host),
				expression,
			),
		);
	};

	const setScore = (value: number): void => {
		host.ctx.setValue('SCORE', qtiValue('float', 'single', value));
	};

	const setIdentifierOutcome = (identifier: string, value: string): void => {
		host.ctx.setValue(identifier, qtiValue('identifier', 'single', value));
	};

	const mapResponse = (point: boolean): number => {
		const response = host.ctx.getValue('RESPONSE');
		// The official templates guard with isNull, which reads an empty container or empty string
		// as NULL too (QTI ASI §5): a cleared response scores 0, rather than being mapped, whose
		// result the mapping's bounds could clamp away from 0.
		if (isNullValue(response)) return 0;
		const mapped = evalExpr(
			processingEnv(host),
			{
				kind: point ? 'expr.mapResponsePoint' : 'expr.mapResponse',
				id: point ? 'fixed-template-map-response-point' : 'fixed-template-map-response',
				identifier: 'RESPONSE',
			} as any,
		);
		const value = toNumber(mapped);
		return Number.isFinite(value) ? value : 0;
	};

	switch (name) {
		case 'match_correct':
		case 'cc2_match': {
			setScore(responseMatchesCorrect() ? 1 : 0);
			return;
		}
		case 'cc2_match_basic': {
			if (responseMatchesCorrect()) {
				const maxScore = toNumber(host.ctx.getValue('MAXSCORE'));
				host.ctx.setValue(
					'SCORE',
					Number.isFinite(maxScore) ? qtiValue('float', 'single', maxScore) : qtiNull('float', 'single'),
				);
				setIdentifierOutcome('FEEDBACKBASIC', 'correct');
			} else {
				setIdentifierOutcome('FEEDBACKBASIC', 'incorrect');
			}
			return;
		}
		case 'match_nothing':
		case 'cc2_match_nothing': { // Official IMS QTI 3.0 rptemplate
			const isEmptyResponse = (v: QtiValue | undefined): boolean => {
				if (!v) return true;
				if (v.kind === 'null') return true;
				if (v.kind === 'invalid') return false;
				if (v.value === null || v.value === undefined) return true;
				if (Array.isArray(v.value)) return v.value.length === 0;
				if (typeof v.value === 'string') return v.value.trim().length === 0;
				return false;
			};

			const allEmpty = isEmptyResponse(host.ctx.getValue('RESPONSE'));
			const max = toNumber(host.ctx.getValue('MAXSCORE'));
			host.ctx.setValue('SCORE', qtiValue('float', 'single', allEmpty ? (Number.isFinite(max) ? max : 1) : 0));
			return;
		}
		case 'map_response': {
			setScore(mapResponse(false));
			return;
		}
		case 'cc2_map_response': {
			const score = mapResponse(false);
			setScore(score);
			const maxScore = toNumber(host.ctx.getValue('MAXSCORE'));
			setIdentifierOutcome(
				'FEEDBACK',
				Number.isFinite(maxScore) && score === maxScore ? 'correct' : 'incorrect',
			);
			return;
		}
		case 'map_response_point':
		case 'cc2_map_response_point': { // Official IMS QTI 3.0 rptemplate
			setScore(mapResponse(true));
			return;
		}
		case 'no_response_processing': {
			// The standard empty template: outcomes keep their defaults (unscored item).
			return;
		}
	}
}

/**
 * A template reference is the item's only scoring rule when responseProcessing has no rules of
 * its own. Without a built-in program for that template the item would score its defaults
 * silently, so compilation fails instead (docs/SPEC-GAPS-PLAN.md G-19).
 */
export function assertSupportedResponseProcessing(host: ResponseProcessingHost): void {
	const { present, hasStatements, template } = host.responseProcessing;
	if (!present || hasStatements || !template) return;
	if (resolveResponseProcessingTemplate(template)) return;
	throw unsupportedTemplateError(host, template);
}

export function unsupportedTemplateError(host: ResponseProcessingHost, templateUri: string): UnsupportedResponseProcessingTemplateError {
	return new UnsupportedResponseProcessingTemplateError(
		templateUri,
		host.itemDocument.getAssessmentItemAttribute('identifier') ?? undefined,
	);
}

export function resetOutcomesToDefault(host: ResponseProcessingHost): void {
	for (const d of Object.values(host.decls)) {
		if ((d as any).__kind !== 'outcome') continue;
		// Built-in stateful variables must survive across processing runs.
		// They are updated by the runtime (adaptive attempt tracking), not by outcome defaults.
		if (d.identifier === 'numAttempts' || d.identifier === 'completionStatus' || d.identifier === 'duration') continue;
		host.ctx.resetToDefault(d.identifier);
	}
}

export function resetResponsesToDefault(host: ResponseProcessingHost): void {
	host.endAttemptActivations.clear();
	for (const d of Object.values(host.decls)) {
		if ((d as any).__kind !== 'response') continue;
		host.ctx.resetToDefault(d.identifier);
		host.restorePciResponse(d.identifier, host.qtiValueToPci(d.value));
	}
}

export function resetTemplatesToDefault(host: ResponseProcessingHost): void {
	for (const d of Object.values(host.decls)) {
		if (!d.isTemplate) continue;
		host.ctx.resetToDefault(d.identifier);
	}
}

/**
 * QTI ASI §10.3 with §5.1: template processing runs on a fresh instance of the item, so a new
 * template instance starts from the declarations, not from the instance before it. The
 * template rules setDefaultValue and setCorrectResponse change response and outcome
 * declarations for one instance; their declared defaults and correct responses come back
 * here, before the variables reset and template processing runs again. Template variables
 * keep their defaults: template rules do not change them, and they hold the
 * assessmentItemRef's templateDefault values (applied at session start, carried by a
 * snapshot), which apply to every instance.
 */
export function restoreDeclaredTemplateRuleTargets(host: ResponseProcessingHost): void {
	for (const d of Object.values(host.decls)) {
		const kind = (d as any).__kind as 'response' | 'outcome' | 'template' | 'context' | undefined;
		if (kind !== 'response' && kind !== 'outcome') continue;
		const declared = host.sourceDeclarations[d.identifier];
		if (!declared) continue;
		const fields = d as { defaultValue?: QtiValue; correctResponse?: QtiValue };
		if (declared.defaultValue) fields.defaultValue = cloneValue(declared.defaultValue);
		else delete fields.defaultValue;
		if (kind !== 'response') continue;
		if (declared.correctResponse) fields.correctResponse = cloneValue(declared.correctResponse);
		else delete fields.correctResponse;
	}
}

export function runResponseProcessing(
	host: ResponseProcessingHost,
	options: {
		finalizeNonAdaptiveAttempt: boolean;
		countAttempt?: boolean;
	},
): ScoringResult {
	host.updateDuration();
	// QTI ASI §5.1: numAttempts starts at 0 and is incremented at the start of each attempt,
	// so the response processing that ends a counted attempt reads that attempt's own
	// number (1 on the first). The adaptive path counts in runAdaptiveSubmitAttempt; an
	// uncounted attempt (countAttempt=false) and a scoring pass (scoreAttempt) do not count.
	const countsAttempt = options.finalizeNonAdaptiveAttempt && (options.countAttempt ?? true);
	if (!host.isAdaptive() && countsAttempt) {
		host.ctx.setValue('numAttempts', qtiValue('integer', 'single', host.getNumAttempts() + 1));
	}
	// QTI ASI §5.2: for a non-adaptive item, outcome variables are reset to their defaults
	// before each invocation of response processing. An adaptive item's outcomes "retain the
	// values that were assigned to them during the previous invocation" (§5.2, §8), so they
	// carry across attempts — and across a save/restore, which restores them as saved. They
	// start from their defaults only at session start and on newTemplate.
	if (!host.isAdaptive()) {
		resetOutcomesToDefault(host);
	}

	// Execute response processing if present
	if (host.responseProcessing.present) {
		// If responseProcessing has explicit statements, run the compiled program.
		// Otherwise, fall back to template-based processing (responseProcessing@template).
		if (host.responseProcessing.hasStatements) {
			execResponseProcessingProgram(host);
		} else if (host.responseProcessing.template) {
			execResponseProcessingTemplate(host, host.responseProcessing.template);
		}
	}

	// Execute outcome processing if present (runs after responseProcessing)
	execOutcomeProcessingProgram(host);

	// Compatibility: processResponses() has historically finalized non-adaptive items.
	// New scoreAttempt() uses this same engine with finalization disabled.
	if (!host.isAdaptive() && options.finalizeNonAdaptiveAttempt) {
		host.ctx.setValue('completionStatus', qtiValue('identifier', 'single', 'completed'));
	}

	const outcomes = collectOutcomes(host);

	warnOnceOnImpliedZeroMaxScore(host, outcomes);

	const score = Number(outcomes.SCORE ?? 0);
	const maxScore = Number(outcomes.MAXSCORE ?? 1);
	const completionStatus = (outcomes.completionStatus as CompletionStatus | undefined) ?? 'not_attempted';
	const completed = completionStatus === 'completed' || (!host.isAdaptive() && options.finalizeNonAdaptiveAttempt);

	return {
		score,
		maxScore,
		completed,
		outcomeValues: outcomes,
		correct: responsesMatchCorrect(host),
		modalFeedback: host.getModalFeedback(outcomes),
	};
}

/**
 * QTI item correctness, as test-level `numberCorrect` reads it: every declared response matches
 * its correct response. Undefined when the item has no response or one declares no correct
 * response.
 */
export function responsesMatchCorrect(host: ResponseProcessingHost): boolean | undefined {
	const responses = Object.values(host.decls).filter((d) => (d as any).__kind === 'response');
	if (responses.length === 0 || responses.some((d) => d.correctResponse?.kind !== 'value')) return undefined;
	const env = processingEnv(host);
	return responses.every((d) =>
		toBoolean(
			evalExpr(env, {
				kind: 'expr.match',
				id: `correct-${d.identifier}`,
				a: { kind: 'expr.variable', id: `correct-${d.identifier}-response`, identifier: d.identifier },
				b: { kind: 'expr.correct', id: `correct-${d.identifier}-correct`, identifier: d.identifier },
			} as any),
		),
	);
}

/**
 * A MAXSCORE declared without a <defaultValue> is 0 per the numeric outcome rule, so an item
 * that never assigns it scores against a maximum of zero. That is the spec-correct reading of
 * under-specified content, and silently substituting 1 would make this engine disagree with a
 * conformant one — so surface the authoring gap instead of masking it.
 */
function warnOnceOnImpliedZeroMaxScore(host: ResponseProcessingHost, outcomes: Record<string, unknown>): void {
	if (host.warnedImpliedZeroMaxScore) return;
	if (!host.decls.MAXSCORE?.impliedNumericDefault) return;
	if (outcomes.MAXSCORE !== 0) return;
	host.warnedImpliedZeroMaxScore = true;
	console.warn(
		`[QTI Player] MAXSCORE is 0 for item "${host.itemDocument.getAssessmentItemAttribute('identifier') ?? 'unknown'}": its outcomeDeclaration ` +
			'has no <defaultValue>, so QTI initializes it to 0 and response processing never assigned it. ' +
			'Declare <defaultValue> on the MAXSCORE outcomeDeclaration to score against a real maximum.',
	);
}

export function collectOutcomes(host: ResponseProcessingHost): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const d of Object.values(host.decls)) {
		if ((d as any).__kind !== 'outcome') continue;
		if (d.value.kind === 'value') out[d.identifier] = host.qtiValueToPublic(d.value);
		else if (d.value.kind === 'null') out[d.identifier] = null;
	}
	// Ensure MAXSCORE always has a value (fallback to 1.0 if null or missing)
	if (out.MAXSCORE === null || out.MAXSCORE === undefined) {
		out.MAXSCORE = 1.0;
	}
	return out;
}
