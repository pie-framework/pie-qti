/**
 * Response normalisation for comparison.
 *
 * Folds a typed response and an authored answer to one comparable form, so that
 * the same answer typed with other digits, Arabic separators or a different
 * Unicode encoding compares equal. Response processing applies it inside the
 * comparison and stores the response as entered.
 *
 * Nothing in an ASCII string is altered unless case folding is asked for, so
 * a response that compared equal or unequal before still does.
 *
 * Mirrors `normalizeResponse` in pie-elements-ng
 * (`packages/shared/controller-utils/src/response-normalizer.ts`); the parity
 * test runs that file's cases, so the two stay converged.
 */

export interface NormalizeOptions {
	/**
	 * BCP 47 tag of the content language. Selects the decimal and group marks
	 * that the Arabic separators fold to, and the case fold. Without one, the
	 * marks are `.` and `,`.
	 */
	language?: string;
	/** Fold case, with the Turkish and Azerbaijani i when the language is one of them. */
	ignoreCase?: boolean;
	/**
	 * Fold Arabic spelling variants: hamza and madda alef forms to bare alef,
	 * tashkeel removed, ة to ه and ى to ي. An authoring choice per response,
	 * because it changes what counts as correct spelling.
	 */
	foldLetterVariants?: boolean;
}

// U+061C ALM, LRM, RLM, the embeddings and overrides U+202A–U+202E, the
// isolates U+2066–U+2069, and tatweel U+0640, which only stretches a join.
const BIDI_CONTROLS_AND_TATWEEL = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u0640]/g;

// Arabic Presentation Forms-A and -B. Their compatibility decompositions are
// the base letters, so NFKC folds them without touching anything else.
const PRESENTATION_FORMS = /[\uFB50-\uFDFF\uFE70-\uFEFC]+/g;

const DECIMAL_DIGIT = /\p{Nd}/u;
const NON_ASCII_DIGITS = /(?![0-9])\p{Nd}/gu;
const ARABIC_DECIMAL_SEPARATOR = /\u066B/g;
const ARABIC_THOUSANDS_SEPARATOR = /\u066C/g;

const ALEF_FORMS = /[\u0622\u0623\u0625\u0671]/g;
// Fathatan to sukun, the extended marks up to U+065F, and superscript alef.
const TASHKEEL = /[\u064B-\u065F\u0670]/g;

const digitValues = new Map<number, number>();

/**
 * Unicode assigns decimal digits only in contiguous runs of ten, ascending
 * from zero, so a digit's value is its offset into its run modulo ten. Runs
 * can abut (the mathematical digits are five in a row), hence the modulo.
 */
const digitValue = (codePoint: number): number => {
	const cached = digitValues.get(codePoint);
	if (cached !== undefined) return cached;
	let offset = 0;
	while (DECIMAL_DIGIT.test(String.fromCodePoint(codePoint - offset - 1))) offset++;
	const value = offset % 10;
	digitValues.set(codePoint, value);
	return value;
};

/** Every Unicode decimal digit (`\p{Nd}`) replaced by its ASCII digit. */
export const foldDigits = (value: string): string =>
	value.replace(NON_ASCII_DIGITS, (digit) => String(digitValue(digit.codePointAt(0) as number)));

export interface NumberMarks {
	decimal: string;
	group: string;
}

const POINT_DECIMAL: NumberMarks = { decimal: '.', group: ',' };
const numberMarkCache = new Map<string, NumberMarks>();

/**
 * The marks the language writes Western digits with: `,` decimal in `de`, `.` in `en`.
 * A tag the runtime has no data for keeps the point-decimal marks, because
 * `Intl` would otherwise format in the host's default locale.
 */
