import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

const qti22RecordItem = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="record-qti22" title="Record QTI 2.2" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="record">
    <defaultValue>
      <value fieldIdentifier="stringValue" baseType="string">42</value>
      <value fieldIdentifier="floatValue" baseType="float">42</value>
      <value fieldIdentifier="integerValue" baseType="integer">42</value>
      <value fieldIdentifier="leftDigits" baseType="integer">2</value>
      <value fieldIdentifier="rightDigits" baseType="integer">0</value>
      <value fieldIdentifier="ndp" baseType="integer">0</value>
      <value fieldIdentifier="nsf" baseType="integer">2</value>
    </defaultValue>
    <correctResponse>
      <value fieldIdentifier="stringValue" baseType="string">12.5</value>
      <value fieldIdentifier="floatValue" baseType="float">12.5</value>
      <value fieldIdentifier="leftDigits" baseType="integer">2</value>
      <value fieldIdentifier="rightDigits" baseType="integer">1</value>
      <value fieldIdentifier="ndp" baseType="integer">1</value>
      <value fieldIdentifier="nsf" baseType="integer">3</value>
    </correctResponse>
  </responseDeclaration>
  <responseDeclaration identifier="RAW" cardinality="single" baseType="string"/>
  <outcomeDeclaration identifier="PARSED" cardinality="single" baseType="float"/>
  <itemBody>
    <extendedTextInteraction responseIdentifier="RESPONSE" stringIdentifier="RAW" base="10" minStrings="0"/>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="PARSED">
      <fieldValue fieldIdentifier="floatValue"><variable identifier="RESPONSE"/></fieldValue>
    </setOutcomeValue>
  </responseProcessing>
</assessmentItem>`;

const qti30RecordItem = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="record-qti30" title="Record QTI 3.0" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="record">
    <qti-default-value>
      <qti-value field-identifier="stringValue" base-type="string">A</qti-value>
      <qti-value field-identifier="floatValue" base-type="float">10</qti-value>
      <qti-value field-identifier="integerValue" base-type="integer">10</qti-value>
      <qti-value field-identifier="leftDigits" base-type="integer">1</qti-value>
      <qti-value field-identifier="rightDigits" base-type="integer">0</qti-value>
      <qti-value field-identifier="ndp" base-type="integer">0</qti-value>
      <qti-value field-identifier="nsf" base-type="integer">1</qti-value>
    </qti-default-value>
    <qti-correct-response>
      <qti-value field-identifier="stringValue" base-type="string">F</qti-value>
      <qti-value field-identifier="floatValue" base-type="float">15</qti-value>
      <qti-value field-identifier="integerValue" base-type="integer">15</qti-value>
      <qti-value field-identifier="leftDigits" base-type="integer">1</qti-value>
      <qti-value field-identifier="rightDigits" base-type="integer">0</qti-value>
      <qti-value field-identifier="ndp" base-type="integer">0</qti-value>
      <qti-value field-identifier="nsf" base-type="integer">1</qti-value>
    </qti-correct-response>
  </qti-response-declaration>
  <qti-outcome-declaration identifier="RAW_VALUE" cardinality="single" base-type="string"/>
  <qti-item-body>
    <qti-extended-text-interaction response-identifier="RESPONSE" base="16"/>
  </qti-item-body>
  <qti-response-processing>
    <qti-set-outcome-value identifier="RAW_VALUE">
      <qti-field-value field-identifier="stringValue"><qti-variable identifier="RESPONSE"/></qti-field-value>
    </qti-set-outcome-value>
  </qti-response-processing>
</qti-assessment-item>`;

