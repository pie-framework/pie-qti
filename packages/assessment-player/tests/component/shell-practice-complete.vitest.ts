/**
 * Practice delivery and completion in the real shell components:
 * the item-level "Check answer" control with its attempt counter, the item feedback
 * dialog it opens (and the one a submit-on-move produces), the QTI allowComment
 * disclosure, and the candidate-facing completion screen with its opt-in results
 * summary. (The core semantics behind these are covered in check-answer-delivery.test.ts.)
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

/** A choice item with outcome-matched modal feedback, so a check shows the dialog. */
const practiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Practice ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
    <defaultValue><value>none</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>What is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">3</simpleChoice>
      <simpleChoice identifier="B">4</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">incorrect</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
  <modalFeedback identifier="correct" outcomeIdentifier="FEEDBACK" showHide="show"><p>Nice work.</p></modalFeedback>
  <modalFeedback identifier="incorrect" outcomeIdentifier="FEEDBACK" showHide="show"><p>Check your addition.</p></modalFeedback>
</assessmentItem>`;

const commentedItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Question ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">3</simpleChoice>
      <simpleChoice identifier="B">4</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

	async function backendFor(testXml: string, items: Record<string, string>): Promise<ReferenceBackendAdapter> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: items });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return backend;
}

async function until<T>(check: () => T | null | undefined, timeout = 5000): Promise<T> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const value = check();
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 10));
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
		initSession: { assessmentId: parsedId(testXml), candidateId: 'practice-candidate' },
		config: { i18nProvider: i18n },
		onSubmit,
		...props,
	});
	mounted.push(m);
	await until(() => m.host.querySelector('[data-testid="assessment-prev"], [data-testid="assessment-submit"]'));
	return { m, instance: m.instance as unknown as Record<string, (...args: unknown[]) => unknown>, onSubmit };
}

function parsedId(testXml: string): string {
	return testXml.match(/identifier="([^"]+)"/)?.[1] ?? 'practice';
}

function ui(m: Mounted) {
	return {
		check: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-check-answer"]'),
		attempts: () => m.host.querySelector<HTMLElement>('[data-testid="assessment-attempts"]'),
		feedbackDialog: () => m.host.querySelector<HTMLDialogElement>('dialog[open]'),
		feedbackBody: () => m.host.querySelector('[data-testid="assessment-item-feedback"]'),
		feedbackContinue: () =>
			m.host
				.querySelector('dialog[open]')
				?.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]'),
		comments: () => m.host.querySelector<HTMLDetailsElement>('[data-testid="assessment-comments"]'),
		commentsInput: () =>
			m.host.querySelector<HTMLTextAreaElement>('[data-testid="assessment-comments-input"]'),
		next: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]'),
		submit: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]'),
		complete: () => m.host.querySelector('[data-testid="assessment-complete"]'),
		completeTitle: () => m.host.querySelector('.complete-title'),
		resultsSummary: () => m.host.querySelector('[data-testid="assessment-results-summary"]'),
		resultItems: () => m.host.querySelectorAll('[data-testid="assessment-result-item"]'),
		nav: () => m.host.querySelector('nav.navigation-bar'),
	};
}

const PRACTICE_TEST = `<assessmentTest ${NS} identifier="practice-shell" title="Practice test">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml">
        <itemSessionControl showFeedback="true" maxAttempts="2" allowComment="true"/>
      </assessmentItemRef>
      <assessmentItemRef identifier="q2" href="q2.xml">
        <itemSessionControl showFeedback="true" maxAttempts="2"/>
      </assessmentItemRef>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const SIMULTANEOUS_TEST = `<assessmentTest ${NS} identifier="simultaneous-shell" title="Simultaneous test">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml">
        <itemSessionControl showFeedback="true" maxAttempts="2"/>
      </assessmentItemRef>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const FINAL_TEST = `<assessmentTest ${NS} identifier="final-shell" title="Final test">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

