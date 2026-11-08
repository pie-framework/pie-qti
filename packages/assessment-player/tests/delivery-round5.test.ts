/**
 * Round-5 delivery integrity in the core:
 * - the end of the test never navigates: it collects where the candidate stands. A branch
 *   decision the end's own submission returns is kept on record, not followed (a candidate
 *   submit, a whole-test expiry's auto-finalize and a proctor force-submit alike), and a scope
 *   expiry while the end runs moves delivery only if that end does not complete;
 * - the leave-part gate holds only on questions the candidate can still reach;
 * - a scope expiry's move is never undone by the branch decision of a submission that was in
 *   flight when it happened, and a branch never re-enters a test part already left;
 * - an ending that collects a delivery the time closed is an `expiry` ending.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import {
	AssessmentPlayer,
	type AssessmentTimeExpiryEvent,
	type ScopeTimeExpiryEvent,
} from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type {
	FinalizeAssessmentResponse,
	SaveAssessmentStateRequest,
	SecureAssessment,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	SubmitResponsesRequest,
} from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

const ref = (identifier: string): SecureItemRef => ({ identifier, role: 'candidate', itemXml: choiceItem(identifier) });

const section = (identifier: string, items: SecureItemRef[], extra: Partial<SecureSection> = {}): SecureSection => ({
	identifier,
	visible: true,
	assessmentItemRefs: items,
	...extra,
});

const part = (identifier: string, sections: SecureSection[], extra: Partial<SecureTestPart> = {}): SecureTestPart => ({
	identifier,
	navigationMode: 'nonlinear',
	submissionMode: 'individual',
	sections,
	...extra,
});

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

interface CreateOptions {
	now?: () => number;
	timeLimits?: SecureAssessment['timeLimits'];
	adjust?: (backend: ReferenceBackendAdapter) => void;
	resumeSessionId?: string;
	backend?: ReferenceBackendAdapter;
}

async function create(parts: SecureTestPart[], options: CreateOptions = {}) {
	const assessment: SecureAssessment = {
		identifier: 'round5',
		title: 'Round five',
		navigationMode: parts[0]?.navigationMode ?? 'nonlinear',
		submissionMode: parts[0]?.submissionMode ?? 'individual',
		...(options.timeLimits ? { timeLimits: options.timeLimits } : {}),
		testParts: parts,
	};
	const calls: SubmitResponsesRequest[] = [];
	const saves: SaveAssessmentStateRequest[] = [];
	let backend = options.backend;
	if (!backend) {
		backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		const submit = backend.submitResponses.bind(backend);
		backend.submitResponses = async (request) => {
			calls.push(structuredClone(request));
			return submit(request);
		};
		const save = backend.saveState.bind(backend);
		backend.saveState = async (request) => {
			saves.push(structuredClone(request));
			return save(request);
		};
		options.adjust?.(backend);
	}
	const player = await AssessmentPlayer.create({
		backend,
		initSession: {
			assessmentId: assessment.identifier,
			candidateId: 'candidate',
			...(options.resumeSessionId ? { resumeSessionId: options.resumeSessionId } : {}),
		},
		...(options.now ? { now: options.now } : {}),
	});
	players.push(player);
	return { player, backend, calls, saves };
}

const realTick = () => new Promise((resolve) => setTimeout(resolve, 1_100));
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

type Coded = { code?: string; params?: Record<string, string | number> } | null;
const failureOf = (promise: Promise<unknown>): Promise<Coded> =>
	promise.then(
		() => null,
		(error: unknown) => error as Coded,
	);

const failedFinalize = (): FinalizeAssessmentResponse => ({
	success: false,
	totalScore: 0,
	maxScore: 0,
	itemScores: {},
	finalizedAt: Date.now(),
});

/** Finalize fails while `failing()` says so; otherwise the reference backend finalizes. */
const finalizeFailsWhile = (failing: () => boolean) => (backend: ReferenceBackendAdapter) => {
	const finalize = backend.finalizeAssessment.bind(backend);
	backend.finalizeAssessment = async (request) => (failing() ? failedFinalize() : finalize(request));
};

