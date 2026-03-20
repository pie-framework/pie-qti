/**
 * QTI 3.0 Extraction Tests
 *
 * Verifies that QTI 3.0 content (kebab-case attributes/elements) extracts correctly
 * and produces identical data structures to QTI 2.x equivalents.
 */

import { describe, it, expect } from 'bun:test';
import { Player } from '../core/Player.js';

// QTI 3.0 sample items
const QTI3_SIMPLE_CHOICE = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-simple-choice"
  title="Simple Multiple Choice (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>ChoiceA</qti-value>
    </qti-correct-response>
  </qti-response-declaration>

  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0.0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-item-body>
    <p>If Maya has 12 cookies and gives 5 to her friend, how many cookies does she have left?</p>
    <qti-choice-interaction response-identifier="RESPONSE" shuffle="false" max-choices="1">
      <qti-prompt>Select the correct answer:</qti-prompt>
      <qti-simple-choice identifier="ChoiceA">7</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceB">17</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceC">5</qti-simple-choice>
      <qti-simple-choice identifier="ChoiceD">8</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>

  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

const QTI3_TEXT_ENTRY = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-text-entry"
  title="Text Entry (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string">
    <qti-correct-response>
      <qti-value>Paris</qti-value>
    </qti-correct-response>
  </qti-response-declaration>

  <qti-item-body>
    <p>What is the capital of France? <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="15"/></p>
  </qti-item-body>

  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-match>
          <qti-variable identifier="RESPONSE"/>
          <qti-correct identifier="RESPONSE"/>
        </qti-match>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">1.0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

const QTI3_EXTENDED_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-extended-text"
  title="Extended Text (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>

  <qti-item-body>
    <p>Describe the water cycle in your own words.</p>
    <qti-extended-text-interaction
      response-identifier="RESPONSE"
      expected-lines="5"
      expected-length="500"
      placeholder-text="Type your answer here..."/>
  </qti-item-body>
</qti-assessment-item>`;

const QTI3_MATCH = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-match"
  title="Match Interaction (QTI 3.0)"
  adaptive="false"
  time-dependent="false">

  <qti-response-declaration identifier="RESPONSE" cardinality="multiple" base-type="directedPair">
    <qti-correct-response>
      <qti-value>france paris</qti-value>
      <qti-value>germany berlin</qti-value>
    </qti-correct-response>
    <qti-mapping default-value="0">
      <qti-map-entry map-key="france paris" mapped-value="1.5"/>
      <qti-map-entry map-key="germany berlin" mapped-value="1.5"/>
    </qti-mapping>
  </qti-response-declaration>

  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>

  <qti-item-body>
    <p>Match each country with its capital city:</p>
    <qti-match-interaction response-identifier="RESPONSE" shuffle="false" max-associations="3">
      <qti-prompt>Drag each capital to its country:</qti-prompt>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="france" match-max="1">France</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="germany" match-max="1">Germany</qti-simple-associable-choice>
      </qti-simple-match-set>
      <qti-simple-match-set>
        <qti-simple-associable-choice identifier="paris" match-max="1">Paris</qti-simple-associable-choice>
        <qti-simple-associable-choice identifier="berlin" match-max="1">Berlin</qti-simple-associable-choice>
      </qti-simple-match-set>
    </qti-match-interaction>
  </qti-item-body>

  <qti-response-processing>
    <qti-response-condition>
      <qti-response-if>
        <qti-is-null>
          <qti-variable identifier="RESPONSE"/>
        </qti-is-null>
        <qti-set-outcome-value identifier="SCORE">
          <qti-base-value base-type="float">0</qti-base-value>
        </qti-set-outcome-value>
      </qti-response-if>
      <qti-response-else>
        <qti-set-outcome-value identifier="SCORE">
          <qti-map-response identifier="RESPONSE"/>
        </qti-set-outcome-value>
      </qti-response-else>
    </qti-response-condition>
  </qti-response-processing>
</qti-assessment-item>`;

