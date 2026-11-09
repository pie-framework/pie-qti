import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DefaultI18nProvider } from '@pie-qti/i18n';
import type { ChoiceInteractionData, HottextInteractionData } from '@pie-qti/item-player';
import ChoiceInteraction from '../../src/plugins/choice/ChoiceInteraction.svelte';
import HottextInteraction from '../../src/plugins/hottext/HottextInteraction.svelte';
import {
	check,
	cleanupInteraction,
	mountInteraction,
	pressKey,
	qa,
	q,
	settle,
	type MountedInteraction,
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

/** Every hottext span of the mounted passage, in document order, whatever its role. */
function hottexts(mounted: MountedInteraction): HTMLElement[] {
	return qa<HTMLElement>(mounted, 'hottext');
}

/** The tabindex of every hottext span, in document order. */
function tabStops(mounted: MountedInteraction): Array<string | null> {
	return hottexts(mounted).map((hottext) => hottext.getAttribute('tabindex'));
}

/** Dispatch a keydown like a user's (cancelable, bubbling) and return it for inspection. */
function keydown(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
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
	document.documentElement.removeAttribute('dir');
	document.documentElement.style.direction = '';
});

describe('HottextInteraction (pie-qti-hottext)', () => {
	test('multi-selection renders every hottext span as a keyboard-reachable toggle button', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData({ maxChoices: 2 }) });
		await settle();

		const content = q(mounted, '[part="content"]');
		expect(content?.getAttribute('role')).toBe('group');
		expect(content?.getAttribute('aria-label')).toBe('Text selection interaction');

		const spans = hottexts(mounted);
		expect(spans).toHaveLength(3);
		const expectedNames = ['fern', 'oak', 'rock'];
		spans.forEach((hottext, index) => {
			expect(hottext.getAttribute('role')).toBe('button');
			expect(hottext.getAttribute('tabindex')).toBe('0');
			expect(hottext.getAttribute('aria-pressed')).toBe('false');
			expect(hottext.hasAttribute('aria-checked')).toBe(false);
			// The name comes from the rendered content via aria-labelledby — never a hardcoded
			// English label, and never the state, which aria-pressed carries.
			expect(hottext.getAttribute('aria-label')).toBeNull();
			expect(nameFromLabelledBy(mounted.host, hottext)).toBe(expectedNames[index]);
		});
	});

	test('single selection is a radio group: role="radio" spans with aria-checked, never aria-pressed', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		// The passage container is the radio group and keeps its accessible name.
		const content = q(mounted, '[part="content"]');
		expect(content?.getAttribute('role')).toBe('radiogroup');
		expect(content?.getAttribute('aria-label')).toBe('Text selection interaction');

		const spans = hottexts(mounted);
		expect(spans).toHaveLength(3);
		const expectedNames = ['fern', 'oak', 'rock'];
		spans.forEach((hottext, index) => {
			expect(hottext.getAttribute('role')).toBe('radio');
			expect(hottext.getAttribute('aria-checked')).toBe('false');
			// A toggle button that cannot be unpressed would mislead assistive technology.
			expect(hottext.hasAttribute('aria-pressed')).toBe(false);
			expect(nameFromLabelledBy(mounted.host, hottext)).toBe(expectedNames[index]);
		});
		expect(qa(mounted, '[role="button"]')).toHaveLength(0);
		expect(qa(mounted, '[aria-pressed]')).toHaveLength(0);
	});

	test('the accessible name is the content alone and stays the same as the selection changes (state is aria-checked/aria-pressed)', async () => {
		for (const maxChoices of [1, 2]) {
			const mounted = mountInteraction(HottextInteraction, { interaction: hottextData({ maxChoices }) });
			await settle();

			const [fern, oak] = hottexts(mounted);
			const stateAttribute = maxChoices === 1 ? 'aria-checked' : 'aria-pressed';
			const namesBefore = hottexts(mounted).map((hottext) => nameFromLabelledBy(mounted.host, hottext));
			const labelledByBefore = hottexts(mounted).map((hottext) => hottext.getAttribute('aria-labelledby'));
			oak!.click();
			await settle();

			expect(oak!.getAttribute(stateAttribute)).toBe('true');
			expect(fern!.getAttribute(stateAttribute)).toBe('false');
			// Neither the name nor what it is built from changes with the state.
			expect(hottexts(mounted).map((hottext) => nameFromLabelledBy(mounted.host, hottext))).toEqual(namesBefore);
			expect(hottexts(mounted).map((hottext) => hottext.getAttribute('aria-labelledby'))).toEqual(labelledByBefore);
			expect(namesBefore).toEqual(['fern', 'oak', 'rock']);
			// No state word is rendered anywhere: assistive technology speaks the state once.
			expect(mounted.host.textContent).not.toMatch(/Selectable|\bSelected\b(?!:)/);
			cleanupInteraction(mounted);
		}
	});

	test('an empty hottext is named by its position in reading order, never its identifier, in both modes', async () => {
		const nl = new DefaultI18nProvider('nl');
		await nl.loadLocale('nl');
		for (const maxChoices of [1, 2]) {
			for (const i18n of [undefined, nl]) {
				const mounted = mountInteraction(HottextInteraction, {
					interaction: hottextData({
						maxChoices,
						contentHtml:
							'<p>The <hottext identifier="H1">fern</hottext>, <hottext identifier="EMPTY_IS_CORRECT"></hottext> and the <hottext identifier="H3">rock</hottext>.</p>',
						hottextChoices: [{ identifier: 'H1' }, { identifier: 'EMPTY_IS_CORRECT' }, { identifier: 'H3' }],
					}),
					i18n,
				});
				await settle();

				const empty = hottexts(mounted)[1]!;
				const expected = i18n ? i18n.t('accessibility.choiceFallback', { index: 2 }) : 'Choice 2';
				expect(expected).not.toBe('accessibility.choiceFallback');
				expect(nameFromLabelledBy(mounted.host, empty)).toBe(expected);
				expect(nameFromLabelledBy(mounted.host, empty)).not.toContain('EMPTY_IS_CORRECT');
				// The spans with content keep their own names.
				expect(nameFromLabelledBy(mounted.host, hottexts(mounted)[0]!)).toBe('fern');

				// Still operable, and the name stays put when its state changes.
				empty.click();
				await settle();
				expect(empty.getAttribute(maxChoices === 1 ? 'aria-checked' : 'aria-pressed')).toBe('true');
				expect(nameFromLabelledBy(mounted.host, empty)).toBe(expected);
				cleanupInteraction(mounted);
			}
		}
	});

	test('a hottext whose content is an image is named by that content (its alt), not by the fallback', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({
				contentHtml:
					'<p>Pick <hottext identifier="H1"><img src="leaf.png" alt="a fern leaf"></hottext> or <hottext identifier="H2">oak</hottext>.</p>',
				hottextChoices: [{ identifier: 'H1' }, { identifier: 'H2' }],
			}),
		});
		await settle();

		const image = hottexts(mounted)[0]!;
		expect(image.querySelector('[data-hottext-fallback]')).toBeNull();
		// aria-labelledby points at the rendered content; the browser names it from the img alt.
		const content = mounted.host.querySelector(`#${CSS.escape(image.getAttribute('aria-labelledby') ?? '')}`);
		expect(content?.querySelector('img')?.getAttribute('alt')).toBe('a fern leaf');
	});

	test('clicking a hottext selects it and emits a single-value response', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = hottexts(mounted)[1]!;
		target.click();
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(mounted.events).toHaveLength(1);
		expect(mounted.events[0]!.detail).toMatchObject({ responseId: 'RESPONSE', value: 'H2' });
		expect(target.getAttribute('aria-checked')).toBe('true');
		expect(q(mounted, '[part="footer"]')?.textContent).toContain('1 / 3');
	});

	test('Enter checks the focused hottext', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const target = hottexts(mounted)[0]!;
		pressKey(target, 'Enter');
		await settle();

		expect(mounted.instance.response).toBe('H1');
		expect(target.getAttribute('aria-checked')).toBe('true');
	});

	test('Space checks the focused hottext radio without scrolling the page', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const rock = hottexts(mounted)[2]!;
		rock.focus();
		const space = keydown(rock, ' ');
		await settle();

		expect(space.defaultPrevented).toBe(true);
		expect(mounted.instance.response).toBe('H3');
		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H3']);
		expect(rock.getAttribute('aria-checked')).toBe('true');
		expect(rock.getAttribute('tabindex')).toBe('0');
	});

	test('single selection: re-activating the checked hottext keeps it and emits nothing (click/tap, Enter, Space)', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const fern = hottexts(mounted)[0]!;
		fern.click();
		await settle();
		expect(mounted.instance.response).toBe('H1');
		expect(mounted.events).toHaveLength(1);

		// A radio cannot be unchecked by activating it again: every gesture is a no-op.
		fern.click();
		await settle();
		pressKey(fern, 'Enter');
		await settle();
		pressKey(fern, ' ');
		await settle();

		expect(mounted.instance.response).toBe('H1');
		expect(mounted.events).toHaveLength(1);
		expect(fern.getAttribute('aria-checked')).toBe('true');
		expect(nameFromLabelledBy(mounted.host, fern)).toBe('fern');
		expect(q(mounted, '[part="footer"]')?.textContent).toContain('1 / 3');
	});

	test('single selection switches: selecting another hottext replaces the previous one (radio-like)', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const [fern, oak, rock] = hottexts(mounted);
		fern!.click();
		await settle();
		oak!.click();
		await settle();

		expect(mounted.instance.response).toBe('H2');
		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H1', 'H2']);
		expect(fern!.getAttribute('aria-checked')).toBe('false');
		expect(oak!.getAttribute('aria-checked')).toBe('true');
		expect(nameFromLabelledBy(mounted.host, fern!)).toBe('fern');
		expect(nameFromLabelledBy(mounted.host, oak!)).toBe('oak');
		expect(q(mounted, '[part="footer"]')?.textContent).toContain('1 / 3');
		// Unselected hottexts stay visibly selectable: one more choice is always possible.
		expect(fern!.classList.contains('selectable')).toBe(true);
		// Nothing was refused, so no limit message appears.
		expect(q(mounted, '[role="alert"]')).toBeNull();

		// The keyboard switches the same way.
		pressKey(rock!, 'Enter');
		await settle();
		expect(mounted.instance.response).toBe('H3');
		expect(oak!.getAttribute('aria-checked')).toBe('false');
		expect(rock!.getAttribute('aria-checked')).toBe('true');
	});

	test('single selection: roving tabindex keeps one tab stop — the checked radio, else the first', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		// Nothing checked: Tab enters the group at the first radio.
		expect(tabStops(mounted)).toEqual(['0', '-1', '-1']);

		hottexts(mounted)[2]!.click();
		await settle();
		expect(tabStops(mounted)).toEqual(['-1', '-1', '0']);

		// A restored response puts the tab stop on its radio without emitting anything.
		const restored = mountInteraction(HottextInteraction, { interaction: hottextData(), response: 'H2' });
		await settle();
		expect(tabStops(restored)).toEqual(['-1', '0', '-1']);
		expect(hottexts(restored)[1]!.getAttribute('aria-checked')).toBe('true');
		expect(restored.events).toHaveLength(0);
	});

	test('single selection: arrow keys move focus to the next or previous hottext and check it, wrapping', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const [fern, oak, rock] = hottexts(mounted);
		fern!.focus();

		const right = keydown(fern!, 'ArrowRight');
		await settle();
		expect(right.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(oak);
		expect(mounted.instance.response).toBe('H2');
		expect(oak!.getAttribute('aria-checked')).toBe('true');
		expect(fern!.getAttribute('aria-checked')).toBe('false');
		expect(tabStops(mounted)).toEqual(['-1', '0', '-1']);

		keydown(oak!, 'ArrowDown');
		await settle();
		expect(document.activeElement).toBe(rock);

		// The last radio wraps to the first, and back.
		keydown(rock!, 'ArrowDown');
		await settle();
		expect(document.activeElement).toBe(fern);
		keydown(fern!, 'ArrowLeft');
		await settle();
		expect(document.activeElement).toBe(rock);
		keydown(rock!, 'ArrowUp');
		await settle();
		expect(document.activeElement).toBe(oak);

		expect(mounted.instance.response).toBe('H2');
		// Each move checks the newly focused radio: one change per key, as native radios.
		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H2', 'H3', 'H1', 'H3', 'H2']);
	});

	test('single selection under RTL: ArrowLeft moves forward, ArrowRight moves back, Up/Down unchanged', async () => {
		document.documentElement.setAttribute('dir', 'rtl');
		document.documentElement.style.direction = 'rtl';
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const [fern, oak, rock] = hottexts(mounted);
		fern!.focus();

		keydown(fern!, 'ArrowLeft');
		await settle();
		expect(document.activeElement).toBe(oak);
		expect(mounted.instance.response).toBe('H2');

		keydown(oak!, 'ArrowRight');
		await settle();
		expect(document.activeElement).toBe(fern);
		expect(mounted.instance.response).toBe('H1');

		keydown(fern!, 'ArrowRight');
		await settle();
		expect(document.activeElement).toBe(rock);

		keydown(rock!, 'ArrowDown');
		await settle();
		expect(document.activeElement).toBe(fern);
		keydown(fern!, 'ArrowUp');
		await settle();
		expect(document.activeElement).toBe(rock);

		expect(mounted.events.map((event) => event.detail.value)).toEqual(['H2', 'H1', 'H3', 'H1', 'H3']);
	});

	test('arrow keys held with Alt, Ctrl or Meta are left to the browser and assistive technology', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		const fern = hottexts(mounted)[0]!;
		fern.focus();
		for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
			const event = keydown(fern, 'ArrowRight', { [modifier]: true });
			expect(event.defaultPrevented).toBe(false);
		}
		await settle();

		expect(document.activeElement).toBe(fern);
		expect(mounted.events).toHaveLength(0);
	});

	test('multi-selection keeps its keyboard model: arrow keys neither move focus nor select', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData({ maxChoices: 2 }) });
		await settle();

		const fern = hottexts(mounted)[0]!;
		fern.focus();
		const event = keydown(fern, 'ArrowRight');
		await settle();

		expect(event.defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(fern);
		expect(mounted.events).toHaveLength(0);
		// Every toggle button stays its own tab stop.
		expect(tabStops(mounted)).toEqual(['0', '0', '0']);
	});

	test('multi-selection: activating a selected hottext deselects only that one', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		const targets = hottexts(mounted);
		targets[0]!.click();
		targets[1]!.click();
		await settle();
		expect(targets[0]!.getAttribute('aria-pressed')).toBe('true');
		targets[0]!.click();
		await settle();

		expect(mounted.instance.response).toEqual(['H2']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: ['H2'] });
		// Checkbox-like toggle: the deselected button reports it is no longer pressed.
		expect(targets[0]!.getAttribute('aria-pressed')).toBe('false');
		expect(targets[1]!.getAttribute('aria-pressed')).toBe('true');
	});

	test('multi-selection: a selection refused at the cap changes nothing and emits nothing', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		const targets = hottexts(mounted);
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

		hottexts(second)[0]!.click();
		await settle();

		for (const mounted of [first, second]) {
			const fern = hottexts(mounted)[0]!;
			for (const id of (fern.getAttribute('aria-labelledby') ?? '').split(' ')) {
				expect(mounted.host.contains(document.getElementById(id))).toBe(true);
			}
			// Each span is named from its own interaction's content, whatever the other's state.
			expect(nameFromLabelledBy(mounted.host, fern)).toBe('fern');
		}
		expect(hottexts(first)[0]!.getAttribute('aria-checked')).toBe('false');
		expect(hottexts(second)[0]!.getAttribute('aria-checked')).toBe('true');
		cleanupInteraction(first, second);
	});

	test('clear answer (single): offered only with an answer, clears to null, emits, and returns focus to the first hottext', async () => {
		const mounted = mountInteraction(HottextInteraction, { interaction: hottextData() });
		await settle();

		// No clear control before there is an answer.
		expect(q(mounted, 'button[part="clear"]')).toBeNull();

		const [fern, oak] = hottexts(mounted);
		oak!.click();
		await settle();

		// The same name as choiceInteraction's control with the same function (WCAG 3.2.4).
		const clear = q<HTMLButtonElement>(mounted, 'button[part="clear"]');
		expect(clear?.textContent?.trim()).toBe('Clear answer');
		clear!.focus();
		clear!.click();
		await settle();

		expect(mounted.instance.response).toBeNull();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: null });
		expect(oak!.getAttribute('aria-checked')).toBe('false');
		// The control goes with the answer, and focus moves to the first radio — the group's
		// tab stop now that nothing is checked — instead of dropping to the document.
		expect(q(mounted, 'button[part="clear"]')).toBeNull();
		expect(document.activeElement).toBe(fern);
		expect(tabStops(mounted)).toEqual(['0', '-1', '-1']);
	});

	test('clear answer (multiple): the same control clears to an empty list and keeps focus on the first hottext', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		expect(q(mounted, 'button[part="clear"]')).toBeNull();
		const [fern, , rock] = hottexts(mounted);
		fern!.click();
		rock!.click();
		await settle();
		expect(mounted.instance.response).toEqual(['H1', 'H3']);

		const clear = q<HTMLButtonElement>(mounted, 'button[part="clear"]');
		expect(clear?.textContent?.trim()).toBe('Clear answer');
		clear!.focus();
		clear!.click();
		await settle();

		expect(mounted.instance.response).toEqual([]);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ value: [] });
		expect(q(mounted, 'button[part="clear"]')).toBeNull();
		// The clear control removed itself with the selection: focus lands on the first
		// hottext element, the interaction's surviving control.
		expect(document.activeElement).toBe(fern);
	});

	test('disabled hottexts are unavailable: not focusable, ignore activation and offer no clear control', async () => {
		for (const maxChoices of [1, 2]) {
			const mounted = mountInteraction(HottextInteraction, {
				interaction: hottextData({ maxChoices }),
				response: maxChoices === 1 ? 'H1' : ['H1'],
				disabled: true,
			});
			await settle();

			const spans = hottexts(mounted);
			expect(tabStops(mounted)).toEqual(['-1', '-1', '-1']);
			for (const hottext of spans) {
				expect(hottext.getAttribute('aria-disabled')).toBe('true');
			}
			spans[1]!.click();
			pressKey(spans[1]!, 'Enter');
			pressKey(spans[0]!, ' ');
			pressKey(spans[0]!, 'ArrowRight');
			await settle();

			expect(mounted.instance.response).toEqual(maxChoices === 1 ? 'H1' : ['H1']);
			expect(mounted.events).toHaveLength(0);
			// The read-only state still shows the answer.
			expect(spans[0]!.classList.contains('selected')).toBe(true);
			// Nothing to operate: no clear control while disabled, as in choiceInteraction.
			expect(qa(mounted, 'button')).toHaveLength(0);
			cleanupInteraction(mounted);
		}
	});

	test('multi-selection mode answers with the array of selected identifiers', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
		});
		await settle();

		const targets = hottexts(mounted);
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

		const targets = hottexts(mounted);
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

		hottexts(mounted)[0]!.click();
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

		const [fern, oak] = hottexts(mounted);
		expect(oak!.classList.contains('correct')).toBe(true);
		// Non-color indicator: an sr-only "Correct answer" phrase joins the accessible name.
		expect(nameFromLabelledBy(mounted.host, oak!)).toBe('oak Correct answer: oak.');
		// The other hottexts carry no correct marker.
		expect(nameFromLabelledBy(mounted.host, fern!)).toBe('fern');
	});

	test('review (disabled scorer view) keeps the candidate answer and the correct-answer marker', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData(),
			role: 'scorer',
			correctResponse: 'H2',
			response: 'H1',
			disabled: true,
		});
		await settle();

		const [fern, oak] = hottexts(mounted);
		expect(fern!.getAttribute('role')).toBe('radio');
		expect(fern!.getAttribute('aria-checked')).toBe('true');
		expect(fern!.classList.contains('selected')).toBe(true);
		expect(oak!.classList.contains('correct')).toBe(true);
		expect(nameFromLabelledBy(mounted.host, oak!)).toBe('oak Correct answer: oak.');
		expect(tabStops(mounted)).toEqual(['-1', '-1', '-1']);
		expect(qa(mounted, 'button')).toHaveLength(0);
	});
});