/** The backend decides `target` after submitting `itemIdentifier` (a production branch rule). */
const branchesTo = (itemIdentifier: string, target: string) => (backend: ReferenceBackendAdapter) => {
	const submit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request) => {
		const response = await submit(request);
		return request.itemIdentifier === itemIdentifier ? { ...response, nextItemIdentifier: target } : response;
	};
};

const threeItems = (control: SecureTestPart['itemSessionControl'] = {}) => [
	part('part-1', [section('s1', [ref('q1'), ref('q2'), ref('q3')])], { itemSessionControl: control }),
];

describe('the end of the test never navigates (1)', () => {
	it('G: a candidate submit from a non-last item fires no item change; the unseen question stays unvisited', async () => {
		const { player, calls, saves } = await create(threeItems());
		const changes: number[] = [];
		player.onItemChange((index) => changes.push(index));
		player.updateResponse('RESPONSE', 'A');

		const results = await player.submit();

		// The reference backend's next=q2 for q1 is not followed: delivery stays on q1.
		expect(changes).toEqual([]);
		expect(results.endReason).toBe('candidate');
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
		// The final snapshot (persisted before finalize) records where the candidate stood.
		const last = saves.at(-1)?.state;
		expect(last?.currentItemIdentifier).toBe('q1');
		expect(last?.visitedItems).toEqual(['q1']);
		expect(Object.keys(last?.itemSessions ?? {})).toEqual(['q1']);
	});

	it('H: a failed finalize leaves the candidate where they submitted from, so the retry finalizes', async () => {
		let failing = true;
		const { player } = await create(threeItems({ allowSkipping: false }), {
			adjust: finalizeFailsWhile(() => failing),
		});
		// q3 answered through a nonlinear jump, then q1; q2 is never presented.
		await player.navigateTo(2);
		player.updateResponse('RESPONSE', 'B');
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'A');
		expect(player.getSubmissionBlockers()).toEqual([]);

		expect((await failureOf(player.submit()))?.code).toBe('finalizeFailed');
		// The candidate was not moved onto the unseen q2, so it does not hold the retry.
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(player.getSubmissionBlockers()).toEqual([]);
		expect(player.getState().visitedItems).toEqual(['q1', 'q3']);

		failing = false;
		const results = await player.submit();
		expect(results.endReason).toBe('candidate');
		expect(player.isFinalized()).toBe(true);
	});

	it('the decision the end\'s own submission returned is kept: when the end does not complete, Next follows it', async () => {
		let failing = true;
		const { player, calls } = await create(threeItems(), {
			adjust: (backend) => {
				branchesTo('q1', 'q3')(backend);
				finalizeFailsWhile(() => failing)(backend);
			},
		});
		player.updateResponse('RESPONSE', 'A');
		expect((await failureOf(player.submit()))?.code).toBe('finalizeFailed');
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		// Next now means the backend's decision for q1 (q2 is skipped by its branch rule).
		expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 2, leavesTestPart: false });

		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('q3');
		// q1 was accepted once; following the decision re-submits nothing.
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
	});

	it('E3: a whole-test expiry auto-finalizing from a non-last item fires no item change', async () => {
		let now = 1_000;
		let failing = true;
		const { player, calls } = await create(
			[part('part-1', [section('s1', [ref('q1'), ref('q2')])], { itemSessionControl: { allowSkipping: false } })],
			{ now: () => now, timeLimits: { maxTime: 5 }, adjust: finalizeFailsWhile(() => failing) },
		);
		const changes: number[] = [];
		player.onItemChange((index) => changes.push(index));
		now += 6_000;
		await realTick();
		await settle();

		// The expiry collected q1 where the candidate stood; the backend's next=q2 was not followed.
		expect(changes).toEqual([]);
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(calls.map((call) => [call.itemIdentifier, call.timing?.submissionReason])).toEqual([['q1', 'time-expired']]);

		failing = false;
		await player.submit();
		expect(player.isFinalized()).toBe(true);
		expect(changes).toEqual([]);
	});

	it('a proctor force-submit from a non-last item fires no item change', async () => {
		const { player, calls } = await create(threeItems());
		const changes: number[] = [];
		player.onItemChange((index) => changes.push(index));
		player.updateResponse('RESPONSE', 'A');

		const results = await player.submit({ force: true });

		expect(changes).toEqual([]);
		expect(results.endReason).toBe('proctor');
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(calls.map((call) => [call.itemIdentifier, call.timing?.submissionReason])).toEqual([['q1', 'proctor']]);
	});

	it('an exit decision returned during the end does not enter the next part', async () => {
		const { player, calls } = await create(
			[part('part-1', [section('s1', [ref('q1'), ref('q2')])]), part('part-2', [section('s2', [ref('q3')])])],
			{ adjust: branchesTo('q1', 'EXIT_TESTPART') },
		);
		const changes: number[] = [];
		player.onItemChange((index) => changes.push(index));
		player.updateResponse('RESPONSE', 'A');

		const results = await player.submit();

		expect(changes).toEqual([]);
		expect(results.endReason).toBe('candidate');
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
		expect(player.getState().visitedItems).not.toContain('q3');
	});

	it('a scope expiry while the end runs collects the closed item as it stands instead of moving delivery', async () => {
		let now = 1_000;
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { player, calls } = await create(
			[part('part-1', [section('s1', [ref('q1')], { timeLimits: { maxTime: 3 } }), section('s2', [ref('q2')])])],
			{
				now: () => now,
				adjust: (backend) => {
					const submit = backend.submitResponses.bind(backend);
					backend.submitResponses = async (request) => {
						// The end's collection of q2 (left behind a jump) is in flight when s1 runs out.
						if (request.itemIdentifier === 'q2') await held;
						return submit(request);
					};
				},
			},
		);
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'B');
		const changes: number[] = [];
		const scopes: ScopeTimeExpiryEvent[] = [];
		player.onItemChange((index) => changes.push(index));
		player.onScopeTimeExpired((event) => scopes.push(event));

		const ending = player.submit();
		await settle();
		now += 4_000;
		await realTick();
		await settle();
		// s1 ran out mid-collection: the end does not move the candidate onto q2.
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(changes).toEqual([]);

		release();
		const results = await ending;
		expect(player.isFinalized()).toBe(true);
		expect(changes).toEqual([]);
		// Nothing was left to move once the test ended.
		expect(scopes).toEqual([]);
		// q1 went out as it stood when its time ran out, with the candidate's answer.
		const q1 = calls.find((call) => call.itemIdentifier === 'q1');
		expect(q1?.responses).toEqual({ RESPONSE: 'B' });
		expect(q1?.timing?.submissionReason).toBe('time-expired');
		expect(results.itemResults.map((result) => result.itemIdentifier).sort()).toEqual(['q1', 'q2']);
	});

	it('a scope expiry while an end runs moves delivery once that end fails', async () => {
		let now = 1_000;
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { player } = await create(
			[part('part-1', [section('s1', [ref('q1')], { timeLimits: { maxTime: 3 } }), section('s2', [ref('q2')])])],
			{
				now: () => now,
				adjust: (backend) => {
					backend.finalizeAssessment = async () => {
						await held;
						return failedFinalize();
					};
				},
			},
		);
		player.updateResponse('RESPONSE', 'A');
		const changes: number[] = [];
		const scopes: ScopeTimeExpiryEvent[] = [];
		player.onItemChange((index) => changes.push(index));
		player.onScopeTimeExpired((event) => scopes.push(event));

		const ending = failureOf(player.submit());
		await settle();
		now += 4_000;
		await realTick();
		await settle();
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(scopes).toEqual([]);

		release();
		expect((await ending)?.code).toBe('finalizeFailed');
		// The test goes on: the closed s1 is left for the open question, and the shell hears it.
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		expect(scopes).toEqual([{ scope: 'section', identifier: 's1', deliveryContinues: true, nextIndex: 1 }]);
		expect(changes.at(-1)).toBe(1);
	});
});

