/**
 * Shared test utilities for QTI transformation tests
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type HTMLElement, parse } from 'node-html-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse QTI XML and return the assessmentItem element
 * Handles the standard QTI parsing configuration
 *
 * @param qtiXml - XML string to parse
 * @returns Parsed assessmentItem element
 */
export function parseQtiItem(qtiXml: string): HTMLElement {
	const doc = parse(qtiXml, {
		lowerCaseTagName: false,
		comment: false,
	});

	const itemElement = doc.querySelector('assessmentItem') || doc.getElementsByTagName('assessmentItem')[0];

	if (!itemElement) {
		throw new Error('No assessmentItem element found in QTI XML');
	}

	return itemElement as HTMLElement;
}

/**
 * Create a basic QTI assessmentItem wrapper with standard attributes
 *
 * @param content - Inner XML content (responseDeclarations, itemBody, etc.)
 * @param identifier - Item identifier (default: 'test-item')
 * @param title - Item title (default: 'Test Item')
 * @returns Complete QTI XML string
 */
export function createQtiWrapper(
	content: string,
	identifier: string = 'test-item',
	title: string = 'Test Item'
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
 * @param identifier - Response identifier
 * @param cardinality - Response cardinality (single, multiple, ordered)
 * @param correctValues - Array of correct response values
 * @param baseType - Base type (default: 'identifier')
 * @returns responseDeclaration XML string
 */
export function createResponseDeclaration(
	identifier: string,
	cardinality: 'single' | 'multiple' | 'ordered',
	correctValues: string[],
	baseType: string = 'identifier'
): string {
	const correctResponseXml = correctValues.map((value) => `<value>${value}</value>`).join('\n        ');

	return `
  <responseDeclaration identifier="${identifier}" cardinality="${cardinality}" baseType="${baseType}">
    <correctResponse>
      ${correctResponseXml}
    </correctResponse>
  </responseDeclaration>`;
}

/**
 * Load a QTI XML fixture file from the fixtures directory
 *
 * @param fixtureName - Name of the fixture file (with or without .xml extension)
 * @returns QTI XML string
 */
export function loadFixture(fixtureName: string): string {
	const fileName = fixtureName.endsWith('.xml') ? fixtureName : `${fixtureName}.xml`;
	const fixturePath = join(__dirname, 'fixtures', fileName);
	return readFileSync(fixturePath, 'utf-8');
}

/**
 * Test logger that outputs to console for debugging
 * Use in tests where you need visible logging
 */
export class TestLogger {
	debug(msg: string) {
		console.log(`[DEBUG] ${msg}`);
	}

	info(msg: string) {
		console.log(`[INFO] ${msg}`);
	}

	warn(msg: string) {
		console.warn(`[WARN] ${msg}`);
	}

	error(msg: string) {
		console.error(`[ERROR] ${msg}`);
	}
}

/**
 * Silent logger for tests that don't need output
 * Use this as the default to keep test output clean
 */
export class SilentTestLogger {
	debug(_msg: string) {}
	info(_msg: string) {}
	warn(_msg: string) {}
	error(_msg: string) {}
}
