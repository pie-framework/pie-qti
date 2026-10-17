/**
 * G-24: a packaged assessment test whose items reference external processing fragments
 * through the public delivery path. The backend scores authoritatively with host-owned
 * sources, so this drives AssessmentPlayer, which compiles item definitions with a
 * package-contained fragment resolver derived from the item delivery context.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';
const XI = 'xmlns:xi="http://www.w3.org/2001/XInclude"';

const ITEM_XML = `<assessmentItem ${NS} identifier="q1" title="Fragment item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing ${XI}>
    <xi:include href="../fragments/score-choice.xml"/>
  </responseProcessing>
</assessmentItem>`;

const ITEM_MISSING_FRAGMENT_XML = `<assessmentItem ${NS} identifier="q1" title="Fragment item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing ${XI}>
    <xi:include href="../fragments/missing.xml">
      <xi:fallback><setOutcomeValue identifier="SCORE"><baseValue baseType="float">0.5</baseValue></setOutcomeValue></xi:fallback>
    </xi:include>
  </responseProcessing>
</assessmentItem>`;

// The top-level fragment includes the concrete program relative to its own package path.
const SCORE_CHOICE_XML = `<responseProcessing ${XI}>
  <xi:include href="match-correct.xml"/>
</responseProcessing>`;

const MATCH_CORRECT_XML = `<responseProcessing>
  <responseCondition>
    <responseIf>
      <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
    </responseIf>
  </responseCondition>
</responseProcessing>`;

const TEST_XML = `<assessmentTest ${NS} identifier="fragment-test" title="Fragment test">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="section-1" visible="true">
      <assessmentItemRef identifier="q1" href="items/q1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const packageFiles = () => ({
	'items/q1.xml': ITEM_XML,
	'fragments/score-choice.xml': SCORE_CHOICE_XML,
	'fragments/match-correct.xml': MATCH_CORRECT_XML,
});

describe('packaged processing fragments through public delivery', () => {
	let player: AssessmentPlayer | undefined;
	afterEach(() => {
		player?.destroy();
		player = undefined;
		localStorage.clear();
	});

	test('preloads nested item-relative fragments into the delivery context', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
			itemXmlMap: packageFiles(),
		});
		const itemRef = assessment.testParts[0].sections[0].assessmentItemRefs[0];
		expect(itemRef.deliveryContext?.processingFragments).toMatchObject({
			'fragments/score-choice.xml': expect.any(String),
			'fragments/match-correct.xml': expect.any(String),
		});
	});

	test('scores an item whose responseProcessing is an external fragment chain', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
			itemXmlMap: packageFiles(),
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		});

		await player.navigateTo(0);
		player.updateResponseForItem('q1', 'RESPONSE', 'A');
		await player.submitCurrentItem();

		expect(player.getCurrentItemSession()?.state().outcomes.SCORE).toBe(1);
	});

	test('uses authored xi:fallback content when a packaged fragment is missing', async () => {
		const assessment = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
			itemXmlMap: { 'items/q1.xml': ITEM_MISSING_FRAGMENT_XML },
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		});

		await player.navigateTo(0);
		player.updateResponseForItem('q1', 'RESPONSE', 'A');
		await player.submitCurrentItem();

		expect(player.getCurrentItemSession()?.state().outcomes.SCORE).toBe(0.5);
	});
});
