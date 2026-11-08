/**
 * Round-4 shell fixes, against the real components in jsdom:
 * - the "Leave this part?" warning names the part's questions that still owe an answer,
 *   with jumps, and holds Continue (QTI parts cannot be re-entered);
 * - the host hears every ending through `onSubmit` once — an EXIT_TEST branch and a
 *   proctor's force-submit included — and a proctor's ending has its own completion
 *   heading and announcement;
 * - the submit confirmation tells an incomplete answer apart from a missing one and says
 *   what it still owes ("Go to question 1: select at least 2");
 * - a force-submit behind the begin gate shows the completion screen, not a dead Begin;
 * - an expiry closes a stale submit confirmation; a scope notice is acknowledge-only and
 *   every close lands focus on the question delivery moved to (never on the body);
 * - "Review questions" in the submit confirmation does nothing while the submit runs;
 * - the pause heading follows the shell's heading outline.
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import type { AssessmentResults } from '../../src/types/index.js';
import { mountInto, press, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');
const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

/** Requires two of three choices: one selection is answered but incomplete. */
const pickTwoItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier"/>
  <itemBody><p>Pick two</p><choiceInteraction responseIdentifier="RESPONSE" minChoices="2" maxChoices="3"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice><simpleChoice identifier="C">C</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

async function until<T>(check: () => T | null | undefined | false, timeout = 8000): Promise<T> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const value = check();
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('condition not met within timeout');
}

type ShellApi = {
	submit(options?: { force?: boolean }): Promise<AssessmentResults | undefined>;
	updateResponse(responseId: string, value: unknown): void;
	navigateTo(index: number): Promise<void>;
	pause(reason?: string): void;
};

async function mountShell(
	testXml: string,
	items: Record<string, string>,
	props: Record<string, unknown> = {},
	adjust?: (backend: ReferenceBackendAdapter) => void,
) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: items });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	adjust?.(backend);
	const onSubmit = vi.fn();
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		config: { i18nProvider: i18n },
		onSubmit,
		...props,
	});
	mounted.push(m);
	return { m, api: m.instance as unknown as ShellApi, onSubmit };
}

function ui(m: Mounted) {
	const dialog = () => m.host.querySelector<HTMLDialogElement>('dialog[open]') ?? null;
	return {
		nav: () => m.host.querySelector<HTMLElement>('nav.navigation-bar'),
		next: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]'),
		submit: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]'),
		question: () => m.host.querySelector('.progress-question')?.textContent?.trim() ?? '',
		dialog,
		action: (testid: string) => dialog()?.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`) ?? null,
		complete: () => m.host.querySelector<HTMLElement>('[data-testid="assessment-complete"]'),
	};
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
	vi.useRealTimers();
});

const TWO_PARTS_REQUIRED = `<assessmentTest ${NS} identifier="leave-part" title="Two parts">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <itemSessionControl allowSkipping="false"/>
    <assessmentSection identifier="s1" title="Part one" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
  <testPart identifier="part-2" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s2" title="Part two" visible="true">
      <assessmentItemRef identifier="q3" href="q3.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const THREE_ITEMS = { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2'), 'q3.xml': choiceItem('q3') };

describe('leaving a test part with questions that owe an answer (1a)', () => {
	test('the warning names them with jumps and holds Continue until they are answered', { timeout: 20000 }, async () => {
		const { m, api } = await mountShell(TWO_PARTS_REQUIRED, THREE_ITEMS);
		const view = ui(m);
		await until(() => view.nav());
		// A nonlinear jump past question 1 (navigation is not submission).
		await api.navigateTo(1);
		api.updateResponse('RESPONSE', 'A');
		await settle();

		view.next()!.click();
		await settle();
		const dialog = await until(() => view.dialog());
		expect(dialog.textContent).toContain('Leave this part?');
		expect(dialog.querySelector('[data-testid="leave-part-needs-answer"]')?.textContent).toContain(
			'1 question in this part needs an answer before you can leave it',
		);
		const confirm = view.action('assessment-dialog-confirm')!;
		expect(confirm.getAttribute('aria-disabled')).toBe('true');
		expect(confirm.getAttribute('aria-describedby')).toBeTruthy();
		// Held: activating Continue leaves nothing.
		confirm.click();
		await settle();
		expect(view.dialog()).not.toBeNull();
		expect(view.question()).toBe('Question 2 of 3');

		// The named question is one jump away.
		view.action('leave-part-needs-answer-jump-1')!.click();
		await until(() => view.question() === 'Question 1 of 3');
		expect(view.dialog()).toBeNull();
		api.updateResponse('RESPONSE', 'B');
		await api.navigateTo(1);
		await settle();

		// Answered: the warning is the plain "cannot return" confirmation again.
		view.next()!.click();
		await settle();
		await until(() => view.dialog());
		expect(view.dialog()?.querySelector('[data-testid="leave-part-needs-answer"]')).toBeNull();
		expect(view.action('assessment-dialog-confirm')!.getAttribute('aria-disabled')).toBeNull();
		view.action('assessment-dialog-confirm')!.click();
		await until(() => view.question() === 'Question 3 of 3');
	});
});

