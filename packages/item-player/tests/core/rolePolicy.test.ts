import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import { getRoleCapabilities } from '../../src/core/rolePolicy.js';
import type { QTIRole } from '../../src/types/index.js';

const RUBRIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="roles">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <rubricBlock view="candidate"><p>Candidate rubric</p></rubricBlock>
    <rubricBlock view="proctor"><p>Proctor rubric</p></rubricBlock>
    <rubricBlock view="scorer tutor author testConstructor"><p>Privileged rubric</p></rubricBlock>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

describe('role policy', () => {
	test('defines expected capability matrix for all standard roles', () => {
		const cases: Record<QTIRole, ReturnType<typeof getRoleCapabilities>> = {
			candidate: { isCandidate: true, isReadOnly: false, canViewCorrectResponses: false },
			scorer: { isCandidate: false, isReadOnly: true, canViewCorrectResponses: true },
			author: { isCandidate: false, isReadOnly: true, canViewCorrectResponses: true },
			tutor: { isCandidate: false, isReadOnly: true, canViewCorrectResponses: true },
			testConstructor: { isCandidate: false, isReadOnly: true, canViewCorrectResponses: true },
			proctor: { isCandidate: false, isReadOnly: true, canViewCorrectResponses: false },
		};

		for (const [role, expected] of Object.entries(cases) as [QTIRole, ReturnType<typeof getRoleCapabilities>][]) {
			expect(getRoleCapabilities(role)).toEqual(expected);
		}
	});

	test('filters rubric visibility by QTI role/view audience', () => {
		const candidate = new Player({ itemXml: RUBRIC_XML, role: 'candidate' }).getRubrics();
		const scorer = new Player({ itemXml: RUBRIC_XML, role: 'scorer' }).getRubrics();
		const proctor = new Player({ itemXml: RUBRIC_XML, role: 'proctor' }).getRubrics();
		const author = new Player({ itemXml: RUBRIC_XML, role: 'author' }).getRubrics();
		const testConstructor = new Player({ itemXml: RUBRIC_XML, role: 'testConstructor' }).getRubrics();

		expect(candidate.length).toBe(1);
		expect(String(candidate[0].html)).toContain('Candidate rubric');

		expect(proctor.length).toBe(1);
		expect(String(proctor[0].html)).toContain('Proctor rubric');

		expect(scorer.length).toBe(1);
		expect(String(scorer[0].html)).toContain('Privileged rubric');

		expect(author.length).toBe(1);
		expect(String(author[0].html)).toContain('Privileged rubric');

		expect(testConstructor.length).toBe(1);
		expect(String(testConstructor[0].html)).toContain('Privileged rubric');
	});

	test('accepts comma-separated role lists in rubric views', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="comma-roles">
  <itemBody>
    <rubricBlock view="candidate, scorer"><p>Shared review rubric</p></rubricBlock>
  </itemBody>
</assessmentItem>`;

		const candidate = new Player({ itemXml, role: 'candidate' }).getRubrics();
		const scorer = new Player({ itemXml, role: 'scorer' }).getRubrics();

		expect(String(candidate[0]?.html)).toContain('Shared review rubric');
		expect(String(scorer[0]?.html)).toContain('Shared review rubric');
	});

	test('can return only direct assessment-item rubrics for host placement', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="scoped-rubrics">
  <rubricBlock view="scorer" use="rubric"><p>Direct scoring guide</p></rubricBlock>
  <itemBody>
    <rubricBlock view="scorer" use="instructions"><p>Inline scorer instruction</p></rubricBlock>
    <p>Stem</p>
  </itemBody>
</assessmentItem>`;

		const player = new Player({ itemXml, role: 'scorer' });
		const allRubrics = player.getRubrics();
		const directRubrics = player.getRubrics({ scope: 'direct' });
		const itemBodyRubrics = player.getRubrics({ scope: 'itemBody' });

		expect(allRubrics.map((rubric) => rubric.scope)).toEqual(['direct', 'itemBody']);
		expect(directRubrics).toHaveLength(1);
		expect(directRubrics[0].scope).toBe('direct');
		expect(directRubrics[0].use).toBe('rubric');
		expect(String(directRubrics[0].html)).toContain('Direct scoring guide');
		expect(String(directRubrics[0].html)).not.toContain('Inline scorer instruction');
		expect(itemBodyRubrics).toHaveLength(1);
		expect(itemBodyRubrics[0].scope).toBe('itemBody');
	});
});

