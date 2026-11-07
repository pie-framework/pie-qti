import { afterEach, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HottextInteractionData } from '@pie-qti/item-player';
import HottextInteraction from '../../src/plugins/hottext/HottextInteraction.svelte';
import {
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
} from './helpers';

function hottextData(overrides: Partial<HottextInteractionData> = {}): HottextInteractionData {
	return {
		type: 'hottextInteraction',
		responseId: 'RESPONSE',
		prompt: '<p>Click the plants.</p>',
		maxChoices: 1,
		minChoices: 0,
		contentHtml:
			'<p>The <hottext identifier="H1">fern</hottext> and the <hottext identifier="H2">oak</hottext> are plants; a <hottext identifier="H3">rock</hottext> is not.</p>',
		hottextChoices: [
			{ identifier: 'H1' },
			{ identifier: 'H2' },
			{ identifier: 'H3' },
		],
		...overrides,
	};
}

/** Compose the accessible name a screen reader builds from aria-labelledby. */
function nameFromLabelledBy(host: HTMLElement, element: Element): string {
	const ids = (element.getAttribute('aria-labelledby') ?? '').split(' ').filter(Boolean);
	return ids
		.map((id) => host.querySelector(`#${CSS.escape(id)}`)?.textContent?.trim())
		.filter(Boolean)
		.join(' ');
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

describe('HottextInteraction (pie-qti-hottext)', () => {
	test('renders every hottext span as a keyboard-reachable button', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const hottexts = qa(mounted, '[role="button"]');
		expect(hottexts).toHaveLength(3);
		const expectedNames = ['fern Selectable', 'oak Selectable', 'rock Selectable'];
		hottexts.forEach((hottext, index) => {
			expect(hottext.getAttribute('tabindex')).toBe('0');
			expect(hottext.getAttribute('aria-pressed')).toBe('false');
			// The name comes from the rendered content plus a localized state word via
			// aria-labelledby — never a hardcoded English label.
			expect(hottext.getAttribute('aria-label')).toBeNull();
			expect(nameFromLabelledBy(mounted.host, hottext)).toBe(expectedNames[index]);
		});
	});

	test('the localized state word in the name follows the selection', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[1]!;
		target.click();
		await settle();

		expect(target.getAttribute('aria-pressed')).toBe('true');
		expect(nameFromLabelledBy(mounted.host, target)).toBe('oak Selected');
		expect(nameFromLabelledBy(mounted.host, qa(mounted, '[role="button"]')[0]!)).toBe('fern Selectable');
	});

	test('clicking a hottext selects it and emits a single-value response', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[1]!;
		target.click();
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 'H2' });
		expect(target.getAttribute('aria-pressed')).toBe('true');
		expect(q(mounted, '[part="footer"]')?.textContent).toContain('1 / 3');
	});

	test('Enter activates the focused hottext', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[0]!;
		pressKey(target, 'Enter');
		await settle();

		expect(mounted.instance.response).toBe('H1');
		expect(target.getAttribute('aria-pressed')).toBe('true');
	});

	test('Space activates the focused hottext', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[2]!;
		pressKey(target, ' ');
		await settle();

		expect(mounted.instance.response).toBe('H3');
	});

	test('activating a selected hottext deselects it and reports the cleared response', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = qa(mounted, '[role="button"]')[0]!;
		target.click();
		await settle();
		target.click();
		await settle();

		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: null });
		expect(target.getAttribute('aria-pressed')).toBe('false');
	});

	test('single selection switches: selecting another hottext replaces the previous one (radio-like)', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const [fern, oak, rock] = qa<HTMLElement>(mounted, '[role="button"]');
		fern!.click();
		await settle();
		oak!.click();
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H1', 'H2']);
		expect(fern!.getAttribute('aria-pressed')).toBe('false');
		expect(oak!.getAttribute('aria-pressed')).toBe('true');
		expect(nameFromLabelledBy(mounted.host, fern!)).toBe('fern Selectable');
		expect(nameFromLabelledBy(mounted.host, oak!)).toBe('oak Selected');
		expect(q(mounted, '[part="footer"]')?.textContent).toContain('1 / 3');
		// Unselected hottexts stay visibly selectable: one more choice is always possible.
		expect(fern!.classList.contains('selectable')).toBe(true);
		// Nothing was refused, so no limit message appears.
		expect(q(mounted, '[role="alert"]')).toBeNull();

		// The keyboard switches the same way.
		pressKey(rock!, 'Enter');
		await settle();
		expect(mounted.instance.response).toBe('H3');
		expect(oak!.getAttribute('aria-pressed')).toBe('false');
		expect(rock!.getAttribute('aria-pressed')).toBe('true');
	});

	test('multi-selection: activating a selected hottext deselects only that one', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		const targets = qa(mounted, '[role="button"]');
		targets[0]!.click();
		targets[1]!.click();
		await settle();
		targets[0]!.click();
		await settle();

		expect(mounted.instance.response).toEqual(['H2']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: ['H2'] });
	});

	test('multi-selection: a selection refused at the cap changes nothing and emits nothing', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		const targets = qa(mounted, '[role="button"]');
		targets[0]!.click();
		targets[1]!.click();
		await settle();
		const eventsAtCap = mounted.events.length;

		targets[2]!.click();
		await settle();

		expect(mounted.instance.response).toEqual(['H1', 'H2']);
		expect(mounted.events).toHaveLength(eventsAtCap);
		expect(targets[2]!.getAttribute('aria-pressed')).toBe('false');
		expect(targets[2]!.classList.contains('selectable')).toBe(false);
	});

	test('two hottext interactions in one document keep instance-unique name ids', async () => {
		const first = mountInteraction(HottextInteraction, { interaction: hottextData() });
		const second = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);

		qa(second, '[role="button"]')[0]!.click();
		await settle();

		for (const [mounted, firstName] of [
			[first, 'fern Selectable'],
			[second, 'fern Selected'],
		] as const) {
			const fern = qa(mounted, '[role="button"]')[0]!;
			for (const id of (fern.getAttribute('aria-labelledby') ?? '').split(' ')) {
				expect(mounted.host.contains(document.getElementById(id))).toBe(true);
			}
			expect(nameFromLabelledBy(mounted.host, fern)).toBe(firstName);
		}
		cleanupInteraction(first, second);
	});

	test('clear selection resets the state and emits the cleared response', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		qa(mounted, '[role="button"]')[0]!.click();
		await settle();
		const clear = q(mounted, '[part="footer"] button');
		clear?.click();
		await settle();

		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: null });
	});

	test('disabled hottexts are not focusable and ignore activation', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData(),
			disabled: true,
		});
		await settle();

		const target = qa(mounted, '[role="button"]')[0]!;
		expect(target.getAttribute('tabindex')).toBe('-1');
		target.click();
		pressKey(target, 'Enter');
		await settle();

		expect(mounted.instance.response).toBeUndefined();
		expect(mounted.events).toHaveLength(0);
	});

	test('multi-selection mode answers with the array of selected identifiers', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		const targets = qa(mounted, '[role="button"]');
		targets[0]!.click();
		targets[1]!.click();
		await settle();

		expect(mounted.instance.response).toEqual(['H1', 'H2']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: ['H1', 'H2'] });

		// maxChoices caps further selection
		targets[2]!.click();
		await settle();
		expect(mounted.instance.response).toEqual(['H1', 'H2']);
	});

	test('a refused selection is announced with a localized default when no message is authored', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		expect(q(mounted, '[role="alert"]')).toBeNull();

		const targets = qa(mounted, '[role="button"]');
		targets[0]!.click();
		targets[1]!.click();
		await settle();

		const alert = q(mounted, '[role="alert"]');
		expect(alert?.textContent).toContain('You can select up to 2. Deselect one to choose another.');
	});

	test('the authored max-selections message wins over the default', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 1, maxSelectionsMessage: 'Only one phrase allowed' }),
		});
		await settle();

		qa(mounted, '[role="button"]')[0]!.click();
		await settle();

		expect(q(mounted, '[role="alert"]')?.textContent).toContain('Only one phrase allowed');
	});

	test('scorer view marks correct hottexts beyond color: hidden text in the name plus underline style', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData(),
			role: 'scorer',
			correctResponse: 'H2',
		});
		await settle();

		const correct = qa(mounted, '[role="button"]')[1]!;
		expect(correct.classList.contains('correct')).toBe(true);
		// Non-color indicator: an sr-only "Correct answer" phrase joins the accessible name.
		expect(nameFromLabelledBy(mounted.host, correct)).toBe('oak Selectable Correct answer: oak.');
		// The other hottexts carry no correct marker.
		expect(nameFromLabelledBy(mounted.host, qa(mounted, '[role="button"]')[0]!)).toBe('fern Selectable');
	});
});

// jsdom does not compute shadow styles, so the CSS contracts are asserted against
// the component source (same approach as tests/pnp-styles.test.ts).
describe('HottextInteraction style contracts', () => {
	const source = readFileSync(resolve(process.cwd(), 'src/plugins/hottext/HottextInteraction.svelte'), 'utf8');

	test('focus stays visible even with hidden input controls (WCAG 2.4.7)', () => {
		expect(source).toContain('outline: 2px solid var(--pie-qti-focus, #4338ca)');
		expect(source).not.toContain('outline: none');
	});

	test('the selectable cue uses the border-strong token (WCAG 1.4.11)', () => {
		const selectableCss = source.slice(source.indexOf('hottext.selectable),'), source.indexOf('hottext.selectable:hover)'));
		expect(selectableCss).toContain('var(--pie-qti-border-strong, #767676)');
	});

	test('the selection limit message uses the warning-text token (WCAG 1.4.3)', () => {
		expect(source).toContain('color: var(--pie-qti-warning-text, #92400e)');
	});
});
