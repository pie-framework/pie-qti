/**
 * The `stringComparison` delivery option through the assessment player. QTI compares string
 * answers exactly; a host whose candidates type with input methods that add invisible marks or
 * presentation forms opts in to folding them. The option is set where scoring runs: on the
 * player, for the candidate's live item sessions (an adaptive item's outcomes are taken from
 * them as submitted), and on the scoring backend or scorer, which re-runs response processing.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { scoreAssessmentItem } from '../src/integration/assessment-item-scorer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const wordItem = (identifier: string, adaptive: boolean) => `<assessmentItem ${NS} identifier="${identifier}" title="Word" adaptive="${adaptive}" timeDependent="false" xml:lang="ar">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"><correctResponse><value>كتاب</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><p><textEntryInteraction responseIdentifier="RESPONSE"/></p></itemBody>
  <responseProcessing>
    <responseCondition><responseIf>
      <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      <setOutcomeValue identifier="completionStatus"><baseValue baseType="identifier">completed</baseValue></setOutcomeValue>
    </responseIf></responseCondition>
  </responseProcessing>
</assessmentItem>`;

const testXml = (identifier: string) => `<assessmentTest ${NS} identifier="${identifier}" title="String comparison">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section 1" visible="true">
      <assessmentItemRef identifier="w1" href="w1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

/** كتاب typed with a right-to-left mark and tatweel, as some Arabic input methods produce it. */
const TYPED = '\u200F\u0643\u0640\u0640\u062A\u0627\u0628';
const FOLD_SCRIPT_INPUT = { foldScriptInput: true } as const;

afterEach(() => localStorage.clear());

describe('scoreAssessmentItem', () => {
	const itemXml = wordItem('w1', false);

	test('compares a string answer exactly by default', () => {
		expect(scoreAssessmentItem({ itemXml, responses: { RESPONSE: TYPED } }).score).toBe(0);
		expect(scoreAssessmentItem({ itemXml, responses: { RESPONSE: 'كتاب' } }).score).toBe(1);
	});

	test('folds script input when the scorer is asked to', () => {
		expect(
			scoreAssessmentItem({ itemXml, responses: { RESPONSE: TYPED }, stringComparison: FOLD_SCRIPT_INPUT }).score,
		).toBe(1);
	});
});

describe('ReferenceBackendAdapter', () => {
	async function submitted(options: ConstructorParameters<typeof ReferenceBackendAdapter>[0], identifier: string) {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml(identifier), {
			itemXmlMap: { 'w1.xml': wordItem('w1', false) },
		});
		const backend = new ReferenceBackendAdapter(options);
		backend.registerAssessment(parsed.identifier, parsed);
		const init = await backend.initSession({ assessmentId: parsed.identifier, candidateId: 'candidate' });
		const response = await backend.submitResponses({
			sessionId: init.sessionId,
			itemIdentifier: 'w1',
			responses: { RESPONSE: TYPED },
			submittedAt: Date.now(),
		});
		return response.result?.score;
	}

	test('scores string answers exactly by default', async () => {
		expect(await submitted({}, 'backend-exact')).toBe(0);
	});

	test('folds script input with its stringComparison option', async () => {
		expect(await submitted({ stringComparison: FOLD_SCRIPT_INPUT }, 'backend-folded')).toBe(1);
	});
});

describe('AssessmentPlayer', () => {
	// The backend takes an adaptive item's outcomes as submitted, so they show how the player's
	// live item session compared the answer.
	async function adaptiveScore(stringComparison: typeof FOLD_SCRIPT_INPUT | undefined, identifier: string) {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml(identifier), {
			itemXmlMap: { 'w1.xml': wordItem('w1', true) },
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			...(stringComparison ? { stringComparison } : {}),
		});
		try {
			await player.navigateTo(0);
			player.updateResponse('RESPONSE', TYPED);
			const results = await player.submit();
			return results.itemResults.find((result) => result.itemIdentifier === 'w1')?.score;
		} finally {
			player.destroy();
		}
	}

	test('live item sessions compare string answers exactly by default', async () => {
		expect(await adaptiveScore(undefined, 'player-exact')).toBe(0);
	});

	test('live item sessions fold script input with the player option', async () => {
		expect(await adaptiveScore(FOLD_SCRIPT_INPUT, 'player-folded')).toBe(1);
	});
});
