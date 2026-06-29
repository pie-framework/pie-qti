// Core classes

export type { BackendAssessmentPlayerConfig } from './core/AssessmentPlayer.js';
export type { NavigationMode } from './core/index.js';
export { AssessmentPlayer, NavigationManager } from './core/index.js';
// Backend integration API + reference adapter
export * from './integration/index.js';
// Public UI/data types
export type { AssessmentResults, ItemRef, ItemResult, NavigationState, QTIRole } from './types/index.js';

