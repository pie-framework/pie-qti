/**
 * Context factory for element extraction
 *
 * Creates ExtractionContext instances with utilities and metadata
 */

import type { PlayerConfig } from '../types/index.js';
import type { QTIElement } from '../types/interactions.js';
import type { ExtractionContext, VariableDeclaration } from './types.js';
import { createExtractionUtils } from './utils.js';

/**
 * Create an extraction context for an element
 *
 * @param element - The element being extracted
 * @param responseId - Response identifier for this interaction
 * @param dom - Root DOM element for document-wide queries
 * @param declarations - Variable declarations from QTI
 * @param config - Player configuration
 * @returns Complete extraction context with utilities
 *
 * @example
 * const context = createExtractionContext(
 *   element,
 *   'RESPONSE',
 *   rootElement,
 *   declarations,
 *   playerConfig
 * );
 * const result = registry.extract<ChoiceData>(element, context);
 */
export function createExtractionContext(
	element: QTIElement,
	responseId: string,
	dom: QTIElement,
	declarations: Map<string, VariableDeclaration>,
	config: PlayerConfig
): ExtractionContext {
	return {
		element,
		responseId,
		dom,
		declarations,
		utils: createExtractionUtils(config.security),
		config,
	};
}
