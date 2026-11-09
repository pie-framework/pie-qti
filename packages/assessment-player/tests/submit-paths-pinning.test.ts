/**
 * Phase 5 pinning tests (player-cleanup plan): the submit paths before the
 * orchestrator decomposition moves them. Every combination of test-part
 * submission mode (individual vs simultaneous) × backend behaviour (returns or
 * omits the `updatedState` snapshot) is pinned by the state it leaves behind:
 * attempts (numAttempts), visitedItems order, itemScores and allowReview. The
 * failing-backend invariants are pinned too: an individual submission commits
 * nothing, a simultaneous flush keeps its already-accepted items.
 *
 * These tests pin TODAY's behaviour on purpose; a decomposition PR must keep
 * them green unchanged.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type {
	SecureAssessment,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
} from '../src/integration/api-contract.js';

type SubmissionMode = 'individual' | 'simultaneous';
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

interface FixtureOptions {
	/** Item-ref itemSessionControl overrides, keyed by item identifier. */
	itemSessionControl?: Record<string, { allowReview?: boolean; maxAttempts?: number }>;
	/** Fail the first submission of this item once (a backend outage), then heal. */
	failItemOnce?: string;
	/** Strip the backend-authoritative `updatedState` from every submission result. */
	omitUpdatedState?: boolean;
}

interface RecordedRequest extends SubmitResponsesRequest {
	/** Wall-clock order of the request within the whole test. */
	order: number;
}

/**
 * Two test parts of two choice items each; the part's `submissionMode` is
 * authoritative. The reference backend is wrapped so a test controls what a
 * submission returns: the reference answer always carries `updatedState`
 * (backend-authoritative session state); the omit variant exercises a backend
 * that scores without returning one.
 */
async function fixture(modes: SubmissionMode[], options: FixtureOptions = {}) {
	const assessment: SecureAssessment = {
		identifier: 'submit-paths',
		title: 'Submit path pinning',
		navigationMode: 'nonlinear',
		submissionMode: modes[0]!,
		testParts: modes.map((submissionMode, part) => ({
			identifier: `part-${part + 1}`,
			navigationMode: 'nonlinear',
			submissionMode,
			sections: [
				{
					identifier: `section-${part + 1}`,
					visible: true,
					assessmentItemRefs: [0, 1].map((offset) => {
						const identifier = `item-${part * 2 + offset + 1}`;
						return {
							identifier,
							role: 'candidate' as const,
							itemXml: choiceItemXml(identifier),
							...(options.itemSessionControl?.[identifier]
								? { itemSessionControl: options.itemSessionControl[identifier] }
								: {}),
						};
					}),
				},
			],
		})),
	};
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);

	let order = 0;
	const calls: RecordedRequest[] = [];
	const submit = backend.submitResponses.bind(backend);
	let failing: string | undefined = options.failItemOnce;
	backend.submitResponses = async (request): Promise<SubmitResponsesResponse> => {
		const recorded: RecordedRequest = { ...structuredClone(request), order: order++ };
		calls.push(recorded);
		if (request.itemIdentifier === failing) {
			failing = undefined;
			throw new Error('Temporary submission failure');
		}
		const result = await submit(request);
		if (options.omitUpdatedState) {
			const { updatedState: _omitted, ...rest } = result;
			return rest;
		}
		return result;
	};

	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
	});
	players.push(player);
	const submittedIds = () => calls.map((call) => call.itemIdentifier);
	return { player, backend, calls, submittedIds };
}

/** The attempt bookkeeping the player reports for an item after a submission path ran. */
function attemptsOf(player: AssessmentPlayer, itemIdentifier: string) {
	const state = player.getState();
	return {
		numAttempts: state.itemSessionStates?.[itemIdentifier]?.attemptCount,
		score: state.itemScores?.[itemIdentifier]?.score,
		visited: state.visitedItems,
	};
}

