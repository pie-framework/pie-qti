# @pie-qti/i18n

## 1.0.0-beta.5

### Minor Changes

- 6d4d19d: `DefaultI18nProvider.t` and `SvelteI18nProvider.t` now declare two overloads: the first types the key as `MessageKey` (the English-catalog key union) so editors complete keys and a typo stands out against the union; the second is a documented escape overload accepting `string` for keys that live in a host's `customMessages` catalog. The runtime key namespace is framework keys plus custom keys, so a plain-string escape overload cannot reject a misspelled framework key by itself — compile-time enforcement of literal keys is the new `check-consumer-keys` scan in `check:i18n`. The `I18nProvider` interface and `translate()`/`translatePlural()` keep `key: string`, because hosts bring their own backends and components pass keys held in string-typed structures. Nothing that compiled before stops compiling.
  
  Behaviour change: the missing-key `console.warn` is no longer gated on `NODE_ENV === 'development'`. A key no catalog carries now warns in every environment — production builds included, which is where such a regression ships; the warning previously never fired there. It warns exactly when a lookup misses (the UI then degrades to the English default or the key itself), so quiet production logs mean every rendered key resolved.
  
  The README's component-integration section documented `i18n?.t(key) ?? fallback` as a helper pattern; `t()` never returns nullish, so that fallback was dead code that rendered raw key names for anyone copying it. The section now documents the real contract — the English default is `t`'s second argument and the trailing `??` covers only the provider being undefined — and the bundled `LocaleSwitcher` reference component uses that shape.

### Patch Changes

- 23a4077: Graphic interactions close their spec gaps: hotspot multiple selection, the hotspot `default` shape, graphic order's areas on the image, and graphic associate's per-shape hit areas.
  
  **Hotspot multiple selection.** A `hotspotInteraction` whose `maxChoices` is above `1`, or `0` for no restriction (QTI 3.0 §5.68.2 binds those to a multiple-cardinality response), now answers with the list of selected regions instead of behaving as single selection. Each region is an `aria-pressed` toggle button: activating it toggles it. At `maxChoices` a further selection is refused — nothing changes, nothing is emitted — and the limit is announced politely, using the author's `data-max-selections-message`, else `interactions.hotspot.maxChoicesReached` (new i18n key; the text `choiceInteraction` and hottext use). "Clear answer" clears every region and emits `[]`; a restored array response (including a single selection bound to a multiple response) shows its regions. `minChoices` stays enforced by `Player.validateResponses()`, and the hint counts every selected region. Single selection (`maxChoices=1`) is unchanged.
  
  **Hotspot `default` shape.** QTI 3.0 §8.29 defines the `default` shape as "the entire area of the associated image". `HotspotShape` now draws it as a full-image region, painted beneath every other region so another region's click stays its own, reached by keyboard and named like any region (`hotspotLabel`, else "Region N of M"). The hotspot extractor accepts a default-shape choice without `coords`; every other shape still requires them. Graphic gap match draws its hotspots with the same `HotspotShape`, so a default-shape hotspot there now covers the whole image too (painted in authored order) instead of drawing nothing.
  
  **Graphic order shows its areas.** QTI 3.0 §5.61: "The delivery engine must clearly indicate all defined area(s) of the image." An SVG overlay in the image's pixel space outlines every hotspot and gives each placed one its position in the order, so a candidate can tell which area a list entry names. The overlay is visual only (`aria-hidden`, no pointer input); the ordering list and its controls are unchanged, and it scales with the image on small screens.
  
  **Graphic associate hit areas are the hotspot shapes.** QTI 3.0 §5.7.5–5.7.6: a hotspot is the area its `shape` and `coords` describe. Each hotspot button now takes no pointer input over its bounding box; the `HotspotShape` drawn inside it does, so a press inside a polygon's bounding box but outside the polygon no longer selects it. The buttons stay the keyboard and assistive-technology controls with their focus indicators, and the image shows each hotspot's real outline and state.
  
  **Correct-answer mode.** Hotspot, graphic order and graphic associate now take correct-answer mode from `createInteractionShell` (`role === 'scorer'` with a correct response), like the other interactions; previously a scorer view of an item without a correct response rendered in correct-answer mode (in practice invisible, since the flagged lists were empty — now pinned by tests).
  
  `InteractionValueMap.hotspotInteraction` is retyped to `string | string[] | null` to match what the component emits (a follow-up to the phase 2 value-type changes). Hosts that type `qti-change` handlers through that map must accept the list form.
- bd67d58: Interaction controls now expose their state once, through their ARIA state, and controls with the same function share one name.
  
  - **Single-select hotspot is a radio group** (WCAG 4.1.2). With `maxChoices=1` the hotspot overlay is a `role="radiogroup"` (named by the prompt) of `role="radio"` regions with `aria-checked`, like the single-select hottext and `choiceInteraction`'s radios: one Tab stop (roving tabindex), arrow keys that move to the next or previous region and check it (mirrored under RTL), Space and Enter to check, and no unchecking by clicking, tapping or pressing the checked region again. A "Clear answer" button, the same control and name as in `choiceInteraction` and hottext, retracts the answer. Disabled regions carry `aria-disabled`. Multiple selection keeps `aria-pressed` toggle buttons.
  - **No state words in accessible names** (WCAG 4.1.2). Hottext spans are named by their content alone; the "Selected"/"Selectable" word that repeated `aria-checked`/`aria-pressed` is gone, and an empty `<hottext>` is named by its position ("Choice 2"). The elimination toggles of `choiceInteraction` and `orderInteraction` keep the name "Eliminate {choice}" when pressed, instead of flipping to "Restore {choice}". An order item with nothing to read is named by its position instead of its identifier. Graphic-gap-match palette labels keep their own name when picked up or placed; the pick-up and place hint is now their description. A position-object palette object no longer adds "Selected for placement." to its name.
  - **Select point's clear control reads "Clear answer"** (WCAG 3.2.4), the name the other interactions use for that control, instead of "Clear All".
  - **No invented expected length for the extended-text counter.** An absent `expectedLength` stays absent: it is a hint with no default in any QTI version. `ExtendedTextInteractionData.expectedLength` is now optional. Without an authored length, `qti-counter-up` and `qti-counter-down` show no counter instead of counting against 200.
  
  **Breaking: locale keys removed** (beta prerelease). `interactions.hottext.selectedState`, `interactions.hottext.selectableState`, `interactions.choice.restoreChoice`, `interactions.order.restoreItem` and `interactions.graphicGapMatch.selectedHint` have no use left and are removed from all locales. `interactions.graphicGapMatch.heldHint` drops its leading "Picked up." sentence. Hosts that override these keys in a custom catalog can drop the overrides.
- 0f11f98: Accessible names of interactive choices no longer fall back to the QTI identifier. A choice whose content has no readable text (an image without `alt`, empty markup) is now named by a localized ordinal of its presented position ("Choice 3"; new `accessibility.choiceFallback` catalog key, translated in all eight locales) — an identifier is author-internal, meaningless to candidates, and can leak the answer key (`CORRECT_A`) through a screen reader. The shared helper `choiceAccessibleName` (`@pie-qti/default-components` `shared/utils/choiceName`) applies this to the associate interaction (choice labels, pair-removal and limit-refusal announcements, remove-control names), the match interaction (minimum-requirement hint, source/target names, pair-made/cleared and limit announcements, clear-control names) and the gap-match interaction (alt-less `gapImg` palette tiles and pick-up/placement/removal announcements). A content-less choice can no longer be announced as, say, "Removed association between SECRET_KEY and France."
- 4e5f1a8: Accommodations and tools in the section player.
  
  - **Display accommodations cover the whole section.** A section layout (`SectionPlayerSplitPane`, `SectionPlayerVertical` and their custom elements) applies the candidate's PNP display needs — colour scheme, inverted polarity, single-column layout, text appearance, magnification metadata — to its own root, a PNP surface, so passages, stimuli, rubric blocks, tool bars, the Passage/Question tabs, item headers and items all take them. The host page outside the layout is never repainted. Item bodies inside a surface leave their display needs to it, so one profile governs passage and question and an inverting filter applies once. A single-column need stacks the split pane behind its tabs at any width. The layouts apply their `pnp` prop, else the new `ResolvedQtiSectionComposition.pnp`, which `resolveQtiSectionComposition` now carries along with `assessmentId`.
  - **Candidates can adjust their display.** A "Display settings" button in the item tool bar opens an accessible native modal on the section surface: text size (Default, Large, Larger, Largest), higher-contrast text and extra text spacing, applied through the PNP mechanisms (`withDisplaySettings`). Settings last for the page session per assessment, also across a split-pane/vertical layout swap, and every change reaches the host as `{ sectionIdentifier, settings, pnp }` through the layouts' `onDisplaySettingsChange` and `QtiSectionRuntimeHostContract.onDisplaySettingsChange`, with the effective profile to persist. `displaySettings={false}` leaves the tool out; `initialDisplaySettings` and `displaySettingsOf()` restore persisted settings.
  - **Ruler and protractor render.** The tool bars register the packaged `ruler` and `protractor` tools, so the measurement tools the PNP and an item's companion materials grant are no longer granted but invisible. Companion materials become the item scope's required tools, and section-scoped tools render on the active item's tool bar.
  - **Tool bars bind the real assessment, with PNP enforcement on.** The hardcoded `qti-section-demo` id is gone: the toolkit takes the composition's `assessmentId` (else the section identifier) and the candidate's PNP tool supports as its profile, so granted tools are protected and prohibited ones withdrawn.
  - `@pie-qti/item-player` exports `applyPnpToSurface`, `clearPnpSurface`, `isWithinPnpSurface` and `PNP_SURFACE_ATTRIBUTE` for hosts that paint a larger surface themselves.
  - New catalog keys `sectionPlayer.displaySettings.*` in every locale.
- 2fa635f: The assessment shell's two remaining double-state controls, the dialog action-button styles, and a duplicate-bundle finding from the final review round are fixed.
  
  **The timer control keeps one name in both states (WCAG 4.1.2).** Its accessible name used to flip between "Show timer" and "Hide timer" while `aria-expanded` changed at the same time, so the state was announced twice and the name a voice-control user speaks changed with every press. The control is now a disclosure named for what it reveals — a stable "Timer" (`assessment.timer.label`, new in all locales) — and `aria-expanded` (with `aria-controls` while the countdown exists) alone carries the state.
  
  **Breaking: locale keys removed and a visible label renamed** (beta prerelease). `assessment.timer.showTimer` and `assessment.timer.hideTimer` have no use left and are removed from all locales (hence the `@pie-qti/i18n` entry); hosts that override them in a custom catalog can drop the overrides. Hosts that depended on the visible "Show timer" / "Hide timer" text (tests or voice-control grammars) now see "Timer" in both states.
  
  **The review button carries its state exactly once (WCAG 4.1.2).** Its visible label still flips ("Review questions" when the review screen is closed, "Back to question" when it is open — the two views genuinely differ, and the label is the only affordance back out of review), and it is the accessible name, so `aria-expanded` is removed: it announced the same fact a second time, and the whole main region it swaps is no disclosed region of this control. `aria-pressed` was considered and rejected for the same reason. Its visible labels are unchanged.
  
  **The dialog action buttons' styles have one source.** The `.submit-dialog-action` rule family was copied across the submit confirmation, the resume prompt and the leave-part warning, and the copies had drifted. They now share one injected rule (`submitDialogAction.ts`, once per document, after the default-components `srOnly.ts` idiom); the class stays the theme hook and every declaration is unchanged, so the rendered styles are identical.
  
  **`@pie-qti/player-elements` ships each module once.** The bundle compiled the two players' Svelte components from source while a bare `@pie-qti/assessment-player` / `@pie-qti/section-player` import resolved to those packages' built `dist` — a second module identity for code the bundle also carried as source. Seven assessment- and section-player modules shipped twice (~7.6 KB; the coded-error class stayed one identity only through its `Symbol.for` brand). The build now pins the two bare names to the same source entry every other import uses: total dist JS drops from 9,764,880 to 9,757,312 bytes on identical sources, duplicated modules 7 → 0, and the error brand key appears exactly once. Consumers are unaffected — the package stays a self-contained bundle with zero runtime bare imports, and public types still resolve to the built declarations. Pinned by `tests/bundle-single-copy.test.ts`, which reads the built sourcemaps and fails if any module is bundled from both a package dist and its source.
