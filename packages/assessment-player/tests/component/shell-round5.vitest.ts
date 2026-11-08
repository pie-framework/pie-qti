/**
 * Round-5 shell behaviour, against the real components in jsdom: an ending that collects a
 * delivery the time closed is an expiry ending, so the completion screen says time is up —
 * also when the whole-test auto-finalize failed and the candidate submitted from the expiry
 * dialog, and when a scope expiry left nothing open (the dead end's Submit).
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import { mountInto, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');
const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="Item ${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const ITEMS = { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2') };

async function until<T>(check: () => T | null | undefined | false, timeout = 8000): Promise<T> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const value = check();
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('condition not met within timeout');
}

async function mountShell(testXml: string, adjust?: (backend: ReferenceBackendAdapter) => void) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: ITEMS });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	adjust?.(backend);
	const onSubmit = vi.fn();
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		config: { i18nProvider: i18n },
		onSubmit,
	});
	mounted.push(m);
	return { m, onSubmit };
}

const dialogOf = (m: Mounted) => m.host.querySelector<HTMLDialogElement>('dialog[open]');
const confirmOf = (m: Mounted) =>
	dialogOf(m)?.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]') ?? null;
const completeTitle = (m: Mounted) => m.host.querySelector('.complete-title')?.textContent ?? '';

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

describe('an ending the time forced reads as one (4)', () => {
	test('a failed whole-test auto-finalize, then Submit from the expiry dialog: "Time is up"', { timeout: 20000 }, async () => {
		const testXml = `<assessmentTest ${NS} identifier="timed" title="Timed">
  <timeLimits maxTime="2"/>
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		let failOnce = true;
		const { m, onSubmit } = await mountShell(testXml, (backend) => {
			const finalize = backend.finalizeAssessment.bind(backend);
			backend.finalizeAssessment = async (request) => {
				if (failOnce) {
					failOnce = false;
					return { success: false, totalScore: 0, maxScore: 0, itemScores: {}, finalizedAt: Date.now() };
				}
				return finalize(request);
			};
		});

		// The automatic submission failed: the expiry dialog carries the Submit action.
		await until(() => dialogOf(m)?.textContent?.includes('Submit your test to finish.'), 8000);
		confirmOf(m)!.click();

		await until(() => m.host.querySelector('[data-testid="assessment-complete"]'));
		expect(completeTitle(m)).toContain('Time is up');
		await until(() => onSubmit.mock.calls.length > 0);
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ endReason: 'expiry' });
	});

	test('a scope expiry that left nothing open: the dead end\'s Submit reads "Time is up"', { timeout: 20000 }, async () => {
		const testXml = `<assessmentTest ${NS} identifier="dead-end" title="Dead end">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="individual">
    <timeLimits maxTime="2"/>
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
		const { m, onSubmit } = await mountShell(testXml);

		await until(() => dialogOf(m)?.textContent?.includes('The time for this part is over'), 8000);
		confirmOf(m)!.click();

		await until(() => m.host.querySelector('[data-testid="assessment-complete"]'));
		expect(completeTitle(m)).toContain('Time is up');
		await until(() => onSubmit.mock.calls.length > 0);
		expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ endReason: 'expiry' });
	});
});
