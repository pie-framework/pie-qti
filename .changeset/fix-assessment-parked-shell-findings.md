---
'@pie-qti/assessment-player': patch
'@pie-qti/i18n': patch
'@pie-qti/player-elements': patch
---

The assessment shell's two remaining double-state controls, the dialog action-button styles, and a duplicate-bundle finding from the final review round are fixed.

**The timer control keeps one name in both states (WCAG 4.1.2).** Its accessible name used to flip between "Show timer" and "Hide timer" while `aria-expanded` changed at the same time, so the state was announced twice and the name a voice-control user speaks changed with every press. The control is now a disclosure named for what it reveals — a stable "Timer" (`assessment.timer.label`, new in all locales) — and `aria-expanded` (with `aria-controls` while the countdown exists) alone carries the state.

**Breaking: locale keys removed and a visible label renamed** (beta prerelease). `assessment.timer.showTimer` and `assessment.timer.hideTimer` have no use left and are removed from all locales (hence the `@pie-qti/i18n` entry); hosts that override them in a custom catalog can drop the overrides. Hosts that depended on the visible "Show timer" / "Hide timer" text (tests or voice-control grammars) now see "Timer" in both states.

**The review button carries its state exactly once (WCAG 4.1.2).** Its visible label still flips ("Review questions" when the review screen is closed, "Back to question" when it is open — the two views genuinely differ, and the label is the only affordance back out of review), and it is the accessible name, so `aria-expanded` is removed: it announced the same fact a second time, and the whole main region it swaps is no disclosed region of this control. `aria-pressed` was considered and rejected for the same reason. Its visible labels are unchanged.

**The dialog action buttons' styles have one source.** The `.submit-dialog-action` rule family was copied across the submit confirmation, the resume prompt and the leave-part warning, and the copies had drifted. They now share one injected rule (`submitDialogAction.ts`, once per document, after the default-components `srOnly.ts` idiom); the class stays the theme hook and every declaration is unchanged, so the rendered styles are identical.

**`@pie-qti/player-elements` ships each module once.** The bundle compiled the two players' Svelte components from source while a bare `@pie-qti/assessment-player` / `@pie-qti/section-player` import resolved to those packages' built `dist` — a second module identity for code the bundle also carried as source. Seven assessment- and section-player modules shipped twice (~7.6 KB; the coded-error class stayed one identity only through its `Symbol.for` brand). The build now pins the two bare names to the same source entry every other import uses: total dist JS drops from 9,764,880 to 9,757,312 bytes on identical sources, duplicated modules 7 → 0, and the error brand key appears exactly once. Consumers are unaffected — the package stays a self-contained bundle with zero runtime bare imports, and public types still resolve to the built declarations. Pinned by `tests/bundle-single-copy.test.ts`, which reads the built sourcemaps and fails if any module is bundled from both a package dist and its source.
