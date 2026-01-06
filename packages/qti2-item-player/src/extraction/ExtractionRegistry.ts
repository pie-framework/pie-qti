/**
 * ExtractionRegistry for priority-based element extraction
 *
 * Manages a collection of ElementExtractor instances with:
 * - Priority-based dispatch (highest priority checked first)
 * - Type-based indexing for O(M) lookup instead of O(N) scanning
 * - WeakMap caching for O(1) repeat lookups
 * - Validation and error handling
 */

import type { QTIElement } from '../types/interactions.js';
import type {
	ElementExtractor,
	ExtractionContext,
	ExtractionResult,
	ValidationResult,
} from './types.js';
import { ExtractionError, isSuccessResult } from './types.js';

/**
 * Registry for element extractors with priority-based dispatch
 */
export class ExtractionRegistry {
	/** All registered extractors by ID */
	private extractorsById = new Map<string, ElementExtractor>();

	/** Extractors indexed by element type for fast lookup */
	private extractorsByType = new Map<string, ElementExtractor[]>();

	/** Cache for element -> extractor lookups (WeakMap for automatic GC) */
	private extractorCache = new WeakMap<QTIElement, ElementExtractor>();

	/**
	 * Register an extractor with the registry
	 *
	 * @param extractor - The extractor to register
	 * @throws Error if extractor ID is already registered
	 *
	 * @example
	 * registry.register({
	 *   id: 'qti:choice',
	 *   name: 'QTI Standard Choice',
	 *   priority: 10,
	 *   elementTypes: ['choiceInteraction'],
	 *   canHandle: (element) => utils.hasChildWithTag(element, 'simpleChoice'),
	 *   extract: (element, context) => ({ choices: [...] })
	 * });
	 */
	register<TData, TContext extends ExtractionContext = ExtractionContext>(
		extractor: ElementExtractor<TData, TContext>
	): void {
		// Check for duplicate ID
		if (this.extractorsById.has(extractor.id)) {
			throw new Error(
				`Extractor with ID '${extractor.id}' is already registered. ` +
					`Each extractor must have a unique ID.`
			);
		}

		// Validate extractor configuration
		if (!extractor.id || typeof extractor.id !== 'string') {
			throw new Error(`Extractor must have a valid string ID`);
		}

		if (!extractor.elementTypes || extractor.elementTypes.length === 0) {
			throw new Error(
				`Extractor '${extractor.id}' must specify at least one element type`
			);
		}

		if (typeof extractor.priority !== 'number') {
			throw new Error(`Extractor '${extractor.id}' must have a numeric priority`);
		}

		// Register by ID
		this.extractorsById.set(extractor.id, extractor as ElementExtractor);

		// Register by type for fast lookup
		for (const type of extractor.elementTypes) {
			let extractors = this.extractorsByType.get(type);
			if (!extractors) {
				extractors = [];
				this.extractorsByType.set(type, extractors);
			}

			extractors.push(extractor as ElementExtractor);

			// Keep sorted by priority (highest first)
			extractors.sort((a, b) => b.priority - a.priority);
		}
	}

	/**
	 * Unregister an extractor by ID
	 *
	 * @param id - The extractor ID to unregister
	 * @returns true if extractor was found and removed, false otherwise
	 */
	unregister(id: string): boolean {
		const extractor = this.extractorsById.get(id);
		if (!extractor) return false;

		// Remove from ID map
		this.extractorsById.delete(id);

		// Remove from type maps
		for (const type of extractor.elementTypes) {
			const extractors = this.extractorsByType.get(type);
			if (extractors) {
				const index = extractors.findIndex((e) => e.id === id);
				if (index !== -1) {
					extractors.splice(index, 1);
				}
				// Clean up empty arrays
				if (extractors.length === 0) {
					this.extractorsByType.delete(type);
				}
			}
		}

		return true;
	}

