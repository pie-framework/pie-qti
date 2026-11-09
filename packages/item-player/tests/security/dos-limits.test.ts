import { describe, expect, test } from 'bun:test';
import { Qti2xAttributeNameMapper, Qti2xElementNameMapper } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';
import { normalizeParsingLimits } from '../../src/core/parsingLimits.js';
import { sanitizeHtml } from '../../src/core/sanitizer.js';
import { parseAssessmentItemDocument } from '../../src/document/AssessmentItemDocument.js';
import { createAssessmentItemDefinition as createServerDefinition } from '../../src/server.js';
import type { PlayerSecurityConfig } from '../../src/types/index.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

function assessmentItemXml(body = '<itemBody><p>ok</p></itemBody>'): string {
	return `<assessmentItem ${NS} identifier="dos-test" title="DoS Test" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier" />
  ${body}
</assessmentItem>`;
}

function minimalItemXml(body?: string): string {
	return `<?xml version="1.0"?>
${assessmentItemXml(body)}`;
}

function doctypeItemXml(): string {
	return `<?xml version="1.0"?>
<!DOCTYPE assessmentItem>
${assessmentItemXml()}`;
}

/**
 * An item just over the default 10 MB `maxItemXmlBytes`. The padding precedes the XML declaration,
 * so should the limit ever stop applying the parse fails at once and the test fails on the error
 * message, instead of the runner parsing 10 MB of markup.
 */
function oversizedItemXml(): string {
	return `${' '.repeat(10_000_000)}${minimalItemXml()}`;
}

const LIMITS_OFF = { parsingLimits: { enabled: false } };

function parseDocument(itemXml: string, security?: PlayerSecurityConfig) {
	return parseAssessmentItemDocument({
		itemXml,
		elementNameMapper: new Qti2xElementNameMapper(),
		attributeNameMapper: new Qti2xAttributeNameMapper(),
		...(security ? { security } : {}),
	});
}

describe('DoS parsing limits (on unless parsingLimits.enabled is false)', () => {
	test('with no security config, the player rejects <!DOCTYPE> early', () => {
		expect(() => new Player({ itemXml: doctypeItemXml() })).toThrow(/DOCTYPE/);
	});

	test('with no security config, the player enforces the default maxItemXmlBytes', () => {
		expect(normalizeParsingLimits().maxItemXmlBytes).toBe(10_000_000);
		expect(() => new Player({ itemXml: oversizedItemXml() })).toThrow(/maxItemXmlBytes/);
	});

	test('with no security config, the item document and the server entry reject <!DOCTYPE>', () => {
		expect(() => parseDocument(doctypeItemXml())).toThrow(/DOCTYPE/);
		expect(() => createServerDefinition({ itemXml: doctypeItemXml() })).toThrow(/DOCTYPE/);
	});

	test('with no security config, sanitizeHtml enforces the default maxHtmlBytes (fails closed)', () => {
		// Whitespace padding, so the HTML still sanitizes quickly should the limit stop applying.
		expect(sanitizeHtml(`<p>${' '.repeat(5_000_001)}</p>`)).toBe('');
	});

	test('a configured limit applies without setting enabled', () => {
		expect(
			() => new Player({ itemXml: minimalItemXml(), security: { parsingLimits: { maxItemXmlBytes: 1 } } })
		).toThrow(/maxItemXmlBytes/);
		const out = sanitizeHtml(`<p>${'x'.repeat(10_000)}</p>`, {
			security: { parsingLimits: { maxHtmlBytes: 10 } },
		});
		expect(out).toBe('');
	});

	test('enabled: true keeps the limits on', () => {
		expect(
			() => new Player({ itemXml: doctypeItemXml(), security: { parsingLimits: { enabled: true } } })
		).toThrow(/DOCTYPE/);
	});

	test('enabled: false opts out of every limit at every layer', () => {
		expect(() => new Player({ itemXml: doctypeItemXml(), security: LIMITS_OFF })).not.toThrow();
		expect(
			() =>
				new Player({
					itemXml: minimalItemXml(),
					security: { parsingLimits: { enabled: false, maxItemXmlBytes: 1 } },
				})
		).not.toThrow();
		expect(() => parseDocument(doctypeItemXml(), LIMITS_OFF)).not.toThrow();
		expect(() => createServerDefinition({ itemXml: doctypeItemXml(), security: LIMITS_OFF })).not.toThrow();
		const out = sanitizeHtml(`<p>${'x'.repeat(100)}</p>`, {
			security: { parsingLimits: { enabled: false, maxHtmlBytes: 10 } },
		});
		expect(out).toContain('xxx');
	});
});
