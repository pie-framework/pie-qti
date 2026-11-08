/**
 * The proctor console surface of `<pie-qti-assessment-player>`: the query methods and
 * the force-submit proxy to the shell, the `scope-time-expired` and `session-finalized`
 * events, `player-pause` for a session restored paused (heard at mount), and the
 * `allow-start-over` attribute.
 */

import './setup';
import { describe, expect, test } from 'bun:test';
import { AssessmentPlayer, type BackendAdapter, type BackendAssessmentPlayerConfig } from '@pie-qti/assessment-player';
import { QtiAssessmentPlayerElement } from '../src/elements/QtiAssessmentPlayerElement.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';
const itemXml = `<assessmentItem ${NS} identifier="q1" title="Q1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const assessment = {
	identifier: 'proctor-assessment',
	title: 'Proctor console',
	navigationMode: 'nonlinear' as const,
	submissionMode: 'simultaneous' as const,
	testParts: [
		{
			identifier: 'part',
			sections: [
				{
					identifier: 'section',
					visible: true,
					assessmentItemRefs: [{ identifier: 'q1', role: 'candidate' as const, itemXml }],
				},
			],
		},
	],
};

function backendWith(init: Partial<Awaited<ReturnType<BackendAdapter['initSession']>>>): BackendAdapter {
	return {
		async initSession() {
			return { sessionId: 'session-1', assessment, ...init };
		},
		async submitResponses() {
			return { success: true };
		},
		async saveState() {
			return { success: true, savedAt: Date.now() };
		},
		async finalizeAssessment() {
			return { success: true, totalScore: 0, maxScore: 0, itemScores: {}, finalizedAt: Date.now() };
		},
	};
}

type FakeShell = Record<string, (...args: unknown[]) => unknown>;

class TestProctorElement extends QtiAssessmentPlayerElement {
	fakeShell: FakeShell | null = null;

	protected override _mountOrUpdate() {}
	protected override get _instance() {
		return this.fakeShell as never;
	}

	exposeProps() {
		return this.getProps() as { config: Partial<BackendAssessmentPlayerConfig>; allowStartOver: boolean };
	}
}

const TEST_TAG = 'test-qti-assessment-player-proctor';
if (!customElements.get(TEST_TAG)) customElements.define(TEST_TAG, TestProctorElement);

function createElement(): TestProctorElement {
	const element = document.createElement(TEST_TAG) as TestProctorElement;
	element.backend = backendWith({});
	element.initSession = { assessmentId: 'proctor-assessment', candidateId: 'candidate' };
	return element;
}

function collect<T>(element: HTMLElement, type: string): T[] {
	const details: T[] = [];
	element.addEventListener(type, (event) => details.push((event as CustomEvent<T>).detail));
	return details;
}

describe('proctor queries and force-submit', () => {
	test('proxy to the mounted shell, with safe defaults before mount', async () => {
		const element = createElement();
		expect(element.isPaused()).toBe(false);
		expect(element.getPauseReason()).toBeUndefined();
		expect(element.isFinalized()).toBe(false);
		expect(element.getTimeState()).toBeUndefined();
		await element.flushAutosave();

		const calls: Array<[string, unknown[]]> = [];
		const record = (name: string, value: unknown) => (...args: unknown[]) => {
			calls.push([name, args]);
			return value;
		};
		element.fakeShell = {
			isPaused: record('isPaused', true),
			getPauseReason: record('getPauseReason', 'Fire drill'),
			isFinalized: record('isFinalized', false),
			getTimeState: record('getTimeState', { limited: true, remainingSeconds: 42, paused: true }),
			flushAutosave: record('flushAutosave', Promise.resolve()),
			submit: record('submit', Promise.resolve({ totalScore: 1 })),
		};
		expect(element.isPaused()).toBe(true);
		expect(element.getPauseReason()).toBe('Fire drill');
		expect(element.isFinalized()).toBe(false);
		expect(element.getTimeState()).toMatchObject({ remainingSeconds: 42, paused: true });
		await element.flushAutosave();
		await expect(element.submit({ force: true })).resolves.toEqual({ totalScore: 1 });
		expect(calls.find(([name]) => name === 'submit')?.[1]).toEqual([{ force: true }]);
	});
});

describe('events', () => {
	test('scope-time-expired and session-finalized are dispatched from the core hooks', () => {
		const element = createElement();
		const scopes = collect<unknown>(element, 'scope-time-expired');
		const finalized = collect<unknown>(element, 'session-finalized');
		const { config } = element.exposeProps();

		config.onScopeTimeExpired?.({ scope: 'section', identifier: 'S1', deliveryContinues: true });
		const results = { totalScore: 2, maxScore: 3, itemResults: [], completedAt: new Date(0) };
		config.onFinalized?.({ restored: false, results });

		expect(scopes).toEqual([{ scope: 'section', identifier: 'S1', deliveryContinues: true }]);
		expect(finalized).toEqual([{ restored: false, results }]);
	});

	test('session-finalized names why the test ended; the submit event carries the results of every ending', () => {
		const element = createElement();
		const finalized = collect<{ endReason?: string }>(element, 'session-finalized');
		const submitted = collect<{ results: unknown }>(element, 'submit');
		const props = element.exposeProps() as unknown as {
			config: Partial<BackendAssessmentPlayerConfig>;
			onSubmit: (results: unknown) => void;
		};
		const results = { totalScore: 0, maxScore: 1, itemResults: [], completedAt: new Date(0), endReason: 'proctor' as const };

		props.config.onFinalized?.({ restored: false, results, endReason: 'proctor' });
		// The shell calls onSubmit once for every ending (proctor, branch, expiry, candidate).
		props.onSubmit(results);

		expect(finalized).toEqual([{ restored: false, results, endReason: 'proctor' }]);
		expect(submitted).toEqual([{ results }]);
	});

	test('a session restored paused fires player-pause at mount', async () => {
		const element = createElement();
		const pauses = collect<{ reason?: string }>(element, 'player-pause');
		const { config } = element.exposeProps();
		const backend = backendWith({
			restoredState: {
				currentItemIdentifier: 'q1',
				visitedItems: ['q1'],
				itemResponses: {},
				itemScores: {},
				timing: { startedAt: 0, itemTimes: {}, totalTime: 5_000, isPaused: true, pauseReason: 'Proctor check' },
			},
		});
		const player = await AssessmentPlayer.create({
			...config,
			backend,
			initSession: { assessmentId: 'proctor-assessment', candidateId: 'candidate' },
		});
		try {
			expect(player.isPaused()).toBe(true);
			expect(pauses).toEqual([{ reason: 'Proctor check' }]);
		} finally {
			player.destroy();
		}
	});

	test('a session restored finalized fires session-finalized with restored: true', async () => {
		const element = createElement();
		const finalized = collect<{ restored: boolean; results: { totalScore: number } }>(element, 'session-finalized');
		const { config } = element.exposeProps();
		const backend = backendWith({ finalized: true, finalResults: { totalScore: 4, maxScore: 5 } });
		const player = await AssessmentPlayer.create({
			...config,
			backend,
			initSession: { assessmentId: 'proctor-assessment', candidateId: 'candidate' },
		});
		try {
			expect(finalized).toHaveLength(1);
			expect(finalized[0]).toMatchObject({ restored: true, results: { totalScore: 4 } });
		} finally {
			player.destroy();
		}
	});
});

describe('allow-start-over', () => {
	test('defaults on; only "false" turns Start over off; the property reflects the attribute', () => {
		const element = createElement();
		expect(element.allowStartOver).toBe(true);
		expect(element.exposeProps().allowStartOver).toBe(true);

		element.attributeChangedCallback('allow-start-over', null, 'false');
		expect(element.allowStartOver).toBe(false);
		expect(element.exposeProps().allowStartOver).toBe(false);

		element.attributeChangedCallback('allow-start-over', 'false', '');
		expect(element.allowStartOver).toBe(true);

		element.allowStartOver = false;
		expect(element.getAttribute('allow-start-over')).toBe('false');
		element.allowStartOver = true;
		expect(element.hasAttribute('allow-start-over')).toBe(false);
	});
});
