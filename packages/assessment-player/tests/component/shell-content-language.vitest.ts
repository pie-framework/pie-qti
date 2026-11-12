/**
 * Test-level content keeps its authored language through the real shell (WCAG 3.1.2): a
 * French passage and Spanish (inherited) instructions in delivery, and French testFeedback on
 * the completion screen, each carry their content `lang`/`dir` while the shell chrome keeps
 * the interface locale.
 */

import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AssessmentShell from '../../src/components/AssessmentShell.svelte';
import { ReferenceBackendAdapter } from '../../src/integration/ReferenceBackendAdapter.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const i18n = new DefaultI18nProvider('en-US');

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const ITEM = `<assessmentItem ${NS} identifier="q1" title="Question 1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>B</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">3</simpleChoice>
      <simpleChoice identifier="B">4</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

const TEST = `<assessmentTest ${NS} identifier="language-shell" title="Language test" xml:lang="en">
  <outcomeDeclaration identifier="DONE" cardinality="single" baseType="identifier"/>
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true" xml:lang="es">
      <rubricBlock view="candidate" use="passage" xml:lang="fr"><p>Le cycle de l'eau.</p></rubricBlock>
      <rubricBlock view="candidate" use="instructions"><p>Lee el texto.</p></rubricBlock>
      <assessmentItemRef identifier="q1" href="q1.xml"/>
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="DONE"><baseValue baseType="identifier">yes</baseValue></setOutcomeValue>
  </outcomeProcessing>
  <testFeedback access="atEnd" outcomeIdentifier="DONE" identifier="yes" showHide="show" xml:lang="fr"><p>Bravo !</p></testFeedback>
</assessmentTest>`;

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	localStorage.clear();
});

async function until<T>(check: () => T | null | undefined, timeout = 5000): Promise<T> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const value = check();
		if (value) return value;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error('condition not met within timeout');
}

async function mountShell() {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST, { itemXmlMap: { 'q1.xml': ITEM } });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const m = mountInto(AssessmentShell, {
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'language-candidate' },
		config: { i18nProvider: i18n },
		onSubmit: vi.fn(),
	});
	mounted.push(m);
	await until(() => m.host.querySelector('[data-testid="assessment-submit"]'));
	return m;
}

function languageOf(el: Element | null | undefined): [string | null, string | null] {
	return [el?.getAttribute('lang') ?? null, el?.getAttribute('dir') || null];
}

describe('assessment shell content language', () => {
	test('passages and instructions carry their content language in delivery', async () => {
		const m = await mountShell();
		await until(() => m.host.querySelector('.passage-content'));

		expect(languageOf(m.host.querySelector('.assessment-shell'))).toEqual(['en-US', 'ltr']);
		expect(languageOf(m.host.querySelector('.passage-content'))).toEqual(['fr', 'ltr']);
		expect(languageOf(m.host.querySelector('.instructions-content'))).toEqual(['es', 'ltr']);
	});

	test('the completion screen shows test feedback in its own language', async () => {
		const m = await mountShell();
		(m.instance as unknown as { updateResponse(id: string, value: unknown): void }).updateResponse('RESPONSE', 'B');
		await settle();

		m.host.querySelector<HTMLButtonElement>('[data-testid="assessment-submit"]')!.click();
		const confirm = await until(() =>
			m.host.querySelector('dialog[open]')?.querySelector<HTMLButtonElement>('[data-testid="assessment-dialog-confirm"]'),
		);
		confirm.click();
		const complete = await until(() => m.host.querySelector('[data-testid="assessment-complete"]'));
		const feedback = await until(() => complete.querySelector('.test-feedback-content'));

		expect(feedback.textContent).toContain('Bravo !');
		expect(languageOf(feedback)).toEqual(['fr', 'ltr']);
		// The completion chrome (heading, region name) stays in the interface locale.
		expect(languageOf(complete)).toEqual(['en-US', 'ltr']);
		expect(complete.querySelector('section.test-feedback')?.hasAttribute('lang')).toBe(false);
	});
});