describe('every ending reaches the host once (4) and the proctor ending is named (8)', () => {
	test('a QTI EXIT_TEST branch ends the test and calls onSubmit once', { timeout: 20000 }, async () => {
		const xml = `<assessmentTest ${NS} identifier="exit-test" title="Exit test">
  <testPart identifier="part" navigationMode="linear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Only" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"><branchRule target="EXIT_TEST"><baseValue baseType="boolean">true</baseValue></branchRule></assessmentItemRef>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const { m, api, onSubmit } = await mountShell(xml, THREE_ITEMS);
		const view = ui(m);
		await until(() => view.nav());
		api.updateResponse('RESPONSE', 'A');
		view.next()!.click();
		await until(() => view.complete());
		await until(() => onSubmit.mock.calls.length > 0);
		await settle();
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ endReason: 'branch' });
		expect(m.host.querySelector('.complete-title')?.textContent).toContain('You have finished the test.');
	});

	test('a proctor force-submit calls onSubmit once and says the proctor submitted the test', { timeout: 20000 }, async () => {
		const xml = `<assessmentTest ${NS} identifier="proctor" title="Proctor">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Only" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const { m, api, onSubmit } = await mountShell(xml, THREE_ITEMS);
		const view = ui(m);
		await until(() => view.nav());
		api.pause('Hold on');
		await settle();
		const results = await api.submit({ force: true });
		await until(() => view.complete());
		await settle();
		expect(results?.endReason).toBe('proctor');
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ endReason: 'proctor' });
		expect(m.host.querySelector('.complete-title')?.textContent).toContain('Your test was submitted by your proctor.');
		expect(document.querySelector('[data-announcer="assertive"]')?.textContent).toContain(
			'Your proctor has submitted your test.',
		);
	});

	test('a candidate submit still calls onSubmit exactly once', { timeout: 20000 }, async () => {
		const xml = `<assessmentTest ${NS} identifier="candidate" title="Candidate">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Only" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const { m, onSubmit } = await mountShell(xml, THREE_ITEMS);
		const view = ui(m);
		await until(() => view.submit());
		view.submit()!.click();
		await until(() => view.dialog());
		view.action('assessment-dialog-confirm')!.click();
		await until(() => view.complete());
		await settle();
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ endReason: 'candidate' });
	});
});

describe('the submit confirmation tells an incomplete answer apart (5)', () => {
	test('an invalid answer is listed as incomplete, with what it still owes', { timeout: 20000 }, async () => {
		const xml = `<assessmentTest ${NS} identifier="incomplete" title="Incomplete">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="individual">
    <itemSessionControl validateResponses="true"/>
    <assessmentSection identifier="s1" title="Only" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const { m, api } = await mountShell(xml, { 'q1.xml': pickTwoItem('q1'), 'q2.xml': choiceItem('q2') });
		const view = ui(m);
		await until(() => view.nav());
		api.updateResponse('RESPONSE', ['A']);
		await api.navigateTo(1);
		api.updateResponse('RESPONSE', 'A');
		await settle();

		view.submit()!.click();
		const dialog = await until(() => view.dialog());
		expect(dialog.querySelector('[data-testid="submit-dialog-needs-answer"]')).toBeNull();
		expect(dialog.querySelector('[data-testid="submit-dialog-incomplete"]')?.textContent).toContain(
			'1 answer is incomplete and must be completed before you can submit',
		);
		expect(view.action('submit-dialog-incomplete-jump-1')?.textContent?.trim()).toBe('Go to question 1: select at least 2');
		expect(view.action('assessment-dialog-confirm')!.getAttribute('aria-disabled')).toBe('true');
		expect(dialog.textContent).not.toContain('You have answered all the questions.');
	});
});