describe('individual submission path (next() submits the current item)', () => {
	for (const updatedState of ['returned', 'omitted'] as const) {
		test(`commits one attempt, the score and the visited mark (${updatedState} updatedState)`, async () => {
			const { player, calls, submittedIds } = await fixture(['individual', 'individual'], {
				omitUpdatedState: updatedState === 'omitted',
			});

			player.updateResponse('RESPONSE', 'A');
			await player.next();

			// Exactly one counted submission, for the current item.
			expect(submittedIds()).toEqual(['item-1']);
			expect(calls[0]!.countAttempt).toBe(true);
			expect(calls[0]!.responses).toMatchObject({ RESPONSE: 'A' });

			// numAttempts: the session controller counts one attempt, whatever the
			// backend did (a returned updatedState carries its own count, which must
			// not be counted twice). It is spent: no further submission for it.
			expect(attemptsOf(player, 'item-1')).toMatchObject({ numAttempts: 1, score: 1 });

			// visitedItems: the submitted item precedes the item delivery moved to.
			expect(attemptsOf(player, 'item-1').visited).toEqual(['item-1', 'item-2']);
			expect(player.getState().currentItemIdentifier).toBe('item-2');
			expect(player.getNavigationState().currentIndex).toBe(1);

			// Default allowReview=true: the answered item may be revisited.
			await player.navigateTo(0);
			expect(player.getNavigationState().currentIndex).toBe(0);
		});
	}

	for (const updatedState of ['returned', 'omitted'] as const) {
		test(`allowReview=false refuses the submitted item afterwards (${updatedState} updatedState)`, async () => {
			const { player } = await fixture(['individual', 'individual'], {
				omitUpdatedState: updatedState === 'omitted',
				itemSessionControl: { 'item-1': { allowReview: false } },
			});

			// Before any attempt the candidate may be there (the session info view is
			// the current item's: delivery stands on item-1).
			expect(player.getItemSessionInfo()?.canReview).toBe(true);

			player.updateResponse('RESPONSE', 'A');
			await player.next();

			// The attempt used the item's only one: allowReview now governs, and it is
			// off — the answered item can no longer be revisited.
			await expect(player.navigateTo(0)).rejects.toThrow('You cannot go back to previous questions');
			expect(player.getNavigationState().currentIndex).toBe(1);
		});
	}

	test('a failing backend commits nothing; a healed retry spends exactly one attempt', async () => {
		const { player, calls, submittedIds } = await fixture(['individual', 'individual'], {
			failItemOnce: 'item-1',
		});

		// The pre-submission baseline, read off the current item's session info.
		expect(player.getItemSessionInfo()).toMatchObject({ attemptCount: 0, remainingAttempts: 1, canSubmit: true });

		player.updateResponse('RESPONSE', 'A');
		await expect(player.next()).rejects.toThrow('Temporary submission failure');

		// Nothing committed: no attempt, no score, delivery stayed, answer kept
		// (the session info view is still item-1's: delivery never moved).
		expect(player.getItemSessionInfo()).toMatchObject({ attemptCount: 0, remainingAttempts: 1, canSubmit: true });
		expect(attemptsOf(player, 'item-1')).toMatchObject({ numAttempts: 0, score: undefined });
		expect(player.getState().currentItemIdentifier).toBe('item-1');
		expect(player.getResponses()).toMatchObject({ RESPONSE: 'A' });

		// The healed retry: one further request, one attempt in total.
		await player.next();
		expect(submittedIds()).toEqual(['item-1', 'item-1']);
		expect(calls[1]!.responses).toMatchObject({ RESPONSE: 'A' });
		expect(attemptsOf(player, 'item-1')).toMatchObject({ numAttempts: 1, score: 1 });
		expect(player.getState().currentItemIdentifier).toBe('item-2');
	});
});

describe('simultaneous submission path (crossing flushes the whole part)', () => {
	for (const updatedState of ['returned', 'omitted'] as const) {
		test(`submits the part in delivery order and commits both items (${updatedState} updatedState)`, async () => {
			const { player, calls, submittedIds } = await fixture(['simultaneous', 'individual'], {
				omitUpdatedState: updatedState === 'omitted',
			});

			// Moves inside the part submit nothing.
			player.updateResponse('RESPONSE', 'A');
			await player.next();
			expect(submittedIds()).toEqual([]);

			// Crossing out of the part flushes both items, in delivery order.
			player.updateResponse('RESPONSE', 'A');
			await player.next();
			expect(submittedIds()).toEqual(['item-1', 'item-2']);

			// Both items carry one attempt, the score, and the visited mark — in
			// submission (delivery) order, ahead of the item delivery landed on —
			// whatever the backend returned.
			expect(attemptsOf(player, 'item-1')).toMatchObject({ numAttempts: 1, score: 1 });
			expect(attemptsOf(player, 'item-2')).toMatchObject({ numAttempts: 1, score: 1 });
			expect(player.getState().visitedItems).toEqual(['item-1', 'item-2', 'item-3']);

			// Delivery moved into the next part.
			expect(player.getState().currentItemIdentifier).toBe('item-3');
			expect(player.getNavigationState().currentIndex).toBe(2);
		});
	}

	test('a failing flush keeps already-accepted items committed and retries only the rest', async () => {
		const { player, calls, submittedIds } = await fixture(['simultaneous', 'individual'], {
			failItemOnce: 'item-2',
		});

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		player.updateResponse('RESPONSE', 'A');
		await expect(player.next()).rejects.toThrow('Temporary submission failure');

		// item-1 was accepted first and stays committed; item-2 is not committed,
		// delivery stayed inside the part for a retry.
		expect(attemptsOf(player, 'item-1')).toMatchObject({ numAttempts: 1, score: 1 });
		expect(attemptsOf(player, 'item-2')).toMatchObject({ numAttempts: 0, score: undefined });
		expect(player.getState().currentItemIdentifier).toBe('item-2');
		expect(player.getState().visitedItems).toEqual(['item-1', 'item-2']);

		// The retry submits only what the backend has not accepted (identical
		// accepted responses are never re-sent), and delivery crosses then.
		await player.next();
		expect(submittedIds()).toEqual(['item-1', 'item-2', 'item-2']);
		expect(attemptsOf(player, 'item-2')).toMatchObject({ numAttempts: 1, score: 1 });
		expect(player.getState().currentItemIdentifier).toBe('item-3');
		expect(player.getState().visitedItems).toEqual(['item-1', 'item-2', 'item-3']);
	});
});

