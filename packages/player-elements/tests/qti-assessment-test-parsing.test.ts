import { describe, expect, test } from 'bun:test';
import { parseAssessmentTestXml } from '../src/qti/parseAssessmentTest.js';
import { createAssessmentResourceResolver, resolveItemsForAssessment } from '../src/qti/resolveItems.js';

const ITEM_1_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ITEM-1" title="Item 1">
  <itemBody>
    <p>Hello</p>
  </itemBody>
</assessmentItem>`;

function assessmentWithNestedSections(depth: number): string {
	let sections = '<assessmentItemRef identifier="ITEM-1" href="items/item1.xml" />';
	for (let index = depth; index >= 1; index--) {
		sections = `<assessmentSection identifier="S${index}">${sections}</assessmentSection>`;
	}
	return `<assessmentTest identifier="TEST-DEPTH"><testPart identifier="P1">${sections}</testPart></assessmentTest>`;
}

describe('parseAssessmentTestXml', () => {
	test('parses a basic QTI assessmentTest with testPart/section/itemRef/rubricBlock', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="TEST-1" title="Sample Test">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1" title="Section 1">
      <rubricBlock view="candidate" use="passage">
        <p>Passage <strong>content</strong></p>
      </rubricBlock>
      <assessmentItemRef identifier="ITEM-1" href="items/item1.xml" title="Item 1" />
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		const parsed = parseAssessmentTestXml(xml);
		expect(parsed.identifier).toBe('TEST-1');
		expect(parsed.title).toBe('Sample Test');
		expect(parsed.testParts?.length).toBe(1);

		const part = parsed.testParts?.[0];
		expect(part?.identifier).toBe('P1');
		expect(part?.navigationMode).toBe('nonlinear');
		expect(part?.submissionMode).toBe('simultaneous');
		expect(part?.sections.length).toBe(1);

		const section = part?.sections[0];
		expect(section?.identifier).toBe('S1');
		expect(section?.title).toBe('Section 1');
		expect(section?.rubricBlocks?.length).toBe(1);
		expect(section?.rubricBlocks?.[0]?.use).toBe('passage');
		expect(section?.rubricBlocks?.[0]?.view).toEqual(['candidate']);
		expect(section?.rubricBlocks?.[0]?.content).toContain('<p>Passage');

		expect(section?.assessmentItemRefs?.length).toBe(1);
		expect(section?.assessmentItemRefs?.[0]?.identifier).toBe('ITEM-1');
		expect(section?.assessmentItemRefs?.[0]?.href).toBe('items/item1.xml');
		expect(section?.assessmentItemRefs?.[0]?.title).toBe('Item 1');
	});

	test('synthesizes a default testPart when assessmentTest has top-level sections only', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="TEST-2" title="No Parts">
  <assessmentSection identifier="S1" title="Section 1">
    <assessmentItemRef identifier="ITEM-1" href="items/item1.xml" />
  </assessmentSection>
</assessmentTest>`;

		const parsed = parseAssessmentTestXml(xml);
		expect(parsed.testParts?.length).toBe(1);
		expect(parsed.testParts?.[0]?.identifier).toBe('part-1');
		expect(parsed.testParts?.[0]?.sections.length).toBe(1);
	});

	test('bounds inline assessmentSection recursion by default and supports an explicit override', () => {
		expect(() => parseAssessmentTestXml(assessmentWithNestedSections(33))).toThrow(
			'assessmentSection nesting exceeds maxSectionDepth (32)',
		);

		expect(() =>
			parseAssessmentTestXml(assessmentWithNestedSections(33), { maxSectionDepth: 33 }),
		).not.toThrow();
	});
});

