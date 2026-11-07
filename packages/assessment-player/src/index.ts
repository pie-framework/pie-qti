// Core classes

export type { BackendAssessmentPlayerConfig } from './core/AssessmentPlayer.js';
export type { ForwardTransitionInfo, ItemAnswerStatus, NavigationMode, ReviewItemView } from './core/index.js';
export { AssessmentPlayer, NavigationManager } from './core/index.js';
// Coded errors thrown by the core; shells localize them via `assessment.errors.codes.*`.
export {
	AssessmentPlayerError,
	assessmentErrorDisplay,
	isAssessmentPlayerError,
	shortSupportCode,
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
	ItemRef,
	ItemResult,
	NavigationState,
	QTIRole,
	VisibleTestFeedback,
} from './types/index.js';
