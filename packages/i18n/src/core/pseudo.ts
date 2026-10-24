/**
 * Pseudo-localization: a transform over a catalog that keeps every key, plural
 * category and `{placeholder}` intact while making each string accented,
 * bracketed and padded roughly 40% longer.
 *
 * The translation gates check parity, not rendered geometry. A pseudo-locale
 * makes truncation, clipped labels, strings glued together in code and text
 * that never went through the catalog visible in any demo or e2e run. PIE uses
 * the Android tags `en-XA` and `ar-XB`, registered through `customMessages` and
 * never shipped as catalogs. Ported from pie-players `pseudo.ts`.
 */
import type { LocaleMessages } from './types.js';

/** Expanded Latin pseudo-locale: text grows ~40% and carries accents and brackets. */
export const PSEUDO_LOCALE_EXPANDED = 'en-XA';

/**
 * Right-to-left pseudo-locale: transformed English under an `ar` primary
 * subtag, so direction resolves RTL and chrome lays out mirrored without a
 * word of Arabic on screen.
 */
export const PSEUDO_LOCALE_RTL = 'ar-XB';

export interface PseudoLocalizeOptions {
	/** Extra length as a fraction of the original, on top of what accents add. Default 0.4. */
	expansion?: number;
	/** Wrap every string in `[` and `]` so concatenated fragments stand out. Default true. */
	brackets?: boolean;
	/** Map Latin letters to accented look-alikes. Default true. */
	accents?: boolean;
}

const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ACCENTED = 'áƀçðéƒğĥíĵķĺḿñóþǫŕšŧúṽŵẋýžÁɃÇÐÉƑĞĤÍĴĶĹḾÑÓÞǪŔŠŦÚṼŴẊÝŽ';
const ACCENTS = new Map([...PLAIN].map((letter, index) => [letter, [...ACCENTED][index]!]));

const PLACEHOLDER = /(\{\w+\})/g;

function pseudoText(text: string, { expansion, accents, brackets }: Required<PseudoLocalizeOptions>): string {
	const transformed = text.split(PLACEHOLDER).map((segment, index) => {
		// A capturing split leaves each placeholder at an odd index, verbatim.
		if (index % 2 === 1 || segment === '') return segment;
		const out = accents ? segment.replace(/[a-zA-Z]/g, (letter) => ACCENTS.get(letter) ?? letter) : segment;
		if (expansion <= 0) return out;
		return `${out} ${'~'.repeat(Math.max(1, Math.ceil(segment.length * expansion)))}`;
	});
	const joined = transformed.join('');
	return brackets ? `[${joined}]` : joined;
}

function pseudoNode(node: unknown, settings: Required<PseudoLocalizeOptions>): unknown {
	if (typeof node === 'string') return pseudoText(node, settings);
	if (node === null || typeof node !== 'object') return node;
	return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, pseudoNode(child, settings)]));
}

/**
 * The pseudo-localized twin of a catalog: same keys, same plural categories,
 * same placeholder sets, longer accented bracketed strings.
 */
export function pseudoLocalize(catalog: LocaleMessages, options?: PseudoLocalizeOptions): LocaleMessages {
	return pseudoNode(catalog, {
		expansion: options?.expansion ?? 0.4,
		brackets: options?.brackets ?? true,
		accents: options?.accents ?? true,
	}) as LocaleMessages;
}
