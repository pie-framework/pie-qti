/**
 * Restored shell states in jsdom:
 * - a snapshot saved during a proctor pause reopens paused: the overlay is visible
 *   without any `onPauseChange` (the shell syncs from the core at creation), the
 *   resume prompt stays suppressed while the pause holds and returns after it lifts,
 *   and the whole chrome is inert with the overlay operable outside it;
 * - an open dialog (submit confirmation) does not survive a pause;
 * - a session the backend stored as finalized renders the terminal
 *   "already submitted" view instead of delivery, and never offers a resume.
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { AssessmentPlayer } from '../../src/core/AssessmentPlayer.js';
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

const TEST_XML = `<assessmentTest ${NS} identifier="restored" title="Restored states">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const ITEMS = { 'q1.xml': choiceItem('q1'), 'q2.xml': choiceItem('q2') };

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

async function backendFor(): Promise<ReferenceBackendAdapter> {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, { itemXmlMap: ITEMS });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	return backend;
}

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

describe('restored proctor pause', () => {
	test('the overlay shows after reload without onPauseChange; the prompt returns after resume', { timeout: 20000 }, async () => {
		const backend = await backendFor();
		// Session one: answer, then pause — the snapshot carries the paused state.
		const first = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: 'restored', candidateId: 'candidate' },
		});
		first.updateResponse('RESPONSE', 'A');
		first.pause('Proctor needs your attention');
		await first.flushAutosave();
		const resumeId = backend.latestSessionId('restored', 'candidate');
		expect(resumeId).toBeTruthy();
		first.destroy();

		// Reload: the shell mounts against the resumed, still-paused session.
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: 'restored', candidateId: 'candidate', resumeSessionId: resumeId },
			config: { i18nProvider: i18n },
		});
		mounted.push(m);

		const overlay = () => m.host.querySelector<HTMLElement>('[data-testid="assessment-pause-overlay"]');
		await until(() => overlay() !== null);
		expect(overlay()!.textContent).toContain('Proctor needs your attention');
		// The pause is visible in the shell's state, not just the core's.
		expect(inertOf(m.host.querySelector('.shell-chrome'))).toBe(true);
		expect(inertOf(m.host.querySelector('.assessment-content'))).toBe(true);
		// The overlay sits outside the inert chrome wrapper and stays operable; the
		// heading (its focus target) is not inert.
		expect(inertOf(overlay()!.querySelector('.pause-title'))).toBe(false);
		// The resume prompt is suppressed while the pause holds.
		expect(m.host.querySelector('[data-testid="assessment-resume-continue"]')).toBeNull();

		// The proctor resumes: the overlay lifts, delivery unlocks, and the deferred
		// resume prompt returns (the draft was never answered).
		(m.instance as unknown as { resume(): void }).resume();
		await settle();
		await until(() => overlay() === null);
		expect(inertOf(m.host.querySelector('.shell-chrome'))).toBe(false);
		await until(() => m.host.querySelector('[data-testid="assessment-resume-continue"]') !== null);
	});
});

describe('a proctor pause closes open dialogs', () => {
	test('the submit confirmation closes under a pause and the chrome goes inert', { timeout: 20000 }, async () => {
		const backend = await backendFor();
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: 'restored', candidateId: 'candidate' },
			config: { i18nProvider: i18n },
		});
		mounted.push(m);

		await until(() => m.host.querySelector('[data-testid="assessment-next"]') !== null);
		// Move to the last item: only there does the bar offer Submit.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]')!.click();
		await until(() => m.host.querySelector('[data-testid="assessment-submit"]') !== null);
		// Open the submit confirmation.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!.click();
		await until(() => m.host.querySelector('dialog[open]') !== null);

		(m.instance as unknown as { pause(reason?: string): void }).pause('Hold on');
		await settle();

		// The dialog is gone, the overlay is up, and the chrome (which hosts any
		// surviving dialog) is hard-disabled beneath it.
		expect(m.host.querySelector('dialog[open]')).toBeNull();
		expect(m.host.querySelector('[data-testid="assessment-pause-overlay"]')).not.toBeNull();
		expect(inertOf(m.host.querySelector('.shell-chrome'))).toBe(true);
	});
});

describe('restored finalized session', () => {
	test('renders the already-submitted terminal view, never delivery or a resume prompt', { timeout: 20000 }, async () => {
		const backend = await backendFor();
		// Session one runs to the end.
		const first = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: 'restored', candidateId: 'candidate' },
		});
		await first.submit();
		const resumeId = backend.latestSessionId('restored', 'candidate');
		first.destroy();
		// latestSessionId skips finalized sessions; resume by the stored id directly.
		expect(resumeId).toBeNull();
		const storedIds: string[] = [];
		for (let index = 0; index < localStorage.length; index++) {
			const key = localStorage.key(index);
			if (key?.startsWith('qti_session_')) storedIds.push(key.slice('qti_session_'.length));
		}
		expect(storedIds).toHaveLength(1);

		const onSubmit = vi.fn();
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: 'restored', candidateId: 'candidate', resumeSessionId: storedIds[0] },
			config: { i18nProvider: i18n },
			onSubmit,
		});
		mounted.push(m);

		// The terminal completion view replaces delivery.
		await until(() => m.host.querySelector('[data-testid="assessment-complete"]') !== null);
		expect(m.host.querySelector('.complete-title')?.textContent).toContain('already submitted');
		// No delivery chrome and no resume prompt.
		expect(m.host.querySelector('[data-testid="assessment-next"]')).toBeNull();
		expect(m.host.querySelector('[data-testid="assessment-resume-continue"]')).toBeNull();

		// submit() returns the stored results instead of failing.
		const results = await (m.instance as unknown as { submit(): Promise<unknown> }).submit();
		expect(results).toMatchObject({ totalScore: 0, maxScore: 1, itemResults: [{ itemIdentifier: 'q1' }] });
	});
});
