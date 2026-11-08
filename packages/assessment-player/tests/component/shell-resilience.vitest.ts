/**
 * Shell resilience in jsdom: a failed load renders the candidate-safe coded error
 * with Retry (never raw backend text) and recovers, and a crashing question
 * renderer is contained by the content boundary's plain-language fallback while
 * navigation keeps working.
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test } from 'vitest';
import type { InitSessionRequest, InitSessionResponse } from '../../src/integration/api-contract.js';
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

const TEST_XML = `<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="resilience" title="Resilience">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
      <assessmentItemRef identifier="q3" href="q3.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const ITEMS = {
	'q1.xml': choiceItem('q1'),
	'q2.xml': choiceItem('q2'),
	'q3.xml': choiceItem('q3'),
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
});

describe('load failure', () => {
	test('shows the localized error with Retry, never the raw message, and Retry recovers', { timeout: 20000 }, async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, { itemXmlMap: ITEMS });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		let initCalls = 0;
		const referenceInit = backend.initSession.bind(backend);
		backend.initSession = async (request: InitSessionRequest): Promise<InitSessionResponse> => {
			initCalls += 1;
			if (initCalls === 1) throw new Error('Backend unavailable: connection refused by fixture (developer text)');
			return referenceInit(request);
		};

		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			config: { i18nProvider: i18n },
		});
		mounted.push(m);

		const errorCard = () => m.host.querySelector<HTMLElement>('.assessment-error');
		await until(() => errorCard() !== null);
		// A raw (uncoded) failure renders the generic localized message plus a support
		// code; the raw text stays on the Error for logs only.
		expect(errorCard()!.textContent).toMatch(/something went wrong/i);
		expect(errorCard()!.textContent).not.toContain('connection refused');
		expect(errorCard()!.textContent).not.toContain('developer text');

		// Retry re-initializes; the backend has recovered and delivery starts.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-load-retry"]')!.click();
		await until(() => m.host.querySelector('[data-testid="assessment-next"]') !== null, 10000);
		expect(errorCard()).toBeNull();
		// The console still saw the raw failure for hosts and logs.
		expect(initCalls).toBe(2);
	});

	test('a slow load stays a polite status instead of turning into a permanent error', { timeout: 20000 }, async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, { itemXmlMap: ITEMS });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const referenceInit = backend.initSession.bind(backend);
		backend.initSession = async (request: InitSessionRequest): Promise<InitSessionResponse> => {
			await new Promise((resolve) => setTimeout(resolve, 150));
			return referenceInit(request);
		};

		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			config: { i18nProvider: i18n },
		});
		mounted.push(m);

		await settle();
		// Delivery proceeds once the (modestly delayed) load finishes; no error screen.
		await until(() => m.host.querySelector('[data-testid="assessment-next"]') !== null, 10000);
		expect(m.host.querySelector('.assessment-error')).toBeNull();
	});
});

describe('item entry failure', () => {
	test('a broken first question shows the failure screen with Retry instead of eternal loading', { timeout: 20000 }, async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
			itemXmlMap: { ...ITEMS, 'q1.xml': 'this is not xml <<<' },
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		let coreErrors = 0;

		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			config: { i18nProvider: i18n, onError: () => (coreErrors += 1) },
		});
		mounted.push(m);

		// The typed failure screen replaces the bare loading state; raw engine text stays
		// out of the candidate view.
		const errorCard = () => m.host.querySelector<HTMLElement>('.assessment-error');
		await until(() => errorCard() !== null);
		expect(errorCard()!.textContent).toMatch(/something went wrong/i);
		expect(m.host.querySelector('[data-testid="assessment-load-retry"]')).not.toBeNull();
		expect(m.host.querySelector('[data-testid="assessment-still-loading"]')).toBeNull();

		// Retry re-attempts the entry (still broken): the alert re-announces and focus
		// returns to Retry once the alert remounts.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-load-retry"]')!.click();
		// Wait for the retry's renewed failure to be reported (the initial one plus this
		// one), then for the alert to settle with focus back on the enabled Retry control.
		await until(() => coreErrors >= 2, 8000);
		await until(() => {
			const button = m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-load-retry"]');
			return errorCard() !== null && button !== null && !button.disabled && document.activeElement === button;
		}, 8000);
		expect(errorCard()).not.toBeNull();
	});
});

describe('content boundary', () => {
	test('a crashing question shows the fallback and the candidate continues', { timeout: 25000 }, async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, { itemXmlMap: ITEMS });
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		// The fixture crash: question two's rendering throws synchronously — the section
		// host snapshot callback fails while the renderer reports the rendered item.
		const sectionHost = {
			onSnapshotChange(snapshot: { activeItemIdentifier: string }) {
				if (snapshot.activeItemIdentifier === 'q2') {
					throw new Error('Renderer exploded while showing question two (fixture)');
				}
			},
		};
		const m = mountInto(AssessmentShell, {
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			config: { i18nProvider: i18n, sectionHost },
		});
		mounted.push(m);

		// Question 1 renders normally.
		await until(() => m.host.querySelector('[data-testid="assessment-next"]') !== null);

		// Question 2's rendering throws: the boundary's fallback replaces the content.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-next"]')!.click();
		const fallback = () => m.host.querySelector<HTMLElement>('[data-testid="assessment-content-fallback"]');
		await until(() => fallback() !== null, 10000);
		expect(fallback()!.textContent).toContain('This question could not be displayed.');
		// Focus follows the announcement to the fallback's recovery control; it must not
		// silently drop to the page body.
		await settle();
		expect(document.activeElement).toBe(fallback()!.querySelector('[data-testid="assessment-content-retry"]'));
		// The shell is intact: navigation stays reachable.
		expect(m.host.querySelector('[data-testid="assessment-next"]')).not.toBeNull();

		// Try again re-renders the crashed subtree (it fails again, deterministically).
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-content-retry"]')!.click();
		await until(() => fallback() !== null, 8000);

		// Continue moves on where navigation rules allow: question 3 renders normally.
		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-content-continue"]')!.click();
		await until(() => fallback() === null, 8000);
		expect(m.host.querySelector('.progress-question')?.textContent).toContain('Question 3 of 3');
	});
});