describe('HottextInteraction clear control names the same function as choiceInteraction', () => {
	let nl: DefaultI18nProvider;

	beforeAll(async () => {
		nl = new DefaultI18nProvider('nl');
		await nl.loadLocale('nl');
	});

	const choiceData: ChoiceInteractionData = {
		type: 'choiceInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		maxChoices: 1,
		minChoices: 0,
		prompt: '<p>Which one is a fruit?</p>',
		choices: [
			{ identifier: 'A', text: '<p>Alpha</p>' },
			{ identifier: 'B', text: '<p>Beta</p>' },
		],
	};

	test('one localized label for "Clear answer" in both interactions and both hottext cardinalities', async () => {
		const choice = mountInteraction(ChoiceInteraction, { interaction: choiceData, i18n: nl });
		const single = mountInteraction(HottextInteraction, { interaction: hottextData(), i18n: nl });
		const multiple = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
			i18n: nl,
		});
		await settle();

		check(q<HTMLInputElement>(choice, 'input[type="radio"]')!, true);
		hottexts(single)[0]!.click();
		hottexts(multiple)[0]!.click();
		await settle();

		const label = (mounted: MountedInteraction) => q(mounted, 'button[part="clear"]')?.textContent?.trim();
		expect(label(choice)).toBe(nl.t('interactions.choice.clearAnswer'));
		expect(label(choice)).not.toBe('Clear answer');
		expect(label(single)).toBe(label(choice));
		expect(label(multiple)).toBe(label(choice));
		cleanupInteraction(choice, single, multiple);
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

	test('hottext spans stay inline in the running text, whatever their role', () => {
		const spanCss = source.slice(source.indexOf(':global(.hottext-content hottext),'));
		expect(spanCss.slice(0, spanCss.indexOf('}'))).toContain('display: inline;');
	});
});

