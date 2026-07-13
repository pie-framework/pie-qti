import './setup';
import { describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const ITEM_XML = `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item" title="Item"><itemBody><p>Item</p></itemBody></assessmentItem>`;

describe('assessment XML ingestion', () => {
	test('resolves external sections and their item hrefs relative to the section file', async () => {
		const resources: Record<string, string> = {
			'sections/math.xml': `
<assessmentSection identifier="external" title="External section" visible="true">
  <assessmentItemRef identifier="item-1" href="../items/item-1.xml" />
</assessmentSection>`,
			'items/item-1.xml': ITEM_XML.replace('identifier="item"', 'identifier="item-1"'),
		};
		const requested: string[] = [];
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(`
<assessmentTest identifier="test" title="External section test">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSectionRef identifier="external-ref" href="sections/math.xml" />
  </testPart>
</assessmentTest>`, {
			fileResolver: async (href) => {
				requested.push(href);
				const value = resources[href];
				if (!value) throw new Error(`Missing ${href}`);
				return value;
			},
		});

		expect(requested).toEqual(['sections/math.xml', 'items/item-1.xml']);
		expect(assessment.testParts[0].sections[0]).toMatchObject({
			identifier: 'external',
			title: 'External section',
		});
		expect(assessment.testParts[0].sections[0].assessmentItemRefs[0].itemXml).toContain(
			'identifier="item-1"',
		);
	});

	test('rejects cyclic external section references before loading the same resource twice', async () => {
		const resources: Record<string, string> = {
			'sections/a.xml': `<assessmentSection identifier="a" visible="true">
  <assessmentSectionRef href="b.xml" />
</assessmentSection>`,
			'sections/b.xml': `<assessmentSection identifier="b" visible="true">
  <assessmentSectionRef href="a.xml" />
</assessmentSection>`,
		};
		const requested: string[] = [];

		expect(
			ReferenceBackendAdapter.parseAssessmentTestXml(`
<assessmentTest identifier="test" title="Cycle">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSectionRef href="sections/a.xml" />
  </testPart>
</assessmentTest>`, {
				fileResolver: async (href) => {
					requested.push(href);
					const value = resources[href];
					if (!value) throw new Error(`Missing ${href}`);
					return value;
				},
			}),
		).rejects.toThrow('Cyclic assessmentSectionRef detected');
		expect(requested).toEqual(['sections/a.xml', 'sections/b.xml']);
	});

	test('bounds nested external section expansion', async () => {
		const requested: string[] = [];

		expect(
			ReferenceBackendAdapter.parseAssessmentTestXml(`
<assessmentTest identifier="test" title="Depth">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSectionRef href="sections/a.xml" />
  </testPart>
</assessmentTest>`, {
				sectionReferenceLimits: { maxDepth: 1 },
				fileResolver: async (href) => {
					requested.push(href);
					return `<assessmentSection identifier="a" visible="true"><assessmentSectionRef href="b.xml" /></assessmentSection>`;
				},
			}),
		).rejects.toThrow('assessmentSectionRef nesting exceeds maxDepth (1)');
		expect(requested).toEqual(['sections/a.xml']);
	});

	test('applies the section depth budget to inline assessmentSection nesting', async () => {
		expect(
			ReferenceBackendAdapter.parseAssessmentTestXml(`
<assessmentTest identifier="test" title="Depth">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="outer">
      <assessmentSection identifier="inner" />
    </assessmentSection>
  </testPart>
</assessmentTest>`, {
				sectionReferenceLimits: { maxDepth: 1 },
			}),
		).rejects.toThrow('assessmentSection nesting exceeds maxDepth (1)');
	});

	test('preserves scoped modes, ordered nested sections, selection, ordering, rules, weights, and feedback', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(`
<assessmentTest identifier="test" title="Structured test">
  <outcomeDeclaration identifier="PASS" cardinality="single" baseType="identifier" />
  <testPart identifier="part-1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="root" visible="true" required="true" fixed="false">
      <preCondition><baseValue baseType="boolean">true</baseValue></preCondition>
      <selection select="1" withReplacement="false" />
      <ordering shuffle="true" />
      <assessmentItemRef identifier="item-1" href="item-1.xml" required="true" fixed="true">
        <preCondition><baseValue baseType="boolean">true</baseValue></preCondition>
        <branchRule target="item-2"><baseValue baseType="boolean">true</baseValue></branchRule>
        <weight identifier="SCORE" value="2.5" />
      </assessmentItemRef>
      <assessmentSection identifier="nested" visible="true">
        <assessmentItemRef identifier="item-2" href="item-2.xml" />
      </assessmentSection>
    </assessmentSection>
  </testPart>
  <testFeedback identifier="passed" outcomeIdentifier="PASS" showHide="show" access="atEnd">
    <p>Passed</p>
  </testFeedback>
</assessmentTest>`, {
			itemXmlMap: {
				'item-1.xml': ITEM_XML.replace('identifier="item"', 'identifier="item-1"'),
				'item-2.xml': ITEM_XML.replace('identifier="item"', 'identifier="item-2"'),
			},
		});

		const part = assessment.testParts[0];
		const root = part.sections[0];
		const item = root.assessmentItemRefs[0];
		expect(part.navigationMode).toBe('linear');
		expect(part.submissionMode).toBe('individual');
		expect(root.required).toBe(true);
		expect(root.fixed).toBe(false);
		expect(root.selection).toEqual({ select: 1, withReplacement: false });
		expect(root.ordering).toEqual({ shuffle: true });
		expect(root.preConditions?.[0]).toContain('baseValue');
		expect(root.children?.map((child) => child.type)).toEqual(['item', 'section']);
		expect(root.sections?.[0].identifier).toBe('nested');
		expect(root.sections?.[0].assessmentItemRefs[0].identifier).toBe('item-2');
		expect(item.required).toBe(true);
		expect(item.fixed).toBe(true);
		expect(item.preConditions?.[0]).toContain('baseValue');
		expect(item.branchRule?.[0]).toEqual({
			target: 'item-2',
			conditionXml: expect.stringContaining('baseValue'),
		});
		expect(item.weights).toEqual([{ identifier: 'SCORE', value: 2.5 }]);
		expect(assessment.testFeedback?.[0]).toMatchObject({
			identifier: 'passed',
			outcomeIdentifier: 'PASS',
			showHide: 'show',
			access: 'atEnd',
		});
		expect(assessment.testFeedback?.[0].content).toContain('<p>Passed</p>');
	});

	test('delivers nested sections and applies each testPart navigation mode', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(`
<assessmentTest identifier="test" title="Structured test">
  <testPart identifier="linear-part" navigationMode="linear" submissionMode="simultaneous">
    <assessmentSection identifier="outer">
      <assessmentItemRef identifier="item-1" href="item-1.xml" />
    </assessmentSection>
  </testPart>
  <testPart identifier="nonlinear-part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="parent">
      <assessmentSection identifier="nested">
        <assessmentItemRef identifier="item-2" href="item-2.xml" />
        <assessmentItemRef identifier="item-3" href="item-3.xml" />
      </assessmentSection>
    </assessmentSection>
  </testPart>
</assessmentTest>`, {
			itemXmlMap: {
				'item-1.xml': ITEM_XML.replace('identifier="item"', 'identifier="item-1"'),
				'item-2.xml': ITEM_XML.replace('identifier="item"', 'identifier="item-2"'),
				'item-3.xml': ITEM_XML.replace('identifier="item"', 'identifier="item-3"'),
			},
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment('test', assessment);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: 'test', candidateId: 'candidate' },
		});

		expect(player.getNavigationState().totalItems).toBe(3);
		expect(player.getCurrentItem()?.identifier).toBe('item-1');
		await player.navigateTo(1);
		expect(player.getCurrentItem()?.identifier).toBe('item-2');
		await player.navigateTo(2);
		await player.navigateTo(1);
		expect(player.getCurrentItem()?.identifier).toBe('item-2');
		await expect(player.navigateTo(0)).rejects.toThrow('Navigation is not allowed');
		player.destroy();
	});
});
