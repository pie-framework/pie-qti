/**
 * Integrated feedback is a status message (WCAG 4.1.3). FeedbackInline and feedbackBlock shown by
 * the candidate's attempt are spliced into the item body without moving focus, so the item body
 * announces them through one persistent polite live region — rendered with the body, so every
 * player and every host that renders the body gets it: on submit, end-attempt and every adaptive
 * attempt — never on initial render, restore, review or an unrelated re-render — in the item
 * content's language, falling back to a localized "Feedback is shown." in the interface language
 * when the shown feedback has no text.
 */

import { afterEach, describe, expect, test } from 'vitest';
import type { I18nProvider } from '@pie-qti/i18n';
import ItemBody from '../../src/components/ItemBody.svelte';
import ItemPlayer from '../../src/components/ItemPlayer.svelte';
import { createAssessmentItemDefinition, type AssessmentItemDefinitionConfig } from '../../src/core/AssessmentItemDefinition.js';
import type { ItemSession } from '../../src/core/ItemSession.js';
import { mountInto, settle, type Mounted } from './helpers';

const mounted: Mounted[] = [];
const sessions: ItemSession[] = [];

afterEach(() => {
	for (const m of mounted.splice(0)) m.destroy();
	for (const session of sessions.splice(0)) session.dispose();
});

async function render(props: Record<string, unknown>): Promise<Mounted> {
	const m = mountInto(ItemPlayer, props);
	mounted.push(m);
	await settle();
	return m;
}

function openSession(itemXml: string, options: Partial<AssessmentItemDefinitionConfig> = {}): ItemSession {
	const session = createAssessmentItemDefinition({ itemXml, ...options }).openSession();
	sessions.push(session);
	return session;
}

function announcer(host: HTMLElement): HTMLElement | null {
	return host.querySelector<HTMLElement>('.qti-feedback-announcer');
}

function body(host: HTMLElement): string {
	return host.querySelector('.qti-item-body-content')?.textContent ?? '';
}

function item({
	language,
	adaptive = false,
	correct = '<p>Well done.</p>',
	incorrect = '<p>Not quite.</p>',
	defaultFeedback,
	extraBody = '',
}: {
	language?: string;
	adaptive?: boolean;
	correct?: string;
	incorrect?: string;
	defaultFeedback?: string;
	extraBody?: string;
} = {}): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="feedback-announce" adaptive="${adaptive}" timeDependent="false"${language ? ` xml:lang="${language}"` : ''}>
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">${defaultFeedback ? `<defaultValue><value>${defaultFeedback}</value></defaultValue>` : ''}</outcomeDeclaration>
	<itemBody>
		<p>What is two and two?</p>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Four</simpleChoice>
			<simpleChoice identifier="B">Five</simpleChoice>
		</choiceInteraction>
		${extraBody}
		<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="CORRECT" showHide="show">${correct}</feedbackBlock>
		<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show">${incorrect}</feedbackBlock>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">CORRECT</baseValue></setOutcomeValue>
				${adaptive ? '<setOutcomeValue identifier="completionStatus"><baseValue baseType="identifier">completed</baseValue></setOutcomeValue>' : ''}
			</responseIf>
			<responseElse>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">INCORRECT</baseValue></setOutcomeValue>
			</responseElse>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;
}

function answer(session: ItemSession, value: string) {
	session.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value });
}

describe('feedback live region', () => {
	test('is in the DOM, polite and empty before any feedback appears', async () => {
		const session = openSession(item());
		const m = await render({ itemXml: item(), session });

		const region = announcer(m.host);
		expect(region).not.toBeNull();
		expect(region?.getAttribute('role')).toBe('status');
		expect(region?.getAttribute('aria-live')).toBe('polite');
		expect(region?.getAttribute('aria-atomic')).toBe('true');
		expect(region?.textContent).toBe('');
		expect(body(m.host)).not.toContain('Well done.');
	});

	test('comes with the item body, so a host rendering ItemBody without ItemPlayer announces too', async () => {
		const xml = item();
		const session = openSession(xml);
		const m = mountInto(ItemBody, { session, revision: 0 });
		mounted.push(m);
		await settle();
		expect(announcer(m.host)?.textContent).toBe('');

		answer(session, 'B');
		session.dispatch({ action: 'endAttempt' });
		await settle();

		expect(announcer(m.host)?.textContent).toBe('Not quite.');
	});
});

