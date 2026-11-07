import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import { mountInto, press, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) => `<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

/** Two interactions: lets the flow test exercise a partially answered item. */
const compositeItem = `<assessmentItem ${NS} identifier="q3" title="Composite" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="RESPONSE2" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p>Composite question</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>
    <choiceInteraction responseIdentifier="RESPONSE2" maxChoices="1"><simpleChoice identifier="C">C</simpleChoice></choiceInteraction>
  </itemBody>
</assessmentItem>`;

async function backendFor(testXml: string, items: Record<string, string>): Promise<ReferenceBackendAdapter> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: items });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return backend;
}

/** The player boots asynchronously; poll until the shell shows the navigation bar. */
async function until<T>(check: () => T | null | undefined, timeout = 5000): Promise<T> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const value = check();
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error('condition not met within timeout');
}

function nav(m: Mounted) {
	const openDialog = () => m.host.querySelector<HTMLDialogElement>('dialog[open]') ?? undefined;
	return {
		prev: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-prev"]')!,
		next: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]')!,
		submit: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!,
		flag: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-flag"]')!,
		review: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-review"]')!,
		question: () => m.host.querySelector('.progress-question')?.textContent?.trim() ?? '',
		// Two dialogs live in the shell (submit confirmation, leave-part warning); the
		// open one is the only one worth querying, and action queries must run inside it.
		dialog: openDialog,
		dialogAction: (testid: string) =>
			openDialog()?.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`),
	};
}

async function mountShell(testXml: string, items: Record<string, string>, onSubmit = vi.fn()) {
	const backend = await backendFor(testXml, items);
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId: 'flow', candidateId: 'candidate' },
		config: { i18nProvider: i18n },
		onSubmit,
	});
	mounted.push(m);
	await until(() => m.host.querySelector('[data-testid="assessment-prev"], [data-testid="assessment-submit"]'));
	return { m, instance: m.instance as unknown as Record<string, (...args: unknown[]) => unknown>, onSubmit };
}

const NONLINEAR_TEST = `<assessmentTest ${NS} identifier="flow" title="Flow test">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
      <assessmentItemRef identifier="q3" href="q3.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const LINEAR_TWO_PARTS = `<assessmentTest ${NS} identifier="flow" title="Parts test">
  <testPart identifier="part-1" navigationMode="linear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Part One" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
  </testPart>
  <testPart identifier="part-2" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s2" title="Part Two" visible="true">
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

describe('submit confirmation', () => {
	test('lists unanswered questions with jumps, cancels safely, then confirms', async () => {
		const { m, instance, onSubmit } = await mountShell(NONLINEAR_TEST, {
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
			'q3.xml': compositeItem,
		});
		const ui = nav(m);
		expect(ui.question()).toBe('Question 1 of 3');

		instance.updateResponse('RESPONSE', 'A');
		instance.navigateTo(1);
		await settle();
		instance.updateResponse('RESPONSE', 'B');
		instance.navigateTo(2);
		await settle();

		// Submit opens the confirmation, not an immediate finalization.
		ui.submit().focus();
		ui.submit().click();
		await settle();
		const dialog = until(() => ui.dialog());
		expect((await dialog).textContent).toContain('Submit your test?');
		expect((await dialog).textContent).toContain('You cannot change your answers after you submit.');
		expect(m.host.querySelector('[data-testid="submit-dialog-summary"]')?.textContent).toContain('2 of 3 answered');
		expect((await dialog).textContent).toContain('1 question is not answered');
		expect(m.host.querySelector('[data-testid="submit-dialog-jump-3"]')?.textContent).toContain('Go to question 3');

		// Cancel: nothing submitted, focus returns to the trigger.
		ui.dialogAction('assessment-dialog-cancel')!.click();
		await settle();
		expect(ui.dialog()).toBeUndefined();
		expect(onSubmit).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(ui.submit());

		// Jump to the unanswered item straight from the dialog.
		ui.submit().click();
		await settle();
		m.host.querySelector<HTMLButtonElement>('[data-testid="submit-dialog-jump-3"]')!.click();
		await settle();
		expect(ui.dialog()).toBeUndefined();
		expect(ui.question()).toBe('Question 3 of 3');

		instance.updateResponse('RESPONSE', 'A');
		instance.updateResponse('RESPONSE2', 'C');

		ui.submit().click();
		await settle();
		expect(m.host.querySelector('[data-testid="submit-dialog-summary"]')?.textContent).toContain('3 of 3 answered');
		expect(ui.dialog()!.textContent).toContain('You have answered all the questions.');

		ui.dialogAction('assessment-dialog-confirm')!.click();
		await until(() => (onSubmit.mock.calls.length > 0 ? true : null));
		expect(ui.dialog()).toBeUndefined();
	});

	test('Escape cancels the dialog and keeps the test open', async () => {
		const { m, instance, onSubmit } = await mountShell(NONLINEAR_TEST, {
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
			'q3.xml': compositeItem,
		});
		const ui = nav(m);
		instance.navigateTo(2);
		await settle();
		ui.submit().focus();
		ui.submit().click();
		await settle();
		const dialog = ui.dialog()!;
		press(dialog, 'Escape');
		await settle();
		expect(ui.dialog()).toBeUndefined();
		expect(onSubmit).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(ui.submit());
	});

	test('a failed submission closes the dialog and moves focus to the retry control', async () => {
		class FailingBackend extends ReferenceBackendAdapter {
			override async finalizeAssessment(_request: Parameters<ReferenceBackendAdapter['finalizeAssessment']>[0]) {
				throw new Error('finalization is down');
			}
		}
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(NONLINEAR_TEST, {
			itemXmlMap: { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2'), 'q3.xml': compositeItem },
		});
		const backend = new FailingBackend();
		backend.registerAssessment(parsed.identifier, parsed);
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: 'flow', candidateId: 'candidate' },
			config: { i18nProvider: i18n },
		});
		mounted.push(m);
		await until(() => m.host.querySelector('[data-testid="assessment-prev"], [data-testid="assessment-submit"]'));
		const ui = nav(m);

		(m.instance as unknown as { navigateTo(i: number): Promise<void> }).navigateTo(2);
		await settle();
		ui.submit().click();
		await settle();
		ui.dialogAction('assessment-dialog-confirm')!.click();
		await until(() => m.host.querySelector('.assessment-submit-error'));

		expect(ui.dialog()).toBeUndefined();
		const alert = m.host.querySelector('.assessment-submit-error [role="alert"]')!;
		expect(alert.textContent).toContain('Your answers could not be submitted. Your answers are still here.');
		expect(alert.textContent).not.toContain('finalization is down');
		expect(document.activeElement).toBe(m.host.querySelector('.retry-button'));
	});
});

