/**
 * XML Schema regular expressions in JavaScript.
 *
 * QTI's `patternMatch` and `patternMask` take the regular expression language of XML Schema
 * Part 2, appendix F (QTI 2.1 information model; QTI 3.0 §5.48.4, §5.104). JavaScript's `RegExp`
 * reads several of its constructs differently, so a pattern is translated before it compiles:
 *
 * - a pattern matches the whole string, and `^` and `$` are ordinary characters;
 * - `.` is any character except newline and carriage return;
 * - `\d` is a Unicode decimal digit; `\s` exactly space, tab, newline and carriage return; `\w`
 *   any character but punctuation, separators and other characters (`\p{P}`, `\p{Z}`, `\p{C}`);
 *   `\i` and `\c` the XML 1.0 name start and name characters; each capital is the complement;
 * - `\p{IsX}` and `\P{IsX}` are the blocks of the XSD 1.0 block table, and a block name it does
 *   not list denotes every character (XSD 1.1 §G.4.2.4);
 * - `[G-[C]]` subtracts class `C` from group `G`;
 * - `\-` is an escaped hyphen outside a class too.
 *
 * Category escapes such as `\p{Lu}` mean the same in both languages and pass through.
 */

type Range = readonly [number, number];

const MAX_CODE_POINT = 0x10ffff;

/** The ranges sorted, with overlapping and adjacent ranges joined. */
function merged(ranges: readonly Range[]): Range[] {
	const out: [number, number][] = [];
	for (const [lo, hi] of [...ranges].sort((a, b) => a[0] - b[0])) {
		const last = out[out.length - 1];
		if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi);
		else out.push([lo, hi]);
	}
	return out;
}

/** Every code point the ranges leave out. */
function complement(ranges: readonly Range[]): Range[] {
	const out: Range[] = [];
	let next = 0;
	for (const [lo, hi] of merged(ranges)) {
		if (lo > next) out.push([next, lo - 1]);
		next = hi + 1;
	}
	if (next <= MAX_CODE_POINT) out.push([next, MAX_CODE_POINT]);
	return out;
}

const codePoint = (value: number) => `\\u{${value.toString(16)}}`;

/** The ranges as the items of a character class. */
function classItems(ranges: readonly Range[]): string {
	return ranges.map(([lo, hi]) => (lo === hi ? codePoint(lo) : `${codePoint(lo)}-${codePoint(hi)}`)).join('');
}

const EVERY_CHARACTER: Range[] = [[0, MAX_CODE_POINT]];

/** `\s`: space, tab, newline and carriage return. */
const SPACE: Range[] = [
	[0x9, 0xa],
	[0xd, 0xd],
	[0x20, 0x20],
];

/** A table of hexadecimal code points and `lo-hi` ranges, separated by spaces or commas. */
function parseRanges(table: string): Range[] {
	return table
		.trim()
		.split(/[\s,]+/)
		.map((span) => {
			const [lo = 0, hi = lo] = span.split('-').map((hex) => Number.parseInt(hex, 16));
			return [lo, hi] as const;
		});
}

