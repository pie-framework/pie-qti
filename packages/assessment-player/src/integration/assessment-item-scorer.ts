import {
	createAssessmentItemDefinition,
	type SerializedItemSessionState,
	type SerializedItemSessionVariable,
} from '@pie-qti/item-player';
import { parseXml, type QtiValue, qtiNull, qtiValue, type StringComparisonOptions, type TestItemState } from '@pie-qti/qti-processing';
import { hasAnyResponse } from '../core/AssessmentSessionCoordinator.js';
import { isAdaptiveItemXml } from '../core/testStructure.js';
import type { AssessmentScoringResult, ResponseValue } from './api-contract.js';

export interface AssessmentItemScoringInput {
	itemXml: string;
	responses: Record<string, ResponseValue>;
	/**
	 * The candidate's serialized item session for this submission. Required for a templated
	 * item (template processing drew the instance the candidate saw) and for an adaptive item
	 * (its outcomes accumulate across attempts): the scorer restores it instead of
	 * re-templating, and takes an adaptive item's outcomes as submitted.
	 */
	itemSession?: SerializedItemSessionState;
	/**
	 * Force the item-session requirement on (an assessmentItemRef `templateDefault` sets
	 * template values the item XML alone does not show).
	 */
	requireItemSession?: boolean;
	/**
	 * String comparison folds beyond QTI's equality, as the delivery's input needs them; see the
	 * item player's `AssessmentItemDefinitionConfig.stringComparison`. Exact when absent.
	 */
	stringComparison?: StringComparisonOptions;
}

/** Why the reference scorer refused to score a submission. */
export type AssessmentItemScoringErrorCode = 'itemSessionRequired';

/**
 * A submission the scorer must not score: a templated or adaptive item without the
 * candidate's item session (scoring its responses alone would re-run template processing
 * against a different instance, or lose an adaptive item's accumulated outcomes).
 */
export class AssessmentItemScoringError extends Error {
	readonly code: AssessmentItemScoringErrorCode;
	readonly itemIdentifier: string;

	constructor(code: AssessmentItemScoringErrorCode, itemIdentifier: string, message: string) {
		super(message);
		this.name = 'AssessmentItemScoringError';
		this.code = code;
		this.itemIdentifier = itemIdentifier;
	}
}

const TEMPLATE_PROCESSING = /<(?:[\w-]+:)?(?:templateProcessing|qti-template-processing)\b/;

/**
 * Whether scoring the item needs the candidate's item session: template processing draws
 * a per-session instance (the key the candidate saw), and an adaptive item's outcomes
 * accumulate across its attempts.
 */
export function itemScoringRequiresSession(itemXml: string): boolean {
	return isAdaptiveItemXml(itemXml) || TEMPLATE_PROCESSING.test(itemXml);
}

export function getAssessmentItemIdentifier(itemXml: string): string {
	const identifierMatch = itemXml.match(/<(?:assessmentItem|qti-assessment-item)\b[^>]*\sidentifier=["']([^"']+)["']/);
	return identifierMatch?.[1] || 'unknown';
}

/** The item-derived part of a test-level TestItemState; the backend adds the item-ref context. */
export type ItemTestState = Pick<TestItemState, 'variables' | 'outcomeBounds' | 'responded' | 'correct'>;

/**
 * Runs QTI ResponseProcessing for one AssessmentItem and normalizes the result
 * to the BackendAdapter scoring shape used by AssessmentPlayer. Throws an
 * `AssessmentItemScoringError` (`itemSessionRequired`) for a templated or adaptive item
 * that arrives without the candidate's item session.
 */
export function scoreAssessmentItem(input: AssessmentItemScoringInput): AssessmentScoringResult {
	return scoreAssessmentItemForTest(input).result;
}

/**
 * Scores one item and snapshots the variables and flags test-level outcome processing reads.
 *
 * With the candidate's item session the scorer restores it — the template instance the
 * candidate saw, never a fresh draw — and re-runs response processing on it; an adaptive
 * item's outcomes are taken as submitted (they accumulate across attempts, so running
 * response processing again would apply the attempt twice or reset what earlier attempts
 * accumulated). Without a session only a non-templated, non-adaptive item is scored.
 *
 * When response processing fails the item scores 0 out of 1, and its test state holds no
 * variables: the item still counts as presented, and as responded when the candidate gave
 * any response.
 */
