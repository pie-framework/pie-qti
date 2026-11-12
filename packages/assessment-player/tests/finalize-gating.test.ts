/**
 * Finalize vs allowSkipping / validateResponses (QTI itemSessionControl), the start-over
 * policy after a time expiry, and restore-time expiry locks.
 *
 * One coherent rule: both attributes apply only to items in `individual` submission
 * parts (QTI: "only applicable when the item is in a testPart with individual submission
 * mode"). A candidate-initiated submission — the per-item paths and the finalize — never
 * submits a skipped item (no response) while `allowSkipping=false`, nor an answered item
 * whose responses fail validation while `validateResponses=true`. The finalize rejects
 * with a typed error naming the items instead of failing generically. Time-expiry
 * finalization ignores both gates (the QTI end-of-scope collection), so unanswered
 * required items are recorded as skipped by the expiry.
 */

import './setup';
import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer, type AssessmentTimeExpiryEvent } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment, SecureItemRef, SubmitResponsesRequest } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`;

/** Requires two of three choices: a single selection is answered but invalid. */
const pickTwoItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><p>Pick two</p><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" minChoices="2" maxChoices="3"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice><simpleChoice identifier="C">C</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const ref = (identifier: string, itemXml = choiceItem(identifier)): SecureItemRef => ({
	identifier,
	role: 'candidate',
	itemXml,
});

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

interface FixtureOptions {
	itemSessionControl?: SecureAssessment['testParts'][number]['itemSessionControl'];
	submissionMode?: 'individual' | 'simultaneous';
	navigationMode?: 'linear' | 'nonlinear';
	items?: SecureItemRef[];
	timeLimits?: SecureAssessment['timeLimits'];
	sections?: SecureAssessment['testParts'][number]['sections'];
	now?: () => number;
	adjust?: (backend: ReferenceBackendAdapter) => void;
}

async function fixture(options: FixtureOptions = {}) {
	const submissionMode = options.submissionMode ?? 'individual';
	const navigationMode = options.navigationMode ?? 'nonlinear';
	const assessment: SecureAssessment = {
		identifier: 'finalize-gating',
		title: 'Finalize gating',
		navigationMode,
		submissionMode,
		...(options.timeLimits ? { timeLimits: options.timeLimits } : {}),
		testParts: [
			{
				identifier: 'part-1',
				navigationMode,
				submissionMode,
				...(options.itemSessionControl ? { itemSessionControl: options.itemSessionControl } : {}),
				sections: options.sections ?? [
					{
						identifier: 'section-1',
						visible: true,
						assessmentItemRefs: options.items ?? [ref('item-1'), ref('item-2')],
					},
				],
			},
		],
	};
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const calls: SubmitResponsesRequest[] = [];
	const submit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request) => {
		calls.push(structuredClone(request));
		return submit(request);
	};
	options.adjust?.(backend);
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		...(options.now ? { now: options.now } : {}),
	});
	players.push(player);
	return { player, backend, calls, submittedIds: () => calls.map((call) => call.itemIdentifier) };
}

const realTick = () => new Promise((resolve) => setTimeout(resolve, 1_100));
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

describe('finalize vs allowSkipping', () => {
	it('a candidate finalize does not submit a NULL item left behind while allowSkipping=false; it rejects naming the item', async () => {
		const { player, submittedIds } = await fixture({ itemSessionControl: { allowSkipping: false } });

		// Jump away from the unanswered first item: navigation itself is not submission.
		await player.navigateTo(1);
		expect(submittedIds()).toEqual([]);
		player.updateResponse('RESPONSE', 'B');

		const error = await player.submit().then(
			() => null,
			(e: unknown) => e as { code?: string; params?: Record<string, string | number> },
		);
		expect(error?.code).toBe('finalizeResponseRequired');
		expect(error?.params).toMatchObject({ items: '1', itemIdentifiers: 'item-1', count: 1 });
		// Nothing was force-submitted and the test is still open.
		expect(submittedIds()).toEqual([]);
		expect(player.isFinalized()).toBe(false);
		// The submit confirmation can list the same item, with a jump where navigation allows.
		expect(player.getSubmissionBlockers()).toEqual([
			expect.objectContaining({ identifier: 'item-1', number: 1, reason: 'required', jumpAllowed: true }),
		]);
	});

	it('the same finalize succeeds once the named item is answered', async () => {
		const { player, submittedIds } = await fixture({ itemSessionControl: { allowSkipping: false } });
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'B');
		await expect(player.submit()).rejects.toMatchObject({ code: 'finalizeResponseRequired' });

		await player.navigateTo(0);
		player.updateResponse('RESPONSE', 'A');
		expect(player.getSubmissionBlockers()).toEqual([]);
		const results = await player.submit();
		expect(results.itemResults).toHaveLength(2);
		expect([...submittedIds()].sort()).toEqual(['item-1', 'item-2']);
	});

	it('time-expiry finalize ignores the gate and records the unanswered item as skipped by the expiry', async () => {
		let now = 1_000;
		const { player, calls } = await fixture({
			itemSessionControl: { allowSkipping: false },
			timeLimits: { maxTime: 5 },
			now: () => now,
		});
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', 'A');
		now += 6_000;
		await realTick();
		await settle();

		expect(player.isFinalized()).toBe(true);
		const skipped = calls.find((call) => call.itemIdentifier === 'item-1');
		expect(skipped?.timing?.submissionReason).toBe('time-expired');
		expect(Object.values(skipped?.responses ?? {}).every((value) => value == null)).toBe(true);
		const results = await player.submit();
		expect(results.itemResults.map((result) => result.itemIdentifier).sort()).toEqual(['item-1', 'item-2']);
	});

	it('allowSkipping does not gate a simultaneous part (the attribute is individual-only)', async () => {
		const { player, submittedIds } = await fixture({
			itemSessionControl: { allowSkipping: false },
			submissionMode: 'simultaneous',
		});
		expect(player.getSubmissionBlockers()).toEqual([]);
		const results = await player.submit();
		expect(results.itemResults).toHaveLength(2);
		expect(submittedIds()).toEqual(['item-1', 'item-2']);
	});

	it('next() in a simultaneous part is not blocked by allowSkipping=false', async () => {
		const { player } = await fixture({
			itemSessionControl: { allowSkipping: false },
			submissionMode: 'simultaneous',
			navigationMode: 'linear',
		});
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('item-2');
	});
});

describe('finalize vs validateResponses', () => {
	it('rejects naming an invalid left-behind item instead of failing forever with a generic error', async () => {
		const { player, calls } = await fixture({
			itemSessionControl: { allowSkipping: true, validateResponses: true },
			items: [ref('item-1'), ref('item-2', pickTwoItem('item-2'))],
		});

		player.updateResponse('RESPONSE', 'A');
		await player.navigateTo(1);
		// One choice where two are required: answered, but invalid.
		player.updateResponse('RESPONSE', ['A']);
		await player.navigateTo(0);

		const error = await player.submit().then(
			() => null,
			(e: unknown) => e as { code?: string; params?: Record<string, string | number> },
		);
		expect(error?.code).toBe('finalizeResponseInvalid');
		expect(error?.params).toMatchObject({ items: '2', itemIdentifiers: 'item-2', count: 1 });
		expect(calls.map((call) => call.itemIdentifier)).toEqual([]);
		expect(player.isFinalized()).toBe(false);
		expect(player.getSubmissionBlockers()).toEqual([
			expect.objectContaining({ identifier: 'item-2', number: 2, reason: 'invalid' }),
		]);

		// Correcting the answer clears the gate.
		await player.navigateTo(1);
		player.updateResponse('RESPONSE', ['A', 'B']);
		await player.submit();
		expect(player.isFinalized()).toBe(true);
	});

	it('a skipped (empty) item with validateResponses is the allowSkipping gate\'s domain, not validation\'s', async () => {
		const { player } = await fixture({
			itemSessionControl: { allowSkipping: true, validateResponses: true },
			items: [ref('item-1', pickTwoItem('item-1')), ref('item-2')],
		});
		// Skipping is allowed: the empty item submits without validation.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('item-2');
	});
});

describe('per-item submission paths apply the same gates', () => {
	it('submitCurrentItem rejects a skipped item while allowSkipping=false (individual)', async () => {
		const { player, calls } = await fixture({ itemSessionControl: { allowSkipping: false } });
		await expect(player.submitCurrentItem()).rejects.toMatchObject({ code: 'responseRequired' });
		expect(calls).toEqual([]);
	});

	it('submitCurrentItem rejects an answered invalid item while validateResponses=true', async () => {
		const { player, calls } = await fixture({
			itemSessionControl: { validateResponses: true },
			items: [ref('item-1', pickTwoItem('item-1')), ref('item-2')],
		});
		player.updateResponse('RESPONSE', ['A']);
		await expect(player.submitCurrentItem()).rejects.toMatchObject({ code: 'attemptValidationFailed' });
		expect(calls).toEqual([]);
	});
});

describe('start over after expiry', () => {
	it('section expired, then start over: delivery is not stuck and there is no new time allowance', async () => {
		let now = 1_000;
		const { player } = await fixture({
			submissionMode: 'simultaneous',
			now: () => now,
			sections: [
				{ identifier: 'section-1', visible: true, timeLimits: { maxTime: 3 }, assessmentItemRefs: [ref('item-1')] },
				{ identifier: 'section-2', visible: true, assessmentItemRefs: [ref('item-2')] },
			],
		});

		// Section 1's limit expires; delivery moves to item-2.
		now += 4_000;
		await realTick();
		expect(player.getCurrentItem()?.identifier).toBe('item-2');
		player.updateResponse('RESPONSE', 'A');
		const elapsedBefore = player.getElapsedTime();

		await player.startOver();

		// The answers are gone, but the expired section stays locked: delivery sits at the
		// first unlocked item and the clocks were not reset.
		expect(player.getCurrentItem()?.identifier).toBe('item-2');
		expect(Object.values(player.getResponses()).every((value) => value == null)).toBe(true);
		await expect(player.navigateTo(0)).rejects.toMatchObject({ code: 'itemTimeExpired' });
		expect(player.getElapsedTime()).toBeGreaterThanOrEqual(elapsedBefore);
		expect(player.getState().timing.sectionTimes?.['section-1']).toBeGreaterThanOrEqual(3_000);
		// The expiry does not fire a second time for the same limit.
		const scopes: unknown[] = [];
		player.onScopeTimeExpired((event) => scopes.push(event));
		now += 1_000;
		await realTick();
		expect(scopes).toEqual([]);
		// Delivery works: the test can be submitted.
		player.updateResponse('RESPONSE', 'B');
		await player.submit();
		expect(player.isFinalized()).toBe(true);
	});

	it('a whole-test expiry survives start over: nothing unlocked remains and Submit is required again', async () => {
		let now = 1_000;
		let failFinalize = true;
		const expiries: AssessmentTimeExpiryEvent[] = [];
		const { player } = await fixture({
			submissionMode: 'simultaneous',
			timeLimits: { maxTime: 3 },
			now: () => now,
			adjust: (backend) => {
				const finalize = backend.finalizeAssessment.bind(backend);
				backend.finalizeAssessment = async (request) => {
					if (failFinalize) throw new Error('finalization is down');
					return finalize(request);
				};
			},
		});
		player.onTimeExpired((event) => expiries.push(event));

		now += 4_000;
		await realTick();
		await settle();
		// The automatic finalize failed: the test is open and the candidate must submit.
		expect(player.isFinalized()).toBe(false);
		expect(expiries.at(-1)).toMatchObject({ scope: 'assessment', submissionRequired: true });
		const before = expiries.length;

		await player.startOver();

		// Answers cleared; time accounting kept: still expired, navigation closed, and the
		// submit path is requested again.
		expect(Object.values(player.getResponses()).every((value) => value == null)).toBe(true);
		expect(player.isTimeExpired()).toBe(true);
		expect(player.getNavigationState()).toMatchObject({ canNext: false, canPrevious: false });
		expect(expiries.length).toBe(before + 1);
		expect(expiries.at(-1)).toMatchObject({ scope: 'assessment', autoFinalized: false, submissionRequired: true });

		failFinalize = false;
		await player.submit();
		expect(player.isFinalized()).toBe(true);
	});
});

describe('restore-time expiry locks (F)', () => {
	const timedSections = [
		{ identifier: 'section-1', visible: true, assessmentItemRefs: [ref('item-1')] },
		{ identifier: 'section-2', visible: true, timeLimits: { maxTime: 5 }, assessmentItemRefs: [ref('item-2')] },
		{ identifier: 'section-3', visible: true, assessmentItemRefs: [ref('item-3')] },
	];

	it('restoreState locks a scope its restored clock already expired, before any item is entered', async () => {
		let now = 1_000;
		const first = await fixture({ submissionMode: 'simultaneous', sections: timedSections, now: () => now });
		await first.player.navigateTo(1);
		first.player.updateResponse('RESPONSE', 'A');
		// 70 seconds in section-2 (no tick ran): its 5 s limit expired before the snapshot.
		now += 70_000;
		const saved = first.player.getState({ includeItemSessions: true });

		const second = await fixture({ submissionMode: 'simultaneous', sections: timedSections, now: () => now });
		const entered: string[] = [];
		second.player.onItemChange(() => {
			const id = second.player.getCurrentItem()?.identifier;
			if (id) entered.push(id);
		});
		await second.player.restoreState(saved);

		// The expired item was never entered: delivery moved past it like the live expiry.
		expect(entered).not.toContain('item-2');
		expect(second.player.getCurrentItem()?.identifier).toBe('item-3');
		await expect(second.player.navigateTo(1)).rejects.toMatchObject({ code: 'itemTimeExpired' });
		await second.player.navigateTo(0);
		expect(second.player.getCurrentItem()?.identifier).toBe('item-1');
	});

	it('a backend-restored session (resume) applies the same locks at creation', async () => {
		let now = 1_000;
		const first = await fixture({ submissionMode: 'simultaneous', sections: timedSections, now: () => now });
		await first.player.navigateTo(1);
		now += 70_000;
		await first.player.flushAutosave();
		const resumeSessionId = first.backend.latestSessionId('finalize-gating', 'candidate');
		expect(resumeSessionId).toBeTruthy();
		first.player.destroy();

		const resumed = await AssessmentPlayer.create({
			backend: first.backend,
			initSession: { assessmentId: 'finalize-gating', candidateId: 'candidate', resumeSessionId: resumeSessionId! },
			now: () => now,
		});
		players.push(resumed);
		expect(resumed.getCurrentItem()?.identifier).toBe('item-3');
		expect(resumed.isNavigationTargetLegal(1)).toBe(false);
	});

	it('an expired scope with nothing open left to reach parks read-only and asks for a submission', async () => {
		let now = 1_000;
		const sections = [
			{ identifier: 'section-1', visible: true, assessmentItemRefs: [ref('item-1')] },
			{ identifier: 'section-2', visible: true, timeLimits: { maxTime: 5 }, assessmentItemRefs: [ref('item-2')] },
		];
		// A linear part: item-1 lies behind the candidate and cannot be revisited, so
		// nothing open remains anywhere reachable (in a nonlinear part the restore would
		// land on item-1 instead — see delivery-round4 P8).
		const first = await fixture({ submissionMode: 'simultaneous', navigationMode: 'linear', sections, now: () => now });
		await first.player.next();
		now += 70_000;
		const saved = first.player.getState({ includeItemSessions: true });

		const second = await fixture({ submissionMode: 'simultaneous', navigationMode: 'linear', sections, now: () => now });
		const expiries: AssessmentTimeExpiryEvent[] = [];
		second.player.onTimeExpired((event) => expiries.push(event));
		await second.player.restoreState(saved);

		// The locked current item is shown read-only, never editable.
		expect(second.player.getCurrentItem()?.identifier).toBe('item-2');
		expect(second.player.getCurrentItemSession()?.state().lifecycleStatus).toBe('suspended');
		expect(() => second.player.updateResponse('RESPONSE', 'B')).toThrow();
		expect(expiries).toEqual([
			{ scope: 'section', identifier: 'section-2', autoFinalized: false, submissionRequired: true },
		]);
		// The way out is the submission, which collects the frozen responses.
		await second.player.submit();
		expect(second.player.isFinalized()).toBe(true);
	});
});
