/**
 * The shell-presentation options (`showSections`, `allowSectionNavigation`,
 * `showProgress`) default in exactly one place — the shell — and reach the chrome
 * from there. Against the real shell in jsdom: omitted options show and enable the
 * chrome; an explicit `false` turns each piece off. The headless core never reads
 * them, so nothing else may re-default them.
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

// Two visible sections, so the section menu has something to show.
const TEST_XML = `<assessmentTest ${NS} identifier="presentation" title="Presentation">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
    <assessmentSection identifier="s2" title="Section B" visible="true">
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

async function until<T>(check: () => T | null | undefined | false, timeout = 8000): Promise<T> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const value = check();
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error('condition not met within timeout');
}

type ConfigOverride = Record<string, unknown> | undefined;

async function mountShell(configOverride: ConfigOverride, readySelector = '.progress-question') {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, { itemXmlMap: ITEMS });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		config: { i18nProvider: i18n, ...(configOverride ?? {}) },
		onSubmit: vi.fn(),
	});
	mounted.push(m);
	// Delivery is live once the first question renders (a selector the config under
	// test does not hide).
	await until(() => m.host.querySelector(readySelector));
	return m;
}

const sectionToggle = (m: Mounted) => m.host.querySelector<HTMLButtonElement>('.section-menu-toggle');

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

describe('the shell-presentation options default once, in the shell', () => {
	test('omitted options show the section menu (enabled) and the progress indicator', async () => {
		const m = await mountShell(undefined);

		const toggle = sectionToggle(m)!;
		expect(toggle).not.toBeNull();
		expect(toggle.disabled).toBe(false);
		expect(m.host.querySelector('progress')).not.toBeNull();
	});

	test('showSections: false removes the section menu but keeps progress', async () => {
		const m = await mountShell({ showSections: false });

		expect(sectionToggle(m)).toBeNull();
		expect(m.host.querySelector('progress')).not.toBeNull();
	});

	test('allowSectionNavigation: false disables the section menu entries but keeps the menu', async () => {
		const m = await mountShell({ allowSectionNavigation: false });

		const toggle = sectionToggle(m)!;
		expect(toggle).not.toBeNull();
		expect(toggle.disabled).toBe(true);
	});

	test('showProgress: false removes the progress indicator but keeps the section menu', async () => {
		const m = await mountShell({ showProgress: false }, '[data-testid="assessment-next"]');

		expect(m.host.querySelector('progress')).toBeNull();
		expect(m.host.querySelector('.progress-question')).toBeNull();
		expect(sectionToggle(m)).not.toBeNull();
	});
});