describe('submit paths on QTI 2.2 and converted QTI 3.0 deliveries', () => {
	const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';
	const VERSIONS = {
		'QTI 2.2': (xml: string) => xml,
		'QTI 3.0': (xml: string) => convertQti2ToQti3(xml),
	};
	type Version = keyof typeof VERSIONS;

	const partXml = (identifier: string, submissionMode: SubmissionMode, itemIds: string[]) =>
		`<testPart identifier="${identifier}" navigationMode="nonlinear" submissionMode="${submissionMode}">
  <assessmentSection identifier="s-${identifier}" title="${identifier}" visible="true">
    ${itemIds.map((id) => `<assessmentItemRef identifier="${id}" href="${id}.xml"/>`).join('\n    ')}
  </assessmentSection>
</testPart>`;
	const testXml = (mode: SubmissionMode) =>
		`<assessmentTest ${NS} identifier="submit-paths-versioned" title="Submit paths">
  ${partXml('part-1', mode, ['i1', 'i2'])}
  ${partXml('part-2', 'individual', ['i3'])}
</assessmentTest>`;
	const items = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, choiceItemXml(id)]));

	async function deliverVersioned(version: Version, mode: SubmissionMode) {
		const convert = VERSIONS[version];
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(convert(testXml(mode)), {
			itemXmlMap: Object.fromEntries(
				Object.entries(items(['i1', 'i2', 'i3'])).map(([id, xml]) => [`${id}.xml`, convert(xml)]),
			),
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const calls: RecordedRequest[] = [];
		const submit = backend.submitResponses.bind(backend);
		backend.submitResponses = async (request): Promise<SubmitResponsesResponse> => {
			calls.push({ ...structuredClone(request), order: 0 });
			// The omit variant: a backend that scores without returning its state.
			const result = await submit(request);
			const { updatedState: _omitted, ...rest } = result;
			return rest;
		};
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		});
		players.push(player);
		return { player, calls: () => calls.map((call) => call.itemIdentifier) };
	}

	for (const version of Object.keys(VERSIONS) as Version[]) {
		test(`[${version}] individual next() commits attempts, scores and visited marks`, async () => {
			const { player, calls } = await deliverVersioned(version, 'individual');
			player.updateResponse('RESPONSE', 'A');
			await player.next();
			expect(calls()).toEqual(['i1']);
			expect(attemptsOf(player, 'i1')).toMatchObject({ numAttempts: 1, score: 1 });
			expect(player.getState().visitedItems).toEqual(['i1', 'i2']);
		});

		test(`[${version}] crossing a simultaneous part flushes it in delivery order`, async () => {
			const { player, calls } = await deliverVersioned(version, 'simultaneous');
			player.updateResponse('RESPONSE', 'A');
			await player.next();
			expect(calls()).toEqual([]);
			player.updateResponse('RESPONSE', 'A');
			await player.next();
			expect(calls()).toEqual(['i1', 'i2']);
			expect(attemptsOf(player, 'i1')).toMatchObject({ numAttempts: 1, score: 1 });
			expect(attemptsOf(player, 'i2')).toMatchObject({ numAttempts: 1, score: 1 });
			expect(player.getState().currentItemIdentifier).toBe('i3');
		});
	}
});