describe('a force-submit behind the begin gate (7)', () => {
	test('shows the completion screen, never a Begin that can do nothing', { timeout: 20000 }, async () => {
		const xml = `<assessmentTest ${NS} identifier="gated" title="Gated">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Only" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const { m, api } = await mountShell(xml, THREE_ITEMS, { beginGate: true });
		await until(() => m.host.querySelector('[data-testid="assessment-begin"]'));
		await api.submit({ force: true });
		await until(() => ui(m).complete());
		expect(m.host.querySelector('[data-testid="assessment-begin"]')).toBeNull();
		expect(m.host.querySelector('[data-testid="assessment-start"]')).toBeNull();
	});
});

describe('time expiry and the open dialogs (9, 13)', () => {
	const timedXml = `<assessmentTest ${NS} identifier="timed" title="Timed">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
    <assessmentSection identifier="s2" title="Section B" visible="true">
      <timeLimits maxTime="3"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

	async function expireSecondSection(options: { openSubmitDialog?: boolean } = {}) {
		let clock = 1_000;
		const mountedShell = await mountShell(timedXml, THREE_ITEMS, {
			config: { i18nProvider: i18n, now: () => clock },
		});
		const view = ui(mountedShell.m);
		await until(() => view.nav());
		await mountedShell.api.navigateTo(1);
		await settle();
		if (options.openSubmitDialog) {
			view.submit()!.click();
			await until(() => view.dialog()?.textContent?.includes('Submit your test?'));
		}
		clock += 4_000;
		// The scope notice opens once the timer's next tick sees the expiry.
		await until(() => view.dialog()?.textContent?.includes('The time for this section is over'), 6000);
		return { ...mountedShell, view };
	}

	test('an expiry closes the stale submit confirmation; the notice names where delivery went', { timeout: 20000 }, async () => {
		const { m, view } = await expireSecondSection({ openSubmitDialog: true });
		const open = m.host.querySelectorAll('dialog[open]');
		expect(open).toHaveLength(1);
		expect(view.dialog()?.textContent).not.toContain('Submit your test?');
		expect(view.dialog()?.textContent).toContain('You are moving on to question 1.');
		expect(view.question()).toBe('Question 1 of 2');
	});

	test('the scope notice is acknowledge-only; Escape lands focus on the question, not the body', { timeout: 20000 }, async () => {
		const { m, view } = await expireSecondSection();
		expect(view.action('assessment-dialog-cancel')).toBeNull();
		press(view.dialog()!, 'Escape');
		await until(() => view.dialog() === null);
		await until(() => document.activeElement !== document.body);
		const active = document.activeElement as HTMLElement;
		expect(m.host.querySelector('.assessment-content')?.contains(active)).toBe(true);
		await until(() => document.querySelector('[data-announcer="polite"]')?.textContent?.includes('Question 1 of 2'));
	});

	test('Continue lands focus on the question and announces it', { timeout: 20000 }, async () => {
		const { m, view } = await expireSecondSection();
		view.action('assessment-dialog-confirm')!.click();
		await until(() => view.dialog() === null);
		await until(() => document.activeElement !== document.body);
		expect(m.host.querySelector('.assessment-content')?.contains(document.activeElement)).toBe(true);
		await until(() => document.querySelector('[data-announcer="polite"]')?.textContent?.includes('Question 1 of 2'));
	});
});

describe('"Review questions" while the submit runs (15)', () => {
	test('does not close the confirmation or open the review under a submit in flight', { timeout: 20000 }, async () => {
		const xml = `<assessmentTest ${NS} identifier="held" title="Held">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Only" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { m } = await mountShell(xml, THREE_ITEMS, {}, (backend) => {
			const finalize = backend.finalizeAssessment.bind(backend);
			backend.finalizeAssessment = async (request) => {
				await held;
				return finalize(request);
			};
		});
		const view = ui(m);
		await until(() => view.submit());
		view.submit()!.click();
		await until(() => view.dialog());
		view.action('assessment-dialog-confirm')!.click();
		await until(() => view.action('submit-dialog-review')?.getAttribute('aria-disabled') === 'true');

		view.action('submit-dialog-review')!.click();
		await settle();
		expect(view.dialog()?.textContent).toContain('Submit your test?');
		expect(m.host.querySelector('[data-testid="assessment-review"]')?.getAttribute('aria-expanded')).not.toBe('true');

		release();
		await until(() => view.complete());
	});
});

describe('the pause heading follows the shell outline (16)', () => {
	test('one level below the assessment title', { timeout: 20000 }, async () => {
		const xml = `<assessmentTest ${NS} identifier="pause" title="Pause">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Only" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const { m, api } = await mountShell(xml, THREE_ITEMS, { headingLevel: 4 });
		await until(() => ui(m).nav());
		api.pause();
		const heading = await until(() => m.host.querySelector<HTMLElement>('.pause-title'));
		expect(heading.tagName).toBe('H5');
	});
});
