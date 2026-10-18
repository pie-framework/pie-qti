import { afterEach, describe, expect, test } from 'vitest';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import type { ChoiceInteractionData } from '@pie-qti/item-player';
import {
	check,
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
} from './helpers';

function choiceData(overrides: Partial<ChoiceInteractionData> = {}): ChoiceInteractionData {
	return {
		type: 'choiceInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		maxChoices: 1,
		minChoices: 1,
		prompt: '<p>Which one is a fruit?</p>',
		choices: [
			{ identifier: 'A', text: '<p>Alpha</p>' },
			{ identifier: 'B', text: '<p>Beta</p>' },
			{ identifier: 'C', text: '<p>Gamma</p>' },
		],
		...overrides,
	};
}

afterEach(() => {
	// Remove any hosts appended during the test.
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('ChoiceInteraction (pie-qti-choice)', () => {
	test('single choice: clicking a choice answers with its identifier and emits a composed qti-change', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();

		const inputs = qa<HTMLInputElement>(mounted, 'input[type="radio"]');
		expect(inputs).toHaveLength(3);

		check(inputs[1]!, true);
		await settle();

		expect(mounted.instance.response).toBe('B');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.type).toBe('qti-change');
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 'B' });
		// The event must cross the shadow boundary for host players to hear it.
		expect(mounted.events[0]!.bubbles).toBe(true);
		expect(mounted.events[0]!.composed).toBe(true);
	});

	test('each choice input is labelled by its rendered choice text', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();

		for (const input of qa<HTMLInputElement>(mounted, 'input[type="radio"]')) {
			const labelledBy = input.getAttribute('aria-labelledby');
			expect(labelledBy, 'input must reference its label element').toBeTruthy();
			const label = mounted.host.querySelector(`#${CSS.escape(labelledBy!)}`);
			expect(label?.classList.contains('qti-choice-text')).toBe(true);
		}
	});

	test('multiple choice: checkbox answers accumulate and maxChoices caps further selection', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ maxChoices: 2 }),
		});
		await settle();

		const inputs = qa<HTMLInputElement>(mounted, 'input[type="checkbox"]');
		expect(inputs).toHaveLength(3);

		check(inputs[0]!, true);
		await settle();
		check(inputs[2]!, true);
		await settle();

		expect(mounted.instance.response).toEqual(['A', 'C']);

		const eventsBefore = mounted.events.length;
		check(inputs[1]!, true);
		await settle();

		expect(mounted.instance.response).toEqual(['A', 'C']);
		expect(mounted.events).toHaveLength(eventsBefore);
		// The refused selection must not stay visually checked (it is not in the response).
		expect(inputs[1]!.checked).toBe(false);
	});

	test('shows the max-selections alert once the cap is reached', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ maxChoices: 1, maxSelectionsMessage: 'Only one answer allowed' }),
		});
		await settle();

		check(q<HTMLInputElement>(mounted, 'input[type="radio"]')!, true);
		await settle();

		const alert = q(mounted, '[role="alert"]');
		expect(alert?.textContent).toContain('Only one answer allowed');
	});

	test('deselecting a checkbox updates the response array', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ maxChoices: 0 }),
		});
		await settle();

		const inputs = qa<HTMLInputElement>(mounted, 'input[type="checkbox"]');
		check(inputs[0]!, true);
		check(inputs[1]!, true);
		await settle();
		check(inputs[0]!, false);
		await settle();

		expect(mounted.instance.response).toEqual(['B']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: ['B'] });
	});

	test('scorer role highlights the correct choice', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData(),
			role: 'scorer',
			correctResponse: 'B',
		});
		await settle();

		const labels = qa(mounted, 'label[part="label"]');
		expect(labels[1]?.classList.contains('qti-choice-correct')).toBe(true);
		expect(labels[0]?.classList.contains('qti-choice-correct')).toBe(false);
		expect(q(mounted, 'label[part="label"] .badge')?.textContent).toContain('Correct');
	});

	test('structured labels: the answer set is one group named by the prompt', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData(),
			structuredLabelSupport: true,
		});
		await settle();

		const root = q(mounted, '[part="root"]');
		expect(root?.getAttribute('role')).toBe('group');
		const prompt = q(mounted, '[part="prompt"]');
		expect(root?.getAttribute('aria-labelledby')).toBe(prompt?.id);

		// Without a prompt the group falls back to a localized generic name.
		const unnamed = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ prompt: null }),
			structuredLabelSupport: true,
		});
		await settle();
		const unnamedRoot = q(unnamed, '[part="root"]');
		expect(unnamedRoot?.getAttribute('role')).toBe('group');
		expect(unnamedRoot?.getAttribute('aria-label')).toBe('Answer choices');
	});

	test('elimination tool: toggling marks the choice eliminated and announced', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData(),
			eliminationTool: true,
		});
		await settle();

		const eliminate = q(mounted, 'button.qti-eliminate-btn');
		expect(eliminate?.getAttribute('aria-pressed')).toBe('false');
		eliminate?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(eliminate?.getAttribute('aria-pressed')).toBe('true');
		expect(eliminate?.getAttribute('aria-label')).toBe('Restore');
		expect(eliminate?.closest('[part="option"]')?.hasAttribute('data-eliminated')).toBe(true);
		// Elimination is scratch work: the response is untouched.
		expect(mounted.instance.response).toBeUndefined();
	});

	test('answer masking: masked choices hide their input behind a reveal button', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData(),
			answerMasking: true,
		});
		await settle();

		expect(qa(mounted, 'input[type="radio"]')).toHaveLength(0);
		const reveal = q(mounted, 'button[part="reveal"]');
		expect(reveal?.textContent).toContain('Reveal choice 1');

		reveal?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		// Only the revealed choice exposes its radio; the rest stay masked.
		expect(qa<HTMLInputElement>(mounted, 'input[type="radio"]')).toHaveLength(1);
		expect(qa(mounted, '[data-masked] button[part="reveal"]')).toHaveLength(2);
	});

	test('disabled: inputs are disabled and produce no response', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData(),
			disabled: true,
		});
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="radio"]')!;
		expect(input.disabled).toBe(true);
		// A disabled input must not react to activation (clicks are no-ops on it).
		input.click();
		await settle();

		expect(mounted.instance.response).toBeUndefined();
		expect(mounted.events).toHaveLength(0);
	});
});

describe('ChoiceInteraction keyboard support', () => {
	test('radio groups are reachable by keyboard (native focusable inputs)', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();

		for (const input of qa<HTMLInputElement>(mounted, 'input[type="radio"]')) {
			expect(input.disabled).toBe(false);
			// Native radio inputs are keyboard-operable; the interaction must not opt out.
			expect(input.getAttribute('tabindex')).not.toBe('-1');
		}

		// Arrow/Space operation on native radios is browser behavior; the component
		// contract is that a change event is all it takes to answer:
		const input = q<HTMLInputElement>(mounted, 'input[type="radio"]')!;
		input.checked = true;
		input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
		await settle();
		expect(mounted.instance.response).toBe('A');
	});
});
