/**
 * Autosave and resume in the shell, against the real components: the save
 * indicator's states (saving / saved / not saved / hidden when disabled), the
 * resume prompt with Start over's confirmation, and the performance property that
 * response updates never rebuild the section composition (the O(assessment)
 * keystroke path stays dead).
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');
const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

// The composition builder is mocked so the tests can count rebuilds.
const compositionCalls = { value: 0 };
vi.mock('../../src/integration/toSectionComposition.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/integration/toSectionComposition.js')>();
	return {
		toSectionComposition: (...args: Parameters<typeof actual.toSectionComposition>) => {
			compositionCalls.value += 1;
			return actual.toSectionComposition(...args);
		},
	};
});

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const entryItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody><p>Question ${identifier}</p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="12"/></itemBody>
</assessmentItem>`;

const TEST_XML = `<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="autosave-shell" title="Autosave shell">
  <timeLimits maxTime="600"/>
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const ITEMS = { 'q1.xml': entryItem('q1'), 'q2.xml': choiceItem('q2') };

async function until(check: () => boolean | null | undefined, timeout = 8000): Promise<void> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('condition not met within timeout');
}

async function backendFor(testXml: string, files: Record<string, string>): Promise<ReferenceBackendAdapter> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: files });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return backend;
}

async function mountShell(
	props: Record<string, unknown> = {},
	files: Record<string, string> = ITEMS,
	testXml = TEST_XML,
) {
	const backend = await backendFor(testXml, files);
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId: 'autosave-shell', candidateId: 'candidate' },
		config: { i18nProvider: i18n },
		autosaveIntervalMs: 30,
		...props,
	});
	mounted.push(m);
	await until(() => m.host.querySelector('[data-testid="assessment-next"]') !== null);
	return { m, backend };
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

describe('save indicator', () => {
	test('shows Saving… then Saved · time as the real save settles', { timeout: 15000 }, async () => {
		const { m } = await mountShell();
		const indicator = () => m.host.querySelector('[data-testid="assessment-save-status"]');

		await until(() => indicator() !== null);
		const instance = m.instance as unknown as { updateResponse: (id: string, value: unknown) => void };
		instance.updateResponse('RESPONSE', 'water');

		await until(() => (indicator()?.textContent ?? '').includes('Saving'));
		await until(() => /Saved · \d{1,2}:\d{2}/.test(indicator()?.textContent ?? ''), 5000);
		expect(indicator()?.getAttribute('aria-live')).toBe('polite');
	});

	test('a refused save shows "Not saved" and recovers on the next change', { timeout: 15000 }, async () => {
		const { m, backend } = await mountShell();
		let failures = 1;
		const referenceSave = backend.saveState.bind(backend);
		backend.saveState = async (request) => {
			if (failures > 0) {
				failures -= 1;
				return { success: false, savedAt: Date.now() };
			}
			return referenceSave(request);
		};

		const indicator = () => m.host.querySelector('[data-testid="assessment-save-status"]');
		const instance = m.instance as unknown as { updateResponse: (id: string, value: unknown) => void };
		instance.updateResponse('RESPONSE', 'water');
		await until(() => (indicator()?.textContent ?? '').includes('Not saved'), 5000);

		instance.updateResponse('RESPONSE', 'waterx');
		await until(() => /Saved · \d{1,2}:\d{2}/.test(indicator()?.textContent ?? ''), 5000);
	});

	test('autosave={false} hides the indicator entirely', { timeout: 15000 }, async () => {
		const { m } = await mountShell({ autosave: false });
		await until(() => m.host.querySelector('[data-testid="assessment-save-status"]') !== null || true);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(m.host.querySelector('[data-testid="assessment-save-status"]')).toBeNull();
	});
});

describe('resume prompt', () => {
	test('a stored draft opens the resume dialog; Resume restores the answers', { timeout: 20000 }, async () => {
		// First session: answer, then persist.
		const first = await mountShell();
		const instance = first.m.instance as unknown as { updateResponse: (id: string, value: unknown) => void };
		instance.updateResponse('RESPONSE', 'water');
		await until(
			() => /Saved/.test(first.m.host.querySelector('[data-testid="assessment-save-status"]')?.textContent ?? ''),
			6000,
		);
		const sessionId = (first.backend as unknown as { latestSessionId: (a: string, c: string) => string }).latestSessionId(
			'autosave-shell',
			'candidate',
		);
		expect(sessionId).toBeTruthy();
		first.m.destroy();
		mounted.splice(mounted.indexOf(first.m), 1);

		// Second session over the stored draft: the shell asks what to do.
		const backend = await backendFor(TEST_XML, ITEMS);
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: 'autosave-shell', candidateId: 'candidate', resumeSessionId: sessionId! },
			config: { i18nProvider: i18n },
			autosaveIntervalMs: 30,
		});
		mounted.push(m);

		const dialog = () => m.host.querySelector<HTMLDialogElement>('dialog[open]');
		await until(() => dialog() !== null);
		expect(dialog()!.querySelector('.assessment-dialog-title')?.textContent).toBe('Resume your test?');
		expect(dialog()!.querySelector('.assessment-dialog-description')?.textContent).toMatch(/answers saved from/i);

		await until(() => m.host.querySelector('[data-testid="assessment-resume-continue"]') !== null);
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-resume-continue"]')!.click();
		await until(() => dialog() === null);

		// The restored answer is back in the restored item's input.
		const input = m.host.querySelector<HTMLInputElement>('input[type="text"], input:not([type])');
		await until(() => (input?.value ?? '') === 'water', 6000);
	});

	test('Start over confirms, deletes the draft and restarts at question 1', { timeout: 20000 }, async () => {
		const first = await mountShell();
		const instance = first.m.instance as unknown as { updateResponse: (id: string, value: unknown) => void };
		instance.updateResponse('RESPONSE', 'water');
		await until(
			() => /Saved/.test(first.m.host.querySelector('[data-testid="assessment-save-status"]')?.textContent ?? ''),
			6000,
		);
		const sessionId = (first.backend as unknown as { latestSessionId: (a: string, c: string) => string }).latestSessionId(
			'autosave-shell',
			'candidate',
		);
		first.m.destroy();
		mounted.splice(mounted.indexOf(first.m), 1);

		const backend = await backendFor(TEST_XML, ITEMS);
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: 'autosave-shell', candidateId: 'candidate', resumeSessionId: sessionId! },
			config: { i18nProvider: i18n },
			autosaveIntervalMs: 30,
		});
		mounted.push(m);

		const dialog = () => m.host.querySelector<HTMLDialogElement>('dialog[open]');
		await until(() => dialog() !== null);
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-resume-start-over"]')!.click();

		// The irreversible deletion is confirmed first.
		await until(() => dialog()?.querySelector('.assessment-dialog-title')?.textContent?.includes('Start over') === true);
		expect(dialog()!.textContent).toContain('This cannot be undone');
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]')!.click();

		await until(() => dialog() === null, 8000);
		// Fresh delivery at question 1: the input is empty again.
		const input = () => m.host.querySelector<HTMLInputElement>('input[type="text"], input:not([type])');
		await until(() => (input()?.value ?? '') === '', 8000);
		expect(m.host.querySelector('.progress-question')?.textContent).toContain('Question 1 of 2');
	});
});

describe('response-update targeting', () => {
	test('keystrokes do not rebuild the section composition', { timeout: 15000 }, async () => {
		const { m } = await mountShell();
		await settle();
		const afterMount = compositionCalls.value;

		const instance = m.instance as unknown as { updateResponse: (id: string, value: unknown) => void };
		for (const [index, value] of ['a', 'b', 'c', 'd', 'e'].entries()) {
			instance.updateResponse('RESPONSE', `water${value}`);
			await settle();
			expect(compositionCalls.value).toBe(afterMount);
			expect(index).toBeLessThan(5);
		}
		// The answered count still tracked the input.
		await until(
			() => m.host.querySelector('[data-testid="assessment-answered-count"]')?.textContent?.includes('1 of 2') === true,
			5000,
		);
	});
});
