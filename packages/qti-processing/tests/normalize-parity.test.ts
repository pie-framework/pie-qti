// Parity test: the cases of pie-elements-ng's
// packages/shared/controller-utils/tests/response-normalizer.test.ts, run against
// the port, so the two normalisers stay converged.
import { describe, expect, it } from 'bun:test';
import { foldCase, foldDigits, normalizeResponse } from '../src/runtime/normalize.js';

// Every run of Unicode decimal digits, as the code point of its zero.
const DIGIT_ZEROS: number[] = [];
for (let codePoint = 0, inRun = false; codePoint <= 0x10ffff; codePoint++) {
  const isDigit = /\p{Nd}/u.test(String.fromCodePoint(codePoint));
  if (isDigit && !inRun) DIGIT_ZEROS.push(codePoint);
  inRun = isDigit;
}
// Abutting runs (the mathematical digits) start a new zero every ten.
const ZEROS = DIGIT_ZEROS.flatMap((zero) => {
  const zeros = [zero];
  for (let next = zero + 10; /\p{Nd}/u.test(String.fromCodePoint(next)); next += 10)
    zeros.push(next);
  return zeros;
});

const inSystem = (zero: number, ascii: string) =>
  ascii.replace(/[0-9]/g, (digit) => String.fromCodePoint(zero + Number(digit)));

// A fixed-seed generator, so a failure reproduces.
const random = (() => {
  let seed = 0x2f6b1d;
  return () => {
    seed = (seed * 1103515245 + 12345) % 0x80000000;
    return seed / 0x80000000;
  };
})();
const randomNumber = () => String(Math.floor(random() * 10 ** (1 + Math.floor(random() * 9))));
const randomAscii = (length: number) =>
  Array.from({ length }, () => String.fromCharCode(0x20 + Math.floor(random() * 95))).join('');

const ARABIC_INDIC = 0x0660;
const EXTENDED_ARABIC_INDIC = 0x06f0;
const DEVANAGARI = 0x0966;
const BENGALI = 0x09e6;

describe('foldDigits', () => {
  it('covers every decimal digit system Unicode defines', () => {
    expect(ZEROS).toEqual(
      expect.arrayContaining([0x30, ARABIC_INDIC, EXTENDED_ARABIC_INDIC, DEVANAGARI, BENGALI])
    );
    for (const zero of ZEROS) {
      for (let digit = 0; digit < 10; digit++) {
        expect(foldDigits(String.fromCodePoint(zero + digit))).toBe(String(digit));
      }
    }
  });

  it('folds numbers in every digit system to the same ASCII number', () => {
    for (const zero of ZEROS) {
      for (let i = 0; i < 20; i++) {
        const number = randomNumber();
        expect(foldDigits(inSystem(zero, number))).toBe(number);
      }
    }
  });

  it('leaves characters that are numbers but not decimal digits', () => {
    expect(foldDigits('x² ½ Ⅻ ①')).toBe('x² ½ Ⅻ ①');
  });
});

