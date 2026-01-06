/**
 * Core types for the plugin-based element extraction system
 *
 * Provides interfaces for extracting data from QTI XML elements with
 * priority-based dispatch, validation, and type safety.
 */

import type { PlayerConfig } from '../types/index.js';
import type { QTIElement } from '../types/interactions.js';

/**
 * Context provided to extractors during extraction
 * Contains DOM reference, utilities, and metadata
 */
export interface ExtractionContext {
	/** The element being extracted */
	element: QTIElement;

	/** Response identifier for this interaction */
	responseId: string;

	/** Root DOM element for document-wide queries */
	dom: QTIElement;

	/** Variable declarations from responseDeclaration/outcomeDeclaration */
	declarations: Map<string, VariableDeclaration>;

	/** Utility functions for DOM manipulation and extraction */
	utils: ExtractionUtils;

	/** Player configuration (role, typesetting, etc.) */
	config: PlayerConfig;
}

/**
 * Variable declaration from QTI responseDeclaration/outcomeDeclaration
 */
export interface VariableDeclaration {
	identifier: string;
	cardinality: 'single' | 'multiple' | 'ordered' | 'record';
	baseType?: string;
}

/**
 * Utility functions available to extractors
 * Provides safe, consistent DOM manipulation and content extraction
 */
export interface ExtractionUtils {
	/**
	 * Get direct children with a specific tag name
	 * @example utils.getChildrenByTag(element, 'simpleChoice')
	 */
	getChildrenByTag(element: QTIElement, tagName: string): QTIElement[];

	/**
	 * Query all descendants matching a selector
	 * @example utils.querySelectorAll(element, 'choiceInteraction simpleChoice')
	 */
	querySelectorAll(element: QTIElement, selector: string): QTIElement[];

	/**
	 * Query first descendant matching a selector
	 * @example utils.querySelector(element, 'prompt')
	 */
	querySelector(element: QTIElement, selector: string): QTIElement | null;

	/**
	 * Check if element has a child with specific tag (fast boolean check)
	 * @example utils.hasChildWithTag(element, 'ratingChoice')
	 */
	hasChildWithTag(element: QTIElement, tagName: string): boolean;

	/**
	 * Get sanitized HTML content from element
	 * @example utils.getHtmlContent(element) // '<p>Question <math>...</math></p>'
	 */
	getHtmlContent(element: QTIElement): string;

	/**
	 * Get plain text content (strips HTML tags)
	 * @example utils.getTextContent(element) // 'Question text'
	 */
	getTextContent(element: QTIElement): string;

	/**
	 * Get attribute value with optional default
	 * @example utils.getAttribute(element, 'identifier', '')
	 */
	getAttribute(element: QTIElement, name: string, defaultValue?: string): string;

	/**
	 * Get boolean attribute value with optional default
	 * @example utils.getBooleanAttribute(element, 'shuffle', false) // true
	 */
	getBooleanAttribute(element: QTIElement, name: string, defaultValue?: boolean): boolean;

	/**
	 * Get numeric attribute value with optional default
	 * @example utils.getNumberAttribute(element, 'maxChoices', 1) // 1
	 */
	getNumberAttribute(element: QTIElement, name: string, defaultValue?: number): number;

	/**
	 * Get CSS classes from element
	 * @example utils.getClasses(element) // ['rating-interaction', 'custom']
	 */
	getClasses(element: QTIElement): string[];

	/**
	 * Extract prompt element text from an interaction
	 * @example utils.getPrompt(element) // '<p>Select the correct answer</p>'
	 */
	getPrompt(element: QTIElement): string | null;
}

/**
 * Result of validation
 */
export interface ValidationResult {
	/** Whether validation passed */
	valid: boolean;

	/** Error messages if validation failed */
	errors?: string[];

	/** Warning messages (non-fatal) */
	warnings?: string[];
}

/**
 * Error thrown during extraction
 */
export class ExtractionError extends Error {
	constructor(
		message: string,
		public readonly extractorId: string,
		public readonly elementType: string,
		public readonly cause?: Error
	) {
		super(message);
		this.name = 'ExtractionError';
	}
}

/**
 * Result of extraction operation
 */
export type ExtractionResult<TData> =
	| { success: true; data: TData; warnings?: string[] }
	| { success: false; error: ExtractionError };

/**
 * Element extractor with priority-based dispatch
 *
 * @template TData - The extracted data type (e.g., ChoiceData, TextEntryData)
 * @template TContext - The extraction context type (defaults to ExtractionContext)
 */
export interface ElementExtractor<
	TData = unknown,
	TContext extends ExtractionContext = ExtractionContext,
> {
	/**
	 * Unique identifier for this extractor
	 * Convention: 'namespace:element-type' (e.g., 'qti:choice', 'renaissance:rating-choice')
	 */
	id: string;

	/**
	 * Human-readable name for debugging/error messages
	 * @example 'QTI Standard Choice Interaction'
	 */
	name: string;

	/**
	 * Priority for extractor evaluation (higher = checked first)
	 * - 1000+: Critical system extractors (error handlers, etc.)
	 * - 500-999: Vendor-specific extractors (Renaissance, custom content)
	 * - 100-499: Third-party plugin extractors
	 * - 1-99: Standard QTI extractors with variations
	 * - 0: Fallback/default extractors
	 */
	priority: number;

	/**
	 * Element types this extractor handles (for type-based indexing)
	 * Used for O(M) lookup instead of O(N) scanning
	 * @example ['choiceInteraction', 'inlineChoiceInteraction']
	 */
	elementTypes: string[];

	/**
	 * Optional description for debugging/error messages
	 * @example 'Handles Renaissance rating choice interactions with star/face icons'
	 */
	description?: string;

	/**
	 * Predicate to determine if this extractor can handle the element
	 * Evaluated in priority order (highest first)
	 *
	 * IMPORTANT: Must be FAST - use quick checks first
	 * @example
	 * canHandle(element, context) {
	 *   // Fast checks first
	 *   if (!context.utils.hasChildWithTag(element, 'ratingChoice')) return false;
	 *   // Expensive checks only if fast checks pass
	 *   return validateRatingStructure(element);
	 * }
	 */
	canHandle(element: QTIElement, context: TContext): boolean;

	/**
	 * Extract data from the element
	 * Called only if canHandle() returns true
	 *
	 * @throws ExtractionError if extraction fails
	 * @returns Extracted data structure
	 */
	extract(element: QTIElement, context: TContext): TData;

	/**
	 * Validate extracted data (optional)
	 * Called after extract() succeeds
	 *
	 * @returns Validation result with errors/warnings
	 */
	validate?(data: TData): ValidationResult;
}

/**
 * Type guard for successful extraction result
 */
export function isSuccessResult<TData>(
	result: ExtractionResult<TData>
): result is { success: true; data: TData; warnings?: string[] } {
	return result.success === true;
}

/**
 * Type guard for failed extraction result
 */
export function isErrorResult<TData>(
	result: ExtractionResult<TData>
): result is { success: false; error: ExtractionError } {
	return result.success === false;
}
