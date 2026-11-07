/**
 * The QTI Results Reporting model the serializer writes: an `assessmentResult` with its context,
 * an optional test result and item results, each carrying response, outcome, template and (QTI 3.0)
 * context variables. Mirrors the 1EdTech QTI Results Reporting information model for QTI 2.2
 * (`imsqti_result_v2p2`) and QTI 3.0 (`imsqti_result_v3p0`); see `serializeAssessmentResult`.
 */

/** The QTI Results Reporting version to write. */
export type AssessmentResultVersion = '2.2' | '3.0';

export type ResultBaseType =
	| 'boolean'
	| 'directedPair'
	| 'duration'
	| 'file'
	| 'float'
	| 'identifier'
	| 'integer'
	| 'pair'
	| 'point'
	| 'string'
	| 'uri';

export type ResultCardinality = 'single' | 'multiple' | 'ordered' | 'record';

/**
 * How far an item session got, as the Results Reporting `sessionStatus` vocabulary defines it.
 * `pendingExternalScoring` exists in QTI 3.0 only.
 */
export type ResultSessionStatus =
	| 'final'
	| 'initial'
	| 'pendingResponseProcessing'
	| 'pendingSubmission'
	| 'pendingExternalScoring';

/** When a result was recorded: a Date, epoch milliseconds, or an ISO 8601 date-time. */
export type ResultDatestamp = Date | number | string;

interface ResultVariableBase {
	readonly identifier: string;
	readonly cardinality: ResultCardinality;
	/** Omitted, and ignored, for record cardinality. */
	readonly baseType?: ResultBaseType;
	/**
	 * The value in the player's runtime shape: a scalar for single cardinality, an array for
	 * multiple and ordered, an object of fields for record (each field a plain value, or
	 * `{ baseType, value }`), null or undefined for NULL. Durations are seconds.
	 */
	readonly value: unknown;
}

export interface ResultResponseVariable extends ResultVariableBase {
	readonly kind: 'response';
	/** The correct response, when the report should carry it. */
	readonly correctResponse?: unknown;
	/** The order the choices were presented in, as choice identifiers. */
	readonly choiceSequence?: readonly string[];
}

export interface ResultOutcomeVariable extends ResultVariableBase {
	readonly kind: 'outcome';
	readonly view?: readonly string[];
	readonly interpretation?: string;
	readonly longInterpretation?: string;
	readonly normalMaximum?: number;
	readonly normalMinimum?: number;
	readonly masteryValue?: number;
}

export interface ResultTemplateVariable extends ResultVariableBase {
	readonly kind: 'template';
}

/** QTI 3.0 only; a QTI 2.2 report leaves context variables out. */
export interface ResultContextVariable extends ResultVariableBase {
	readonly kind: 'context';
}

export type ResultVariable =
	| ResultResponseVariable
	| ResultOutcomeVariable
	| ResultTemplateVariable
	| ResultContextVariable;

export interface ResultSessionIdentifier {
	/** The system that assigned the identifier, as a URI. */
	readonly sourceID: string;
	readonly identifier: string;
}

export interface AssessmentResultContext {
	/** The candidate's sourcedId (an NCName, per LIS). */
	readonly sourcedId?: string;
	readonly sessionIdentifiers?: readonly ResultSessionIdentifier[];
}

export interface AssessmentTestResult {
	/** The assessmentTest identifier. */
	readonly identifier: string;
	readonly datestamp: ResultDatestamp;
	readonly variables: readonly ResultVariable[];
}

export interface AssessmentItemResult {
	/** The assessmentItemRef identifier within the test (or the item identifier outside one). */
	readonly identifier: string;
	/** The item's 1-based position in this instance of the test. */
	readonly sequenceIndex?: number;
	readonly datestamp: ResultDatestamp;
	readonly sessionStatus: ResultSessionStatus;
	readonly variables: readonly ResultVariable[];
	readonly candidateComment?: string;
}

export interface AssessmentResultReport {
	readonly context: AssessmentResultContext;
	readonly testResult?: AssessmentTestResult;
	readonly itemResults: readonly AssessmentItemResult[];
}
