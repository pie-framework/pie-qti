import type { SerializedItemSessionState, SerializedItemSessionVariable } from '@pie-qti/item-player';
import { childElements, durationSecondsFromMilliseconds, getAttr, parseXml } from '@pie-qti/qti-processing';
import { deliveredItems } from '../core/testStructure.js';
import type {
	AssessmentItemSessionState,
	AssessmentScoringResult,
	AssessmentSessionState,
	FinalizeAssessmentResponse,
	SecureAssessment,
	TestOutcomeValues,
} from '../integration/api-contract.js';
import { type SerializeAssessmentResultOptions, serializeAssessmentResult } from './serializeAssessmentResult.js';
import type {
	AssessmentItemResult,
	AssessmentResultReport,
	ResultBaseType,
	ResultCardinality,
	ResultDatestamp,
	ResultOutcomeVariable,
	ResultSessionIdentifier,
	ResultSessionStatus,
	ResultVariable,
} from './types.js';

/** The assessment results a host holds: the delivered test, its session state, and the finalize response. */
export interface AssessmentResultsData {
	/** The assessment as delivered (drawn) for this session; its order gives each item's sequenceIndex. */
	readonly assessment: SecureAssessment;
	/** The session state: responses, item sessions, scores, comments and timing. */
	readonly state: AssessmentSessionState;
	/** The finalize response, once the test has ended: final item scores and test outcomes. */
	readonly finalized?: FinalizeAssessmentResponse;
	/** Test outcome values, when the host has them without a finalize response. */
	readonly outcomes?: TestOutcomeValues;
}

export interface AssessmentResultXmlOptions extends SerializeAssessmentResultOptions {
	/** `context@sourcedId`: the candidate's sourcedId (an NCName). */
	readonly candidateSourcedId?: string;
	readonly sessionIdentifiers?: readonly ResultSessionIdentifier[];
	/** `testResult@datestamp`. Default: `finalized.finalizedAt`, else now. */
	readonly datestamp?: ResultDatestamp;
	/** Report the correct responses the scoring results carry. Default: false. */
	readonly includeCorrectResponses?: boolean;
}

/**
 * Writes the assessment's results as a QTI Results Reporting `assessmentResult` document (QTI 2.2
 * or 3.0, per `options.version`).
 *
 * The test result carries the test outcomes, typed by the test's outcome declarations, and the
 * built-in `duration` response variables of the test, each test part and each section
 * (`PART.duration`, `SECTION.duration`), in seconds. Each item with recorded data gets an item
 * result in delivery order, with its `sequenceIndex`, its `sessionStatus` derived from the session
 * lifecycle and scoring, its response, outcome, template and (QTI 3.0) context variables, the
 * built-in `numAttempts` and `duration` (seconds) response variables, and the candidate comment.
 * Item session snapshots give variables their types; the item's declarations fill in where a
 * snapshot is missing.
 */
export function toAssessmentResultXml(results: AssessmentResultsData, options: AssessmentResultXmlOptions): string {
	return serializeAssessmentResult(buildAssessmentResultReport(results, options), options);
}

/** The Results Reporting model `toAssessmentResultXml` writes, for hosts that adjust it first. */
export function buildAssessmentResultReport(
	results: AssessmentResultsData,
	options: Omit<AssessmentResultXmlOptions, 'version' | 'schemaLocation'> = {},
): AssessmentResultReport {
	const { assessment, state, finalized } = results;
	const itemScores: Record<string, AssessmentScoringResult> = { ...(state.itemScores ?? {}), ...(finalized?.itemScores ?? {}) };
	const itemXmlById = new Map<string, string>();
	const ordered: Array<{ identifier: string; sequenceIndex?: number }> = deliveredItems(assessment).map(
		({ item }, index) => {
			itemXmlById.set(item.identifier, item.itemXml);
			return { identifier: item.identifier, sequenceIndex: index + 1 };
		},
	);
	const known = new Set(ordered.map((item) => item.identifier));
	for (const identifier of [
		...Object.keys(state.itemSessions ?? {}),
		...Object.keys(itemScores),
		...Object.keys(state.itemResponses ?? {}),
	]) {
		if (!known.has(identifier)) {
			known.add(identifier);
			ordered.push({ identifier });
		}
	}

	const itemResults: AssessmentItemResult[] = [];
	for (const { identifier, sequenceIndex } of ordered) {
		const item = itemResultData(identifier, state, itemScores[identifier]);
		if (!item) continue;
		itemResults.push({
			identifier,
			...(sequenceIndex === undefined ? {} : { sequenceIndex }),
			datestamp: itemDatestamp(item, options.datestamp ?? finalized?.finalizedAt),
			sessionStatus: sessionStatus(item),
			variables: itemVariables(item, readDeclarations(itemXmlById.get(identifier)), options.includeCorrectResponses === true),
			...(state.itemComments?.[identifier] !== undefined ? { candidateComment: state.itemComments[identifier] } : {}),
		});
	}

	return {
		context: {
			...(options.candidateSourcedId !== undefined ? { sourcedId: options.candidateSourcedId } : {}),
			...(options.sessionIdentifiers ? { sessionIdentifiers: options.sessionIdentifiers } : {}),
		},
		testResult: {
			identifier: assessment.identifier,
			datestamp: options.datestamp ?? finalized?.finalizedAt ?? Date.now(),
			variables: testVariables(assessment, state, results.outcomes ?? finalized?.outcomes),
		},
		itemResults,
	};
}