describe('record cardinality', () => {
	test('QTI 2.2 parses typed default/correct record fields and evaluates candidate fields', () => {
		const player = new Player({ itemXml: qti22RecordItem });
		const declaration = player.getDeclarations().RESPONSE;

		expect(declaration.cardinality).toBe('record');
		expect(declaration.baseType).toBeUndefined();
		expect(player.getResponses().RESPONSE).toEqual({
			stringValue: '42',
			floatValue: 42,
			integerValue: 42,
			leftDigits: 2,
			rightDigits: 0,
			ndp: 0,
			nsf: 2,
		});
		expect(player.getCorrectResponse('RESPONSE')).toEqual({
			stringValue: '12.5',
			floatValue: 12.5,
			leftDigits: 2,
			rightDigits: 1,
			ndp: 1,
			nsf: 3,
		});

		player.setResponses({ RESPONSE: '0012.30e-1' });
		expect(player.getResponses().RESPONSE).toEqual({
			stringValue: '0012.30e-1',
			floatValue: 1.23,
			integerValue: null,
			leftDigits: 4,
			rightDigits: 2,
			ndp: 3,
			nsf: 4,
			exponent: -1,
		});
		expect(player.processResponses().outcomeValues.PARSED).toBe(1.23);
	});

	test('QTI 3.0 parses kebab-case field identifiers and base types', () => {
		const player = new Player({ itemXml: qti30RecordItem });

		expect(player.getResponses().RESPONSE).toEqual({
			stringValue: 'A',
			floatValue: 10,
			integerValue: 10,
			leftDigits: 1,
			rightDigits: 0,
			ndp: 0,
			nsf: 1,
		});
		expect(player.getCorrectResponse('RESPONSE')).toEqual({
			stringValue: 'F',
			floatValue: 15,
			integerValue: 15,
			leftDigits: 1,
			rightDigits: 0,
			ndp: 0,
			nsf: 1,
		});

		player.setResponses({ RESPONSE: 'FF' });
		expect(player.getResponses().RESPONSE).toEqual({
			stringValue: 'FF',
			floatValue: 255,
			integerValue: 255,
			leftDigits: 2,
			rightDigits: 0,
			ndp: 0,
			nsf: 2,
			exponent: null,
		});
		expect(player.processResponses().outcomeValues.RAW_VALUE).toBe('FF');
	});

	test('serializes per-field types and restores a record losslessly', () => {
		const player = new Player({ itemXml: qti22RecordItem });
		player.setResponses({ RESPONSE: '1.2300e2' });

		const saved = player.saveItemSession();
		expect(saved.responseVariables.RESPONSE.baseType).toBeUndefined();
		expect(saved.responseVariables.RESPONSE.value.stringValue).toEqual({
			baseType: 'string',
			cardinality: 'single',
			value: '1.2300e2',
		});
		expect(saved.responseVariables.RESPONSE.value.floatValue).toEqual({
			baseType: 'float',
			cardinality: 'single',
			value: 123,
		});

		const restored = new Player({ itemXml: qti22RecordItem });
		restored.restoreItemSession(saved);
		expect(restored.getResponses().RESPONSE).toEqual(player.getResponses().RESPONSE);
		expect(restored.processResponses().outcomeValues.PARSED).toBe(123);
	});
});

describe('extended text response cardinalities', () => {
	const item = `
		<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
		  identifier="optional-extended" title="Optional" adaptive="false" timeDependent="false">
		  <responseDeclaration identifier="SINGLE" cardinality="single" baseType="string"/>
		  <responseDeclaration identifier="MULTIPLE" cardinality="multiple" baseType="string"/>
		  <responseDeclaration identifier="ORDERED" cardinality="ordered" baseType="string"/>
		  <responseDeclaration identifier="RECORD" cardinality="record"/>
		  <itemBody>
		    <extendedTextInteraction responseIdentifier="SINGLE" minStrings="0"/>
		    <extendedTextInteraction responseIdentifier="MULTIPLE" minStrings="0" maxStrings="3"/>
		    <extendedTextInteraction responseIdentifier="ORDERED" minStrings="0" maxStrings="3"/>
		    <extendedTextInteraction responseIdentifier="RECORD" minStrings="0"/>
		  </itemBody>
		</assessmentItem>`;

	test('allows optional empty single, multiple, ordered, and record interactions', () => {
		const player = new Player({ itemXml: item });
		const responses = { SINGLE: null, MULTIPLE: [], ORDERED: [], RECORD: null };
		const validation = player.validateResponses(responses);

		expect(validation.valid).toBe(true);
		expect(Object.values(validation.entries).every((entry) => !entry.required && entry.complete)).toBe(true);
		expect(player.canSubmitResponses(responses)).toBe(true);
		expect(player.isAttempted(responses)).toBe(false);
		expect(player.isAttempted({ RECORD: { stringValue: '' } })).toBe(false);
	});

	test('enforces minStrings and maxStrings for separate container strings', () => {
		const player = new Player({
			itemXml: item.replace('responseIdentifier="MULTIPLE" minStrings="0"', 'responseIdentifier="MULTIPLE" minStrings="2"'),
		});

		expect(player.validateResponses({ MULTIPLE: ['one'] }).entries.MULTIPLE.complete).toBe(false);
		expect(player.validateResponses({ MULTIPLE: ['one', 'two'] }).entries.MULTIPLE.complete).toBe(true);
		const tooMany = player.validateResponses({ MULTIPLE: ['one', 'two', 'three', 'four'] });
		expect(tooMany.valid).toBe(false);
		expect(tooMany.entries.MULTIPLE.errors).toContain("Response 'MULTIPLE' exceeds maxStrings=3");
	});
});