describe('the leave-part gate holds only on questions the candidate can still reach (2)', () => {
	it('F: an unanswered question behind the candidate in a linear part (a legacy snapshot) does not hold Next', async () => {
		const parts = () => [
			part('part-1', [section('s1', [ref('q1'), ref('q2')])], {
				navigationMode: 'linear',
				itemSessionControl: { allowSkipping: false },
			}),
			part('part-2', [section('s2', [ref('q3')])]),
		];
		const first = await create(parts());
		// A snapshot from before the leave gate: the candidate stands on q2, and q1 behind them
		// was left unanswered and never submitted. In a linear part it can no longer be reached.
		const legacy = first.player.getState({ includeItemSessions: true });
		legacy.currentItemIdentifier = 'q2';
		legacy.visitedItems = ['q1', 'q2'];
		legacy.itemResponses = { ...legacy.itemResponses, q1: {} };
		if (legacy.itemSessions) delete legacy.itemSessions.q1;
		const sessionId = first.backend.latestSessionId('round5', 'candidate');
		expect(sessionId).toBeTruthy();
		first.player.destroy();
		await first.backend.saveState({ sessionId: sessionId!, state: legacy });
		first.calls.length = 0;

		const { player } = await create(parts(), { backend: first.backend, resumeSessionId: sessionId! });
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		expect(player.isNavigationTargetLegal(0)).toBe(false);
		// Only the question the candidate can still answer holds the way out of the part.
		expect(player.getTestPartBlockers().map((blocker) => blocker.identifier)).toEqual(['q2']);
		player.updateResponse('RESPONSE', 'B');
		expect(player.getTestPartBlockers()).toEqual([]);
		expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 2, leavesTestPart: true });

		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('q3');

		player.updateResponse('RESPONSE', 'A');
		await player.submit();
		expect(player.isFinalized()).toBe(true);
		// The unreachable question goes out as it stood at the end, never as a candidate submission.
		const q1 = first.calls.find((call) => call.itemIdentifier === 'q1');
		expect(q1?.timing?.submissionReason).toBe('unreachable');
		expect(first.calls.find((call) => call.itemIdentifier === 'q2')?.timing?.submissionReason).toBeUndefined();
	});

	it('a direct jump into the next part is held only by reachable questions too', async () => {
		const parts = () => [
			part('part-1', [section('s1', [ref('q1'), ref('q2')])], {
				navigationMode: 'linear',
				itemSessionControl: { allowSkipping: false },
			}),
			part('part-2', [section('s2', [ref('q3')])]),
		];
		const first = await create(parts());
		const legacy = first.player.getState({ includeItemSessions: true });
		legacy.currentItemIdentifier = 'q2';
		legacy.visitedItems = ['q1', 'q2'];
		legacy.itemResponses = { ...legacy.itemResponses, q1: {}, q2: { RESPONSE: 'A' } };
		if (legacy.itemSessions) delete legacy.itemSessions.q1;
		const sessionId = first.backend.latestSessionId('round5', 'candidate');
		first.player.destroy();
		await first.backend.saveState({ sessionId: sessionId!, state: legacy });

		const { player } = await create(parts(), { backend: first.backend, resumeSessionId: sessionId! });
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		await player.navigateTo(2);
		expect(player.getCurrentItem()?.identifier).toBe('q3');
	});
});

