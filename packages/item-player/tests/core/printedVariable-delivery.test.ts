/**
 * printedVariable in delivery: a QTI 2.2 item and its QTI 3.0 twin print the same values, with
 * the same formatting, in the item body, a rubric block and modal feedback.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { Player } from '../../src/core/Player.js';

const QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="printed" title="Printed"
  adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
  <templateDeclaration identifier="PI" cardinality="single" baseType="float">
    <defaultValue><value>3.14159</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="BIG" cardinality="single" baseType="float">
    <defaultValue><value>123456</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="SEQ" cardinality="ordered" baseType="integer">
    <defaultValue><value>10</value><value>20</value><value>30</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="POS" cardinality="single" baseType="integer">
    <defaultValue><value>2</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="N" cardinality="single" baseType="integer">
    <defaultValue><value>255</value></defaultValue>
  </templateDeclaration>
  <templateDeclaration identifier="REC" cardinality="record">
    <defaultValue>
      <value fieldIdentifier="mass" baseType="float">2.5</value>
      <value fieldIdentifier="unit" baseType="string">kg</value>
    </defaultValue>
  </templateDeclaration>
  <itemBody>
    <p class="pi">Pi is <printedVariable identifier="PI" format="%.2f"/>.</p>
    <p class="seq">Second <printedVariable identifier="SEQ" index="POS"/>, third <printedVariable identifier="SEQ" index="3"/>, all <printedVariable identifier="SEQ" delimiter=", "/>.</p>
    <p class="rec">Mass <printedVariable identifier="REC" field="mass" format="%.1f"/> <printedVariable identifier="REC" field="unit"/>; <printedVariable identifier="REC" mappingIndicator=": " delimiter=", "/></p>
    <p class="big"><printedVariable identifier="BIG" format="%.2e" powerForm="true"/></p>
    <p class="hex"><printedVariable identifier="N" format="%#x"/> <printedVariable identifier="N" format="%i" base="2"/></p>
    <rubricBlock view="candidate"><p class="rubric">Round to <printedVariable identifier="PI" format="%.1f"/>.</p></rubricBlock>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">DONE</baseValue></setOutcomeValue>
  </responseProcessing>
  <modalFeedback outcomeIdentifier="FEEDBACK" identifier="DONE" showHide="show">Pi was <printedVariable identifier="PI" format="%.3f"/>, the second value <printedVariable identifier="SEQ" index="2"/>, the unit <printedVariable identifier="REC" field="unit"/>.</modalFeedback>
</assessmentItem>`;

const QTI30 = convertQti2ToQti3(QTI22);

const text = (html: unknown) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/** Markup without namespace declarations, which differ by QTI version. */
const markup = (html: unknown) => String(html).replace(/\s+xmlns="[^"]*"/g, '');

function render(xml: string) {
	const player = new Player({ itemXml: xml });
	const body = String(player.getItemBodyHtml());
	const rubrics = player.getRubrics().map((rubric) => markup(rubric.html));
	player.setResponses({ RESPONSE: 'A' });
	const feedback = player.processResponses().modalFeedback?.map((entry) => text(entry.content));
	return { body, rubrics, feedback };
}

describe('printedVariable in delivery', () => {
	test.each([
		['QTI 2.2', QTI22],
		['QTI 3.0', QTI30],
	])('%s prints formatted, indexed and record values', (_version, xml) => {
		const { body, rubrics, feedback } = render(xml);
		expect(text(body)).toContain('Pi is 3.14.');
		expect(text(body)).toContain('Second 20, third 30, all 10, 20, 30.');
		expect(text(body)).toContain('Mass 2.5 kg; mass: 2.5, unit: kg');
		expect(body).toContain('1.23 × 10<sup>5</sup>');
		expect(text(body)).toContain('0xff 11111111');
		expect(body).not.toMatch(/printed-?variable/i);
		expect(rubrics).toEqual(['<p class="rubric">Round to 3.1.</p>']);
		expect(feedback).toEqual(['Pi was 3.142, the second value 20, the unit kg.']);
	});

	test('the QTI 3.0 twin renders the same text as the QTI 2.2 item', () => {
		const qti22 = render(QTI22);
		const qti30 = render(QTI30);
		expect(text(qti30.body)).toBe(text(qti22.body));
		expect(qti30.rubrics).toEqual(qti22.rubrics);
		expect(qti30.feedback).toEqual(qti22.feedback);
	});

	test('reprints when template variables change', () => {
		const player = new Player({ itemXml: QTI30 });
		player.setTemplateVariables({ PI: 2.468, POS: 1 });
		const body = text(player.getItemBodyHtml());
		expect(body).toContain('Pi is 2.47.');
		expect(body).toContain('Second 10,');
	});
});