describe('QTI 3.0 Extraction', () => {
	describe('Choice Interaction', () => {
		it('should extract and render QTI 3.0 choice interaction', () => {
			const player = new Player({ itemXml: QTI3_SIMPLE_CHOICE });
			const interactions = player.getInteractionData();

			// Verify interaction was extracted
			expect(interactions).toHaveLength(1);
			const interaction = interactions[0];

			expect(interaction.type).toBe('qti-choice-interaction'); // QTI 3.0 uses kebab-case
			expect(interaction.responseId).toBe('RESPONSE');
			expect(interaction.maxChoices).toBe(1);
			expect(interaction.shuffle).toBe(false);
			expect(interaction.choices).toHaveLength(4);
			expect(interaction.choices[0].identifier).toBe('ChoiceA');
			expect(interaction.choices[0].text).toContain('7');
		});

		it('should process responses correctly for QTI 3.0 items', () => {
			const player = new Player({ itemXml: QTI3_SIMPLE_CHOICE });

			// Set correct response
			player.setResponses({ RESPONSE: 'ChoiceA' });
			const result = player.processResponses();

			expect(result.score).toBe(1.0);
			expect(result.outcomeValues.SCORE).toBe('1.0'); // outcomeValues are strings
		});
	});

	describe('Text Entry Interaction', () => {
		it('should extract QTI 3.0 text entry with expected-length attribute', () => {
			const player = new Player({ itemXml: QTI3_TEXT_ENTRY });
			const interactions = player.getInteractionData();

			expect(interactions).toHaveLength(1);
			const interaction = interactions[0];

			expect(interaction.type).toBe('qti-text-entry-interaction'); // QTI 3.0 uses kebab-case
			expect(interaction.responseId).toBe('RESPONSE');
			expect(interaction.expectedLength).toBe(15);
		});

		it('should process text entry responses correctly', () => {
			const player = new Player({ itemXml: QTI3_TEXT_ENTRY });

			player.setResponses({ RESPONSE: 'Paris' });
			const result = player.processResponses();

			expect(result.score).toBe(1.0);
		});
	});

	describe('Extended Text Interaction', () => {
		it('should extract QTI 3.0 extended text with kebab-case attributes', () => {
			const player = new Player({ itemXml: QTI3_EXTENDED_TEXT });
			const interactions = player.getInteractionData();

			expect(interactions).toHaveLength(1);
			const interaction = interactions[0];

			expect(interaction.type).toBe('qti-extended-text-interaction'); // QTI 3.0 uses kebab-case
			expect(interaction.responseId).toBe('RESPONSE');
			expect(interaction.expectedLines).toBe(5);
			expect(interaction.expectedLength).toBe(500);
			expect(interaction.placeholderText).toBe('Type your answer here...');
		});
	});

	describe('Match Interaction', () => {
		it('should extract QTI 3.0 match interaction with kebab-case attributes', () => {
			const player = new Player({ itemXml: QTI3_MATCH });
			const interactions = player.getInteractionData();

			expect(interactions).toHaveLength(1);
			const interaction = interactions[0];

			expect(interaction.type).toBe('qti-match-interaction'); // QTI 3.0 uses kebab-case
			expect(interaction.responseId).toBe('RESPONSE');
			expect(interaction.maxAssociations).toBe(3);
			expect(interaction.shuffle).toBe(false);
			expect(interaction.sourceSet).toHaveLength(2);
			expect(interaction.targetSet).toHaveLength(2);
			expect(interaction.sourceSet[0].identifier).toBe('france');
			expect(interaction.targetSet[0].identifier).toBe('paris');
		});

		it('should process match interaction responses correctly', () => {
			const player = new Player({ itemXml: QTI3_MATCH });

			// Set correct response
			player.setResponses({ RESPONSE: ['france paris', 'germany berlin'] });
			const result = player.processResponses();

			expect(result.score).toBe(3.0);
		});
	});

	describe('Backward Compatibility', () => {
		it('should handle QTI 2.x without mappers (default behavior)', () => {
			const qti2xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="qti2-choice"
  title="QTI 2.x Choice"
  adaptive="false"
  timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="1">
      <simpleChoice identifier="A">Choice A</simpleChoice>
      <simpleChoice identifier="B">Choice B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

			// No explicit mappers - should automatically use QTI 2.x defaults
			const player = new Player({ itemXml: qti2xml });
			const interactions = player.getInteractionData();

			expect(interactions).toHaveLength(1);
			expect(interactions[0].type).toBe('choiceInteraction');
			expect(interactions[0].maxChoices).toBe(1);
			expect(interactions[0].shuffle).toBe(true);

			// Verify responses work
			player.setResponses({ RESPONSE: 'A' });
			const result = player.processResponses();
			expect(result.score).toBe(1);
		});
	});
});
