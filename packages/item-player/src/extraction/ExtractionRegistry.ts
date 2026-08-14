/**
 * ExtractionRegistry for priority-based element extraction
 *
 * Manages a collection of ElementExtractor instances with:
 * - Priority-based dispatch (highest priority checked first)
 * - Type-based indexing for O(M) lookup instead of O(N) scanning
 * - Context-correct priority lookup
 * - Validation and error handling
 */

import { Qti2xElementNameMapper, type ElementNameMapper } from '@pie-qti/qti-common';
import type { QTIElement } from '../interactions/shared/types.js';
import type {
	ElementExtractor,
	ExtractionContext,
	ExtractionDispatchResult,
} from './types.js';
import type { InteractionDeliveryField } from './deliveryTypes.js';
import { ExtractionError } from './types.js';

const REGISTER_FRAMEWORK_DELIVERY_FIELDS = Symbol('registerFrameworkDeliveryFields');

/**
 * Registry for element extractors with priority-based dispatch
 */
export class ExtractionRegistry {
	/** All registered extractors by ID */
	private extractorsById = new Map<string, ElementExtractor<any, string>>();

	/** Extractors indexed by element type for fast lookup */
	private extractorsByType = new Map<string, ElementExtractor<any, string>[]>();
	/** Plugin-owned additions to the delivery schema. */
	private deliveryFieldsByType = new Map<string, readonly InteractionDeliveryField[]>();
	/** Framework-owned authored sink policy, kept authoritative over plugin additions. */
	private frameworkDeliveryFieldsByType = new Map<
		string,
		readonly InteractionDeliveryField[]
	>();

	/** Optional element name mapper for QTI version handling */
	private elementNameMapper?: ElementNameMapper;
	private sealed = false;

	/** QTI 2.x mapper for converting canonical names to extractor registry keys */
	private qti2xMapper = new Qti2xElementNameMapper();

