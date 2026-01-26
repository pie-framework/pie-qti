import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import { sanitizeHtml } from '../../src/core/sanitizer.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

function minimalItemXml(body = '<itemBody><p>ok</p></itemBody>'): string {
	return `<?xml version="1.0"?>
<assessmentItem ${NS} identifier="dos-test" title="DoS Test" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier" />
  ${body}
</assessmentItem>`;
}

describe('DoS parsing limits (opt-in)', () => {
	test('by default, does not reject <!DOCTYPE> (compat)', () => {
		const xml = `<?xml version="1.0"?>
<!DOCTYPE assessmentItem>
${minimalItemXml()}`;
		expect(() => new Player({ itemXml: xml })).not.toThrow();
	});

	test('when enabled, rejects <!DOCTYPE> early', () => {
		const xml = `<?xml version="1.0"?>
<!DOCTYPE assessmentItem>
${minimalItemXml()}`;
		expect(
			() =>
				new Player({
					itemXml: xml,
					security: { parsingLimits: { enabled: true } },
				})
		).toThrow();
	});

	test('when enabled, enforces maxItemXmlBytes', () => {
		const xml = minimalItemXml();
		expect(
			() =>
				new Player({
					itemXml: xml,
					security: { parsingLimits: { enabled: true, maxItemXmlBytes: 1 } },
				})
		).toThrow();
	});

	test('when enabled, sanitizeHtml enforces maxHtmlBytes (fails closed)', () => {
		const large = `<p>${'x'.repeat(10_000)}</p>`;
		const out = sanitizeHtml(large, {
			security: { parsingLimits: { enabled: true, maxHtmlBytes: 10 } },
		});
		expect(out).toBe('');
	});
});


