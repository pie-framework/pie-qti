// Core classes

export type {
	BackendAssessmentPlayerConfig,
	EffectiveItemTimeLimits,
	AssessmentEndReason,
	AssessmentFinalizedEvent,
	AssessmentStartInfo,
	AssessmentTimeExpiryEvent,
	AssessmentTimeState,
	ScopeTimeExpiryEvent,
	SubmissionBlocker,
} from './core/AssessmentPlayer.js';
export type { ForwardTransitionInfo, ItemAnswerStatus, ReviewItemView } from './core/index.js';
// Autosave: debounced draft persistence through BackendAdapter.saveState.
export type { AutosaveState, AutosaveStatus } from './core/index.js';
export { AssessmentPlayer } from './core/index.js';
// Coded errors thrown by the core; shells localize them via `assessment.errors.codes.*`.
export {
	AssessmentPlayerError,
	assessmentErrorDisplay,
	isAssessmentPlayerError,
	type AssessmentErrorDisplay,
	type AssessmentPlayerErrorCode,
	type AssessmentPlayerErrorParams,
} from './core/errors.js';
// Shared QTI XML scan primitives used by the adapter and the element discovery parser.
export { toCanonicalQtiName } from './core/testStructure.js';
// Backend integration API + reference adapter
export * from './integration/index.js';
// QTI Results Reporting (assessmentResult) output
export * from './reporting/index.js';
// Public UI/data types
export type {
	AssessmentResults,
	CandidateSectionView,
	CheckAnswerState,
	ItemFeedbackEntry,
	ItemFeedbackView,
	ItemResult,
	NavigationState,
	QTIRole,
	ResultsSummary,
	VisibleTestFeedback,
} from './types/index.js';
