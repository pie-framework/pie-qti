/**
 * Shell dialog and focus behaviour, pinned before the Phase 5 shell split moves
 * the dialogs into child components and `initialize()` into a composable:
 * - the delivery landmarks (shell region, question-content region, navigation)
 *   and the skip link that focuses the question in place;
 * - focus entering each dialog on open and returning to its trigger on close
 *   (submit confirmation, the check-answer feedback dialog);
 * - the proctor pause's focus round trip (overlay heading takes focus, resume
 *   returns it to the element focused before the pause);
 * - the resume prompt ↔ start-over confirmation dialog hand-off.
 *
 * The open/close triggers themselves are pinned in shell-review-submit,
 * shell-round4/5, shell-autosave, shell-time-flows and shell-practice-complete;
 * these tests cover the focus and landmark contract those leave open.
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
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

const textEntryItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Question ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody><p>Question ${identifier}</p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="12"/></itemBody>
</assessmentItem>`;

const NONLINEAR_TEST = `<assessmentTest ${NS} identifier="focus-flow" title="Focus flow test">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const PRACTICE_TEST = `<assessmentTest ${NS} identifier="practice-focus" title="Practice focus test">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml">
        <itemSessionControl showFeedback="true" maxAttempts="2"/>
      </assessmentItemRef>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const RESUME_TEST = `<assessmentTest ${NS} identifier="resume-focus" title="Resume focus test">
  <timeLimits maxTime="600"/>
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

async function until<T>(check: () => T | null | undefined, timeout = 8000): Promise<T> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const value = check();
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('condition not met within timeout');
}

async function backendFor(testXml: string, items: Record<string, string>): Promise<ReferenceBackendAdapter> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: items });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return backend;
}

async function mountShell(
	assessmentId: string,
	testXml: string,
	items: Record<string, string>,
	props: Record<string, unknown> = {},
) {
	const backend = await backendFor(testXml, items);
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId, candidateId: 'candidate' },
		config: { i18nProvider: i18n },
		...props,
	});
	mounted.push(m);
	return m;
}

/** The player boots asynchronously; poll until the shell shows the navigation bar. */
async function waitDelivery(m: Mounted) {
	await until(() => m.host.querySelector('[data-testid="assessment-prev"], [data-testid="assessment-submit"]'));
}

type ShellApi = {
	updateResponse(responseId: string, value: unknown): void;
	navigateTo(index: number): Promise<void>;
	pause(reason?: string): void;
	resume(): void;
	checkCurrentItem(): Promise<void>;
};

function apiOf(m: Mounted) {
	return m.instance as unknown as ShellApi;
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

describe('delivery landmarks and the skip link', () => {
	test('the shell is a titled region with labelled content and navigation; the skip link focuses the question in place', { timeout: 15000 }, async () => {
		const m = await mountShell('focus-flow', NONLINEAR_TEST, {
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
		});
		await waitDelivery(m);

		// Embedded: the shell is a section region named by the assessment title.
		const shell = m.host.querySelector<HTMLElement>('section.assessment-shell')!;
		expect(shell.getAttribute('aria-labelledby')).toBeTruthy();
		const title = document.getElementById(shell.getAttribute('aria-labelledby')!)!;
		expect(title.textContent).toBe('Focus flow test');

		// The content region is labelled, the navigation landmark is named.
		const content = m.host.querySelector<HTMLElement>('.assessment-content')!;
		expect(content.getAttribute('role')).toBe('region');
		expect(content.getAttribute('aria-label')).toBe('Question content');
		expect(m.host.querySelector('nav.navigation-bar')?.getAttribute('aria-label')).toBe('Assessment navigation');

		// The skip link leads to the content region's id.
		const skip = m.host.querySelector<HTMLAnchorElement>('a.skip-link')!;
		expect(skip.textContent).toContain('Skip to question');
		expect(skip.getAttribute('href')).toBe(`#${content.id}`);
		expect(content.id.endsWith('-content')).toBe(true);

		// Activation focuses the question in place: no URL change, focus inside the content.
		skip.focus();
		skip.click();
		await until(() => {
			const active = document.activeElement;
			return active instanceof HTMLElement && (active === content || content.contains(active)) ? active : null;
		});
		expect(window.location.hash).toBe('');
	});
});

describe('submit confirmation focus', () => {
	test('the dialog takes focus on open and Escape returns it to the Submit trigger', { timeout: 15000 }, async () => {
		const m = await mountShell('focus-flow', NONLINEAR_TEST, {
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
		});
		await waitDelivery(m);
		const submit = () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!;

		// Submit is offered on the last item, where Next ends.
		await apiOf(m).navigateTo(1);
		await until(() => submit());
		submit().focus();
		submit().click();
		const dialog = await until(() => m.host.querySelector<HTMLDialogElement>('dialog[open]'));
		expect(dialog.textContent).toContain('Submit your test?');

		// Focus moved into the dialog (its title, the accessible name).
		const active = document.activeElement as HTMLElement | null;
		expect(dialog.contains(active)).toBe(true);
		expect(active?.id).toBe(dialog.getAttribute('aria-labelledby'));

		press(dialog, 'Escape');
		await settle();
		expect(m.host.querySelector('dialog[open]')).toBeNull();
		await until(() => document.activeElement === submit());
	});
});

describe('proctor pause focus round trip', () => {
	test('the overlay heading takes focus; resume returns focus to the element focused before the pause', { timeout: 15000 }, async () => {
		const m = await mountShell('focus-flow', NONLINEAR_TEST, {
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
		});
		await waitDelivery(m);
		const next = () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]')!;
		const overlay = () => m.host.querySelector<HTMLElement>('[data-testid="assessment-pause-overlay"]');

		next().focus();
		apiOf(m).pause('Hold on');
		const heading = await until(() => {
			const active = document.activeElement as HTMLElement | null;
			return active?.classList.contains('pause-title') ? active : null;
		});
		expect(overlay()?.contains(heading)).toBe(true);

		apiOf(m).resume();
		await until(() => overlay() === null);
		await until(() => document.activeElement === next());
	});
});