export function scoreAssessmentItemForTest({
	itemXml,
	responses,
	itemSession,
	requireItemSession,
	stringComparison,
}: AssessmentItemScoringInput): { result: AssessmentScoringResult; testState: ItemTestState } {
	const itemIdentifier = getAssessmentItemIdentifier(itemXml);
	if (!itemSession && (requireItemSession === true || itemScoringRequiresSession(itemXml))) {
		throw new AssessmentItemScoringError(
			'itemSessionRequired',
			itemIdentifier,
			`Item "${itemIdentifier}" is templated or adaptive: score it from the candidate's item session, not from its responses alone.`,
		);
	}

	try {
		// Use a scorer-grade view of the item for accurate scoring.
		// NOTE: This reference scorer is intentionally insecure and runs client-side.
		// In production, scoring must happen server-side with secured item content.
		const definition = createAssessmentItemDefinition({
			itemXml,
			role: 'scorer',
			...(stringComparison ? { stringComparison } : {}),
		});
		// A restored session keeps its template and context values: template processing
		// does not run again for a restore.
		const session = definition.openSession(
			itemSession ? { restore: itemSession } : { responses },
		);
		let result: ScoringOutcome;
		let testState: ItemTestState;
		try {
			const adaptive = session.state().adaptive;
			if (itemSession && adaptive) {
				const submitted = session.serialize();
				// Correctness (QTI numberCorrect) only: this pass's outcomes are discarded.
				const correct = session.dispatch({ action: 'scoreAttempt' }).result?.scoring?.correct;
				result = scoringFromSubmittedOutcomes(submitted, correct);
				testState = snapshotTestState(itemXml, submitted, correct);
			} else {
				const scoring = session.dispatch(
					itemSession
						? { action: 'scoreAttempt' }
						: { action: 'endAttempt', countAttempt: false, validateResponses: false },
				).result?.scoring;
				if (!scoring) throw new Error('QTI scoring produced no result');
				testState = snapshotTestState(itemXml, session.serialize(), scoring.correct);
				// The scorer keeps its throwaway session uncounted (countAttempt:false), which since the
				// QTI countAttempt semantics no longer finalizes a non-adaptive item. A scored submission
				// of a non-adaptive item is still the end of its attempt; only adaptive items report
				// completion from their own completionStatus.
				result = { ...scoring, completed: adaptive ? scoring.completed : true };
			}
		} finally {
			session.dispose();
		}

		return {
			result: {
				itemIdentifier,
				score: result.score,
				maxScore: result.maxScore,
				completed: result.completed,
				outcomeValues: result.outcomeValues,
			},
			testState,
		};
	} catch (error) {
		console.error('Scoring error:', error);
		return {
			result: {
				itemIdentifier,
				score: 0,
				maxScore: 1,
				completed: false,
				outcomeValues: {},
			},
			testState: { variables: {}, responded: hasAnyResponse(responses) },
		};
	}
}

type ScoringOutcome = {
	score: number;
	maxScore: number;
	completed: boolean;
	outcomeValues: Record<string, unknown>;
	correct?: boolean;
};

/** An adaptive item's scoring as its submitted session holds it (no response processing re-run). */
function scoringFromSubmittedOutcomes(state: SerializedItemSessionState, correct: boolean | undefined): ScoringOutcome {
	const outcomeValues: Record<string, unknown> = {};
	for (const variable of Object.values(state.outcomeVariables)) {
		outcomeValues[variable.identifier] = publicValue(variable);
	}
	outcomeValues.completionStatus = state.completionStatus;
	outcomeValues.numAttempts = state.numAttempts;
	if (outcomeValues.MAXSCORE === null || outcomeValues.MAXSCORE === undefined) outcomeValues.MAXSCORE = 1;
	const score = Number(outcomeValues.SCORE ?? 0);
	const maxScore = Number(outcomeValues.MAXSCORE);
	return {
		score: Number.isFinite(score) ? score : 0,
		maxScore: Number.isFinite(maxScore) ? maxScore : 1,
		completed: state.completionStatus === 'completed',
		outcomeValues,
		correct,
	};
}

