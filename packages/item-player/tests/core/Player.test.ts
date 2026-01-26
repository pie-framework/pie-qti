/**
 * Tests for the Player class
 * Ported from an earlier implementation
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

const SIMPLE_CHOICE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="choice-example"
  title="Simple Choice Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
    </correctResponse>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>What is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select the correct answer:</prompt>
      <simpleChoice identifier="ChoiceA">4</simpleChoice>
      <simpleChoice identifier="ChoiceB">3</simpleChoice>
      <simpleChoice identifier="ChoiceC">5</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

const MAPPING_CHOICE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="mapping-example"
  title="Mapping Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>ChoiceA</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="ChoiceA" mappedValue="2"/>
      <mapEntry mapKey="ChoiceB" mappedValue="1"/>
      <mapEntry mapKey="ChoiceC" mappedValue="0"/>
    </mapping>
  </responseDeclaration>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0.0</value>
    </defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>What is the best answer?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>Select an answer:</prompt>
      <simpleChoice identifier="ChoiceA">Best</simpleChoice>
      <simpleChoice identifier="ChoiceB">OK</simpleChoice>
      <simpleChoice identifier="ChoiceC">Wrong</simpleChoice>
    </choiceInteraction>
  </itemBody>

  <responseProcessing>
    <responseCondition>
      <responseIf>
        <isNull>
          <variable identifier="RESPONSE"/>
        </isNull>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0.0</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <mapResponse identifier="RESPONSE"/>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

describe('Player', () => {
	describe('Initialization', () => {
		test('should create a player instance', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
			expect(player).toBeDefined();
		});

		test('should parse response declarations', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
			const declarations = player.getDeclarations();

			expect(declarations.RESPONSE).toBeDefined();
			expect(declarations.RESPONSE.identifier).toBe('RESPONSE');
			expect(declarations.RESPONSE.cardinality).toBe('single');
			expect(declarations.RESPONSE.baseType).toBe('identifier');
		});

		test('should parse outcome declarations', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
			const declarations = player.getDeclarations();

			expect(declarations.SCORE).toBeDefined();
			expect(declarations.SCORE.identifier).toBe('SCORE');
			expect(declarations.SCORE.value.kind).toBe('value');
			expect((declarations.SCORE.value as any).value).toBe(0.0);
		});

		test('should parse correct responses', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
			const declarations = player.getDeclarations();
			const responseDecl = declarations.RESPONSE as any;

			expect(responseDecl.correctResponse.kind).toBe('value');
			expect(responseDecl.correctResponse.value).toBe('ChoiceA');
		});

		test('should parse mapping', () => {
			const player = new Player({ itemXml: MAPPING_CHOICE_XML });
			const declarations = player.getDeclarations();
			const responseDecl = declarations.RESPONSE;

			expect(responseDecl.mapping).toBeDefined();
			expect(responseDecl.mapping?.defaultValue).toBe(0);
			expect(responseDecl.mapping?.entries.ChoiceA.mappedValue).toBe(2);
			expect(responseDecl.mapping?.entries.ChoiceB.mappedValue).toBe(1);
			expect(responseDecl.mapping?.entries.ChoiceC.mappedValue).toBe(0);
		});
	});

	describe('Response Handling', () => {
		test('should set and get responses', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

			player.setResponses({ RESPONSE: 'ChoiceA' });
			const responses = player.getResponses();

			expect(responses.RESPONSE).toBe('ChoiceA');
		});

		test('should initialize with responses', () => {
			const player = new Player({
				itemXml: SIMPLE_CHOICE_XML,
				responses: { RESPONSE: 'ChoiceB' },
			});

			const responses = player.getResponses();
			expect(responses.RESPONSE).toBe('ChoiceB');
		});
	});

	describe('Response Processing', () => {
		test('should score correct answer', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

			player.setResponses({ RESPONSE: 'ChoiceA' });
			const result = player.processResponses();

			expect(result.score).toBe(1.0);
			expect(result.outcomeValues.SCORE).toBe(1.0);
		});

		test('should score incorrect answer', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

			player.setResponses({ RESPONSE: 'ChoiceB' });
			const result = player.processResponses();

			expect(result.score).toBe(0.0);
			expect(result.outcomeValues.SCORE).toBe(0.0);
		});

		test('should handle no response', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

			const result = player.processResponses();

			expect(result.score).toBe(0.0);
			expect(result.outcomeValues.SCORE).toBe(0.0);
		});

		test('should use mapResponse for scoring', () => {
			const player = new Player({ itemXml: MAPPING_CHOICE_XML });

			// Test full credit
			player.setResponses({ RESPONSE: 'ChoiceA' });
			let result = player.processResponses();
			expect(result.score).toBe(2.0);

			// Test partial credit
			player.setResponses({ RESPONSE: 'ChoiceB' });
			result = player.processResponses();
			expect(result.score).toBe(1.0);

			// Test no credit
			player.setResponses({ RESPONSE: 'ChoiceC' });
			result = player.processResponses();
			expect(result.score).toBe(0.0);
		});
	});

	describe('Session State', () => {
		test('should get session state', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

			player.setResponses({ RESPONSE: 'ChoiceA' });
			const state = player.getSessionState();

			expect(state.RESPONSE).toBe('ChoiceA');
		});

		test('should restore session state', () => {
			const sessionState = {
				RESPONSE: 'ChoiceB',
				SCORE: 0.5,
			};

			const player = new Player({
				itemXml: SIMPLE_CHOICE_XML,
				sessionState,
			});

			const state = player.getSessionState();
			expect(state.RESPONSE).toBe('ChoiceB');
			expect(state.SCORE).toBe(0.5);
		});
	});

	describe('Item Content', () => {
		test('should get item body HTML', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

			const html = player.getItemBodyHtml();

			expect(html).toContain('What is 2 + 2?');
			expect(html).toContain('choiceInteraction');
		});

		test('should get interactions', () => {
			const player = new Player({ itemXml: SIMPLE_CHOICE_XML });

			const interactions = player.getInteractions();

			expect(interactions.length).toBe(1);
			expect(interactions[0].type).toBe('choiceInteraction');
			expect(interactions[0].responseIdentifier).toBe('RESPONSE');
		});

		test('should exclude endAttemptInteraction from response interactions and progress', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="end-attempt-example"
  title="End Attempt Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier" />
  <responseDeclaration identifier="END" cardinality="single" baseType="identifier" />

  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <endAttemptInteraction responseIdentifier="END" title="Submit Answer" />
  </itemBody>
</assessmentItem>`;

			const player = new Player({ itemXml: xml });

			expect(player.getInteractions().length).toBe(2);
			expect(player.getResponseInteractions().length).toBe(1);
			expect(player.getResponseIdentifiers()).toEqual(['RESPONSE']);

			const p0 = player.getProgress({ RESPONSE: null, END: 'clicked' });
			expect(p0.total).toBe(1);
			expect(p0.answered).toBe(0);
			expect(p0.unanswered).toBe(1);
			expect(player.canSubmitResponses({ RESPONSE: null, END: 'clicked' })).toBe(false);

			const p1 = player.getProgress({ RESPONSE: 'A', END: null });
			expect(p1.answered).toBe(1);
			expect(p1.unanswered).toBe(0);
			expect(player.canSubmitResponses({ RESPONSE: 'A', END: null })).toBe(true);
		});

		test('should require mediaInteraction minPlays completion when minPlays > 0', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="media-example"
  title="Media Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="MEDIA" cardinality="single" baseType="integer" />

  <itemBody>
    <mediaInteraction responseIdentifier="MEDIA" minPlays="1" maxPlays="0" loop="false" autostart="false">
      <prompt>Listen to the audio</prompt>
      <audio>
        <source src="test.mp3" type="audio/mpeg" />
      </audio>
    </mediaInteraction>
  </itemBody>
</assessmentItem>`;

			const player = new Player({ itemXml: xml });

			expect(player.getProgress({ MEDIA: null }).total).toBe(1);
			expect(player.canSubmitResponses({ MEDIA: null })).toBe(false);
			expect(player.canSubmitResponses({ MEDIA: 0 })).toBe(false);
			expect(player.canSubmitResponses({ MEDIA: 1 })).toBe(true);
		});

		test('validateResponses should flag invalid choice multiple response shapes', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="choice-multi"
  title="Choice Multi"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier" />

  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="2">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
      <simpleChoice identifier="C">C</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

			const player = new Player({ itemXml: xml });
			const ok = player.validateResponses({ RESPONSE: ['A', 'B'] });
			expect(ok.valid).toBe(true);

			const bad = player.validateResponses({ RESPONSE: 'A' as any });
			expect(bad.valid).toBe(false);
			expect(bad.entries.RESPONSE.errors.length).toBeGreaterThan(0);
		});

		test('should include uploadInteraction in interactions list', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="upload-example"
  title="Upload Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="UPLOAD" cardinality="single" baseType="file" />

  <itemBody>
    <p>Upload a file.</p>
    <uploadInteraction responseIdentifier="UPLOAD">
      <prompt>Upload your work</prompt>
      <fileType>text/plain</fileType>
    </uploadInteraction>
  </itemBody>
</assessmentItem>`;

			const player = new Player({ itemXml: xml });
			const interactions = player.getInteractions();

			expect(interactions.length).toBe(1);
			expect(interactions[0].type).toBe('uploadInteraction');
			expect(interactions[0].responseIdentifier).toBe('UPLOAD');
		});

		test('should include drawingInteraction in interactions list', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="drawing-example"
  title="Drawing Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="DRAW" cardinality="single" baseType="file" />

  <itemBody>
    <p>Draw on the canvas.</p>
    <drawingInteraction responseIdentifier="DRAW">
      <prompt>Draw</prompt>
    </drawingInteraction>
  </itemBody>
</assessmentItem>`;

			const player = new Player({ itemXml: xml });
			const interactions = player.getInteractions();

			expect(interactions.length).toBe(1);
			expect(interactions[0].type).toBe('drawingInteraction');
			expect(interactions[0].responseIdentifier).toBe('DRAW');
		});

		test('should include customInteraction in interactions list', () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="custom-example"
  title="Custom Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="CUST" cardinality="single" baseType="string" />

  <itemBody>
    <p>Custom interaction.</p>
    <customInteraction responseIdentifier="CUST">
      <prompt>Custom</prompt>
    </customInteraction>
  </itemBody>
</assessmentItem>`;

			const player = new Player({ itemXml: xml });
			const interactions = player.getInteractions();

			expect(interactions.length).toBe(1);
			expect(interactions[0].type).toBe('customInteraction');
			expect(interactions[0].responseIdentifier).toBe('CUST');
		});
	});

	describe('Template Processing + printedVariable', () => {
		const TEMPLATE_PROCESSING_XML = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="template-example"
  title="Template Processing Example"
  adaptive="false"
  timeDependent="false">

  <templateDeclaration identifier="A" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>

  <templateDeclaration identifier="B" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>

  <templateDeclaration identifier="ANSWER" cardinality="single" baseType="integer">
    <defaultValue><value>0</value></defaultValue>
  </templateDeclaration>

  <templateProcessing>
    <setTemplateValue identifier="A">
      <randomInteger>
        <baseValue baseType="integer">5</baseValue>
        <baseValue baseType="integer">5</baseValue>
      </randomInteger>
    </setTemplateValue>
    <setTemplateValue identifier="B">
      <randomInteger>
        <baseValue baseType="integer">3</baseValue>
        <baseValue baseType="integer">3</baseValue>
      </randomInteger>
    </setTemplateValue>
    <setTemplateValue identifier="ANSWER">
      <sum>
        <variable identifier="A"/>
        <variable identifier="B"/>
      </sum>
    </setTemplateValue>
  </templateProcessing>

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>

  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0.0</value></defaultValue>
  </outcomeDeclaration>

  <itemBody>
    <p>What is <printedVariable identifier="A"/> + <printedVariable identifier="B"/>?</p>
    <p>The computed answer is <printedVariable identifier="ANSWER"/>.</p>
    <p>Legacy placeholder stays literal: {$A}</p>
    <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="5"/>
  </itemBody>
</assessmentItem>`;

		test('should parse template declarations and mark them as template vars', () => {
			const player = new Player({ itemXml: TEMPLATE_PROCESSING_XML });
			const declarations = player.getDeclarations();

			expect(declarations.A).toBeDefined();
			expect(declarations.A.baseType).toBe('integer');
			expect((declarations.A as any).isTemplate).toBe(true);

			expect(declarations.B).toBeDefined();
			expect((declarations.B as any).isTemplate).toBe(true);

			expect(declarations.ANSWER).toBeDefined();
			expect((declarations.ANSWER as any).isTemplate).toBe(true);
		});

		test('should execute templateProcessing at init', () => {
			const player = new Player({ itemXml: TEMPLATE_PROCESSING_XML });
			const templateVars = player.getTemplateVariables();

			expect(templateVars.A).toBe(5);
			expect(templateVars.B).toBe(3);
			expect(templateVars.ANSWER).toBe(8);
		});

		test('should render printedVariable in itemBody', () => {
			const player = new Player({ itemXml: TEMPLATE_PROCESSING_XML });
			const html = player.getItemBodyHtml();

			expect(html).toContain('What is 5 + 3?');
			expect(html).toContain('The computed answer is 8.');
		});

		test('should update printedVariable rendering when template variables change', () => {
			const player = new Player({ itemXml: TEMPLATE_PROCESSING_XML });
			player.setTemplateVariables({ A: 10, B: 7, ANSWER: 17 });
			const html = player.getItemBodyHtml();

			expect(html).toContain('What is 10 + 7?');
			expect(html).toContain('The computed answer is 17.');
		});

		test('should not interpret {$...} placeholders (non-QTI) in itemBody', () => {
			const player = new Player({ itemXml: TEMPLATE_PROCESSING_XML });
			const html = player.getItemBodyHtml();
			expect(html).toContain('{$A}');
		});
	});
});
