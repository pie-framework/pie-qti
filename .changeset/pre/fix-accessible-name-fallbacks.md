---
'@pie-qti/default-components': patch
'@pie-qti/i18n': patch
---

Accessible names of interactive choices no longer fall back to the QTI identifier. A choice whose content has no readable text (an image without `alt`, empty markup) is now named by a localized ordinal of its presented position ("Choice 3"; new `accessibility.choiceFallback` catalog key, translated in all eight locales) — an identifier is author-internal, meaningless to candidates, and can leak the answer key (`CORRECT_A`) through a screen reader. The shared helper `choiceAccessibleName` (`@pie-qti/default-components` `shared/utils/choiceName`) applies this to the associate interaction (choice labels, pair-removal and limit-refusal announcements, remove-control names), the match interaction (minimum-requirement hint, source/target names, pair-made/cleared and limit announcements, clear-control names) and the gap-match interaction (alt-less `gapImg` palette tiles and pick-up/placement/removal announcements). A content-less choice can no longer be announced as, say, "Removed association between SECRET_KEY and France."