describe('item feedback dialog focus', () => {
	test('the dialog names itself "Feedback"; Escape closes it and focus returns to the check control', { timeout: 15000 }, async () => {
		const m = await mountShell('practice-focus', PRACTICE_TEST, { 'q1.xml': practiceItem('q1') });
		await waitDelivery(m);
		const check = () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-check-answer"]')!;
		const dialog = () => m.host.querySelector<HTMLDialogElement>('dialog[open]');

		await until(() => check());
		apiOf(m).updateResponse('RESPONSE', 'A');
		await settle();
		check().focus();
		check().click();
		await until(() => dialog() !== null);
		expect(dialog()!.querySelector('.assessment-dialog-title')?.textContent).toBe('Feedback');
		expect(m.host.querySelector('[data-testid="assessment-item-feedback"]')?.textContent).toContain(
			'Check your addition.',
		);

		press(dialog()!, 'Escape');
		await settle();
		expect(dialog()).toBeNull();
		await until(() => document.activeElement === check());
	});
});

describe('resume prompt and start-over hand-off', () => {
	test("Start over's cancel returns to the resume prompt, keeping the saved draft", { timeout: 20000 }, async () => {
		// First session: answer, then persist.
		const first = await mountShell(
			'resume-focus',
			RESUME_TEST,
			{ 'q1.xml': textEntryItem('q1'), 'q2.xml': choiceItem('q2') },
			{ autosaveIntervalMs: 30 },
		);
		await waitDelivery(first);
		apiOf(first).updateResponse('RESPONSE', 'water');
		// Wait until the stored snapshot actually carries the answer.
		const sessionId = await until(() => {
			for (let index = 0; index < localStorage.length; index++) {
				const key = localStorage.key(index);
				if (!key?.startsWith('qti_session_')) continue;
				if ((localStorage.getItem(key) ?? '').includes('water')) {
					return key.slice('qti_session_'.length);
				}
			}
			return undefined;
		}, 8000);
		first.destroy();
		mounted.splice(mounted.indexOf(first), 1);
		expect(sessionId).toBeTruthy();

		// Second session over the stored draft: the resume prompt opens.
		const backend = await backendFor(RESUME_TEST, {
			'q1.xml': textEntryItem('q1'),
			'q2.xml': choiceItem('q2'),
		});
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: 'resume-focus', candidateId: 'candidate', resumeSessionId: sessionId! },
			config: { i18nProvider: i18n },
			autosaveIntervalMs: 30,
		});
		mounted.push(m);

		const dialog = () => m.host.querySelector<HTMLDialogElement>('dialog[open]');
		const dialogTitle = () => dialog()?.querySelector('.assessment-dialog-title')?.textContent ?? null;
		await until(() => dialogTitle() === 'Resume your test?');

		// Start over opens the irreversible-deletion confirmation.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-resume-start-over"]')!.click();
		await until(() => dialogTitle() === 'Start over and delete your saved answers?');

		// Cancel: back to the resume prompt — the draft was never touched.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-cancel"]')!.click();
		await until(() => dialogTitle() === 'Resume your test?');
		expect(document.activeElement instanceof HTMLElement && dialog()!.contains(document.activeElement)).toBe(true);

		// Resume keeps the restored draft.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-resume-continue"]')!.click();
		await until(() => dialog() === null);
		const input = m.host.querySelector<HTMLInputElement>('input[type="text"], input:not([type])');
		await until(() => (input?.value ?? '') === 'water', 8000);
	});
});
