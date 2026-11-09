/**
 * The order-subset rule (QTI 2.2 ASI §5.73 orderInteraction, §5.42 graphicOrderInteraction,
 * §2.4.1.2; QTI 3.0 `min-choices` / `max-choices` mean the same). Response validation and the
 * delivered UI both read it, so the UI can never produce a response validation rejects nor
 * refuse one it accepts.
 *
 * - `minChoices` unspecified: "all of the choices must be ordered and maxChoices is ignored".
 * - `minChoices` from 1 up to fewer than the choices: "the candidate must select a subset of
 *   the choices and impose an ordering on them" — at least `minChoices`, at most the cap,
 *   which is `maxChoices` (0 = no limit) clamped to the number of choices.
 * - `minChoices` at or above the number of choices: every choice, as in the default.
 */

export interface OrderSubsetInteraction {
	/** The authored minChoices; absent, 0 or not a number means unspecified. */
	minChoices?: number | null;
	/** The authored maxChoices; absent, 0 or not a number means no limit. */
	maxChoices?: number | null;
	/** How many choices the interaction offers (simpleChoice / hotspotChoice). */
	choiceCount: number;
}

export interface OrderChoiceLimits {
	/** True when the candidate selects which choices to order: a subset is requested. */
	subset: boolean;
	/** The fewest choices a complete response orders: every choice unless a subset is requested. */
	minOrdered: number;
	/** The most choices a response may order: every choice unless a subset is requested. */
	maxOrdered: number;
}

function positiveCount(value: number | null | undefined): number {
	const n = Math.floor(Number(value ?? 0));
	return Number.isFinite(n) && n > 0 ? n : 0;
}

export function orderChoiceLimits({ minChoices, maxChoices, choiceCount }: OrderSubsetInteraction): OrderChoiceLimits {
	const total = positiveCount(choiceCount);
	const min = positiveCount(minChoices);
	if (min === 0 || min >= total) return { subset: false, minOrdered: total, maxOrdered: total };
	const max = positiveCount(maxChoices);
	// maxChoices "must be greater than or equal to minChoices"; one authored below it would make
	// the item unanswerable, so the minimum wins.
	const cap = max > 0 ? Math.min(max, total) : total;
	return { subset: true, minOrdered: min, maxOrdered: Math.max(cap, min) };
}
