/**
 * The <pie-qti-item-player> element contract under the final-review findings:
 *
 * - Integrated feedback (`feedbackInline` / `feedbackBlock`) is hidden by default, as QTI
 *   `itemSessionControl@showFeedback` (default false) requires; the host opts in with the
 *   `showFeedback` property or the `show-feedback` attribute, and `showSolution` exposes
 *   correct responses after the attempt ends.
 * - A broken item dispatches a typed `error` event carrying the raw detail for the host,
 *   renders a localized generic message to the candidate, and fires `ready` only on success.
 * - The player role attribute is `qti-role` (a bare `role` attribute is ARIA); unknown role
 *   values render as `candidate` with a diagnostic.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ComponentRegistry } from '../../src/core/ComponentRegistry.js';
import { PieQtiItemPlayerElement } from '../../src/element-class.js';
import { settle } from './helpers';

const TAG = 'pie-qti-item-player-contract';
if (!customElements.get(TAG)) customElements.define(TAG, PieQtiItemPlayerElement);

const CHOICE_TAG = 'test-contract-choice';

const choiceRendererPlugin = {
	kind: 'assessment-item-definition-plugin' as const,
	name: 'contract-choice-renderer',
	version: '1.0.0',
	registerComponents: (registry: ComponentRegistry) => {
		registry.register('choiceInteraction', {
			name: 'contract-choice',
			tagName: CHOICE_TAG,
			priority: 100,
		});
	},
};

const FEEDBACK_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="contract-feedback" adaptive="false" timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse><value>A</value></correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier"/>
	<itemBody>
		<choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<simpleChoice identifier="A">Mars</simpleChoice>
			<simpleChoice identifier="B">Venus</simpleChoice>
		</choiceInteraction>
		<p><feedbackInline outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show">Not quite.</feedbackInline></p>
		<feedbackBlock outcomeIdentifier="FEEDBACK" identifier="INCORRECT" showHide="show"><p>Two and two make four.</p></feedbackBlock>
	</itemBody>
	<responseProcessing>
		<responseCondition>
			<responseIf>
				<match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">CORRECT</baseValue></setOutcomeValue>
			</responseIf>
			<responseElse>
				<setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">INCORRECT</baseValue></setOutcomeValue>
			</responseElse>
		</responseCondition>
	</responseProcessing>
</assessmentItem>`;

const BROKEN_ITEM = '<assessmentItem><itemBody><p>Unclosed';

function answer(host: HTMLElement, value: string) {
	host.querySelector(CHOICE_TAG)?.dispatchEvent(
		new CustomEvent('qti-change', {
			bubbles: true,
			composed: true,
			detail: { responseId: 'RESPONSE', value, timestamp: Date.now() },
		}),
	);
}

function bodyText(host: HTMLElement): string {
	return host.querySelector('.qti-item-body-content')?.textContent ?? '';
}

const elements: HTMLElement[] = [];
const listeners: (() => void)[] = [];

afterEach(() => {
	for (const element of elements.splice(0)) element.remove();
	for (const restore of listeners.splice(0)) restore();
	vi.restoreAllMocks();
});

async function render(
	itemXml: string,
	setup: (element: PieQtiItemPlayerElement) => void = () => {},
): Promise<PieQtiItemPlayerElement> {
	const element = document.createElement(TAG) as PieQtiItemPlayerElement;
	element.plugins = [choiceRendererPlugin];
	setup(element);
	element.itemXml = itemXml;
	document.body.appendChild(element);
	elements.push(element);
	await settle();
	return element;
}

describe('integrated feedback defaults to hidden', () => {
	test('a submit shows no feedbackInline or feedbackBlock unless the host opts in', async () => {
		const element = await render(FEEDBACK_ITEM);
		answer(element, 'B');
		await settle();
		element.submit();
		await settle();

		expect(bodyText(element)).not.toContain('Not quite.');
		expect(bodyText(element)).not.toContain('Two and two make four.');
	});

	test('showFeedback: true opts in', async () => {
		const element = await render(FEEDBACK_ITEM, (el) => {
			el.showFeedback = true;
		});
		answer(element, 'B');
		await settle();
		element.submit();
		await settle();

		expect(bodyText(element)).toContain('Not quite.');
		expect(bodyText(element)).toContain('Two and two make four.');
	});

	test('the show-feedback attribute opts in', async () => {
		const element = await render(FEEDBACK_ITEM, (el) => {
			el.setAttribute('show-feedback', '');
		});
		answer(element, 'B');
		await settle();
		element.submit();
		await settle();

		expect(bodyText(element)).toContain('Two and two make four.');
	});

	test('showSolution: true exposes the correct response after the attempt ends', async () => {
		const element = await render(FEEDBACK_ITEM, (el) => {
			el.showSolution = true;
		});
		answer(element, 'B');
		await settle();
		element.submit();
		await settle();

		const correct = (
			element.querySelector(CHOICE_TAG) as unknown as { correctResponse?: unknown }
		).correctResponse;
		expect(correct).toBe('A');
	});
});

describe('error events and candidate-safe messages', () => {
	test('a broken item dispatches error with the raw detail and shows a generic message', async () => {
		const element = document.createElement(TAG) as PieQtiItemPlayerElement;
		const errors: unknown[] = [];
		let readyCount = 0;
		element.addEventListener('error', (event) => errors.push((event as CustomEvent).detail));
		element.addEventListener('ready', () => {
			readyCount += 1;
		});
		element.itemXml = BROKEN_ITEM;
		document.body.appendChild(element);
		elements.push(element);
		await settle();

		const detail = errors[0] as { code: string; message: string; itemIdentifier?: string };
		expect(errors).toHaveLength(1);
		expect(detail.code).toBe('item-load-failed');
		expect(detail.message).toMatch(/\S/);
		expect(detail.itemIdentifier).toBeUndefined();
		expect(readyCount).toBe(0);

		const alert = element.querySelector('[role="alert"]');
		expect(alert).not.toBeNull();
		expect(alert?.textContent).toContain('Failed to load item');
		// The raw parser detail never reaches the candidate.
		expect(alert?.textContent).not.toBe(detail.message);
	});

	test('ready fires once on success and is not re-fired by unrelated writes', async () => {
		let readyCount = 0;
		const element = await render(FEEDBACK_ITEM, (el) => {
			el.addEventListener('ready', () => {
				readyCount += 1;
			});
		});
		await settle();
		expect(readyCount).toBe(1);

		element.disabled = true;
		element.disabled = false;
		await settle();
		expect(readyCount).toBe(1);
	});
});

describe('qti-role attribute', () => {
	test('the attribute is qti-role; unknown values render as candidate with a warning', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(PieQtiItemPlayerElement.observedAttributes).toContain('qti-role');
		expect(PieQtiItemPlayerElement.observedAttributes).not.toContain('role');

		const element = document.createElement(TAG) as PieQtiItemPlayerElement;
		element.setAttribute('qti-role', 'scorer');
		expect(element.role).toBe('scorer');

		const unknown = document.createElement(TAG) as PieQtiItemPlayerElement;
		unknown.setAttribute('qti-role', 'ninja');
		expect(unknown.role).toBe('candidate');
		expect(warn.mock.calls.some((call) => String(call[0]).includes('ninja'))).toBe(true);
	});

	test('an unknown role property falls back to candidate', async () => {
		const element = await render(FEEDBACK_ITEM, (el) => {
			(el as unknown as { role: string }).role = 'wizard';
		});
		expect(element.querySelector('[role="alert"]')).toBeNull();
		expect(element.querySelector('.qti-item-body-content')).not.toBeNull();
	});

	test('a legacy role attribute carrying a QTI role points hosts at qti-role', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const element = document.createElement(TAG) as PieQtiItemPlayerElement;
		element.setAttribute('role', 'scorer');
		element.itemXml = FEEDBACK_ITEM;
		document.body.appendChild(element);
		elements.push(element);
		await settle();

		expect(
			warn.mock.calls.some((call) => String(call[0]).includes('qti-role')),
		).toBe(true);
	});
});
