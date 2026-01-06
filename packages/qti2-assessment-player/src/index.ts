// Core classes

export type { BackendAssessmentPlayerConfig } from './core/AssessmentPlayer.js';
export type { NavigationMode } from './core/index.js';
export { AssessmentPlayer, NavigationManager } from './core/index.js';
// Backend integration API + reference adapter
export * from './integration/index.js';
// Public UI/data types
export type { AssessmentResults, ItemResult, NavigationState, QTIRole, QuestionRef } from './types/index.js';

// Components are exported via package.json "exports" field
// Users can import them like:
// import AssessmentShell from '@pie-qti/qti2-assessment-player/components/AssessmentShell.svelte';
