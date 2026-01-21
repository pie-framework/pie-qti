/**
 * QTI Test Helpers
 * Utilities for creating and parsing QTI XML in tests
 */

import { type HTMLElement, parse } from 'node-html-parser';

/**
 * Parse QTI XML and return the assessmentItem element
 * Handles the standard QTI parsing configuration
 *
 * @param qtiXml XML string to parse
 * @returns Parsed assessmentItem element
 *
 * @example
 * ```typescript
 * const qti = createQtiWrapper('<itemBody>...</itemBody>');
 * const element = parseQtiItem(qti);
 * ```
 */
export function parseQtiItem(qtiXml: string): HTMLElement {
	const doc = parse(qtiXml, {
		lowerCaseTagName: false,
		comment: false,
	});

	const itemElement =
		doc.querySelector('assessmentItem') ||
		doc.getElementsByTagName('assessmentItem')[0];

	if (!itemElement) {
		throw new Error('No assessmentItem element found in QTI XML');
	}

	return itemElement as HTMLElement;
}

/**
 * Create a basic QTI assessmentItem wrapper with standard attributes
 *
 * @param content Inner XML content (responseDeclarations, itemBody, etc.)
 * @param identifier Item identifier (default: 'test-item')
 * @param title Item title (default: 'Test Item')
 * @returns Complete QTI XML string
 *
 * @example
 * ```typescript
 * const qti = createQtiWrapper(`
 *   ${createResponseDeclaration('RESPONSE', 'single', ['A'])}
 *   <itemBody>
 *     <choiceInteraction responseIdentifier="RESPONSE">
 *       <simpleChoice identifier="A">Correct</simpleChoice>
 *     </choiceInteraction>
 *   </itemBody>
 * `);
 * ```
 */
export function createQtiWrapper(
	content: string,
	identifier = 'test-item',
	title = 'Test Item',
): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="${identifier}"
                title="${title}"
                adaptive="false"
                timeDependent="false">
  ${content}
</assessmentItem>`;
}

/**
 * Create a responseDeclaration element
 *
 * @param identifier Response identifier
 * @param cardinality Response cardinality (single, multiple, ordered)
 * @param correctValues Array of correct response values
 * @param baseType Base type (default: 'identifier')
 * @returns responseDeclaration XML string
 *
 * @example
 * ```typescript
 * const declaration = createResponseDeclaration('RESPONSE', 'single', ['choiceA']);
 * const qti = createQtiWrapper(declaration + '<itemBody>...</itemBody>');
 * ```
 */
export function createResponseDeclaration(
	identifier: string,
	cardinality: 'single' | 'multiple' | 'ordered',
	correctValues: string[],
	baseType = 'identifier',
): string {
	const correctResponseXml = correctValues
		.map((value) => `<value>${value}</value>`)
		.join('\n        ');

	return `
  <responseDeclaration identifier="${identifier}" cardinality="${cardinality}" baseType="${baseType}">
    <correctResponse>
      ${correctResponseXml}
    </correctResponse>
  </responseDeclaration>`;
}

/**
 * Create an outcomeDeclaration element
 *
 * @param identifier Outcome identifier
 * @param baseType Base type (e.g., 'float', 'integer', 'identifier')
 * @param defaultValue Optional default value
 * @returns outcomeDeclaration XML string
 *
 * @example
 * ```typescript
 * const declaration = createOutcomeDeclaration('SCORE', 'float', '0');
 * ```
 */
export function createOutcomeDeclaration(
	identifier: string,
	baseType: string,
	defaultValue?: string,
): string {
	const defaultValueXml = defaultValue
		? `\n    <defaultValue>\n      <value>${defaultValue}</value>\n    </defaultValue>`
		: '';

	return `
  <outcomeDeclaration identifier="${identifier}" cardinality="single" baseType="${baseType}">${defaultValueXml}
  </outcomeDeclaration>`;
}

/**
 * Create a simple choiceInteraction element
 *
 * @param responseId Response identifier
 * @param choices Array of choices [{id, text}, ...]
 * @param shuffle Whether to shuffle choices (default: false)
 * @returns choiceInteraction XML string
 *
 * @example
 * ```typescript
 * const interaction = createChoiceInteraction('RESPONSE', [
 *   { id: 'A', text: 'Choice A' },
 *   { id: 'B', text: 'Choice B' },
 * ]);
 * ```
 */
export function createChoiceInteraction(
	responseId: string,
	choices: Array<{ id: string; text: string }>,
	shuffle = false,
): string {
	const choicesXml = choices
		.map(
			(choice) =>
				`    <simpleChoice identifier="${choice.id}">${choice.text}</simpleChoice>`,
		)
		.join('\n');

	return `
  <itemBody>
    <choiceInteraction responseIdentifier="${responseId}" shuffle="${shuffle}" maxChoices="1">
      <prompt>Select the correct answer:</prompt>
${choicesXml}
    </choiceInteraction>
  </itemBody>`;
}

/**
 * Parse HTML element from XML string
 * General-purpose HTML/XML parser for test elements
 *
 * @param xml XML string to parse
 * @returns Parsed HTML element
 */
export function parseElement(xml: string): HTMLElement {
	const doc = parse(xml, {
		lowerCaseTagName: false,
		comment: false,
	});

	return doc.firstChild as HTMLElement;
}
