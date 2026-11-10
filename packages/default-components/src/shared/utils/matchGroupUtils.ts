import { isMatchGroupCompatible } from '@pie-qti/item-player';

/**
 * A choice, gap or hotspot that takes part in pairings, with its authored `matchGroup`.
 * The renderer data omits the attribute when the author wrote none.
 */
export interface MatchGroupBearer {
	identifier: string;
	matchGroup?: string[];
}

/**
 * Whether the delivered UI may pair `a` with `b`: exactly the rule response validation applies
 * (`isMatchGroupCompatible` from `@pie-qti/item-player`), so the UI never allows a pair that
 * validation rejects nor blocks one it accepts.
 *
 * QTI defines `matchGroup` as "a list of the identifiers for the objects that can be matched
 * with this" choice, gap text, gap image, gap or hotspot: QTI 2.2.4 ASI Information Model
 * (Final Release, 2021) Tables 5.98.5, 5.39.4, 5.37.4, 5.36.4 and 5.5.4; QTI 3.0 ASI
 * Information Model (Final Release 1.0, 2022) Tables 5.131.5, 5.58.4, 5.56.4, 5.55.4 and 5.7.4.
 * Content also uses the tokens as shared group labels, and the shared rule accepts a pair when
 * either reading allows it. A side the interaction does not have is left to other validation,
 * as response validation does.
 */
export function isCompatibleMatchGroup(a: MatchGroupBearer | null | undefined, b: MatchGroupBearer | null | undefined): boolean {
	if (!a || !b) return true;
	return isMatchGroupCompatible(
		{ identifier: a.identifier, matchGroup: a.matchGroup ?? [] },
		{ identifier: b.identifier, matchGroup: b.matchGroup ?? [] },
	);
}

/**
 * The identifiers of the `candidates` that `source` may not be paired with — the targets a held
 * or dragged source marks as refusing it — by {@link isCompatibleMatchGroup}, the rule response
 * validation applies, so the UI blocks exactly the pairs validation rejects. No source blocks
 * nothing.
 */
export function matchGroupBlockedIds(
	source: MatchGroupBearer | null | undefined,
	candidates: readonly MatchGroupBearer[],
): Set<string> {
	if (!source) return new Set();
	return new Set(
		candidates.filter((candidate) => !isCompatibleMatchGroup(source, candidate)).map((candidate) => candidate.identifier),
	);
}
