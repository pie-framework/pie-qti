/**
 * Locale negotiation: which catalog serves a requested language tag.
 *
 * Framework catalogs are keyed by language (`es`, `ar`), plus script where the
 * script is what tells two catalogs apart (`zh-Hans`). A request walks its
 * RFC 4647 lookup sequence with the language and likely script inserted before
 * the bare language, so `es-MX` reaches `es`, `ar_SA` reaches `ar`, and `zh-CN`
 * and plain `zh` reach `zh-Hans`. A catalog reached by widening must share the
 * request's script: `zh-TW` and `zh-Hant` pass `zh-Hans` by and fall back to
 * English.
 */

import {
	languageTagLookupSequence,
	languageTagScript,
	languageTagScriptsMatch,
	normalizeLanguageTag,
} from './language-tags.js';

/** The catalogs this package ships, by the tag each is keyed under. */
export const FRAMEWORK_CATALOGS = ['en', 'ar', 'es', 'fr', 'nl', 'ro', 'th', 'zh-Hans'] as const;

/** A shipped catalog key. */
export type FrameworkCatalogCode = (typeof FRAMEWORK_CATALOGS)[number];

const sequences = new Map<string, readonly string[]>();

/**
 * The negotiation sequence for a tag, most specific first: its RFC 4647 lookup
 * sequence with `language-script` inserted before the bare language.
 * `zh-TW` yields `["zh-tw", "zh-hant", "zh"]`, `zh` yields `["zh-hans", "zh"]`.
 */
export function localeLookupSequence(tag: string | null | undefined): readonly string[] {
	const normalized = normalizeLanguageTag(tag);
	const cached = sequences.get(normalized);
	if (cached) return cached;

	let sequence = languageTagLookupSequence(normalized);
	const script = languageTagScript(normalized);
	if (script && sequence.length > 0) {
		const language = sequence[sequence.length - 1];
		const withScript = `${language}-${script}`;
		if (!sequence.includes(withScript)) {
			sequence = [...sequence.slice(0, -1), withScript, language];
		}
	}
	sequences.set(normalized, sequence);
	return sequence;
}

/**
 * Whether `candidate`, normalized to `step`, may serve `requested`. An exact
 * match always may; a widened or script-inserted step only in the same script.
 */
export function stepServes(requested: string, step: string, candidate: string): boolean {
	return step === normalizeLanguageTag(requested) || languageTagScriptsMatch(requested, candidate);
}

/**
 * The best of `candidates` for a request, as authored, or `undefined` when
 * none serves it. Ranking follows the request's negotiation sequence, not the
 * order of `candidates`.
 */
export function matchLanguageTag<T extends string>(
	requested: string | null | undefined,
	candidates: readonly T[]
): T | undefined {
	if (!requested) return undefined;
	for (const step of localeLookupSequence(requested)) {
		const hit = candidates.find(
			(candidate) => normalizeLanguageTag(candidate) === step && stepServes(requested, step, candidate)
		);
		if (hit !== undefined) return hit;
	}
	return undefined;
}

/**
 * The shipped catalog that serves a tag, or `undefined` when none does and the
 * tag renders in English.
 *
 * @example resolveFrameworkLocale('ar-EG') => 'ar'
 * @example resolveFrameworkLocale('zh-CN') => 'zh-Hans'
 * @example resolveFrameworkLocale('zh-TW') => undefined
 */
export function resolveFrameworkLocale(tag: string | null | undefined): FrameworkCatalogCode | undefined {
	return matchLanguageTag(tag, FRAMEWORK_CATALOGS);
}
