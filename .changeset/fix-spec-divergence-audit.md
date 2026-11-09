---
'@pie-qti/qti-processing': patch
'@pie-qti/item-player': patch
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

End-attempt buttons such as "Show a hint" now give response processing the values QTI specifies. When the candidate ends the attempt with one of these buttons, its response is `true` and every other end-attempt response is `false`. When the attempt ends any other way, for example by submitting, every end-attempt response is `false`. Before this change, a hint pressed in an earlier attempt still read as `true` in later attempts, so its feedback could show again. An end-attempt response that was never pressed read as `NULL` or as its declared default, which QTI says to ignore.

A `gapMatchInteraction` gap marked `required="true"` must now be filled before the response counts as complete, as QTI specifies. The interaction data lists these gaps as `requiredGaps`. Response validation (`canSubmit` and the assessment player's `validateResponses` check) reports the response incomplete while a required gap is empty.
