import { describe, expect, test } from 'bun:test';
import { parseAssessmentTestXml } from '../src/qti/parseAssessmentTest.js';
import { resolveItemsForAssessment } from '../src/qti/resolveItems.js';

const ITEM_1_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="ITEM-1" title="Item 1">
  <itemBody>
    <p>Hello</p>
  </itemBody>
</assessmentItem>`;

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

		expect(section?.questionRefs?.length).toBe(1);
		expect(section?.questionRefs?.[0]?.identifier).toBe('ITEM-1');
		expect(section?.questionRefs?.[0]?.href).toBe('items/item1.xml');
		expect(section?.questionRefs?.[0]?.title).toBe('Item 1');
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

		const q = assessment.testParts?.[0]?.sections?.[0]?.questionRefs?.[0];
		expect(q?.itemXml).toContain('assessmentItem');
		expect(q?.itemXml).toContain('identifier="ITEM-1"');
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

		const origFetch = globalThis.fetch;
		const calls: string[] = [];
		(globalThis as any).fetch = async (url: string) => {
			calls.push(url);
			return new Response(ITEM_1_XML, { status: 200 });
		};

		try {
			await resolveItemsForAssessment({
				assessment,
				itemBaseUrl: 'https://example.test/qti/',
			});
		} finally {
			(globalThis as any).fetch = origFetch;
		}

		expect(calls.length).toBe(1);
		expect(calls[0]).toBe('https://example.test/qti/items/item1.xml');
		const q = assessment.testParts?.[0]?.sections?.[0]?.questionRefs?.[0];
		expect(q?.itemXml).toContain('assessmentItem');
	});
});