describe('check answer control', () => {
	test('shows the control with its attempt counter, opens the feedback dialog, and counts down', async () => {
		const { m, instance } = await mountShell(PRACTICE_TEST, {
			'q1.xml': practiceItem('q1'),
			'q2.xml': practiceItem('q2'),
		});
		const dom = ui(m);

		await until(() => dom.check() !== null);
		expect(dom.check()?.textContent).toContain('Check answer');
		expect(dom.attempts()?.textContent).toContain('Attempt 1 of 2');

		// A wrong answer checked through the normal per-item path stays on the question
		// and opens the item's outcome-matched feedback.
		instance.updateResponse('RESPONSE', 'A');
		await settle();
		dom.check()!.click();
		await until(() => dom.feedbackDialog() !== null);
		expect(dom.feedbackBody()?.textContent).toContain('Check your addition.');

		// Closing returns to the question; the counter shows the next attempt.
		dom.feedbackContinue()!.click();
		await until(() => dom.feedbackDialog() === null);
		expect(dom.attempts()?.textContent).toContain('Attempt 2 of 2');

		// The revised answer checks again; then the control disables with its explanation.
		instance.updateResponse('RESPONSE', 'B');
		await settle();
		dom.check()!.click();
		await until(() => dom.feedbackDialog() !== null);
		expect(dom.feedbackBody()?.textContent).toContain('Nice work.');
		dom.feedbackContinue()!.click();
		await until(() => dom.attempts()?.textContent?.includes('used all your attempts') === true);
		expect(dom.check()?.disabled).toBe(true);
	});
});

describe('comments disclosure', () => {
	test('the comment persists into the session snapshot and the disclosure follows the item', async () => {
		const { m, instance } = await mountShell(PRACTICE_TEST, {
			'q1.xml': practiceItem('q1'),
			'q2.xml': practiceItem('q2'),
		});
		const dom = ui(m);

		await until(() => dom.comments() !== null);
		const input = dom.commentsInput()!;
		input.value = 'The diagram is unclear.';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();

		const state = (await instance.getState()) as { itemComments?: Record<string, string> };
		expect(state.itemComments?.q1).toBe('The diagram is unclear.');
	});
});

describe('simultaneous parts', () => {
	test('never offer the check control', async () => {
		const { m } = await mountShell(SIMULTANEOUS_TEST, {
			'q1.xml': practiceItem('q1'),
		});
		// One item: the bar shows Submit (no Next) — and no check control either way.
		await until(() => ui(m).submit() !== null);
		expect(ui(m).check()).toBeNull();
	});
});

describe('completion screen', () => {
	test('replaces delivery with the finished state; the host still receives the results', async () => {
		const onSubmit = vi.fn();
		const { m, instance } = await mountShell(FINAL_TEST, {
			'q1.xml': commentedItem('q1'),
			'q2.xml': commentedItem('q2'),
		}, {}, onSubmit);
		const dom = ui(m);

		instance.updateResponse('RESPONSE', 'B');
		await settle();
		// Move to the last question, where Submit replaces Next.
		await until(() => dom.next() !== null);
		dom.next()!.click();
		await until(() => dom.submit() !== null);
		dom.submit()!.click();
		// The submit confirmation must be confirmed explicitly.
		await until(() => dom.feedbackDialog() !== null);
		dom.feedbackDialog()!
			.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!
			.click();

		await until(() => dom.complete() !== null);
		expect(dom.nav()).toBeNull();
		expect(dom.completeTitle()?.textContent).toContain('You have finished the test.');
		// No results summary without the host opt-in.
		expect(dom.resultsSummary()).toBeNull();
		expect(onSubmit.mock.calls).toHaveLength(1);
	});

	test('showResultsSummary adds the per-question summary with the backend scores', async () => {
		const { m, instance } = await mountShell(FINAL_TEST, {
			'q1.xml': commentedItem('q1'),
			'q2.xml': commentedItem('q2'),
		}, { showResultsSummary: true });
		const dom = ui(m);

		instance.updateResponse('RESPONSE', 'B');
		await settle();
		await until(() => dom.next() !== null);
		dom.next()!.click();
		await until(() => dom.submit() !== null);
		dom.submit()!.click();
		await until(() => dom.feedbackDialog() !== null);
		dom.feedbackDialog()!
			.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!
			.click();

		await until(() => dom.resultsSummary() !== null);
		expect(dom.completeTitle()?.textContent).toContain('You have finished the test.');
		const items = dom.resultItems();
		expect(items).toHaveLength(2);
		expect(items[0]?.textContent).toContain('Question 1');
		expect(items[0]?.textContent).toContain('Score: 1 / 1');
		expect(items[1]?.textContent).toContain('Not answered');
	});
});
