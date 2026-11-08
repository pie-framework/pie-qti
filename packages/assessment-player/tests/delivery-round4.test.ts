/**
 * Round-4 delivery integrity in the core:
 * - leaving an individual test part gates on that part's blockers (QTI allowSkipping /
 *   validateResponses), and a blocker the candidate can no longer reach never holds the end
 *   of the test: it is collected as it stands, marked `unreachable`;
 * - a scope expiry looks across the whole reachable delivery (an open earlier question is
 *   not a dead end), on a live expiry and on restore;
 * - a proctor's force-submit queues behind a candidate transition instead of failing;
 * - the reference backend scores a templated item against the instance the candidate saw.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import {
	AssessmentPlayer,
	type AssessmentTimeExpiryEvent,
	type ScopeTimeExpiryEvent,
} from '../src/core/AssessmentPlayer.js';
import { scoreAssessmentItem } from '../src/integration/assessment-item-scorer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type {
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

/** ANSWER is drawn by template processing; the candidate is scored against it. */
const RANDOM_TEMPLATE_ITEM = `<assessmentItem ${NS} identifier="t1" title="Random template" adaptive="false" timeDependent="false">
  <templateDeclaration identifier="ANSWER" cardinality="single" baseType="integer"><defaultValue><value>1</value></defaultValue></templateDeclaration>
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><textEntryInteraction responseIdentifier="RESPONSE"/></itemBody>
  <templateProcessing><setTemplateValue identifier="ANSWER"><randomInteger min="1" max="2"/></setTemplateValue></templateProcessing>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><variable identifier="ANSWER"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

const ref = (identifier: string, itemXml = choiceItem(identifier)): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemXml,
});

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
		identifier: 'round4',
		title: 'Round four',
		navigationMode: parts[0]?.navigationMode ?? 'nonlinear',
		submissionMode: parts[0]?.submissionMode ?? 'individual',
		...(options.timeLimits ? { timeLimits: options.timeLimits } : {}),
		testParts: parts,
	};
	const calls: SubmitResponsesRequest[] = [];
	let backend = options.backend;
	if (!backend) {
		backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		const submit = backend.submitResponses.bind(backend);
		backend.submitResponses = async (request) => {
			calls.push(structuredClone(request));
			return submit(request);
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
	return { player, backend, calls };
}

const realTick = () => new Promise((resolve) => setTimeout(resolve, 1_100));
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

type Coded = { code?: string; params?: Record<string, string | number> } | null;
const failureOf = (promise: Promise<unknown>): Promise<Coded> =>
	promise.then(
		() => null,
		(error: unknown) => error as Coded,
	);

/** Part 1 (nonlinear, individual) holds q1 and q2; part 2 holds q3. */
const twoParts = (control: SecureTestPart['itemSessionControl'] = {}) => [
	part('part-1', [section('s1', [ref('q1'), ref('q2')])], { itemSessionControl: control }),
	part('part-2', [section('s2', [ref('q3')])]),
];

describe('leaving an individual test part gates on its blockers (1a)', () => {
	it('a required question skipped by a jump holds Next out of the part, named, before anything is submitted', async () => {
		const { player, calls } = await create(twoParts({ allowSkipping: false }));
		// Navigation is not submission: the candidate may jump past q1.
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');

		const refused = await failureOf(player.next());
		expect(refused?.code).toBe('leavePartResponseRequired');
		expect(refused?.params).toMatchObject({ items: '1', itemIdentifiers: 'q1', count: 1 });
		// Nothing left the part and nothing was submitted (not even q2).
		expect(calls).toEqual([]);
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		// A direct jump into the next part is refused the same way.
		expect((await failureOf(player.navigateTo(2)))?.code).toBe('leavePartResponseRequired');
		// The shell's leave dialog lists the question, with a jump.
		expect(player.getTestPartBlockers()).toEqual([
			expect.objectContaining({ identifier: 'q1', number: 1, reason: 'required', jumpAllowed: true }),
		]);

		// Answering the named question opens the way out.
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'B');
		await player.navigateTo(1);
		expect(player.getTestPartBlockers()).toEqual([]);
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('q3');
	});
});

describe('an unreachable blocker never holds Submit (1b)', () => {
	it('a left part\'s required question (a legacy snapshot) is collected as it stands, marked unreachable', async () => {
		const first = await create(twoParts({ allowSkipping: false }));
		first.player.updateResponse('RESPONSE', 'A');
		await first.player.navigateTo(1);
		first.player.updateResponse('RESPONSE', 'A');
		await first.player.next();
		expect(first.player.getCurrentItem()?.identifier).toBe('q3');
		// A snapshot from before the leave gate: q1 was left behind without an answer.
		const legacy = first.player.getState({ includeItemSessions: true });
		legacy.itemResponses = { ...legacy.itemResponses, q1: {} };
		if (legacy.itemSessions) delete legacy.itemSessions.q1;
		const sessionId = first.backend.latestSessionId('round4', 'candidate');
		expect(sessionId).toBeTruthy();
		first.player.destroy();
		await first.backend.saveState({ sessionId: sessionId!, state: legacy });
		first.calls.length = 0;

		const resumed = await create(twoParts({ allowSkipping: false }), {
			backend: first.backend,
			resumeSessionId: sessionId!,
		});
		expect(resumed.player.getCurrentItem()?.identifier).toBe('q3');
		// q1 cannot be reached any more (part 1 was left): it does not hold Submit.
		expect(resumed.player.getSubmissionBlockers()).toEqual([]);

		resumed.player.updateResponse('RESPONSE', 'A');
		const results = await resumed.player.submit();
		expect(resumed.player.isFinalized()).toBe(true);
		const q1 = first.calls.find((call) => call.itemIdentifier === 'q1');
		expect(q1?.timing?.submissionReason).toBe('unreachable');
		expect(Object.values(q1?.responses ?? {}).every((value) => value == null)).toBe(true);
		// The current question is a normal candidate submission.
		expect(first.calls.find((call) => call.itemIdentifier === 'q3')?.timing?.submissionReason).toBeUndefined();
		expect(results.itemResults.map((result) => result.itemIdentifier).sort()).toEqual(['q1', 'q2', 'q3']);
	});
});

describe('a scope expiry looks across the whole reachable delivery (2)', () => {
	const timedParts = (control: SecureTestPart['itemSessionControl'] = {}) => [
		part('part-1', [section('s1', [ref('q1')]), section('s2', [ref('q2')], { timeLimits: { maxTime: 3 } })], {
			itemSessionControl: control,
		}),
	];

	it('P7: the last section expiring moves the candidate back to an open earlier question, not a dead end', async () => {
		let now = 1_000;
		const { player } = await create(timedParts(), { now: () => now });
		const expiries: AssessmentTimeExpiryEvent[] = [];
		const scopes: ScopeTimeExpiryEvent[] = [];
		player.onTimeExpired((event) => expiries.push(event));
		player.onScopeTimeExpired((event) => scopes.push(event));
		await player.navigateTo(1);
		now += 4_000;
		await realTick();
		await settle();

		expect(expiries).toEqual([]);
		expect(scopes).toEqual([{ scope: 'section', identifier: 's2', deliveryContinues: true, nextIndex: 0 }]);
		expect(player.getCurrentItem()?.identifier).toBe('q1');
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).not.toBe('suspended');
	});

	it('P7b: a required empty earlier question is never submitted as a normal candidate submission after the expiry', async () => {
		let now = 1_000;
		const { player, calls } = await create(timedParts({ allowSkipping: false }), { now: () => now });
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		now += 4_000;
		await realTick();
		await settle();

		// The delivery is not closed: q1 is open, so the skipping control still applies.
		expect(player.getSubmissionBlockers()).toEqual([
			expect.objectContaining({ identifier: 'q1', reason: 'required', jumpAllowed: true }),
		]);
		expect((await failureOf(player.submit()))?.code).toBe('finalizeResponseRequired');
		expect(calls).toEqual([]);

		player.updateResponse('RESPONSE', 'B');
		await player.submit();
		expect(calls.find((call) => call.itemIdentifier === 'q1')?.timing?.submissionReason).toBeUndefined();
		expect(calls.find((call) => call.itemIdentifier === 'q2')?.timing?.submissionReason).toBe('time-expired');
	});

	it('P8: a restored session whose section ran out lands on the open earlier question instead of a dead end', async () => {
		let now = 1_000;
		const first = await create(timedParts(), { now: () => now });
		await first.player.navigateTo(1);
		now += 70_000;
		const saved = first.player.getState({ includeItemSessions: true });

		const second = await create(timedParts(), { now: () => now });
		const expiries: AssessmentTimeExpiryEvent[] = [];
		second.player.onTimeExpired((event) => expiries.push(event));
		await second.player.restoreState(saved);

		expect(second.player.getCurrentItem()?.identifier).toBe('q1');
		expect(expiries).toEqual([]);
		expect(second.player.isNavigationTargetLegal(1)).toBe(false);
	});
});

describe('a proctor force-submit during a candidate transition (3)', () => {
	it('queues behind the in-flight transition and lands', async () => {
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { player, calls } = await create([part('part-1', [section('s1', [ref('q1'), ref('q2')])])], {
			adjust: (backend) => {
				const submit = backend.submitResponses.bind(backend);
				let first = true;
				backend.submitResponses = async (request) => {
					if (first) {
						first = false;
						await held;
					}
					return submit(request);
				};
			},
		});
		player.updateResponse('RESPONSE', 'A');
		const moving = player.next();
		await settle();
		expect(player.isBusy()).toBe(true);

		const forced = player.submit({ force: true }).then(
			(results) => ({ results, error: null as Coded }),
			(error: unknown) => ({ results: null, error: error as Coded }),
		);
		release();
		await moving;
		const outcome = await forced;
		expect(outcome.error).toBeNull();
		expect(player.isFinalized()).toBe(true);
		expect(outcome.results?.itemResults.map((result) => result.itemIdentifier).sort()).toEqual(['q1', 'q2']);
		expect(calls.find((call) => call.itemIdentifier === 'q2')?.timing?.submissionReason).toBe('proctor');
	});
});

describe('the reference backend scores a templated item against the delivered instance (10)', () => {
	it('sends the item session in reference mode, so the displayed key scores 1', async () => {
		const original = Math.random;
		try {
			// The delivered instance: ANSWER = 1.
			Math.random = () => 0;
			const { player, calls } = await create([part('part-1', [section('s1', [ref('t1', RANDOM_TEMPLATE_ITEM)])])]);
			expect(player.getCurrentItemSession()?.state().templates.ANSWER).toBe(1);
			player.updateResponse('RESPONSE', 1);
			// Re-templating now would draw ANSWER = 2.
			Math.random = () => 0.99;
			const results = await player.submit();
			expect(calls[0]?.itemSession).toBeDefined();
			expect(results.itemResults[0]?.score).toBe(1);
		} finally {
			Math.random = original;
		}
	});

	it('refuses a templated item that arrives without its session (typed error)', () => {
		let error: { code?: string; name?: string } | null = null;
		try {
			scoreAssessmentItem({ itemXml: RANDOM_TEMPLATE_ITEM, responses: { RESPONSE: '1' } });
		} catch (caught) {
			error = caught as { code?: string; name?: string };
		}
		expect(error?.code).toBe('itemSessionRequired');
	});
});

describe('a branch exit out of the part waits for the part\'s questions (1a, EXIT_TESTPART path)', () => {
	it('refuses the exit naming the question, then follows it once the question is answered', async () => {
		const parts = [
			part('part-1', [section('s1', [ref('q1'), ref('q2'), ref('q3')])], { itemSessionControl: { allowSkipping: false } }),
			part('part-2', [section('s2', [ref('q4')])]),
		];
		const { player, calls } = await create(parts, {
			adjust: (backend) => {
				const submit = backend.submitResponses.bind(backend);
				backend.submitResponses = async (request) => {
					const response = await submit(request);
					// A production backend's branch decision out of the part from a middle item.
					return request.itemIdentifier === 'q2' ? { ...response, nextItemIdentifier: 'EXIT_TESTPART' } : response;
				};
			},
		});
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		const refused = await failureOf(player.next());
		expect(refused?.code).toBe('leavePartResponseRequired');
		expect(refused?.params).toMatchObject({ items: '1' });
		// q2 was accepted; the candidate stays in the part, and Next now means the exit.
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 3, leavesTestPart: true });

		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'B');
		await player.navigateTo(1);
		const before = calls.length;
		await player.next();
		// The exit the backend decided is followed; q2 is not submitted again.
		expect(player.getCurrentItem()?.identifier).toBe('q4');
		expect(calls.slice(before).map((call) => call.itemIdentifier)).toEqual([]);
	});
});

describe('every ending reports its reason and its results (4, 8)', () => {
	it('candidate, proctor, branch and expiry endings each carry their endReason', async () => {
		const ended = async (run: (player: AssessmentPlayer) => Promise<unknown>, extra: Partial<CreateOptions> = {}) => {
			const { player } = await create([part('part-1', [section('s1', [ref('q1'), ref('q2')])], { submissionMode: 'simultaneous' })], extra);
			const completions: Array<string | undefined> = [];
			const finalized: Array<string | undefined> = [];
			player.onComplete((results) => completions.push(results.endReason));
			await run(player);
			await settle();
			finalized.push(player.getEndReason() ?? undefined);
			player.destroy();
			localStorage.clear();
			return { completions, reason: finalized[0] };
		};
		expect(await ended((p) => p.submit())).toEqual({ completions: ['candidate'], reason: 'candidate' });
		expect(await ended((p) => p.submit({ force: true }))).toEqual({ completions: ['proctor'], reason: 'proctor' });

		let now = 1_000;
		const expiry = await ended(
			async () => {
				now += 6_000;
				await realTick();
			},
			{ now: () => now, timeLimits: { maxTime: 5 } },
		);
		expect(expiry).toEqual({ completions: ['expiry'], reason: 'expiry' });
	});

	it('an EXIT_TEST branch is a branch ending, and the finalized event carries it', async () => {
		const events: Array<{ restored: boolean; endReason?: string }> = [];
		const { player } = await create([part('part-1', [section('s1', [ref('q1'), ref('q2')])], { navigationMode: 'linear' })], {
			adjust: (backend) => {
				const submit = backend.submitResponses.bind(backend);
				backend.submitResponses = async (request) => ({ ...(await submit(request)), nextItemIdentifier: 'EXIT_TEST' });
			},
		});
		const results: Array<string | undefined> = [];
		player.onComplete((result) => results.push(result.endReason));
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(player.isFinalized()).toBe(true);
		expect(results).toEqual(['branch']);
		expect(player.getEndReason()).toBe('branch');
		void events;
	});
});

describe('an invalid blocker says what it still owes (5)', () => {
	const pickTwo = (identifier: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" minChoices="2" maxChoices="3"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice><simpleChoice identifier="C">C</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

	it('reports minChoices as the requirement of an incomplete answer', async () => {
		const { player } = await create([
			part('part-1', [section('s1', [ref('q1', pickTwo('q1')), ref('q2')])], { itemSessionControl: { validateResponses: true } }),
		]);
		player.updateResponse('RESPONSE', ['A']);
		await player.navigateTo(1);
		expect(player.getSubmissionBlockers()).toEqual([
			expect.objectContaining({
				identifier: 'q1',
				reason: 'invalid',
				reachable: true,
				requirement: { kind: 'minChoices', count: 2 },
			}),
		]);
	});
});

describe('start over never re-enters a part already left (6)', () => {
	it('P5b: repositions within the furthest part reached; the left part stays closed as it stands', async () => {
		const first = await create(twoParts());
		first.player.updateResponse('RESPONSE', 'A');
		await first.player.navigateTo(1);
		first.player.updateResponse('RESPONSE', 'A');
		await first.player.next();
		expect(first.player.getCurrentItem()?.identifier).toBe('q3');
		first.player.updateResponse('RESPONSE', 'B');
		await first.player.flushAutosave();
		const sessionId = first.backend.latestSessionId('round4', 'candidate');
		first.player.destroy();

		const resumed = await create(twoParts(), { backend: first.backend, resumeSessionId: sessionId! });
		expect(resumed.player.getCurrentItem()?.identifier).toBe('q3');
		await resumed.player.startOver();

		expect(resumed.player.getCurrentItem()?.identifier).toBe('q3');
		expect(resumed.player.getResponses().RESPONSE ?? null).toBeNull();
		expect(resumed.player.isNavigationTargetLegal(0)).toBe(false);
		await expect(resumed.player.navigateTo(0)).rejects.toMatchObject({ code: 'navigationNotAllowed' });
		// q1 was left unsubmitted (a jump): it stays as it stood, visited, and is collected at the end.
		expect(resumed.player.getResponsesForItem('q1').RESPONSE).toBe('A');
		expect(resumed.player.getState().visitedItems).toContain('q1');
	});
});

describe('a response still equal to its declared default is no response (11)', () => {
	const defaulted = (identifier: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><defaultValue><value>A</value></defaultValue></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

	it('an untouched default-valued response holds the item under allowSkipping=false', async () => {
		const { player, calls } = await create([
			part('part-1', [section('s1', [ref('d1', defaulted('d1')), ref('q2')])], { itemSessionControl: { allowSkipping: false } }),
		]);
		expect(player.getResponses().RESPONSE).toBe('A');
		await expect(player.next()).rejects.toMatchObject({ code: 'responseRequired' });
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		expect(player.getSubmissionBlockers()).toEqual([expect.objectContaining({ identifier: 'd1', reason: 'required' })]);
		expect(calls).toEqual([]);
		// A real response (different from the default) clears it.
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'B');
		expect(player.getSubmissionBlockers()).toEqual([]);
	});

	it('submitted untouched (skipping allowed), it does not count as responded', async () => {
		const { player, backend } = await create([part('part-1', [section('s1', [ref('d1', defaulted('d1')), ref('q2')])])]);
		await player.next();
		const sessionId = backend.latestSessionId('round4', 'candidate');
		const stored = JSON.parse(localStorage.getItem(`qti_session_${sessionId}`) ?? '{}');
		expect(stored.state?.itemSessionStates?.d1).toMatchObject({ isSubmitted: true, isAnswered: false });
		expect(stored.itemTestStates?.d1?.responded).toBe(false);
	});
});

describe('allowReview governs only after the last attempt (12)', () => {
	it('maxAttempts=2: the candidate may return after attempt 1; after attempt 2 allowReview=false closes it', async () => {
		const { player } = await create([
			part('part-1', [section('s1', [ref('q1'), ref('q2')])], {
				itemSessionControl: { maxAttempts: 2, allowReview: false, showFeedback: true },
			}),
		]);
		player.updateResponse('RESPONSE', 'B');
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		// One attempt left: returning to use it is allowed.
		expect(player.getNavigationState().canPrevious).toBe(true);
		expect(player.isNavigationTargetLegal(0)).toBe(true);
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		// Both attempts used: allowReview=false now closes the item.
		expect(player.getNavigationState().canPrevious).toBe(false);
		await expect(player.navigateTo(0)).rejects.toMatchObject({ code: 'reviewNotAllowed' });
	});
});

describe('the adaptive scorer takes the submitted outcomes (10)', () => {
	const ADAPTIVE = `<assessmentItem ${NS} identifier="a1" title="Adaptive" adaptive="true" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing>
    <responseCondition><responseIf>
      <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      <setOutcomeValue identifier="completionStatus"><baseValue baseType="identifier">completed</baseValue></setOutcomeValue>
    </responseIf></responseCondition>
  </responseProcessing>
