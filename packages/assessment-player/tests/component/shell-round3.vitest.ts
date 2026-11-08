/**
 * Round-3 shell fixes, against the real components in jsdom:
 * - a proctor pause closes every dialog inside the shell — the section layout's display
 *   settings dialog included — dispatches `pie-qti-close-transient-ui` for transient UI
 *   outside dialogs, and keeps the pause heading focused and announced;
 * - pause focus containment is scoped to the shell: the host page stays operable;
 * - status regions: the save indicator exists before its first message, "Submitting…"
 *   is outside any busy subtree, and the two announcer regions never clear each other;
 * - a paused session behind the begin gate says so on the start screen and holds Begin;
 * - `allowStartOver=false` removes the Start over path from the resume flow;
 * - the submit confirmation names the questions that still need an answer and holds
 *   Submit until they are answered.
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AccessibilityAnnouncer from '../../src/components/AccessibilityAnnouncer.svelte';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import NavigationBar from '../../src/components/NavigationBar.svelte';
import { AssessmentPlayer } from '../../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import { mountInto, press, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');
const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const ITEMS = { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2') };

const testXml = (options: { control?: string; submissionMode?: string } = {}) =>
	`<assessmentTest ${NS} identifier="round3" title="Round three">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="${options.submissionMode ?? 'simultaneous'}">
    ${options.control ?? ''}
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

async function until<T>(check: () => T | null | undefined | false, timeout = 8000): Promise<T> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const value = check();
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('condition not met within timeout');
}

async function backendFor(xml = testXml()): Promise<ReferenceBackendAdapter> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, { itemXmlMap: ITEMS });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return backend;
}

type ShellApi = {
	pause(reason?: string): void;
	resume(): void;
	submit(options?: { force?: boolean }): Promise<unknown>;
	updateResponse(responseId: string, value: unknown): void;
	navigateTo(index: number): Promise<void>;
	isPaused(): boolean;
	getPauseReason(): string | undefined;
	isFinalized(): boolean;
	getTimeState(): unknown;
	flushAutosave(): Promise<void>;
};

async function mountShell(props: Record<string, unknown> = {}, backend?: ReferenceBackendAdapter) {
	const b = backend ?? (await backendFor());
	const m = mountInto(AssessmentShell, {
		backend: b,
		initSession: { assessmentId: 'round3', candidateId: 'candidate' },
		config: { i18nProvider: i18n },
		...props,
	});
	mounted.push(m);
	return { m, backend: b, api: m.instance as unknown as ShellApi };
}

/** A stored, resumable session for `backend` (optionally paused), as a previous visit left it. */
async function storeSession(backend: ReferenceBackendAdapter, options: { pauseReason?: string } = {}): Promise<string> {
	const first = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: 'round3', candidateId: 'candidate' },
	});
	first.updateResponse('RESPONSE', 'A');
	if (options.pauseReason !== undefined) first.pause(options.pauseReason);
	await first.flushAutosave();
	const resumeId = backend.latestSessionId('round3', 'candidate');
	first.destroy();
	if (!resumeId) throw new Error('no stored session');
	return resumeId;
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
	vi.useRealTimers();
});

describe('a proctor pause closes every dialog inside the shell (I)', () => {
	test('the section display settings dialog closes; the event fires; the pause heading is focused and announced', { timeout: 20000 }, async () => {
		const { m, api } = await mountShell();
		const settingsButton = await until(() =>
			m.host.querySelector<HTMLButtonElement>('[data-testid="section-display-settings-button"]'),
		);
		settingsButton.click();
		await settle();
		const settingsDialog = () => m.host.querySelector<HTMLDialogElement>('[data-testid="section-display-settings-dialog"]');
		await until(() => settingsDialog()?.hasAttribute('open'));

		const transient: Array<{ reason?: string }> = [];
		const onTransient = (event: Event) => transient.push((event as CustomEvent<{ reason?: string }>).detail);
		document.addEventListener('pie-qti-close-transient-ui', onTransient);
		try {
			api.pause('Hold on');
			await settle();
			await settle();

			// No dialog survives above the pause card.
			expect(settingsDialog()?.hasAttribute('open')).toBe(false);
			expect(m.host.querySelector('dialog[open]')).toBeNull();
			// Transient UI outside dialogs is told to close.
			expect(transient).toEqual([{ reason: 'pause' }]);
			// The pause heading takes focus and the pause is announced assertively.
			const heading = await until(() => m.host.querySelector<HTMLElement>('.pause-title'));
			await until(() => document.activeElement === heading);
			const assertive = document.querySelector('[data-announcer="assertive"]');
			expect(assertive?.textContent).toContain('paused');
		} finally {
			document.removeEventListener('pie-qti-close-transient-ui', onTransient);
		}

		// The display settings dialog still opens again after the pause (its state synced).
		api.resume();
		await settle();
		await until(() => m.host.querySelector('[data-testid="assessment-pause-overlay"]') === null);
		m.host.querySelector<HTMLButtonElement>('[data-testid="section-display-settings-button"]')!.click();
		await settle();
		await until(() => settingsDialog()?.hasAttribute('open'));
	});
});

