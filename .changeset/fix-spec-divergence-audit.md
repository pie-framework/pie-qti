---
'@pie-qti/qti-processing': patch
---

`patternMatch` and the `patternMask` input check now read patterns as XML Schema regular expressions, as QTI specifies, instead of as JavaScript ones. These patterns now behave as the XSD standard defines them:

- `^` and `$` are ordinary characters, because an XSD pattern always matches the whole response. `^abc$` matches the text `^abc$`, not `abc`.
- `.` matches any character except a newline or carriage return.
- `\s` matches only a space, tab, newline or carriage return, so a non-breaking space no longer counts.
- `\w` matches any character except punctuation, separators and control characters. Accented letters and symbols such as `+` now count, and `_` no longer does.
- `\i` and `\c` (XML name characters) and their complements are supported.
- Block escapes such as `\p{IsBasicLatin}` are supported.
- Character class subtraction such as `[a-z-[aeiou]]` is supported.

Patterns that use none of these constructs match as before.