/** XML 1.0 `Letter` (BaseChar and Ideographic, appendix B), which XSD 1.0 names for `\i` and `\c`. */
const LETTER_TABLE = `
41-5a 61-7a c0-d6 d8-f6 f8-131 134-13e 141-148 14a-17e 180-1c3 1cd-1f0 1f4-1f5 1fa-217 250-2a8
2bb-2c1 386 388-38a 38c 38e-3a1 3a3-3ce 3d0-3d6 3da 3dc 3de 3e0 3e2-3f3 401-40c 40e-44f 451-45c
45e-481 490-4c4 4c7-4c8 4cb-4cc 4d0-4eb 4ee-4f5 4f8-4f9 531-556 559 561-586 5d0-5ea 5f0-5f2 621-63a
641-64a 671-6b7 6ba-6be 6c0-6ce 6d0-6d3 6d5 6e5-6e6 905-939 93d 958-961 985-98c 98f-990 993-9a8
9aa-9b0 9b2 9b6-9b9 9dc-9dd 9df-9e1 9f0-9f1 a05-a0a a0f-a10 a13-a28 a2a-a30 a32-a33 a35-a36 a38-a39
a59-a5c a5e a72-a74 a85-a8b a8d a8f-a91 a93-aa8 aaa-ab0 ab2-ab3 ab5-ab9 abd ae0 b05-b0c b0f-b10
b13-b28 b2a-b30 b32-b33 b36-b39 b3d b5c-b5d b5f-b61 b85-b8a b8e-b90 b92-b95 b99-b9a b9c b9e-b9f
ba3-ba4 ba8-baa bae-bb5 bb7-bb9 c05-c0c c0e-c10 c12-c28 c2a-c33 c35-c39 c60-c61 c85-c8c c8e-c90
c92-ca8 caa-cb3 cb5-cb9 cde ce0-ce1 d05-d0c d0e-d10 d12-d28 d2a-d39 d60-d61 e01-e2e e30 e32-e33
e40-e45 e81-e82 e84 e87-e88 e8a e8d e94-e97 e99-e9f ea1-ea3 ea5 ea7 eaa-eab ead-eae eb0 eb2-eb3 ebd
ec0-ec4 f40-f47 f49-f69 10a0-10c5 10d0-10f6 1100 1102-1103 1105-1107 1109 110b-110c 110e-1112 113c
113e 1140 114c 114e 1150 1154-1155 1159 115f-1161 1163 1165 1167 1169 116d-116e 1172-1173 1175 119e
11a8 11ab 11ae-11af 11b7-11b8 11ba 11bc-11c2 11eb 11f0 11f9 1e00-1e9b 1ea0-1ef9 1f00-1f15 1f18-1f1d
1f20-1f45 1f48-1f4d 1f50-1f57 1f59 1f5b 1f5d 1f5f-1f7d 1f80-1fb4 1fb6-1fbc 1fbe 1fc2-1fc4 1fc6-1fcc
1fd0-1fd3 1fd6-1fdb 1fe0-1fec 1ff2-1ff4 1ff6-1ffc 2126 212a-212b 212e 2180-2182 3007 3021-3029
3041-3094 30a1-30fa 3105-312c 4e00-9fa5 ac00-d7a3`;

/** The other XML 1.0 name characters: Digit, CombiningChar, Extender, `-` and `.`. */
const NAME_CHARACTER_TABLE = `
2d-2e 30-39 b7 2d0-2d1 300-345 360-361 387 483-486 591-5a1 5a3-5b9 5bb-5bd 5bf 5c1-5c2 5c4 640
64b-652 660-669 670 6d6-6e4 6e7-6e8 6ea-6ed 6f0-6f9 901-903 93c 93e-94d 951-954 962-963 966-96f
981-983 9bc 9be-9c4 9c7-9c8 9cb-9cd 9d7 9e2-9e3 9e6-9ef a02 a3c a3e-a42 a47-a48 a4b-a4d a66-a71
a81-a83 abc abe-ac5 ac7-ac9 acb-acd ae6-aef b01-b03 b3c b3e-b43 b47-b48 b4b-b4d b56-b57 b66-b6f
b82-b83 bbe-bc2 bc6-bc8 bca-bcd bd7 be7-bef c01-c03 c3e-c44 c46-c48 c4a-c4d c55-c56 c66-c6f c82-c83
cbe-cc4 cc6-cc8 cca-ccd cd5-cd6 ce6-cef d02-d03 d3e-d43 d46-d48 d4a-d4d d57 d66-d6f e31 e34-e3a
e46-e4e e50-e59 eb1 eb4-eb9 ebb-ebc ec6 ec8-ecd ed0-ed9 f18-f19 f20-f29 f35 f37 f39 f3e-f3f f71-f84
f86-f8b f90-f95 f97 f99-fad fb1-fb7 fb9 20d0-20dc 20e1 3005 302a-302f 3031-3035 3099-309a 309d-309e
30fc-30fe`;

/** `\i`: a letter, `_` or `:` (XSD 1.0 appendix F.1.1). */
const NAME_START: Range[] = merged([...parseRanges(LETTER_TABLE), [0x3a, 0x3a], [0x5f, 0x5f]]);

/** `\c`: an XML 1.0 NameChar. */
const NAME: Range[] = merged([...NAME_START, ...parseRanges(NAME_CHARACTER_TABLE)]);

