/**
 * The `config.onError` reach policy for candidate-initiated failures (documented on
 * `BackendAssessmentPlayerConfig.onError`): a hard backend failure of an end of the
 * test (`submitFailed`, `finalizeFailed`) also reaches the host's `config.onError` hook
 * — once, with the typed error — while the shell's inline submit-failure alert stays up
 * for the candidate; a validation refusal (questions still needing an answer) stays
 * inline-only and never calls the hook.
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { isAssessmentPlayerError } from '../../src/core/errors.js';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');
const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const TEST_XML = `<assessmentTest ${NS} identifier="onerror-policy" title="OnError policy">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const NO_SKIPPING_XML = `<assessmentTest ${NS} identifier="onerror-gated" title="OnError gated">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous" itemSessionControl="allowSkipping=false">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const ITEMS = {
	'q1.xml': choiceItem('q1'),
	'q2.xml': choiceItem('q2'),
};

async function until(check: () => boolean | null | undefined, timeout = 8000): Promise<void> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (check()) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('condition not met within timeout');
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
	vi.restoreAllMocks();
});

async function mountShell(testXml: string, onError: ((error: Error) => void) | undefined) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: ITEMS });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		config: { i18nProvider: i18n, ...(onError ? { onError } : {}) },
	});
	mounted.push(m);
	await until(() => m.host.querySelector('[data-testid="assessment-submit"]') !== null);
	return m;
}

function ui(m: Mounted) {
	const openDialog = () => m.host.querySelector<HTMLDialogElement>('dialog[open]') ?? undefined;
	return {
		submit: () => m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!,
		dialogAction: (testid: string) => openDialog()?.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`),
		submitError: () => m.host.querySelector<HTMLElement>('.assessment-submit-error'),
		navError: () => m.host.querySelector<HTMLElement>('.assessment-nav-error'),
	};
}

describe('hard submission failures reach config.onError', () => {
	test('a submit the backend refuses calls onError once with the typed error and keeps the inline alert', { timeout: 20000 }, async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, { itemXmlMap: ITEMS });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		// The backend refuses every submission (what a full store or a 500 looks like).
		backend.submitResponses = async () => ({ success: false, error: 'storage full (fixture detail)' });

		const onError = vi.fn();
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			config: { i18nProvider: i18n, onError },
		});
		mounted.push(m);
		await until(() => m.host.querySelector('[data-testid="assessment-next"]') !== null);
		const u = ui(m);

		// The Submit control appears on the last item of the delivery.
		await (m.instance as unknown as { navigateTo: (index: number) => Promise<void> }).navigateTo(1);
		await settle();
		await until(() => u.submit() !== null);

		u.submit().click();
		await settle();
		u.dialogAction('assessment-dialog-confirm')!.click();
		await until(() => u.submitError() !== null);

		expect(onError).toHaveBeenCalledTimes(1);
		const reported = onError.mock.calls[0]?.[0];
		expect(isAssessmentPlayerError(reported)).toBe(true);
		expect((reported as { code: string }).code).toBe('submitFailed');
		// The raw backend text stays on the Error (logs/host), never in the candidate UI.
		expect((reported as Error).message).toContain('storage full');

		// The inline submit-failure alert is still up for the candidate, with Retry.
		expect(u.submitError()?.textContent).toBeTruthy();
		expect(u.submitError()?.textContent).not.toContain('storage full');
		expect(m.host.querySelector<HTMLButtonElement>('.retry-button')).not.toBeNull();
	});
});

describe('validation refusals stay inline-only', () => {
	test('a submit refused for unanswered questions never calls config.onError', { timeout: 20000 }, async () => {
		const onError = vi.fn();
		const m = await mountShell(NO_SKIPPING_XML, onError);
		const u = ui(m);

		// Nothing answered, allowSkipping=false: the end of the test is refused as a
		// warning naming the question — not a failure.
		u.submit().click();
		await settle();
		u.dialogAction('assessment-dialog-confirm')!.click();
		await settle();
		await settle();

		expect(onError).not.toHaveBeenCalled();
		expect(u.submitError()).toBeNull();
	});
});
