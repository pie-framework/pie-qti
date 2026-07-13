import type { AssessmentItemDocument } from '../document/AssessmentItemDocument.js';
import type { ExtractionRegistry } from './ExtractionRegistry.js';
import { createExtractionContext } from './createContext.js';
import { applyInteractionSecurity } from './interactionSecurity.js';
import type { VariableDeclaration as ExtractionVariableDeclaration } from './types.js';
import type { DeclarationMap } from '@pie-qti/qti-processing';
import type { PlayerConfig } from '../types/index.js';
import type { InteractionData } from '../interactions/index.js';

export interface InteractionExtractionPipelineInput {
	document: AssessmentItemDocument;
	extractionRegistry: ExtractionRegistry;
	declarations: DeclarationMap;
	config: PlayerConfig;
}

export function extractInteractionData({
	document,
	extractionRegistry,
	declarations,
	config,
}: InteractionExtractionPipelineInput): InteractionData[] {
	const declMap = projectDeclarationsForExtraction(declarations);
	const elements = document.findExtractionElements(getRegisteredElementTypes(extractionRegistry));

	const interactions: InteractionData[] = [];
	for (const discovered of elements) {
		const context = createExtractionContext(
			discovered.element,
			discovered.responseIdentifier,
			discovered.contextRoot,
			declMap,
			config
		);
		const result = extractionRegistry.extract<any>(discovered.element, context);
		if (!result.success) continue;

		interactions.push({
			// A QTI 2.x portableCustomInteraction is nested in customInteraction. Its
			// extractor supplies the canonical renderer type so it does not hit the
			// generic unsupported-custom fallback.
			type: (result.data?.type ?? discovered.normalizedType) as any,
			responseId: discovered.responseIdentifier,
			...result.data,
		});
	}

	return applyInteractionSecurity(interactions, config.security);
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
