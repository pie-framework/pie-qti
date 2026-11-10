/**
 * Phase 5 pinning tests (player-cleanup plan): the integrator listener order
 * during a move — item → section → test feedback — is synchronous (no microtask
 * or await between the three notifications of one navigation report) and every
 * notification lands before the move's promise resolves. The relative order of
 * the outcomes-driven test-feedback report of a counted submission (it precedes
 * the navigation report) is pinned too: the decomposition must keep what
 * listeners observe today.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment } from '../src/integration/api-contract.js';

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

const choiceItemXml = (identifier: string) =>
	`<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="Choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="1"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** Two parts of two items each, nonlinear, so delivery can move within and across parts. */
function assessment(options: { outcomeProcessing?: boolean } = {}): SecureAssessment {
	return {
		identifier: 'listener-order',
		title: 'Listener order',
		navigationMode: 'nonlinear',
		submissionMode: 'individual',
		...(options.outcomeProcessing
			? {
				outcomeDeclarations: [
					{ identifier: 'SCORE_TOTAL', baseType: 'float', cardinality: 'single', defaultValue: 0 },
				],
				outcomeProcessingXml: `<outcomeProcessing xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2">
  <setOutcomeValue identifier="SCORE_TOTAL">
    <sum>
      <testVariables variableIdentifier="SCORE"/>
      <variable identifier="SCORE_TOTAL"/>
    </sum>
  </setOutcomeValue>
</outcomeProcessing>`,
			}
			: {}),
		testParts: [1, 2].map((part) => ({
			identifier: `part-${part}`,
			navigationMode: 'nonlinear',
			submissionMode: 'individual' as const,
			sections: [
				{
					identifier: `section-${part}`,
					title: `Section ${part}`,
					visible: true,
					assessmentItemRefs: [1, 2].map((offset) => {
						const identifier = `item-${(part - 1) * 2 + offset}`;
						return { identifier, role: 'candidate' as const, itemXml: choiceItemXml(identifier) };
					}),
				},
			],
		})),
	};
}

async function fixture(options: { submissionMode?: 'individual' | 'simultaneous'; outcomeProcessing?: boolean } = {}) {
	const parsed = assessment(options);
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
	});
	players.push(player);
	await player.navigateTo(0);
	return player;
}

/**
 * Record the navigation listeners with the synchrony evidence:
 * - each call notes whether the observed move had already resolved;
 * - each call schedules a microtask marker, so an await between two
 *   notifications would surface as the markers interleaving with them.
 */
function record(player: AssessmentPlayer) {
	const settled = { value: false };
	const events: string[] = [];
	const settledAtCall: boolean[] = [];
	const watch = (name: string) => () => {
		events.push(name);
		settledAtCall.push(settled.value);
		queueMicrotask(() => events.push(`after-${name}`));
	};
	player.onItemChange(watch('item'));
	player.onSectionChange(watch('section'));
	player.onTestFeedbackChange(watch('feedback'));
	return { events, settledAtCall, settled };
}

describe('navigation listener order', () => {
	test('a part-crossing move reports item, section, then test feedback — synchronously, before the move resolves', async () => {
		const player = await fixture();
		// Walk to the end of part 1 without submitting anything.
		await player.navigateTo(1);

		const { events, settledAtCall, settled } = record(player);
		const move = player.navigateTo(2).then(() => {
			settled.value = true;
		});
		await move;

		// The three notifications of one navigation report, in order, and each
		// pair in one synchronous block (no marker interleaved between them).
		expect(events).toEqual(['item', 'section', 'feedback', 'after-item', 'after-section', 'after-feedback']);
		// Every notification ran while the move was still unresolved.
		expect(settledAtCall).toEqual([false, false, false]);
		expect(player.getNavigationState().currentIndex).toBe(2);
	});

	test('a move inside one part reports item then section, and no test feedback', async () => {
		const player = await fixture();
		const { events, settledAtCall } = record(player);

		const move = player.navigateTo(1).then(() => {});
		await move;

		expect(events).toEqual(['item', 'section', 'after-item', 'after-section']);
		expect(settledAtCall).toEqual([false, false]);
	});

	test('crossing a simultaneous part reports the navigation order once, after the whole part flushed', async () => {
		const player = await fixture({ submissionMode: 'simultaneous' });
		await player.navigateTo(1);

		const { events, settledAtCall } = record(player);
		const move = player.next().then(() => {
			// The crossing move is settled only after the flush and the hop.
		});
		await move;

		// The flush's submissions report nothing themselves (this test carries no
		// test outcomes): the crossing reports item, section, then the part change.
		expect(events).toEqual(['item', 'section', 'feedback', 'after-item', 'after-section', 'after-feedback']);
		expect(settledAtCall).toEqual([false, false, false]);
		expect(player.getNavigationState().currentIndex).toBe(2);
	});

	test('a counted submission with test outcomes reports test feedback before the navigation report', async () => {
		const player = await fixture({ outcomeProcessing: true });
		const { events, settledAtCall } = record(player);

		player.updateResponse('RESPONSE', 'A');
		await player.next();

		// The outcomes update of the submission fires first; the move's own report
		// follows (same part, so no second feedback).
		expect(events).toEqual(['feedback', 'item', 'section', 'after-feedback', 'after-item', 'after-section']);
		expect(settledAtCall).toEqual([false, false, false]);
		expect(player.getNavigationState().currentIndex).toBe(1);
	});

	test('listeners receive the destination indexes and totals', async () => {
		const player = await fixture();
		const items: Array<[number, number]> = [];
		const sections: Array<[number, number]> = [];
		player.onItemChange((index, total) => items.push([index, total]));
		player.onSectionChange((index, total) => sections.push([index, total]));

		await player.navigateTo(1);
		await player.navigateTo(2);

		expect(items.at(-1)).toEqual([2, 4]);
		expect(sections.at(-1)).toEqual([1, 2]);
	});
});
