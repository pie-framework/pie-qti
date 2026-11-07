import type { ElementNameMapper } from '@pie-qti/qti-common';
import { childElements, getAttr } from '@pie-qti/qti-processing';

/** A choice, gap or hotspot that takes part in pairings, with its authored `matchGroup`. */
export interface MatchGroupChoice {
	readonly identifier: string;
	/** The `matchGroup` tokens; empty when the attribute is absent. */
	readonly matchGroup: readonly string[];
}

/** The pairing constraints of one associate, match, gap match or graphic interaction. */
export interface MatchGroupConstraints {
	/** True for `directedPair` responses (source, then target); false for `pair` responses. */
	readonly directed: boolean;
	readonly sources: ReadonlyMap<string, MatchGroupChoice>;
	/** The same map as `sources` for undirected interactions. */
	readonly targets: ReadonlyMap<string, MatchGroupChoice>;
}

/**
 * Whether `matchGroup` lets two choices be paired.
 *
 * QTI 2.2 and 3.0 define `matchGroup` as "a list of the identifiers for the objects that can be
 * matched with this" choice, gap or hotspot, empty meaning unrestricted, each side subject to its
 * own constraint. Content (and the `@pie-qti/default-components` renderers) also use the tokens
 * as shared group labels. A pairing is refused only when neither reading allows it, so a response
 * a candidate could build in the delivered UI, or that the specification allows, always passes.
 */
export function isMatchGroupCompatible(a: MatchGroupChoice, b: MatchGroupChoice): boolean {
	if (a.matchGroup.length === 0 || b.matchGroup.length === 0) return true;
	if (a.matchGroup.includes(b.identifier) && b.matchGroup.includes(a.identifier)) return true;
	return a.matchGroup.some((group) => b.matchGroup.includes(group));
}

/**
 * The pairs of a `pair` / `directedPair` response (single or container) that `matchGroup` does not
 * allow, as `"source target"`. Pairs naming identifiers the interaction does not have are left to
 * other validation.
 */
export function findMatchGroupViolations(response: unknown, constraints: MatchGroupConstraints): string[] {
	const entries = Array.isArray(response) ? response : response === null || response === undefined ? [] : [response];
	const violations: string[] = [];
	for (const entry of entries) {
		if (typeof entry !== 'string') continue;
		const [first, second] = entry.trim().split(/\s+/);
		if (!first || !second) continue;
		const source = constraints.sources.get(first);
		const target = constraints.targets.get(second);
		if (!source || !target) continue;
		if (!isMatchGroupCompatible(source, target)) violations.push(`${first} ${second}`);
	}
	return violations;
}

/** Which elements an interaction pairs: canonical source names, then canonical target names. */
const PAIRING_INTERACTIONS: Readonly<
	Record<string, { directed: boolean; sources: readonly string[]; targets?: readonly string[] }>
> = {
	associateinteraction: { directed: false, sources: ['simpleassociablechoice'] },
	graphicassociateinteraction: { directed: false, sources: ['associablehotspot'] },
	matchinteraction: { directed: true, sources: ['simpleassociablechoice'] },
	gapmatchinteraction: { directed: true, sources: ['gaptext', 'gapimg'], targets: ['gap'] },
	graphicgapmatchinteraction: { directed: true, sources: ['gaptext', 'gapimg'], targets: ['associablehotspot'] },
};

/**
 * The `matchGroup` constraints of every pairing interaction in `item` that authors a `matchGroup`
 * anywhere, by response identifier. `item` is the parsed source item.
 */
export function readMatchGroupConstraints(
	item: Element,
	elementNameMapper: ElementNameMapper,
): Map<string, MatchGroupConstraints> {
	const canonical = (element: Element): string => elementNameMapper.toCanonical(element.localName);
	const constraints = new Map<string, MatchGroupConstraints>();

	const visit = (element: Element): void => {
		const pairing = PAIRING_INTERACTIONS[canonical(element)];
		const responseIdentifier = pairing ? getAttr(element, 'responseIdentifier')?.trim() : undefined;
		if (pairing && responseIdentifier) {
			let sources: Map<string, MatchGroupChoice>;
			let targets: Map<string, MatchGroupChoice>;
			if (canonical(element) === 'matchinteraction') {
				// The first simpleMatchSet holds the sources, the second the targets.
				const [sourceSet, targetSet] = childElements(element).filter((child) => canonical(child) === 'simplematchset');
				sources = choicesIn(sourceSet, pairing.sources, canonical);
				targets = choicesIn(targetSet, pairing.sources, canonical);
			} else {
				sources = choicesIn(element, pairing.sources, canonical);
				targets = pairing.targets ? choicesIn(element, pairing.targets, canonical) : sources;
			}
			const authored = [...sources.values(), ...targets.values()].some((choice) => choice.matchGroup.length > 0);
			if (authored) constraints.set(responseIdentifier, { directed: pairing.directed, sources, targets });
		}
		for (const child of childElements(element)) visit(child);
	};
	visit(item);
	return constraints;
}

function choicesIn(
	root: Element | undefined,
	names: readonly string[],
	canonical: (element: Element) => string,
): Map<string, MatchGroupChoice> {
	const choices = new Map<string, MatchGroupChoice>();
	const visit = (element: Element): void => {
		if (names.includes(canonical(element))) {
			const identifier = getAttr(element, 'identifier')?.trim();
			if (identifier) {
				const matchGroup = (getAttr(element, 'matchGroup') ?? '').split(/\s+/).filter(Boolean);
				choices.set(identifier, Object.freeze({ identifier, matchGroup: Object.freeze(matchGroup) }));
			}
		}
		for (const child of childElements(element)) visit(child);
	};
	if (root) for (const child of childElements(root)) visit(child);
	return choices;
}
