/**
 * Web Components for QTI Interactions
 *
 * Framework-agnostic web components that can be used in any JavaScript environment
 */

// Export base classes and interfaces
export { QTIInteractionBase } from './QTIInteractionBase.js';
export {
	QTIChangeEvent,
	type QTIChangeEventDetail,
	QTIErrorEvent,
	type QTIErrorEventDetail,
	type QTIInteractionElement,
	QTIReadyEvent,
	QTISelectionChangeEvent,
	type QTISelectionChangeEventDetail,
} from './QTIInteractionElement.js';

// Note: Web component implementations are provided by separate packages
// (e.g., @pie-qti/qti2-default-components) that use these base classes