// ---------------------------------------------------------------------------------------------
// Test result
// ---------------------------------------------------------------------------------------------

function testVariables(
	assessment: SecureAssessment,
	state: AssessmentSessionState,
	outcomes: TestOutcomeValues | undefined,
): ResultVariable[] {
	const timing = state.timing;
	const variables: ResultVariable[] = [durationVariable('duration', timing?.totalTime)];
	for (const [part, milliseconds] of Object.entries(timing?.testPartTimes ?? {})) {
		variables.push(durationVariable(`${part}.duration`, milliseconds));
	}
	for (const [section, milliseconds] of Object.entries(timing?.sectionTimes ?? {})) {
		variables.push(durationVariable(`${section}.duration`, milliseconds));
	}
	const declarations = new Map((assessment.outcomeDeclarations ?? []).map((declaration) => [declaration.identifier, declaration]));
	for (const [identifier, value] of Object.entries(outcomes ?? {})) {
		const declaration = declarations.get(identifier);
		const cardinality = asCardinality(declaration?.cardinality) ?? inferCardinality(value);
		variables.push({
			kind: 'outcome',
			identifier,
			cardinality,
			...(cardinality === 'record' ? {} : { baseType: asBaseType(declaration?.baseType) ?? inferBaseType(value) }),
			value,
		});
	}
	return variables;
}

function durationVariable(identifier: string, milliseconds: number | undefined): ResultVariable {
	return {
		kind: 'response',
		identifier,
		cardinality: 'single',
		baseType: 'duration',
		value: durationSecondsFromMilliseconds(Number(milliseconds) || 0),
	};
}

// ---------------------------------------------------------------------------------------------
// Item results
// ---------------------------------------------------------------------------------------------

interface ItemResultData {
	readonly identifier: string;
	readonly session?: SerializedItemSessionState;
	readonly scoring?: AssessmentScoringResult;
	readonly responses?: Record<string, unknown>;
	readonly sessionState?: AssessmentItemSessionState;
	readonly durationMs?: number;
}

/** The recorded data of one item; undefined for an item nothing was recorded for. */
function itemResultData(
	identifier: string,
	state: AssessmentSessionState,
	scoring: AssessmentScoringResult | undefined,
): ItemResultData | undefined {
	const session = state.itemSessions?.[identifier];
	const responses = state.itemResponses?.[identifier] as Record<string, unknown> | undefined;
	const sessionState = state.itemSessionStates?.[identifier];
	if (!session && !scoring && !responses && !sessionState) return undefined;
	const durationMs = session?.duration ?? state.timing?.itemTimes?.[identifier];
	return { identifier, session, scoring, responses, sessionState, ...(durationMs === undefined ? {} : { durationMs }) };
}

/**
 * The Results Reporting session status: `final` once response processing has scored the latest
 * submission, `pendingSubmission` while the candidate works (including edits newer than the last
 * scored submission), `pendingResponseProcessing` for a submission not yet scored, and `initial`
 * for an item with no attempt and no response.
 */
function sessionStatus({ session, scoring, responses, sessionState }: ItemResultData): ResultSessionStatus {
	const lifecycle = session?.lifecycleStatus;
	const working = lifecycle === 'interacting' || lifecycle === 'suspended' || lifecycle === 'initial';
	if (scoring) {
		const savedAt = session ? Date.parse(session.savedAt) : Number.NaN;
		const submittedAt = sessionState?.lastSubmissionTime;
		const editedSince = working && submittedAt !== undefined && Number.isFinite(savedAt) && savedAt > submittedAt;
		return editedSince ? 'pendingSubmission' : 'final';
	}
	if (lifecycle && !working) return 'final';
	if (sessionState?.isSubmitted) return 'pendingResponseProcessing';
	const attempts = sessionState?.attemptCount ?? session?.numAttempts ?? 0;
	const responded = Object.values(responses ?? valuesOf(session?.responseVariables)).some(hasValue);
	return attempts === 0 && !responded ? 'initial' : 'pendingSubmission';
}