</assessmentItem>`;

	it('scores an adaptive session from its outcomes as submitted, never re-running response processing', async () => {
		const { createAssessmentItemDefinition } = await import('@pie-qti/item-player');
		const session = createAssessmentItemDefinition({ itemXml: ADAPTIVE }).openSession({ responses: { RESPONSE: 'B' } });
		const submitted = session.dispatch({ action: 'endAttempt' }).result!.sessionState;
		session.dispose();
		// What earlier attempts accumulated (the engine retaining adaptive outcomes): re-running
		// response processing on 'B' would reset SCORE to 0.
		const accumulated = structuredClone(submitted);
		accumulated.outcomeVariables.SCORE!.value = 0.5;
		const result = scoreAssessmentItem({ itemXml: ADAPTIVE, responses: { RESPONSE: 'B' }, itemSession: accumulated });
		expect(result.score).toBe(0.5);
		expect(result.completed).toBe(false);
		expect(result.outcomeValues.numAttempts).toBe(1);
	});

	it('refuses an adaptive item without its session', () => {
		expect(() => scoreAssessmentItem({ itemXml: ADAPTIVE, responses: { RESPONSE: 'A' } })).toThrow(
			expect.objectContaining({ code: 'itemSessionRequired' }),
		);
	});
});

describe('a queued force-submit after destroy (3)', () => {
	it('rejects instead of hanging when the player is destroyed while it waits', async () => {
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { player } = await create([part('part-1', [section('s1', [ref('q1'), ref('q2')])])], {
			adjust: (backend) => {
				const submit = backend.submitResponses.bind(backend);
				backend.submitResponses = async (request) => {
					await held;
					return submit(request);
				};
			},
		});
		player.updateResponse('RESPONSE', 'A');
		const moving = player.next().catch(() => undefined);
		await settle();
		const forced = failureOf(player.submit({ force: true }));
		player.destroy();
		expect((await forced)?.code).toBe('navigationNotAllowed');
		release();
		await moving;
	});
});