	/**
	 * Find an extractor that can handle the given element
	 * Uses type-based indexing and caching for performance
	 *
	 * @param element - The element to find an extractor for
	 * @param context - Extraction context
	 * @returns The matching extractor, or null if none found
	 */
	findExtractor(
		element: QTIElement,
		context: ExtractionContext
	): ElementExtractor | null {
		// Check cache first (O(1) lookup)
		const cached = this.extractorCache.get(element);
		if (cached) return cached;

		// Get extractors for this element type (O(1) map lookup)
		const extractors = this.extractorsByType.get(element.rawTagName || '');
		if (!extractors || extractors.length === 0) {
			return null;
		}

		// Evaluate canHandle in priority order (O(M) where M = extractors for this type)
		for (const extractor of extractors) {
			try {
				if (extractor.canHandle(element, context)) {
					// Cache the result
					this.extractorCache.set(element, extractor);
					return extractor;
				}
			} catch (error) {
				// Log but continue to next extractor
				console.warn(
					`canHandle() failed for extractor '${extractor.id}' (${extractor.name}):`,
					error
				);
			}
		}

		return null;
	}

	/**
	 * Extract data from an element using the appropriate extractor
	 *
	 * @param element - The element to extract data from
	 * @param context - Extraction context
	 * @returns Extraction result with data or error
	 *
	 * @example
	 * const result = registry.extract<ChoiceData>(element, context);
	 * if (result.success) {
	 *   console.log('Extracted:', result.data);
	 *   if (result.warnings) console.warn('Warnings:', result.warnings);
	 * } else {
	 *   console.error('Extraction failed:', result.error.message);
	 * }
	 */
	extract<TData>(
		element: QTIElement,
		context: ExtractionContext
	): ExtractionResult<TData> {
		// Find appropriate extractor
		const extractor = this.findExtractor(element, context);

		if (!extractor) {
			const elementType = element.rawTagName || 'unknown';
			const error = new ExtractionError(
				`No extractor available for element '${elementType}'. ` +
					`Registered types: ${Array.from(this.extractorsByType.keys()).join(', ')}`,
				'none',
				elementType
			);
			return { success: false, error };
		}

		try {
			// Extract data
			const data = extractor.extract(element, context) as TData;

			// Validate if validator provided
			if (extractor.validate) {
				const validation = extractor.validate(data);
				if (!validation.valid) {
					const error = new ExtractionError(
						`Validation failed for extractor '${extractor.id}': ${validation.errors?.join(', ')}`,
						extractor.id,
						element.rawTagName || 'unknown'
					);
					return { success: false, error };
				}

				// Return with warnings if present
				if (validation.warnings && validation.warnings.length > 0) {
					return { success: true, data, warnings: validation.warnings };
				}
			}

			return { success: true, data };
		} catch (error) {
			const elementType = element.rawTagName || 'unknown';
			const extractionError =
				error instanceof ExtractionError
					? error
					: new ExtractionError(
							`Extraction failed for '${elementType}': ${error instanceof Error ? error.message : String(error)}`,
							extractor.id,
							elementType,
							error instanceof Error ? error : undefined
						);

			return { success: false, error: extractionError };
		}
	}

	/**
	 * Get all registered extractors
	 * @returns Read-only array of extractors sorted by priority (highest first)
	 */
	getExtractors(): ReadonlyArray<ElementExtractor> {
		const all = Array.from(this.extractorsById.values());
		all.sort((a, b) => b.priority - a.priority);
		return all;
	}

	/**
	 * Get extractors for a specific element type
	 * @param elementType - The element type (e.g., 'choiceInteraction')
	 * @returns Read-only array of extractors for this type, sorted by priority
	 */
	getExtractorsForType(elementType: string): ReadonlyArray<ElementExtractor> {
		return this.extractorsByType.get(elementType) || [];
	}

	/**
	 * Check if an extractor is registered by ID
	 * @param id - The extractor ID
	 * @returns true if extractor exists
	 */
	hasExtractor(id: string): boolean {
		return this.extractorsById.has(id);
	}

	/**
	 * Clear all registered extractors
	 * Useful for testing or resetting the registry
	 */
	clear(): void {
		this.extractorsById.clear();
		this.extractorsByType.clear();
	}

	/**
	 * Clone this registry with all extractors
	 * @returns New registry with same extractors
	 */
	clone(): ExtractionRegistry {
		const cloned = new ExtractionRegistry();
		for (const extractor of this.extractorsById.values()) {
			cloned.register(extractor);
		}
		return cloned;
	}
}

/**
 * Create a new extraction registry
 * @returns Empty registry ready for extractor registration
 */
export function createExtractionRegistry(): ExtractionRegistry {
	return new ExtractionRegistry();
}
