// Core classes

export type { BackendAssessmentPlayerConfig } from './core/AssessmentPlayer.js';
export type { NavigationMode } from './core/index.js';
export { AssessmentPlayer, NavigationManager } from './core/index.js';
// Shared QTI XML scan primitives used by the adapter and the element discovery parser.
export { toCanonicalQtiName } from './core/testStructure.js';
// Backend integration API + reference adapter
export * from './integration/index.js';
// Public UI/data types
export type {
	AssessmentResults,
	ItemRef,
	ItemResult,
	NavigationState,
	QTIRole,
	VisibleTestFeedback,
} from './types/index.js';
