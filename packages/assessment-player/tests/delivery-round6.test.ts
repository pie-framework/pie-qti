/**
 * Round-6 delivery integrity in the core:
 * - branch rules and preconditions hold on every forward move, also one that submits nothing:
 *   a practice check keeps the backend's decision for leaving the item and the next `next()`
 *   follows it; with no decision on record (a resumed session, a simultaneous part, a jump into
 *   the next part) the player applies the delivery rules itself, with the reference backend's
 *   rules — a part whose precondition fails is never entered;
 * - a check reopens the item from its processed attempt (the engine's numAttempts contract), so
 *   attempt k runs response processing as attempt k, and once the test ends every delivered item
 *   session is closed: a checked item reports `final`, never `pendingSubmission`.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer, type ScopeTimeExpiryEvent } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type {
	SaveAssessmentStateRequest,
	SecureAssessment,
	SecureBranchRule,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	SubmitResponsesRequest,
} from '../src/integration/api-contract.js';
import { buildAssessmentResultReport } from '../src/reporting/index.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** A choice item keyed A (SCORE 1), recording the attempt number response processing ran as. */
const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <outcomeDeclaration identifier="ATTEMPT" cardinality="single" baseType="integer"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing>
    <setOutcomeValue identifier="ATTEMPT"><variable identifier="numAttempts"/></setOutcomeValue>
    <responseCondition><responseIf>
      <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
      <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
    </responseIf></responseCondition>
  </responseProcessing>
