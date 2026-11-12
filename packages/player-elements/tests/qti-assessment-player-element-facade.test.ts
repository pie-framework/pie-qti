/**
 * Phase 5 pinning tests (player-cleanup plan, element façade): every imperative
 * `QtiAssessmentPlayerElement` method reaches the AssessmentShell export it
 * proxies and does what it says — arguments go through, results come back, and
 * an unmounted element reports its safe defaults instead of throwing. The
 * façade interface (`AssessmentShellApi`) is pinned against the real shell
 * source: a shell export the element proxies that moves, renames or disappears
 * fails these tests (and the compile against the interface) instead of
 * silently no-oping through `any` optional chaining.
 */

import './setup';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import type { AssessmentSessionState } from '@pie-qti/assessment-player';
import {
	QtiAssessmentPlayerElement,
	type AssessmentShellApi,
} from '../src/elements/QtiAssessmentPlayerElement.js';

/** Every shell export the element proxies, per the façade interface. */
const FACADE_METHODS = [
	'next',
	'previous',
	'navigateTo',
	'navigateToSection',
	'submit',
	'getResponses',
	'getState',
	'restoreState',
	'start',
	'hasStarted',
	'pause',
	'resume',
	'isPaused',
	'getPauseReason',
	'isFinalized',
	'getTimeState',
	'flushAutosave',
] as const;

type FacadeMethod = (typeof FACADE_METHODS)[number];

type RecordingShell = Record<FacadeMethod, (...args: never[]) => unknown>;

class TestFacadeElement extends QtiAssessmentPlayerElement {
	fakeShell: AssessmentShellApi | null = null;

	protected override _mountOrUpdate() {}
	protected override get _instance() {
		return this.fakeShell;
	}
}

const TEST_TAG = 'test-qti-assessment-player-facade';
if (!customElements.get(TEST_TAG)) customElements.define(TEST_TAG, TestFacadeElement);

function recordingShell(returns: Partial<Record<FacadeMethod, unknown>>) {
	const calls: Array<{ name: FacadeMethod; args: unknown[] }> = {};
	const shell = {} as RecordingShell;
	for (const name of FACADE_METHODS) {
		calls[name] = { name, args: [] } as never;
		shell[name] = ((...args: unknown[]) => {
			(calls[name] as unknown as { args: unknown[] }).args = args;
			return returns[name];
		}) as never;
	}
	return { shell: shell as unknown as AssessmentShellApi, calls };
}

function createElement(): TestFacadeElement {
	return document.createElement(TEST_TAG) as TestFacadeElement;
}

const sampleState: AssessmentSessionState = {
	currentItemIdentifier: 'item-1',
	visitedItems: ['item-1'],
	itemResponses: {},
	timing: { startedAt: 0, itemTimes: {}, totalTime: 0 },
};
const sampleResults = { totalScore: 2, maxScore: 3, itemResults: [], completedAt: new Date(0) };

