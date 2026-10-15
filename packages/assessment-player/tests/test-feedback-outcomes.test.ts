/**
 * Test feedback in delivery: a QTI 2.2 assessmentTest and its QTI 3.0 twin show test-level and
 * test-part feedback by single and multiple outcomes, `during` while the test runs and `atEnd`
 * once the test or its part has ended.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const item = (identifier: string) => `<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing>
    <responseCondition><responseIf>
      <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
    </responseIf></responseCondition>
  </responseProcessing>
</assessmentItem>`;

const fb = (access: string, outcome: string, identifier: string, text: string, showHide = 'show') =>
	`<testFeedback access="${access}" outcomeIdentifier="${outcome}" identifier="${identifier}" showHide="${showHide}"><p>${text}</p></testFeedback>`;

const grade = (min: number, value: string) =>
	`<gte><variable identifier="TOTAL"/><baseValue baseType="float">${min}</baseValue></gte>
      <setOutcomeValue identifier="GRADE"><baseValue baseType="identifier">${value}</baseValue></setOutcomeValue>`;

const flags = (...values: string[]) =>
	`<setOutcomeValue identifier="FLAGS"><multiple>${values.map((v) => `<baseValue baseType="identifier">${v}</baseValue>`).join('')}</multiple></setOutcomeValue>`;

const QTI22 = `<assessmentTest ${NS} identifier="feedback-test" title="Feedback test">
  <outcomeDeclaration identifier="TOTAL" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <outcomeDeclaration identifier="GRADE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="FLAGS" cardinality="multiple" baseType="identifier"/>
  <testPart identifier="part-1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="One" visible="true">
      <assessmentItemRef identifier="item-1" href="item-1.xml"/>
      <assessmentItemRef identifier="item-2" href="item-2.xml"/>
    </assessmentSection>
    ${fb('atEnd', 'FLAGS', 'SEEN', 'Part 1 done')}
    ${fb('during', 'FLAGS', 'RIGHT', 'Part 1 right')}
  </testPart>
  <testPart identifier="part-2" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="section-2" title="Two" visible="true">
      <assessmentItemRef identifier="item-3" href="item-3.xml"/>
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="TOTAL"><sum><testVariables variableIdentifier="SCORE"/></sum></setOutcomeValue>
    <outcomeCondition>
      <outcomeIf>${grade(3, 'A')}</outcomeIf>
      <outcomeElseIf>${grade(1, 'B')}</outcomeElseIf>
      <outcomeElse><setOutcomeValue identifier="GRADE"><baseValue baseType="identifier">C</baseValue></setOutcomeValue></outcomeElse>
    </outcomeCondition>
    <outcomeCondition>
      <outcomeIf><gte><variable identifier="TOTAL"/><baseValue baseType="float">1</baseValue></gte>${flags('SEEN', 'RIGHT')}</outcomeIf>
      <outcomeElse>${flags('SEEN')}</outcomeElse>
    </outcomeCondition>
  </outcomeProcessing>
  ${fb('during', 'FLAGS', 'RIGHT', 'Right so far')}
  ${fb('atEnd', 'GRADE', 'A', 'Grade A')}
  ${fb('atEnd', 'GRADE', 'B', 'Grade B')}
  ${fb('atEnd', 'GRADE', 'C', 'Grade C')}
  ${fb('atEnd', 'GRADE', 'A', 'Not A', 'hide')}
</assessmentTest>`;

/** QTI 3 test feedback carries its content in qti-content-body. */
const QTI30 = convertQti2ToQti3(QTI22).replace(
	/(<qti-test-feedback[^>]*>)([\s\S]*?)(<\/qti-test-feedback>)/g,
	'$1<qti-content-body>$2</qti-content-body>$3',
);

const ITEMS = { 2.2: item, '3.0': (id: string) => convertQti2ToQti3(item(id)) };

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