function publicValue({ cardinality, value }: Pick<SerializedItemSessionVariable, 'cardinality' | 'value'>): unknown {
	if (value === null || value === undefined) return null;
	if (cardinality !== 'record' || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, { value?: unknown }>).map(([field, entry]) => [field, entry?.value ?? null]),
	);
}

const defaultTestStates = new Map<string, ItemTestState | undefined>();

/** Variables of an item nobody has attempted: declared defaults, with no response processing run. */
export function defaultItemTestState(itemXml: string): ItemTestState | undefined {
	if (!defaultTestStates.has(itemXml)) {
		let state: ItemTestState | undefined;
		try {
			const session = createAssessmentItemDefinition({ itemXml, role: 'scorer' }).openSession({ responses: {} });
			try {
				state = { ...snapshotTestState(itemXml, session.serialize(), undefined), responded: false };
			} finally {
				session.dispose();
			}
		} catch {
			state = undefined;
		}
		defaultTestStates.set(itemXml, state);
	}
	return defaultTestStates.get(itemXml);
}

function snapshotTestState(
	itemXml: string,
	serialized: SerializedItemSessionState,
	correct: boolean | undefined,
): ItemTestState {
	const responses = Object.values(serialized.responseVariables);
	const variables: Record<string, QtiValue> = {};
	for (const group of [
		serialized.contextVariables,
		serialized.templateVariables,
		serialized.outcomeVariables,
		serialized.responseVariables,
	]) {
		for (const variable of Object.values(group)) variables[variable.identifier] = toQtiValue(variable);
	}
	return {
		variables,
		outcomeBounds: readOutcomeBounds(itemXml),
		responded: responses.some((r) => JSON.stringify(r.value ?? null) !== JSON.stringify(r.defaultValue ?? null)),
		correct,
	};
}

function toQtiValue({ baseType, cardinality, value }: Pick<SerializedItemSessionVariable, 'baseType' | 'cardinality' | 'value'>): QtiValue {
	if (value === null || value === undefined) return qtiNull(baseType as any, cardinality as any);
	if (cardinality !== 'record') return qtiValue(baseType as any, cardinality as any, value);
	const fields: Record<string, QtiValue> = {};
	for (const [id, field] of Object.entries(value as Record<string, any>)) fields[id] = toQtiValue(field);
	return qtiValue(undefined, 'record', fields);
}

/** Declared normalMinimum/normalMaximum per outcome, in either QTI 2 or QTI 3 spelling. */
function readOutcomeBounds(itemXml: string): ItemTestState['outcomeBounds'] {
	const bounds: NonNullable<ItemTestState['outcomeBounds']> = {};
	const visit = (el: Element): void => {
		const name = el.localName ?? el.nodeName;
		if (name === 'outcomeDeclaration' || name === 'qti-outcome-declaration') {
			const identifier = el.getAttribute('identifier');
			const min = Number.parseFloat(el.getAttribute('normalMinimum') || el.getAttribute('normal-minimum') || '');
			const max = Number.parseFloat(el.getAttribute('normalMaximum') || el.getAttribute('normal-maximum') || '');
			if (identifier && (Number.isFinite(min) || Number.isFinite(max))) {
				bounds[identifier] = {
					...(Number.isFinite(min) ? { normalMinimum: min } : {}),
					...(Number.isFinite(max) ? { normalMaximum: max } : {}),
				};
			}
			return;
		}
		for (let child = el.firstChild; child; child = child.nextSibling) {
			if (child.nodeType === 1) visit(child as Element);
		}
	};
	const root = parseXml(itemXml).documentElement;
	if (root) visit(root);
	return Object.keys(bounds).length > 0 ? bounds : undefined;
}