describe('pause focus containment is scoped to the shell (J)', () => {
	test('host controls outside the shell stay focusable and Tab is not swallowed', { timeout: 20000 }, async () => {
		const hostButton = document.createElement('button');
		hostButton.textContent = 'Proctor chat';
		document.body.appendChild(hostButton);
		try {
			const { m, api } = await mountShell();
			await until(() => m.host.querySelector('[data-testid="assessment-next"]'));
			api.pause();
			await settle();
			const heading = await until(() => m.host.querySelector<HTMLElement>('.pause-title'));
			await until(() => document.activeElement === heading);

			// Tab is not swallowed page-wide.
			const tab = press(heading, 'Tab');
			expect(tab.defaultPrevented).toBe(false);
			// The host page's own control keeps focus.
			hostButton.focus();
			await settle();
			expect(document.activeElement).toBe(hostButton);

			// Focus that lands on covered shell content returns to the overlay heading.
			const content = m.host.querySelector<HTMLElement>('.assessment-content')!;
			content.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
			expect(document.activeElement).toBe(heading);
		} finally {
			hostButton.remove();
		}
	});
});

describe('status regions (K)', () => {
	test('the two announcer regions never clear each other; each clears on its own timer', async () => {
		vi.useFakeTimers();
		const m = mountInto(AccessibilityAnnouncer, {});
		mounted.push(m);
		const announcer = m.instance as unknown as { announce(message: string, clearAfter?: number, priority?: 'polite' | 'assertive'): void };
		const region = (kind: string) => m.host.querySelector(`[data-announcer="${kind}"]`)?.textContent?.trim() ?? '';

		announcer.announce('The test was restarted from the beginning.', 4000, 'assertive');
		announcer.announce('Question 1 of 2', 1500, 'polite');
		await vi.advanceTimersByTimeAsync(0);
		expect(region('assertive')).toBe('The test was restarted from the beginning.');
		expect(region('polite')).toBe('Question 1 of 2');

		await vi.advanceTimersByTimeAsync(1600);
		expect(region('polite')).toBe('');
		expect(region('assertive')).toBe('The test was restarted from the beginning.');
		await vi.advanceTimersByTimeAsync(2500);
		expect(region('assertive')).toBe('');
	});

	test('the save indicator region exists before its first message (empty while idle)', () => {
		const navState = { currentIndex: 0, totalItems: 2, canNext: true, canPrevious: false, isLoading: false };
		const enabled = mountInto(NavigationBar, { navState, i18n, saveStatusEnabled: true, saveLabel: null });
		mounted.push(enabled);
		const region = enabled.host.querySelector('[data-testid="assessment-save-status"]');
		expect(region?.getAttribute('role')).toBe('status');
		expect(region?.getAttribute('aria-live')).toBe('polite');
		expect(region?.textContent?.trim()).toBe('');

		const disabled = mountInto(NavigationBar, { navState, i18n, saveStatusEnabled: false, saveLabel: null });
		mounted.push(disabled);
		expect(disabled.host.querySelector('[data-testid="assessment-save-status"]')).toBeNull();
	});

	test('"Submitting…" is announced from outside any aria-busy subtree', { timeout: 20000 }, async () => {
		const backend = await backendFor();
		let release: (() => void) | null = null;
		const finalize = backend.finalizeAssessment.bind(backend);
		backend.finalizeAssessment = async (request) => {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			return finalize(request);
		};
		const { m } = await mountShell({}, backend);
		await until(() => m.host.querySelector('[data-testid="assessment-next"]'));
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]')!.click();
		const submit = await until(() => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]'));
		submit.click();
		await settle();
		const confirm = await until(() =>
			m.host.querySelector<HTMLButtonElement>('dialog[open] [data-testid="assessment-dialog-confirm"]'),
		);
		confirm.click();

		const status = await until(() => m.host.querySelector<HTMLElement>('.assessment-submit-status'));
		expect(status.getAttribute('role')).toBe('status');
		expect(status.closest('[aria-busy="true"]')).toBeNull();
		// The question region is the busy one while the transition runs.
		expect(m.host.querySelector('.assessment-content')?.getAttribute('aria-busy')).toBe('true');
		await until(() => release !== null);
		release!();
		await until(() => m.host.querySelector('[data-testid="assessment-complete"]'));
	});
});

