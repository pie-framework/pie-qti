import { afterEach, describe, expect, it } from 'bun:test';
import { DOMParser as XmldomDOMParser } from '@xmldom/xmldom';
import { detectQtiVersion, detectQtiVersionDetailed } from '../detectQtiVersion.js';

const QTI22 = 'http://www.imsglobal.org/xsd/imsqti_v2p2';
const QTI30 = 'http://www.imsglobal.org/xsd/imsqtiasi_v3p0';

const cases: Array<{
	name: string;
	xml: string;
	version: string;
	basis: string;
	confidence: string;
	warning?: RegExp;
}> = [
	{
		name: 'the QTI 2.2 namespace on the root',
		xml: `<assessmentItem xmlns="${QTI22}" identifier="i"><itemBody/></assessmentItem>`,
		version: '2.2',
		basis: 'namespace',
		confidence: 'high',
	},
	{
		name: 'the QTI 3.0 namespace on the root',
		xml: `<?xml version="1.0"?>\n<!-- authored -->\n<qti-assessment-item xmlns="${QTI30}" identifier="i"/>`,
		version: '3.0',
		basis: 'namespace',
		confidence: 'high',
	},
	{
		name: 'an unversioned camelCase root',
		xml: '<assessmentItem identifier="i"><itemBody/></assessmentItem>',
		version: '2.2',
		basis: 'default',
		confidence: 'low',
		warning: /declares no QTI namespace; assuming QTI 2\.2/,
	},
	{
		name: 'a camelCase root in an unknown namespace',
		xml: '<assessmentItem xmlns="http://example.org/vendor" identifier="i"/>',
		version: '2.2',
		basis: 'default',
		confidence: 'low',
		warning: /namespace "http:\/\/example\.org\/vendor", which is not a QTI namespace; assuming QTI 2\.2/,
	},
	{
		name: 'a qti- root without a namespace',
		xml: '<qti-assessment-item identifier="i"><qti-item-body/></qti-assessment-item>',
		version: '3.0',
		basis: 'root-element',
		confidence: 'medium',
		warning: /not the QTI 3\.0 namespace/,
	},
	{
		name: 'a version attribute without a namespace',
		xml: '<assessmentItem identifier="i" version="2.1.0"/>',
		version: '2.1',
		basis: 'version-attribute',
		confidence: 'medium',
		warning: /version="2\.1\.0"/,
	},
	{
		name: 'a non-QTI root',
		xml: '<div><p>Some HTML</p></div>',
		version: 'unknown',
		basis: 'none',
		confidence: 'low',
		warning: /not a QTI assessmentItem or assessmentTest root/,
	},
];

describe('detectQtiVersionDetailed (string detection)', () => {
	for (const { name, xml, version, basis, confidence, warning } of cases) {
		it(`reports ${name}`, () => {
			const detection = detectQtiVersionDetailed(xml);
			expect(detection).toMatchObject({ version, basis, confidence });
			if (warning) expect(detection.warnings.join(' ')).toMatch(warning);
			else expect(detection.warnings).toEqual([]);
			// The plain API keeps returning the same version.
			expect(detectQtiVersion(xml)).toBe(version as never);
		});
	}

	it('reads a QTI namespace found outside the root with medium confidence', () => {
		const xml = `<?xml version="1.0"?>
			<!-- Some comment with imsqti_v2p2 namespace -->
			<assessmentItem><itemBody></itemBody></assessmentItem>`;
		const detection = detectQtiVersionDetailed(xml);
		expect(detection).toMatchObject({ version: '2.2', basis: 'namespace', confidence: 'medium' });
		expect(detection.warnings[0]).toMatch(/not the root element's namespace/);
	});

	it("prefers the root's namespace over another version's namespace elsewhere", () => {
		const xml = `<assessmentItem xmlns="${QTI22}" identifier="i">
			<responseProcessing template="https://purl.imsglobal.org/spec/qti/v3p0/rptemplates/match_correct"/>
		</assessmentItem>`;
		expect(detectQtiVersionDetailed(xml)).toMatchObject({ version: '2.2', confidence: 'high' });
	});

	it('flags a root namespace that only contains a version token', () => {
		const detection = detectQtiVersionDetailed('<assessmentItem xmlns="urn:vendor:imsqti_v2p1:extended"/>');
		expect(detection).toMatchObject({ version: '2.1', basis: 'namespace', confidence: 'medium' });
		expect(detection.warnings[0]).toMatch(/is not the QTI 2\.1 namespace/);
	});

	it('reads a prefixed root through its own prefix declaration', () => {
		const xml = `<qti:assessmentItem xmlns:qti="${QTI22}" identifier="i"/>`;
		expect(detectQtiVersionDetailed(xml)).toMatchObject({ version: '2.2', basis: 'namespace', confidence: 'high' });
	});
});

describe('detectQtiVersionDetailed (DOM detection)', () => {
	const original = (globalThis as { window?: unknown }).window;
	afterEach(() => {
		(globalThis as { window?: unknown }).window = original;
	});

	function withDomParser(): void {
		(globalThis as { window?: unknown }).window = {
			DOMParser: class {
				parseFromString(xml: string, type: string) {
					return new XmldomDOMParser({ onError: () => {} }).parseFromString(xml, type as 'text/xml');
				}
			},
		};
	}

	it('agrees with string detection on version, basis and confidence', () => {
		withDomParser();
		for (const { name, xml, version, basis, confidence } of cases.filter((c) => c.version !== 'unknown')) {
			expect({ name, ...detectQtiVersionDetailed(xml), warnings: undefined }).toMatchObject({
				name,
				version,
				basis,
				confidence,
			});
		}
	});
});
