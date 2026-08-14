import type { AssessmentItemDocument } from '../document/AssessmentItemDocument.js';
import type { ExtractionRegistry } from './ExtractionRegistry.js';
import { createExtractionContext } from './createContext.js';
import { finalizeInteractionDelivery } from './interactionSecurity.js';
import type { VariableDeclaration as ExtractionVariableDeclaration } from './types.js';
import type { DeclarationMap } from '@pie-qti/qti-processing';
import type { ExtractionConfig } from './types.js';
import type {
	BaseInteractionData,
	DeliveredInteraction,
} from '../interactions/shared/types.js';

export interface InteractionExtractionPipelineInput {
	document: AssessmentItemDocument;
	extractionRegistry: ExtractionRegistry;
	declarations: DeclarationMap;
	config: ExtractionConfig;
	/**
	 * Item session GUID, used to seed `shuffle` for the interactions that support it.
	 * Omit to keep the authored order.
	 */
	sessionGuid?: string;
}

export function extractInteractionData({
	document,
	extractionRegistry,
	declarations,
	config,
	sessionGuid,
}: InteractionExtractionPipelineInput): readonly BaseInteractionData[] {
	const declMap = projectDeclarationsForExtraction(declarations);
	const elements = document.findExtractionElements(getRegisteredElementTypes(extractionRegistry));

	const interactions: BaseInteractionData[] = [];
	for (const discovered of elements) {
		const context = createExtractionContext(
			discovered.element,
			discovered.responseIdentifier,
			discovered.contextRoot,
			declMap,
			config,
			sessionGuid
		);
		const result = extractionRegistry.extract<Record<string, unknown>>(
			discovered.element,
			context
		);
		if (!result.success) throw result.error;

		const extractor = result.extractor;
		const outputType = extractor?.outputType ?? discovered.normalizedType;
		const interaction = {
			...result.data,
			// These are framework-owned routing fields. Applying them after the
			// extractor payload prevents a plugin from redirecting a response or
			// selecting an undeclared renderer through payload properties.
			type: outputType,
			responseId: discovered.responseIdentifier,
		} satisfies DeliveredInteraction<string, Record<string, unknown>>;
		// Sink policy follows the authored interaction kind, while outputType only
		// selects a renderer. A plugin replacing a standard extractor must not be
		// able to shed the standard prompt/choice/URL policy by renaming its output.
		const standardFields = extractionRegistry.getDeliveryFieldsForType(
			discovered.normalizedType,
		);
		const extractorFields = extractor.delivery?.fields ?? [];
		interactions.push(
			finalizeInteractionDelivery(
				interaction,
				mergeDeliveryFields(standardFields, extractorFields),
				config.security,
				discovered.normalizedType,
			)
		);
	}

	return Object.freeze(interactions);
}

function mergeDeliveryFields<T extends { kind: string; path: readonly (string | '*')[] }>(
	standard: readonly T[],
	extension: readonly T[]
): T[] {
	const fields = new Map<string, T>();
	for (const field of [...extension, ...standard]) {
		// An output path has one sink meaning. Authored standard policy is
		// authoritative even when a plugin tries to change the field kind itself.
		fields.set(JSON.stringify(field.path), field);
	}
	return [...fields.values()];
}

function getRegisteredElementTypes(extractionRegistry: ExtractionRegistry): string[] {
	const elementTypes = new Set<string>();
	for (const extractor of extractionRegistry.getExtractors()) {
		for (const elementType of extractor.elementTypes) {
			elementTypes.add(elementType);
		}
	}
	return [...elementTypes];
}

function projectDeclarationsForExtraction(
	declarations: DeclarationMap
): Map<string, ExtractionVariableDeclaration> {
	const declMap = new Map<string, ExtractionVariableDeclaration>();
	for (const declaration of Object.values(declarations)) {
		declMap.set(declaration.identifier, {
			identifier: declaration.identifier,
			cardinality: declaration.cardinality as any,
			baseType: declaration.baseType,
		});
	}
	return declMap;
}
