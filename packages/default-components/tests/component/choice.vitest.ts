import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

	test('a refused selection is announced with a localized default when no message is authored', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ maxChoices: 2 }),
		});
		await settle();

		expect(q(mounted, '[role="alert"]')).toBeNull();

		const inputs = qa<HTMLInputElement>(mounted, 'input[type="checkbox"]');
		check(inputs[0]!, true);
		check(inputs[1]!, true);
		await settle();

		const alert = q(mounted, '[role="alert"]');
		expect(alert?.textContent).toContain('You can select up to 2. Deselect one to choose another.');
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

	test('the group is always associated with the prompt, even without the structured-label PNP', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();

		const root = q(mounted, '[part="root"]');
		const prompt = q(mounted, '[part="prompt"]');
		expect(root?.getAttribute('role')).toBe('group');
		expect(root?.getAttribute('aria-labelledby')).toBe(prompt?.id);
	});

	test('an authored accessible name still beats the prompt', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ accessibility: { label: 'Pick a fruit' } }),
		});
		await settle();

		const root = q(mounted, '[part="root"]');
		expect(root?.getAttribute('aria-label')).toBe('Pick a fruit');
		expect(root?.getAttribute('aria-labelledby')).toBeNull();
	});

	test('elimination tool: the toggle is named by its action plus the choice content', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData(),
			eliminationTool: true,
		});
		await settle();

		const eliminate = q(mounted, 'button.qti-eliminate-btn');
		expect(eliminate?.getAttribute('aria-pressed')).toBe('false');
		// The accessible name is composed via aria-labelledby from the verb and the
		// rendered choice text, not from flattened button content.
		const labelledBy = eliminate?.getAttribute('aria-labelledby') ?? '';
		const name = labelledBy
			.split(' ')
			.map((id) => mounted.host.querySelector(`#${CSS.escape(id)}`)?.textContent?.trim())
			.filter(Boolean)
			.join(' ');
		expect(name).toBe('Eliminate Alpha');

		eliminate?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();

		expect(eliminate?.getAttribute('aria-pressed')).toBe('true');
		const restoreLabelledBy = eliminate?.getAttribute('aria-labelledby') ?? '';
		const restoreName = restoreLabelledBy
			.split(' ')
			.map((id) => mounted.host.querySelector(`#${CSS.escape(id)}`)?.textContent?.trim())
			.filter(Boolean)
			.join(' ');
		expect(restoreName).toBe('Restore Alpha');
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

	test('the selected row carries a visible selected-state marker', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();

		const labels = qa(mounted, 'label[part="label"]');
		expect(labels.every((label) => !label.hasAttribute('data-selected'))).toBe(true);

		check(q<HTMLInputElement>(mounted, 'input[type="radio"]')!, true);
		await settle();

		const updatedLabels = qa(mounted, 'label[part="label"]');
		expect(updatedLabels[0]?.hasAttribute('data-selected')).toBe(true);
		expect(updatedLabels[1]?.hasAttribute('data-selected')).toBe(false);
	});

	test('clear answer: a single-choice selection can be retracted and announces the cleared response', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();

		// No clear button before a selection exists.
		expect(q(mounted, 'button[part="clear"]')).toBeNull();

		check(q<HTMLInputElement>(mounted, 'input[type="radio"]')!, true);
		await settle();

		const clear = q<HTMLButtonElement>(mounted, 'button[part="clear"]');
		expect(clear?.textContent?.trim()).toBe('Clear answer');
		clear?.focus();
		clear?.click();
		await settle();

		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: null });
		// Focus moves to the first choice so keyboard users stay inside the interaction.
		expect(document.activeElement?.getAttribute('type')).toBe('radio');
		// The clear button is gone once there is nothing to clear.
		expect(q(mounted, 'button[part="clear"]')).toBeNull();
	});

	test('clear answer is not offered for multiple choice', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ maxChoices: 2 }),
		});
		await settle();

		check(q<HTMLInputElement>(mounted, 'input[type="checkbox"]')!, true);
		await settle();

		expect(q(mounted, 'button[part="clear"]')).toBeNull();
	});

	test('single choice does not toggle off: re-activating the selected radio keeps the answer', async () => {
		const mounted = mountInteraction(ChoiceInteraction, { interaction: choiceData() });
		await settle();

		const [alpha, beta] = qa<HTMLInputElement>(mounted, 'input[type="radio"]');
		check(alpha!, true);
		await settle();
		alpha!.click();
		await settle();

		// Native radio semantics (QTI single cardinality): no retraction by re-selection.
		expect(alpha!.checked).toBe(true);
		expect(mounted.instance.response).toBe('A');
		expect(mounted.events.every((event) => event.detail.value === 'A')).toBe(true);

		// Choosing another option switches; Clear answer is the explicit retraction.
		check(beta!, true);
		await settle();
		expect(mounted.instance.response).toBe('B');
		expect(alpha!.checked).toBe(false);
		expect(q(mounted, '[role="alert"]')).toBeNull();
		q<HTMLButtonElement>(mounted, 'button[part="clear"]')!.click();
		await settle();
		expect(mounted.instance.response).toBeNull();
	});

	test('multiple choice toggles off: unchecking the selected checkbox removes it', async () => {
		const mounted = mountInteraction(ChoiceInteraction, {
			interaction: choiceData({ maxChoices: 2 }),
		});
		await settle();

		const alpha = q<HTMLInputElement>(mounted, 'input[type="checkbox"]')!;
		alpha.click();
		await settle();
		expect(mounted.instance.response).toEqual(['A']);
		alpha.click();
		await settle();
		expect(alpha.checked).toBe(false);
		expect(mounted.instance.response).toEqual([]);
	});

	test('two renderings of the same item keep instance-unique ids and separate radio groups', async () => {
		const first = mountInteraction(ChoiceInteraction, { interaction: choiceData(), eliminationTool: true });
		const second = mountInteraction(ChoiceInteraction, { interaction: choiceData(), eliminationTool: true });
		await settle();

		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);

		for (const mounted of [first, second]) {
			const references = [
				...qa(mounted, '[aria-labelledby]').flatMap((element) =>
					(element.getAttribute('aria-labelledby') ?? '').split(' ').filter(Boolean),
				),
			];
			expect(references.length).toBeGreaterThan(0);
			for (const id of references) {
				expect(mounted.host.contains(document.getElementById(id)), `#${id}`).toBe(true);
			}
			// One radio group per instance.
			const names = new Set(qa<HTMLInputElement>(mounted, 'input[type="radio"]').map((input) => input.name));
			expect(names.size).toBe(1);
		}
		const firstName = q<HTMLInputElement>(first, 'input[type="radio"]')!.name;
		const secondName = q<HTMLInputElement>(second, 'input[type="radio"]')!.name;
		expect(firstName).not.toBe(secondName);

		// Answering the second rendering must not uncheck the first one's radio.
		const firstAlpha = q<HTMLInputElement>(first, 'input[type="radio"]')!;
		check(firstAlpha, true);
		check(qa<HTMLInputElement>(second, 'input[type="radio"]')[1]!, true);
		await settle();
		expect(firstAlpha.checked).toBe(true);
		expect(first.instance.response).toBe('A');
		expect(second.instance.response).toBe('B');
		cleanupInteraction(first, second);
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

// jsdom does not compute shadow styles, so the CSS contracts are asserted against
// the component source (same approach as tests/pnp-styles.test.ts).
describe('ChoiceInteraction style contracts', () => {
	const source = readFileSync(resolve(process.cwd(), 'src/plugins/choice/ChoiceInteraction.svelte'), 'utf8');

	test('hidden input controls still show a focus indicator on the row (WCAG 2.4.7)', () => {
		expect(source).toContain('.qti-choice-label:has(input:focus-visible)');
		expect(source).toContain('outline: 2px solid var(--pie-qti-focus, #4338ca)');
		// Fallback for engines without :has()
		expect(source).toContain('.qti-choice-label:focus-within');
	});

	test('the selection limit message uses the warning-text token (WCAG 1.4.3)', () => {
		expect(source).toContain('color: var(--pie-qti-warning-text, #92400e)');
	});

	test('the elimination toggle is a 44px target with a 3:1 boundary (WCAG 2.5.8/1.4.11)', () => {
		const btnCss = source.slice(source.indexOf('.qti-eliminate-btn {'), source.indexOf('/* Eliminated choices'));
		expect(btnCss).toContain('width: 2.75rem');
		expect(btnCss).toContain('height: 2.75rem');
		expect(btnCss).toContain('var(--pie-qti-border-strong, #767676)');
		expect(btnCss).not.toContain('opacity: 0.4');
	});

	test('rows are at least 44px tall with 1rem base text (K-12 targets)', () => {
		expect(source).toContain('min-height: 2.75rem');
		expect(source).toContain('font-size: 1rem');
	});

	test('multi-column layouts collapse on narrow containers (WCAG 1.4.10)', () => {
		expect(source).toContain('@container (max-width: 40rem)');
		expect(source).toContain('container-type: inline-size');
	});
});
