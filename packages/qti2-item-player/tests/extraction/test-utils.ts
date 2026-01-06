/**
 * Shared test utilities for extraction tests
 */

import { type HTMLElement, parse } from 'node-html-parser';
import { createExtractionContext } from '../../src/extraction/createContext.js';
import type { ExtractionContext, VariableDeclaration } from '../../src/extraction/types.js';
import type { PlayerConfig } from '../../src/types/index.js';
import type { QTIElement } from '../../src/types/interactions.js';

/**
 * Parse QTI XML and return the root element as a QTIElement
 * Handles the type conversion from node-html-parser's HTMLElement
 *
 * @param xml - XML string to parse
 * @returns Parsed QTIElement
 */
export function parseQTI(xml: string): QTIElement {
	const doc = parse(xml, {
		comment: false,
		blockTextElements: {
			script: false,
			noscript: false,
			style: false,
			pre: true,
		},
	});

	// Get the first actual element (skip text nodes)
	const element = doc.childNodes.find((node) => (node as any).rawTagName) as HTMLElement;

	if (!element) {
		throw new Error('No element found in XML');
	}

	return element as unknown as QTIElement;
}

/**
 * Create a test extraction context with sensible defaults
 *
 * @param element - The element being extracted
 * @param responseId - Response identifier (defaults to 'RESPONSE')
 * @param dom - Root DOM element (defaults to element itself)
 * @param declarations - Variable declarations (defaults to empty Map)
 * @param config - Player configuration (defaults to empty object)
 * @returns ExtractionContext for testing
 */
export function createTestContext(
	element: QTIElement,
	responseId: string = 'RESPONSE',
	dom: QTIElement = element,
	declarations: Map<string, VariableDeclaration> = new Map(),
	config: PlayerConfig = {} as PlayerConfig
): ExtractionContext {
	return createExtractionContext(element, responseId, dom, declarations, config);
}
