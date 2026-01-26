import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

describe('Player - Correct Response Access', () => {
	describe('Single value responses', () => {
		test('choiceInteraction with single correct answer', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Choice A</simpleChoice>
      <simpleChoice identifier="B">Choice B</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			expect(player.getCorrectResponse('RESPONSE')).toBe('A');
		});

		test('textEntryInteraction with correct text', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse><value>Paris</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Capital of France: <textEntryInteraction responseIdentifier="RESPONSE" /></p>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			expect(player.getCorrectResponse('RESPONSE')).toBe('Paris');
		});

		test('sliderInteraction with correct integer value', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
    <correctResponse><value>50</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="100" />
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			expect(player.getCorrectResponse('RESPONSE')).toBe(50);
		});
	});

	describe('Multiple value responses', () => {
		test('choiceInteraction with multiple correct answers', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
      <value>A</value>
      <value>C</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="3">
      <simpleChoice identifier="A">Choice A</simpleChoice>
      <simpleChoice identifier="B">Choice B</simpleChoice>
      <simpleChoice identifier="C">Choice C</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			const correct = player.getCorrectResponse('RESPONSE');
			expect(Array.isArray(correct)).toBe(true);
			expect(correct).toContain('A');
			expect(correct).toContain('C');
			expect(correct.length).toBe(2);
		});

		test('orderInteraction with ordered correct response', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
      <value>First</value>
      <value>Second</value>
      <value>Third</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <orderInteraction responseIdentifier="RESPONSE">
      <simpleChoice identifier="First">First item</simpleChoice>
      <simpleChoice identifier="Second">Second item</simpleChoice>
      <simpleChoice identifier="Third">Third item</simpleChoice>
    </orderInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			const correct = player.getCorrectResponse('RESPONSE');
			expect(correct).toEqual(['First', 'Second', 'Third']);
		});

		test('hotspotInteraction with multiple correct hotspots', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
      <value>A</value>
      <value>C</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <hotspotInteraction responseIdentifier="RESPONSE" maxChoices="2">
      <object type="image/png" data="image.png" width="300" height="200" />
      <hotspotChoice identifier="A" shape="rect" coords="0,0,100,100" />
      <hotspotChoice identifier="B" shape="rect" coords="100,0,200,100" />
      <hotspotChoice identifier="C" shape="rect" coords="200,0,300,100" />
    </hotspotInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			const correct = player.getCorrectResponse('RESPONSE');
			expect(Array.isArray(correct)).toBe(true);
			expect(correct).toContain('A');
			expect(correct).toContain('C');
		});
	});

	describe('Edge cases', () => {
		test('returns undefined for response with no correctResponse', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string" />
  <itemBody>
    <extendedTextInteraction responseIdentifier="RESPONSE" />
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			expect(player.getCorrectResponse('RESPONSE')).toBeUndefined();
		});

		test('returns undefined for non-existent responseId', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Choice A</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			expect(player.getCorrectResponse('NONEXISTENT')).toBeUndefined();
		});

		test('getCorrectResponses returns only responses with correctResponse', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESP1" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="RESP2" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="RESP3" cardinality="single" baseType="identifier" />
  <itemBody>
    <choiceInteraction responseIdentifier="RESP1" maxChoices="1">
      <simpleChoice identifier="A">Choice A</simpleChoice>
    </choiceInteraction>
    <choiceInteraction responseIdentifier="RESP2" maxChoices="1">
      <simpleChoice identifier="B">Choice B</simpleChoice>
    </choiceInteraction>
    <choiceInteraction responseIdentifier="RESP3" maxChoices="1">
      <simpleChoice identifier="C">Choice C</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			const allCorrect = player.getCorrectResponses();
			expect(allCorrect.RESP1).toBe('A');
			expect(allCorrect.RESP2).toBe('B');
			expect(allCorrect.RESP3).toBeUndefined();
			expect(Object.keys(allCorrect).length).toBe(2);
		});

		test('getCorrectResponses returns empty object when no correct responses', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string" />
  <itemBody>
    <extendedTextInteraction responseIdentifier="RESPONSE" />
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			const allCorrect = player.getCorrectResponses();
			expect(Object.keys(allCorrect).length).toBe(0);
		});
	});

	describe('Complex interaction types', () => {
		test('matchInteraction with correct pairs', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>A X</value>
      <value>B Y</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <matchInteraction responseIdentifier="RESPONSE" maxAssociations="2">
      <simpleMatchSet>
        <simpleAssociableChoice identifier="A" matchMax="1">Item A</simpleAssociableChoice>
        <simpleAssociableChoice identifier="B" matchMax="1">Item B</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="X" matchMax="1">Target X</simpleAssociableChoice>
        <simpleAssociableChoice identifier="Y" matchMax="1">Target Y</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			const correct = player.getCorrectResponse('RESPONSE');
			expect(Array.isArray(correct)).toBe(true);
			expect(correct).toContain('A X');
			expect(correct).toContain('B Y');
		});

		test('associateInteraction with correct associations', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair">
    <correctResponse>
      <value>A B</value>
      <value>C D</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <associateInteraction responseIdentifier="RESPONSE" maxAssociations="2">
      <simpleAssociableChoice identifier="A" matchMax="1">A</simpleAssociableChoice>
      <simpleAssociableChoice identifier="B" matchMax="1">B</simpleAssociableChoice>
      <simpleAssociableChoice identifier="C" matchMax="1">C</simpleAssociableChoice>
      <simpleAssociableChoice identifier="D" matchMax="1">D</simpleAssociableChoice>
    </associateInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			const correct = player.getCorrectResponse('RESPONSE');
			expect(Array.isArray(correct)).toBe(true);
			expect(correct.length).toBe(2);
		});

		test('gapMatchInteraction with correct gap fillings', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="test">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
      <value>W1 G1</value>
      <value>W2 G2</value>
    </correctResponse>
  </responseDeclaration>
  <itemBody>
    <gapMatchInteraction responseIdentifier="RESPONSE">
      <gapText identifier="W1">word1</gapText>
      <gapText identifier="W2">word2</gapText>
      <blockquote>
        <p>The <gap identifier="G1" /> and <gap identifier="G2" />.</p>
      </blockquote>
    </gapMatchInteraction>
  </itemBody>
</assessmentItem>`;
			const player = new Player({ itemXml: xml });
			const correct = player.getCorrectResponse('RESPONSE');
			expect(Array.isArray(correct)).toBe(true);
			expect(correct).toContain('W1 G1');
			expect(correct).toContain('W2 G2');
		});
	});
});