</assessmentItem>`;

const FALSE = '<baseValue baseType="boolean">false</baseValue>';
const TRUE = '<baseValue baseType="boolean">true</baseValue>';
const scoreAtLeastOne = (variable: string) =>
	`<gte><variable identifier="${variable}"/><baseValue baseType="float">1</baseValue></gte>`;

const ref = (identifier: string, extra: Partial<SecureItemRef> = {}): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemXml: choiceItem(identifier),
	...extra,
});

const branchTo = (target: string, conditionXml?: string): SecureBranchRule[] => [
	{ target, ...(conditionXml ? { conditionXml } : {}) },
];

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

/** Two attempts: the practice check is offered and leaves one attempt to spend. */
const PRACTICE = { maxAttempts: 2 };

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

interface CreateOptions {
	backend?: ReferenceBackendAdapter;
	resumeSessionId?: string;
	outcomes?: Pick<SecureAssessment, 'outcomeDeclarations' | 'outcomeProcessingXml'>;
	now?: () => number;
	adjust?: (backend: ReferenceBackendAdapter) => void;
}

async function create(parts: SecureTestPart[], options: CreateOptions = {}) {
	const assessment: SecureAssessment = {
		identifier: 'round6',
		title: 'Round six',
		navigationMode: parts[0]?.navigationMode ?? 'nonlinear',
		submissionMode: parts[0]?.submissionMode ?? 'individual',
		...(options.outcomes ?? {}),
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
	return { player, backend, assessment, calls, saves };
}

type Coded = { code?: string } | null;
const failureOf = (promise: Promise<unknown>): Promise<Coded> =>
	promise.then(
		() => null,
		(error: unknown) => error as Coded,
	);

const current = (player: AssessmentPlayer) => player.getCurrentItem()?.identifier;
const realTick = () => new Promise((resolve) => setTimeout(resolve, 1_100));
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

async function waitFor(condition: () => boolean, description: string): Promise<void> {
	const deadline = Date.now() + 2000;
	while (!condition()) {
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
}

/** A choice item with an endAttemptInteraction (countAttempt by default): activating it ends a counted attempt. */
const endAttemptRef = (identifier: string): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemXml: `<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <responseDeclaration identifier="END" cardinality="single" baseType="boolean"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
    <p><endAttemptInteraction responseIdentifier="END" title="Done"/></p>
  </itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`,
});

describe('a practice check keeps the backend decision for leaving the item (1)', () => {
	const linear = (q1: Partial<SecureItemRef> = {}, q2: Partial<SecureItemRef> = {}) => [
		part('part-1', [section('s1', [ref('q1', q1), ref('q2', q2), ref('q3')])], {
			navigationMode: 'linear',
			itemSessionControl: PRACTICE,
		}),
	];

	it('probe: without a check, next() skips the item whose precondition fails', async () => {
		const { player } = await create(linear({}, { preConditions: [FALSE] }));
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(current(player)).toBe('q3');
	});

	it('after a check, next() skips the item whose precondition fails instead of moving adjacent', async () => {
		const { player, calls } = await create(linear({}, { preConditions: [FALSE] }));
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		// Next means the backend's decision for q1: q2 is not eligible.
		expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 2, leavesTestPart: false });

		await player.next();
		expect(current(player)).toBe('q3');
		// The unchanged answer was not submitted again: the check's decision was followed.
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
		expect(player.getState().visitedItems).toEqual(['q1', 'q3']);
	});

	it('after a check, next() follows the item branch rule', async () => {
		const { player, calls } = await create(linear({ branchRule: branchTo('q3', scoreAtLeastOne('q1.SCORE')) }));
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		await player.next();
		expect(current(player)).toBe('q3');
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
	});

	it('a revised answer re-submits on next() and follows the fresh decision, not the kept one', async () => {
		const { player, calls } = await create(linear({ branchRule: branchTo('q3', scoreAtLeastOne('q1.SCORE')) }));
		// Wrong first: the kept decision is q2.
		player.updateResponse('RESPONSE', 'B');
		await player.checkCurrentItem();
		expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 1, leavesTestPart: false });

		// Revised to the key: next() spends the second attempt and the branch rule now fires.
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(current(player)).toBe('q3');
		expect(calls.map((call) => [call.itemIdentifier, call.responses.RESPONSE])).toEqual([
			['q1', 'B'],
			['q1', 'A'],
		]);
	});

	it('a resumed session (no decision on record) applies the same rules', async () => {
		const first = await create(linear({ branchRule: branchTo('q3', scoreAtLeastOne('q1.SCORE')) }));
		first.player.updateResponse('RESPONSE', 'A');
		await first.player.checkCurrentItem();
		await first.player.flushAutosave();
		const sessionId = first.backend.latestSessionId('round6', 'candidate');
		expect(sessionId).toBeTruthy();
		first.player.destroy();

		const { player } = await create([], { backend: first.backend, resumeSessionId: sessionId! });
		expect(current(player)).toBe('q1');
		await player.next();
		// The branch rule reads q1's recorded score: the resumed delivery lands where the backend
		// sent the candidate, not on the adjacent q2.
		expect(current(player)).toBe('q3');
		expect(first.calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
	});

	it('a counted end-attempt keeps the decision too: next() follows it', async () => {
		const { player, calls } = await create([
			part('part-1', [section('s1', [endAttemptRef('q1'), ref('q2', { preConditions: [FALSE] }), ref('q3')])], {
				navigationMode: 'linear',
			}),
		]);
		player.updateResponse('RESPONSE', 'A');
		player.updateResponse('END', true);
		await waitFor(() => calls.length === 1 && !player.isBusy(), 'the end-attempt submission');
		// The activation stays on the item; Next goes where the backend decided.
		expect(current(player)).toBe('q1');
		expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 2, leavesTestPart: false });

		await player.next();
		expect(current(player)).toBe('q3');
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
	});

	it('a kept decision onto an item its time limit already closed is passed over like the item', async () => {
		let now = 1_000;
		const { player } = await create(
			[
				part('part-1', [section('s1', [ref('q1'), ref('q2', { timeLimits: { maxTime: 3 } }), ref('q3')])], {
					itemSessionControl: PRACTICE,
				}),
			],
			{ now: () => now },
		);
		// q2's own limit runs out while the candidate is on it; delivery moves on to q3.
		await player.navigateTo(1);
		now += 4_000;
		await realTick();
		await settle();
		expect(current(player)).toBe('q3');

		// Back on q1, a check: the backend (which knows nothing of client time locks) decides q2.
		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		expect(player.getForwardTransitionInfo()).toEqual({ nextIndex: 2, leavesTestPart: false });
		await player.next();
		expect(current(player)).toBe('q3');
	});
});

describe('entering a test part evaluates its precondition (1)', () => {
	const threeParts = (part2: Partial<SecureTestPart>, part1: Partial<SecureTestPart> = {}) => [
		part('part-1', [section('s1', [ref('q1')])], { itemSessionControl: PRACTICE, ...part1 }),
		part('part-2', [section('s2', [ref('q2')])], part2),
		part('part-3', [section('s3', [ref('q3')])]),
	];

	it('a nonlinear jump into a part whose precondition fails is refused; the way on skips the part', async () => {
		const { player } = await create(threeParts({ preConditions: [FALSE] }));
		player.updateResponse('RESPONSE', 'A');

		expect(player.isNavigationTargetLegal(1)).toBe(false);
		// The review screen offers no jump into the skipped part either.
		expect(player.getReviewItems().map((item) => item.jumpAllowed)).toEqual([true, false, true]);
		expect((await failureOf(player.navigateTo(1)))?.code).toBe('navigationNotAllowed');
		expect(current(player)).toBe('q1');
		expect(player.getState().visitedItems).not.toContain('q2');

		// The way on lands past the skipped part.
		expect(player.isNavigationTargetLegal(2)).toBe(true);
		await player.navigateTo(2);
		expect(current(player)).toBe('q3');
	});

	it('a part whose precondition holds is entered by the jump', async () => {
		const { player } = await create(threeParts({ preConditions: [TRUE] }));
		player.updateResponse('RESPONSE', 'A');
		expect(player.isNavigationTargetLegal(1)).toBe(true);
		await player.navigateTo(1);
		expect(current(player)).toBe('q2');
	});

	it('the precondition reads the checked item\'s recorded score: it holds after a correct answer', async () => {
		const { player } = await create(threeParts({ preConditions: [scoreAtLeastOne('q1.SCORE')] }));
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		await player.navigateTo(1);
		expect(current(player)).toBe('q2');
	});

	it('the precondition reads the checked item\'s recorded score: a wrong answer skips the part', async () => {
		const { player } = await create(threeParts({ preConditions: [scoreAtLeastOne('q1.SCORE')] }));
		player.updateResponse('RESPONSE', 'B');
		await player.checkCurrentItem();
		expect((await failureOf(player.navigateTo(1)))?.code).toBe('navigationNotAllowed');
		await player.next();
		expect(current(player)).toBe('q3');
	});

	it('the precondition reads the test outcomes the backend returned', async () => {
		const { player } = await create(threeParts({ preConditions: [scoreAtLeastOne('TOTAL')] }), {
			outcomes: {
				outcomeDeclarations: [{ identifier: 'TOTAL', baseType: 'float', cardinality: 'single' }],
				outcomeProcessingXml:
					'<outcomeProcessing><setOutcomeValue identifier="TOTAL"><sum><testVariables variableIdentifier="SCORE"/></sum></setOutcomeValue></outcomeProcessing>',
			},
		});
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		await player.navigateTo(1);
		expect(current(player)).toBe('q2');
	});

	it('next() out of a simultaneous part skips the next part whose precondition fails', async () => {
		const { player, calls } = await create(
			threeParts({ preConditions: [FALSE] }, { submissionMode: 'simultaneous', itemSessionControl: undefined }),
		);
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(current(player)).toBe('q3');
		// The simultaneous part was committed when it was left.
		expect(calls.map((call) => call.itemIdentifier)).toEqual(['q1']);
	});

	it('nothing eligible after the item: Next gives way to Submit', async () => {
		const { player } = await create([
			part('part-1', [section('s1', [ref('q1')])], { itemSessionControl: PRACTICE }),
			part('part-2', [section('s2', [ref('q2')])], { preConditions: [FALSE] }),
		]);
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		expect(player.getNavigationState().canNext).toBe(false);
		expect(player.isNavigationTargetLegal(1)).toBe(false);
		await player.submit();
		expect(player.isFinalized()).toBe(true);
		expect(player.getState().visitedItems).toEqual(['q1']);
	});

	it('a scope expiry moving delivery on skips a part whose precondition fails', async () => {
		let now = 1_000;
		const { player } = await create(
			[
				part('part-1', [section('s1', [ref('q1')], { timeLimits: { maxTime: 3 } })]),
				part('part-2', [section('s2', [ref('q2')])], { preConditions: [FALSE] }),
				part('part-3', [section('s3', [ref('q3')])]),
			],
			{ now: () => now },
		);
		const scopes: ScopeTimeExpiryEvent[] = [];
		player.onScopeTimeExpired((event) => scopes.push(event));
		player.updateResponse('RESPONSE', 'A');
		now += 4_000;
		await realTick();
		await settle();
		expect(scopes).toEqual([{ scope: 'section', identifier: 's1', deliveryContinues: true, nextIndex: 2 }]);
		expect(current(player)).toBe('q3');
	});
});

describe('a checked item reopens from its processed attempt and ends final (2)', () => {
	const practicePart = () => [part('part-1', [section('s1', [ref('c1'), ref('c2')])], { itemSessionControl: PRACTICE })];

	it('the second check runs response processing as attempt 2', async () => {
		const { player, calls } = await create(practicePart());
		player.updateResponse('RESPONSE', 'B');
		await player.checkCurrentItem();
		// Reopened for the second attempt, the session carries the attempt already made.
		expect(player.getCurrentItemSession()?.state().numAttempts).toBe(1);
		expect(player.getCurrentItemSession()?.state().outcomes.ATTEMPT).toBe(1);

		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		expect(calls).toHaveLength(2);
		expect(calls[1]?.itemSession?.numAttempts).toBe(2);
		expect(player.getCurrentItemSession()?.state().outcomes.ATTEMPT).toBe(2);
		expect(player.getState().itemScores?.c1?.outcomeValues?.ATTEMPT).toBe(2);
	});

	it('check -> next -> submit reports the checked item final', async () => {
		const { player, assessment, saves } = await create(practicePart());
		player.updateResponse('RESPONSE', 'A');
		await player.checkCurrentItem();
		await player.next();
		expect(current(player)).toBe('c2');
		player.updateResponse('RESPONSE', 'A');
		await player.submit();
		expect(player.isFinalized()).toBe(true);

		const status = (state: SaveAssessmentStateRequest['state']) =>
			Object.fromEntries(
				buildAssessmentResultReport({ assessment, state }).itemResults.map((item) => [item.identifier, item.sessionStatus]),
			);
		// The player's own record of the ended test, and the snapshot the backend finalized with.
		expect(status(player.getState({ includeItemSessions: true }))).toEqual({ c1: 'final', c2: 'final' });
		expect(status(saves.at(-1)!.state)).toEqual({ c1: 'final', c2: 'final' });
		// Every delivered session is over, the active one included.
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('closed');
	});

	it('an end of the test that does not finalize leaves the checked item attemptable', async () => {
		let failing = true;
		const { player, assessment, saves } = await create(practicePart(), {
			adjust: (backend) => {
				const finalize = backend.finalizeAssessment.bind(backend);
				backend.finalizeAssessment = async (request) =>
					failing
						? { success: false, totalScore: 0, maxScore: 0, itemScores: {}, finalizedAt: Date.now() }
						: finalize(request);
			},
		});
		player.updateResponse('RESPONSE', 'B');
		await player.checkCurrentItem();
		await player.next();
		player.updateResponse('RESPONSE', 'A');
		expect((await failureOf(player.submit()))?.code).toBe('finalizeFailed');

		// The stored draft keeps c1 open for the attempt the candidate may still use.
		expect(saves.at(-1)?.state.itemSessions?.c1?.lifecycleStatus).not.toBe('closed');
		await player.navigateTo(0);
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('interacting');
		expect(player.getCheckAnswerState()).toMatchObject({ attemptsUsed: 1, remainingAttempts: 1 });

		failing = false;
		await player.submit();
		const report = buildAssessmentResultReport({ assessment, state: player.getState({ includeItemSessions: true }) });
		expect(report.itemResults.map((item) => item.sessionStatus)).toEqual(['final', 'final']);
	});
});