export const numberMarks = (language: string | undefined): NumberMarks => {
	if (!language) return POINT_DECIMAL;
	const cached = numberMarkCache.get(language);
	if (cached) return cached;
	let marks = POINT_DECIMAL;
	try {
		if (Intl.NumberFormat.supportedLocalesOf(language).length > 0) {
			const parts = new Intl.NumberFormat(language, { numberingSystem: 'latn' }).formatToParts(12345.6);
			marks = {
				decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
				group: parts.find((part) => part.type === 'group')?.value ?? ',',
			};
		}
	} catch {
		// An invalid tag keeps the point-decimal marks.
	}
	numberMarkCache.set(language, marks);
	return marks;
};

// The languages whose dotted and dotless i fold apart. Lithuanian's
// special casing keeps the dot on accented i, so `Ì` would no longer fold to
// `ì`; it and every other language fold with `toLowerCase()`.
const TURKIC = /^(tr|az)(-|$)/i;

/**
 * Lower case for comparison: `toLocaleLowerCase` in Turkish and Azerbaijani,
 * so dotted and dotless i fold correctly, and `toLowerCase()` otherwise.
 */
export const foldCase = (value: string, language?: string): string => {
	if (!language || !TURKIC.test(language)) return value.toLowerCase();
	try {
		return value.toLocaleLowerCase(language);
	} catch {
		return value.toLowerCase();
	}
};

/**
 * The comparable form of a typed response or authored answer: case folded
 * when the options ask for it; bidi controls and tatweel removed; Arabic
 * presentation forms folded to base letters; NFC; every decimal digit folded
 * to 0–9; `٫` and `٬` replaced by the content language's decimal and group
 * marks. Arabic letter variants fold only when the options ask for it.
 */
export const normalizeResponse = (value: string, options: NormalizeOptions = {}): string => {
	const marks = numberMarks(options.language);
	// Case folds first, on the text as typed: lower-casing can leave combining
	// marks out of canonical order, and a separator folded to `.` changes where
	// a Greek sigma counts as final, so folding later could part two strings
	// that `toLowerCase()` treats as equal. NFC follows the removals, because
	// removing a control or tatweel can bring a letter and its combining mark
	// together.
	let result = (options.ignoreCase ? foldCase(value, options.language) : value)
		.replace(BIDI_CONTROLS_AND_TATWEEL, '')
		.replace(PRESENTATION_FORMS, (forms) => forms.normalize('NFKC'))
		.normalize('NFC');
	result = foldDigits(result)
		.replace(ARABIC_DECIMAL_SEPARATOR, marks.decimal)
		.replace(ARABIC_THOUSANDS_SEPARATOR, marks.group);
	if (options.foldLetterVariants) {
		result = result
			.replace(TASHKEEL, '')
			.replace(ALEF_FORMS, '\u0627')
			.replace(/\u0629/g, '\u0647')
			.replace(/\u0649/g, '\u064A');
	}
	return result;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Space-like group marks (`fr` writes U+202F, others U+00A0) are typed as any space.
const SPACE_MARK = /^\s$/u;

/**
 * Reads a typed number in the content language: digits in any script, the
 * Arabic separators, and the language's own decimal and group marks. Text
 * that `Number()` already reads keeps that reading, so `3.5` stays 3.5 in
 * every language; group marks count only in groups of three. Anything
 * else is NaN.
 */
export const parseResponseNumber = (text: string, language?: string): number => {
	const folded = normalizeResponse(text, { language }).trim();
	const direct = Number(folded);
	if (Number.isFinite(direct)) return direct;
	const { decimal, group } = numberMarks(language);
	const groupPattern = SPACE_MARK.test(group) ? '\\s' : escapeRegExp(group);
	const shape = new RegExp(
		`^([+-]?)(\\d{1,3}(?:${groupPattern}\\d{3})+|\\d+)(?:${escapeRegExp(decimal)}(\\d+))?$`,
		'u',
	);
	const match = shape.exec(folded);
	if (!match) return Number.NaN;
	const whole = match[2]!.replace(/\D/g, '');
	return Number(`${match[1]}${whole}${match[3] === undefined ? '' : `.${match[3]}`}`);
};