/** The multi-character escapes, as character class items. */
const MULTI_CHARACTER_ESCAPES = new Map<string, string>([
	['d', '\\p{Nd}'],
	['D', '\\P{Nd}'],
	['s', classItems(SPACE)],
	['S', classItems(complement(SPACE))],
	// [#x0000-#x10FFFF]-[\p{P}\p{Z}\p{C}]: the other general categories
	['w', '\\p{L}\\p{M}\\p{N}\\p{S}'],
	['W', '\\p{P}\\p{Z}\\p{C}'],
	['i', classItems(NAME_START)],
	['I', classItems(complement(NAME_START))],
	['c', classItems(NAME)],
	['C', classItems(complement(NAME))],
]);

/** The block table of XSD 1.0 appendix F.1.1: name, then ranges in hexadecimal. */
const BLOCK_TABLE = `
BasicLatin:0-7f Latin-1Supplement:80-ff LatinExtended-A:100-17f LatinExtended-B:180-24f
IPAExtensions:250-2af SpacingModifierLetters:2b0-2ff CombiningDiacriticalMarks:300-36f
Greek:370-3ff Cyrillic:400-4ff Armenian:530-58f Hebrew:590-5ff Arabic:600-6ff Syriac:700-74f
Thaana:780-7bf Devanagari:900-97f Bengali:980-9ff Gurmukhi:a00-a7f Gujarati:a80-aff Oriya:b00-b7f
Tamil:b80-bff Telugu:c00-c7f Kannada:c80-cff Malayalam:d00-d7f Sinhala:d80-dff Thai:e00-e7f
Lao:e80-eff Tibetan:f00-fff Myanmar:1000-109f Georgian:10a0-10ff HangulJamo:1100-11ff
Ethiopic:1200-137f Cherokee:13a0-13ff UnifiedCanadianAboriginalSyllabics:1400-167f Ogham:1680-169f
Runic:16a0-16ff Khmer:1780-17ff Mongolian:1800-18af LatinExtendedAdditional:1e00-1eff
GreekExtended:1f00-1fff GeneralPunctuation:2000-206f SuperscriptsandSubscripts:2070-209f
CurrencySymbols:20a0-20cf CombiningMarksforSymbols:20d0-20ff LetterlikeSymbols:2100-214f
NumberForms:2150-218f Arrows:2190-21ff MathematicalOperators:2200-22ff
MiscellaneousTechnical:2300-23ff ControlPictures:2400-243f OpticalCharacterRecognition:2440-245f
EnclosedAlphanumerics:2460-24ff BoxDrawing:2500-257f BlockElements:2580-259f
GeometricShapes:25a0-25ff MiscellaneousSymbols:2600-26ff Dingbats:2700-27bf
BraillePatterns:2800-28ff CJKRadicalsSupplement:2e80-2eff KangxiRadicals:2f00-2fdf
IdeographicDescriptionCharacters:2ff0-2fff CJKSymbolsandPunctuation:3000-303f Hiragana:3040-309f
Katakana:30a0-30ff Bopomofo:3100-312f HangulCompatibilityJamo:3130-318f Kanbun:3190-319f
BopomofoExtended:31a0-31bf EnclosedCJKLettersandMonths:3200-32ff CJKCompatibility:3300-33ff
CJKUnifiedIdeographsExtensionA:3400-4db5 CJKUnifiedIdeographs:4e00-9fff YiSyllables:a000-a48f
YiRadicals:a490-a4cf HangulSyllables:ac00-d7a3 PrivateUse:e000-f8ff
CJKCompatibilityIdeographs:f900-faff AlphabeticPresentationForms:fb00-fb4f
ArabicPresentationForms-A:fb50-fdff CombiningHalfMarks:fe20-fe2f CJKCompatibilityForms:fe30-fe4f
SmallFormVariants:fe50-fe6f ArabicPresentationForms-B:fe70-fefe Specials:feff-feff,fff0-fffd
HalfwidthandFullwidthForms:ff00-ffef`;

const BLOCKS = new Map<string, Range[]>(
	BLOCK_TABLE.trim()
		.split(/\s+/)
		.map((entry) => {
			const [name = '', spans = ''] = entry.split(':');
			return [name, parseRanges(spans)];
		}),
);

