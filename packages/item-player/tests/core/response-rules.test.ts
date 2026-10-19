/**
 * Engine behavior tests that no other suite covers: mapped scoring, response
 * validation rules (shape, matchMin, minPlays), hint end-attempt handling, and
 * file-response preservation.
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

describe('mapped scoring', () => {
	test('mapResponse scores full, partial, and zero credit from the mapping', () => {
		const player = new Player({ itemXml: MAPPING_CHOICE_XML });

		player.setResponses({ RESPONSE: 'ChoiceA' });
		let result = player.processResponses();
		expect(result.score).toBe(2.0);

		player.setResponses({ RESPONSE: 'ChoiceB' });
		result = player.processResponses();
		expect(result.score).toBe(1.0);

		player.setResponses({ RESPONSE: 'ChoiceC' });
		result = player.processResponses();
		expect(result.score).toBe(0.0);
	});
});

describe('response validation and progress rules', () => {
	test('endAttemptInteraction is excluded from response interactions and progress', () => {
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
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" minChoices="1" maxChoices="1">
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

	test('mediaInteraction minPlays gates submission until the minimum play count is reached', () => {
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

	test('validateResponses flags responses with the wrong cardinality shape', () => {
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

		const bad = player.validateResponses({ RESPONSE: 'A' as unknown as string[] });
		expect(bad.valid).toBe(false);
		expect(bad.entries.RESPONSE.errors.length).toBeGreaterThan(0);
	});

	test('validateResponses enforces matchMin on associateInteraction choices', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="associate-matchmin"
  title="Associate matchMin"
  adaptive="false"
  timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair" />
  <itemBody>
    <associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="4">
      <simpleAssociableChoice identifier="A" matchMax="2" matchMin="1">Item A</simpleAssociableChoice>
      <simpleAssociableChoice identifier="B" matchMax="2">Item B</simpleAssociableChoice>
      <simpleAssociableChoice identifier="C" matchMax="2">Item C</simpleAssociableChoice>
    </associateInteraction>
  </itemBody>
</assessmentItem>`;
		const player = new Player({ itemXml: xml });

		// A is not used — should be incomplete
		const missing = player.validateResponses({ RESPONSE: ['B C'] });
		expect(missing.entries.RESPONSE.complete).toBe(false);

		// A is used once — satisfies matchMin=1
		const satisfied = player.validateResponses({ RESPONSE: ['A B'] });
		expect(satisfied.entries.RESPONSE.complete).toBe(true);
	});

	test('validateResponses enforces matchMin on matchInteraction source and target sets', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="match-matchmin"
  title="Match matchMin"
  adaptive="false"
  timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair" />
  <itemBody>
    <matchInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="4">
      <simpleMatchSet>
        <simpleAssociableChoice identifier="S1" matchMax="2" matchMin="1">Source 1</simpleAssociableChoice>
        <simpleAssociableChoice identifier="S2" matchMax="2">Source 2</simpleAssociableChoice>
      </simpleMatchSet>
      <simpleMatchSet>
        <simpleAssociableChoice identifier="T1" matchMax="2" matchMin="1">Target 1</simpleAssociableChoice>
        <simpleAssociableChoice identifier="T2" matchMax="2">Target 2</simpleAssociableChoice>
      </simpleMatchSet>
    </matchInteraction>
  </itemBody>
</assessmentItem>`;
		const player = new Player({ itemXml: xml });

		// Neither S1 nor T1 used — incomplete
		const missing = player.validateResponses({ RESPONSE: ['S2 T2'] });
		expect(missing.entries.RESPONSE.complete).toBe(false);

		// Both S1 and T1 used once — satisfied
		const satisfied = player.validateResponses({ RESPONSE: ['S1 T1'] });
		expect(satisfied.entries.RESPONSE.complete).toBe(true);
	});

	test('validateResponses treats any non-empty response as complete when no matchMin exists', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="associate-no-matchmin"
  title="Associate no matchMin"
  adaptive="false"
  timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair" />
  <itemBody>
    <associateInteraction responseIdentifier="RESPONSE" shuffle="false" maxAssociations="2">
      <simpleAssociableChoice identifier="A" matchMax="2">Item A</simpleAssociableChoice>
      <simpleAssociableChoice identifier="B" matchMax="2">Item B</simpleAssociableChoice>
    </associateInteraction>
  </itemBody>
</assessmentItem>`;
		const player = new Player({ itemXml: xml });

		const result = player.validateResponses({ RESPONSE: ['A B'] });
		expect(result.entries.RESPONSE.complete).toBe(true);
	});
});

describe('hint end-attempt interactions', () => {
	test('endAttempt interactions with countAttempt="false" are identified as hints', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="hint-example"
  title="Hint Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier" />
  <responseDeclaration identifier="HINT_BTN" cardinality="single" baseType="identifier" />
  <responseDeclaration identifier="SUBMIT_BTN" cardinality="single" baseType="identifier" />

  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
    <endAttemptInteraction responseIdentifier="HINT_BTN" title="Request Hint" countAttempt="false" />
    <endAttemptInteraction responseIdentifier="SUBMIT_BTN" title="Submit Answer" />
  </itemBody>
</assessmentItem>`;

		const player = new Player({ itemXml: xml });
		const hintIdentifiers = player.getHintEndAttemptIdentifiers();

		expect(hintIdentifiers).toEqual(['HINT_BTN']);
		expect(hintIdentifiers).not.toContain('SUBMIT_BTN');
	});

	test('items without hint end-attempt interactions yield an empty list', () => {
		const player = new Player({ itemXml: SIMPLE_CHOICE_XML });
		expect(player.getHintEndAttemptIdentifiers()).toEqual([]);
	});
});

describe('file response preservation', () => {
	test('file responses keep their imageData payload intact', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="drawing-example"
  title="Drawing Example"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="DRAW" cardinality="single" baseType="file" />

  <itemBody>
    <drawingInteraction responseIdentifier="DRAW">
      <prompt>Draw</prompt>
    </drawingInteraction>
  </itemBody>
</assessmentItem>`;

		const player = new Player({ itemXml: xml });

		const fileResponse = {
			fileName: 'drawing.png',
			mimeType: 'image/png',
			data: 'base64data',
			imageData: {
				data: new Uint8ClampedArray([0, 0, 0, 255]),
				width: 1,
				height: 1,
			},
		};

		player.setResponses({ DRAW: fileResponse });
		const responses = player.getResponses();

		expect(responses.DRAW).toBeDefined();
		expect((responses.DRAW as Record<string, unknown>).imageData).toBeDefined();
		expect(((responses.DRAW as Record<string, unknown>).imageData as Record<string, unknown>).data).toBeInstanceOf(
			Uint8ClampedArray,
		);
	});

	test('multiple-cardinality file responses keep the array of files', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem
  xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="upload-multiple"
  title="Upload Multiple"
  adaptive="false"
  timeDependent="false">

  <responseDeclaration identifier="UPLOADS" cardinality="multiple" baseType="file" />

  <itemBody>
    <uploadInteraction responseIdentifier="UPLOADS">
      <prompt>Upload files</prompt>
    </uploadInteraction>
  </itemBody>
</assessmentItem>`;

		const player = new Player({ itemXml: xml });

		const fileResponses = [
			{ fileName: 'file1.txt', mimeType: 'text/plain', data: 'data1' },
			{ fileName: 'file2.txt', mimeType: 'text/plain', data: 'data2' },
		];

		player.setResponses({ UPLOADS: fileResponses });
		const responses = player.getResponses();

		expect(Array.isArray(responses.UPLOADS)).toBe(true);
		expect(responses.UPLOADS as unknown[]).toHaveLength(2);
		expect((responses.UPLOADS as { fileName: string }[])[0]?.fileName).toBe('file1.txt');
	});
});