describe('a paused session behind the begin gate (M)', () => {
	test('the start screen shows the pause and holds Begin until the proctor resumes', { timeout: 20000 }, async () => {
		const backend = await backendFor();
		const resumeSessionId = await storeSession(backend, { pauseReason: 'Wait for the proctor' });
		const { m, api } = await mountShell({
			beginGate: true,
			initSession: { assessmentId: 'round3', candidateId: 'candidate', resumeSessionId },
		}, backend);

		const notice = await until(() => m.host.querySelector<HTMLElement>('[data-testid="assessment-start-paused"]'));
		expect(notice.getAttribute('role')).toBe('status');
		expect(notice.textContent).toContain('This test is paused');
		expect(notice.textContent).toContain('Wait for the proctor');
		const begin = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-begin"]')!;
		expect(begin.getAttribute('aria-disabled')).toBe('true');
		expect(begin.getAttribute('aria-describedby')).toBe(notice.id);
		expect(api.isPaused()).toBe(true);
		expect(api.getPauseReason()).toBe('Wait for the proctor');

		// Begin is held while paused.
		begin.click();
		await settle();
		expect(m.host.querySelector('[data-testid="assessment-start"]')).not.toBeNull();

		api.resume();
		await settle();
		await until(() => m.host.querySelector('[data-testid="assessment-start-paused"]') === null);
		expect(begin.getAttribute('aria-disabled')).toBeNull();
		begin.click();
		await until(() => m.host.querySelector('[data-testid="assessment-next"]'));
	});
});

describe('allowStartOver=false (D)', () => {
	test('a restored draft continues without a prompt; Start over is never offered', { timeout: 20000 }, async () => {
		const backend = await backendFor();
		const resumeSessionId = await storeSession(backend);
		const { m } = await mountShell({
			allowStartOver: false,
			initSession: { assessmentId: 'round3', candidateId: 'candidate', resumeSessionId },
		}, backend);

		await until(() => m.host.querySelector('[data-testid="assessment-next"]'));
		await settle();
		expect(m.host.querySelector('dialog[open]')).toBeNull();
		expect(m.host.querySelector('[data-testid="assessment-resume-start-over"]')).toBeNull();
		await until(() =>
			(document.querySelector('[data-announcer="polite"]')?.textContent ?? '').includes('saved answers were restored'),
		);
	});

	test('with the default, the prompt offers Start over', { timeout: 20000 }, async () => {
		const backend = await backendFor();
		const resumeSessionId = await storeSession(backend);
		const { m } = await mountShell({
			initSession: { assessmentId: 'round3', candidateId: 'candidate', resumeSessionId },
		}, backend);
		await until(() => m.host.querySelector('dialog[open] [data-testid="assessment-resume-start-over"]'));
	});
});

