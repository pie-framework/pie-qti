/**
 * Coded errors thrown by the assessment player core.
 *
 * The core must never surface raw English or backend strings to candidates: every
 * candidate-visible failure carries a stable `code` that shells localize through
 * `@pie-qti/i18n` under `assessment.errors.codes.<code>`. The original message is
 * preserved on the Error itself for logs and host callbacks.
 */

/** Stable machine-readable failure codes. Never rename a code; shells key translations on it. */
export type AssessmentPlayerErrorCode =
	/** A navigation index or section identifier does not resolve to a deliverable item. */
	| 'invalidNavigationTarget'
	/** Linear navigation mode only permits moving to the next item. */
	| 'linearNavigationOnly'
	/** The requested jump is not legal for the current navigation mode or test state. */
	| 'navigationNotAllowed'
	/** A navigation or submission transition is already in flight. */
	| 'navigationInFlight'
	/** The assessment has already been finalized; navigation is closed. */
	| 'testFinalized'
	/** A scoped minimum time has not elapsed. */
	| 'minTimeNotElapsed'
	/** The target item is locked because its time limit expired. */
	| 'itemTimeExpired'
	/** The item was submitted and its session control forbids review. */
	| 'reviewNotAllowed'
	/** The item must be answered before navigation away is allowed. */
	| 'responseRequired'
	/** The item's responses fail validation and navigation away is blocked. */
	| 'responseInvalid'
	/** Ending the attempt failed response validation. */
	| 'attemptValidationFailed'
	/** The item's maxAttempts are used up; no further attempt can be submitted. */
	| 'maxAttemptsReached'
	/** The item session lifecycle forbids response updates. */
	| 'itemSessionLocked'
	/** The item's session control forbids candidate comments. */
	| 'commentsNotAllowed'
	/** The backend rejected a response submission. */
	| 'submitFailed'
	/** The backend failed to finalize the assessment. */
	| 'finalizeFailed'
	/** A proctor (or the host) paused the assessment; candidate actions are unavailable. */
	| 'assessmentPaused'
	/** Test-level outcome processing failed on the backend. */
	| 'outcomeProcessingFailed'
	/** Anything else: shells show a generic localized message plus a support code. */
	| 'unexpected';

/** Parameters interpolated into the localized message for a coded error. */
export type AssessmentPlayerErrorParams = Record<string, string | number>;

/**
 * Error thrown (or returned as a typed rejection) by the assessment player core.
 *
 * `message` keeps the original, developer-facing text (including raw backend error
 * strings) for logs and host callbacks; `code` and `params` drive the localized,
 * candidate-safe rendering in the shell.
 */
export class AssessmentPlayerError extends Error {
	readonly code: AssessmentPlayerErrorCode;
	readonly params: AssessmentPlayerErrorParams;
	readonly originalError?: unknown;

	constructor(
		code: AssessmentPlayerErrorCode,
		message: string,
		params: AssessmentPlayerErrorParams = {},
		options?: { cause?: unknown },
	) {
		// No ErrorOptions argument: svelte-check's lib config predates ES2022 Error cause.
		super(message);
		this.name = 'AssessmentPlayerError';
		this.code = code;
		this.params = params;
		this.originalError = options?.cause;
	}

	/** i18n key the shell renders this error through (`assessment.errors.codes.*`). */
	get i18nKey(): string {
		return `assessment.errors.codes.${this.code}`;
	}
}

export function isAssessmentPlayerError(error: unknown): error is AssessmentPlayerError {
	return error instanceof AssessmentPlayerError;
}

/** Deterministic short support code for an arbitrary (non-coded) error message. */
export function shortSupportCode(message: string): string {
	let hash = 0;
	const source = message.slice(0, 256);
	for (let i = 0; i < source.length; i++) {
		hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
	}
	return `E-${hash.toString(36).toUpperCase().padStart(6, '0').slice(-6)}`;
}

/**
 * Candidate-safe rendering plan for any error the core (or a backend) produced.
 *
 * `i18nKey`/`params` resolve to a friendly localized message; `supportCode` is a
 * short stable code the shell may append so hosts can correlate reports without
 * ever showing raw backend messages to candidates.
 */
export interface AssessmentErrorDisplay {
	i18nKey: string;
	params: AssessmentPlayerErrorParams;
	supportCode: string;
}

export function assessmentErrorDisplay(error: unknown): AssessmentErrorDisplay {
	if (isAssessmentPlayerError(error)) {
		return { i18nKey: error.i18nKey, params: error.params, supportCode: error.code };
	}
	const message = error instanceof Error ? error.message : String(error);
	return {
		i18nKey: 'assessment.errors.unexpected',
		params: {},
		supportCode: shortSupportCode(message),
	};
}
