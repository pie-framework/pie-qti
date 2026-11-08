/**
 * Round-3 delivery fixes in the core:
 * - attempt-relative feedback (QTI maxAttempts > 1: feedback for every non-final attempt
 *   shows; after the last attempt `showFeedback` governs), for the item presentation,
 *   the captured item feedback and the check-answer control;
 * - templateDefault in nonlinear parts: evaluated once at test-part entry for every item
 *   ref, other items' variables in scope (linear parts keep per-item evaluation);
 * - visited marks restored from a backend snapshot at creation.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment, SecureItemRef } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

/** Modal feedback per outcome plus an integrated feedbackInline, keyed B. */
const practiceItem = (identifier: string, control: SecureItemRef['itemSessionControl']): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemSessionControl: control,
	itemXml: `<assessmentItem ${NS} identifier="${identifier}" title="Practice ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>B</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"><defaultValue><value>none</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">3</simpleChoice><simpleChoice identifier="B">4</simpleChoice></choiceInteraction>
    <p><feedbackInline outcomeIdentifier="FEEDBACK" identifier="incorrect" showHide="show">Inline: try again</feedbackInline></p>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">incorrect</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
  <modalFeedback identifier="correct" outcomeIdentifier="FEEDBACK" showHide="show"><p>Nice work.</p></modalFeedback>
  <modalFeedback identifier="incorrect" outcomeIdentifier="FEEDBACK" showHide="show"><p>Check your addition.</p></modalFeedback>
</assessmentItem>`,
});

async function practiceFixture(items: SecureItemRef[]) {
	const assessment: SecureAssessment = {
		identifier: 'round3-feedback',
		title: 'Attempt-relative feedback',
		navigationMode: 'nonlinear',
		submissionMode: 'individual',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'individual',
				sections: [{ identifier: 'section-1', visible: true, assessmentItemRefs: items }],
			},
		],
	};
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
	});
	players.push(player);
	return { player, backend };
}

const flowHtml = (p: AssessmentPlayer) =>
	p
		.getCurrentItemSession()!
		.present()
		.flow.filter((node) => node.kind === 'html')
		.map((node) => (node.kind === 'html' ? String(node.html) : ''))
		.join('');

describe('attempt-relative feedback (maxAttempts > 1)', () => {
	it('shows feedback for a non-final attempt even when showFeedback=false; the last attempt follows showFeedback', async () => {
		const { player } = await practiceFixture([practiceItem('p1', { showFeedback: false, maxAttempts: 2 })]);

		// The check control exists: feedback will be shown for the non-final attempt.
		expect(player.getCheckAnswerState()).toMatchObject({ available: true, maxAttempts: 2, reason: null });

		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		// Attempt 1 of 2 (non-final): modal and integrated feedback are visible.
		expect(player.getLastItemFeedback()?.feedback.map((entry) => entry.identifier)).toEqual(['incorrect']);
		expect(flowHtml(player)).toContain('Inline: try again');

		player.clearLastItemFeedback();
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		// Attempt 2 of 2 is the last one: showFeedback=false hides feedback from here on.
		expect(player.getLastItemFeedback()).toBeNull();
		expect(flowHtml(player)).not.toContain('Inline: try again');
		expect(player.getCheckAnswerState()).toMatchObject({ attemptsExhausted: true });
	});

	it('a single attempt with showFeedback=false still shows nothing and offers no control', async () => {
		const { player } = await practiceFixture([
			practiceItem('p1', { showFeedback: false }),
			practiceItem('p2', { showFeedback: false }),
		]);
		expect(player.getCheckAnswerState()).toMatchObject({ available: false, reason: 'feedbackOff' });
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getLastItemFeedback()).toBeNull();
	});

	it('showFeedback=true keeps feedback after the last attempt', async () => {
		const { player } = await practiceFixture([practiceItem('p1', { showFeedback: true, maxAttempts: 2 })]);
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		expect(player.getLastItemFeedback()?.feedback.map((entry) => entry.identifier)).toEqual(['incorrect']);
		expect(flowHtml(player)).toContain('Inline: try again');
	});
});