async function deliver(xml: string, version: keyof typeof ITEMS) {
	const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, {
		itemXmlMap: Object.fromEntries(['item-1', 'item-2', 'item-3'].map((id) => [`${id}.xml`, ITEMS[version](id)])),
	});
	const backend = new ReferenceBackendAdapter();
	const orig = (backend as any).runOutcomeProcessing.bind(backend);
	(backend as any).runOutcomeProcessing = (a: any, sc: any) => { const r = orig(a, sc); console.log('OP', JSON.stringify(Object.values(sc).map((x: any) => [x.itemIdentifier, x.score, x.outcomeValues])), JSON.stringify(r)); return r; };
	backend.registerAssessment(assessment.identifier, assessment);
	let sessionId = '';
	const initSession = backend.initSession.bind(backend);
	backend.initSession = async (request) => {
		const response = await initSession(request);
		sessionId = response.sessionId;
		return response;
	};
	const open = async (resumeSessionId?: string) => {
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'candidate', resumeSessionId },
		});
		players.push(player);
		return player;
	};
	const player = await open();
	let changes = 0;
	player.onTestFeedbackChange(() => changes++);
	const shown = (from = player) =>
		from.getVisibleFeedback().map((entry) => entry.content.replace(/<[^>]+>/g, '').trim());
	return { assessment, player, open, shown, sessionId: () => sessionId, changes: () => changes };
}

describe.each([
	['QTI 2.2', QTI22, 2.2],
	['QTI 3.0', QTI30, '3.0'],
] as const)('%s test feedback', (_version, xml, version) => {
	test('parses test-level and test-part feedback', async () => {
		const { assessment } = await deliver(xml, version);
		expect(assessment.testFeedback?.map((entry) => [entry.access, entry.identifier, entry.showHide])).toEqual([
			['during', 'RIGHT', 'show'],
			['atEnd', 'A', 'show'],
			['atEnd', 'B', 'show'],
			['atEnd', 'C', 'show'],
			['atEnd', 'A', 'hide'],
		]);
		expect(
			assessment.testParts[0].testFeedback?.map((entry) => [
				entry.access,
				entry.outcomeIdentifier,
				entry.identifier,
				entry.content.replace(/<[^>]+>/g, ''),
			]),
		).toEqual([
			['atEnd', 'FLAGS', 'SEEN', 'Part 1 done'],
			['during', 'FLAGS', 'RIGHT', 'Part 1 right'],
		]);
		expect(assessment.testParts[1].testFeedback).toBeUndefined();
	});

	test('shows during feedback by membership as outcomes change and atEnd feedback at each end', async () => {
		const { player, shown, changes } = await deliver(xml, version);
		expect(shown()).toEqual([]);

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(shown()).toEqual(['Right so far', 'Part 1 right']);

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(shown()).toEqual(['Right so far', 'Part 1 done']);

		player.updateResponse('RESPONSE', 'A');
		const results = await player.submit();
		expect(shown()).toEqual(['Right so far', 'Grade A', 'Part 1 done']);
		expect(results.itemResults.map((result) => result.itemIdentifier).sort()).toEqual(['item-1', 'item-2', 'item-3']);
		expect(changes()).toBeGreaterThanOrEqual(4);

		const keys = player.getVisibleFeedback().map((entry) => entry.key);
		expect(new Set(keys).size).toBe(keys.length);
		expect(player.getVisibleFeedback()[2]).toMatchObject({ testPartIdentifier: 'part-1', access: 'atEnd' });
	});

	test('matches a single outcome by equality and inverts showHide="hide"', async () => {
		const { player, shown } = await deliver(xml, version);
		for (let index = 0; index < 2; index++) {
			player.updateResponse('RESPONSE', 'B');
			await player.next();
		}
		expect(shown()).toEqual(['Part 1 done']);
		player.updateResponse('RESPONSE', 'B');
		await player.submit();
		expect(shown()).toEqual(['Grade C', 'Not A', 'Part 1 done']);
	});

	test('a resumed session shows the feedback its outcomes select', async () => {
		const { player, open, shown, sessionId } = await deliver(xml, version);
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		const resumed = await open(sessionId());
		expect(shown(resumed)).toEqual(['Right so far', 'Part 1 right']);
	});
});
