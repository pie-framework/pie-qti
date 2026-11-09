import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import SliderInteraction from '../../src/plugins/slider/SliderInteraction.svelte';
import type { SliderInteractionData } from '@pie-qti/item-player';
import {
	mountInteraction,
	qa,
	q,
	settle,
	type,
} from './helpers';

function sliderData(overrides: Partial<SliderInteractionData> = {}): SliderInteractionData {
	return {
		type: 'sliderInteraction',
		responseId: 'RESPONSE',
		lowerBound: 0,
		upperBound: 100,
		step: 1,
		orientation: 'horizontal',
		reverse: false,
		prompt: '<p>Rate your confidence</p>',
		...overrides,
	};
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('SliderInteraction (pie-qti-slider)', () => {
	test('the accessible name comes from the prompt, not a hardcoded English label', async () => {
		const mounted = mountInteraction(SliderInteraction, { interaction: sliderData() });
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		const prompt = q(mounted, '[part="prompt"]');
		expect(input.getAttribute('aria-label')).toBeNull();
		expect(input.getAttribute('aria-labelledby')).toBe(prompt?.id);
	});

	test('without a prompt the slider falls back to a localized bounds label', async () => {
		const mounted = mountInteraction(SliderInteraction, {
			interaction: sliderData({ prompt: null }),
		});
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		expect(input.getAttribute('aria-labelledby')).toBeNull();
		expect(input.getAttribute('aria-label')).toBe('Slider value from 0 to 100');
	});

	test('an untouched slider reports "No value selected" instead of the midpoint', async () => {
		const mounted = mountInteraction(SliderInteraction, { interaction: sliderData(), response: null });
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		// The thumb rests at the midpoint but no value is claimed: valuenow stays unset
		// and the valuetext carries the untouched state.
		expect(input.getAttribute('aria-valuenow')).toBeNull();
		expect(input.getAttribute('aria-valuetext')).toBe('No value selected');

		// The readout repeats the untouched state in a distinct visual state.
		expect(q(mounted, '[part="value-card"]')?.classList.contains('qti-slider-untouched')).toBe(true);
		expect(q(mounted, '[part="value-card"]')?.textContent).toContain('No value selected');
		expect(q(mounted, '[part="value-card"]')?.textContent).not.toContain('50');

		// No response and no event before the candidate interacts (FR-5).
		expect(mounted.instance.response).toBeNull();
		expect(mounted.events).toHaveLength(0);
	});

	test('the first interaction sets the value and updates name, readout and state', async () => {
		const mounted = mountInteraction(SliderInteraction, { interaction: sliderData() });
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		type(input, '73');
		await settle();

		expect(mounted.instance.response).toBe(73);
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 73 });
		expect(input.getAttribute('aria-valuenow')).toBe('73');
		expect(input.getAttribute('aria-valuetext')).toBe('73');
		expect(q(mounted, '[part="value-card"]')?.textContent).toContain('Selected Value');
		expect(q(mounted, '[part="value-card"]')?.textContent).toContain('73');
		expect(q(mounted, '[part="value-card"]')?.classList.contains('qti-slider-untouched')).toBe(false);
	});

	test('scorer mode shows the correct response, disabled', async () => {
		const mounted = mountInteraction(SliderInteraction, {
			interaction: sliderData(),
			role: 'scorer',
			correctResponse: 75,
		});
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		expect(input.disabled).toBe(true);
		expect(input.getAttribute('aria-valuenow')).toBe('75');
		expect(input.getAttribute('aria-valuetext')).toContain('75');
		expect(input.getAttribute('aria-valuetext')).toContain('Correct answer');
		expect(q(mounted, '[part="value-card"]')?.textContent).toContain('75');
	});

	test('orientation="vertical" renders a vertical track', async () => {
		const mounted = mountInteraction(SliderInteraction, {
			interaction: sliderData({ orientation: 'vertical' }),
		});
		await settle();

		expect(q(mounted, '[part="track"]')?.classList.contains('qti-slider-vertical')).toBe(true);
	});

	test('a vertical slider exposes its orientation to assistive technology, not only through CSS', async () => {
		// writing-mode turns the track visually but leaves the slider role at its implicit
		// horizontal orientation (WCAG 4.1.2), so the input states it.
		const vertical = mountInteraction(SliderInteraction, {
			interaction: sliderData({ orientation: 'vertical' }),
		});
		const horizontal = mountInteraction(SliderInteraction, { interaction: sliderData() });
		await settle();

		expect(q<HTMLInputElement>(vertical, 'input[type="range"]')?.getAttribute('aria-orientation')).toBe('vertical');
		// Horizontal is the slider role's implicit value, so it needs no attribute.
		expect(q<HTMLInputElement>(horizontal, 'input[type="range"]')?.hasAttribute('aria-orientation')).toBe(false);
	});

	test('reverse="true" renders a reversed track', async () => {
		const mounted = mountInteraction(SliderInteraction, {
			interaction: sliderData({ reverse: true }),
		});
		await settle();

		expect(q(mounted, '[part="track"]')?.classList.contains('qti-slider-reverse')).toBe(true);
	});

	test('stepLabel renders a tick label per step while they stay readable', async () => {
		const mounted = mountInteraction(SliderInteraction, {
			interaction: sliderData({ lowerBound: 0, upperBound: 10, step: 2, stepLabel: true }),
		});
		await settle();

		const ticks = qa(mounted, '.qti-slider-tick');
		expect(ticks.map((tick) => tick.textContent)).toEqual(['0', '2', '4', '6', '8', '10']);
		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		expect(input.getAttribute('list')).toBeTruthy();
		expect(q(mounted, 'datalist')).not.toBeNull();
	});

	test('stepLabel is ignored when there are too many steps to label', async () => {
		const mounted = mountInteraction(SliderInteraction, {
			interaction: sliderData({ lowerBound: 0, upperBound: 100, step: 1, stepLabel: true }),
		});
		await settle();

		expect(qa(mounted, '.qti-slider-tick')).toHaveLength(0);
		expect(q(mounted, 'datalist')).toBeNull();
	});

	test('disabled slider ignores input', async () => {
		const mounted = mountInteraction(SliderInteraction, {
			interaction: sliderData(),
			response: null,
			disabled: true,
		});
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		expect(input.disabled).toBe(true);
		type(input, '10');
		await settle();

		expect(mounted.instance.response).toBeNull();
		expect(mounted.events).toHaveLength(0);
	});

	test('two renderings of the same item keep their own prompt label and tick list', async () => {
		const data = sliderData({ lowerBound: 0, upperBound: 10, step: 2, stepLabel: true });
		const first = mountInteraction(SliderInteraction, { interaction: data });
		const second = mountInteraction(SliderInteraction, { interaction: data });
		await settle();

		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);

		for (const mounted of [first, second]) {
			const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
			const prompt = document.getElementById(input.getAttribute('aria-labelledby') ?? '');
			expect(prompt?.getAttribute('part')).toBe('prompt');
			expect(mounted.host.contains(prompt)).toBe(true);
			const ticks = document.getElementById(input.getAttribute('list') ?? '');
			expect(ticks?.tagName).toBe('DATALIST');
			expect(mounted.host.contains(ticks)).toBe(true);
		}
	});
});

