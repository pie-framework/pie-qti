import { describe, it, expect } from 'bun:test';
import { detectQtiVersion } from '@pie-qti/qti-common';
import { Player } from '../core/Player.js';
import { parse } from 'node-html-parser';

const QTI3_SIMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="test"
  title="Test">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">A</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

const QTI3_TEXT_ENTRY = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="qti3-text-entry"
  title="Text Entry">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <p>What is the capital? <qti-text-entry-interaction response-identifier="RESPONSE" expected-length="15"/></p>
  </qti-item-body>
</qti-assessment-item>`;

describe('QTI 3.0 Debug', () => {
	it('should detect QTI 3.0 version', () => {
		const version = detectQtiVersion(QTI3_SIMPLE);
		console.log('Detected version:', version);
		expect(version).toBe('3.0');
	});

	it('should create player with QTI 3.0', () => {
		const player = new Player({ itemXml: QTI3_SIMPLE });
		console.log('Player created successfully');
		expect(player).toBeDefined();
	});

	it('should parse HTML and find elements', () => {
		const docRoot = parse(QTI3_SIMPLE, { lowerCaseTagName: false, comment: false });
		console.log('Parsed HTML structure:');
		console.log('Root tag:', docRoot.rawTagName);

		const itemBody = docRoot.querySelector('qti-item-body');
		console.log('Found qti-item-body:', !!itemBody);
		if (itemBody) {
			console.log('itemBody children:', itemBody.childNodes.length);
		}

		const choiceInteraction = docRoot.querySelector('qti-choice-interaction');
		console.log('Found qti-choice-interaction:', !!choiceInteraction);
		if (choiceInteraction) {
			console.log('choiceInteraction tag:', (choiceInteraction as any).rawTagName);
			console.log('response-identifier attr:', choiceInteraction.getAttribute('response-identifier'));
		}

		expect(choiceInteraction).toBeDefined();
	});

	it('should extract choice interaction', () => {
		const player = new Player({ itemXml: QTI3_SIMPLE });
		const interactions = player.getInteractionData();
		console.log('Choice interactions found:', interactions.length);
		expect(interactions.length).toBeGreaterThan(0);
	});

	it('should parse text entry in HTML', () => {
		const docRoot = parse(QTI3_TEXT_ENTRY, { lowerCaseTagName: false, comment: false });
		const textEntry = docRoot.querySelector('qti-text-entry-interaction');
		console.log('Found qti-text-entry-interaction:', !!textEntry);
		if (textEntry) {
			console.log('textEntry tag:', (textEntry as any).rawTagName);
			console.log('response-identifier attr:', textEntry.getAttribute('response-identifier'));
		} else {
			// Try finding all elements
			const allElements = docRoot.querySelectorAll('*');
			console.log('Total elements found:', allElements.length);
			console.log('Element tags:', allElements.map((el: any) => el.rawTagName).slice(0, 10));
		}
		expect(textEntry).toBeDefined();
	});

	it('should extract text entry interaction', () => {
		const player = new Player({ itemXml: QTI3_TEXT_ENTRY });
		const interactions = player.getInteractionData();
		console.log('Text entry interactions found:', interactions.length);
		console.log('Interactions:', JSON.stringify(interactions, null, 2));
		expect(interactions.length).toBeGreaterThan(0);
	});

	it('should process responses for QTI 3.0', () => {
		const qti3WithProcessing = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="test"
  title="Test">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier">
    <qti-correct-response>
      <qti-value>A</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float">
    <qti-default-value>
      <qti-value>0</qti-value>
    </qti-default-value>
  </qti-outcome-declaration>
  <qti-item-body>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">Correct</qti-simple-choice>
      <qti-simple-choice identifier="B">Wrong</qti-simple-choice>
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

		const player = new Player({ itemXml: qti3WithProcessing });
		player.setResponses({ RESPONSE: 'A' });
		const result = player.processResponses();
		console.log('Response processing result:', result);
		console.log('Score:', result.score);
		console.log('Outcome values:', result.outcomeValues);
		expect(result.score).toBe(1.0);
	});
});
