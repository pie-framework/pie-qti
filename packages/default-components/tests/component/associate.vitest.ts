import { DefaultI18nProvider } from '@pie-qti/i18n';
import { afterEach, describe, expect, test } from 'vitest';
import AssociateInteraction from '../../src/plugins/associate/AssociateInteraction.svelte';
import type { AssociateInteractionData } from '@pie-qti/item-player';
import {
	cleanupInteraction,
	mountInteraction,
	qa,
	q,
	settle,
} from './helpers';

function associateData(overrides: Partial<AssociateInteractionData> = {}): AssociateInteractionData {
	return {
		type: 'associateInteraction',
		responseId: 'RESPONSE',
		shuffle: false,
		maxAssociations: 0,
		prompt: '<p>Pair each capital with its country.</p>',
		choices: [
			{ identifier: 'A_cap', text: '<p>Paris</p>', matchMax: 1 },
			{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1 },
			{ identifier: 'B_cap', text: '<img src="rome.png" alt="Rome skyline">', matchMax: 1 },
			{ identifier: 'B_country', text: '<p>Italy</p>', matchMax: 1 },
		],
		...overrides,
	};
}

afterEach(() => {
	for (const node of Array.from(document.body.children)) node.remove();
});

function choiceButtons(mounted: { host: HTMLElement }): HTMLButtonElement[] {
	return qa<HTMLButtonElement>(mounted, '[part="choice"]');
}

