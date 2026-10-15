import {
	createAssessmentItemDefinition,
	type ItemSession,
	type SerializedItemSessionState,
	type SerializedItemSessionVariable,
} from '@pie-qti/item-player';
import { parseXml, type QtiValue, qtiNull, qtiValue, type TestItemState } from '@pie-qti/qti-processing';
import type { AssessmentScoringResult, ResponseValue } from './api-contract.js';

export interface AssessmentItemScoringInput {
	itemXml: string;
	responses: Record<string, ResponseValue>;
	itemSession?: SerializedItemSessionState;
}

export function getAssessmentItemIdentifier(itemXml: string): string {
	const identifierMatch = itemXml.match(/<(?:assessmentItem|qti-assessment-item)\b[^>]*\sidentifier=["']([^"']+)["']/);
	return identifierMatch?.[1] || 'unknown';
}

/** The item-derived part of a test-level TestItemState; the backend adds the item-ref context. */
export type ItemTestState = Pick<TestItemState, 'variables' | 'outcomeBounds' | 'responded' | 'correct'>;

/**
 * Runs QTI ResponseProcessing for one AssessmentItem and normalizes the result
 * to the BackendAdapter scoring shape used by AssessmentPlayer.
 */
export function scoreAssessmentItem(input: AssessmentItemScoringInput): AssessmentScoringResult {
	return scoreAssessmentItemForTest(input).result;
}

/** Scores one item and snapshots the variables and flags test-level outcome processing reads. */
export function scoreAssessmentItemForTest({
	itemXml,
	responses,
	itemSession,
}: AssessmentItemScoringInput): { result: AssessmentScoringResult; testState?: ItemTestState } {
	const itemIdentifier = getAssessmentItemIdentifier(itemXml);

	try {
		// Use a scorer-grade view of the item for accurate scoring.
		// NOTE: This reference scorer is intentionally insecure and runs client-side.
		// In production, scoring must happen server-side with secured item content.
		const definition = createAssessmentItemDefinition({
			itemXml,
			role: 'scorer',
		});
		const session = definition.openSession(
			itemSession ? { restore: itemSession } : { responses },
		);
		let result;
		let testState: ItemTestState;
		try {
			result = session.dispatch(
				itemSession
					? { action: 'scoreAttempt' }
					: { action: 'endAttempt', countAttempt: false, validateResponses: false },
			).result?.scoring;
			if (!result) throw new Error('QTI scoring produced no result');
			testState = snapshotTestState(itemXml, session, result.correct);
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
		};
	}
}

const defaultTestStates = new Map<string, ItemTestState | undefined>();

/** Variables of an item nobody has attempted: declared defaults, with no response processing run. */
export function defaultItemTestState(itemXml: string): ItemTestState | undefined {
	if (!defaultTestStates.has(itemXml)) {
		let state: ItemTestState | undefined;
		try {
			const session = createAssessmentItemDefinition({ itemXml, role: 'scorer' }).openSession({ responses: {} });
			try {
				state = { ...snapshotTestState(itemXml, session, undefined), responded: false };
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

function snapshotTestState(itemXml: string, session: ItemSession, correct: boolean | undefined): ItemTestState {
	const serialized = session.serialize();
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