describe('a scope expiry\'s move is not undone by an in-flight submission (3)', () => {
	it('I1: delivery stays in the next part although the in-flight submission returns next=q2', async () => {
		let now = 1_000;
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { player, calls } = await create(
			[
				part('part-1', [section('s1', [ref('q1'), ref('q2')], { timeLimits: { maxTime: 3 } })]),
				part('part-2', [section('s2', [ref('q3')])]),
			],
			{
				now: () => now,
				adjust: (backend) => {
					const submit = backend.submitResponses.bind(backend);
					backend.submitResponses = async (request) => {
						await held;
						return submit(request);
					};
				},
			},
		);
		const scopes: ScopeTimeExpiryEvent[] = [];
		player.onScopeTimeExpired((event) => scopes.push(event));
		player.updateResponse('RESPONSE', 'A');

		const moving = player.next();
		await settle();
		now += 4_000;
		await realTick();
		await settle();
		// s1 ran out while q1's submission was in flight: delivery moved on to part 2.
		expect(scopes).toEqual([{ scope: 'section', identifier: 's1', deliveryContinues: true, nextIndex: 2 }]);
		expect(player.getCurrentItem()?.identifier).toBe('q3');

		release();
		await moving;
		// The submission's next=q2 would re-enter the part the expiry closed: not followed.
		expect(player.getCurrentItem()?.identifier).toBe('q3');
		expect(player.isNavigationTargetLegal(1)).toBe(false);
		// The snapshot records where the candidate is, not the backend's stale position.
		expect(player.getState().currentItemIdentifier).toBe('q3');
		expect(player.getState().visitedItems).toEqual(['q1', 'q3']);
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
		// A response now lands on q3 (the active item), never on the closed q1.
		player.updateResponse('RESPONSE', 'B');
		expect(player.getResponsesForItem('q3').RESPONSE).toBe('B');
		expect(player.getResponsesForItem('q1').RESPONSE).toBe('A');
	});

	it('a branch decision never re-enters a test part already left', async () => {
		const { player } = await create(
			[part('part-1', [section('s1', [ref('q1')])]), part('part-2', [section('s2', [ref('q2'), ref('q3')])])],
			{ adjust: branchesTo('q2', 'q1') },
		);
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('q2');

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		// The decision back into part 1 is not followed; Next moves on within part 2.
		expect(player.getCurrentItem()?.identifier).toBe('q3');
	});
});

