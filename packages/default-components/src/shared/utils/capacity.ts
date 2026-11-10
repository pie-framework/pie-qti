/**
 * QTI capacity limits — maxChoices, maxAssociations, matchMax — and the message that states one.
 *
 * One rule for every interaction: a positive limit restricts, and 0 means no restriction, as
 * QTI 2.2 and 3.0 define it for each of these attributes. Values are taken as given: these
 * helpers impose no defaults. The item-player extractors set the spec default of an absent
 * attribute, and the components pass the delivered value through.
 */

/** Whether `limit` restricts at all: only a positive limit does; 0 is no restriction. */
export function isLimited(limit: number): boolean {
	return limit > 0;
}

/** Whether `count` has reached a positive `limit`, so one more would pass it. */
export function isAtLimit(count: number, limit: number): boolean {
	return limit > 0 && count >= limit;
}

/** Whether `count` is past a positive `limit`: a would-be response that breaks it. */
export function exceedsLimit(count: number, limit: number): boolean {
	return limit > 0 && count > limit;
}

/**
 * The message that states a limit: the author's `data-max-selections-message` when it has text
 * (QTI 3.0: "rendered upon violation of the max-choices constraint"), else `fallback`, the
 * interaction's localized default.
 */
export function limitMessage(authored: string | null | undefined, fallback: string): string {
	return authored?.trim() || fallback;
}