- 756771f: Accessibility and usability fixes for the choice, hottext, slider, and end-attempt interactions:
  
  - **choice**: visible keyboard focus on the whole row (including with `qti-input-control-hidden`), a ≥44px row target with a non-color selected state and 1rem base text, container-query reflow for `qti-choices-stacking-N`/horizontal layouts, an always-prompt-named answer group (`aria-labelledby`), a localized refusal message at `maxChoices` when none is authored, a "Clear answer" button for single choice, contrast fixes for the selection message and elimination toggle (44px target), and elimination toggles named from their action plus the choice text.
  - **hottext**: accessible names composed via `aria-labelledby` from the rendered content and a localized state word (no hardcoded "Selectable text:" prefix), a visible focus indicator under `qti-input-control-hidden`, a ≥3:1 selectable boundary cue, the localized refusal default at `maxChoices`, and a non-color correct-answer marker (underline plus hidden text) in the scorer view.
  - **slider**: the accessible name comes from the prompt (`aria-labelledby`) with `aria-valuetext`; before the first interaction the slider announces and displays "No value selected" in a distinct untouched state instead of presenting the midpoint; `orientation="vertical"`, `reverse`, and `stepLabel` are now rendered.
  - **end attempt**: counted attempts require an inline confirmation (focus on confirm, Escape cancels) before the response is emitted; after ending, focus moves to an announced `role="status"` message ("Your attempt has ended."); the accessible name is the visible label; controls use self-contained token styles at ≥44px.
  - **item-player**: `SliderInteractionData` now carries the authored `stepLabel` flag; `@pie-qti/i18n` adds candidate-facing strings for these behaviors across all eight locales.
- bdfc40e: Fix accessibility and QTI compliance in the drag/association interactions.
  
  - Rich choice content no longer collapses into a flattened `aria-label`: sortable, match and associate controls are named with `aria-labelledby` pointing at the rendered content, so image `alt` and MathML `alttext` participate in the name. Position/state sentences ("Position 2 of 4", "Matched with …", "Selected") moved to `aria-describedby` targets, and live announcements use a new `accessibleTextFromHtml` walker that reads image alt, MathML alttext and SVG titles instead of raw `textContent` (WCAG 1.1.1/4.1.2).
  - Raw QTI identifiers no longer leak into accessible names: associate choices drop the "A_choice_2: Paris" prefix and gap-match blanks are named with localized ordinals ("Blank 2 of 4") instead of the gap identifier, which could reveal answers to screen-reader users.
  - `gapMatchInteraction` now supports `gapImg` (QTI 2.x `gapImg` with `<object>`, QTI 3.0 `qti-gap-img` with `<img>`/`<object>`): image choices are extracted into the pool with alt text and matchMax/matchGroup, rendered as image tiles in the palette and inside filled gaps, and validation accepts an image-only item instead of erroring "must have at least one gapText".
  - Contrast and target-size fixes (WCAG 1.4.11/2.5.8): empty gap-match blanks and match drop zones use a 3:1 boundary (`--pie-qti-border-strong`), the gap-match focus ring is solid `--pie-qti-focus` without alpha, the held-word cue uses `--pie-qti-border-strong`, the match clear button, gap-match remove buttons and blanks are 44px targets, and the match max-selections message uses the warning text token for 4.5:1 text contrast.
  - Order interaction: the elimination toggles now render inside their item's row (aligned at any row height), and move/eliminate buttons are named for their item ("Move Paris later", "Eliminate Paris"), including image alt from rich item content.
  - Escape now cancels a held word (gap-match) or selected source (match), announces the cancellation and returns focus to the item.
- 0973689: The standalone item player no longer destroys the candidate's attempt state when a host writes a property on it (final-review findings F1, F3, F7, F10, F11).
  
  **Breaking:**
  
  - Standalone delivery now hides integrated feedback (`feedbackInline` / `feedbackBlock`) unless the host opts in, as QTI `itemSessionControl@showFeedback` (default `false`) requires. Hosts that relied on the old always-show behaviour pass `showFeedback: true` (property or `show-feedback` attribute); `showSolution` / `show-solution` opts into correct responses after the attempt ends. An injected `session` keeps its own presentation policy.
  - The `<pie-qti-item-player>` role attribute is renamed to `qti-role`: a bare `role` attribute is the ARIA role, and writing a QTI view name there put an invalid ARIA token on host pages (axe `aria-roles`). The `role` JS property keeps working; unknown `qti-role` values now render as `candidate` with a diagnostic instead of silently going read-only.
  
  **Fixed:**
  
  - Any property write on a mounted item element — a response write, a no-op `disabled` write, a section composition re-assign — used to re-create the item's owned `AssessmentItemDefinition` + `ItemSession`, re-rolling `shuffle` choices mid-answer, re-randomizing template values, wiping submitted modal feedback and resetting adaptive `numAttempts`. The session now re-opens only when a definition-fixed input (`itemXml`, `qti-role`, `security`, `pnp`, `deliveryContext`, `pci`, `stringComparison`, `plugins`, `showFeedback`, `showSolution`) truly changes; `disabled`, `i18n`, `typeset`, `responses` and no-op writes never re-open, and a re-open of the same item replays the same template-processing seed.
  - The element keeps the session it owns across a detach and adopts it again on reattach, so re-parenting the element (framework re-orders, layout moves) resumes the attempt instead of restarting the item.
  - Re-using the element across items no longer fails hard on stale `responses`: values the new item declares carry over, the rest are dropped with a diagnostic (`UnknownResponseIdentifierError` is exported for hosts that want to detect it).
  - A broken item dispatches a typed, bubbling `error` event with detail `{ code, message, itemIdentifier? }` (`item-load-failed`, `response-processing-failed`, `submission-failed`, `render-failed`) and renders a localized generic candidate message instead of the raw parser/engine string; the raw detail goes to the host event only. `ready` now fires only on success, once per successful mount. **Breaking:** hosts that listened for `ready` on broken items receive `error` instead.
  - The item element's attribute list is now documented accurately in `@pie-qti/player-elements`' README, including the attribute-backed `locale` and the fact that `showSubmit` stays `false` (hosts call `submit()`).
  - `item.submitError` ships in all eight locales for the candidate-facing submission-failure message.
- f6e7714: Typed spaces are no longer silently deleted from text answers, and a round of WCAG fixes for the interaction components.
  
  - **A string response is stored exactly as typed** (data corruption). The session read every response through `String(raw).trim()` at rest, and the text fields are controlled by the stored response — the extended text rebuilds its fields from what the session holds after every keystroke, and the custom-interaction fallback copies the stored value into its textarea — so a trimmed value echoed back into the focused field and deleted the space the candidate had just typed: "a b c" typed key by key came out "abc" in the field and in the stored response. Pasting was unaffected, which hid the bug from fill-based tests. String responses are now stored verbatim (spaces and newlines included); text that is entirely white space is still no response, numbers keep their numeric reading, identifier responses stay trimmed identifiers, and a numeric record's `stringValue` keeps its text as typed. **Note for scorers:** string scoring compares the text as stored, exactly, as QTI defines `match` — a "Paris " answer and the authored "Paris" are now the different strings they are, where trimming at rest used to equate them. Trim at the comparison if a host wants the old tolerance.
  - **The extended text keeps the fields' text when the stored value comes back** differing only by surrounding white space (a host may normalize what it stores): rebuilding the fields from that echo would delete the space just typed. A restored or emptied response still reaches the fields.
  - **The custom-interaction fallback's manual textarea** no longer rewrites what the candidate is typing when the stored value is the field's own text less surrounding white space — a leading space (stored as no response until the first word) survives.
  - **The order and graphic-order confirm button is named by its visible label** (WCAG 2.5.3 Label in Name): the visible "Confirm Order (No Changes)" is the accessible name again instead of a different sentence in `aria-label`; the sentence saying what confirming means is now the button's description.
  - **Removing a point, or clearing all points, is announced in select point** (WCAG 4.1.3 Status Messages): the message was written before the focus move and instantly replaced by the crosshair position announcement; it is now announced after the focus move, and a repeat (the next point takes the removed one's number) is a change of the live region's text too.
  - **A position-object palette object is named by its visible text** (WCAG 2.5.3): "Austin. 0/1 used." instead of "Austin (0/1 used).", which a parenthetical-stripping label-in-name match could not find the visible label in.
  - **The graphic-associate associations panel reflows at 320 CSS px** (WCAG 1.4.10): its fixed 20rem basis overflowed the viewport (right edge 376px); it now takes the container's width when it wraps below the image.
  - **Graphic-associate on-image hotspot labels wrap** instead of clipping to one line with an ellipsis, so nothing is lost under the WCAG 1.4.12 text-spacing tolerance ("Gas Exchange" needed 108px in a 96px box); default-spacing rendering is unchanged where labels fit.
  - **The order interaction's idle elimination toggles meet non-text contrast** (WCAG 1.4.11): the idle glyph and boundary rendered at 2.85:1 through `opacity: 0.4`; they are now full strength like choice's equivalent toggle, and the eliminated state stays distinct through the checked style (error-text glyph and boundary, heavier boundary, tinted fill), not by colour alone.
  - Position-object's palette name is built from two locale keys (`interactions.positionObject.objectUsage` / `objectUsageUnlimited`) that no component reads any more; both are removed from all locales.
- eb50277: Graphic interactions: WCAG 2.2 AA fixes for hotspot, graphic order, graphic associate, graphic gap match, select point, position object and drawing.
  
  **Authored image alternatives are no longer discarded (WCAG 1.1.1).** The extractors now carry the author's text alternative to the renderers: the `<object>` fallback text (QTI 2.x), `<img alt>` (QTI 3.0 content, where `alt=""` marks the image decorative), `aria-label`/`aria-labelledby`/`aria-describedby` on the image (references resolved), and inline SVG `<title>`/`<desc>` (as name and long description). Every graphic renderer now presents the background image with that alternative — or a localized generic name as a last resort — instead of a placeholder like "Hotspot interaction"; decorative images get `alt=""`. Images that fail to load show a localized message with their alternative text.
  
  **QTI identifiers never reach assistive technology.** Hotspot regions are named by their authored `hotspotLabel` or a localized ordinal ("Region 2 of 4"); graphic-order items, graphic-associate hotspots, graphic-gap-match labels and position objects likewise fall back to localized ordinals/generic names instead of their identifiers, which could reveal the answer key. Selected-region summaries, scorer views and remove buttons use these names too.
  
  **Region visibility, focus and selection states (WCAG 1.4.1, 1.4.11, 2.4.7).** Hotspot and graphic-gap-match regions draw a light halo under a dark outline so the boundary shows on any image (`qti-selections-light`/`qti-selections-dark` supported); keyboard focus draws a high-contrast ring; selection adds a thicker outline plus a check marker or stripe pattern, so state never relies on colour alone; hard-coded colours are replaced by theme tokens (`--pie-qti-border-strong`, `--pie-qti-focus`, `--pie-qti-*-text`). The hotspot max-selections message now uses the accessible warning text colour (was 1.76:1).
  
  **Small hotspot regions get a 24×24 CSS px pointer target (WCAG 2.5.8)** via an invisible, non-scaling hit stroke, without changing the scoring geometry.
  
  **Select point is no longer a button containing buttons.** The image area is a labelled `application` surface with documented keyboard crosshair keys; placed points live in an accessible list with "Remove point 2" buttons; placement and removal are announced via a polite live region.
  
  **Reflow (WCAG 1.4.10).** All graphic interaction images scale to their container (up to their natural size), and hotspot/associate/gap-match/position-object overlays map rendered positions back to the image's natural pixel space, so responses stay in the coordinates QTI scores. Position-object placements now record the object's centre point and work on touch via the shared touch-drag helper.
  
  Authoring diagnostics (missing image dimensions) are no longer shown to candidates (console warning; still visible to non-candidate roles), and graphic-order passes its i18n provider to the sortable list so reorder announcements are localized. New `interactions.graphicAssociate` locale section; new keys across all eight locales.
- 7c451f7: **Behavior change: a single-select hottext no longer deselects when the candidate activates the selected word again.** With `maxChoices=1` the hottext spans now work like the radio buttons of a single-choice question. Clicking, tapping, or pressing Enter or Space on the selected span keeps it selected and fires no `qti-change`. Selecting another span still replaces the answer. To retract the answer, the candidate uses the "Clear answer" button. Multi-select hottext (`maxChoices` other than 1) is unchanged: activating a selected span still deselects it, as a checkbox does.
  
  Assistive technology now gets semantics that match this behavior (WCAG 4.1.2). The passage container of a single-select hottext is a `role="radiogroup"` with the same accessible name, and each span is a `role="radio"` with `aria-checked` instead of an `aria-pressed` toggle button. The keyboard follows the WAI-ARIA radio group pattern:
  
  - the group is one Tab stop (the selected span, or the first);
  - the arrow keys move to the next or previous span and select it, wrapping at either end, with Left and Right mirrored in right-to-left text;
  - arrow keys held with Alt, Ctrl or Meta are left to the browser;
  - Space and Enter select the focused span.
  
  The spans stay inline in the text.
  
  The hottext clear button now reads "Clear answer", for single and multiple selection alike, matching the control with the same function in the choice interaction (WCAG 3.2.4). Like that control, it appears only while there is an answer and the interaction is enabled, and after clearing it moves focus to the first hottext span. While disabled, the hottext spans also report `aria-disabled="true"`. The now-unused `interactions.hottext.clearSelection` message is removed from every locale. A host that overrides the button label should use `interactions.choice.clearAnswer`, the key it now shares with the choice interaction.
- 3a31af2: Follow-up fixes for i18n fallbacks, instance-unique ids, position-object placement, and the associate remove control:
  
  - **i18n fallbacks**: a missing key's default is now interpolated exactly like a translated message (one shared interpolation, including the locale's digits), so candidates no longer see literal text such as "Blank {index} of {count}". `translatePlural` falls back to its English forms when no catalog carries the plural group, instead of returning the raw key (`some.group.other`). `translate` also fills a default that a host `I18nProvider` hands back verbatim, and without a provider a nullish value leaves its placeholder visible rather than printing "undefined".
  - **Instance-unique ids**: the match prompt id (`qti-match-prompt-<responseId>`, which crossed each group's `aria-labelledby` between two renderings of the same item) and the associate helper id now come from the component instance. Associate choices no longer reference the helper while it is hidden for correct answers.
  - **positionObjectInteraction**: the QTI `centerPoint` attribute is now honoured. It is extracted as an `{ x, y }` offset from the object image's top-left (`PositionObjectInteractionData.centerPoint: PositionObjectCenterPoint | null`, where `null` is the spec default, the centre of the object's bounding rectangle) from every spelling: `centerPoint` (QTI 2.2), `centrePoint` (QTI 2.1), `center-point` (QTI 3.0) and `centre-point` (a converted QTI 2.1 item). The component places and drags objects by that point, for pointer, touch and keyboard placement alike, so it sits on the recorded response point. This replaces the earlier `centerPoint: boolean`; a host passing the boolean in hand-built JSON gets the default centre placement, and the former top-left placement of `false` is now written `{ x: 0, y: 0 }`.
  - **associate**: the pair-remove button no longer relies on DaisyUI `btn` classes and carries its own 44×44 CSS px target, and after a pair is removed focus stays in the pair list (the pair that moved into the removed row, or the first choice when none remain) instead of dropping to the document. Unpaired choices no longer have the word "false" as their screen-reader description.