describe('an ending that collects a delivery the time closed is an expiry ending (4)', () => {
	it('I2: a whole-test expiry whose auto-finalize failed ends as expiry when the candidate submits', async () => {
		let now = 1_000;
		let failing = true;
		const { player } = await create([part('part-1', [section('s1', [ref('q1')])])], {
			now: () => now,
			timeLimits: { maxTime: 5 },
			adjust: finalizeFailsWhile(() => failing),
		});
		const expiries: AssessmentTimeExpiryEvent[] = [];
		const completions: Array<string | undefined> = [];
		player.onTimeExpired((event) => expiries.push(event));
		player.onComplete((results) => completions.push(results.endReason));
		now += 6_000;
		await realTick();
		await settle();
		expect(expiries).toEqual([{ scope: 'assessment', autoFinalized: false, submissionRequired: true }]);
		expect(player.isFinalized()).toBe(false);

		failing = false;
		// The expiry dialog's Submit runs the candidate submit.
		const results = await player.submit();
		expect(results.endReason).toBe('expiry');
		expect(player.getEndReason()).toBe('expiry');
		expect(completions).toEqual(['expiry']);
	});

	it('a candidate submit at an expiry dead end (a part limit closed every question) ends as expiry', async () => {
		let now = 1_000;
		const { player, calls } = await create(
			[part('part-1', [section('s1', [ref('q1'), ref('q2')])], { timeLimits: { maxTime: 3 } })],
			{ now: () => now },
		);
		const expiries: AssessmentTimeExpiryEvent[] = [];
		player.onTimeExpired((event) => expiries.push(event));
		player.updateResponse('RESPONSE', 'A');
		now += 4_000;
		await realTick();
		await settle();
		expect(expiries).toEqual([
			{ scope: 'testPart', identifier: 'part-1', autoFinalized: false, submissionRequired: true },
		]);

		const results = await player.submit();
		expect(results.endReason).toBe('expiry');
		expect(calls.every((call) => call.timing?.submissionReason === 'time-expired')).toBe(true);
	});

	it('a proctor force-submit after the whole test expired is an expiry ending (time wins)', async () => {
		let now = 1_000;
		let failing = true;
		const { player } = await create([part('part-1', [section('s1', [ref('q1')])])], {
			now: () => now,
			timeLimits: { maxTime: 5 },
			adjust: finalizeFailsWhile(() => failing),
		});
		now += 6_000;
		await realTick();
		await settle();
		failing = false;
		const results = await player.submit({ force: true });
		expect(results.endReason).toBe('expiry');
	});

	it('D: a proctor force-submit with open questions left stays a proctor ending; scope-closed items go out as time-expired', async () => {
		let now = 1_000;
		const { player, calls } = await create(
			[
				part('part-1', [section('s1', [ref('q1'), ref('q2')], { timeLimits: { maxTime: 3 } })], {
					itemSessionControl: { allowSkipping: false },
				}),
				part('part-2', [section('s2', [ref('q3')])]),
			],
			{ now: () => now },
		);
		player.updateResponse('RESPONSE', 'A');
		now += 4_000;
		await realTick();
		await settle();
		expect(player.getCurrentItem()?.identifier).toBe('q3');

		const results = await player.submit({ force: true });
		expect(results.endReason).toBe('proctor');
		expect(calls.map((call) => [call.itemIdentifier, call.timing?.submissionReason])).toEqual([
			['q1', 'time-expired'],
			['q3', 'proctor'],
		]);
	});
});