describe('the submit confirmation names questions that still need an answer (A)', () => {
	test('a skipping-required item is listed with a jump; Submit is held until it is answered', { timeout: 20000 }, async () => {
		const onSubmit = vi.fn();
		const backend = await backendFor(
			testXml({ submissionMode: 'individual', control: '<itemSessionControl allowSkipping="false"/>' }),
		);
		const { m, api } = await mountShell({ onSubmit }, backend);
		await until(() => m.host.querySelector('[data-testid="assessment-next"]'));

		// Jump to question 2 without answering question 1, answer 2, and open Submit.
		await api.navigateTo(1);
		api.updateResponse('RESPONSE', 'A');
		const submit = await until(() => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]'));
		submit.click();
		await settle();
		const dialog = await until(() => m.host.querySelector<HTMLDialogElement>('dialog[open]'));

		const heading = dialog.querySelector<HTMLElement>('[data-testid="submit-dialog-needs-answer"]');
		expect(heading?.textContent).toContain('1 question needs an answer before you can submit');
		expect(dialog.querySelector('[data-testid="submit-dialog-needs-answer-jump-1"]')).not.toBeNull();
		// Not repeated in the plain unanswered list.
		expect(dialog.querySelector('[data-testid="submit-dialog-jump-1"]')).toBeNull();
		const confirm = dialog.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!;
		expect(confirm.getAttribute('aria-disabled')).toBe('true');
		expect(confirm.getAttribute('aria-describedby')).toBe(heading?.id);
		confirm.click();
		await settle();
		expect(onSubmit).not.toHaveBeenCalled();
		expect(m.host.querySelector('dialog[open]')).not.toBeNull();

		// The jump leads to the question; once answered, Submit works.
		dialog.querySelector<HTMLButtonElement>('[data-testid="submit-dialog-needs-answer-jump-1"]')!.click();
		await until(() => m.host.querySelector('.progress-question')?.textContent?.includes('Question 1 of 2'));
		api.updateResponse('RESPONSE', 'B');
		await api.navigateTo(1);
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!.click();
		await settle();
		const ready = await until(() => m.host.querySelector<HTMLDialogElement>('dialog[open]'));
		expect(ready.querySelector('[data-testid="submit-dialog-needs-answer"]')).toBeNull();
		ready.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!.click();
		await until(() => onSubmit.mock.calls.length > 0);
	});

	test('a submit the gate refuses names the question in a warning, without "Try again"', { timeout: 20000 }, async () => {
		const backend = await backendFor(
			testXml({ submissionMode: 'individual', control: '<itemSessionControl allowSkipping="false"/>' }),
		);
		const { m, api } = await mountShell({}, backend);
		await until(() => m.host.querySelector('[data-testid="assessment-next"]'));
		api.updateResponse('RESPONSE', 'A');
		await api.navigateTo(1);
		api.updateResponse('RESPONSE', 'A');
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!.click();
		await settle();
		const dialog = await until(() => m.host.querySelector<HTMLDialogElement>('dialog[open]'));
		expect(dialog.querySelector('[data-testid="submit-dialog-needs-answer"]')).toBeNull();

		// The answer goes away behind the open confirmation (a host clears it): the end of
		// the test refuses, naming the question — a warning to act on, not a failure to retry.
		api.updateResponse('RESPONSE', null);
		dialog.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!.click();
		const warning = await until(() => m.host.querySelector<HTMLElement>('.assessment-nav-error [role="alert"]'));
		expect(warning.textContent).toContain('Some questions still need an answer before you can submit: 2.');
		expect(m.host.querySelector('.assessment-submit-error')).toBeNull();
	});
});

describe('proctor queries and force-submit through the shell (E)', () => {
	test('isPaused / getPauseReason / getTimeState / flushAutosave; submit({ force }) ends a paused test', { timeout: 20000 }, async () => {
		const { m, api } = await mountShell();
		await until(() => m.host.querySelector('[data-testid="assessment-next"]'));
		api.updateResponse('RESPONSE', 'A');
		await api.flushAutosave();
		expect(api.isPaused()).toBe(false);
		expect(api.getTimeState()).toMatchObject({ paused: false, started: true });

		api.pause('Proctor review');
		await settle();
		expect(api.isPaused()).toBe(true);
		expect(api.getPauseReason()).toBe('Proctor review');
		// A candidate submit is blocked; the proctor's forced submit ends the test.
		await expect(api.submit()).rejects.toMatchObject({ code: 'assessmentPaused' });
		await api.submit({ force: true });
		expect(api.isFinalized()).toBe(true);
		await until(() => m.host.querySelector('[data-testid="assessment-complete"]'));
		expect(m.host.querySelector('[data-testid="assessment-pause-overlay"]')).toBeNull();
	});
});