- 2f43e0e: Follow-ups to the media, extended text and theme fixes: typable negative answers on phones, inline video on iOS, a PNP spell-check grant, validated PNP colours, and state text contrast on tinted DaisyUI themes.
  
  **Text entry and extended text (numeric keyboards)**
  
  - A numeric virtual keyboard (`inputmode="numeric"`/`"decimal"`) is now requested only when the authored `patternMask` provably excludes `-` (for example `^[0-9]+$`): phone number pads have no minus key (nor an exponent), so a candidate with a negative answer could not have typed it. Every other numeric response keeps the default text keyboard, in both the inline text entry and the extended text interaction.
  - The candidate's PNP spell-check grant (AfA PNP 3.0 `spell-checker-on-screen`, parsed into `cognitive.spellChecker`) now enables spell check and autocorrect in the extended text interaction, like the `spellcheck` prop does; the item body passes the profile to every interaction as the `pnp` prop.
  
  **Media (`pie-qti-media`)**
  
  - Video is always rendered `playsinline` (plus `webkit-playsinline` for pre-iOS-10 WebViews), so iOS playback stays in the page instead of taking over the display in fullscreen and hiding the question. Under a play limit the component still offers no fullscreen control; without a limit the native controls may offer one, which cannot break `maxPlays` enforcement (play events still fire in the page).
  
  **PNP application**
  
  - Colours in the JSON PNP profile (`display.invertPolarity` foreground/background, `display.textAppearance` `fontColor`/`backgroundColor`) are validated with `CSS.supports('color', …)` before being applied; an invalid colour is ignored with a console warning instead of wiping what the custom property styles (focus outlines, control borders). Environments without a CSS engine apply every value as before.
  
  **DaisyUI bridge (`@pie-qti/theme-daisyui`)**
  
  - Message/state text tokens (`--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text`) now clear 4.5:1 against the base surfaces of every stock DaisyUI theme in current browsers: in the relative-colour tier each fixed value is darkened (light themes) or lightened (dark themes) in linear light just far enough, and values that already pass (the amber warning text) are kept. Engines without relative colour syntax keep the fixed values, which hold on neutral surfaces only. The JavaScript mapping mirrors the tier.
  
  **i18n**
  
  - Removed the unused `interactions.extendedText` math-dialog keys left behind by the MathLive rework (`insertMath`, `enterMathExpression`, `latexSource`, `keyboard`, `update`, `insert`) and the unused `interactions.media.remaining`, in all eight locales.