describe('AssociateInteraction (pie-qti-associate)', () => {
	test('choices are named by their rendered rich content, never by identifier', async () => {
		const mounted = mountInteraction(AssociateInteraction, { interaction: associateData() });
		await settle();

		for (const button of choiceButtons(mounted)) {
			// Raw QTI identifiers can leak answers to screen reader users, so they
			// must not appear in the accessible name (WCAG 4.1.2).
			expect(button.hasAttribute('aria-label')).toBe(false);
			const named = document.getElementById(button.getAttribute('aria-labelledby') ?? '');
			expect(named?.textContent ?? '').not.toMatch(/A_cap|A_country|B_cap|B_country/);
		}

		// The image choice's alt participates in the name element.
		const imageChoice = choiceButtons(mounted)[2]!;
		const named = document.getElementById(imageChoice.getAttribute('aria-labelledby') ?? '');
		expect(named?.querySelector('img')?.getAttribute('alt')).toBe('Rome skyline');
		cleanupInteraction(mounted);
	});

	test('a textless choice is named by a localized ordinal, never its identifier', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData({
				choices: [
					{ identifier: 'SECRET_KEY', text: '<img src="x.png">', matchMax: 1 },
					{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1 },
				],
			}),
		});
		await settle();

		// The image has no alt and nothing else to read: the button still carries a
		// non-empty name, and it is the presented position — not the identifier,
		// which can leak the answer key to screen reader users (WCAG 4.1.2).
		const textless = choiceButtons(mounted)[0]!;
		const name = textless.getAttribute('aria-label') ?? '';
		expect(name).toBe('Choice 1');
		expect(name).not.toContain('SECRET_KEY');
		expect(textless.hasAttribute('aria-labelledby')).toBe(false);

		// An authored label still wins: the content-ful choice is named by its
		// rendered content through aria-labelledby, with no aria-label on top.
		const labelled = choiceButtons(mounted)[1]!;
		const named = document.getElementById(labelled.getAttribute('aria-labelledby') ?? '');
		expect(named?.textContent?.trim()).toBe('France');
		expect(labelled.hasAttribute('aria-label')).toBe(false);
		cleanupInteraction(mounted);
	});

	test('removing a pair with a textless choice announces its ordinal, not its identifier', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData({
				choices: [
					{ identifier: 'SECRET_KEY', text: '<img src="x.png">', matchMax: 1 },
					{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1 },
				],
			}),
			response: ['SECRET_KEY A_country'],
		});
		await settle();

		// The remove control is named by the same names the choices carry.
		const remove = q<HTMLButtonElement>(mounted, '[part="pair-remove"]')!;
		expect(remove.getAttribute('aria-label')).toBe('Remove association between Choice 1 and France');

		remove.click();
		await settle();
		expect(q(mounted, '.qti-associate-live-region')?.textContent?.trim()).toBe(
			'Removed association between Choice 1 and France.',
		);
		expect(mounted.instance.response).toEqual([]);
		cleanupInteraction(mounted);
	});

	test('a choice limit refusal announces the textless choice by ordinal, not identifier', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData({
				choices: [
					{ identifier: 'SECRET_KEY', text: '<img src="x.png">', matchMax: 1 },
					{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1 },
				],
			}),
			response: ['SECRET_KEY A_country'],
		});
		await settle();

		const live = q(mounted, '.qti-associate-live-region');
		choiceButtons(mounted)[0]!.click();
		await settle();
		expect(mounted.events).toHaveLength(0);
		expect(live?.textContent?.trim()).toBe('Not possible: Choice 1 cannot be in more associations.');
		cleanupInteraction(mounted);
	});

	test('selecting two choices creates the pair and emits qti-change', async () => {
		const mounted = mountInteraction(AssociateInteraction, { interaction: associateData() });
		await settle();

		const buttons = choiceButtons(mounted);
		buttons[0].click();
		await settle();
		expect(buttons[0].getAttribute('aria-pressed')).toBe('true');

		buttons[1].click();
		await settle();

		expect(mounted.instance.response).toEqual(['A_cap A_country']);
		expect(mounted.events.at(-1)?.detail).toMatchObject({ responseId: 'RESPONSE', value: ['A_cap A_country'] });
		cleanupInteraction(mounted);
	});

	test('paired choices expose the state sentence and a remove control named without identifiers', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			response: ['A_cap A_country'],
		});
		await settle();

		// The state sentence sits in the describedby target of the paired choice.
		const paired = choiceButtons(mounted)[0]!;
		const stateElement = document.getElementById(paired.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '');
		expect(stateElement?.textContent?.trim()).toBe('In an association.');

		// An unpaired choice has no state sentence (Svelte prints a bare `false`).
		const unpaired = choiceButtons(mounted)[2]!;
		const emptyState = document.getElementById(unpaired.getAttribute('aria-describedby')?.split(' ').at(-1) ?? '');
		expect(emptyState?.textContent?.trim()).toBe('');

		const remove = q<HTMLButtonElement>(mounted, '[part="pair-remove"]');
		expect(remove?.getAttribute('aria-label')).toBe('Remove association between Paris and France');

		remove?.click();
		await settle();
		expect(mounted.instance.response).toEqual([]);
		cleanupInteraction(mounted);
	});

	test('the pair-remove control carries its own 44px sizing, not DaisyUI classes', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			response: ['A_cap A_country'],
		});
		await settle();

		const remove = q<HTMLButtonElement>(mounted, '[part="pair-remove"]')!;
		// Svelte injects the component stylesheet into the document head; assert the
		// shipped rule, since jsdom performs no layout.
		const styles = Array.from(document.querySelectorAll('style'), (style) => style.textContent ?? '').join('\n');
		expect(styles).toMatch(/\.qti-associate-pair-remove[^{]*\{/);
		expect(styles).toContain('inline-size: 44px');
		expect(styles).toContain('block-size: 44px');
		expect(remove.classList.contains('btn')).toBe(false);
		cleanupInteraction(mounted);
	});

	test('removing a pair keeps focus on the pair list, or returns it to the choices', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			response: ['A_cap A_country', 'B_cap B_country'],
		});
		await settle();

		const removes = qa<HTMLButtonElement>(mounted, '[part="pair-remove"]');
		expect(removes).toHaveLength(2);
		removes[0]!.focus();
		removes[0]!.click();
		await settle();

		// The pair that moved into row 0 (Rome – Italy) now holds focus.
		expect(mounted.instance.response).toEqual(['B_cap B_country']);
		expect(document.activeElement).toBe(q(mounted, '[part="pair-remove"]'));
		expect(q(mounted, '[part="pair-remove"]')?.getAttribute('aria-label')).toBe(
			'Remove association between Rome skyline and Italy',
		);

		// Removing the last pair sends focus back to the choices.
		q<HTMLButtonElement>(mounted, '[part="pair-remove"]')!.click();
		await settle();
		expect(mounted.instance.response).toEqual([]);
		expect(document.activeElement).toBe(choiceButtons(mounted)[0]);
		cleanupInteraction(mounted);
	});

	test('two renderings of the same item keep their own helper ids', async () => {
		const first = mountInteraction(AssociateInteraction, { interaction: associateData() });
		const second = mountInteraction(AssociateInteraction, { interaction: associateData() });
		await settle();

		const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
		expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
		for (const mounted of [first, second]) {
			const helper = q(mounted, '[part="helper"]')!;
			const describedBy = q(mounted, '[part="choice"]')?.getAttribute('aria-describedby') ?? '';
			expect(describedBy.split(/\s+/)).toContain(helper.id);
			expect(mounted.host.contains(document.getElementById(helper.id))).toBe(true);
		}
		cleanupInteraction(first, second);
	});

	test('choices never reference the helper while it is hidden for correct answers', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			role: 'scorer',
			correctResponse: ['A_cap A_country'],
		});
		await settle();

		expect(q(mounted, '[part="helper"]')).toBeNull();
		for (const button of choiceButtons(mounted)) {
			for (const id of (button.getAttribute('aria-describedby') ?? '').split(/\s+/)) {
				expect(document.getElementById(id)).not.toBeNull();
			}
		}
		cleanupInteraction(mounted);
	});

	test('removing a pair is announced politely with readable names, and focus still moves on', async () => {
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			response: ['B_cap B_country', 'A_cap A_country'],
		});
		await settle();

		const live = q(mounted, '.qti-associate-live-region');
		expect(live?.getAttribute('aria-live')).toBe('polite');
		expect(live?.getAttribute('aria-atomic')).toBe('true');
		expect(live?.textContent?.trim()).toBe('');

		const removes = qa<HTMLButtonElement>(mounted, '[part="pair-remove"]');
		removes[0]!.focus();
		removes[0]!.click();
		await settle();

		// Names come from accessibleTextFromHtml: the image's alt text, never an identifier.
		expect(live?.textContent?.trim()).toBe('Removed association between Rome skyline and Italy.');
		expect(mounted.instance.response).toEqual(['A_cap A_country']);
		// The focus behavior is kept: focus moves to the pair now in the removed row.
		expect(document.activeElement).toBe(q(mounted, '[part="pair-remove"]'));
		cleanupInteraction(mounted);
	});

	test('removing the same pair again re-announces the removal', async () => {
		const mounted = mountInteraction(AssociateInteraction, { interaction: associateData() });
		await settle();
		const live = q(mounted, '.qti-associate-live-region')!;
		const pairThenRemove = async () => {
			const [paris, france] = choiceButtons(mounted);
			paris!.click();
			await settle();
			france!.click();
			await settle();
			q<HTMLButtonElement>(mounted, '[part="pair-remove"]')!.click();
			await settle();
		};

		await pairThenRemove();
		const firstText = live.textContent;
		expect(firstText?.trim()).toBe('Removed association between Paris and France.');

		await pairThenRemove();
		// The same message must still be a text change, or the live region stays silent: a toggled
		// zero-width space (not read by screen readers) makes it one.
		expect(mounted.instance.response).toEqual([]);
		expect(live.textContent).not.toBe(firstText);
		expect(live.textContent?.replace(/\u200b/g, '').trim()).toBe('Removed association between Paris and France.');
		cleanupInteraction(mounted);
	});

	test('the removal announcement is localized', async () => {
		const nl = new DefaultI18nProvider('nl');
		await nl.loadLocale('nl');
		const mounted = mountInteraction(AssociateInteraction, {
			interaction: associateData(),
			response: ['A_cap A_country'],
			i18n: nl,
		});
		await settle();

		q<HTMLButtonElement>(mounted, '[part="pair-remove"]')!.click();
		await settle();

		expect(q(mounted, '.qti-associate-live-region')?.textContent?.trim()).toBe(
			'Associatie tussen Paris en France verwijderd.',
		);
		cleanupInteraction(mounted);
	});

	describe('matchGroup (the rule response validation applies)', () => {
		test('matchGroup lists partner identifiers: the named partner pairs, others stay inert', async () => {
			// QTI 2.2/3.0: matchGroup is the list of identifiers a choice may be matched with.
			// The former label-only rule blocked Paris–France here ([A_country] and [A_cap] share no token).
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({
					choices: [
						{ identifier: 'A_cap', text: '<p>Paris</p>', matchMax: 1, matchGroup: ['A_country'] },
						{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1, matchGroup: ['A_cap'] },
						{ identifier: 'B_cap', text: '<p>Rome</p>', matchMax: 1, matchGroup: ['B_country'] },
						{ identifier: 'B_country', text: '<p>Italy</p>', matchMax: 1, matchGroup: ['B_cap'] },
					],
				}),
			});
			await settle();

			const [paris, france, rome] = choiceButtons(mounted);
			paris!.click();
			await settle();
			expect(france!.getAttribute('aria-disabled')).toBeNull();
			expect(rome!.getAttribute('aria-disabled')).toBe('true');

			// A blocked partner cannot complete the pair.
			rome!.click();
			await settle();
			expect(mounted.events).toHaveLength(0);

			france!.click();
			await settle();
			expect(mounted.instance.response).toEqual(['A_cap A_country']);
			cleanupInteraction(mounted);
		});

		test('activating a matchGroup-incompatible choice announces why it did nothing (round 8)', async () => {
			// aria-disabled states availability, but an activation that silently does
			// nothing gives the screen reader no reason (WCAG 4.1.3): the refusal is
			// announced through the polite region, like every sibling pairing surface.
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({
					choices: [
						{ identifier: 'A_cap', text: '<p>Paris</p>', matchMax: 1, matchGroup: ['A_country'] },
						{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1, matchGroup: ['A_cap'] },
						{ identifier: 'B_cap', text: '<p>Rome</p>', matchMax: 1, matchGroup: ['B_country'] },
						{ identifier: 'B_country', text: '<p>Italy</p>', matchMax: 1, matchGroup: ['B_cap'] },
					],
				}),
			});
			await settle();

			const [paris, france, rome] = choiceButtons(mounted);
			paris!.click();
			await settle();
			const live = q(mounted, '.qti-associate-live-region');

			rome!.click();
			await settle();
			expect(mounted.events).toHaveLength(0);
			expect(live?.textContent?.trim()).toBe('Not available due to a match group restriction.');
			// The pending selection survives the refusal: the compatible partner still pairs.
			expect(paris!.getAttribute('aria-pressed')).toBe('true');

			france!.click();
			await settle();
			expect(mounted.instance.response).toEqual(['A_cap A_country']);
			cleanupInteraction(mounted);
		});

		test('tokens shared as group labels still pair (AC-E4)', async () => {
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({
					choices: [
						{ identifier: 'A', text: '<p>A</p>', matchMax: 1, matchGroup: ['set-a'] },
						{ identifier: 'B', text: '<p>B</p>', matchMax: 1, matchGroup: ['set-a'] },
						{ identifier: 'C', text: '<p>C</p>', matchMax: 1, matchGroup: ['set-b'] },
						{ identifier: 'D', text: '<p>D</p>', matchMax: 1, matchGroup: ['set-b'] },
					],
				}),
			});
			await settle();

			const [a, b, c, d] = choiceButtons(mounted);
			a!.click();
			await settle();
			expect(b!.getAttribute('aria-disabled')).toBeNull();
			expect(c!.getAttribute('aria-disabled')).toBe('true');
			expect(d!.getAttribute('aria-disabled')).toBe('true');
			cleanupInteraction(mounted);
		});
	});

	describe('association caps (QTI maxAssociations and per-choice matchMax)', () => {
		test('interaction cap reached: pairing is refused, announced, and choices are aria-disabled but focusable', async () => {
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({
					maxAssociations: 2,
					choices: [
						{ identifier: 'A_cap', text: '<p>Paris</p>', matchMax: 0 },
						{ identifier: 'A_country', text: '<p>France</p>', matchMax: 0 },
						{ identifier: 'B_cap', text: '<p>Rome</p>', matchMax: 0 },
						{ identifier: 'B_country', text: '<p>Italy</p>', matchMax: 0 },
					],
				}),
				response: ['A_cap A_country', 'B_cap B_country'],
			});
			await settle();

			// Every choice is maxed while the interaction cap holds, but none is disabled:
			// the refusal happens in the handler so focus never falls off the control.
			for (const button of choiceButtons(mounted)) {
				expect(button.getAttribute('aria-disabled')).toBe('true');
				expect(button.disabled).toBe(false);
			}

			const live = q(mounted, '.qti-associate-live-region');
			expect(live?.textContent?.trim()).toBe('');

			const [paris] = choiceButtons(mounted);
			paris!.click();
			await settle();
			expect(mounted.events).toHaveLength(0);
			expect(mounted.instance.response).toEqual(['A_cap A_country', 'B_cap B_country']);
			expect(paris!.getAttribute('aria-pressed')).toBe('false');
			expect(live?.textContent?.trim()).toBe('Association not possible: the limit of 2 is reached.');
			cleanupInteraction(mounted);
		});

		test('below the cap nothing extra is refused or disabled', async () => {
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({ maxAssociations: 3 }),
				response: ['A_cap A_country'],
			});
			await settle();

			// Paris and France are each maxed (matchMax 1, both already used); Rome and Italy are not.
			const [paris, france, rome, italy] = choiceButtons(mounted);
			expect(paris!.getAttribute('aria-disabled')).toBe('true');
			expect(france!.getAttribute('aria-disabled')).toBe('true');
			expect(rome!.getAttribute('aria-disabled')).toBeNull();
			expect(italy!.getAttribute('aria-disabled')).toBeNull();

			rome!.click();
			await settle();
			italy!.click();
			await settle();
			expect(mounted.instance.response).toEqual(['A_cap A_country', 'B_cap B_country']);
			cleanupInteraction(mounted);
		});

		test('per-choice matchMax: a maxed choice is refused by name and aria-disabled', async () => {
			// Paris may be used once and already is; France may be used twice.
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({
					maxAssociations: 0,
					choices: [
						{ identifier: 'A_cap', text: '<p>Paris</p>', matchMax: 1 },
						{ identifier: 'A_country', text: '<p>France</p>', matchMax: 2 },
						{ identifier: 'B_cap', text: '<p>Rome</p>', matchMax: 0 },
						{ identifier: 'B_country', text: '<p>Italy</p>', matchMax: 0 },
					],
				}),
				response: ['A_cap A_country'],
			});
			await settle();

			const [paris, france, rome, italy] = choiceButtons(mounted);
			expect(paris!.getAttribute('aria-disabled')).toBe('true');
			expect(france!.getAttribute('aria-disabled')).toBeNull();
			expect(rome!.getAttribute('aria-disabled')).toBeNull();

			const live = q(mounted, '.qti-associate-live-region');
			paris!.click();
			await settle();
			expect(mounted.events).toHaveLength(0);
			expect(live?.textContent?.trim()).toBe('Not possible: Paris cannot be in more associations.');

			// An unmaxed choice still pairs.
			rome!.click();
			await settle();
			italy!.click();
			await settle();
			expect(mounted.instance.response).toEqual(['A_cap A_country', 'B_cap B_country']);
			cleanupInteraction(mounted);
		});

		test('completing a pair is refused when the pending choice would exceed its matchMax', async () => {
			// The pending selection arrived externally (selectedForPairing prop), so the
			// selection-time guard never ran: the pair-completion guard must refuse instead —
			// the same rule MatchDragDrop applies per input method. France may be used once
			// and already is.
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({
					maxAssociations: 0,
					choices: [
						{ identifier: 'A_cap', text: '<p>Paris</p>', matchMax: 0 },
						{ identifier: 'A_country', text: '<p>France</p>', matchMax: 1 },
						{ identifier: 'B_cap', text: '<p>Rome</p>', matchMax: 0 },
						{ identifier: 'B_country', text: '<p>Italy</p>', matchMax: 0 },
					],
				}),
				response: ['A_cap A_country'],
				selectedForPairing: 'A_country',
			});
			await settle();

			const live = q(mounted, '.qti-associate-live-region');
			const [, , rome, italy] = choiceButtons(mounted);
			rome!.click();
			await settle();
			expect(mounted.events).toHaveLength(0);
			expect(mounted.instance.response).toEqual(['A_cap A_country']);
			expect(live?.textContent?.trim()).toBe('Not possible: France cannot be in more associations.');

			// France stays pending: no partner can take it past its matchMax, so every
			// pairing attempt is refused until the selection changes.
			italy!.click();
			await settle();
			expect(mounted.events).toHaveLength(0);
			expect(mounted.instance.response).toEqual(['A_cap A_country']);
			cleanupInteraction(mounted);
		});

		test('a choice held as pending when the cap arrives can still be deselected', async () => {
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({ maxAssociations: 1 }),
			});
			await settle();
			const [paris] = choiceButtons(mounted);
			paris!.click();
			await settle();
			expect(paris!.getAttribute('aria-pressed')).toBe('true');

			// A synced response (host restore) reaches the cap while Paris is pending.
			mounted.instance.response = ['A_cap A_country'];
			await settle();
			expect(paris!.getAttribute('aria-disabled')).toBe('true');

			paris!.click();
			await settle();
			expect(mounted.events).toHaveLength(0);
			expect(paris!.getAttribute('aria-pressed')).toBe('false');
			cleanupInteraction(mounted);
		});

		test('the helper names the cap while it applies', async () => {
			const mounted = mountInteraction(AssociateInteraction, {
				interaction: associateData({ maxAssociations: 2 }),
			});
			await settle();

			const helper = q(mounted, '[part="helper"]');
			expect(helper?.textContent).toContain('You can make up to 2 associations.');

			const unlimited = mountInteraction(AssociateInteraction, {
				interaction: associateData({ maxAssociations: 0 }),
			});
			await settle();
			expect(q(unlimited, '[part="helper"]')?.textContent).not.toContain('You can make up to');
			cleanupInteraction(mounted, unlimited);
		});
	});
});