describe('announcing shown feedback', () => {
	test('a standalone submit announces the shown feedback', async () => {
		const m = await render({ itemXml: item(), responses: { RESPONSE: 'B' } });
		expect(announcer(m.host)?.textContent).toBe('');

		(m.instance.submit as (countAttempt?: boolean) => unknown)();
		await settle();

		expect(body(m.host)).toContain('Not quite.');
		expect(announcer(m.host)?.textContent).toBe('Not quite.');
	});

	test('an attempt ended on an externally owned session announces the shown feedback', async () => {
		const session = openSession(item());
		const m = await render({ itemXml: item(), session });

		answer(session, 'A');
		session.dispatch({ action: 'endAttempt' });
		await settle();

		expect(announcer(m.host)?.textContent).toBe('Well done.');
	});

	test('an attempt that shows no feedback announces nothing', async () => {
		const quiet = item({ correct: '', incorrect: '' }).replace(/<feedbackBlock[\s\S]*?<\/feedbackBlock>/g, '');
		const session = openSession(quiet);
		const m = await render({ itemXml: quiet, session });

		answer(session, 'A');
		session.dispatch({ action: 'endAttempt' });
		await settle();

		expect(announcer(m.host)?.textContent).toBe('');
	});

	test('each adaptive attempt announces its own feedback', async () => {
		const xml = item({ adaptive: true });
		const session = openSession(xml);
		const m = await render({ itemXml: xml, session });

		answer(session, 'B');
		session.dispatch({ action: 'submitAttempt' });
		await settle();
		expect(announcer(m.host)?.textContent).toBe('Not quite.');

		answer(session, 'A');
		session.dispatch({ action: 'submitAttempt' });
		await settle();
		expect(announcer(m.host)?.textContent).toBe('Well done.');
	});

	test('the same feedback shown again by a new attempt is announced again', async () => {
		const xml = item({ adaptive: true });
		const session = openSession(xml);
		const m = await render({ itemXml: xml, session });

		answer(session, 'B');
		session.dispatch({ action: 'submitAttempt' });
		await settle();
		const first = announcer(m.host)?.textContent;
		expect(first).toBe('Not quite.');

		session.dispatch({ action: 'submitAttempt' });
		await settle();
		const second = announcer(m.host)?.textContent;
		// A trailing zero-width space makes the identical text a change the screen reader announces.
		expect(second).toBe('Not quite.\u200b');
		expect(second).not.toBe(first);
	});

	test('the standalone adaptive submit announces each attempt', async () => {
		const xml = item({ adaptive: true });
		const m = await render({ itemXml: xml, responses: { RESPONSE: 'B' } });

		(m.instance.submit as (countAttempt?: boolean) => unknown)();
		await settle();
		expect(announcer(m.host)?.textContent).toBe('Not quite.');
	});
});

describe('renders that are not the candidate attempt stay silent', () => {
	test('initial render with feedback shown by an outcome default announces nothing', async () => {
		const xml = item({ defaultFeedback: 'CORRECT' });
		const session = openSession(xml);
		const m = await render({ itemXml: xml, session });

		expect(body(m.host)).toContain('Well done.');
		expect(announcer(m.host)?.textContent).toBe('');
	});

	test('restoring an already-answered session announces nothing', async () => {
		const definition = createAssessmentItemDefinition({ itemXml: item() });
		const first = definition.openSession();
		first.dispatch({ action: 'setResponse', responseIdentifier: 'RESPONSE', value: 'A' });
		first.dispatch({ action: 'endAttempt' });
		const saved = first.serialize();
		first.dispose();
		const restored = definition.openSession({ restore: saved });
		sessions.push(restored);

		const m = await render({ itemXml: item(), session: restored });
		expect(body(m.host)).toContain('Well done.');
		expect(announcer(m.host)?.textContent).toBe('');
	});

	test('a response change is not an attempt and announces nothing, before or after feedback', async () => {
		const xml = item({ adaptive: true });
		const session = openSession(xml);
		const m = await render({ itemXml: xml, session });

		answer(session, 'B');
		await settle();
		expect(announcer(m.host)?.textContent).toBe('');

		session.dispatch({ action: 'submitAttempt' });
		await settle();
		expect(announcer(m.host)?.textContent).toBe('Not quite.');

		// The next attempt's response change leaves the last announcement as it was.
		answer(session, 'A');
		await settle();
		expect(announcer(m.host)?.textContent).toBe('Not quite.');
	});

	test('a scorer view announces nothing', async () => {
		const xml = item();
		const session = openSession(xml, { role: 'scorer' });
		const m = await render({ itemXml: xml, session });

		answer(session, 'A');
		session.dispatch({ action: 'endAttempt' });
		await settle();

		expect(body(m.host)).toContain('Well done.');
		expect(announcer(m.host)?.textContent).toBe('');
	});
});

describe('announcement language', () => {
	const dutch: I18nProvider = {
		getLocale: () => 'nl',
		setLocale: () => {},
		getDirection: () => 'ltr',
		t: (key: string, defaultOrValues?: Record<string, unknown> | string) =>
			key === 'feedback.shown'
				? 'Er wordt terugkoppeling getoond.'
				: typeof defaultOrValues === 'string'
					? defaultOrValues
					: key,
	};

	test('feedback text takes the item content language and direction (WCAG 3.1.2)', async () => {
		const xml = item({ language: 'ar', correct: '<p>أحسنت</p>' });
		const session = openSession(xml);
		const m = await render({ itemXml: xml, session, i18n: dutch });

		answer(session, 'A');
		session.dispatch({ action: 'endAttempt' });
		await settle();

		const region = announcer(m.host);
		expect(region?.textContent).toBe('أحسنت');
		expect(region?.getAttribute('lang')).toBe('ar');
		expect(region?.getAttribute('dir')).toBe('rtl');
	});

	test('feedback with no text falls back to the localized phrase in the interface language', async () => {
		const xml = item({ language: 'en', correct: '<img src="tick.png"/>' });
		const session = openSession(xml);
		const m = await render({ itemXml: xml, session, i18n: dutch });

		answer(session, 'A');
		session.dispatch({ action: 'endAttempt' });
		await settle();

		const region = announcer(m.host);
		expect(region?.textContent).toBe('Er wordt terugkoppeling getoond.');
		expect(region?.getAttribute('lang')).toBe('nl');
		expect(region?.getAttribute('dir')).toBe('ltr');
	});

	test('without a provider the fallback phrase is English', async () => {
		const xml = item({ correct: '<img src="tick.png" alt=""/>' });
		const session = openSession(xml);
		const m = await render({ itemXml: xml, session });

		answer(session, 'A');
		session.dispatch({ action: 'endAttempt' });
		await settle();

		expect(announcer(m.host)?.textContent).toBe('Feedback is shown.');
	});
});
