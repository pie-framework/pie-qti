/**
 * Tests for seeded `shuffle` support.
 *
 * Guards the three properties QTI needs and the specific defect this replaced: the
 * previous implementation combined a char-code-sum seed with a non-iterated LCG, which
 * returned the same permutation for effectively every item.
 */

import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import { createShuffleRng, hashStringToSeed, maybeShuffle, shuffleWithFixed } from '../../src/core/shuffle.js';

function choiceItemXml(shuffle: boolean, fixedIds: string[] = []): string {
	const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
	const choices = ids
		.map(
			(id) =>
				`<simpleChoice identifier="${id}"${fixedIds.includes(id) ? ' fixed="true"' : ''}>${id}</simpleChoice>`,
		)
		.join('\n      ');
	return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="shuffle-item"
  title="Shuffle" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="${shuffle}" maxChoices="1">
      ${choices}
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
}

function orderOf(player: Player): string[] {
	const data = player.getInteractionData()[0] as { choices: Array<{ identifier: string }> };
	return data.choices.map((c) => c.identifier);
}

describe('hashStringToSeed', () => {
	test('is order-sensitive, unlike a char-code sum', () => {
		// The old seed summed char codes, so these pairs collided outright.
		expect(hashStringToSeed('AB')).not.toBe(hashStringToSeed('BA'));
		expect(hashStringToSeed('item1')).not.toBe(hashStringToSeed('1item'));
		expect(hashStringToSeed('Q1_A')).not.toBe(hashStringToSeed('Q1A_'));
	});

	test('is stable for the same input', () => {
		expect(hashStringToSeed('RESPONSE')).toBe(hashStringToSeed('RESPONSE'));
	});
});

describe('shuffleWithFixed', () => {
	const items = [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n) }));

	test('returns a permutation and does not mutate the input', () => {
		const copy = [...items];
		const out = shuffleWithFixed(items, () => false, createShuffleRng('s', 'r'));
		expect(out).toHaveLength(items.length);
		expect(out.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
		expect(items).toEqual(copy);
	});

	test('keeps fixed entries at their authored index', () => {
		const withFixed = items.map((it, i) => ({ ...it, fixed: i === 0 || i === 3 }));
		for (let s = 0; s < 50; s++) {
			const out = shuffleWithFixed(withFixed, (i) => i.fixed, createShuffleRng(`sess${s}`, 'R'));
			expect(out[0].id).toBe('1');
			expect(out[3].id).toBe('4');
		}
	});

	test('produces a well-spread distribution across seeds', () => {
		// The replaced implementation yielded exactly ONE permutation across hundreds of
		// realistic responseIds. Six items have 720 permutations; require a broad spread
		// and no single dominant outcome.
		const seen = new Map<string, number>();
		const TRIALS = 600;
		for (let s = 0; s < TRIALS; s++) {
			const key = shuffleWithFixed(items, () => false, createShuffleRng(`session-${s}`, 'RESPONSE'))
				.map((i) => i.id)
				.join('');
			seen.set(key, (seen.get(key) ?? 0) + 1);
		}
		expect(seen.size).toBeGreaterThan(200);
		const mostCommon = Math.max(...seen.values());
		expect(mostCommon).toBeLessThan(TRIALS / 20);
	});

	test('two responseIds in one session get different permutations', () => {
		const a = shuffleWithFixed(items, () => false, createShuffleRng('sess', 'RESPONSE_1'));
		const b = shuffleWithFixed(items, () => false, createShuffleRng('sess', 'RESPONSE_2'));
		expect(a.map((i) => i.id).join('')).not.toBe(b.map((i) => i.id).join(''));
	});
});

describe('maybeShuffle', () => {
	test('keeps authored order when shuffle is false or rng is absent', () => {
		const items = [{ identifier: 'A' }, { identifier: 'B' }, { identifier: 'C' }];
		expect(maybeShuffle(items, false, createShuffleRng('s', 'r'))).toEqual(items);
		expect(maybeShuffle(items, true, undefined)).toEqual(items);
	});

	test('preserves fields of choice types that do not declare `fixed`', () => {
		// Regression guard: an over-tight generic constraint previously collapsed the
		// element type and dropped fields such as `matchMax`.
		const items = [
			{ identifier: 'A', text: 'a', matchMax: 2 },
			{ identifier: 'B', text: 'b', matchMax: 3 },
		];
		const out = maybeShuffle(items, true, createShuffleRng('s', 'r'));
		expect(out.map((i) => i.matchMax).sort()).toEqual([2, 3]);
		for (const item of out) expect(item.text).toBeDefined();
	});
});

describe('Player integration', () => {
	test('shuffle="false" preserves authored order', () => {
		expect(orderOf(new Player({ itemXml: choiceItemXml(false) }))).toEqual([
			'A',
			'B',
			'C',
			'D',
			'E',
			'F',
		]);
	});

	test('order is stable across repeated extraction within one session', () => {
		const player = new Player({ itemXml: choiceItemXml(true) });
		const first = orderOf(player);
		expect(orderOf(player)).toEqual(first);
		expect(orderOf(player)).toEqual(first);
	});

	test('different sessions get different orders', () => {
		// Each Player mints its own session GUID. Across many independent players the
		// orders must vary — the previous implementation produced one fixed order for
		// every candidate.
		const orders = new Set<string>();
		for (let i = 0; i < 40; i++) {
			orders.add(orderOf(new Player({ itemXml: choiceItemXml(true) })).join(''));
		}
		expect(orders.size).toBeGreaterThan(5);
	});

	test('shuffled output is always a permutation of the authored choices', () => {
		for (let i = 0; i < 20; i++) {
			expect(orderOf(new Player({ itemXml: choiceItemXml(true) })).sort()).toEqual([
				'A',
				'B',
				'C',
				'D',
				'E',
				'F',
			]);
		}
	});

	test('fixed choices keep their authored position through the Player', () => {
		for (let i = 0; i < 20; i++) {
			const order = orderOf(new Player({ itemXml: choiceItemXml(true, ['A', 'D']) }));
			expect(order[0]).toBe('A');
			expect(order[3]).toBe('D');
		}
	});
});
