/**
 * Web Components for QTI Interactions
 *
 * Framework-agnostic web components that can be used in any JavaScript environment
 */

// Export event classes and interfaces
export {
	QTIChangeEvent,
	type InteractionResponseValue,
	type QTIChangeEventDetail,
	type QTIInteractionElement,
} from './QTIInteractionElement.js';

// Note: Web component implementations are provided by separate packages
// (e.g., @pie-qti/default-components) that use these base classes
