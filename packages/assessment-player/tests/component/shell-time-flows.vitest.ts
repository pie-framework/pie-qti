/**
 * The shell's time administration, against the real components and the reference
 * backend on short real-time limits: the begin gate's start screen, the whole-test
 * expiry with its automatic submission, the expiry dead end whose dialog carries the
 * Submit action, and the proctor pause overlay. (Axe coverage for the start screen and
 * expiry dialog lives in the demo's Playwright suite.)
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import { settle, mountInto, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) => `<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

async function backendFor(testXml: string, items: Record<string, string>): Promise<ReferenceBackendAdapter> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: items });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return backend;
}

function inertOf(el: Element | null): boolean {
	return el?.hasAttribute('inert') || (el as unknown as { inert?: boolean })?.inert === true;
}

async function until(check: () => boolean | null | undefined, timeout = 8000): Promise<void> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error('condition not met within timeout');
}

async function mountShell(
	testXml: string,
	items: Record<string, string>,
	props: Record<string, unknown> = {},
	onSubmit = vi.fn(),
) {
	const backend = await backendFor(testXml, items);
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId: 'timed', candidateId: 'candidate' },
		config: { i18nProvider: i18n },
		onSubmit,
		...props,
	});
	mounted.push(m);
	return { m, instance: m.instance as unknown as Record<string, (...args: unknown[]) => unknown>, onSubmit };
}

function shellOf(m: Mounted) {
	return {
		nav: () => m.host.querySelector<HTMLElement>('nav.navigation-bar'),
		next: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]')!,
		submit: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!,
		dialog: () => m.host.querySelector<HTMLDialogElement>('dialog[open]'),
		timer: () => m.host.querySelector<HTMLElement>('[data-testid="assessment-timer"]'),
		timerValue: () => m.host.querySelector<HTMLElement>('[data-testid="assessment-timer-value"]'),
		timerWarning: () => m.host.querySelector<HTMLElement>('[data-testid="assessment-timer-warning"]'),
		pauseOverlay: () => m.host.querySelector<HTMLElement>('[data-testid="assessment-pause-overlay"]'),
	};
}

const TIMED_TEST = `<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="timed" title="Timed maths">
  <timeLimits maxTime="600"/>
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const ITEMS = { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2') };

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

describe('begin gate', () => {
	test('the start screen names the test and the time; Begin enters the first question', { timeout: 15000 }, async () => {
		const { m, instance } = await mountShell(TIMED_TEST, ITEMS, { beginGate: true });
		const ui = shellOf(m);

		const start = () => m.host.querySelector('[data-testid="assessment-start"]');
		await until(() => start() !== null);
		expect(start()?.getAttribute('aria-labelledby')).toBeTruthy();
		expect(m.host.querySelector('.assessment-start-title')?.textContent).toBe('Timed maths');
		expect(m.host.querySelector('[data-testid="assessment-start-time"]')?.textContent).toBe('You have 10 minutes.');
		expect(m.host.querySelector('[data-testid="assessment-begin"]')).not.toBeNull();
		// No clocks and no question yet.
		expect(ui.nav()).toBeNull();
		expect(ui.timer()).toBeNull();

		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-begin"]')!.click();
		await until(() => ui.nav() !== null);
		expect(m.host.querySelector('.progress-question')?.textContent).toBe('Question 1 of 2');
		// The countdown now sits in the header, named programmatically.
		await until(() => ui.timer() !== null);
		expect(ui.timerValue()?.textContent).toMatch(/Time remaining: (9|10):/);
		// The begin gate never shows as a pause.
		expect(ui.pauseOverlay()).toBeNull();
		expect(instance.hasStarted()).toBe(true);
	});
});

describe('whole-test expiry', () => {
	test('warns at the threshold, then auto-submits and hands the results to the host', { timeout: 15000 }, async () => {
		const testXml = TIMED_TEST.replace('<timeLimits maxTime="600"/>', '<timeLimits maxTime="3"/>');
		const onSubmit = vi.fn();
		const { m } = await mountShell(testXml, ITEMS, { config: { i18nProvider: i18n, timeWarningThreshold: 2 } }, onSubmit);

		const ui = shellOf(m);

		await until(() => ui.nav() !== null);
		// The threshold announcement is the timer's separate polite region, not the readout.
		await until(() => (ui.timerWarning()?.textContent?.length ?? 0) > 0, 4000);
		expect(ui.timerWarning()?.getAttribute('aria-live')).toBe('polite');

		await until(() => onSubmit.mock.calls.length > 0, 8000);
		// The test ended from the expiry alone: the completion view replaces delivery
		// with its time-expired variant, and the results reached the host.
		await until(() => m.host.querySelector('[data-testid="assessment-complete"]') !== null);
		expect(ui.nav()).toBeNull();
		expect(m.host.querySelector('.complete-title')?.textContent).toContain('Time is up');
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ totalScore: 0 });
	});

	test('an expiry dead end offers Submit outside the last item and finalizes from there', { timeout: 15000 }, async () => {
		const testXml = `<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="timed" title="Dead end">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <timeLimits maxTime="2"/>
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
      <assessmentItemRef identifier="q3" href="q3.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const onSubmit = vi.fn();
		const { m, instance } = await mountShell(testXml, { ...ITEMS, 'q3.xml': choiceItem('q3') }, {}, onSubmit);
		const ui = shellOf(m);

		await until(() => ui.nav() !== null);
		// Answer so the dead-end submission carries a response.
		instance.updateResponse('RESPONSE', 'A');

		const dialog = () => ui.dialog();
		await until(() => dialog() !== null, 6000);
		expect(dialog()?.textContent).toContain('The time for this part is over');
		expect(dialog()?.textContent).toContain('Submit your test to finish.');

		// Submit is reachable although this is question 1 of 3 — it takes Next's place.
		expect(ui.submit()).not.toBeNull();
		expect(ui.next()).toBeNull();
		expect(ui.submit().disabled).toBe(false);

		// The dialog carries the Submit action and finalizes from question 1.
		dialog()?.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')?.click();
		await until(() => onSubmit.mock.calls.length > 0, 8000);
		// Completed: the dead-end Submit is gone with the test over.
		expect(ui.submit()).toBeNull();
	});
});

describe('proctor pause', () => {
	test('an overlay names the reason, blocks the shell, and resume continues the countdown', { timeout: 15000 }, async () => {
		const { m, instance } = await mountShell(TIMED_TEST, ITEMS);
		const ui = shellOf(m);
		await until(() => ui.nav() !== null);
		await until(() => ui.timer() !== null);

		const before = ui.timerValue()?.textContent?.match(/\d{1,2}:\d{2}(?::\d{2})?$/)?.[0];
		instance.pause('Proctor needs your attention');
		await settle();
		expect(ui.pauseOverlay()).not.toBeNull();
		expect(ui.pauseOverlay()?.textContent).toContain('Proctor needs your attention');
		// Header, content and navigation are inert while the pause holds.
		expect(inertOf(m.host.querySelector('header'))).toBe(true);
		expect(inertOf(m.host.querySelector('.assessment-content'))).toBe(true);
		expect(inertOf(ui.nav())).toBe(true);

		const timeOf = () => ui.timerValue()?.textContent?.match(/\d{1,2}:\d{2}(?::\d{2})?$/)?.[0];
		await new Promise((resolve) => setTimeout(resolve, 1300));
		expect(ui.timer()?.dataset.timerState).toBe('paused');
		// The reading is frozen (the pause label prefixes it).
		expect(timeOf()).toBe(before);

		instance.resume();
		await settle();
		expect(ui.pauseOverlay()).toBeNull();
		expect(inertOf(m.host.querySelector('.assessment-content'))).toBe(false);
		const afterResume = timeOf();
		// The seconds keep running after the pause lifts (poll: ceil can hold a reading).
		await until(() => timeOf() !== afterResume, 4000);
	});
});