/** When the item's latest recorded data was recorded: its last submission or its session snapshot. */
function itemDatestamp(item: ItemResultData, fallback: ResultDatestamp | undefined): ResultDatestamp {
	const submittedAt = item.sessionState?.lastSubmissionTime;
	const savedAt = item.session ? Date.parse(item.session.savedAt) : Number.NaN;
	const times = [submittedAt, Number.isFinite(savedAt) ? savedAt : undefined].filter(
		(time): time is number => typeof time === 'number' && Number.isFinite(time),
	);
	return times.length > 0 ? Math.max(...times) : (fallback ?? Date.now());
}

const BUILT_IN_RESPONSES = new Set(['numAttempts', 'duration']);

function itemVariables(item: ItemResultData, declarations: ItemDeclarations, includeCorrectResponses: boolean): ResultVariable[] {
	const { session, scoring, responses, sessionState } = item;
	const variables: ResultVariable[] = [];

	// Built-in response variables: numAttempts, and duration in seconds.
	const numAttempts =
		sessionState?.attemptCount ??
		(typeof scoring?.outcomeValues?.numAttempts === 'number' ? scoring.outcomeValues.numAttempts : undefined) ??
		session?.numAttempts ??
		0;
	variables.push({ kind: 'response', identifier: 'numAttempts', cardinality: 'single', baseType: 'integer', value: numAttempts });
	if (item.durationMs !== undefined) variables.push(durationVariable('duration', item.durationMs));

	// Response variables: the latest recorded responses, typed by the session or the declarations.
	const responseIds = new Set([...Object.keys(session?.responseVariables ?? {}), ...Object.keys(responses ?? {})]);
	for (const identifier of responseIds) {
		if (BUILT_IN_RESPONSES.has(identifier)) continue;
		const serialized = session?.responseVariables?.[identifier];
		const value = responses && identifier in responses ? responses[identifier] : serialized?.value;
		const correct = includeCorrectResponses ? scoring?.correctResponse?.[identifier] : undefined;
		variables.push({
			kind: 'response',
			...typed(identifier, value, serialized, declarations.get(identifier)),
			...(correct === undefined ? {} : { correctResponse: correct }),
		});
	}

	// Outcome variables: the scored outcomes, else the session's.
	const outcomeValues: Record<string, unknown> = { ...(scoring?.outcomeValues ?? valuesOf(session?.outcomeVariables)) };
	if (!('completionStatus' in outcomeValues) && session?.completionStatus) {
		outcomeValues.completionStatus = session.completionStatus;
	}
	for (const [identifier, value] of Object.entries(outcomeValues)) {
		if (BUILT_IN_RESPONSES.has(identifier)) continue;
		const declaration = declarations.get(identifier);
		const outcome: ResultOutcomeVariable = {
			kind: 'outcome',
			...typed(identifier, value, session?.outcomeVariables?.[identifier], declaration, BUILT_IN_OUTCOMES[identifier]),
			...(declaration?.outcome ?? {}),
		};
		variables.push(outcome);
	}

	for (const serialized of Object.values(session?.templateVariables ?? {})) {
		variables.push({ kind: 'template', ...typed(serialized.identifier, serialized.value, serialized) });
	}
	for (const serialized of Object.values(session?.contextVariables ?? {})) {
		if (BUILT_IN_RESPONSES.has(serialized.identifier) || serialized.identifier === 'completionStatus') continue;
		variables.push({ kind: 'context', ...typed(serialized.identifier, serialized.value, serialized) });
	}
	return variables;
}

/** The built-in outcomes' declarations, for results without a session snapshot. */
const BUILT_IN_OUTCOMES: Readonly<Record<string, ItemDeclaration>> = {
	completionStatus: { cardinality: 'single', baseType: 'identifier' },
	SCORE: { cardinality: 'single', baseType: 'float' },
	MAXSCORE: { cardinality: 'single', baseType: 'float' },
};