// createInteractionShell's rule: correct-answer mode is the scorer's view of an item that has a
// correct response. Hosts pass null when the item declares none; a scorer then sees the
// interaction as a candidate does. Only `disabled` stops interaction.
describe('HottextInteraction correct-answer mode: role × correct response', () => {
	test.each([
		['candidate', ['H2'], false],
		['candidate', null, false],
		['scorer', ['H2'], true],
		['scorer', null, false],
	] as const)('%s, correct response %j: correct-answer mode is %s, and selecting emits', async (role, correctResponse, correctMode) => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
			role,
			correctResponse,
		});
		await settle();

		const [fern, oak] = hottexts(mounted);
		expect(oak!.classList.contains('correct')).toBe(correctMode);
		expect(q(mounted, '[data-hottext-correct]') !== null).toBe(correctMode);

		fern!.click();
		await settle();
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['H1'] });
		cleanupInteraction(mounted);
	});

	test('disabled stops selection for a scorer without a correct response too', async () => {
		const mounted = mountInteraction(HottextInteraction, {
			interaction: hottextData({ maxChoices: 2 }),
			role: 'scorer',
			correctResponse: null,
			disabled: true,
		});
		await settle();

		hottexts(mounted)[0]!.click();
		await settle();
		expect(mounted.events).toHaveLength(0);
		cleanupInteraction(mounted);
	});
});
