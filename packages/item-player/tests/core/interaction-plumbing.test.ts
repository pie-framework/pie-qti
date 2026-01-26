import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

describe('interaction plumbing (response shapes)', () => {
	test('associateInteraction: pair + multiple canonicalizes pair values (unordered within pair)', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="assoc" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>A B</value>
      <value>C D</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="2">
      <simpleAssociableChoice identifier="A" matchMax="1">A</simpleAssociableChoice>
      <simpleAssociableChoice identifier="B" matchMax="1">B</simpleAssociableChoice>
      <simpleAssociableChoice identifier="C" matchMax="1">C</simpleAssociableChoice>
      <simpleAssociableChoice identifier="D" matchMax="1">D</simpleAssociableChoice>
    </associateInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

		const player = new Player({ itemXml });
		player.setResponses({ RESPONSE: ['B A', 'C D'] });

		const r = player.getResponses().RESPONSE as string[];
		expect(Array.isArray(r)).toBe(true);
		// pair is unordered: "B A" should be treated as "A B"
		expect(r).toContain('A B');
		expect(r).toContain('C D');

		const result = player.processResponses();
		expect(result.score).toBe(1);
	});

	test('matchInteraction: directedPair + multiple preserves order within pair', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="match" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>A B</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="1">
      <simpleMatchSet>
        <simpleAssociableChoice identifier="A" matchMax="1">A</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="B" matchMax="1">B</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

		const player = new Player({ itemXml });
		player.setResponses({ RESPONSE: ['B A'] });

		const r = player.getResponses().RESPONSE as string[];
		expect(r).toEqual(['B A']);

		const result = player.processResponses();
		expect(result.score).toBe(0);
	});

	test('orderInteraction: identifier + ordered preserves order and match is order-sensitive', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="order" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>A</value>
      <value>B</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <orderInteraction responseIdentifier="RESPONSE" shuffle="false" orientation="horizontal">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </orderInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

		const player = new Player({ itemXml });
		player.setResponses({ RESPONSE: ['A', 'B'] });
		expect(player.processResponses().score).toBe(1);

		player.setResponses({ RESPONSE: ['B', 'A'] });
		expect(player.processResponses().score).toBe(0);
	});

	test('selectPointInteraction: point + single uses "x y" lexical form', () => {
		const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="pt" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="point"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>1</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <selectPointInteraction responseIdentifier="RESPONSE" maxPoints="1">
      <object data="bg.png" type="image/png" width="100" height="100"/>
    </selectPointInteraction>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="SCORE">
      <mapResponsePoint identifier="RESPONSE"/>
    </setOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

		const player = new Player({ itemXml });
		player.setResponses({ RESPONSE: '10 20' });
		expect(player.getResponses().RESPONSE).toBe('10 20');
	});
});