	constructor(elementNameMapper?: ElementNameMapper) {
		this.elementNameMapper = elementNameMapper;
	}

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
	register<
		TPayload extends object,
		TOutputType extends string = string,
		TContext extends ExtractionContext = ExtractionContext,
	>(
		extractor: ElementExtractor<TPayload, TOutputType, TContext>
	): void {
		this.assertMutable();
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
		if (
			extractor.outputType !== undefined &&
			(typeof extractor.outputType !== 'string' || !extractor.outputType)
		) {
			throw new Error(`Extractor '${extractor.id}' must have a non-empty outputType`);
		}
		const registered = snapshotExtractor(extractor);

		// Register by ID
		this.extractorsById.set(registered.id, registered);

		// Register by type for fast lookup
		// Normalize element types to canonical (lowercase) form for version-agnostic lookup
		for (const type of registered.elementTypes) {
			// Convert to canonical form - extractors specify QTI 2.x names (e.g., 'choiceInteraction')
			// but we store them in canonical form (e.g., 'choiceinteraction') for QTI version independence
			const canonicalType = this.qti2xMapper.toCanonical(type);

			let extractors = this.extractorsByType.get(canonicalType);
			if (!extractors) {
				extractors = [];
				this.extractorsByType.set(canonicalType, extractors);
			}

			extractors.push(registered);

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
		this.assertMutable();
		const extractor = this.extractorsById.get(id);
		if (!extractor) return false;

		// Remove from ID map
		this.extractorsById.delete(id);

		// Remove from type maps (using canonical form)
		for (const type of extractor.elementTypes) {
			const canonicalType = this.qti2xMapper.toCanonical(type);
			const extractors = this.extractorsByType.get(canonicalType);
			if (extractors) {
				const index = extractors.findIndex((e) => e.id === id);
				if (index !== -1) {
					extractors.splice(index, 1);
				}
				// Clean up empty arrays
				if (extractors.length === 0) {
					this.extractorsByType.delete(canonicalType);
				}
			}
		}

		return true;
	}

	/**
	 * Find an extractor that can handle the given element
	 * Uses type-based indexing and evaluates the caller's extraction context.
	 *
	 * @param element - The element to find an extractor for
	 * @param context - Extraction context
	 * @returns The matching extractor, or null if none found
	 */
	findExtractor(
		element: QTIElement,
		context: ExtractionContext
	): ElementExtractor<any, string> | null {
		// Get element type - normalize using mapper for QTI version handling
		// Extractors are registered in canonical (lowercase) form for version independence.
		// Convert any QTI version element name to canonical form for lookup.
		//
		// Example for QTI 3.0:
		//   'qti-choice-interaction' → 'choiceinteraction' (canonical)
		// Example for QTI 2.x:
		//   'choiceInteraction' → 'choiceinteraction' (canonical)
		let lookupKey = element.rawTagName || '';
		if (lookupKey && this.elementNameMapper) {
			// Convert element's raw tag to canonical form using the document's mapper
			lookupKey = this.elementNameMapper.toCanonical(lookupKey);
		}

		// Get extractors for this element type (O(1) map lookup)
		const extractors = this.extractorsByType.get(lookupKey);
		if (!extractors || extractors.length === 0) {
			return null;
		}

		// Evaluate canHandle in priority order (O(M) where M = extractors for this type)
		for (const extractor of extractors) {
			try {
				const canHandle = extractor.canHandle(element, context);
				if (canHandle) {
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
	extract<TData extends object>(
		element: QTIElement,
		context: ExtractionContext
	): ExtractionDispatchResult<TData> {
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
					return {
						success: true,
						data,
						extractor,
						warnings: validation.warnings,
					};
				}
			}

			return { success: true, data, extractor };
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
	getExtractors(): ReadonlyArray<ElementExtractor<any, string>> {
		const all = Array.from(this.extractorsById.values());
		all.sort((a, b) => b.priority - a.priority);
		return all;
	}

	/**
	 * Get extractors for a specific element type
	 * @param elementType - The element type (e.g., 'choiceInteraction')
	 * @returns Read-only array of extractors for this type, sorted by priority
	 */
	getExtractorsForType(elementType: string): ReadonlyArray<ElementExtractor<any, string>> {
		// Convert to canonical form for lookup
		const canonicalType = this.qti2xMapper.toCanonical(elementType);
		return Object.freeze([...(this.extractorsByType.get(canonicalType) ?? [])]);
	}

	/**
	 * Register additional plugin-owned sink policy for an interaction kind.
	 *
	 * The framework's authored schema is stored separately and remains authoritative
	 * when both schemas classify the same output path.
	 */
	registerDeliveryFields(
		elementType: string,
		fields: readonly InteractionDeliveryField[],
	): void {
		this.assertMutable();
		const canonicalType = this.qti2xMapper.toCanonical(elementType);
		const existing = this.deliveryFieldsByType.get(canonicalType) ?? [];
		this.deliveryFieldsByType.set(
			canonicalType,
			snapshotDeliveryFields([...existing, ...fields]),
		);
	}

	[REGISTER_FRAMEWORK_DELIVERY_FIELDS](
		elementType: string,
		fields: readonly InteractionDeliveryField[],
	): void {
		this.assertMutable();
		const canonicalType = this.qti2xMapper.toCanonical(elementType);
		const existing = this.frameworkDeliveryFieldsByType.get(canonicalType) ?? [];
		this.frameworkDeliveryFieldsByType.set(
			canonicalType,
			snapshotDeliveryFields([...existing, ...fields]),
		);
	}

	/** Return the immutable sink policy compiled for an authored interaction kind. */
	getDeliveryFieldsForType(elementType: string): readonly InteractionDeliveryField[] {
		const canonicalType = this.qti2xMapper.toCanonical(elementType);
		return mergeDeliveryFields(
			this.deliveryFieldsByType.get(canonicalType) ?? EMPTY_DELIVERY_FIELDS,
			this.frameworkDeliveryFieldsByType.get(canonicalType) ?? EMPTY_DELIVERY_FIELDS,
		);
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
		this.assertMutable();
		this.extractorsById.clear();
		this.extractorsByType.clear();
		this.deliveryFieldsByType.clear();
		this.frameworkDeliveryFieldsByType.clear();
	}

	/**
	 * Clone this registry with all extractors
	 * @returns New registry with same extractors
	 */
	clone(): ExtractionRegistry {
		const cloned = new ExtractionRegistry(this.elementNameMapper);
		for (const extractor of this.extractorsById.values()) {
			cloned.register(extractor);
		}
		for (const [elementType, fields] of this.deliveryFieldsByType) {
			cloned.deliveryFieldsByType.set(elementType, snapshotDeliveryFields(fields));
		}
		for (const [elementType, fields] of this.frameworkDeliveryFieldsByType) {
			cloned.frameworkDeliveryFieldsByType.set(
				elementType,
				snapshotDeliveryFields(fields),
			);
		}
		return cloned;
	}

	/**
	 * Freeze the definition set used by a compiled AssessmentItem. Lookups and
	 * extraction remain available; registration changes require a new definition.
	 */
	seal(): this {
		this.sealed = true;
		return this;
	}

	isSealed(): boolean {
		return this.sealed;
	}

	private assertMutable(): void {
		if (this.sealed) {
			throw new Error(
				'ExtractionRegistry is sealed for this AssessmentItem; create a new definition to change InteractionModules'
			);
		}
	}
}

const EMPTY_DELIVERY_FIELDS = Object.freeze([]) as readonly InteractionDeliveryField[];

/**
 * Create a new extraction registry
 * @param elementNameMapper - Optional element name mapper for QTI version handling
 * @returns Empty registry ready for extractor registration
 */
export function createExtractionRegistry(elementNameMapper?: ElementNameMapper): ExtractionRegistry {
	return new ExtractionRegistry(elementNameMapper);
}

/**
 * Register immutable framework-owned policy without exposing that capability at
 * the public plugin seam.
 *
 * @internal
 */
export function registerFrameworkDeliveryFields(
	registry: ExtractionRegistry,
	elementType: string,
	fields: readonly InteractionDeliveryField[],
): void {
	registry[REGISTER_FRAMEWORK_DELIVERY_FIELDS](elementType, fields);
}

function snapshotExtractor<
	TPayload extends object,
	TOutputType extends string,
	TContext extends ExtractionContext,
>(
	extractor: ElementExtractor<TPayload, TOutputType, TContext>,
): ElementExtractor<any, string> {
	const delivery = extractor.delivery
		? Object.freeze({
				fields: snapshotDeliveryFields(extractor.delivery.fields),
			})
		: undefined;

	return Object.freeze({
		id: extractor.id,
		name: extractor.name,
		priority: extractor.priority,
		elementTypes: Object.freeze([...extractor.elementTypes]) as unknown as string[],
		...(extractor.description ? { description: extractor.description } : {}),
		...(extractor.outputType ? { outputType: extractor.outputType } : {}),
		...(delivery ? { delivery } : {}),
		canHandle: extractor.canHandle.bind(extractor) as ElementExtractor<any, string>['canHandle'],
		extract: extractor.extract.bind(extractor) as ElementExtractor<any, string>['extract'],
		...(extractor.validate
			? {
					validate: extractor.validate.bind(extractor) as NonNullable<
						ElementExtractor<any, string>['validate']
					>,
				}
			: {}),
	});
}

function snapshotDeliveryFields(
	fields: readonly InteractionDeliveryField[],
): readonly InteractionDeliveryField[] {
	return Object.freeze(
		fields.map((field) =>
			Object.freeze({ ...field, path: Object.freeze([...field.path]) }),
		),
	);
}

function mergeDeliveryFields(
	extensions: readonly InteractionDeliveryField[],
	framework: readonly InteractionDeliveryField[],
): readonly InteractionDeliveryField[] {
	if (extensions.length === 0 && framework.length === 0) return EMPTY_DELIVERY_FIELDS;

	const fieldsByPath = new Map<string, InteractionDeliveryField>();
	for (const field of [...extensions, ...framework]) {
		// One output path has one sink meaning. Framework-authored meaning is applied
		// last so a plugin can add new paths but cannot relabel a standard one.
		fieldsByPath.set(JSON.stringify(field.path), field);
	}
	return snapshotDeliveryFields([...fieldsByPath.values()]);
}
