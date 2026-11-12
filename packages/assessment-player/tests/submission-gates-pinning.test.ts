/**
 * Phase 5 pinning tests (player-cleanup plan): the client-side submission gates
 * run before any backend request. A refused move — the part-leave gate (an
 * unanswered question holding the way out of the part) or a minimum-time
 * refusal — makes no `submitResponses` call at all, leaves delivery where it
 * was, and a satisfied gate goes through with exactly the submission the move
 * carries.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment, SubmitResponsesRequest } from '../src/integration/api-contract.js';

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

async function fixture(options: {
	allowSkipping?: boolean;
	itemTimeLimits?: Record<string, string>;
} = {}) {
	const assessment: SecureAssessment = {
		identifier: 'submission-gates',
		title: 'Submission gates',
		navigationMode: 'nonlinear',
		submissionMode: 'individual',
		testParts: [
			{
				identifier: 'part-1',
				navigationMode: 'nonlinear',
				submissionMode: 'individual',
				...(options.allowSkipping === undefined ? {} : { itemSessionControl: { allowSkipping: options.allowSkipping } }),
				sections: [
					{
						identifier: 'section-1',
						visible: true,
						assessmentItemRefs: ['item-1', 'item-2'].map((identifier) => ({
							identifier,
							role: 'candidate' as const,
							itemXml: choiceItemXml(identifier),
							...(options.itemTimeLimits?.[identifier]
								? { timeLimits: parseLimits(options.itemTimeLimits[identifier]!) }
								: {}),
						})),
					},
				],
			},
			{
				identifier: 'part-2',
				navigationMode: 'nonlinear',
				submissionMode: 'individual',
				sections: [
					{
						identifier: 'section-2',
						visible: true,
						assessmentItemRefs: [
							{ identifier: 'item-3', role: 'candidate' as const, itemXml: choiceItemXml('item-3') },
						],
					},
				],
			},
		],
	};
	let now = 1_000;
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const calls: SubmitResponsesRequest[] = [];
	const submit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request) => {
		calls.push(structuredClone(request));
		return submit(request);
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		now: () => now,
	});
	players.push(player);
	await player.navigateTo(0);
	return {
		player,
		calls,
		advance: (ms: number) => {
			now += ms;
		},
	};
}

function parseLimits(xml: string): { minTime?: number; maxTime?: number; allowLateSubmission?: boolean } {
	const minTime = /minTime="(\d+)"/.exec(xml)?.[1];
	const maxTime = /maxTime="(\d+)"/.exec(xml)?.[1];
	const allowLateSubmission = /allowLateSubmission="(true|false)"/.exec(xml)?.[1];
	return {
		...(minTime ? { minTime: Number(minTime) } : {}),
		...(maxTime ? { maxTime: Number(maxTime) } : {}),
		...(allowLateSubmission ? { allowLateSubmission: allowLateSubmission === 'true' } : {}),
	};
}

describe('part-leave gate', () => {
	test('an unanswered question holds the way out of the part: refusal with no backend call', async () => {
		const { player, calls } = await fixture({ allowSkipping: false });

		// On the part's last item; item-1 was never answered, and skipping is off.
		await player.navigateTo(1);
		expect(calls).toHaveLength(0);
		player.updateResponse('RESPONSE', 'A');

		await expect(player.next()).rejects.toThrow('These items need a response before leaving this test part: item-1');

		// Nothing was submitted and delivery stayed inside the part.
		expect(calls).toHaveLength(0);
		expect(player.getState().currentItemIdentifier).toBe('item-2');
	});

	test('once the question is answered the move goes through, carrying its own submission only', async () => {
		const { player, calls } = await fixture({ allowSkipping: false });

		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		await expect(player.next()).rejects.toThrow('These items need a response before leaving this test part');

		// Answer item-1, return to item-2, and leave the part.
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(1);
		await player.next();

		// Exactly one backend request: the move's own submission (item-2). item-1's
		// answer stays local — an individual part submits it at the end of the test.
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['item-2']);
		expect(player.getState().currentItemIdentifier).toBe('item-3');
	});
});

describe('minimum-time refusal', () => {
	test('an item minTime refusal rejects the submission with no backend call', async () => {
		const { player, calls, advance } = await fixture({ itemTimeLimits: { 'item-1': '<timeLimits minTime="30"/>' } });

		player.updateResponse('RESPONSE', 'A');
		await expect(player.next()).rejects.toThrow('The item minimum time has not elapsed');

		expect(calls).toHaveLength(0);
		expect(player.getState().currentItemIdentifier).toBe('item-1');
		// The refused answer is kept for the retry.
		expect(player.getResponses()).toMatchObject({ RESPONSE: 'A' });

		advance(30_000);
		await player.next();
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['item-1']);
		expect(calls[0]!.responses).toMatchObject({ RESPONSE: 'A' });
		expect(player.getState().currentItemIdentifier).toBe('item-2');
	});
});