describe('templateDefault in nonlinear parts', () => {
	const templatedItem = (identifier: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="integer"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <templateDeclaration identifier="N" cardinality="single" baseType="integer"><defaultValue><value>1</value></defaultValue></templateDeclaration>
  <templateDeclaration identifier="DOUBLE" cardinality="single" baseType="integer"/>
  <templateProcessing>
    <setTemplateValue identifier="DOUBLE"><product><variable identifier="N"/><baseValue baseType="integer">2</baseValue></product></setTemplateValue>
  </templateProcessing>
  <itemBody><p>Value <printedVariable identifier="DOUBLE"/></p></itemBody>
  <responseProcessing><setOutcomeValue identifier="SCORE"><baseValue baseType="integer">5</baseValue></setOutcomeValue></responseProcessing>
</assessmentItem>`;

	const sourceItem = `<assessmentItem ${NS} identifier="src" title="src" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="integer"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing><setOutcomeValue identifier="SCORE"><baseValue baseType="integer">3</baseValue></setOutcomeValue></responseProcessing>
</assessmentItem>`;

	const xml = `<assessmentTest ${NS} identifier="tpl-part" title="Template defaults at part entry">
  <testPart identifier="part-1" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="s1" title="s1" visible="true">
      <assessmentItemRef identifier="src" href="src.xml"/>
    </assessmentSection>
  </testPart>
  <testPart identifier="part-2" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s2" title="s2" visible="true">
      <assessmentItemRef identifier="t1" href="t1.xml"><templateDefault templateIdentifier="N"><variable identifier="src.SCORE"/></templateDefault></assessmentItemRef>
      <assessmentItemRef identifier="t2" href="t2.xml"><templateDefault templateIdentifier="N"><variable identifier="t1.SCORE"/></templateDefault></assessmentItemRef>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

	it('evaluates every item ref default once at part entry, with other items\' variables in scope', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, {
			itemXmlMap: { 'src.xml': sourceItem, 't1.xml': templatedItem('t1'), 't2.xml': templatedItem('t2') },
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		});
		players.push(player);

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		// Part 2 entry: t1's default reads src.SCORE (3) → DOUBLE 6.
		expect(player.getCurrentItem()?.identifier).toBe('t1');
		expect(flowHtml(player)).toContain('6');

		// Submitting t1 sets t1.SCORE = 5, but t2's default was evaluated at part entry,
		// when t1 had no value yet: it is not re-evaluated on entering t2.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('t2');
		expect(flowHtml(player)).not.toContain('10');
	});
});

describe('visited marks after a reload', () => {
	it('a backend-restored snapshot keeps the visited marks without a host restoreState()', async () => {
		const choice = (identifier: string) =>
			`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;
		const assessment: SecureAssessment = {
			identifier: 'visited-reload',
			title: 'Visited marks',
			navigationMode: 'nonlinear',
			submissionMode: 'simultaneous',
			testParts: [
				{
					identifier: 'part-1',
					navigationMode: 'nonlinear',
					submissionMode: 'simultaneous',
					sections: [
						{
							identifier: 'section-1',
							visible: true,
							assessmentItemRefs: ['q1', 'q2', 'q3', 'q4'].map((identifier) => ({
								identifier,
								role: 'candidate' as const,
								itemXml: choice(identifier),
							})),
						},
					],
				},
			],
		};
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		const first = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		});
		players.push(first);
		await first.navigateTo(1);
		await first.navigateTo(2);
		await first.flushAutosave();
		const resumeSessionId = backend.latestSessionId(assessment.identifier, 'candidate');
		first.destroy();

		const resumed = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'candidate', resumeSessionId: resumeSessionId! },
		});
		players.push(resumed);
		const visited = Object.fromEntries(resumed.getReviewItems().map((item) => [item.identifier, item.visited]));
		expect(visited).toEqual({ q1: true, q2: true, q3: true, q4: false });
	});
});
