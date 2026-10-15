import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/**
 * GRADE maps the raw score through an interpolationTable in document order; LEVEL maps the chosen
 * option's index through a matchTable. Both default when nothing matches.
 */
const ITEM = `<assessmentItem ${NS} identifier="lookups" title="Lookups" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RAW" cardinality="single" baseType="float"/>
  <responseDeclaration identifier="PICK" cardinality="single" baseType="integer"/>
  <outcomeDeclaration identifier="GRADE" cardinality="single" baseType="identifier">
    <interpolationTable defaultValue="F">
      <interpolationTableEntry sourceValue="90" targetValue="A"/>
      <interpolationTableEntry sourceValue="80" targetValue="B" includeBoundary="false"/>
      <interpolationTableEntry sourceValue="50" targetValue="C"/>
    </interpolationTable>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="POINTS" cardinality="single" baseType="integer">
    <interpolationTable>
      <interpolationTableEntry sourceValue="50" targetValue="2"/>
      <interpolationTableEntry sourceValue="0" targetValue="1"/>
    </interpolationTable>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="LEVEL" cardinality="single" baseType="identifier">
    <matchTable defaultValue="none">
      <matchTableEntry sourceValue="1" targetValue="low"/>
      <matchTableEntry sourceValue="2" targetValue="high"/>
    </matchTable>
  </outcomeDeclaration>
  <itemBody><p>Lookups</p></itemBody>
  <responseProcessing>
    <lookupOutcomeValue identifier="GRADE"><variable identifier="RAW"/></lookupOutcomeValue>
    <lookupOutcomeValue identifier="POINTS"><variable identifier="RAW"/></lookupOutcomeValue>
    <lookupOutcomeValue identifier="LEVEL"><variable identifier="PICK"/></lookupOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

const outcomes = (xml: string, responses: Record<string, unknown>) => {
	const session = createAssessmentItemDefinition({ itemXml: xml, role: 'scorer' }).openSession({ responses });
	try {
		return session.dispatch({ action: 'endAttempt', countAttempt: false, validateResponses: false }).result?.scoring
			?.outcomeValues;
	} finally {
		session.dispose();
	}
};

describe.each([
	['QTI 2.2', ITEM],
	['QTI 3.0', convertQti2ToQti3(ITEM)],
] as const)('%s lookup tables', (_version, xml) => {
	test('interpolationTable takes the first entry the source exceeds, honouring includeBoundary', () => {
		expect(outcomes(xml, { RAW: 95 })).toMatchObject({ GRADE: 'A', POINTS: 2 });
		expect(outcomes(xml, { RAW: 90 })).toMatchObject({ GRADE: 'A' });
		expect(outcomes(xml, { RAW: 85 })).toMatchObject({ GRADE: 'B' });
		expect(outcomes(xml, { RAW: 80 })).toMatchObject({ GRADE: 'C' });
		expect(outcomes(xml, { RAW: 30 })).toMatchObject({ GRADE: 'F', POINTS: 1 });
	});

	test('a table without defaultValue gives NULL when nothing matches', () => {
		expect(outcomes(xml, { RAW: -1 })?.POINTS ?? null).toBeNull();
	});

	test('matchTable maps exact values and keeps defaultValue in the outcome base type', () => {
		expect(outcomes(xml, { PICK: 2 })).toMatchObject({ LEVEL: 'high' });
		expect(outcomes(xml, { PICK: 7 })).toMatchObject({ LEVEL: 'none' });
		expect(outcomes(xml, {})).toMatchObject({ LEVEL: 'none', GRADE: 'F' });
	});
});