describe('review screen from the shell', () => {
	test('flag state shows in the palette, survives jumps and reflects per item', async () => {
		const { m } = await mountShell(NONLINEAR_TEST, {
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
			'q3.xml': compositeItem,
		});
		const ui = nav(m);

		// Flag the current item with a visible-label, aria-pressed toggle.
		ui.flag().click();
		await settle();
		expect(ui.flag().getAttribute('aria-pressed')).toBe('true');

		// Open the review palette; the flag and the current item are marked.
		ui.review().click();
		await settle();
		const screen = await until(() => m.host.querySelector('.review-screen'));
		expect(screen.textContent).toContain('Review your answers');
		expect(screen.textContent).toContain('Section A');
		expect(screen.querySelector('[aria-current="true"]')?.textContent).toContain('Go to question 1');
		expect(screen.textContent).toContain('Flagged');

		// Jump from the palette; the review closes and the flag is per item.
		Array.from(screen.querySelectorAll<HTMLButtonElement>('button.review-jump'))[1]!.click();
		await settle();
		expect(m.host.querySelector('.review-screen')).toBeNull();
		expect(ui.question()).toBe('Question 2 of 3');
		expect(ui.flag().getAttribute('aria-pressed')).toBe('false');

		// Back to question 1: its flag survives navigation.
		ui.review().click();
		await settle();
		const reopened = m.host.querySelector('.review-screen')!;
		Array.from(reopened.querySelectorAll<HTMLButtonElement>('button.review-jump'))[0]!.click();
		await settle();
		expect(ui.question()).toBe('Question 1 of 3');
		expect(ui.flag().getAttribute('aria-pressed')).toBe('true');
	});

	test('answered counts appear in the navigation bar', async () => {
		const { m, instance } = await mountShell(NONLINEAR_TEST, {
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
			'q3.xml': compositeItem,
		});
		expect(m.host.querySelector('[data-testid="assessment-answered-count"]')?.textContent).toContain('0 of 3 answered');
		instance.updateResponse('RESPONSE', 'A');
		await settle();
		expect(m.host.querySelector('[data-testid="assessment-answered-count"]')?.textContent).toContain('1 of 3 answered');
	});
});

describe('linear part warning', () => {
	test('leaving a test part warns "cannot return" before continuing', async () => {
		const { m } = await mountShell(LINEAR_TWO_PARTS, { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2') });
		const ui = nav(m);
		expect(ui.question()).toBe('Question 1 of 2');

		ui.next().click();
		await settle();
		const dialog = ui.dialog()!;
		expect(dialog.textContent).toContain('Leave this part?');
		expect(dialog.textContent).toContain('you cannot return to the questions in this part');

		// Staying put: no navigation happened.
		ui.dialogAction('assessment-dialog-cancel')!.click();
		await settle();
		expect(ui.dialog()).toBeUndefined();
		expect(ui.question()).toBe('Question 1 of 2');

		ui.next().click();
		await settle();
		ui.dialogAction('assessment-dialog-confirm')!.click();
		await settle();
		expect(ui.dialog()).toBeUndefined();
		expect(ui.question()).toBe('Question 2 of 2');
	});
});