function typed(
	identifier: string,
	value: unknown,
	serialized?: Pick<SerializedItemSessionVariable, 'baseType' | 'cardinality'>,
	...declarations: Array<ItemDeclaration | undefined>
): { identifier: string; cardinality: ResultCardinality; baseType?: ResultBaseType; value: unknown } {
	const declaration = declarations.find((candidate) => candidate !== undefined);
	const cardinality =
		asCardinality(serialized?.cardinality) ?? declaration?.cardinality ?? inferCardinality(value);
	if (cardinality === 'record') return { identifier, cardinality, value };
	const baseType = asBaseType(serialized?.baseType) ?? declaration?.baseType ?? inferBaseType(value);
	return { identifier, cardinality, baseType, value };
}

// ---------------------------------------------------------------------------------------------
// Item declarations, from the item XML
// ---------------------------------------------------------------------------------------------

interface ItemDeclaration {
	readonly cardinality: ResultCardinality;
	readonly baseType?: ResultBaseType;
	readonly outcome?: Pick<
		ResultOutcomeVariable,
		'view' | 'interpretation' | 'longInterpretation' | 'normalMaximum' | 'normalMinimum' | 'masteryValue'
	>;
}

type ItemDeclarations = ReadonlyMap<string, ItemDeclaration>;

const DECLARATION_ELEMENTS = new Set([
	'responsedeclaration',
	'outcomedeclaration',
	'templatedeclaration',
	'contextdeclaration',
]);

/** The variable declarations of an item's XML, in either QTI version; empty when it does not parse. */
function readDeclarations(itemXml: string | undefined): ItemDeclarations {
	const declarations = new Map<string, ItemDeclaration>();
	if (!itemXml) return declarations;
	let root: Element | null;
	try {
		root = parseXml(itemXml).documentElement;
	} catch {
		return declarations;
	}
	for (const element of root ? childElements(root) : []) {
		const name = element.localName.replace(/^qti-/, '').replace(/-/g, '').toLowerCase();
		if (!DECLARATION_ELEMENTS.has(name)) continue;
		const identifier = getAttr(element, 'identifier')?.trim();
		const cardinality = asCardinality(getAttr(element, 'cardinality') ?? 'single');
		if (!identifier || !cardinality) continue;
		const baseType = asBaseType(getAttr(element, 'baseType') ?? undefined);
		declarations.set(identifier, {
			cardinality,
			...(baseType && cardinality !== 'record' ? { baseType } : {}),
			...(name === 'outcomedeclaration' ? { outcome: outcomeAttributes(element) } : {}),
		});
	}
	return declarations;
}

function outcomeAttributes(element: Element): ItemDeclaration['outcome'] {
	const number = (name: string): number | undefined => {
		const raw = getAttr(element, name);
		const value = raw === null ? Number.NaN : Number.parseFloat(raw);
		return Number.isFinite(value) ? value : undefined;
	};
	const text = (name: string): string | undefined => getAttr(element, name)?.trim() || undefined;
	const view = text('view')?.split(/\s+/);
	const attributes = {
		view,
		interpretation: text('interpretation'),
		longInterpretation: text('longInterpretation'),
		normalMaximum: number('normalMaximum'),
		normalMinimum: number('normalMinimum'),
		masteryValue: number('masteryValue'),
	};
	return Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined));
}

// ---------------------------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------------------------

const BASE_TYPES = new Set<string>([
	'boolean',
	'directedPair',
	'duration',
	'file',
	'float',
	'identifier',
	'integer',
	'pair',
	'point',
	'string',
	'uri',
]);
const CARDINALITIES = new Set<string>(['single', 'multiple', 'ordered', 'record']);

function asBaseType(value: string | undefined): ResultBaseType | undefined {
	return value !== undefined && BASE_TYPES.has(value) ? (value as ResultBaseType) : undefined;
}

function asCardinality(value: string | undefined): ResultCardinality | undefined {
	return value !== undefined && CARDINALITIES.has(value) ? (value as ResultCardinality) : undefined;
}

function inferCardinality(value: unknown): ResultCardinality {
	if (Array.isArray(value)) return 'multiple';
	if (value !== null && typeof value === 'object') return 'record';
	return 'single';
}

function inferBaseType(value: unknown): ResultBaseType {
	const sample = Array.isArray(value) ? value.find((entry) => entry !== null && entry !== undefined) : value;
	if (typeof sample === 'boolean') return 'boolean';
	if (typeof sample === 'number') return 'float';
	return 'string';
}

function valuesOf(variables: Record<string, SerializedItemSessionVariable> | undefined): Record<string, unknown> {
	return Object.fromEntries(Object.entries(variables ?? {}).map(([identifier, variable]) => [identifier, variable.value]));
}

function hasValue(value: unknown): boolean {
	if (value === null || value === undefined) return false;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === 'string') return value.trim().length > 0;
	return true;
}