describe('resolveItemsForAssessment', () => {
	test('A) resolves assessmentItemRef via in-memory items map (by href)', async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="TEST-3" title="Map">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1">
      <assessmentItemRef identifier="ITEM-1" href="items/item1.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		const assessment = parseAssessmentTestXml(xml);
		await resolveItemsForAssessment({
			assessment,
			items: {
				'items/item1.xml': ITEM_1_XML,
			},
		});

		const q = assessment.testParts?.[0]?.sections?.[0]?.assessmentItemRefs?.[0];
		expect(q?.itemXml).toContain('assessmentItem');
		expect(q?.itemXml).toContain('identifier="ITEM-1"');
	});

	test('resolves the documented in-memory fallback by item identifier through the same budget', async () => {
		const assessment = parseAssessmentTestXml(`
<assessmentTest identifier="TEST" title="Test">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1">
      <assessmentItemRef identifier="ITEM-1" href="items/item1.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`);

		await resolveItemsForAssessment({ assessment, items: { 'ITEM-1': ITEM_1_XML } });

		expect(assessment.testParts?.[0]?.sections?.[0]?.assessmentItemRefs?.[0]?.itemXml).toBe(ITEM_1_XML);
	});

	test('B) resolves assessmentItemRef by fetching href relative to base URL', async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="TEST-4" title="Fetch">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1">
      <assessmentItemRef identifier="ITEM-1" href="items/item1.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`;

		const assessment = parseAssessmentTestXml(xml);

		const calls: string[] = [];
		const fetcher = async (url: string | URL | Request) => {
			calls.push(String(url));
			return new Response(ITEM_1_XML, { status: 200 });
		};

		await resolveItemsForAssessment({
			assessment,
			itemBaseUrl: 'https://example.test/qti/',
			fetch: fetcher as typeof globalThis.fetch,
		});

		expect(calls.length).toBe(1);
		expect(calls[0]).toBe('https://example.test/qti/items/item1.xml');
		const q = assessment.testParts?.[0]?.sections?.[0]?.assessmentItemRefs?.[0];
		expect(q?.itemXml).toContain('assessmentItem');
	});

	test('blocks item hrefs that escape itemBaseUrl before making a request', async () => {
		const assessment = parseAssessmentTestXml(`
<assessmentTest identifier="TEST" title="Test">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1">
      <assessmentItemRef identifier="ITEM-1" href="../private/item.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`);
		let called = false;

		await expect(
			resolveItemsForAssessment({
				assessment,
				itemBaseUrl: 'https://example.test/qti/public/',
				fetch: (async () => {
					called = true;
					return new Response(ITEM_1_XML);
				}) as typeof globalThis.fetch,
			}),
		).rejects.toThrow('escapes itemBaseUrl');
		expect(called).toBe(false);
	});

	test('blocks recursively encoded separators before base-path containment checks', async () => {
		let called = false;
		const resolver = createAssessmentResourceResolver({
			itemBaseUrl: 'https://example.test/qti/',
			fetch: (async () => {
				called = true;
				return new Response(ITEM_1_XML);
			}) as typeof globalThis.fetch,
		});

		await expect(resolver('..%2fadmin/secret.xml')).rejects.toThrow('unsafe encoded path token');
		await expect(resolver('..%252fadmin/secret.xml')).rejects.toThrow('unsafe encoded path token');
		expect(called).toBe(false);
	});

	test('blocks absolute cross-origin item hrefs by default', async () => {
		const assessment = parseAssessmentTestXml(`
<assessmentTest identifier="TEST" title="Test">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1">
      <assessmentItemRef identifier="ITEM-1" href="https://attacker.example/item.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`);

		await expect(
			resolveItemsForAssessment({
				assessment,
				itemBaseUrl: 'https://example.test/qti/',
				fetch: (async () => new Response(ITEM_1_XML)) as typeof globalThis.fetch,
			}),
		).rejects.toThrow('escapes itemBaseUrl');
	});

	test('enforces item count and response byte limits', async () => {
		const assessment = parseAssessmentTestXml(`
<assessmentTest identifier="TEST" title="Test">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1">
      <assessmentItemRef identifier="ITEM-1" href="item-1.xml" />
      <assessmentItemRef identifier="ITEM-2" href="item-2.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`);

		await expect(
			resolveItemsForAssessment({
				assessment,
				itemBaseUrl: 'https://example.test/qti/',
				fetchPolicy: { maxItems: 1 },
				fetch: (async () => new Response(ITEM_1_XML)) as typeof globalThis.fetch,
			}),
		).rejects.toThrow('too many remote QTI items');

		const oneItem = parseAssessmentTestXml(`
<assessmentTest identifier="TEST" title="Test">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1">
      <assessmentItemRef identifier="ITEM-1" href="item-1.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`);
		await expect(
			resolveItemsForAssessment({
				assessment: oneItem,
				itemBaseUrl: 'https://example.test/qti/',
				fetchPolicy: { maxItemBytes: 20 },
				fetch: (async () => new Response(ITEM_1_XML)) as typeof globalThis.fetch,
			}),
		).rejects.toThrow('exceeds maxItemBytes');
	});

	test('enforces one cumulative byte budget across supplied resources', async () => {
		const assessment = parseAssessmentTestXml(`
<assessmentTest identifier="TEST" title="Test">
  <testPart identifier="P1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="S1">
      <assessmentItemRef identifier="ITEM-1" href="item-1.xml" />
      <assessmentItemRef identifier="ITEM-2" href="item-2.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`);

		await expect(
			resolveItemsForAssessment({
				assessment,
				items: { 'item-1.xml': '123456', 'item-2.xml': 'abcdef' },
				fetchPolicy: { maxItemBytes: 10, maxTotalBytes: 10 },
			}),
		).rejects.toThrow('exceed maxTotalBytes');
	});

	test('canonicalizes equivalent URLs before caching and applies resolver concurrency', async () => {
		let calls = 0;
		let active = 0;
		let maxActive = 0;
		const resolver = createAssessmentResourceResolver({
			itemBaseUrl: 'https://example.test/qti/',
			fetchPolicy: { concurrency: 1 },
			fetch: (async () => {
				calls++;
				active++;
				maxActive = Math.max(maxActive, active);
				await Promise.resolve();
				active--;
				return new Response(ITEM_1_XML);
			}) as typeof globalThis.fetch,
		});

		const [first, alias, other] = await Promise.all([
			resolver('items/item1.xml'),
			resolver('items/./item1.xml'),
			resolver('items/item2.xml'),
		]);

		expect(first).toBe(ITEM_1_XML);
		expect(alias).toBe(ITEM_1_XML);
		expect(other).toBe(ITEM_1_XML);
		expect(calls).toBe(2);
		expect(maxActive).toBe(1);
	});

	test('rejects a disallowed itemBaseUrl before fetching relative resources', async () => {
		let called = false;
		const resolver = createAssessmentResourceResolver({
			itemBaseUrl: 'https://untrusted.example/qti/',
			security: { urlPolicy: { allowedHosts: ['trusted.example'] } },
			fetch: (async () => {
				called = true;
				return new Response(ITEM_1_XML);
			}) as typeof globalThis.fetch,
		});

		await expect(resolver('item.xml')).rejects.toThrow('security policy');
		expect(called).toBe(false);
	});
});