// createInteractionShell's rule: correct-answer mode is the scorer's view of an item that has a
// correct response. Hosts pass null when the item declares none; a scorer then sees the
// interaction as a candidate does. Outside that view only `disabled` stops interaction.
describe('SliderInteraction correct-answer mode: role × correct response', () => {
	test.each([
		['candidate', 75, false],
		['candidate', null, false],
		['scorer', 75, true],
		['scorer', null, false],
	] as const)('%s, correct response %j: correct-answer mode is %s', async (role, correctResponse, correctMode) => {
		const mounted = mountInteraction(SliderInteraction, { interaction: sliderData(), role, correctResponse });
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		expect(q(mounted, '[part="value-card"]')?.classList.contains('qti-slider-correct')).toBe(correctMode);
		expect((input.getAttribute('aria-valuetext') ?? '').includes('Correct answer')).toBe(correctMode);
		// The correct-answer view shows the key on the control itself, so it is read-only there.
		expect(input.disabled).toBe(correctMode);
		// Outside the view the slider is untouched until moved: no value, and no correct answer.
		const valueText = input.getAttribute('aria-valuetext') ?? '';
		expect(valueText).not.toMatch(/undefined|\{answer\}/);
		if (!correctMode) {
			expect(valueText).toBe('No value selected');
			expect(q(mounted, '[part="value-card"]')?.textContent).toContain('No value selected');
		}
	});

	test.each([
		['candidate', 75],
		['candidate', null],
		['scorer', null],
	] as const)('%s, correct response %j: moving the slider emits', async (role, correctResponse) => {
		const mounted = mountInteraction(SliderInteraction, { interaction: sliderData(), role, correctResponse });
		await settle();

		type(q<HTMLInputElement>(mounted, 'input[type="range"]')!, '40');
		await settle();
		expect(mounted.instance.response).toBe(40);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: 40 });
	});

	test('disabled stops the slider for a scorer without a correct response too', async () => {
		const mounted = mountInteraction(SliderInteraction, {
			interaction: sliderData(),
			role: 'scorer',
			correctResponse: null,
			disabled: true,
		});
		await settle();

		const input = q<HTMLInputElement>(mounted, 'input[type="range"]')!;
		expect(input.disabled).toBe(true);
		type(input, '10');
		await settle();
		expect(mounted.events).toHaveLength(0);
	});
});