describe('normalizeResponse', () => {
  it('leaves every ASCII string as it is', () => {
    for (let i = 0; i < 500; i++) {
      const ascii = randomAscii(1 + Math.floor(random() * 30));
      for (const language of [undefined, 'en-US', 'es', 'de', 'fr', 'ar', 'ar-MA', 'tr']) {
        expect(normalizeResponse(ascii, { language })).toBe(ascii);
      }
    }
  });

  it('is idempotent', () => {
    for (let i = 0; i < 200; i++) {
      const value = inSystem(ARABIC_INDIC, `${randomNumber()}٫${randomNumber()} ${randomAscii(8)}`);
      const once = normalizeResponse(value, {
        language: 'ar',
        ignoreCase: true,
        foldLetterVariants: true,
      });
      expect(
        normalizeResponse(once, { language: 'ar', ignoreCase: true, foldLetterVariants: true })
      ).toBe(once);
    }
  });

  it('reads ٫ and ٬ with the marks the content language writes Western digits with', () => {
    expect(normalizeResponse('٣٫٥')).toBe('3.5');
    expect(normalizeResponse('١٬٢٣٤٫٥', { language: 'ar-EG' })).toBe('1,234.5');
    expect(normalizeResponse('١٬٢٣٤٫٥', { language: 'ar-MA' })).toBe('1.234,5');
    expect(normalizeResponse('۱٬۲۳۴٫۵', { language: 'fa' })).toBe('1,234.5');
    expect(normalizeResponse('3٫5', { language: 'de' })).toBe('3,5');
  });

  it('keeps an ASCII comma as written, whatever the content language', () => {
    expect(normalizeResponse('3,5', { language: 'en-US' })).toBe('3,5');
    expect(normalizeResponse('3.5', { language: 'de' })).toBe('3.5');
  });

  it('matches a separator-and-digit answer against its authored ASCII form in each system', () => {
    for (const zero of [ARABIC_INDIC, EXTENDED_ARABIC_INDIC, DEVANAGARI, BENGALI]) {
      for (let i = 0; i < 50; i++) {
        const [whole, fraction] = [randomNumber(), randomNumber()];
        const typed = `${inSystem(zero, whole)}٫${inSystem(zero, fraction)}`;
        expect(normalizeResponse(typed, { language: 'ar' })).toBe(`${whole}.${fraction}`);
      }
    }
  });

  it('falls back to point-decimal marks for an invalid tag', () => {
    expect(normalizeResponse('٣٫٥', { language: 'not a tag!' })).toBe('3.5');
  });

  it('keeps point-decimal marks for a tag the runtime has no data for, on a host in any locale', () => {
    // A German host: Intl resolves a tag it has no data for to `de`.
    const NumberFormat = Intl.NumberFormat;
    class GermanHostNumberFormat extends NumberFormat {
      constructor(locales?: string | string[], options?: Intl.NumberFormatOptions) {
        super(NumberFormat.supportedLocalesOf(locales ?? []).length ? locales : 'de', options);
      }
    }
    Intl.NumberFormat = GermanHostNumberFormat;
    try {
      for (const language of ['xx', 'und', 'english']) {
        expect(normalizeResponse('١٬٢٣٤٫٥', { language }), language).toBe('1,234.5');
      }
      expect(normalizeResponse('١٬٢٣٤٫٥', { language: 'it' })).toBe('1.234,5');
    } finally {
      Intl.NumberFormat = NumberFormat;
    }
  });

  it('composes decomposed text to NFC', () => {
    expect(normalizeResponse('e\u0301')).toBe('é');
    expect(normalizeResponse('ا\u0653')).toBe('آ');
  });

  it('removes bidi controls and tatweel', () => {
    expect(normalizeResponse('\u200F١٢\u200E \u2067x\u2069 \u061C\u202Bي\u202C')).toBe('12 x ي');
    expect(normalizeResponse('كــتــاب')).toBe('كتاب');
  });

  it('folds Arabic presentation forms to their base letters', () => {
    expect(normalizeResponse('ﻟﻤﻮ')).toBe('لمو');
    expect(normalizeResponse('ﻻ')).toBe('لا');
  });

  it('folds Arabic letter variants only when asked', () => {
    const variants = 'أَحْمَد إِلى آمِنة مدرسة';
    expect(normalizeResponse(variants)).toBe(variants.normalize('NFC'));
    expect(normalizeResponse(variants, { foldLetterVariants: true })).toBe('احمد الي امنه مدرسه');
  });

  it('folds case only when asked, in the content language', () => {
    expect(normalizeResponse('Paris')).toBe('Paris');
    expect(normalizeResponse('Paris', { ignoreCase: true })).toBe('paris');
    expect(normalizeResponse('İSTANBUL', { language: 'tr', ignoreCase: true })).toBe('istanbul');
    expect(normalizeResponse('ISPARTA', { language: 'tr-TR', ignoreCase: true })).toBe('ısparta');
  });

  it('never parts two strings that toLowerCase() folds together, outside Turkish and Azerbaijani', () => {
    // Letters with special casing, combining marks of different classes, and
    // the characters the normalizer removes or replaces.
    const pool = [
      ...'aeiIİıσςΣsßẞǅǄﬀΩÅKΐǰ١٫٬ .',
      '\u0301',
      '\u0307',
      '\u0308',
      '\u0327',
      '\u0345',
      '\u200E',
      '\u0640',
      '\u061C',
      '\u202E',
      '\u212B',
    ];
    for (let i = 0; i < 20000; i++) {
      let authored = '';
      let typed = '';
      for (let length = 1 + Math.floor(random() * 6); length > 0; length--) {
        const char = pool[Math.floor(random() * pool.length)];
        authored += char;
        typed += random() < 0.5 ? char.toUpperCase() : char.toLowerCase();
      }
      if (authored.toLowerCase() !== typed.toLowerCase()) continue;
      for (const language of [undefined, 'en-US', 'de', 'el', 'lt', 'ar']) {
        expect(
          normalizeResponse(typed, { language, ignoreCase: true }),
          JSON.stringify([authored, typed, language])
        ).toBe(normalizeResponse(authored, { language, ignoreCase: true }));
      }
    }
  });
});

describe('foldCase', () => {
  it('folds dotted and dotless i in Turkish and Azerbaijani', () => {
    for (const language of ['tr', 'az']) {
      expect(foldCase('İ', language)).toBe('i');
      expect(foldCase('I', language)).toBe('ı');
    }
  });

  it('folds accented capital I to the accented i in Lithuanian', () => {
    expect(foldCase('Ì Í Ĩ', 'lt')).toBe('ì í ĩ');
  });

  it('folds as toLowerCase() without a language or with an invalid one', () => {
    expect(foldCase('İI')).toBe('İI'.toLowerCase());
    expect(foldCase('İI', 'not a tag!')).toBe('İI'.toLowerCase());
    expect(foldCase('Paris', 'en-US')).toBe('paris');
  });
});
