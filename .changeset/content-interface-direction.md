---
"@pie-qti/i18n": patch
"@pie-qti/qti-common": patch
"@pie-qti/item-player": patch
"@pie-qti/section-player": patch
"@pie-qti/assessment-player": patch
---

Content and interface direction are now separate: player chrome takes `lang` and `dir` from the interface locale, while the item body, passages, rubrics and modal feedback take them from the content's `xml:lang`, and content that declares no language inherits the chrome's. Nested `xml:lang` spans get a `dir` where their direction differs from the surrounding text. `@pie-qti/i18n` exports `languageDirection`, `canonicalLanguageTag`, `contentLanguageAttributes` and `interfaceLocaleAttributes`, and `@pie-qti/section-player` now depends on `@pie-qti/i18n` directly.