- 8c4274b: Item rendering and accessibility fixes in the item player.
  
  - **Interactions render where they were authored.** The item body is an ordered content model: a choice between "Part A" and "Part B" text, an extended text followed by more text, interactions inside layout rows and columns or table cells now all render at their authored position instead of after the body. `session.present().flow` is now one `html` node holding the whole item body followed by the interaction mounts in document order; each interaction's element is replaced by an empty slot (`<span data-qti-interaction-slot="…">`, `INTERACTION_SLOT_ATTRIBUTE`) and every mount names its `slot`. Hosts that render the flow themselves mount each interaction into its slot (a mount whose `slot` is `null` renders after the body). Interactions stay mounted across response changes, and when feedback appears after response processing they are moved into the re-rendered body rather than remounted.
  - **Paragraphs stay paragraphs.** A paragraph containing inline interactions renders as one paragraph again, and consecutive paragraphs no longer run together (the `p { display: inline }` rule that applied to every item body is gone).
  - **Modal feedback is a real modal.** It opens with `showModal()` (the page behind it is inert), focus moves to the feedback title, Escape and a backdrop click close it, and focus returns to the control that opened it — or to the player when that control is now disabled.
  - **Inline blanks no longer expose response identifiers.** Text entries and inline choices are named by their authored label (`aria-labelledby`, `aria-label`, `title`) or by their position ("Blank 2 of 4"), and described by the sentence they sit in. Identifiers such as `RESPONSE_3` could hint at answers to screen-reader users only.
  - **Text entry:** a pattern mismatch says the answer is not in the expected format (naming the item's placeholder format when it has one) instead of exposing the pattern-mask regular expression in a tooltip; no spellcheck, autocorrect, autocapitalize or autocomplete help; a numeric keyboard (`inputmode`) for integer and float responses. Error text, control borders and focus rings meet WCAG AA contrast.
  - **End attempt:** activating an `endAttemptInteraction` ends the attempt — the standalone player submits with the interaction's `countAttempt`, so a hint button (`countAttempt="false"`) runs response processing without using up an attempt. QTI 3.0 `count-attempt` is now read.
  - The player's error banner is announced (`role="alert"`), and without an i18n provider every player string falls back to English rather than showing a catalog key.
  - New catalog keys `interactions.inline.blankLabel`, `patternMismatch`, `patternMismatchWithHint`, `correctChoice` and `feedback.title` in every locale; the identifier-based `interactions.inline.textEntryLabel`, `choiceLabel` and `formatHint` are removed.
- ee233f4: Media and extended text interactions: enforced play limits, captions, accessible names, and spelling-help integrity.
  
  **Media (`pie-qti-media`, `mediaInteraction`)**
  
  - Every `<source>` and every `<track>` (captions, subtitles, descriptions; `kind`, `srclang`, `label`, `default`) of QTI 2.2 and QTI 3.0 `audio`/`video` content is now extracted and rendered, so captions load and browsers can fall back between sources. `MediaElement` gains `sources`, `tracks` and `crossOrigin`; `src`/`mimeType` keep the first source. Every source and track URL passes the item player's URL policy, and blocked URLs are not rendered. An `audio`/`video` element's own `src` attribute is honored.
  - `maxPlays` is enforced. A *play* is now playback that begins at the start of the media (counted once it is actually playing), so the response counts plays started rather than play-throughs; pausing and resuming continues the same play. With a play limit the media renders without native controls and with accessible, localized play/pause, mute and captions controls (at least 44×44 px); once the limit is reached, playback is refused and any playback started by other means is paused at once. Plays left are shown and announced, `loop` restarts count as plays and stop at the limit, and autoplay is skipped when the limit is already spent or the interaction is disabled.
  - Play events are announced through a polite live region instead of a chatty live stats row, media is named by its prompt, and a blocked `<object>` embed shows a notice instead of nothing.
  
  **Extended text (`pie-qti-extended-text`, `extendedTextInteraction`)**
  
  - Fields are named by the prompt (or by visible "Response N" labels in a group, for multi-part responses); the placeholder is only a hint. Remove buttons name their response ("Remove response 2") and focus moves to a neighbouring field after removal or to the new field after adding.
  - Character counters no longer announce every keystroke: they describe the field, and the expected length being reached is announced once.
  - Spell check, autocorrect and autocapitalize are off by default in both the textarea and the rich-text editor, so spelling and writing items treat every candidate alike. The new `spellcheck` prop opts in to spell check and autocorrect. Numeric responses request a numeric virtual keyboard (`inputmode`).
  - Field borders meet 3:1 non-text contrast (`--pie-qti-border-strong`), focus uses `--pie-qti-focus`, and counter and placeholder text meet 4.5:1.
  - The MathLive math editor is now a proper modal dialog: `role="dialog"`, `aria-modal`, a title and instructions, a labelled math field, focus moved in and kept inside, Escape to cancel, and focus returned to the control that opened it. `openMathLiveEditor` accepts optional `mode` and `returnFocusTo`.
  - The math editor works in hosts that load the bundled custom elements (`@pie-qti/player-elements`): MathLive's chunk is now declared side-effectful, so bundlers no longer strip the `math-field` registration. While the math keyboard is open, the dialog stays above it and its buttons stay clickable.
  
  **i18n**
  
  - New `interactions.mathInput` catalog section, and new `interactions.extendedText` and `interactions.media` keys, in all eight framework locales.
- fc99dd9: The passage collapse control keeps one name in both states (WCAG 4.1.2).
  
  Its accessible name used to carry the state as an action verb ("The Water Cycle — Collapse passage", then "The Water Cycle — Expand passage") while `aria-expanded` changed as well, so the state was announced twice and the name a voice-control user speaks changed with every press. The control is now labelled by the passage's heading ("The Water Cycle", or the neutral "Passage" / "Passage 2" for an untitled one) and `aria-expanded` alone carries the state. The visible chevron is unchanged.
  
  **Breaking: locale keys removed** (beta prerelease). `assessment.expandPassage` and `assessment.collapsePassage` have no use left and are removed from all locales. Hosts that override these keys in a custom catalog can drop the overrides.
- cfb78e2: Assessment shell practice delivery and completion round: item-level check answer with attempts and feedback, candidate comments, and a built-in completion screen with an opt-in results summary.
  
  **Practice delivery ("Check answer").** In an `individual` submission-mode part whose resolved `itemSessionControl@showFeedback` is on, an item with more than one allowed attempt (or an adaptive item) now shows an item-level "Check answer" control in the navigation bar — distinct from the section's Next and the test's outlined Submit — with a polite "Attempt N of M" counter beside it (`AssessmentPlayer.getCheckAnswerState()` / `checkCurrentItem()`). Checking submits the item through the normal per-item path (counted, backend-authoritative) and stays on it: integrated feedback renders from the computed outcomes, and any item modal feedback the submission produced opens in the shell's dialog (`getLastItemFeedback()`; a backend that delivers no candidate-side response processing supplies the same surface through `SubmitResponsesResponse.result.feedback`). While attempts remain, a non-adaptive item reopens writable from its pre-submit state with the outcomes restored so the candidate revises and checks again; adaptive items keep their engine loop. Once the attempts are used up the control disables with a localized explanation and moving on needs no further submission; moving on re-submits an already-checked item only when the response changed (an unchanged answer never spends an extra attempt). `showFeedback=true` with a single attempt keeps today's submit-on-move delivery — the captured feedback dialog rides the transition; simultaneous parts and `showFeedback=false` never offer the control. A counted submission no longer double-counts the attempt when the backend returns `updatedState` with its own `itemSessionStates`.
  
  **Candidate comments (QTI `allowComment`).** A per-item "Comments for the test team" disclosure above the navigation bar edits the item's comment into the session state (`AssessmentPlayer.setItemComment`, autosave-aware, rides snapshots) and it is sent as `SubmitResponsesRequest.comment` with the item's submissions (already honored by the reference adapter).
  
  **Completion screen.** After finalization the shell replaces the dead last item with a candidate-facing completion state — "You have finished the test", or its time-expired variant when a whole-test limit auto-submitted — rendering the test's outcome-matched `testFeedback` and moving focus to its heading. The host opts in per embed with the shell's `showResultsSummary` prop (the `<pie-qti-assessment-player>` element's `show-results-summary` attribute) to add a per-question results summary from the new `AssessmentPlayer.getResultsSummary()`: each delivered item's answered status plus the backend's score when returned, under the finalized total. `onSubmit`/`submit` still deliver the full results; `onComplete` now fires after `submit()`'s results exist. Token-styled, keyboard-clean, reflows to 320px; new `assessment` locale keys (check answer, attempts, comments, completion) in all 8 locales.
- 372037e: Round-2 assessment-integrity fixes across the assessment player and its shell:
  
  - **End-of-test collection (S1):** finalize now collects every visited individual-mode item the
    backend has not accepted yet — an answer left behind a nonlinear jump (`navigateTo`/`previous`
    submit nothing) is scored instead of finalized from NULL. Unchanged responses never re-submit,
    so moved-on practice items spend no extra attempt; linear submit-on-move semantics are
    unchanged. Finalization also persists the final snapshot before `finalizeAssessment`, so
    outcome processing reads the end-of-test duration clocks.
  - **Nested section clocks (S2):** every enclosing section now runs its own clock. An outer
    section's `maxTime` expires and locks its whole subtree, its `minTime` gates leaving it, and
    `SECTION_ID.duration` accumulates for outcome processing and Results Reporting; innermost
    behavior is unchanged. Player-side literal `EXIT_SECTION` resolves over the full enclosing
    chain (S3), so an outer-section exit lands outside the whole outer section.
  - **Restored proctor pause (UX1):** a snapshot saved during a pause reopens paused with the
    overlay visible — the shell syncs from the core at creation, announces assertively, holds focus
    on the overlay (Tab and stray focus are contained there), suppresses the resume prompt while
    paused and returns it after resume. Opening a pause now closes every shell dialog (A11y7), and
    the whole chrome goes inert through one wrapper with the overlay operable outside it (A11y1).
  - **Finalized sessions (UX3):** `InitSessionResponse.finalized` (+ `finalResults`) marks a
    resumed session terminal: the shell renders the already-submitted completion view, never offers
    a resume, and `submit()` returns the stored results instead of failing.
  - **Attempt memory across resume (S4):** the submitted-response memory is seeded from the
    snapshot's recorded results, so a resumed session does not re-spend an attempt on identical
    responses.
  - **Shell resilience and a11y:** failed item entries (first item, expiry hop) route to the typed
    failure screen with Retry instead of an eternal loading state (UX5); the crash boundary's
    fallback takes focus (A11y6); the announcer splits into persistent polite and assertive regions
    (A11y3); timer and section-menu toggles no longer carry dangling `aria-controls` (A11y5); the
    expiry dialog stays open and busy on a busy-rejected submit (UX7); malformed item XML can no
    longer crash review-state helpers.
  - **Autosave backoff (UX6):** a failed save retries with a bounded backoff (2s/8s/30s), stopping
    on success or finalization, instead of waiting for the next candidate change.
  - New localized string `assessment.complete.alreadySubmitted` in all 8 locales.
- 9814c9b: Assessment delivery gating, time policy and proctor fixes (round 3).
  
  - **Finalize honours `allowSkipping` / `validateResponses`** (QTI: both apply only to items in `individual` submission parts). A candidate's end of the test never submits an item left without a response while `allowSkipping=false`, nor an answered item whose responses do not satisfy its interactions while `validateResponses=true`: `submit()` rejects with the coded `finalizeResponseRequired` / `finalizeResponseInvalid` naming the questions (`getSubmissionBlockers()`), and the shell's submit confirmation lists them with jump links and holds Submit. `next()`, `submitCurrentItem()` and `checkCurrentItem()` apply the same gates; simultaneous parts are never gated. A time expiry (and a proctor force-submit) collects everything as it stands, recording an unanswered required item as skipped by the expiry.
  - **Attempt-relative feedback**: with more than one attempt, feedback shows for every non-final attempt even when `showFeedback=false`; after the last attempt `showFeedback` governs. The check-answer control is offered whenever more than one attempt is allowed.
  - **`templateDefault` in nonlinear parts** is evaluated once at test-part entry for every item ref, with the other items' variables in scope (`ITEM.VARIABLE`); linear parts are unchanged.
  - **Start over keeps the time accounting**: it clears the candidate's answers, flags, comments and unrecorded check state, but clocks, expired scopes and a whole-test expiry persist (no fresh time allowance), accepted results stay, and delivery repositions to the first open question — or offers Submit when none is open. The blank draft is saved at once. New shell prop `allowStartOver` / element attribute `allow-start-over="false"` removes Start over.
  - **Restored sessions**: scopes whose restored clock already expired lock before any item is entered (no editable window until the next tick); a restored whole-test expiry finalizes once delivery runs; visited marks survive a reload; the end-of-test snapshot is saved after any in-flight autosave, before `finalizeAssessment`.
  - **Proctor console on `<pie-qti-assessment-player>`**: `isPaused()`, `getPauseReason()`, `isFinalized()`, `getTimeState()`, `flushAutosave()`, and `submit({ force: true })` (ends the test during a pause; submissions carry `timing.submissionReason: 'proctor'`). New `scope-time-expired` and `session-finalized` (`{ restored, results }`) events; `player-pause` now fires at mount for a session restored paused (core: `onPauseChange` once after creation, new `onFinalized` hook).
  - **Pause accessibility**: a proctor pause closes every dialog in the shell (section display settings included) and dispatches `pie-qti-close-transient-ui` (`{ reason: 'pause' }`) for transient UI outside dialogs; focus containment is scoped to the shell so host controls stay operable; a paused session behind the begin gate says so on its start screen and holds Begin.
  - **Status regions**: the save indicator's live region exists while idle, "Submitting…" is outside the busy subtree, and the polite/assertive announcer regions no longer clear each other. The pressed Flag button keeps its state in forced-colors mode.
  - New `assessment` locale keys in all eight locales: `errors.codes.finalizeResponseRequired`, `errors.codes.finalizeResponseInvalid`, `submit.needsAnswerHeading(One)`, `start.paused`.
- c6ae98c: Assessment delivery integrity fixes (round 4).
  
  - **Leaving a test part gates on its questions.** QTI parts cannot be re-entered, so leaving an individual part with a question that still owes an answer (`allowSkipping=false` without one, `validateResponses=true` incomplete) is refused with the coded `leavePartResponseRequired` / `leavePartResponseInvalid` naming the questions — on Next (before anything is submitted), on a direct jump into the next part, and on a backend branch decision that would leave the part (`EXIT_TESTPART`, `EXIT_SECTION`, a later-part target, `EXIT_TEST`; the decision is kept and the next `next()` follows it once the questions are answered). New `getTestPartBlockers()`; the shell's "Leave this part?" confirmation lists them with jumps and holds Continue.
  - **An unreachable question never holds Submit.** `getSubmissionBlockers()` reports only questions the candidate can still reach (new `reachable` field); the others (`getUnreachableSubmissionBlockers()`, e.g. a session saved before the leave gate) are collected as they stand at the end of the test with the new `timing.submissionReason: 'unreachable'`, never as a normal candidate submission. The reference backend accepts it like a time-expired collection.
  - **Scope expiry looks across the whole reachable delivery.** When a section, item or part limit closes the current question, delivery moves to the next open question of the part, else an open question earlier in a nonlinear part, else the next part — on a live expiry and on restore. Only when nothing open remains is it the dead end ("You can no longer change your answers"), so the skipping/validation gates and minimum times keep applying while an earlier question is open. `ScopeTimeExpiryEvent` (element `scope-time-expired`) gains `nextIndex`; the shell's notice names the destination ("You are moving on to question 1") and offers Submit in place of Next whenever no forward step remains.
  - **Proctor force-submit always lands.** `submit({ force: true })` no longer rejects with `navigationInFlight` while a candidate action runs: it is queued behind the transition (like `pause()`) and ends the test when it settles. Behind the begin gate it shows the completion screen instead of leaving a dead Begin.
  - **Every ending reaches the host once, with its reason.** `onComplete` now receives the results; the shell calls `onSubmit` (element `submit` event) for every ending — candidate submit, proctor force-submit, QTI `EXIT_TEST` branch, whole-test expiry. New `endReason` (`candidate` | `expiry` | `proctor` | `branch`) on `AssessmentResults`, the `onFinalized` event (element `session-finalized`) and `getEndReason()`. A proctor's ending shows "Your test was submitted by your proctor." with its own assertive announcement.
  - **Incomplete answers are named as such.** The submit confirmation (and the leave-part warning) lists invalid answers in a separate "answer is incomplete" group whose entries say what they still owe ("Go to question 2: select at least 2"), from the new `SubmissionBlocker.requirement` (minChoices / minStrings / minAssociations / minPlays).
  - **QTI skipped = NULL or the declared default.** A response still equal to its declared default counts as no response for `allowSkipping` (the `numberResponded` test); the reference backend no longer marks such an item answered.
  - **`allowReview` applies only after the last attempt.** With attempts left (an adaptive item not yet completed), the candidate may return to an item even when `allowReview=false`, and it reopens attemptable.
  - **Start over never re-enters a left part.** It repositions within the furthest part reached; questions of earlier parts stay closed as they stand (collected at the end of the test).
  - **Reference scoring uses the delivered instance (host-visible).** `BackendAdapter` gains the optional `requiresItemSession` capability; `ReferenceBackendAdapter` (and so the element's `referenceMode`) sets it, so the player now always sends `SubmitResponsesRequest.itemSession` to it, whatever `sendItemSessionToBackend` says. The reference scorer restores that session — a templated item is scored against the instance the candidate saw instead of a fresh template draw, and an adaptive item's outcomes are taken as submitted rather than recomputed. `scoreAssessmentItem()` now throws an `AssessmentItemScoringError` (`itemSessionRequired`) for a templated or adaptive item without a session (`itemScoringRequiresSession()` tells in advance); the reference backend answers such a submission with `success: false`. Production backends keep the `sendItemSessionToBackend` default (off).
  - **Accessibility:** closing a scope expiry notice by Continue or Escape moves focus to the question delivery moved to and announces it (the notice is acknowledge-only); a dismissed submit notice moves focus to Submit; an expiry closes a stale submit confirmation or leave-part warning; "Review questions" does nothing while a submission runs; the pause heading follows the shell's heading outline; the pressed Flag button paints the full Highlight/HighlightText pair in forced colors.
  - New `assessment` locale keys in all eight locales: `submit.incompleteHeading(One)`, `submit.requirement.*`, `submit.incompleteJump`, `submit.incompleteEntry`, `leavePart.needsAnswerHeading(One)`, `leavePart.incompleteHeading(One)`, `timeExpiry.movingToQuestion`, `timeExpiry.closedDescription`, `complete.byProctor`, `complete.byProctorAnnouncement`, `errors.codes.leavePartResponseRequired`, `errors.codes.leavePartResponseInvalid`; `timeExpiry.questionDescription` was removed (replaced by `movingToQuestion`).
- ad99965: Accessibility fixes from the round-4 WCAG 2.2 AA review:
  
  - **Interactions state their minimum requirement** (WCAG 3.3.2, 3.3.3). Choice, match, associate, order, gap match, hotspot and graphic order interactions show a visible hint while the response is below its authored minimum (`minChoices`, `minAssociations`, a choice's `matchMin` in match, associate and gap match), the same minimums response validation enforces before an answer counts as complete. The author's `data-min-selections-message` wins over the localized default ("Select at least 2 answers.", "Needs more associations: Red.", "Still to place in the blanks: blue and green."). The hint describes the answer group (`aria-describedby`), draws in `--pie-qti-warning-text`, and is announced politely once when a change leaves the minimum unmet, not on every change. It shows only while the candidate can answer: not when the interaction is disabled or rendered for another role.
  - `@pie-qti/item-player` delivers `minSelectionsMessage` for order and associate interactions, also reads the QTI 3.0 `data-min-selections-message` on match interactions, and extracts graphic order `minChoices` (with its message), which response validation now enforces. `GapMatchInteractionData` choices carry `matchMin`.
  - New `interactions.*` catalog keys in every locale: `choice.minChoicesHint`, `match.minAssociationsHint`, `match.minChoiceUsesHint`, `associate.minAssociationsHint`, `associate.minChoiceUsesHint`, `order.minChoicesHint`, `graphicOrder.minChoicesHint`, `hotspot.minChoicesHint` and `gapMatch.minPlacementsHint`.
  - **PNP inverted polarity no longer inverts a forced-colours palette**: under `@media (forced-colors: active)` the inversion filter is off, so Windows high contrast keeps the colours the candidate chose.
  - **A proctor pause keeps a typed math expression**: the math dialog reports a host close as an interrupted cancel with the LaTeX typed so far, and the rich-text editor offers it again in its next insert dialog. The draft is session-only and per response field; inserting the math or the candidate's own cancel discards it.
  - **Nested languages in section content**: an `xml:lang` inside test feedback, instructions or rubrics now renders as HTML `lang` (with `dir` where the direction changes), as in passages (WCAG 3.1.2).
- d6ac3bb: **The consumer key scan now sees section-player's `interfaceText()` wrapper** (beta prerelease). The scan recognized `t()`, `translate()`, `translatePlural()`, `.plural()` and `labelKey` literals, but the section's 20+ `interfaceText(i18n, 'sectionPlayer.question', 'Question')` call sites forwarded their literal keys through a variable the scan matched nothing — a typo there shipped CI green and rendered the hardcoded English fallback in every locale, the exact failure class the scan was built for. The wrapper keeps its `string` key (host `customMessages` keys are legitimate, like `translate`'s), so the scan is the enforcement net: it now recognizes `interfaceText(` call sites, and all current literal keys validate against the en catalog. The README's consumer-key-scan section also names `HOST_CUSTOM_CATALOGS` in `scripts/check-consumer-keys.ts` as the registration point for a host app's own catalog, and states that out-of-repo catalogs are outside the scan's roots.
- 362b7c1: Round-6 interaction feedback fixes (WCAG 2.2 AA). Order and graphic-order confirmations keep their control mounted as an inert "Order confirmed" state (aria-disabled, focus retained) and announce the confirmation from an always-present polite region — the control used to be removed, dropping focus to the page. Graphic associate announces associations made, removed and refused, no longer sets `disabled` on the focused hotspot (aria-disabled plus a handler guard), and refocuses a surviving control after a pair removal. Remove/clear controls in match, gap match, graphic gap match, position object, hottext and file upload move focus to the related surviving control (now-enabled word/label/source, canvas, first hottext, native file input), and gap-match and file-upload announce the removal. Unmet minimums are now stated on the question: extended text states `minStrings` and refuses removing responses below it, graphic gap match states per-label `matchMin` honouring the authored `data-min-selections-message`, and graphic associate states `minAssociations` and per-hotspot `matchMin`. Rich text editors can re-edit inserted math from the keyboard (Enter/F2 beside the expression) and via an "Edit math" toolbar button, instead of pointer-only clicking. File upload translates every string with an English fallback (raw catalog keys could reach candidates) and resets the native input through a bound reference, so re-choosing the same file works even inside a shadow root. The PCI sandbox init payload gains optional `language`, `direction` and `frameTitle` fields, which the runner frame applies to its document (language, direction, title) before instantiating the interaction. All new strings ship in all 8 locales.
- 2e4f6fb: Associate and graphic gap-match interactions now enforce the QTI association maxima in the component instead of letting an over-limit response reach a submit that response validation rejects (WCAG 3.3.1/3.3.2):
  
  - **associateInteraction**: a pairing that would pass the interaction's `maxAssociations` or either choice's `matchMax` is refused with a polite live-region announcement ("Association not possible: the limit of {max} is reached." / "Not possible: {label} cannot be in more associations."). Maxed choices carry `aria-disabled` and stay focusable (never `disabled`, so focus cannot fall off the activated control), deselecting the pending choice stays possible at a cap, and the helper text names the interaction cap up front ("You can make up to {count} associations."). Both caps are re-checked when a pair is completed, so a selection arriving through the `selectedForPairing` prop obeys the same rules.
  - **graphicGapMatchInteraction**: a placement (pointer drop or keyboard) whose response would exceed `maxAssociations` is refused and announced; the author's `data-max-selections-message` wins over the localized message, and a keyboard-held label stays held on refusal. Replacing a placed label within the cap is still allowed.
  - **i18n**: new keys in `interactions.associate` (`maxAssociationsHint`, `choiceLimitReached`, `associationLimitReached`) and `interactions.graphicGapMatch` (`associationLimitReached`) across all 8 locales.
  - **Extractor default**: the associate extractor now applies the spec default `maxAssociations = 1` for an absent attribute (QTI 2.1 XSD `default="1"`, QTI 2.2 Table 5.6.2, QTI 3.0 Table 5.8.2). The graphic-gap-match extractor deliberately keeps `0` (= unlimited) for absent attributes — documented divergence from the 2.2/3.0 default of 1 (2.2 Table 5.41.2, 3.0 Table 5.60.2) so items authored without the attribute keep their delivered behaviour; author the attribute explicitly for strict conformance.
- 3ed760e: Association and placement caps follow the QTI "0 means unlimited" reading and every refusal is announced (WCAG 3.3.1/3.3.2/4.1.3):
  
  - **graphicAssociateInteraction**: an explicit `maxAssociations="0"` and a hotspot `matchMax="0"` now mean unlimited, as the delivery engine and the sibling pairing surfaces already read them. Previously no pair could ever form under `maxAssociations="0"` (every second click announced "the limit of 0 is reached") and a `matchMax="0"` hotspot was refused by name. An unlimited hotspot's accessible name states its usage as unlimited instead of "(n/0 connections)", and the associations counter drops the "/0" maximum.
  - **positionObjectInteraction**: a placement refused at a cap (keyboard Enter on the crosshair, click/tap on the canvas, or a drag drop) is announced through the polite live region ("The maximum of {max} placements is reached.") instead of visibly doing nothing, and pressing Enter again re-announces it; the placement mode stays active so Escape still cancels. The "Maximum: {maxChoices}" hint now shows whenever `maxChoices > 0`, not only when the item also declares a minimum. An extracted `maxChoices="0"` (QTI "no limit") item is answerable again: the extractor carries maxChoices into the object's `matchMax`, and that 0 used to leave the only object `aria-disabled` and unplaceable; it now means unlimited (the object stays placeable after any number of placements, and a restored response in multi-object data lands its remaining points on it), with the usage stated as "{n} used, unlimited" instead of "{n}/0 used".
  - **associateInteraction**: activating a partner the `matchGroup` rule forbids announces "Not available due to a match group restriction." instead of being silently ignored.
  - **matchInteraction**: the two refusal cases are split and named like the associate family — the interaction cap ("Association not possible: the limit of {max} is reached.") and a source at its `matchMax` ("Not possible: {label} cannot be in more associations.") — replacing the generic "Maximum associations reached" message; repeating the same refused attempt announces again.
  - **i18n**: new keys across all 8 locales: `interactions.graphicAssociate.hotspotConnectionsUnlimited` and `associationsCountUnlimited`, `interactions.positionObject.maxChoicesReached` (plural group), `objectLimitReached`, `objectUsageUnlimited` and `usedUnlimited`, `interactions.associate.notAvailableSentence`, `interactions.match.associationLimitReached` and `sourceLimitReached`. The unused `interactions.match.maxReached` key is removed.
- 90d1c60: Integrated feedback (`feedbackInline` / `feedbackBlock`) shown after an attempt is now announced to assistive technology (WCAG 4.1.3 Status Messages). The attempt splices the feedback into the item body without moving focus, so screen-reader users previously heard nothing when feedback appeared.
  
  - The item body renders one persistent, visually hidden polite live region (`.qti-feedback-announcer`, `role="status"`). It is in the DOM from the item's first render, so every player integration announces through it: `ItemPlayer`, the `<pie-qti-item-player>` custom element (used by the section player's item renderer and the assessment player), and any host rendering `ItemBody` directly.
  - Announcements fire when the candidate's own attempt ends — a submit or end-attempt, covering every attempt of an adaptive item — and announce the accessible text of the feedback now shown, in document order, including image `alt` text. Feedback shown again by a new attempt is announced again (the live region toggles a zero-width space, the pattern the interactions use for refusals). Initial render, restore, review and scorer views, and unrelated re-renders such as a response change, never announce.
  - The announcement carries the item content's `lang` and `dir` (WCAG 3.1.2); when the shown feedback has no text, such as an image with no alt, a localized "Feedback is shown." is announced in the interface language instead. The new `feedback.shown` key ships in all eight locales (ar, en, es, fr, nl, ro, th, zh-Hans).
  - Custom renderers can read the same data from `ItemPresentation.shownFeedback` (`{ shown, text }`), newly reported by the presentation plan.
- 01fb4d1: Order and graphic-order interactions can now ask for a ranked subset ("rank your top 2 of 5"), as QTI 2.2 §5.73 / §5.42 and QTI 3.0 `min-choices` / `max-choices` define. Before, every choice always had to be ordered, so such an item could never be answered correctly; a vertical slider is also now announced as vertical.
  
  - **orderInteraction / graphicOrderInteraction**: when `minChoices` is set and is below the number of choices, the candidate chooses which choices to order. The interaction shows two labelled lists, "Your order" and "Not in your order"; the second holds the remaining choices, without position numbers. The candidate moves items between them with **Add** and **Remove** controls and orders them as before (drag, touch, Space/Enter grab with arrow keys, or the move buttons).
    - The response is the ordered subset, or `null` while nothing is ordered. A saved subset response is restored in sequence.
    - Adding past `maxChoices`, clamped to the number of choices, is refused, and the refusal is announced. The limits are stated up front ("Choose 2 items and put them in order." or "Choose between 1 and 3 items…"). The author's `data-min-selections-message` replaces that text when given.
    - Add, remove and refusal are announced through a polite live region; a repeated refusal is announced again.
    - Focus follows the moved item. The controls are at least 44×44 CSS px, and a row's controls wrap below the item on narrow screens. The layout mirrors under right-to-left text and keeps a visible state under forced colors.
    - Subset mode has no "Confirm Order" step: every ordered item was added deliberately and can still be removed.
    - The scorer view lists the authored correct subset under "Correct order".
    - Without `minChoices`, or with `minChoices` at or above the number of choices, the interaction is unchanged: all choices are ordered and `maxChoices` is ignored, as the spec requires.
  - **item-player**: graphicOrderInteraction now reads `maxChoices`. A new `orderChoiceLimits` export carries the subset rule the renderers and response validation share. `validateResponses` rejects an order or graphic-order response longer than the subset cap. Once an order has begun, it is complete only when it reaches its minimum: every choice when no subset is requested (a partial order used to pass as complete), and `minChoices` when one is. An untouched order is still a skip.
  - **sliderInteraction**: a vertical slider (`orientation="vertical"`) now carries `aria-orientation="vertical"`. Before, it was turned only through CSS, so screen readers announced it as horizontal (WCAG 4.1.2).
  - **i18n**: new keys in all 8 locales. Under `interactions.order`: `yourOrder`, `notInOrder`, `emptyOrder`, `addItem`, `removeItem`, `itemAdded`, `itemRemoved`, `orderLimitReached` (plural), `correctOrder`, `subsetExactHint` and `subsetRangeHint` (plurals). Under `interactions.graphicOrder`: `subsetExactHint` and `subsetRangeHint`.
- dc38e3b: Assessment shell resilience round: debounced autosave with resume, candidate-safe load/failure screens, and targeted response updates.
  
  **Autosave (default ON when the backend supports it).** `BackendAdapter` gains a `canSaveState` capability flag (default `true`; `ReferenceBackendAdapter` implements it), and the core now actually calls `saveState`: candidate activity (responses, navigation, flags, timer visibility, pause) restarts a 1.5 s debounce (`autosaveIntervalMs`), the shell flushes on `visibilitychange`/`pagehide`, and nothing saves after finalization. Saves defer while a transition is in flight and fail non-fatally (console + typed event + indicator, retried on the next change). New config: `autosave`, `autosaveIntervalMs`, `onAutosaveChange`, `onAutosaveFailed`; the `<pie-qti-assessment-player>` element gains `autosave` / `autosave-interval-ms` attributes and `autosave-change` / `autosave-failed` events. Hosts that persist state themselves set `autosave: false` (or `canSaveState: false`), which also hides the new save indicator ("Saving…" / "Saved · 12:04" / "Not saved", localized, polite live region). The navigation bar's snapshot section gained an optional `saveLabel` slot. Snapshots stamped with `timing.savedAt` date the new resume prompt: a session created from a stored draft (`initSession.resumeSessionId`; `ReferenceBackendAdapter.latestSessionId()` finds it) asks "Resume your test?" — Resume restores answers, flags and the hidden-timer preference, Start over confirms (WCAG 3.3.4) and calls the new `AssessmentPlayer.startOver()` to clear the draft, persist the blank state and restart at the first item. Restored-paused sessions still reopen paused. `hasRestoredProgress()`/`getRestoredSavedAt()` expose the resume facts.
  
  **Safe load, failure and crash screens.** The 10 s loading timeout no longer turns into a permanent error: it becomes a polite "Still loading" status that clears itself, and its developer-phrased message is replaced by candidate-safe text in all 8 locales. A failed load renders the localized coded-error message (never raw backend text) with a Retry control that re-initializes the session, and `<svelte:boundary>` now wraps the question content area and the shell's dialogs, so a crash during item rendering shows a localized "This question could not be displayed" fallback with Try again / Continue (navigation rules still apply) instead of blanking the test.
  
  **Response updates are O(changed item), not O(assessment).** Profiling showed every keystroke rebuilt the whole section composition with two `structuredClone` calls per delivered item (48 clones for a 24-item section). The composition now carries the active session and the section's response records by shared reference (`AssessmentPlayer.getSectionItemResponses()`, `getCurrentSectionItemRefs()` no longer clones delivery contexts), and the shell rebuilds it only on item/section/delivery changes — keystrokes recompute answered counts only. A unit guard pins a keystroke at one deep copy and a composition build at zero. Section-host `onSnapshotChange` notifications now fire per navigation instead of per keystroke; hosts needing per-edit events keep `onResponseDelta`/`response-change`.
  
  **Also:** `toSectionComposition` passes the real assessment id (not the section identifier) to `resolveQtiSectionComposition`, and the shell root is a PNP surface driven by the candidate's display-settings changes, so display accommodations cover the header, navigation bar and timer chrome while the section player keeps covering its own subtree (scopes non-overlapping; nested inverting filters are neutralized). New `assessment` locale keys (autosave, resume, still-loading, item error) in all 8 locales.
- af961a1: Submit safety, review screen and flag-for-review in the candidate shell (WCAG 3.3.4):
  
  - **Submitting is confirmed, never accidental.** The final-submission control is styled and placed apart from the primary Next (outlined, error-toned, distinct icon) and opens a confirmation dialog that states the answered count ("8 of 12 answered"), names the flagged questions, lists every unanswered question with a jump link where the navigation rules allow (linear parts render status only), and requires an explicit confirm; cancel and Escape return focus to the Submit control. A failed submission closes the dialog and moves focus to the retry control so the alert is reachable.
  - **Leaving a test part warns "you cannot return".** QTI parts cannot be re-entered, so when the next step crosses the part boundary the shell first shows a clear confirmation (`AssessmentPlayer.getForwardTransitionInfo()` reports it).
  - **Candidate review screen and item palette.** The navigation bar gains a review view (also offered from the submit confirmation) listing all delivered items grouped by candidate-visible sections with answered / partially answered / unanswered, flagged and not-yet-visited as text plus an icon (never colour alone), `aria-current` on the live item, jump buttons wherever jumping is legal, a note explaining status-only listing in linear parts, and 320px reflow.
  - **Flag for review.** A per-item toggle with a visible label and `aria-pressed` in the navigation bar. Flag state lives in the session state (`AssessmentSessionState.itemFlags`), survives navigation and rides `getState()` snapshots for persistence. New player APIs: `setItemFlag` / `toggleItemFlag` / `isItemFlagged` / `getFlaggedItemIdentifiers` / `onFlagChange`.
  - **One definition of "answered".** New `core/reviewState.ts` helpers (`itemAnswerStatus`, `isAnsweredValue`, `interactionResponseIdentifiers`) decide answered / partially answered / unanswered from the responses — per interaction for composite items. `AssessmentPlayer.getItemAnswerStatus()`, `getAnsweredItemCount()` and `getReviewItems()` feed the review screen, section menu and confirmation; the answered count ("8 of 12 answered") is visible in the navigation bar and named by the progress bar.
  - **Section menu is a real disclosure.** `SectionMenu` drops the `role="menu"`/`menuitemradio` pattern for a button with `aria-expanded` plus a plain list of section buttons: per-section answered counts, only legal jump targets enabled, `aria-current` on the current section, Escape/outside-press close, and self-contained token styling (the interim styling hack is removed from `AssessmentHeader`).
  - **Navigation bar reflow.** Below a 30rem container the position moves to its own row and Previous/Next/Review collapse to icons (names kept for assistive technology); the flag keeps its visible label at every width.
  - New localized strings (`assessment.review.*`, `assessment.submit.*`, `assessment.flag.*`, `assessment.leavePart.*`, `assessment.navigation.answeredCount`) in all 8 locales.
- 2667df1: The assessment shell and section player no longer require DaisyUI or Tailwind on the host page.
  
  - **Self-contained styling**: the shell (`<pie-qti-assessment-player>`) and section players (`<pie-qti-section-player-splitpane>`, `<pie-qti-section-player-vertical>`) style themselves with scoped CSS on the `--pie-qti-*` tokens, with fallbacks when no theme is loaded. Icons are sized by the components, buttons are ≥44px with visible 2px focus rings, and alerts, spinners, the splitter and test feedback no longer read DaisyUI `--color-*` variables. Existing class names and `data-testid` hooks are kept.
  - **Layout**: the shell fills its host container instead of a fixed `100vh` box (`--pie-qti-assessment-min-block-size` / `--pie-qti-assessment-max-block-size` tune the bounds when the host gives no height). A new `full-viewport` attribute (`fullViewport` property) fills the dynamic viewport with safe-area insets and page-level `header`/`main`/`nav` landmarks. At short viewports (400% zoom, landscape phones) everything flows in one scroll and no bar is pinned over the content.
  - **Phones**: navigation is one compact row (Previous, position, Next/Submit), nested gutters collapse to one slim gutter, and a passage shares the screen with the question through an accessible Passage/Question tab switch instead of a 40%-height scroll box. Wide screens keep the keyboard-resizable splitter.
  - **Accessibility**: a "Skip to question" link, a region named by the assessment title, a labelled navigation landmark, Previous/Next arrows mirrored right-to-left, and navigation buttons that keep focus while a transition is in flight.
  - **Polish**: the header shows the assessmentTest `title` (or a localized generic title), never the identifier; untitled sections no longer read "Section 2 of 0"; passages are headed by their `title` or a neutral localized "Passage" label at a heading level that fits the outline (`heading-level` attribute on the assessment and section elements). Item load failures show a localized message instead of the raw error.
  - **Host CSS**: a low-priority `@layer pie-qti-base` restores user-agent defaults (lists, headings, paragraph spacing, link underlines, inline images, bordered tables, media max-width) inside item, passage and rubric content, so host resets no longer strip question stems.
  - **APIs**: `AssessmentPlayer.getAssessmentTitle()`; optional `title` on `QtiSharedHtmlBlock`; the reference parser leaves a missing assessmentTest title empty instead of English "Assessment". `@pie-qti/i18n` adds `assessment.skipToQuestion` and a `sectionPlayer` section across all eight locales.
- 74c3886: **Behavior change: interaction attributes that an item leaves out now take the QTI default for the item's QTI version.** The player detects the version of each item (2.1, 2.2 or 3.0) and applies the default that version's schema and information model define. An attribute you author is always honoured as written, and `0` on a `max…` limit still means no limit.
  
  - **Graphic gap match:** QTI 2.2 and 3.0 items that omit `maxAssociations` (`max-associations`) now allow one association, the spec default. Before, they allowed any number. To let candidates fill several hotspots, state `maxAssociations` explicitly, for example `maxAssociations="3"`, or `"0"` for no limit. QTI 2.1 items have no such attribute, so they still have no overall limit.
  - **Gap match:** `maxAssociations` is now supported. The player used to ignore it. QTI 2.2 and 3.0 items that omit it now allow one association, the spec default, so a cloze meant to fill several gaps must state `maxAssociations`, for example the number of gaps. QTI 2.1 items have no such attribute and keep no overall limit. A placement past the limit, by keyboard or pointer, is refused and announced: the author's `data-max-selections-message` if there is one, otherwise the new localized message `interactions.gapMatch.associationLimitReached`. A held word stays held, so the candidate can place it elsewhere or cancel. Response validation rejects a restored or programmatic response with more associations than the limit.
  - **Choice:** QTI 2.1 items that omit `maxChoices` now allow any number of selections, as QTI 2.1 defines (`maxChoices = 0`). Before, they allowed one. A 2.1 item bound to a single-cardinality response still allows one. QTI 2.2 and 3.0 are unchanged, with a default of 1.
  - **Select point:** QTI 2.2 and 3.0 items that omit `maxChoices` now allow any number of points, the spec default (`0`), when the response has multiple cardinality. Before, they allowed one point. Items bound to a single-cardinality response still take one point. QTI 2.1 items are unchanged.
  
  For hosts and plugin authors: extraction now receives the item's QTI version as `ExtractionConfig.qtiVersion`, and `GapMatchInteractionData` gains an optional `maxAssociations`. The full table of audited defaults is in `docs/QTI_attribute_defaults.md`.
- f13613d: A failed assessment submission now tells candidates, in their language, that their answers were not lost and they can try again, together with a support code. Backend error text is still never shown. Previously an uncoded backend or network failure fell back to a generic "Something went wrong" message, losing that reassurance.
- 88b69c0: Timed tests are deliverable: countdown, warnings, expiry handling, begin gate and proctor pause in the candidate shell (WCAG 2.2.1 / 4.1.3).
  
  - **Countdown in the shell header.** When the active scope chain carries a hard maximum, `AssessmentTimer` now mounts beside the title (it used to exist only in a demo fixture, with DaisyUI-only variables that never rendered). It is rebuilt self-contained on the `--pie-qti-*` tokens: layout space instead of a fixed overlay, RTL-safe logical CSS, ≥44px controls, and a pause-state display. The ticking readout is `role="timer"` with the live region OFF (no more per-second chatter); its accessible name carries the reading ("Time remaining: 12:34"). Thresholds (`timeWarningThreshold`, new `timeWarningThresholds`, e.g. `[300, 60]`) each announce once through a separate polite status region; expiry announces assertively. Candidates can hide/show the countdown (persisted in the session state like flags via `setTimerHidden`/`isTimerHidden`, `AssessmentSessionState.timerHidden`). The only animation sits behind `prefers-reduced-motion`.
  - **Scope expiry is surfaced.** A test part, section or item limit without late submission locks its scope and moves delivery on; the shell shows an AssessmentDialog notice ("The time for this section is over — you are moving on"), announces the new question position and manages focus (`onScopeTimeExpired` / `onScopeTimeExpired` config with `deliveryContinues`).
  - **An expiry dead end can never strand the candidate.** When nothing unlocked remains, `onTimeExpired` reports `submissionRequired`, the shell shows an expiry dialog with a Submit action and the navigation bar offers Submit in place of Next on any item. The terminal collection submits the frozen responses marked `timing.submissionReason: 'time-expired'`, which the reference backend accepts; minimum times and validation cannot hold a closed delivery open. The submit-timing evidence also carries the candidate's test clock (`assessmentElapsedMs`/`assessmentLimitSeconds`), so begin-gate and pause time never count against a wall-clock check.
  - **Whole-test expiry auto-finalizes** through the same path as `submit()` (pending responses collected, outcomes computed, `complete` fires) unless `allowLateSubmission` applies; a failed finalization keeps the session open, reports through `onError` and offers Submit. Hosts hear the new `time-expired` DOM event (detail: `scope`, `autoFinalized`, `submissionRequired`) and `onTimeExpired` config callback.
  - **Begin gate (opt-in).** `beginGate: true` (shell prop / `begin-gate` attribute / `start()` / `hasStarted()`) holds delivery and every clock at session creation; the shell shows an accessible start screen — assessment title, "You have N minutes" (PNP extended time applied, `getStartInfo()`), the first test part's role-filtered rubric blocks and a Begin control. Without it, existing embeds start exactly as before. Resumed sessions show the time that remains.
  - **Proctor pause/resume.** `pause(reason?)`/`resume()` freeze every clock including the live attempt's QTI `duration`, reject candidate actions with a coded `assessmentPaused` error, and show a localized overlay with the reason (`onPauseChange` / `player-pause` / `player-resume` events, imperative API on `<pie-qti-assessment-player>`). A pause requested during a transition applies once it settles; paused snapshots carry `timing.isPaused`/`pauseReason` and reopen paused. The countdown freezes and continues where it left off.
  - New `AssessmentPlayer` APIs: `getTimeState()`, `getStartInfo()`, `start()`, `hasStarted()`, `pause()`, `resume()`, `isPaused()`, `getPauseReason()`, `onPauseChange`, `onScopeTimeExpired`, `setTimerHidden`/`isTimerHidden`, `TimeManager.getNearestLimit()`/`getAssessmentRemainingSeconds()`, multi-threshold warnings. New element surface: `begin-gate` attribute, `beginGate` property, `time-expired`/`player-pause`/`player-resume` events, `start()`/`hasStarted()`/`pause()`/`resume()`.
  - New localized strings (`assessment.timer.*`, `assessment.start.*`, `assessment.timeExpiry.*`, `assessment.pause.*`, `assessment.errors.codes.assessmentPaused`) in all 8 locales.
  - Demo `fixtures/assessment-timed` (auto-submit / dead-end / pause / start-gate / late scenarios), rebuilt timer a11y fixture, bun + jsdom component coverage and a Playwright suite covering timer visibility, threshold announcement, expiry dialog, auto-submit, the dead-end regression, pause/resume and axe scans of the start screen and expiry dialog.
- 68c8b37: Validation feedback where the candidate answers, and correct-answer mode only for items that have a correct response.
  
  - **Extended text says when a response does not match its `patternMask`** (WCAG 3.3.1). A string response that fails the mask is invalid under `validateResponses` (QTI 2.1; QTI 3.0 §5.48.4); the field now says so. When the candidate leaves a field (plain text or rich text) whose text fails the mask, the author's `data-patternmask-message` shows below it, else the new localized `interactions.extendedText.patternMismatch` sentence. The message describes the field (`aria-describedby`), the field states `aria-invalid="true"`, and the message is announced once through the interaction's polite live region; it clears as soon as the text matches and never blocks typing. The mask is compiled with the player's own XSD translation (`xsdPatternToRegExp`) and tested against the text the response holds, so the message and validation agree: an empty field and a numeric response are never flagged. Each field of a multi-part response is checked on its own. `@pie-qti/default-components` now depends on `@pie-qti/qti-processing` for that translation.
  - **The extended-text extractor reads the QTI 3 `data-patternmask-message`.** It read a `patternMaskMessage` attribute that no QTI version defines, so `ExtendedTextInteractionData.patternMaskMessage` was never set from authored content; it now reads `data-patternmask-message` (QTI 3.0 `qti-extended-text-interaction`; QTI 2.x has no equivalent), as the text entry extractor does.
  - **Gap match marks its required gaps** (WCAG 3.3.2). A gap authored `required` (QTI 2.1 gap; QTI 3.0 §5.55.5) must be filled for a valid response, which validation enforces; the candidate is now told which gaps those are. Each required gap shows an asterisk — a character, not a colour alone — that a visible legend before the passage explains (new key `interactions.gapMatch.requiredBlanksLegend`, "Blanks marked * are required."). A gap is a button, on which ARIA does not allow `aria-required`, so the requirement is the gap's accessible description instead ("Required.", from the existing `common.required`). Gaps carry `data-required="true"` for styling.
  - **Correct-answer mode needs a correct response** (QTI-observable rendering change for scorer views of items without one). Order, match, hottext, slider, select point, position object, gap match and graphic gap match now take correct-answer mode from the shared interaction shell — the scorer's view of an item that *has* a correct response (`role === 'scorer'` and a correct response present) — instead of their own inline `!== null` checks, which put a scorer view of an item without a correct response (hosts pass `null`) into correct-answer mode. Two of them showed it: the **slider** was disabled, announced "undefined Correct answer: {answer}." and showed an empty "Selected Value" readout instead of the untouched slider, and **graphic gap match** hid its label palette, so the scorer could not place labels. They now render and emit as for a candidate; only `disabled` stops interaction outside the correct-answer view. The other six already rendered the same (their correct-answer data was empty without a correct response). Items that have a correct response render as before.
  - **Graphic gap match no longer names the correct label outside the correct-answer view.** A hotspot's accessible name said "Correct answer: {label}" whenever a correct response was passed, for a candidate too, while the visible marker was rightly hidden; screen-reader users alone heard the key. The name now carries it only in the scorer's correct-answer view.
- 6d4d19d: Five message keys referenced by player components existed in no catalog, so their hardcoded English fallbacks rendered in all seven non-English locales. They are now translated in every framework catalog (en, fr, es, nl, ro, th, ar, zh-Hans): `assessment.feedback.title` (feedback dialog title), `interaction.renderError` (screen-reader announcement when an interaction cannot be rendered; safety-relevant — best-effort translations in th/ar are marked for native-speaker review in the catalogs), `interactions.hottext.minimumMet` and `interactions.hottext.selectAtLeast` (hottext minimum-selection badges; the value carries no checkmark because the component renders its own), and `customInteraction.portableLabel` (Portable Custom Interaction group label). Locale catalogs now carry 896 keys each, up from 891.
  
  `check:i18n` can now see this defect class. `check-translations` compares interpolation placeholder names against en for every key a locale carries (plural leaves may omit them, for locales that spell small counts out as words — the documented ro/ar `.one` forms). A new `check-consumer-keys` scan walks `packages/<pkg>/src` and `apps/<app>/src` and fails when a literal key passed to `t()`, `translate()`, `translatePlural()`, `.plural()` or named in a `labelKey` exists in neither the framework en catalog nor a registered host custom-messages catalog (the demo app's `demo-messages.ts` is registered); it runs as the second step of `check:i18n`. `translate()`/`translatePlural()` keep accepting string keys — the doc comments now state where literal-key correctness is enforced.
- 562182a: Phase 4a of the player cleanup: one shared image stage and keyboard crosshair for the graphic interactions, the declared→natural→refuse sizing rule everywhere, and three graphic accessibility fixes.
  
  **Sizing rule: declared width/height → natural size → refuse.** The graphic stages now resolve their pixel space the same way: the image's declared `width`/`height`, else — for a raster image — its natural size once loaded, else the interaction refuses (no overlay, no placements) and tells authors why: a console warning always, and a `role="alert"` diagnostic outside the candidate role. Coords, points and areaMapping live in image pixel space, so the 500×300 default that select point, graphic order, graphic associate and position object used for images without declared dimensions silently misplaced answers — those items now stage at the image's natural size, and items with neither a declared size nor a loadable image can no longer be answered in a guessed space. The `selectPointInteraction`, `graphicOrderInteraction`, `graphicAssociateInteraction` and `positionObjectInteraction` extractors stop inventing dimensions: the delivered `imageData.width`/`height` are optional now, set only when the item declares them. Position object's draggable object keeps its 50×50 fallback (it sizes a placement box, not a scoring space), as does the drawing interaction's 600×400 canvas (a blank canvas is a valid answer, and the canvas resolution is the response's own pixel size, never a scoring space). New i18n keys (all locales): `interactions.selectPoint.unknownImageDimensions`, `interactions.graphicOrder.unknownImageDimensions`, `interactions.graphicAssociate.unknownImageDimensions`, `interactions.positionObject.unknownImageDimensions`.
  
  **Graphic gap match: a `shape="default"` hotspot now lies beneath the other hotspots** (QTI 3.0 §8.29), like the hotspot interaction's whole-image region — previously it was drawn in authored order and covered every hotspot listed before it, taking their clicks and drops.
  
  **Distinct focus indicator on graphic regions (WCAG 2.4.7).** A region that was both selected and focused showed the focus stroke hidden under the selected outline (its halo grew by half a pixel). One shared rule now draws an offset outer ring — focus-within widens the region's halo layer into a focus-coloured ring around the region on hotspot, graphic gap match (whole-image backdrop included) and graphic associate's buttons take a shared offset outline — distinct from the selected state by geometry, not colour alone, in the theme's `--pie-qti-focus` token.
  
  **Sortable list labels wrap at 320 CSS px (WCAG 1.4.10 Reflow).** The reorderable list's move controls no longer squeeze the item into a clipped sliver on narrow screens: the controls wrap beneath the item and long labels (graphic order's hotspot labels among them) wrap instead of truncating.
  
  Under the hood: the seven graphic stages render through a shared `ImageStage` (media, load tracking, sizing style, one style sheet) and select point and position object share a keyboard crosshair controller — move-only refactors with the existing behaviour pinned before and after; the emitted points and refusals are unchanged for items that declare their image size.
- fa577a0: No-legacy removals in the assessment and section players (legacy audit items A1 to A4). The project is pre-1.0 and keeps no compatibility paths for its own earlier APIs, wire shapes or stored formats. Spec-conformant delivery, scoring, timing and test feedback behave as before.
  
  **Breaking:**
  
  - **`FinalizeAssessmentResponse.feedback` is gone** from `@pie-qti/assessment-player`, and so from `QtiAssessmentFinalizeResponse` in `@pie-qti/player-elements`, which aliases it. The contract documented it as "legacy: single string; prefer outcomes + assessment.testFeedback". For a test without `testFeedback`, the player showed that string as one synthetic end-of-test feedback entry. Test feedback now comes only from the test's and its test parts' `testFeedback` blocks, evaluated against the outcomes the backend returns. To migrate a backend that answered `finalizeAssessment` with a feedback string, author the text as `testFeedback` in the assessmentTest and return the test-level `outcomes` that select it. `SubmitItemResponse.feedback` (the per-item `FeedbackItem[]`) is unchanged.
  - **The reference backend no longer rebuilds an item's test-level state from its stored score** (`ReferenceBackendAdapter`). Sessions it stored before item test states existed (earlier beta builds) hold only `itemScores` for their submitted items. Outcome processing used to rebuild those items' variables from the scores, count them as responded from their raw responses, and infer correctness from SCORE and MAXSCORE. Such items now reach outcome processing as presented with only their SCORE: not responded, neither correct nor incorrect. Their scores still count toward the totals. Sessions stored by current builds are unaffected. A submission whose response processing fails still counts as presented, and as responded when the candidate gave a response, as before.
  - **`responseInvalid` is no longer an `AssessmentPlayerErrorCode`.** The `@pie-qti/i18n` catalogs no longer carry its message (`assessment.errors.codes.responseInvalid`) in any of the eight locales, and `MessageKey` no longer includes that key. Nothing has thrown the code since navigation stopped gating on response validity (cleanup phase 1): invalid responses are refused at submission, with `attemptValidationFailed`, `finalizeResponseInvalid` or `leavePartResponseInvalid`. Drop the code from any `switch` and the key from catalog overrides.
  - **`@pie-qti/section-player` no longer maps the pre-1.0 toolkit TTS provider shape.** A `textToSpeech` tool's `provider` now applies over the section player's defaults as given. To migrate, name the backend with `backend` (`'server'` or `'browser'`) and the server with `serverProvider` instead of a string `provider`, move `settings` keys to the top level, and use `endpointValidationMode: 'none'` instead of `validateEndpoint: false`. The old keys now reach the toolkit unchanged, and the toolkit rejects a string `provider`.
  
  Also removed, internal to `@pie-qti/assessment-player` and never reachable from its entry points: `TimeManagerConfig.warningThreshold`, which was kept "for compatibility" and merged into `warningThresholds`. The player now passes the whole warning list, so `TimeManager` fires exactly the thresholds it is given. The host options are unchanged: `timeWarningThreshold` (default 60) sets the default warning and `timeWarningThresholds` adds to it.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 1.0.0-beta.4

No changes in this release.

## 1.0.0-beta.3

No changes in this release.

## 1.0.0-beta.2

### Patch Changes

- d8f9b4d: Accessible names, live-region announcements and visible interaction text now come from the catalog in every locale, built from whole-phrase keys, and a plain-language count uses CLDR plural rules. Escape handlers in the math editor and glossary popups ignore keys an input method editor is composing, and text-entry and extended-text inputs take `dir="auto"`. `@pie-qti/i18n` exports `translate`, `translatePlural`, `joinSentences`, `formatList` and `isImeComposing`, and `@pie-qti/default-components` now depends on `@pie-qti/i18n` directly.
- 5dbabcc: Content and interface direction are now separate: player chrome takes `lang` and `dir` from the interface locale, while the item body, passages, rubrics and modal feedback take them from the content's `xml:lang`, and content that declares no language inherits the chrome's. Nested `xml:lang` spans get a `dir` where their direction differs from the surrounding text. `@pie-qti/i18n` exports `languageDirection`, `canonicalLanguageTag`, `contentLanguageAttributes` and `interfaceLocaleAttributes`, and `@pie-qti/section-player` now depends on `@pie-qti/i18n` directly.
- d0e249b: Locales negotiate by language to catalogs keyed `en`, `ar`, `es`, `fr`, `nl`, `ro`, `th` and `zh-Hans` (the old regional codes stay valid inputs, the `./locales/*` file names follow the new keys), and both players default to an English provider. The package no longer reads a stored locale: hosts relying on the provider restoring its stored locale and reloading the page must now opt in with `persistLocale` and `reloadOnLocaleChange` and read the key at startup.
- e874155: Number and date formatting pins digits to a CLDR 48 table and the Gregorian calendar, and interpolated counts and the assessment timer follow it. A `-u-nu-` or `-u-ca-` extension on the locale overrides either.
- 572c3d3: Add `pseudoLocalize` with the `en-XA` and `ar-XB` pseudo-locales, and a physical-direction CSS check in `check:i18n`. Interaction and chrome markup that still used `ml-*`, `mr-*` and `right-*` utilities now uses their logical forms, so it mirrors under right-to-left locales.

## 1.0.0-beta.1

No changes in this release.

## 1.0.0-beta.0

### Patch Changes

- 6c209e2: AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
- 765423c: Structured labels and braille routing (G-13): `pnp.display.structuredLabelSupport` presents choice and match answer sets as one ARIA group named by the interaction prompt, with match columns named by their visible headings. An AfA PNP `<braille/>` grant now routes to the platform `brailleText` preference (`sign-language` to `signingDefinition`), and `getCatalogEntry` under a QTI 3 usage falls back to the APIP support name (`braille-text` → `braille`, `signing-definition` → `sign-language`), so QTI 3 and APIP catalogs share one lookup path. The research note, markup contract, and NVDA checklist live in `packages/item-player/docs/PNP.md`.

## 0.1.28

No changes in this release.

## 0.1.27

No changes in this release.

## 0.1.26

No changes in this release.

## 0.1.25

No changes in this release.

## 0.1.24

### Patch Changes

- 080f254: Render readable assessment labels before host translations finish loading, and adopt a later context provider without restarting the attempt. Explicitly configured providers continue to take precedence.
- e532f4f: Provide visible move controls for ordering and select-then-place actions for matching, gap matching, and graphic gap matching, with instructions in all supported locales. Preserve keyboard and drag interaction paths.

## 0.1.23

## 0.1.22

### Patch Changes

- 3aec4b3: Make the published i18n package loadable outside Vite. `DefaultI18nProvider` resolved locale
  catalogs through `import.meta.glob`, a compile-time Vite macro, but the package builds with plain
  `tsc` — so the macro shipped verbatim to npm and any consumer on webpack, esbuild, Rollup, Node or
  plain browser ESM threw `TypeError: import.meta.glob is not a function` merely importing the
  provider. Locales now resolve through an explicit map of dynamic `import()` calls, one entry per
  locale, which `tsc` emits untouched and bundlers still code-split per locale. en-US is a static
  import, since it backs every fallback and must be resolvable synchronously in the constructor. The
  bare `process.env.NODE_ENV` on the missing-key path is guarded too; it raised
  `ReferenceError: process is not defined` in a plain browser.

  Select plural forms with `Intl.PluralRules` instead of a hardcoded `one`/`other` split. Arabic
  defines zero/one/two/few/many/other for every plural key and none but `one` and `other` were
  reachable, so Arabic counts of 2, of 3–10 and of 11–99 all rendered the wrong grammatical form. The
  category now comes from the active locale, with a fallback to `.other` for locales whose catalog
  does not define it, and a fallback to the `one`/`other` split for a locale tag `Intl.PluralRules`
  rejects.

  Convert the ICU MessageFormat strings in the `transform.*` namespace to the package's plural-key
  convention across all eight locales. The runtime interpolates `{name}` only and never parsed ICU, so
  strings like `'{count, plural, one {# item} other {# items}}'` would have rendered their own source
  text to users. `transform.transformed.summary` interleaved two independent counts and is now
  `summary`/`summaryWithAssessments` plus `summaryItems`/`summaryAssessments`, composed by the caller;
  the participle moved inside the pluralized phrase in es-ES, fr-FR and ro-RO, where it agrees with
  the item count. Singular forms in those three locales previously carried a plural participle from
  the ICU suffix and are now correct. `check-translations` recognises plural-category leaves anywhere
  a plural sub-object lives rather than only under `plurals.*`, gated on en-US defining the same
  parent.

  Stop `t()` returning a catalog object. A key landing on a namespace branch (`t('common')`) or a
  plural sub-object resolved to the object itself, which reached callers where a string was expected
  and threw from `String.prototype.replace` as soon as interpolation values were passed. Such a key is
  now a miss and returns the key or the supplied default.

  Test `DefaultI18nProvider` itself. The suite previously defined its own provider to avoid the
  `import.meta.glob` load failure, so the shipped class was never instantiated: the fallback chain,
  custom-message priority, `addCustomMessages` deep merge, `loadLocale` caching and rejection,
  `localStorage` restore-on-construct and `plural()` had no coverage, and the mock diverged from
  production by dropping unmatched interpolation placeholders. 59 tests now bind to the real class,
  including every `plurals.*` key across all eight locales and an assertion that no catalog contains
  an ICU argument.

  Fix the `LocaleSwitcher` reference component, which the PRD invites hosts to copy but `tsconfig.json`
  excluded from compilation, so none of its defects surfaced: `I18nProvider` was imported from
  `core/types`, which does not export it; the `availableLocales` prop default referenced a `const`
  declared below it, a temporal-dead-zone `ReferenceError` whenever the prop was omitted; and the
  usage docblock named a `createI18n` export and a `@pie-qti/i18n/components` subpath that do not
  exist. A `check` script now runs `svelte-check` over the component so the reference stays valid, and
  zh-CN joins the default locale list.

  Add right-to-left support, which blocked ar-SA independently of the plural bug — nothing in the
  source wrote `dir` anywhere. `getDirection()` returns the writing direction of the active locale from
  `Intl.Locale.prototype.textInfo`, falling back to a primary-subtag list for engines that lack it, and
  the item body root now reflects it as `dir` alongside `lang`. `direction` is an inherited CSS
  property, so that one attribute reaches interaction components inside shadow roots with no
  per-component wiring; the host page's own chrome is untouched, since the player publishes direction
  for its own subtree only. Both evals in `docs/evals/i18n/rtl-support/evals.yaml` finally have an
  implementation to run against.

  Let a host set the locale declaratively: `<pie-qti-item-player locale="ar-SA">`. `observedAttributes`
  carried no locale, so locale was reachable only as a JS property — impossible to express in markup or
  in a server-rendered page. The attribute resolves through a new `I18nProvider.withLocale()`, which
  returns a view sharing catalogs and loaded-locale bookkeeping by reference, rather than through
  `setLocale()`, which would mutate a provider shared with the rest of the page and, on
  `SvelteI18nProvider`, reload the document. Two players on one page can now render different locales
  from one provider, and a second locale is still parsed only once. The reload path stays as the
  default for a host-driven switch.

  Declare `@pie-qti/i18n` as an optional `peerDependency` rather than a `dependency` of
  default-components, item-player, section-player and assessment-player. Every import of it in those
  packages is `import type` and none of their built JavaScript references it, so a host that never
  constructs a provider should not be made to install it. It stays a `devDependency` so the workspace
  resolves the types locally.

## 0.1.21

## 0.1.20

## 0.1.19

## 0.1.18

## 0.1.17

### Patch Changes

- 9b1e118: Derive the answer key, partial credit, item weight and choice layout from the QTI source
  instead of dropping them.

  Five conversion defects, each of which produced a PIE item that renders correctly and is
  therefore silently wrong. They were found by comparing `to-pie` against a batch loader
  that has been run over far more real publisher content than our conversion path has.

  **The answer key can live in `mapping`, and nine transformers did not look there.**
  `mapEntry` was consulted only in `drag-in-the-blank`, `ebsr` and `match-list`. This is
  plain QTI, not a vendor quirk: an item scored by the `map_response` template need not
  declare a `correctResponse` at all. Such an item converted with an _empty answer key_ —
  it rendered, but was unscorable and showed reviewers no key. A new
  `utils/response-scoring.ts` now supplies the fallback to `multiple-choice`,
  `inline-dropdown`, `placement-ordering`, `select-text`, `match`, `hotspot`,
  `explicit-constructed-response`, `image-cloze-association` and
  `associate-to-categorize`.

  Two rules keep the fallback safe and both are load-bearing:

  - **`correctResponse` always wins.** The mapping is read only when the declared key
    produced nothing, so a declared key is never overwritten.
  - **Only a strictly positive `mappedValue` marks a key correct.** Real Savvas content
    ships `<mapping defaultValue="-0" lowerBound="0" upperBound="0">` with _every_
    `mapEntry` at `mappedValue="0"` while the real key sits in `correctResponse`. An
    unsigned reading of those marks every listed choice correct. `drag-in-the-blank` only
    skipped negatives, so it admitted the zero-scoring case; `match-list` had no sign check
    at all.

  **`partialScoring` and item weight are now derived, not asked for.** `partialScoring` was
  a caller-supplied option that no caller in `registry/`, `plugin.ts`,
  `package-transformer.ts` or `source-profile-runtime.ts` ever set, so every converted item
  was all-or-nothing even when its source declared graded credit. `mapping/@upperBound` was
  read nowhere. A mapping's presence now implies partial scoring, and the weight resolves
  from `mapping/@upperBound`, then the `MAXSCORE` outcome declaration, then the summed
  positive `mapEntry` values, landing on `searchMetaData.maxScore`. The option remains as an
  explicit override.

  `@upperBound` is validated rather than handed to `Number()`. Observed values in the
  Region 10 / TEKSbank delivery include `"Max:3"` (`Number()` → `NaN`), `"0"` (parses, but
  is not a usable weight) and `"2 "` (must still parse as 2). Non-numeric and non-positive
  values are rejected and the next fallback is used.

  **Choice cardinality no longer trusts `maxChoices` alone.** It was
  `maxChoices === 1 ? 'radio' : 'checkbox'` with the attribute defaulted to `1` when
  absent, so a multi-answer item with a missing or wrong `maxChoices` became a single-select
  radio group that could not express its own answer key. `multiple-choice` and each `ebsr`
  part now switch to checkbox when more than one correct answer was found, independently of
  `maxChoices`. The `MC`/`MCA` `itemType` follows the resulting mode rather than repeating
  the same assumption. Cardinality is derived _after_ the answer key so a mapping-derived
  multi-answer key also triggers it.

  **`choiceInteraction/@orientation` is carried into the PIE choice layout.** It was read
  for `orderInteraction` and `sliderInteraction` but not `choiceInteraction`, so authored
  layout was silently dropped. `horizontal` and `vertical` pass through to `choicesLayout`;
  `grid` and `stacked` have no PIE equivalent and collapse onto a two-column grid
  (`choicesLayout: 'grid'`, `gridColumns: 2`). An absent orientation emits nothing, leaving
  the element's own default rather than pinning it to a guess. `pie-to-qti2` carries
  `choicesLayout` back out to `orientation` so the round trip is symmetric.

  **The hotspot player no longer guesses an image size.** `HotspotInteraction.svelte` fell
  back to `viewBox="0 0 800 600"` when the image's intrinsic dimensions were unknown.
  `hotspotChoice` coords are in the source image's pixel space, so that fallback does not
  degrade gracefully — it misplaces _every_ region, which reads as a content defect rather
  than the missing metadata it is. The overlay is now gated on known dimensions and an
  explanatory diagnostic is rendered instead (new
  `interactions.hotspot.unknownImageDimensions` message). The `to-pie` hotspot transform
  already failed loudly here; the player now agrees with it.

  27 conformance fixtures were added under
  `packages/to-pie/tests/fixtures/conversion-fidelity/` covering a mapping-only key per
  affected interaction type, mixed `mappedValue` signs, the all-zero-mapping precedence
  case, all three weight fallbacks plus both malformed `@upperBound` forms, both broken
  cardinality shapes, and every `orientation` value. The mapping-only shapes are
  synthesized: across 89,836 TEKSbank items every mapping-bearing response also declares a
  `correctResponse`, so no real item exercises the fallback.

## 0.1.16

### Patch Changes

- 5a4e39a: Normalize `repository.url` to the `git+https://` form.

  npm was rewriting this field at publish time and warning about it:

  ```
  npm warn publish "repository.url" was normalized to "git+https://github.com/pie-framework/pie-qti.git"
  ```

  Beyond silencing that warning, npm requires `repository.url` to match the GitHub
  repository exactly when generating provenance attestations, so this is a prerequisite
  for moving publishing to trusted publishing (OIDC). No runtime or API change.

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