/** A `\p{…}` / `\P{…}` escape starting at `start`, as class items, and the index after it. */
function propertyEscape(pattern: string, start: number): { items: string; end: number } | null {
	const close = pattern.indexOf('}', start + 3);
	if (pattern[start + 2] !== '{' || close === -1) return null;
	const letter = pattern[start + 1];
	const name = pattern.slice(start + 3, close);
	if (!name.startsWith('Is')) return { items: `\\${letter}{${name}}`, end: close + 1 };
	const block = BLOCKS.get(name.slice(2));
	const ranges = !block ? EVERY_CHARACTER : letter === 'P' ? complement(block) : block;
	return { items: classItems(ranges), end: close + 1 };
}

/** Punctuation a `v`-flag character class only takes escaped. */
const V_CLASS_PUNCTUATION = new Set('!#$%&()*+,./:;<=>?@[]^`{|}~');

interface Translation {
	source: string;
	/** Whether the pattern subtracts a class, which only the `v` flag expresses. */
	subtracts: boolean;
}

/** The pattern in JavaScript syntax, for the `u` flag, or with `v` for the `v` flag. */
function translate(pattern: string, v: boolean): Translation {
	let out = '';
	let subtracts = false;
	// For each open character class, where its group starts in `out`: just after its `[`.
	const groups: number[] = [];
	let i = 0;
	while (i < pattern.length) {
		const char = pattern[i] as string;
		const inClass = groups.length > 0;
		if (char === '\\' && i + 1 < pattern.length) {
			const next = pattern[i + 1] as string;
			const property = next === 'p' || next === 'P' ? propertyEscape(pattern, i) : null;
			const items = property?.items ?? MULTI_CHARACTER_ESCAPES.get(next);
			if (items !== undefined) out += inClass ? items : `[${items}]`;
			else if (next === '-') out += inClass ? '\\-' : '-';
			else out += `\\${next}`;
			i = property?.end ?? i + 2;
			continue;
		}
		if (!inClass) {
			if (char === '[') {
				out += '[';
				groups.push(out.length);
				i += 1;
				if (pattern[i] === '^') {
					out += '^';
					i += 1;
				}
				continue;
			}
			out += char === '^' || char === '$' ? `\\${char}` : char === '.' ? '[^\\n\\r]' : char;
			i += 1;
			continue;
		}
		const groupStart = groups[groups.length - 1] as number;
		if (char === ']') {
			groups.pop();
			out += ']';
			i += 1;
		} else if (char === '-' && pattern[i + 1] === '[') {
			// [G-[C]] is [[G]--[C]]: a `v`-flag subtraction takes classes, not a bare group.
			out = `${out.slice(0, groupStart)}[${out.slice(groupStart)}]--[`;
			groups.push(out.length);
			subtracts = true;
			i += 2;
			if (pattern[i] === '^') {
				out += '^';
				i += 1;
			}
		} else if (char === '-') {
			// A hyphen first in the group or last in the class is the character itself.
			const group = out.slice(groupStart);
			const literal = group === '' || group === '^' || pattern[i + 1] === ']';
			out += literal && v ? '\\-' : '-';
			i += 1;
		} else {
			out += char === '^' || (v && V_CLASS_PUNCTUATION.has(char)) ? `\\${char}` : char;
			i += 1;
		}
	}
	return { source: out, subtracts };
}

/**
 * The pattern's source for the `v` flag, which the HTML `pattern` attribute compiles with; the
 * attribute supplies the whole-string match.
 */
export function xsdPatternSource(pattern: string): string {
	return translate(pattern, true).source;
}

/**
 * Compiles an XSD pattern to a `RegExp` that matches the whole string, or `null` when the
 * pattern does not compile. The `u` flag is used, or `v` for a class subtraction. A pattern that
 * does not compile translated, which is not a valid XSD pattern, compiles as written without
 * either flag, so content that matched before still does.
 */
export function xsdPatternToRegExp(pattern: string, flags = ''): RegExp | null {
	const unicode = translate(pattern, false);
	const [source, mode] = unicode.subtracts ? [translate(pattern, true).source, 'v'] : [unicode.source, 'u'];
	try {
		return new RegExp(`^(?:${source})$`, `${flags}${mode}`);
	} catch {
		try {
			return new RegExp(`^(?:${pattern})$`, flags);
		} catch {
			return null;
		}
	}
}