describe('element methods reach their shell exports', () => {
	test('navigation and submission proxy arguments and return the shell results', async () => {
		const element = createElement();
		const { shell, calls } = recordingShell({
			next: Promise.resolve('nexted'),
			previous: Promise.resolve('previoused'),
			navigateTo: Promise.resolve('navigated'),
			navigateToSection: Promise.resolve('section-navigated'),
			submit: Promise.resolve(sampleResults),
		});
		element.fakeShell = shell;

		await expect(element.next()).resolves.toBe('nexted');
		await expect(element.previous()).resolves.toBe('previoused');
		await expect(element.navigateTo(3)).resolves.toBe('navigated');
		await expect(element.navigateToSection('section-2')).resolves.toBe('section-navigated');
		await expect(element.submit({ force: true })).resolves.toBe(sampleResults);

		expect(calls.next!.args).toEqual([]);
		expect(calls.previous!.args).toEqual([]);
		expect(calls.navigateTo!.args).toEqual([3]);
		expect(calls.navigateToSection!.args).toEqual(['section-2']);
		expect(calls.submit!.args).toEqual([{ force: true }]);

		// A candidate submit without options calls the shell with none.
		await element.submit();
		expect(calls.submit!.args).toEqual([]);
	});

	test('session queries and restore proxy through unchanged', async () => {
		const element = createElement();
		const { shell, calls } = recordingShell({
			getResponses: { RESPONSE: 'A' },
			getState: sampleState,
			restoreState: Promise.resolve('restored'),
		});
		element.fakeShell = shell;

		expect(element.getResponses()).toEqual({ RESPONSE: 'A' });
		expect(element.getState()).toBe(sampleState);
		// restoreState hands the shell's promise straight back.
		expect(element.restoreState(sampleState)).resolves.toBe('restored');

		expect(calls.getResponses!.args).toEqual([]);
		expect(calls.getState!.args).toEqual([]);
		expect(calls.restoreState!.args).toEqual([sampleState]);
	});

	test('begin gate, proctor pause and terminal queries proxy through unchanged', async () => {
		const element = createElement();
		const flushed = Promise.resolve('flushed');
		const { shell, calls } = recordingShell({
			start: Promise.resolve('started'),
			hasStarted: true,
			isPaused: true,
			getPauseReason: 'Fire drill',
			isFinalized: true,
			getTimeState: {
				limited: true,
				remainingSeconds: 42,
				paused: true,
				started: true,
				scope: 'assessment',
				allowLateSubmission: false,
			},
			flushAutosave: flushed,
		});
		element.fakeShell = shell;

		await expect(element.start()).resolves.toBe('started');
		expect(element.hasStarted()).toBe(true);
		expect(element.isPaused()).toBe(true);
		expect(element.getPauseReason()).toBe('Fire drill');
		expect(element.isFinalized()).toBe(true);
		expect(element.getTimeState()).toMatchObject({ remainingSeconds: 42, paused: true });
		// flushAutosave waits for the shell's save to settle.
		await expect(element.flushAutosave()).resolves.toBeUndefined();
		expect(calls.flushAutosave!.args).toEqual([]);

		expect(calls.start!.args).toEqual([]);
		expect(calls.hasStarted!.args).toEqual([]);
		expect(calls.isPaused!.args).toEqual([]);
		expect(calls.getPauseReason!.args).toEqual([]);
		expect(calls.isFinalized!.args).toEqual([]);
		expect(calls.getTimeState!.args).toEqual([]);

		// The pause carries the candidate-facing reason; a bare pause carries none.
		element.pause('Proctor check');
		expect(calls.pause!.args).toEqual(['Proctor check']);
		element.pause();
		expect(calls.pause!.args).toEqual([]);
		element.resume();
		expect(calls.resume!.args).toEqual([]);
	});
});

describe('before the shell mounts', () => {
	test('every method is safe: safe defaults, no throw', async () => {
		const element = createElement();
		expect(element.fakeShell).toBeNull();

		await expect(element.next()).resolves.toBeUndefined();
		await expect(element.previous()).resolves.toBeUndefined();
		await expect(element.navigateTo(0)).resolves.toBeUndefined();
		await expect(element.navigateToSection('section-1')).resolves.toBeUndefined();
		await expect(element.submit()).resolves.toBeUndefined();
		await expect(element.submit({ force: true })).resolves.toBeUndefined();
		// restoreState is a plain pass-through: without a shell there is no promise.
		expect(element.restoreState(sampleState)).toBeUndefined();
		await expect(element.start()).resolves.toBeUndefined();
		await expect(element.flushAutosave()).resolves.toBeUndefined();
		expect(element.getResponses()).toBeUndefined();
		expect(element.getState()).toBeUndefined();
		expect(element.hasStarted()).toBe(false);
		expect(element.isPaused()).toBe(false);
		expect(element.getPauseReason()).toBeUndefined();
		expect(element.isFinalized()).toBe(false);
		expect(element.getTimeState()).toBeUndefined();
		expect(() => element.pause('reason')).not.toThrow();
		expect(() => element.resume()).not.toThrow();
	});
});

describe('the façade matches the real shell', () => {
	const shellSourcePath = new URL('../src/components/AssessmentShell.svelte', import.meta.resolve('@pie-qti/assessment-player'));
	const shellSource = readFileSync(shellSourcePath, 'utf8');
	const elementSourcePath = new URL('../src/elements/QtiAssessmentPlayerElement.ts', import.meta.url);
	const elementSource = readFileSync(elementSourcePath, 'utf8');

	const shellExports = new Set(
		[...shellSource.matchAll(/export (?:async )?function (\w+)\(/g)].map((match) => match[1]!),
	);

	test('every façade method is an export of the real AssessmentShell', () => {
		for (const name of FACADE_METHODS) {
			expect(shellExports.has(name), `AssessmentShell no longer exports ${name}`).toBe(true);
		}
	});

	test('the shell exports exactly the façade plus what the element does not proxy', () => {
		// The one instance export the element deliberately does not proxy: the shell's
		// updateResponse (hosts drive responses through the rendered item instead).
		expect([...shellExports].sort()).toEqual([...FACADE_METHODS, 'updateResponse'].sort());
	});

	test('the element proxies exactly the façade methods and nothing else', () => {
		const proxied = new Set(
			[...elementSource.matchAll(/this\._instance\?\.(\w+)/g)].map((match) => match[1]!),
		);
		expect([...proxied].sort()).toEqual([...FACADE_METHODS].sort());
	});
});
