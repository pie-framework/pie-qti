/**
 * BCP-47 language tag comparison.
 *
 * Mirrors `packages/players-shared/src/i18n/language-tags.ts` in pie-players
 * (`normalizeLanguageTag`, `languageTagLookupSequence`, `languageTagScript`,
 * `languageTagScriptsMatch`), so a tag resolves to the same catalog in both
 * repositories. `tests/language-tags.test.ts` carries that file's test cases as
 * a parity test; change both files together and the tests keep them converged.
 *
 * Carries no locale data and no DOM access, so anything that compares language
 * tags — catalog negotiation, glossary lookup — can import it without pulling a
 * message catalog. Content producers do not agree on tag syntax: POSIX `es_ES`
 * and BCP-47 `es-ES` both occur, so tags are compared through
 * `normalizeLanguageTag` and never with `===`.
 */

/**
 * Canonicalize a language tag for comparison.
 *
 * Converts POSIX underscores to hyphens, strips a POSIX charset or modifier
 * suffix (`es_ES.UTF-8`, `es_ES@euro`), and lowercases. The output is a
 * comparison key, not a tag to render.
 *
 * Returns an empty string for nullish or blank input, which callers read as
 * "no language declared".
 */
export function normalizeLanguageTag(tag: string | null | undefined): string {
	if (!tag) return '';
	const separatorsUnified = tag.trim().replace(/_/g, '-');
	const withoutPosixSuffix = separatorsUnified.split(/[.@]/)[0];
	return withoutPosixSuffix.toLowerCase();
}

/**
 * The RFC 4647 lookup sequence for a tag, most specific first.
 *
 * `es-MX` yields `["es-mx", "es"]`, so a request for Mexican Spanish reaches a
 * catalog tagged plain `es` without also reaching one tagged `es-ES`. Truncation
 * never stops on a singleton subtag (`x`, `u`), per RFC 4647 §3.4, and never
 * produces a bare region or script.
 */
export function languageTagLookupSequence(tag: string | null | undefined): string[] {
	const normalized = normalizeLanguageTag(tag);
	if (!normalized) return [];

	const subtags = normalized.split('-');
	const sequence: string[] = [];

	for (let length = subtags.length; length > 0; length--) {
		const candidate = subtags.slice(0, length);
		// A trailing singleton introduces an extension with nothing left in it.
		if (candidate.length > 1 && candidate[candidate.length - 1].length === 1) {
			continue;
		}
		sequence.push(candidate.join('-'));
	}

	return sequence;
}

/** `maximize()` runs on every resolution, for each candidate catalog. */
const scripts = new Map<string, string | undefined>();

/**
 * The script a tag is written in, lowercased: explicit (`sr-Latn`), or the
 * CLDR likely script (`zh-TW` maximizes to Hant, `sr` to Cyrl). `undefined`
 * when the tag has no script data or the runtime has no `Intl.Locale`.
 */
export function languageTagScript(tag: string | null | undefined): string | undefined {
	const normalized = normalizeLanguageTag(tag);
	if (!normalized || typeof Intl === 'undefined' || typeof Intl.Locale !== 'function') {
		return undefined;
	}
	if (scripts.has(normalized)) return scripts.get(normalized);
	let script: string | undefined;
	try {
		script = new Intl.Locale(normalized).maximize().script?.toLowerCase();
	} catch {
		// Not a tag `Intl.Locale` parses: no script data.
	}
	scripts.set(normalized, script);
	return script;
}

/**
 * Whether a catalog reached by widening serves a request in the same script.
 * A tag without script data passes, so a runtime without `Intl.Locale`
 * resolves as plain RFC 4647 lookup.
 */
export function languageTagScriptsMatch(
	requested: string | null | undefined,
	candidate: string | null | undefined
): boolean {
	const requestedScript = languageTagScript(requested);
	const candidateScript = languageTagScript(candidate);
	return !requestedScript || !candidateScript || requestedScript === candidateScript;
}
