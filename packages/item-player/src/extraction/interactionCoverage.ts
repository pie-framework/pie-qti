import { type ElementNameMapper, isQtiVocabularyElement } from '@pie-qti/qti-common';
import { childElements, getAttr } from '@pie-qti/qti-processing';
import type { ExtractionRegistry } from './ExtractionRegistry.js';

/**
 * An item body element that interaction extraction does not deliver, although it is meant to be
 * an interaction. Extraction discovers only elements of registered types that carry a
 * `responseIdentifier`; anything else is skipped without a trace.
 */
export interface UnextractableInteraction {
	/**
	 * `unregistered`: the element binds a response but no registered extractor handles its type.
	 * `missing-response-identifier`: a QTI interaction element without a `responseIdentifier`.
	 */
	readonly reason: 'unregistered' | 'missing-response-identifier';
	/** The element name as authored, e.g. `vendor:mathInteraction` or `qti-choice-interaction`. */
	readonly element: string;
	readonly responseIdentifier?: string;
}

export interface FindUnextractableInteractionsOptions {
	readonly extractionRegistry: ExtractionRegistry;
	/** The mapper extraction resolves element names with. */
	readonly elementNameMapper: ElementNameMapper;
}

/**
 * The elements of `itemBody` that `extractInteractionData` will skip: elements binding a response
 * that no registered extractor handles, and QTI interaction elements with no response binding.
 * Rubric blocks are skipped, as extraction skips them.
 *
 * `itemBody` is the item body of the parsed source document; element names are read as authored,
 * the way extraction reads them.
 */
export function findUnextractableInteractions(
	itemBody: Element,
	{ extractionRegistry, elementNameMapper }: FindUnextractableInteractionsOptions,
): UnextractableInteraction[] {
	const vocabulary = elementNameMapper.version === '3.0' ? '3.0' : '2.x';
	const qtiNamespace = itemBody.namespaceURI ?? null;
	const found: UnextractableInteraction[] = [];

	const visit = (element: Element): void => {
		const name = element.nodeName;
		const canonical = elementNameMapper.toCanonical(name);
		if (canonical === 'rubricblock') return;

		const responseIdentifier = getAttr(element, 'responseIdentifier')?.trim();
		if (responseIdentifier) {
			if (extractionRegistry.getExtractorsForType(canonical).length === 0) {
				found.push({ reason: 'unregistered', element: name, responseIdentifier });
			}
		} else if (
			(element.namespaceURI ?? null) === qtiNamespace &&
			canonical.endsWith('interaction') &&
			isQtiVocabularyElement(element.localName, vocabulary)
		) {
			found.push({ reason: 'missing-response-identifier', element: name });
		}

		for (const child of childElements(element)) visit(child);
	};

	for (const child of childElements(itemBody)) visit(child);
	return found;
}
