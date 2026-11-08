/**
 * Time administration in the assessment core: the opt-in begin gate (no clock runs
 * before start()), proctor pause/resume (every clock frozen, the live attempt suspended
 * and reopened, candidate actions rejected), whole-test expiry auto-finalization through
 * the normal end-of-test path, the expiry dead end the candidate must be able to submit
 * from, and per-threshold warnings. Clocks are injected; expiry needs the real 1s tick.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import {
	AssessmentPlayer,
	type AssessmentTimeExpiryEvent,
	type BackendAssessmentPlayerConfig,
	type ScopeTimeExpiryEvent,
} from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SubmitResponsesRequest } from '../src/integration/api-contract.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing><responseCondition><responseIf>
    <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
    <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
  </responseIf></responseCondition></responseProcessing>
</assessmentItem>`;

const items = (...ids: string[]) => Object.fromEntries(ids.map((id) => [`${id}.xml`, choiceItem(id)]));
const ref = (identifier: string, timeLimits = '') =>
	`<assessmentItemRef identifier="${identifier}" href="${identifier}.xml">${timeLimits}</assessmentItemRef>`;

function testXml(options: {
	testLimits?: string;
	partLimits?: string;
	sectionLimits?: string;
	submissionMode?: 'individual' | 'simultaneous';
	navigationMode?: 'linear' | 'nonlinear';
	refs?: string;
	extraSections?: string;
	partRubric?: string;
}) {
	return `<assessmentTest ${NS} identifier="timed" title="Timed test">
  ${options.testLimits ?? ''}
  <testPart identifier="part-1" navigationMode="${options.navigationMode ?? 'nonlinear'}" submissionMode="${options.submissionMode ?? 'individual'}">
    ${options.partLimits ?? ''}
    ${options.partRubric ?? ''}
    <assessmentSection identifier="s1" title="Section one" visible="true">
      ${options.sectionLimits ?? ''}
      ${options.refs ?? ref('i1') + ref('i2')}
    </assessmentSection>
    ${options.extraSections ?? ''}
  </testPart>
</assessmentTest>`;
}

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 1_100));

async function deliver(
	xml: string,
	files: Record<string, string>,
	config: Partial<BackendAssessmentPlayerConfig> = {},
	adjust?: (backend: ReferenceBackendAdapter) => void,
) {
	let now = 1_000;
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, { itemXmlMap: files });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const submissions: SubmitResponsesRequest[] = [];
	const originalSubmit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request) => {
		submissions.push(structuredClone(request));
		return originalSubmit(request);
	};
	let finalizeCalls = 0;
	const originalFinalize = backend.finalizeAssessment.bind(backend);
	backend.finalizeAssessment = async (request) => {
		finalizeCalls += 1;
		return originalFinalize(request);
	};
	adjust?.(backend);
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		now: () => now,
		...config,
	});
	players.push(player);
	return {
		player,
		backend,
		submissions,
		finalizeCalls: () => finalizeCalls,
		advance: (ms: number) => {
			now += ms;
		},
	};
}

describe('begin gate', () => {
	test('holds delivery and every clock until start()', async () => {
		const xml = testXml({
			testLimits: '<timeLimits maxTime="600"/>',
			partRubric: '<rubricBlock view="candidate"><p>Read each question carefully.</p></rubricBlock>',
		});
		const { player, advance } = await deliver(xml, items('i1', 'i2'), { beginGate: true });

		expect(player.hasStarted()).toBe(false);
		expect(player.getNavigationState().currentIndex).toBe(-1);
		expect(player.getCurrentItemSession()).toBeNull();
		const info = player.getStartInfo();
		expect(info).toMatchObject({
			title: 'Timed test',
			testTimeLimitSeconds: 600,
			hasScopedTimeLimits: false,
			totalItems: 2,
			resuming: false,
		});
		expect(info.rubricBlocks[0]?.content).toContain('Read each question carefully.');

		// Time on the start screen does not count.
		advance(120_000);
		expect(player.getRemainingTime()).toBe(600);
		expect(player.getState().timing.totalTime).toBe(0);
		// The gate's hold is not a proctor pause: a snapshot never reopens paused.
		expect(player.getState().timing.isPaused).toBe(false);
		await expect(player.next()).rejects.toMatchObject({ code: 'navigationNotAllowed' });
		expect(() => player.updateResponse('RESPONSE', 'A')).not.toThrow();

		player.start();
		expect(player.hasStarted()).toBe(true);
		expect(player.getCurrentItem()?.identifier).toBe('i1');
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).not.toBe('suspended');
		advance(10_000);
		expect(player.getRemainingTime()).toBe(590);

		// Idempotent.
		player.start();
		expect(player.getCurrentItem()?.identifier).toBe('i1');
	});

	test('without the gate delivery and the clocks start at creation, as before', async () => {
		const { player, advance } = await deliver(testXml({ testLimits: '<timeLimits maxTime="600"/>' }), items('i1', 'i2'));
		expect(player.hasStarted()).toBe(true);
		expect(player.getCurrentItem()?.identifier).toBe('i1');
		advance(5_000);
		expect(player.getRemainingTime()).toBe(595);
		player.start(); // no-op
		expect(player.getRemainingTime()).toBe(595);
	});

	test('reports scoped limits and the time left on a resumed session', async () => {
		const xml = testXml({ testLimits: '<timeLimits maxTime="300"/>', sectionLimits: '<timeLimits maxTime="120"/>' });
		const first = await deliver(xml, items('i1', 'i2'));
		first.advance(30_000);
		const saved = first.player.getState();

		const { player } = await deliver(xml, items('i1', 'i2'), { beginGate: true });
		await player.restoreState(structuredClone(saved));
		expect(player.hasStarted()).toBe(false);
		expect(player.getStartInfo()).toMatchObject({ testTimeLimitSeconds: 270, hasScopedTimeLimits: true, resuming: true });
	});
});

describe('proctor pause', () => {
	test('freezes every clock, suspends the attempt and rejects candidate actions until resume', async () => {
		const xml = testXml({ testLimits: '<timeLimits maxTime="600"/>', sectionLimits: '<timeLimits maxTime="300"/>' });
		const { player, advance } = await deliver(xml, items('i1', 'i2'));
		const changes: Array<[boolean, string | undefined]> = [];
		player.onPauseChange((paused, reason) => changes.push([paused, reason]));

		player.updateResponse('RESPONSE', 'B');
		advance(20_000);
		player.pause('Fire drill: please wait');
		expect(player.isPaused()).toBe(true);
		expect(player.getPauseReason()).toBe('Fire drill: please wait');
		expect(changes).toEqual([[true, 'Fire drill: please wait']]);
		const remainingAtPause = player.getRemainingTime();
		const sectionElapsedAtPause = player.getState().timing.sectionTimes?.s1;
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('suspended');
		const durationAtPause = player.getState({ includeItemSessions: true }).itemSessions?.i1?.duration;

		// Ten minutes of pause count against nothing.
		advance(600_000);
		expect(player.getRemainingTime()).toBe(remainingAtPause);
		expect(player.getTimeState()).toMatchObject({ paused: true, limited: true, scope: 'section' });
		expect(player.getState().timing.sectionTimes?.s1).toBe(sectionElapsedAtPause);
		expect(player.getState({ includeItemSessions: true }).itemSessions?.i1?.duration).toBe(durationAtPause);
		expect(player.getState().timing).toMatchObject({ isPaused: true, pauseReason: 'Fire drill: please wait' });

		expect(() => player.updateResponse('RESPONSE', 'A')).toThrow(expect.objectContaining({ code: 'assessmentPaused' }));
		await expect(player.next()).rejects.toMatchObject({ code: 'assessmentPaused' });
		await expect(player.submit()).rejects.toMatchObject({ code: 'assessmentPaused' });

		// A second pause call only updates the shown reason.
		player.pause('Fire drill: stay seated');
		expect(changes.at(-1)).toEqual([true, 'Fire drill: stay seated']);

		player.resume();
		expect(player.isPaused()).toBe(false);
		expect(changes.at(-1)).toEqual([false, undefined]);
		const session = player.getCurrentItemSession();
		expect(session?.state().lifecycleStatus).toBe('interacting');
		expect(player.getResponses()).toEqual({ RESPONSE: 'B' });
		advance(5_000);
		expect(player.getRemainingTime()).toBe(remainingAtPause - 5);
		player.updateResponse('RESPONSE', 'A');
		expect(player.getResponses()).toEqual({ RESPONSE: 'A' });
		expect(player.getState().timing.isPaused).toBe(false);
	});

	test('a paused snapshot reopens paused until the host resumes it', async () => {
		const xml = testXml({ testLimits: '<timeLimits maxTime="600"/>' });
		const first = await deliver(xml, items('i1', 'i2'));
		first.advance(10_000);
		first.player.pause('Technical issue');
		const saved = first.player.getState({ includeItemSessions: true });

		const { player, advance } = await deliver(xml, items('i1', 'i2'));
		await player.restoreState(structuredClone(saved));
		expect(player.isPaused()).toBe(true);
		expect(player.getPauseReason()).toBe('Technical issue');
		const remaining = player.getRemainingTime();
		advance(60_000);
		expect(player.getRemainingTime()).toBe(remaining);
		player.resume();
		advance(1_000);
		expect(player.getRemainingTime()).toBe(remaining - 1);
	});

	test('a pause requested during a transition applies when it settles', async () => {
		const { player } = await deliver(testXml({}), items('i1', 'i2'), {}, (backend) => {
			const submit = backend.submitResponses.bind(backend);
			backend.submitResponses = async (request) => {
				await new Promise((resolve) => setTimeout(resolve, 30));
				return submit(request);
			};
		});
		player.updateResponse('RESPONSE', 'A');
		const moving = player.next();
		player.pause();
		expect(player.isPaused()).toBe(false);
		await moving;
		expect(player.isPaused()).toBe(true);
		expect(player.getCurrentItem()?.identifier).toBe('i2');
		expect(player.getCurrentItemSession()?.state().lifecycleStatus).toBe('suspended');
	});
});

describe('whole-test expiry', () => {
	test('auto-finalizes through the end-of-test path and reports it', async () => {
		const xml = testXml({ testLimits: '<timeLimits maxTime="5"/>', submissionMode: 'simultaneous' });
		const expiries: AssessmentTimeExpiryEvent[] = [];
		const configExpiries: AssessmentTimeExpiryEvent[] = [];
		let completed = 0;
		const { player, advance, submissions, finalizeCalls } = await deliver(xml, items('i1', 'i2'), {
			onTimeExpired: (event) => configExpiries.push(event),
			onComplete: () => completed++,
		});
		player.onTimeExpired((event) => expiries.push(event));

		player.updateResponse('RESPONSE', 'A');
		await player.next();
		player.updateResponse('RESPONSE', 'A');
		advance(6_000);
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(player.getNavigationState().isComplete).toBe(true);
		expect(finalizeCalls()).toBe(1);
		expect(completed).toBe(1);
		// Every pending response was collected as the time-expired terminal submission.
		expect(submissions.map((s) => s.itemIdentifier)).toEqual(['i1', 'i2']);
		expect(submissions.every((s) => s.timing?.submissionReason === 'time-expired')).toBe(true);
		expect(expiries).toEqual([{ scope: 'assessment', autoFinalized: true, submissionRequired: false }]);
		expect(configExpiries).toEqual(expiries);
		// submit() afterwards returns the same results.
		const results = await player.submit();
		expect(results.totalScore).toBe(2);
		expect(finalizeCalls()).toBe(1);
	});

	test('allowLateSubmission keeps the test open past its limit', async () => {
		const xml = testXml({ testLimits: '<timeLimits maxTime="2" allowLateSubmission="true"/>' });
		const expiries: AssessmentTimeExpiryEvent[] = [];
		const { player, advance, finalizeCalls } = await deliver(xml, items('i1', 'i2'));
		player.onTimeExpired((event) => expiries.push(event));
		advance(5_000);
		await tick();
		expect(player.isTimeExpired()).toBe(true);
		expect(player.getNavigationState().isComplete).toBe(false);
		expect(expiries).toEqual([]);
		expect(finalizeCalls()).toBe(0);
		player.updateResponse('RESPONSE', 'A');
		await player.submit();
		expect(finalizeCalls()).toBe(1);
	});

	test('a failed auto-finalize leaves the test open and asks for a submission', async () => {
		let failFinalize = true;
		const errors: Error[] = [];
		const expiries: AssessmentTimeExpiryEvent[] = [];
		const { player, advance } = await deliver(
			testXml({ testLimits: '<timeLimits maxTime="2"/>' }),
			items('i1', 'i2'),
			{ onError: (error) => errors.push(error) },
			(backend) => {
				const finalize = backend.finalizeAssessment.bind(backend);
				backend.finalizeAssessment = async (request) => {
					if (failFinalize) throw new Error('finalization is down');
					return finalize(request);
				};
			},
		);
		player.onTimeExpired((event) => expiries.push(event));
		advance(3_000);
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(player.getNavigationState().isComplete).toBe(false);
		expect(expiries).toEqual([{ scope: 'assessment', autoFinalized: false, submissionRequired: true }]);
		expect(errors.map((error) => error.message)).toContain('finalization is down');

		// The retry the shell offers succeeds once the backend recovers.
		failFinalize = false;
		await player.submit();
		expect(player.getNavigationState().isComplete).toBe(true);
	});
});

describe('scope expiry', () => {
	test('moves on and reports the expired scope; its frozen responses are collected at the end', async () => {
		const xml = testXml({
			sectionLimits: '<timeLimits maxTime="3"/>',
			extraSections: `<assessmentSection identifier="s2" title="Section two" visible="true">${ref('i3')}</assessmentSection>`,
		});
		const scopes: ScopeTimeExpiryEvent[] = [];
		const { player, advance, submissions } = await deliver(xml, items('i1', 'i2', 'i3'));
		player.onScopeTimeExpired((event) => scopes.push(event));

		player.updateResponse('RESPONSE', 'A');
		advance(4_000);
		await tick();
		expect(scopes).toEqual([{ scope: 'section', identifier: 's1', deliveryContinues: true, nextIndex: 2 }]);
		expect(player.getCurrentItem()?.identifier).toBe('i3');

		player.updateResponse('RESPONSE', 'A');
		const results = await player.submit();
		const i1 = submissions.find((s) => s.itemIdentifier === 'i1');
		expect(i1?.responses).toEqual({ RESPONSE: 'A' });
		expect(i1?.timing?.submissionReason).toBe('time-expired');
		expect(submissions.find((s) => s.itemIdentifier === 'i3')?.timing?.submissionReason).toBeUndefined();
		expect(results.totalScore).toBe(2);
	});

	test('an expiry dead end asks for a submission that the backend accepts', async () => {
		const xml = testXml({ partLimits: '<timeLimits maxTime="3"/>', submissionMode: 'simultaneous' });
		const expiries: AssessmentTimeExpiryEvent[] = [];
		const { player, advance, submissions } = await deliver(xml, items('i1', 'i2'));
		player.onTimeExpired((event) => expiries.push(event));

		player.updateResponse('RESPONSE', 'A');
		advance(4_000);
		await tick();
		expect(expiries).toEqual([
			{ scope: 'testPart', identifier: 'part-1', autoFinalized: false, submissionRequired: true },
		]);
		// Nothing is reachable: no Next, no Previous — submitting is the way out.
		expect(player.getNavigationState()).toMatchObject({ canNext: false, canPrevious: false, isComplete: false });
		expect(player.getForwardTransitionInfo().nextIndex).toBeNull();

		const results = await player.submit();
		expect(player.getNavigationState().isComplete).toBe(true);
		expect(submissions.every((s) => s.timing?.submissionReason === 'time-expired')).toBe(true);
		expect(results.totalScore).toBe(1);
	});
});

describe('warnings', () => {
	test('each configured threshold fires once per limiting scope', async () => {
		const warnings: number[] = [];
		const { player, advance } = await deliver(testXml({ testLimits: '<timeLimits maxTime="20"/>' }), items('i1', 'i2'), {
			timeWarningThreshold: 5,
			timeWarningThresholds: [10],
		});
		player.onTimeWarning((remaining) => warnings.push(remaining));
		advance(9_000);
		await tick();
		expect(warnings).toEqual([]);
		advance(2_000);
		await tick();
		expect(warnings).toEqual([9]);
		await tick();
		expect(warnings).toEqual([9]);
		advance(5_000);
		await tick();
		expect(warnings).toEqual([9, 4]);
	});
});

describe('reference backend timing', () => {
	test('measures the test limit on the candidate clock, so gate and pause time never count', async () => {
		const xml = testXml({ testLimits: '<timeLimits maxTime="60"/>' });
		const { player, advance, submissions } = await deliver(xml, items('i1', 'i2'), { beginGate: true });
		// Real wall time is irrelevant to the injected clock; the evidence carries the candidate clock.
		advance(300_000);
		player.start();
		advance(10_000);
		player.pause();
		advance(300_000);
		player.resume();
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		expect(submissions[0]?.timing).toMatchObject({ assessmentElapsedMs: 10_000, assessmentLimitSeconds: 60 });
		expect(player.getCurrentItem()?.identifier).toBe('i2');
	});

	test('rejects late candidate submissions but accepts the time-expired collection', async () => {
		const backend = new ReferenceBackendAdapter();
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml({ testLimits: '<timeLimits maxTime="60"/>' }), {
			itemXmlMap: items('i1', 'i2'),
		});
		backend.registerAssessment(parsed.identifier, parsed);
		const init = await backend.initSession({ assessmentId: parsed.identifier, candidateId: 'candidate' });
		const late = {
			scope: 'assessment' as const,
			elapsedMs: 61_000,
			limitSeconds: 60,
			expired: true,
			allowLateSubmission: false,
			assessmentElapsedMs: 61_000,
			assessmentLimitSeconds: 60,
		};
		const rejected = await backend.submitResponses({
			sessionId: init.sessionId,
			itemIdentifier: 'i1',
			responses: { RESPONSE: 'A' },
			submittedAt: Date.now(),
			timing: late,
		});
		expect(rejected).toMatchObject({ success: false, error: 'Assessment time limit expired' });

		const collected = await backend.submitResponses({
			sessionId: init.sessionId,
			itemIdentifier: 'i1',
			responses: { RESPONSE: 'A' },
			submittedAt: Date.now(),
			timing: { ...late, submissionReason: 'time-expired' },
		});
		expect(collected.success).toBe(true);
	});
});
