# @pie-qti/default-components

## 1.0.0-beta.5

### Patch Changes

- 64f6607: No functional changes: repository linting now covers Svelte files (the linter previously skipped every `.svelte` file entirely). Mechanical cleanup in `position-object` and `select-point` interactions uses `Number.isNaN` instead of the global `isNaN` on values that are already numbers.
- d7a8262: Package metadata hygiene: `@pie-qti/default-components` now declares svelte with a caret range (`^5.57.1`) like every other package instead of an exact pin that could ship two svelte runtimes into one bundle; `@pie-qti/assessment-toolkit` drops its never-imported `@pie-qti/ims-cp-core` dependency and `@pie-qti/assessment-player` drops its never-imported direct `@pie-qti/default-components` entry (it consumes default-components transitively through `section-player`, which remains declared). Both packages gain READMEs (assessment-toolkit, source-profiles) describing their role and consumers.
- 91d2e05: Extended-text names the minimum-strings hint in each response field's `aria-describedby` while it shows (WCAG 1.3.1, 3.3.2), per `MinimumRequirementHint`'s documented contract and like every other consumer: a field's description is its character counter, then its pattern-mask message while the text fails the mask, then the hint while the response holds fewer than `minStrings` filled fields — wiring both the plain textareas and the rich-text editor fields. Previously the hint rendered and announced but no field described it, so a screen-reader user focused in a field met the requirement only through the one-time announcement or in reading order, never as the field's own description; the description now appears with the hint and drops with it (when the minimum is met no description id remains).
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
- 7dcb9d7: Fix incorrect association state in `associate` and `graphic-associate` interactions when choice/hotspot identifiers share a prefix (e.g. `A` and `A1`, `hotspot1` and `hotspot10`). Pair membership was tested with substring matching, so a hotspot could appear "maxed out" and block valid answers, and correct-answer highlighting could misfire. Both interactions now use whole-token matching via the shared pair helpers, which gained tested `pairIncludesId`/`countPairsWithId` utilities.
- b504c41: `@pie-qti/default-components` and `@pie-qti/item-player` no longer declare `unpkg` and `jsdelivr` fields. The fields pointed CDNs at `dist/plugins.js` and `dist/element.js`, which import other `@pie-qti/*` packages by bare name and so never ran when a CDN served the raw file. Both package READMEs (the first one for `@pie-qti/default-components`) now have a "Loading from a CDN" note: use a bundler, an import map, or jsDelivr's `/+esm` endpoint, which rewrites bare imports. For a page without a build step, `@pie-qti/player-elements` is the turnkey option: its `register` entry is self-contained and keeps its CDN fields.
  
  **Breaking: the bare CDN URLs of these two packages no longer serve their custom-element entry** (beta prerelease). `https://unpkg.com/@pie-qti/default-components` and `https://unpkg.com/@pie-qti/item-player`, and the matching `cdn.jsdelivr.net/npm/` URLs, now fall back to each package's `main` entry, `dist/index.js`, instead of `dist/plugins.js` and `dist/element.js`. Neither URL ever worked standalone. Request the file you need by its path and resolve its imports with an import map, or use `/+esm`.
- 756771f: Accessibility and usability fixes for the choice, hottext, slider, and end-attempt interactions:
  
  - **choice**: visible keyboard focus on the whole row (including with `qti-input-control-hidden`), a ≥44px row target with a non-color selected state and 1rem base text, container-query reflow for `qti-choices-stacking-N`/horizontal layouts, an always-prompt-named answer group (`aria-labelledby`), a localized refusal message at `maxChoices` when none is authored, a "Clear answer" button for single choice, contrast fixes for the selection message and elimination toggle (44px target), and elimination toggles named from their action plus the choice text.
  - **hottext**: accessible names composed via `aria-labelledby` from the rendered content and a localized state word (no hardcoded "Selectable text:" prefix), a visible focus indicator under `qti-input-control-hidden`, a ≥3:1 selectable boundary cue, the localized refusal default at `maxChoices`, and a non-color correct-answer marker (underline plus hidden text) in the scorer view.
  - **slider**: the accessible name comes from the prompt (`aria-labelledby`) with `aria-valuetext`; before the first interaction the slider announces and displays "No value selected" in a distinct untouched state instead of presenting the midpoint; `orientation="vertical"`, `reverse`, and `stepLabel` are now rendered.
  - **end attempt**: counted attempts require an inline confirmation (focus on confirm, Escape cancels) before the response is emitted; after ending, focus moves to an announced `role="status"` message ("Your attempt has ended."); the accessible name is the visible label; controls use self-contained token styles at ≥44px.
  - **item-player**: `SliderInteractionData` now carries the authored `stepLabel` flag; `@pie-qti/i18n` adds candidate-facing strings for these behaviors across all eight locales.
- 0a1c071: Hosts now load one shared copy of the item player and the shared packages, instead of a private copy inside the components bundle.
  
  - **`@pie-qti/default-components/plugins`** no longer bundles its own copy of `@pie-qti/item-player`, `@pie-qti/i18n` (including seven locale catalogs) and `@pie-qti/qti-common`, or the `node-html-parser`, `@xmldom/xmldom` and `decimal.js` code they pulled in. It now imports them as the declared dependencies they already were, so the host's bundler resolves each one once. `dist/plugins.js` drops from 1.88 MB to 1.42 MB (gzip: 491 KB to 353 KB). The Svelte runtime, tiptap/KaTeX and mathlive are still bundled, and importing the entry still registers all 21 interaction custom elements.
  - **`@pie-qti/item-player/element` and `/element-class`** now import the item player's own modules from the package, instead of carrying a second copy. A page that uses both the root entry and the element now runs a single `Player`, `ItemSession` and PCI registry. The element chunk drops from 370 KB to 122 KB. It still bundles the Svelte runtime, so it works without a host Svelte.
  - **`@pie-qti/player-elements`** contains one copy of the item player core instead of two. Its JavaScript drops from 10.76 MB to 9.69 MB in total (gzip: 2.67 MB to 2.39 MB), and `register.js` drops from 1.87 MB to 1.41 MB.
  
  **Breaking: `@pie-qti/default-components/plugins` is no longer self-contained** (beta prerelease). Hosts that build with a bundler need no change. Loading `dist/plugins.js` directly in a browser, as the package's `unpkg` and `jsdelivr` entry does, now needs an import map, or an ESM CDN that rewrites bare imports, for the `@pie-qti/*` packages it imports and their dependencies. `@pie-qti/item-player/element` already works this way.
- 7cbed03: Match/associate/gap-match fixes: instance-unique description ids and the shared matchGroup rule.
  
  - **Instance-unique description ids**: every interaction's authored description now lives under its own id. `interactionAria()` and `<InteractionDescription />` derive the id from the interaction object (`interactionDescriptionId()`), so in a composite item each interaction's `aria-describedby` resolves to its own description instead of the first interaction's, including several interactions in one DOM tree and two renderings of the same item. Custom components spread `interactionAria(interaction)` and give their description element `interactionDescriptionId(interaction)`.
  - **`matchGroup` in the UI is the rule response validation applies**: the delivered match, associate, gap-match, graphic-gap-match and graphic-associate renderers now decide every pairing with `isMatchGroupCompatible` (newly exported from `@pie-qti/item-player`) instead of a label-only reading, so the UI no longer blocks pairs the specification allows (a `matchGroup` names the identifiers a choice may be matched with — QTI 2.2 Table 5.98.5 and friends) and never offers a pair validation rejects. Gaps and hotspots are constrained too: gap-match delivers each gap's `matchGroup` as `gapMatchGroups` and graphic-gap-match delivers each hotspot's; a held or dragged label marks and refuses the targets that don't accept it (`aria-disabled`, drop refused, reason announced). Placing one label no longer makes unrelated labels unavailable.
  - **Associate pair removal is announced**: a polite live region announces "Removed association between X and Y." with the readable choice names (image alt text included), localized in all 8 locales; the existing focus-after-removal behavior is unchanged, and removing the same pair again re-announces.
  - **Gap-match `gaps` type fixed**: `GapMatchInteractionData.gaps` is now the `string[]` of gap identifiers the extractor actually delivers (it was typed `{identifier, index}[]`), with a compile-time check in the extractor proving the delivered data satisfies the contract; hosts passing the previously typed shape must pass identifier strings.
  - **PRDs reconciled with the implementation**: position-object known gaps (keyboard placement K-04, spec stage hierarchy G-17, `minChoices` at validation, touch drag, i18n) and the interaction PRDs' `matchGroup`/`gapImg` sections.
- bdfc40e: Fix accessibility and QTI compliance in the drag/association interactions.
  
  - Rich choice content no longer collapses into a flattened `aria-label`: sortable, match and associate controls are named with `aria-labelledby` pointing at the rendered content, so image `alt` and MathML `alttext` participate in the name. Position/state sentences ("Position 2 of 4", "Matched with …", "Selected") moved to `aria-describedby` targets, and live announcements use a new `accessibleTextFromHtml` walker that reads image alt, MathML alttext and SVG titles instead of raw `textContent` (WCAG 1.1.1/4.1.2).
  - Raw QTI identifiers no longer leak into accessible names: associate choices drop the "A_choice_2: Paris" prefix and gap-match blanks are named with localized ordinals ("Blank 2 of 4") instead of the gap identifier, which could reveal answers to screen-reader users.
  - `gapMatchInteraction` now supports `gapImg` (QTI 2.x `gapImg` with `<object>`, QTI 3.0 `qti-gap-img` with `<img>`/`<object>`): image choices are extracted into the pool with alt text and matchMax/matchGroup, rendered as image tiles in the palette and inside filled gaps, and validation accepts an image-only item instead of erroring "must have at least one gapText".
  - Contrast and target-size fixes (WCAG 1.4.11/2.5.8): empty gap-match blanks and match drop zones use a 3:1 boundary (`--pie-qti-border-strong`), the gap-match focus ring is solid `--pie-qti-focus` without alpha, the held-word cue uses `--pie-qti-border-strong`, the match clear button, gap-match remove buttons and blanks are 44px targets, and the match max-selections message uses the warning text token for 4.5:1 text contrast.
  - Order interaction: the elimination toggles now render inside their item's row (aligned at any row height), and move/eliminate buttons are named for their item ("Move Paris later", "Eliminate Paris"), including image alt from rich item content.
  - Escape now cancels a held word (gap-match) or selected source (match), announces the cancellation and returns focus to the item.
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
- 209a0c0: The gap-match and graphic-gap-match interactions announce a repeated message again (WCAG 4.1.3). A live region speaks a change of its text, and the two interactions wrote their `aria-live` region from a plain string, so two identical messages in a row — the same over-limit refusal, the same match-group "not available" — left the text unchanged and assistive technology stayed silent the second time. They now use the shared announcer the other interactions use, whose repeat appends a trailing zero-width space, so the region still changes and the second refusal is announced. The messages themselves are unchanged.
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
- 6128449: Follow-up accessibility and behavior fixes for the choice, hottext, slider, match and order interactions:
  
  - **Instance-unique ids**: element ids are now unique per component instance (`$props.id()`), so several interactions, or two renderings of the same item, can share a document without cross-labelling. This covers the match column headings (used by structured labels) and keyboard instructions, the sortable-list instructions, the choice prompt, choice text and elimination-verb ids, the slider prompt and tick list, and the hottext name parts. The choice radio group `name` is unique per instance too, so answering one rendering no longer unchecks the other's radio.
  - **hottext**: with `maxChoices=1`, selecting another hottext now replaces the current selection (radio-like, as in `choiceInteraction`) instead of being refused; unselected hottexts keep their selectable cue, and the default selection-limit message is shown only when a selection can actually be refused (`maxChoices>1`). Activating a selected hottext still deselects it, and a selection refused at the `maxChoices>1` cap no longer emits an unchanged `qti-change`.
  - **order / sortable lists**: the deprecated `aria-grabbed` is no longer emitted; grab state stays exposed through the item description ("Grabbed. Use arrow keys to move."), `data-grabbed` and the live announcements.
  - **Accessible text**: `aria-hidden` content is skipped before its own alternative is read, so a hidden icon carrying `alt` or a `<title>` beside the same visible word no longer doubles the announcement ("Close Close").
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
- 19b6ce2: The choice interaction's authored minimum message (`data-min-selections-message`) now renders in the delivered (custom-element) path. It was read once at component creation, before delivery assigned the interaction's props, so it was captured as undefined and an author's message never appeared — and for `minChoices=1` questions with an authored message, no hint appeared at all.
- 495730a: Fix the order interaction's elimination tool being hidden from assistive technology while remaining keyboard-operable. The button column was marked `aria-hidden="true"`, which a descendant cannot override — screen-reader users could tab onto ✕ buttons that were never announced, and could not use the Personal Needs and Preferences elimination feature at all (WCAG 4.1.2). The buttons are now exposed with their `aria-label`/`aria-pressed` state, matching the accessible structure the choice interaction already uses for the same feature.
- 098f997: Round-3 accessibility fixes for content language, transient UI on pause, and forced colors:
  
  - **Test-level content keeps its language (WCAG 3.1.2):** the assessmentTest parser now carries
    the authored language of each `testFeedback` and `rubricBlock` (passages, instructions) as an
    optional `language` field: its own `xml:lang` (QTI 3.0 also `lang`, or its
    `qti-content-body`'s), else the enclosing test part's, section's or test's, across an
    `assessmentSectionRef` too; `xml:lang=""` declares none. `TestFeedbackItem`,
    `VisibleTestFeedback` and `AssessmentRubricBlock` gain the optional field,
    `normalizeQtiSharedContext` passes it through as `QtiSharedHtmlBlock.language`, and the section
    player's `TestFeedback` renders it as each block's `lang`/`dir` — in delivery and on the
    completion screen — so screen readers and read-aloud switch to the content's voice while the
    chrome keeps the interface locale. A passage's nested `xml:lang` is now restated as HTML `lang`
    (with `dir` where the direction changes against the passage's own language) even without SSML.
  - **Transient UI closes on a proctor pause:** the math-input dialog and glossary/catalog popups
    listen for the host's `pie-qti-close-transient-ui` event on `document` (the assessment shell
    dispatches it with `detail.reason: 'pause'`). The math dialog closes through its cancel path
    (`onCancel`, focus trap released, focus back on its opener) and a request that arrives while
    MathLive is still loading cancels it before it opens; an open popup closes as if dismissed. The
    math dialog's focus trap is re-entrancy-safe: it never re-handles the focus moves it makes, so it
    cannot recurse against another focus containment such as the pause overlay.
  - **States survive forced colors (WCAG 1.4.11/1.4.1):** in Windows High Contrast and other
    forced-colors modes the picked-up item of a reorderable list keeps a heavier system `Highlight`
    border (no layout shift), and pressed Bold/Italic toolbar toggles in the rich-text editor take
    the system selection colours. Focus outlines are unchanged.
- ad99965: Accessibility fixes from the round-4 WCAG 2.2 AA review:
  
  - **Interactions state their minimum requirement** (WCAG 3.3.2, 3.3.3). Choice, match, associate, order, gap match, hotspot and graphic order interactions show a visible hint while the response is below its authored minimum (`minChoices`, `minAssociations`, a choice's `matchMin` in match, associate and gap match), the same minimums response validation enforces before an answer counts as complete. The author's `data-min-selections-message` wins over the localized default ("Select at least 2 answers.", "Needs more associations: Red.", "Still to place in the blanks: blue and green."). The hint describes the answer group (`aria-describedby`), draws in `--pie-qti-warning-text`, and is announced politely once when a change leaves the minimum unmet, not on every change. It shows only while the candidate can answer: not when the interaction is disabled or rendered for another role.
  - `@pie-qti/item-player` delivers `minSelectionsMessage` for order and associate interactions, also reads the QTI 3.0 `data-min-selections-message` on match interactions, and extracts graphic order `minChoices` (with its message), which response validation now enforces. `GapMatchInteractionData` choices carry `matchMin`.
  - New `interactions.*` catalog keys in every locale: `choice.minChoicesHint`, `match.minAssociationsHint`, `match.minChoiceUsesHint`, `associate.minAssociationsHint`, `associate.minChoiceUsesHint`, `order.minChoicesHint`, `graphicOrder.minChoicesHint`, `hotspot.minChoicesHint` and `gapMatch.minPlacementsHint`.
  - **PNP inverted polarity no longer inverts a forced-colours palette**: under `@media (forced-colors: active)` the inversion filter is off, so Windows high contrast keeps the colours the candidate chose.
  - **A proctor pause keeps a typed math expression**: the math dialog reports a host close as an interrupted cancel with the LaTeX typed so far, and the rich-text editor offers it again in its next insert dialog. The draft is session-only and per response field; inserting the math or the candidate's own cancel discards it.
  - **Nested languages in section content**: an `xml:lang` inside test feedback, instructions or rubrics now renders as HTML `lang` (with `dir` where the direction changes), as in passages (WCAG 3.1.2).
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
- 209a0c0: The six graphic interactions (hotspot, select-point, graphic-order, graphic-associate, graphic-gap-match, position-object) share one module for the ImageStage sizing handshake (`createStageImage`): the stage's pixel space, the refusal to draw in an unknown space, the once-only author warning, and the frame/scale derivations. Each component keeps its own gate, which legitimately differ: the hotspot's image is mandatory, so it gates on the parsed interaction, while the others gate on their image data. Behaviour is unchanged except:
  
  - **graphic-associate**'s stage frame no longer clamps to 4px wide while the image size is unknown (a drifted `?? 0` in its `max-width` style); like the other graphic interactions it just does not constrain the frame until the size arrives.
  - **position-object**'s drag-image scale now reads the stage's reactive reported width (ImageStage `reportWidth`) instead of measuring the container at drag start — the same measurement, so drag images keep their size.
- 74c3886: **Behavior change: interaction attributes that an item leaves out now take the QTI default for the item's QTI version.** The player detects the version of each item (2.1, 2.2 or 3.0) and applies the default that version's schema and information model define. An attribute you author is always honoured as written, and `0` on a `max…` limit still means no limit.
  
  - **Graphic gap match:** QTI 2.2 and 3.0 items that omit `maxAssociations` (`max-associations`) now allow one association, the spec default. Before, they allowed any number. To let candidates fill several hotspots, state `maxAssociations` explicitly, for example `maxAssociations="3"`, or `"0"` for no limit. QTI 2.1 items have no such attribute, so they still have no overall limit.
  - **Gap match:** `maxAssociations` is now supported. The player used to ignore it. QTI 2.2 and 3.0 items that omit it now allow one association, the spec default, so a cloze meant to fill several gaps must state `maxAssociations`, for example the number of gaps. QTI 2.1 items have no such attribute and keep no overall limit. A placement past the limit, by keyboard or pointer, is refused and announced: the author's `data-max-selections-message` if there is one, otherwise the new localized message `interactions.gapMatch.associationLimitReached`. A held word stays held, so the candidate can place it elsewhere or cancel. Response validation rejects a restored or programmatic response with more associations than the limit.
  - **Choice:** QTI 2.1 items that omit `maxChoices` now allow any number of selections, as QTI 2.1 defines (`maxChoices = 0`). Before, they allowed one. A 2.1 item bound to a single-cardinality response still allows one. QTI 2.2 and 3.0 are unchanged, with a default of 1.
  - **Select point:** QTI 2.2 and 3.0 items that omit `maxChoices` now allow any number of points, the spec default (`0`), when the response has multiple cardinality. Before, they allowed one point. Items bound to a single-cardinality response still take one point. QTI 2.1 items are unchanged.
  
  For hosts and plugin authors: extraction now receives the item's QTI version as `ExtractionConfig.qtiVersion`, and `GapMatchInteractionData` gains an optional `maxAssociations`. The full table of audited defaults is in `docs/QTI_attribute_defaults.md`.
- 30bc3bf: The hotspot and graphic-gap-match interactions bind the shared image stage's `renderedWidth` without enabling `reportWidth`, so the stage never reported its rendered width and the shared stage image pinned `renderScale` to 1: the markers, zone badges and the 24px touch-target compensation rendered unscaled whenever the image was shown below its natural size — the one situation the compensation exists for. Both interactions now pass `reportWidth`, mirroring graphic-order and position-object, and component tests pin the wiring (a half-scale stage compensates a region's touch target at the rendered scale, the hotspot marker counter-scales, and a full-size stage compensates only the shortfall).
- b34d710: String answers that look like JSON are no longer rewritten. The interactions JSON-parsed every string `response` and `correctResponse` the host set, so an extended text field rewrote a typed `1.50` to `1.5` and `1e5` to `100000` while the candidate typed, dropped the quotes of `"quoted"`, turned `[1]` into `1`, and lost the answer `null`; a choice, hottext or hotspot region identified `true`, `false` or `null` lost its selection, and a portable custom interaction got its JSON-text response back as an object. Responses are now values: a string response is kept exactly as given, and only `null` means no response. The identifier-list interactions (order, match, associate, gap match, the graphic interactions, a multiple-selection hotspot) still read the JSON array an HTML attribute carries as that list. The interaction data and the PNP profile still accept their JSON text, as an HTML attribute carries it. Upload and drawing no longer type their `response` prop as `| string`.
  
  Extended text interaction data whose `base` is absent or not an integer from 2 through 36 is now read in base 10: showing a numeric response no longer throws (it crashed the field, and the text entry's string companion), and a typed number is no longer dropped.
- 643ae6c: Keep focus indicators and text on fills readable in every stock DaisyUI theme, and keep PNP custom colours readable.
  
  **DaisyUI bridge, focus indicator**: `--pie-qti-focus` was DaisyUI's primary, which is below 3:1 against the page in 12 of the 35 stock themes (cupcake: 1.25:1), leaving focus rings invisible. In engines with relative colour syntax and `light-dark()`, the bridge now keeps the primary wherever it is already distinguishable and otherwise darkens (light themes) or lightens (dark themes) it in linear light just far enough: luminance at most 0.175 in light themes, at least 0.25 in dark themes, which clears 3:1 on every stock theme's `base-100` and `base-200` (lowest 3.10:1). Engines with only `color-mix()` get 45% primary mixed with `base-content` (lowest 3.09:1). Hosts can still set `--pie-qti-focus` themselves.
  
  **DaisyUI bridge, text on fills**: every `--pie-qti-*-content` is now black or white, whichever contrasts more with its fill (at least 4.58:1 for any colour; lowest stock pair 4.66:1), instead of DaisyUI's `*-content`, which falls below 4.5:1 in 40 of the 280 stock fill pairs (light theme `secondary-content`: 3.04:1). Engines without relative colour syntax keep DaisyUI's colours. `applyDaisyThemeToElement` and the mapping helpers choose the same tier with `CSS.supports()` and accept `{ supports }` to choose one explicitly.
  
  **PNP custom colours**: with a candidate's own text or background colour (text appearance), the message/state text, `--pie-qti-border-strong`, and `--pie-qti-focus` tokens now draw in the text colour (the candidate's, or the theme's when only a background is set) instead of theme colours that were only checked against the theme's surfaces, and the background colour also covers `--pie-qti-base-200` surfaces.
- 51e70e8: Make the theme token contract meet WCAG 2.2 AA contrast, and keep authored MathML native.
  
  **New theme tokens** (`@pie-qti/theme/tokens.css`, light and dark):
  
  - Message/state text on base surfaces: `--pie-qti-error-text`, `--pie-qti-warning-text`, `--pie-qti-success-text`, `--pie-qti-info-text` (at least 4.5:1 on `--pie-qti-base-100` and `--pie-qti-base-200`). Use these for feedback and status text instead of the state fills (`--pie-qti-error`, ...), which are background colours and reach only 1.8:1 to 2.9:1 as text on white.
  - `--pie-qti-border-strong` for control boundaries and non-text cues (at least 3:1, WCAG 1.4.11); `--pie-qti-focus` is now guaranteed at least 3:1 as well.
  - Typography, spacing, and shape tokens: `--pie-qti-font-family` (`inherit`), `--pie-qti-font-size-base`, `--pie-qti-line-height`, `--pie-qti-radius`, `--pie-qti-radius-sm`, `--pie-qti-space-1` to `--pie-qti-space-6`, and `--pie-qti-control-min-size` (2.75rem).
  
  The light-theme `--pie-qti-error-content` and `--pie-qti-secondary-content` (2.7:1 and 3.45:1 on their fills) and the dark-theme `--pie-qti-error-content` are now dark text on those fills, so every `*-content` colour reaches 4.5:1. A contrast test now enforces these guarantees for both palettes; see the `@pie-qti/theme` README for the full token guide.
  
  **DaisyUI bridge**: the new text and border tokens keep the accessible `@pie-qti/theme` values (chosen per `color-scheme` with `light-dark()`) rather than DaisyUI's info/success/warning/error fills, which fail as text; `--pie-qti-radius` and `--pie-qti-radius-sm` follow DaisyUI's `--radius-box` and `--radius-field`. Contrast is verified for DaisyUI's `light` and `dark` themes.
  
  **Default components**: interaction styles draw select, textarea, and file-input borders with `--pie-qti-border-strong`, state text (`.text-success`, plus new `.text-error`, `.text-warning`, `.text-info`) and correctness outlines with the `*-text` tokens, and every shadow root gets an opaque 2px `--pie-qti-focus` outline on `:focus-visible`. `qti-well` follows the theme instead of a fixed light grey (which was unreadable in dark themes). PNP colour schemes now also redraw the new text and border tokens, and PNP text appearance feeds the new font tokens.
  
  **KaTeX typesetter (behaviour change)**: `typesetMathInElement` no longer converts authored `<math>` to LaTeX. The converter handled only a dozen elements, fell back to bare text for the rest (`mtext`, `munderover`, `mtable`, ...), and dropped `alttext`, losing meaning for sighted and assistive-technology users. Authored MathML now stays native (MathML Core renders in evergreen browsers) with its `alttext` intact; prefixed MathML such as `<m:math>` is re-created as real MathML elements and `<mfenced>`, which MathML Core does not render, is expanded into its MathML 3 equivalent. LaTeX delimiters in text are typeset as before, never inside `<math>`.
- 30bc3bf: `parseJsonProp` — the reader behind every interaction's `interaction` (and PNP) attribute — returned non-JSON text as-is cast to the data type, contradicting its own contract of a prop whose value is always an object: a truncated attribute (`interaction='{"choices":…'`, what templating that cuts long attributes leaves behind) produced a string masquerading as the interaction data, rendering the interaction empty with no diagnostic. Text that does not parse to a JSON object (truncated attributes, and JSON of another shape — a number, string or array) is now reported once per distinct text on the console and read as no value, so the component renders its no-data state (`alert` with the no-data message) instead; the shells and every component already treat an absent interaction exactly that way. Components tests mount a truncated attribute and pin the no-data state, the one-per-distinct-text warning and an unaffected valid attribute.
- 68c8b37: Validation feedback where the candidate answers, and correct-answer mode only for items that have a correct response.
  
  - **Extended text says when a response does not match its `patternMask`** (WCAG 3.3.1). A string response that fails the mask is invalid under `validateResponses` (QTI 2.1; QTI 3.0 §5.48.4); the field now says so. When the candidate leaves a field (plain text or rich text) whose text fails the mask, the author's `data-patternmask-message` shows below it, else the new localized `interactions.extendedText.patternMismatch` sentence. The message describes the field (`aria-describedby`), the field states `aria-invalid="true"`, and the message is announced once through the interaction's polite live region; it clears as soon as the text matches and never blocks typing. The mask is compiled with the player's own XSD translation (`xsdPatternToRegExp`) and tested against the text the response holds, so the message and validation agree: an empty field and a numeric response are never flagged. Each field of a multi-part response is checked on its own. `@pie-qti/default-components` now depends on `@pie-qti/qti-processing` for that translation.
  - **The extended-text extractor reads the QTI 3 `data-patternmask-message`.** It read a `patternMaskMessage` attribute that no QTI version defines, so `ExtendedTextInteractionData.patternMaskMessage` was never set from authored content; it now reads `data-patternmask-message` (QTI 3.0 `qti-extended-text-interaction`; QTI 2.x has no equivalent), as the text entry extractor does.
  - **Gap match marks its required gaps** (WCAG 3.3.2). A gap authored `required` (QTI 2.1 gap; QTI 3.0 §5.55.5) must be filled for a valid response, which validation enforces; the candidate is now told which gaps those are. Each required gap shows an asterisk — a character, not a colour alone — that a visible legend before the passage explains (new key `interactions.gapMatch.requiredBlanksLegend`, "Blanks marked * are required."). A gap is a button, on which ARIA does not allow `aria-required`, so the requirement is the gap's accessible description instead ("Required.", from the existing `common.required`). Gaps carry `data-required="true"` for styling.
  - **Correct-answer mode needs a correct response** (QTI-observable rendering change for scorer views of items without one). Order, match, hottext, slider, select point, position object, gap match and graphic gap match now take correct-answer mode from the shared interaction shell — the scorer's view of an item that *has* a correct response (`role === 'scorer'` and a correct response present) — instead of their own inline `!== null` checks, which put a scorer view of an item without a correct response (hosts pass `null`) into correct-answer mode. Two of them showed it: the **slider** was disabled, announced "undefined Correct answer: {answer}." and showed an empty "Selected Value" readout instead of the untouched slider, and **graphic gap match** hid its label palette, so the scorer could not place labels. They now render and emit as for a candidate; only `disabled` stops interaction outside the correct-answer view. The other six already rendered the same (their correct-answer data was empty without a correct response). Items that have a correct response render as before.
  - **Graphic gap match no longer names the correct label outside the correct-answer view.** A hotspot's accessible name said "Correct answer: {label}" whenever a correct response was passed, for a candidate too, while the visible marker was rightly hidden; screen-reader users alone heard the key. The name now carries it only in the scorer's correct-answer view.
- ecbc9ef: Three fixes reported by the new accessibility regression tests:
  
  - The math-input dialog's Shift+Tab now moves focus out of the math field to the dialog's controls. MathLive claimed Tab/Shift+Tab for placeholder navigation and swallowed the key even at the field boundary, leaving backward keyboard navigation dead inside the dialog. Tab keeps MathLive's placeholder navigation; Shift+Tab exits backward; forward wrapping uses MathLive's `move-out` event.
  - The customInteraction fallback derives its textarea id per instance, so two renderings of the same item on one page no longer share an id and mislabel each other's input.
  - The customInteraction fallback receives the interaction's i18n provider, so its candidate-facing text follows the configured language instead of always showing English defaults (its textarea border also meets non-text contrast now).
- 5e5072a: Fix the gap-match interaction rendering the prompt **twice** — once as static HTML with dead `[GAP:...]` markers, and again as the interactive text with live blanks. The prompt (with its gaps) now renders once, declaratively: the prompt text is split on the extractor's `[GAP:id]` markers into sanitized segments, each sent to the `{@html}` sink separately (keeping every sink call policy-checked for Trusted Types), with Svelte-rendered gap buttons between them. This removes the component's hand-built DOM layer — per-gap `document.createElement` with six manual listeners and a cleanup array, plus a re-render effect carrying five eslint suppressions. Focus is now preserved by the framework (nodes persist across updates) instead of a manual refocus hack. Adds first component coverage for gap-match: single render, pick-up/place flow, clear-on-click, scorer correct-answer display, multi-gap ordering.
- 795c767: QTI spec-conformance fixes for interaction extraction and delivery data.
  
  **Image element forms (QTI 3.0).** Every graphic interaction (hotspot, graphic order/associate/gap match, select point, drawing, position object) and the `gapImg`/`qti-gap-img` label now accepts the full QTI 3.0 `object|img|picture` choice. A `<picture>` background previously extracted `imageData: null`, leaving the interaction unanswerable; a QTI 3.0 `<img>` position-object stage or draggable made extraction throw and the whole item fail to load. The delivered image data is derived from the `<picture>`'s `<img>` fallback, so its shape is unchanged for renderers.
  
  **Response completeness.** `graphicGapMatchInteraction` now extracts `matchMin` on `gapImg` and `associableHotspot` (it had gapText only) and response validation enforces the hotspots' minimum, so a response using such a choice or hotspot fewer than `matchMin` times is no longer accepted as complete. The delivered `gapTexts`/`gapImages`/`hotspots` types carry `matchMin`; `hotspots` also carries the authored `hotspotLabel`, which the default graphic gap match component uses to name zones for assistive technology (placement announcements included) instead of the generic "Hotspot 1/2".
  
  **Authored names.** Gap images deliver the gapImg `objectLabel` attribute (QTI 2.1 `objectLabel.GapImg.Attr`, QTI 3.0 `object-label`); both gap-match components use it after the image's alt text, before the generic fallback.
  
  **Booleans and shuffle.** Interaction boolean attributes now read the full xs:boolean lexical space, so `shuffle="1"`, `fixed="1"`, `required="1"`, `count-attempt="1"`, `step-label="1"` and `reverse="1"` extract as on. `fixed` is now read on match and associate `simpleAssociableChoice` (and on QTI 2.1 `gapText`/`gapImg`, read for QTI 2.1 content only — 2.2/3.0 define none), so authored fixed choices keep their position under `shuffle="true"` instead of being shuffled.
  
  **Removed surfaces (previously tolerated inputs stop working):**
  - The PCI extractor reads only the schema-defined `customInteractionTypeIdentifier` / `custom-interaction-type-identifier`. The never-standardized `customInteractionIdentifierType` / `custom-interaction-identifier-type` spellings it also accepted are no longer read; hosts passing those must use the schema name. `@pie-qti/to-pie` follows: its PCI type-identifier read is the same two schema names, and its unsupported-interaction diagnostic names the field `customInteractionTypeIdentifier`.
  - Three dead delivered-type members are deleted: `AssociateData.minSelectionsMessage`, `GraphicOrderData.minSelectionsMessage` (attributes no QTI version defines; never populated) and `GapMatchInteractionData.gapTexts[].inputWidth` (never populated; the `qti-input-width-*` class reaches the renderer via `classes`). Plugin authors reading them must switch to the delivered `classes` (input width) or drop the read (the messages).
- 91d2e05: Hottext announces its minimum-choices status instead of only showing it (WCAG 4.1.3 Status Messages). The interaction joins the shared `MinimumRequirementHint` pattern every other min-choices interaction uses: while the selected hottexts are short of `minChoices`, the authored `data-min-selections-message` (or the localized "Select at least N") shows as the hint paragraph, the answer group names it in `aria-describedby`, and a response change that leaves the minimum unmet is announced politely once per unmet stretch — silent on further changes while it stays unmet, re-announced after the minimum is met and falls short again. Visible change: the footer's "✓ Minimum met" / "Select at least N" badges are gone — the requirement states itself as the shared hint while unmet and clears when met, as in choice, order, match, associate, hotspot and the rest, and the hint shows only while an enabled candidate can answer (the badges rendered in scorer and disabled views too). The "Selected: N / M" footer counter is unchanged, and the cataloged `interactions.hottext.minimumMet` key is now unreferenced (left in place for the i18n package's owners to retire).
- befc768: Icons and gap targets stay usable in engines that do not blur the Chromium path (found running the e2e suite in Safari/WebKit, Firefox, Chrome, Edge and Opera):
  
  - **Icons render without host CSS**: the shared `Icon` component now carries intrinsic `width`/`height` attributes (24 = 1.5rem). A viewBox-only SVG has no intrinsic size and collapsed to 0×0 in WebKit whenever no CSS reached it; Chromium masked the hole with its own default-size heuristic. Call-site sizing utilities (`w-4 h-4` …) and the end-attempt interaction now carry them too, and the dead parent-scoped `.qti-icon*` rules (Svelte 5 never forwards a parent's scoping class onto a child component's root, so they matched nothing in any engine) are removed from order, graphic-order, graphic-associate, select-point and position-object.
  - **Gap-match targets take focus on click**: clicking a blank now focuses it (`event.target.closest('button[data-gap-id]')`), so the focus ring and the next Tab stop follow the pointer in Safari, which never moves focus to buttons on click. The match interaction already did this for its own controls.
- 500b714: All interaction plugins now emit response changes through the shared `emitInteractionChange` helper instead of seventeen hand-rolled copies of the notify-and-dispatch trio. Every `qti-change` event now carries the same non-empty-response-id guard, bubbling/composed flags, and timestamp shape regardless of which interaction produced it (several hand-rolled sites lacked the guard or dispatched conditionally). The graphic-associate hotspots now expose their pairing selection state via `aria-pressed`, so screen readers can hear which hotspot is held while composing an association.
- a183a16: Dead-code and legacy-code removal (cleanup phase 1). Spec-conformant content behaves exactly as before: response values, scoring, session lifecycle, feedback and rendering are untouched. Only input outside the QTI and PCI bindings narrows; see "Breaking: legacy API and input forms removed" below.
  
  **Breaking: removed exports** (beta prerelease; migrate away from them before upgrading):
  
  - `@pie-qti/item-player` root and extraction exports `isSuccessResult` / `isErrorResult` are gone. Nothing inside the repo or docs used them; narrow the `ExtractionResult` discriminated union directly (`if (result.success) …`).
  - `@pie-qti/item-player` web-components entry no longer exports `QTIReadyEvent`, `QTIErrorEvent`, `QTISelectionChangeEvent` (nor `QTIErrorEventDetail` / `QTISelectionChangeEventDetail`). None of these events was ever dispatched by any component or player; listen to `qti-change` instead, which is the event the components actually emit.
  - `@pie-qti/item-player` no longer exports the types `InteractionType`, `OutcomeDeclaration`, `InteractionResponse` and `InteractionContext` from its root. `InteractionType` was a `string` alias; the other three were unused engine-internal shapes. `VariableDeclaration`, `ResponseDeclaration`, `Mapping`, `MapEntry`, `AreaMapping`, `AreaMapEntry` and the session state/serialization types are unchanged.
  - `@pie-qti/default-components` no longer exports `isSourcePaired` / `isTargetPaired` from its root (unused pair-predicate helpers) and no longer exports `MIN_TARGET_PX` / `parseCoords` (they remain internal to the graphic-region helpers; their behaviour, which the graphic interactions rely on, is unchanged).
  
  Also removed from `@pie-qti/item-player` (undocumented, unused): `Player.syncPciDisabledState`, `Player.getTrustedTypesPolicyName`, `Player.getExtractionRegistry`, `AssessmentItemDocument.detectVersion`, and the `PciHost` constructor's undocumented `string` options overload — pass `PciHostOptions` (`{ baseUrl }`) instead; every in-repo caller already does. `LiveItemSession`'s constructor no longer accepts a missing `prepared` argument — sessions are constructed through `AssessmentItemDefinition.openSession()`, which always supplies it.
  
  **Breaking: legacy API and input forms removed** (the project is pre-1.0 and keeps no compatibility paths for its own earlier APIs or formats):
  
  - `@pie-qti/default-components` choice interaction (`pie-qti-choice`): the `structuredLabelSupport` prop is gone. It had no effect: the choice set is always one group named by its prompt (a localized generic name without one; an authored accessible name still wins). Hosts that set it on the element can drop it. `pnp.display.structuredLabelSupport` is unchanged; it still reaches every block interaction through the presentation plan and switches the match interaction's group and column labels.
  - `@pie-qti/default-components` select-point interaction (`pie-qti-select-point`): the `response` prop no longer reads `{ x, y }` objects, alone or in an array; such a value places no points. Pass the QTI point form, an `"x y"` string or an array of them, which is what the item player supplies.
  - `@pie-qti/item-player` PCI variable JSON input (`fromQtiVariableJson`, so every PCI `getResponse()` answer): only the PCI v1.0 Appendix A binding is read. The earlier shapes now read as NULL: name-keyed records `{"record": {"<field>": …}}` (send an array of `{name, base | list}` members); pairs, directedPairs and points as `"A B"` strings (send two-element arrays); durations as numbers or non-ISO strings (send an ISO 8601 duration such as `"PT90S"`). One such member makes a whole list NULL, and a record member in such a shape reads as NULL. A PCI module still answering in those shapes stores no response, so it scores as unanswered until it moves to the spec binding. The writer (`toQtiVariableJson`), the state seeded at `getInstance`, and the player's runtime values are unchanged.
- 8d03d05: Module boundaries (cleanup phase 3), with one fix.
  
  **Fix: a coded error keeps its code across copies of the package.** `isAssessmentPlayerError` (and `assessmentErrorDisplay`, which builds on it) used `instanceof`, which fails for an `AssessmentPlayerError` created by another copy of `@pie-qti/assessment-player`. The `<pie-qti-assessment-player>` bundle carries two copies — it compiles the shell and core from source and also imports the package's built entry — so a coded error reached the `player-error` event without its `code`. A host that loads `@pie-qti/assessment-player` beside the self-contained player-elements bundle met the same split. Every `AssessmentPlayerError` now carries a `Symbol.for('pie-qti.AssessmentPlayerError')` brand, which the guard checks; recognize coded errors with `isAssessmentPlayerError`, not `instanceof`.
  
  Without behavior changes:
  
  - `@pie-qti/section-player` exports `filterToolsForRole`, the tool filter its composition applies. `@pie-qti/assessment-toolkit`'s `normalizeQtiToolConfig` is now that filter without PNP supports: the same result, still an array.
  - `@pie-qti/item-player` exports `DEFAULT_COMPONENT_TAGS_BY_TYPE`, its default custom-element tag per interaction type (plus `catalogPopup`), and `@pie-qti/default-components` derives `registerDefaultComponents` from it. Tag names are unchanged; the registrations' debugging `description` is now generic (`Default Svelte-based component for <type>`).
  - Internal: unpublished component source is imported through one workspace alias map instead of `../../../<pkg>/src` paths; item-player's presentation code no longer imports from its Svelte component helpers; the reference backend's session key prefix (`qti_session_`) is defined once, so saved sessions resume as before.
- 1449b94: Phase 4 (item-player) of the player cleanup: remove duplication with no QTI-observable change.
  
  - `@pie-qti/item-player`: one `escapeHtmlAttribute` (exported from the `security` subpath), one clone/freeze family (`cloneValue`, `deepFreezeInPlace`, `frozenSnapshot`), one `mergeDeliveryFields`, one name-mapper resolution (`resolveNameMappers`, `elementNameMapperForVersion`, `attributeNameMapperForVersion`, `defaultExtractionMappers`), shared PCI `resolvePciModuleUrl`/`pciEntryModule`, one `readResponseIdentifier` response-binding lookup behind interaction detection, slot hiding and diagnostics, and root exports for `patternExcludesMinus`/`classExcludesMinus`. All additions; no export moved or disappeared.
  - `@pie-qti/qti-processing`: adds `parseMatchTableDeclaration`/`parseInterpolationTableDeclaration` (the outcome-declaration lookup-table parser with a required name mapper; values stay lexical, `lookupOutcomeValue` still coerces).
  - `@pie-qti/default-components`: the extended-text keyboard now imports `patternExcludesMinus` from `@pie-qti/item-player` instead of keeping its own copy.
- 562182a: Phase 4a of the player cleanup: one shared image stage and keyboard crosshair for the graphic interactions, the declared→natural→refuse sizing rule everywhere, and three graphic accessibility fixes.
  
  **Sizing rule: declared width/height → natural size → refuse.** The graphic stages now resolve their pixel space the same way: the image's declared `width`/`height`, else — for a raster image — its natural size once loaded, else the interaction refuses (no overlay, no placements) and tells authors why: a console warning always, and a `role="alert"` diagnostic outside the candidate role. Coords, points and areaMapping live in image pixel space, so the 500×300 default that select point, graphic order, graphic associate and position object used for images without declared dimensions silently misplaced answers — those items now stage at the image's natural size, and items with neither a declared size nor a loadable image can no longer be answered in a guessed space. The `selectPointInteraction`, `graphicOrderInteraction`, `graphicAssociateInteraction` and `positionObjectInteraction` extractors stop inventing dimensions: the delivered `imageData.width`/`height` are optional now, set only when the item declares them. Position object's draggable object keeps its 50×50 fallback (it sizes a placement box, not a scoring space), as does the drawing interaction's 600×400 canvas (a blank canvas is a valid answer, and the canvas resolution is the response's own pixel size, never a scoring space). New i18n keys (all locales): `interactions.selectPoint.unknownImageDimensions`, `interactions.graphicOrder.unknownImageDimensions`, `interactions.graphicAssociate.unknownImageDimensions`, `interactions.positionObject.unknownImageDimensions`.
  
  **Graphic gap match: a `shape="default"` hotspot now lies beneath the other hotspots** (QTI 3.0 §8.29), like the hotspot interaction's whole-image region — previously it was drawn in authored order and covered every hotspot listed before it, taking their clicks and drops.
  
  **Distinct focus indicator on graphic regions (WCAG 2.4.7).** A region that was both selected and focused showed the focus stroke hidden under the selected outline (its halo grew by half a pixel). One shared rule now draws an offset outer ring — focus-within widens the region's halo layer into a focus-coloured ring around the region on hotspot, graphic gap match (whole-image backdrop included) and graphic associate's buttons take a shared offset outline — distinct from the selected state by geometry, not colour alone, in the theme's `--pie-qti-focus` token.
  
  **Sortable list labels wrap at 320 CSS px (WCAG 1.4.10 Reflow).** The reorderable list's move controls no longer squeeze the item into a clipped sliver on narrow screens: the controls wrap beneath the item and long labels (graphic order's hotspot labels among them) wrap instead of truncating.
  
  Under the hood: the seven graphic stages render through a shared `ImageStage` (media, load tracking, sizing style, one style sheet) and select point and position object share a keyboard crosshair controller — move-only refactors with the existing behaviour pinned before and after; the emitted points and refusals are unchanged for items that declare their image size.
- b5d8bf7: Phase 4b of the player cleanup: shared pick-up/place, pair, matchGroup and capacity rules for the drag-and-drop, pairing and selection interactions, and one capacity reading for malformed limits.
  
  **A limit that is not a number no longer blocks an interaction.** A non-numeric `maxChoices`, `maxAssociations` or `matchMax` (for example `maxChoices="any"`) reaches the components as `NaN`. Hottext, position object and graphic associate read it as "nothing more allowed" — every selection, placement or association was refused, and position object announced that the object "cannot be placed again" — and a match source with such a `matchMax` could not be dragged, while every other interaction read it as no restriction. Every interaction now applies one rule: only a positive limit restricts, and 0 means no restriction (as QTI 2.2 and 3.0 define it).
  
  **A blank `data-max-selections-message` falls back to the default message.** An authored message of only spaces gave choice, hottext and hotspot an empty alert at their limit (and hotspot an empty refusal announcement), and match an empty alert, while gap match and graphic gap match already fell back to the localized default. All now state the author's message when it has text — trimmed — and otherwise the default; choice, hottext and hotspot still state the default only where a further selection is refused (a limit above 1).
  
  Valid limits and authored messages behave as before. The extractor defaults the components receive (`maxChoices`, `maxAssociations`, `matchMax`, absent, 0 or set) are unchanged and now frozen by a test.
  
  `@pie-qti/default-components/shared` adds `placeSourceOnTarget` (place a source on a target in a directed-pair response: the target's previous pair is replaced, a source below its capacity is reused and one at its capacity moves), `countPairsForSource` and `hasUnorderedPair`; `removePairBySource` and `removePairByTarget` now accept readonly arrays. All additions; nothing moved or disappeared.
  
  Under the hood, move-only and pinned before and after: gap match, graphic gap match, match and the sortable list share one pick-up/place controller (what is held, what a drop would place, a refused placement keeps the item held); gap match and graphic gap match place pairs through the new move-aware helper (graphic gap match always moves a placed label, so a label dropped from one hotspot onto another leaves exactly that one pair); the five pairing interactions mark matchGroup-blocked targets through one helper on the rule response validation applies, with golden tests that the UI blocks exactly the pairs validation rejects; and the nine selection and association interactions share one capacity and limit-message helper.
- 2fd1003: Phase 4c of the player cleanup: the last shared-module slice for the default components, plus the QTI 3.0 selection messages read exactly as each interaction element defines them.
  
  **Behaviour fixes (each landed test-first):**
  
  - **QTI 3.0 selection messages.** The spec defines `data-max-selections-message` and `data-min-selections-message` on eight interaction elements (choice, gap match, graphic gap match, hotspot, hottext, match, order; min only on inline choice) and on no others. Match read `data-qti-max-selections-message` — a name no QTI version defines — so an authored max message was ignored; it now reads the spec names only. Order and inline choice ignored the messages their elements define: order now delivers `maxSelectionsMessage`, and the two-zone subset order announces it when an add is refused at the cap; inline choice delivers `minSelectionsMessage`, stated in the dropdown's description (`aria-describedby`). Associate and graphic order delivered a message their elements never defined; they no longer do, so their minimum hints are always the localized text. Hottext delivered the authored minimum message but the unmet-minimum badge ignored it; the badge now states it. A new test freezes the defines-map for all ten interactions over real QTI 3, and the component tests walk the choice-family cases end to end through the extractors.
  - **Only a positive limit restricts — the last three comparisons.** Select point refused every placement when `maxChoices` was delivered as NaN, and extended text hid its add-response button when `maxStrings` was NaN (hand-built delivery data only: the extractor refuses to deliver a malformed `maxStrings`); both now apply the one capacity rule from phase 4b. Media already read a non-numeric `maxPlays` as unlimited; that is pinned, and `canStartPlay` states the rule through the shared capacity helper.
  - **Sortable list: Escape announces the released item.** With a keyboard grab under way, Tab can move focus to another item; Escape there put the grabbed item down but announced the focused item's name. The cancellation now names the grabbed item.
  
  **Deduplication (move-only; the two deliberate accessibility alignments are noted):**
  
  - One readable-name rule: graphic order's items, graphic associate's hotspots and position object's objects keep their localized ordinal nouns ("Item 3", "Region 3", "Object 3") through one helper instead of three copies; graphic gap match's textless labels and the textless order items of the sortable list and order subset, which every textless choice previously named alike ("Label", "Item"), now take the shared "Choice {index}" by presented position — never an identifier.
  - One `.sr-only` source: every visually hidden element — the shared class and each interaction's own live-region hook, names unchanged — is hidden by one rule injected into the document and into each shadow root, replacing twelve private copies (and the `shared.css` duplicate). The host-facing `./shared.css` export no longer carries the rule for hosts that load it without running the components.
  - One announcer: the polite live-region repeat rule (a repeated message must still change the region's text) lives in one helper used by eleven components; media and extended text now mark a repeat with a trailing zero-width space instead of a trailing NBSP — nothing a screen reader reads.
  - One icon set and one props type: the check, close and info stroke icons (each previously inlined three times) render through a shared icon component with each site's own part name and classes; every plugin derives its props from one `InteractionProps` type keyed by the interaction's QTI type, so `onChange` is typed by `InteractionValueMap` where a hand-written signature was narrower (choice, order and graphic order also pass null on clear). Types only: no prop a component exposes changed.
  
  `@pie-qti/item-player`: the extractor changes above, `InlineChoiceInteractionData.minSelectionsMessage`, `OrderInteractionData.maxSelectionsMessage`, and the removal of the never-spec `minSelectionsMessage` from `AssociateInteractionData` and `GraphicOrderInteractionData`.
- edd4020: Last legacy and compatibility paths removed from the item player (cleanup addendum).
  
  **Breaking: PCI responses are read only in the PCI v1.0 Appendix A binding.** `fromQtiVariableJson`, and so every PCI `getResponse()` answer, no longer reads two non-spec forms; both now read as NULL:
  
  - a `{"base": {...}}` or `{"list": {...}}` wrapper whose key is not a QTI base-type name (it used to be read by the response declaration's base type);
  - anything that is not variable JSON: a raw runtime value such as `"A B"`, a number, an array, or an object with no `base`, `list` or `record` key (it used to pass through unchanged).
  
  A PCI module answering in such a form stores no response and scores as unanswered. PCI modules must answer in the PCI v1.0 Appendix A binding (`{"base": {"<baseType>": value}}`, `{"list": {"<baseType>": [...]}}`, `{"record": [{"name": ..., "base" | "list": ...}]}`). A valid base-type name keeps being read by that base type, also when it differs from the declaration's. `fromQtiVariableJson` takes no second argument any more, and the `QtiVariableJsonDeclaration` type is no longer exported; drop the argument.
  
  **Breaking: parsing limits apply unless the host opts out.** `security.parsingLimits` (item XML size, HTML size, element count and depth, DOCTYPE rejection) used to apply below the custom elements only when a host passed `enabled: true`. It now applies at every layer unless the host passes `enabled: false`: `Player`, `createAssessmentItemDefinition` (the root and the `/server` entry), `AssessmentItemDocument`, `sanitizeHtml`, and `sanitizeSharedHtml` / `enforceItemXmlLimits` / `normalizeParsingLimits` from `@pie-qti/item-player/security`. With no security config, an item containing `<!DOCTYPE` or over 10 MB is rejected, and HTML over 5 MB, 200 000 elements or depth 200 sanitizes to an empty string. To opt out, for trusted content or behind an equivalent upstream limit, pass `security.parsingLimits.enabled: false`; to allow more, raise the individual limit. The `<pie-qti-item-player>` and assessment custom elements already applied these defaults and behave as before.
  
  Also:
  
  - The `@pie-qti/item-player/server` entry's DOM-free `Server*` types are now checked against the engine's at compile time, so the two cannot drift apart unnoticed. The published types are unchanged.
  - Documentation corrections: why the sandbox init payload's `language` is optional (an item with no content language), what PNP `magnification` does (it is set on the player root for host stylesheets, and the default stylesheet does not render it), that QTI 3.0 defines `qti-position-object-interaction`, and the structured-label NVDA checklist (the choice group is always named by its prompt; the flag adds the match interaction's group and column labels).
- b38cb07: Conformance fixtures rewritten to spec shape for the substring and patternMatch changes (containment semantics; case sensitivity via explicit character classes). Extended text compares responses and derives its minimum-hint change key without stringifying the essay on every keystroke.
- db8e08f: Extract the duplicated hotspot rendering into a shared `HotspotShape` component: one place now owns the QTI shape/coords geometry conventions (`circle` cx,cy,r; `ellipse` cx,cy,rx,ry; `rect` left,top,right,bottom; `poly` point pairs), the accessible-button attribute set (role, tabindex, aria-label, aria-pressed), and the activation/drag event wiring for SVG hotspot regions. The hotspot and graphic-gap-match interactions render through it (each keeps its own state→color mapping); the graphic-associate interaction dedupes its four hand-copied hotspot-button blocks into a single snippet parameterized by per-shape geometry. No behavioral change intended; the full component suite passes unchanged, and hotspot coverage now also asserts the rendered shapes are real SVG elements.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [310b975]
- Updated dependencies [35bd0c3]
- Updated dependencies [30bc3bf]
- Updated dependencies [23a4077]
- Updated dependencies [bd67d58]
- Updated dependencies [0f11f98]
- Updated dependencies [4e5f1a8]
- Updated dependencies [2fa635f]
- Updated dependencies [bc7e8f6]
- Updated dependencies [b504c41]
- Updated dependencies [756771f]
- Updated dependencies [0a1c071]
- Updated dependencies [7cbed03]
- Updated dependencies [bdfc40e]
- Updated dependencies [3d51b92]
- Updated dependencies [0973689]
- Updated dependencies [f6e7714]
- Updated dependencies [eb50277]
- Updated dependencies [7c451f7]
- Updated dependencies [3a31af2]
- Updated dependencies [2f43e0e]
- Updated dependencies [8c4274b]
- Updated dependencies [ac81831]
- Updated dependencies [ee233f4]
- Updated dependencies [0cf8193]
- Updated dependencies [fc99dd9]
- Updated dependencies [9c75e43]
- Updated dependencies [72b3545]
- Updated dependencies [cfb78e2]
- Updated dependencies [99341e5]
- Updated dependencies [9cd2772]
- Updated dependencies [372037e]
- Updated dependencies [9814c9b]
- Updated dependencies [098f997]
- Updated dependencies [410fe38]
- Updated dependencies [9abdf17]
- Updated dependencies [c6ae98c]
- Updated dependencies [ad99965]
- Updated dependencies [fe86d42]
- Updated dependencies [fe86d42]
- Updated dependencies [d6ac3bb]
- Updated dependencies [fff7dd7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [d54f5f7]
- Updated dependencies [fe9e624]
- Updated dependencies [7cff6aa]
- Updated dependencies [362b7c1]
- Updated dependencies [2e4f6fb]
- Updated dependencies [816c8f8]
- Updated dependencies [3ed760e]
- Updated dependencies [9cb24ad]
- Updated dependencies [90d1c60]
- Updated dependencies [01fb4d1]
- Updated dependencies [d7d744e]
- Updated dependencies [9e07058]
- Updated dependencies [dc38e3b]
- Updated dependencies [af961a1]
- Updated dependencies [c85ea64]
- Updated dependencies [2667df1]
- Updated dependencies [74c3886]
- Updated dependencies [de1eed5]
- Updated dependencies [a1c989d]
- Updated dependencies [b34d710]
- Updated dependencies [f13613d]
- Updated dependencies [88b69c0]
- Updated dependencies [68c8b37]
- Updated dependencies [795c767]
- Updated dependencies [6d4d19d]
- Updated dependencies [6d4d19d]
- Updated dependencies [35bd0c3]
- Updated dependencies [30bc3bf]
- Updated dependencies [fe86d42]
- Updated dependencies [47e9176]
- Updated dependencies [a183a16]
- Updated dependencies [7cf746f]
- Updated dependencies [8d03d05]
- Updated dependencies [1449b94]
- Updated dependencies [562182a]
- Updated dependencies [2fd1003]
- Updated dependencies [4f9a07c]
- Updated dependencies [edd4020]
- Updated dependencies [281d6fb]
- Updated dependencies [fa577a0]
- Updated dependencies [0bdb7f1]
- Updated dependencies [7c767d4]
- Updated dependencies [b38cb07]
- Updated dependencies [3b3927e]
- Updated dependencies
- Updated dependencies [9ec0f69]
  - @pie-qti/qti-common@1.0.0-beta.5
  - @pie-qti/item-player@1.0.0-beta.5
  - @pie-qti/i18n@1.0.0-beta.5
  - @pie-qti/qti-processing@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- b91a4a3: Narrow the published surface and expose the shared global stylesheet:
  
  - The deep wildcard exports `./plugins/*/index`, `./shared/utils/*`, `./shared/actions/*`, and `./shared/extensions/*` are removed. They had no consumers in the workspace and permanently froze internal file layout; import from the `.` or `./plugins` / `./shared` entries instead.
  - The global light-DOM stylesheet that the build already emitted (shared `.sr-only` classes plus the KaTeX stylesheet/fonts used by the rich-text editor) was previously shipped in `dist/assets/` but reachable by no export. It is now published as a stable `@pie-qti/default-components/shared.css` entry (`"style"` condition) and documented in STYLING.md: import it only when hosting light-DOM shared components.
- 15ef671: Align declared dependencies with what shipped code actually imports, enforced by a new `check:dist-dependencies` gate (added to `verify:publish:quick` and `lint:all`):
  
  - `@pie-qti/player-elements` now declares `@pie-qti/default-components`, `@pie-qti/i18n`, and `@pie-qti/section-player` as real dependencies: shipped declarations import their types, so consumer typechecks no longer depend on hoisted installs.
  - `@pie-qti/transform-core` no longer installs `@pie-qti/test-utils` (and transitively `@pie-qti/storage`) at runtime; the same cleanup moves build-only `@pie-qti/transform-core` out of `@pie-qti/to-pie` / `@pie-qti/pie-to-qti2` runtime dependencies, drops unused `@tiptap/*` runtime entries from `@pie-qti/default-components` (bundled into its bundle, now devDependencies), and removes never-imported dependencies from `@pie-qti/assessment-player`, `@pie-qti/assessment-toolkit`, `@pie-qti/test-utils`, and `@pie-qti/section-player` (the two `@pie-players` packages that were only ever resolved transitively).
- a4ef12c: Move the feedback-text utilities (`cleanFeedbackText`, `processFeedbackInline`, `DEFAULT_FEEDBACK_TRANSFORMS`, `DEFAULT_FEEDBACK_OUTCOME_ID`, `FeedbackTransform`, `ProcessFeedbackInlineOptions`) to `@pie-qti/qti-common`, which already owns the feedback visibility rule they build on (`isShownByIdentifier`). The `@pie-qti/item-player/components/utils` subpath export is removed — it existed only to expose these two functions to a single internal consumer. Import the functions from `@pie-qti/item-player`'s or `@pie-qti/qti-common`'s main entry instead.
- 25ae481: Guard all custom-element registrations emitted in shipped bundles. Importing `@pie-qti/default-components/plugins` directly, or via `@pie-qti/player-elements/register`, no longer throws `InvalidStateError` when the elements are already registered — loading several of these entry points together, or loading the same one twice, is now safe. Builds additionally run a new post-build guard step, and `check:ce-define-safety` now also validates shipped `dist` bundles, not only source.
- Updated dependencies [a4ef12c]
- Updated dependencies [bc58949]
- Updated dependencies [406c76c]
- Updated dependencies [29210b4]
  - @pie-qti/item-player@1.0.0-beta.4
  - @pie-qti/qti-common@1.0.0-beta.4
  - @pie-qti/i18n@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- e69c39d: The ordering and matching controls keep their accessible names but no longer render redundant index, "Correct", match and hint labels as DOM text, so the visible text is contained in each name (WCAG 2.5.3).
- @pie-qti/item-player@1.0.0-beta.3
  - @pie-qti/i18n@1.0.0-beta.3
  - @pie-qti/qti-common@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- d8f9b4d: Accessible names, live-region announcements and visible interaction text now come from the catalog in every locale, built from whole-phrase keys, and a plain-language count uses CLDR plural rules. Escape handlers in the math editor and glossary popups ignore keys an input method editor is composing, and text-entry and extended-text inputs take `dir="auto"`. `@pie-qti/i18n` exports `translate`, `translatePlural`, `joinSentences`, `formatList` and `isImeComposing`, and `@pie-qti/default-components` now depends on `@pie-qti/i18n` directly.
- 572c3d3: Add `pseudoLocalize` with the `en-XA` and `ar-XB` pseudo-locales, and a physical-direction CSS check in `check:i18n`. Interaction and chrome markup that still used `ml-*`, `mr-*` and `right-*` utilities now uses their logical forms, so it mirrors under right-to-left locales.
- 67d94ee: Player chrome and interaction layout use logical CSS properties, so they mirror under `dir="rtl"`, and horizontal order lists move items with the arrow keys in the inline direction. `AssessmentTimer` accepts `top-end`/`top-start`/`bottom-end`/`bottom-start` and defaults to `top-end`; the physical values keep working.
- Updated dependencies [d8f9b4d]
- Updated dependencies [5dbabcc]
- Updated dependencies [d0e249b]
- Updated dependencies [e874155]
- Updated dependencies [a202037]
- Updated dependencies [572c3d3]
- Updated dependencies [67d94ee]
- Updated dependencies [dba1477]
  - @pie-qti/i18n@1.0.0-beta.2
  - @pie-qti/item-player@1.0.0-beta.2
  - @pie-qti/qti-common@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- 66f5281: Dependency updates: `jszip` 3.10.2 in `@pie-qti/ims-cp-browser`, `@tiptap/starter-kit` 3.32.0 in `@pie-qti/default-components`, and `@oclif/core` 5.1.8 in `@pie-qti/transform-cli`. No API changes; published dependency ranges move with the bumps.
- @pie-qti/i18n@1.0.0-beta.1
  - @pie-qti/item-player@1.0.0-beta.1
  - @pie-qti/qti-common@1.0.0-beta.1

## 1.0.0-beta.0

### Patch Changes

- 063229c: Reject a checkbox selection that would exceed `maxChoices` immediately, so the refused choice no longer stays visually checked while missing from the response. Adds jsdom-based component behavior tests for the choice, hottext, hotspot, extended-text and upload components.
- 6c209e2: AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
- 1521a74: Shared vocabulary classes, authored interaction aria and richer catalogs. `qti-shared-vocabulary.css` and the interactions honour the QTI 3 shared classes: choice labels and suffixes, writing orientation, `qti-choices-*` placement and `qti-unselected-hidden`. Every interaction takes its authored `aria-label`, `aria-labelledby` and `aria-describedby` through `interactionAria`, resolved to text at extraction (`BaseInteractionData.accessibility`). Catalog entries render multi-part content and media; object replacement keeps aria, role and `lang`. The section player's read-aloud takes native `qti-catalog-info` and APIP spoken cards and docks the SSML of passages.
- 7f68a35: Make QTI 3 `qti-hottext` spans selectable and styled in the hottext interaction.
- 833ddad: PCI sandboxed engine (plan Option C): Portable Custom Interaction modules can now run in a
  hardened, opt-in cross-origin frame instead of the page realm. `PciConfiguration.sandbox`
  points at a runner page served from a dedicated cookieless origin; the module executes with
  an opaque origin — no shared storage, cookies, or DOM with the player — while `getResponse()`
  stays synchronous by answering from a bridge-maintained cache. New `@pie-qti/pci-runner`
  package is the deployable runner page (`dist/pci-runner.html` + bundle), with mutual origin
  locking over the versioned `pie-qti-pci-sandbox` protocol. `PciConfiguration.moduleResolver`
  is now optional: required for page-realm execution, unused when `sandbox` is configured, with
  the new `createAllowlistPciModulePolicy` available to allow-list which module URLs may be
  handed to the frame. `PciHostController.onError` reports asynchronous engine failures (frame
  handshake, in-frame module load, instance errors). The page-realm engine and its resolver
  contract are unchanged.
- 765423c: Structured labels and braille routing (G-13): `pnp.display.structuredLabelSupport` presents choice and match answer sets as one ARIA group named by the interaction prompt, with match columns named by their visible headings. An AfA PNP `<braille/>` grant now routes to the platform `brailleText` preference (`sign-language` to `signingDefinition`), and `getCatalogEntry` under a QTI 3 usage falls back to the APIP support name (`braille-text` → `braille`, `signing-definition` → `sign-language`), so QTI 3 and APIP catalogs share one lookup path. The research note, markup contract, and NVDA checklist live in `packages/item-player/docs/PNP.md`.
- Updated dependencies [32c08b7]
- Updated dependencies [6c209e2]
- Updated dependencies [0f93a03]
- Updated dependencies [1521a74]
- Updated dependencies [a7c714e]
- Updated dependencies [5be190e]
- Updated dependencies [bac1158]
- Updated dependencies [a4353af]
- Updated dependencies [8063850]
- Updated dependencies [f20a87e]
- Updated dependencies [3c70cc3]
- Updated dependencies [30b045d]
- Updated dependencies [bbaab53]
- Updated dependencies [0ca867a]
- Updated dependencies [833ddad]
- Updated dependencies [33b1a1a]
- Updated dependencies [765423c]
- Updated dependencies [0edef83]
- Updated dependencies [953e5d1]
  - @pie-qti/qti-common@1.0.0-beta.0
  - @pie-qti/item-player@1.0.0-beta.0
  - @pie-qti/i18n@1.0.0-beta.0

## 0.1.28

### Patch Changes

- Updated dependencies [6af3354]
- Updated dependencies [8fd28e3]
  - @pie-qti/qti-common@0.1.28
  - @pie-qti/item-player@0.1.28
  - @pie-qti/i18n@0.1.28

## 0.1.27

### Patch Changes

- Updated dependencies [498b1e2]
- Updated dependencies [498b1e2]
  - @pie-qti/item-player@0.1.27
  - @pie-qti/qti-common@0.1.27
  - @pie-qti/i18n@0.1.27

## 0.1.26

### Patch Changes

- 6deb125: Require tiptap 3.31.4 across `@tiptap/core`, `@tiptap/starter-kit` and `@tiptap/extension-placeholder`, so every tiptap package resolves to the same version.
- Updated dependencies [34c0034]
- Updated dependencies [5627ce1]
  - @pie-qti/item-player@0.1.26
  - @pie-qti/qti-common@0.1.26
  - @pie-qti/i18n@0.1.26

## 0.1.25

### Patch Changes

- @pie-qti/item-player@0.1.25
  - @pie-qti/i18n@0.1.25
  - @pie-qti/qti-common@0.1.25

## 0.1.24

### Patch Changes

- Update the rich text editor and its Tiptap extensions together to 3.31.0, preserving a single compatible editor core and command registry.
- e532f4f: Provide visible move controls for ordering and select-then-place actions for matching, gap matching, and graphic gap matching, with instructions in all supported locales. Preserve keyboard and drag interaction paths.
- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.
- Updated dependencies [5c8a8e8]
- Updated dependencies [080f254]
- Updated dependencies [e532f4f]
- Updated dependencies [67e4c23]
  - @pie-qti/qti-common@0.1.24
  - @pie-qti/i18n@0.1.24
  - @pie-qti/item-player@0.1.24

## 0.1.23

### Patch Changes

- d476546: Make PCI deliverable, and rebuild a module on authoritative restore.
  
  `createAllowlistPciModuleResolver({ allowedOrigins, allowedPathPrefixes })` is a
  new export from `@pie-qti/item-player`. PCI execution previously required every
  host to write the security-critical resolver itself, so in practice no deployment
  ran a PCI at all. The secure default is unchanged — a host must still pass a
  resolver, and doing so is still a trust decision — but the origin and prefix check
  now ships reviewed. Prefixes match the normalized URL so traversal cannot escape
  them, non-http(s) schemes are refused outright, and an empty allow-list is a
  construction error rather than a silent deny-all. Note that `PciConfiguration.baseUrl`
  is where authored relative paths resolve, so it has to fall inside the allow-list
  itself.
  
  `PciHost.restore()` no longer calls `module.setResponse` on a mounted module that
  has a rebuild path. It fires the new `onRemountRequest` signal; the renderer resets
  the sanitized scaffold, calls `remount(dom)` — which discards the previous
  instance, resolves a fresh one, and seeds the restored value — and returns focus
  into the rebuilt scaffold, since replacing the scaffold destroys whatever the
  candidate had focused. Discarding in-progress candidate state is what
  re-instantiation means, and it is the only form the QTI 3.0 PCI contract offers,
  since state is injected at `getInstance` and there is no setter.
  
  Two consequences of that being asynchronous and renderer-driven. `getResponse()`
  reports the restored value for as long as a requested rebuild has not landed,
  because until it does the mounted module still holds the superseded one. And a host
  that drives `PciHost` directly, with nothing subscribed to `onRemountRequest`, gets
  the value pushed into the module instead — mutation rather than a discard, which is
  the most a caller owning no scaffold can do, and it keeps reset-to-default and
  session restore effective there. Before mount, `restore()` still just holds the
  value for `initialize()`.
  
  `PciHostController` gains `onRemountRequest` and `remount`.
- 2fd7a31: Give a mounted PCI module ownership of its own response.
  
  Every candidate change reaches `Player.setResponses`, a PCI module's own reports
  included, and that pushed straight back into the module with no dirty check — so
  each reported response was immediately handed back, rebuilding whatever internal
  state the module derived from it. The renderer's reactive `response` prop carried
  a second copy of the same loop.
  
  `PciHost.setResponse` is replaced by `offerResponse(value)`, which offers a value
  and returns `false` once the module has reported a response of its own, and
  `restore(value)`, which replaces the response authoritatively and returns
  ownership to the player. Session deserialization and reset-to-default use
  `restore()`; ordinary traffic uses `offerResponse()`. `offerResponse` is named for
  what it does — the value may be declined — and avoids colliding with Svelte's
  sense of "hydrate".
  
  `Player.setPciResponse` is likewise replaced by `offerPciResponse` and
  `restorePciResponse`, and `PciHostController` gains `offerResponse`/`restore` in
  place of `setResponse`. `Player.setResponses` keeps its single-argument signature;
  callers needing the authoritative path use the new `Player.restoreResponses`
  rather than an options flag. PCI execution still requires a host-supplied
  `moduleResolver`, so no delivery that runs today changes behavior.
- Updated dependencies [d476546]
- Updated dependencies [2fd7a31]
  - @pie-qti/item-player@0.1.23
  - @pie-qti/i18n@0.1.23
  - @pie-qti/qti-common@0.1.23

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

- ba84656: Move the build toolchain to vite 8.2.1, clearing seven advisories.

  vite 8.0.10 is covered by advisories against `>=8.0.0 <=8.0.15`, and it carried
  `postcss@8.5.12` (`<=8.5.22`), `nanoid@3.3.11` (`<3.3.18`) and `rollup@4.55.1`
  (`<4.59.0`) underneath it. `bun audit` goes from 39 advisories to 32, and from 30 high to 25.

  Four packages declared a caret range that already admitted the fix and only needed the
  lockfile moved; `default-components` pinned `8.0.10` exactly, matching its house style for
  devDependencies, so that pin is now `8.2.1`.

  The last old copy was `vitest`'s own nested `vite`. vitest 4.1.10 is current and its range
  (`^6 || ^7 || ^8`) admits 8.2.1 — the lockfile was simply holding a stale nested
  resolution that neither `bun update` nor `bun install --force` re-resolves, so that entry
  was dropped and reinstalled.

  Vite is a devDependency in all three packages, so nothing about the published output
  changes; this is recorded as a patch so the advisory fix appears in the changelog.

- Updated dependencies [3aec4b3]
- Updated dependencies [ba84656]
  - @pie-qti/i18n@0.1.22
  - @pie-qti/item-player@0.1.22
  - @pie-qti/qti-common@0.1.22

## 0.1.21

### Patch Changes

- 8836ebf: Keep integer arithmetic integer-typed in processing. Per QTI 2.2 `sum`, `subtract`, `product`,
  `max` and `min` yield an integer when every sub-expression is an integer, and a variable holds
  values of its declared base-type. Both were widened to float, and because `match` is base-type
  strict, a template variable such as `ANSWER = sum(A, B)` declared `baseType="integer"` stopped
  matching an integer `RESPONSE` — a correct answer scored 0. Assignments now conform to the
  declaration's numeric base-type; a fractional value assigned to an integer declaration is left
  alone so the authoring error still surfaces.

  Hide `positionObjectStage` from the item body. The stage owns the background object and wraps its
  interactions, all of which the component renders, so matching only the interaction inside it left
  the background image drawn a second time above the interaction.

  Stop the rich-text editor reporting editability changes as content edits. Tiptap's
  `setEditable(editable, emitUpdate = true)` emits `update` with an empty transaction, so toggling
  `editable` looked like a learner edit to the host; `onUpdate` now requires `transaction.docChanged`
  and the editability sync passes `emitUpdate: false`.

  Pin the `@pie-players/*` toolkit dependencies to one version. They share a `pie-context`
  singleton, so bumping a single member installs two copies and the section player's toolbar icons
  stop resolving. Moving the set to 0.3.65 additionally needs code changes, as it no longer exports
  `createPackagedToolRegistry`.

- Updated dependencies [8836ebf]
- Updated dependencies [2c00bd1]
  - @pie-qti/item-player@0.1.21
  - @pie-qti/i18n@0.1.21
  - @pie-qti/qti-common@0.1.21

## 0.1.20

### Patch Changes

- 1cd0aff: Introduce immutable assessment-item definitions and one authoritative live `ItemSession` across
  assessment, section, custom-element, and standalone rendering. Finalize item-body and interaction
  content at their delivery boundaries, seal definition-time extension registries, and expose typed,
  immutable presentation and session contracts.

  This intentionally changes the assessment-to-section composition API, the player-element session
  property, and item-player plugin/presentation contracts. Obsolete snapshot-driven assessment
  rendering component exports are removed. Direct `Player` and managed lifecycle compatibility
  entries are removed; consumers migrate to the definition/session interface. Server scoring uses the
  DOM-free `createAssessmentItemDefinition()` export from
  `@pie-qti/item-player/server` and dispatches item-session commands. Item-player custom elements now
  publish notifications only through typed DOM events, and standard extractor implementations and
  refactor-era interaction compatibility barrels are no longer part of the package interface.

- Updated dependencies [1cd0aff]
  - @pie-qti/item-player@0.1.20
  - @pie-qti/qti-common@0.1.20
  - @pie-qti/i18n@0.1.20

## 0.1.19

### Patch Changes

- Updated dependencies [ffe996d]
  - @pie-qti/item-player@0.1.19
  - @pie-qti/i18n@0.1.19
  - @pie-qti/qti-common@0.1.19

## 0.1.18

### Patch Changes

- Updated dependencies [2ebee31]
  - @pie-qti/item-player@0.1.18
  - @pie-qti/i18n@0.1.18
  - @pie-qti/qti-common@0.1.18

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

- 76311bb: Update the third-party runtime dependencies that ship to consumers.

  **`node-html-parser` moves from `^6.1.13`/`^7.0.x` to `^9.0.1`.** This affects
  `transform-core`, `to-pie`, `item-player`, `test-utils`, `demo-vendor-extensions`,
  `assessment-player`, `ims-cp-core`, `pie-to-qti2` and `transform-cli`.

  Worth knowing if you resolve `node-html-parser` yourself: five of those packages name it in
  their published type declarations rather than wrapping it — `transform-core`, `to-pie`,
  `item-player`, `test-utils` and `demo-vendor-extensions` all emit
  `import type { HTMLElement } from 'node-html-parser'` into their `.d.ts`, so the parser's
  own types are part of their public surface and this jump crosses three majors.

  If you exchange parsed elements with those packages, move to `9.x`. Pinning an older major
  leaves two copies of `HTMLElement` in the type graph, and structurally incompatible ones
  will not assign to each other. Consumers that only pass QTI strings in and take converted
  output back out are unaffected.

  **`katex` moves from `^0.16.27` to `^0.18.1`** in `typeset-katex`, **`mathlive` from
  `^0.108.2` to `^0.110.0`** in `item-player` and `default-components`, and
  **`@tiptap/core` from `^3.15.3` to `^3.29.2`** in `default-components`. None of these
  appear in published declarations. Applications that load their own copy of KaTeX or
  MathLive alongside ours should still check the pairing, since both ship stylesheets and
  fonts.

  All publishable packages release as one fixed-version set, so the whole set moves together.

- Updated dependencies [9b1e118]
- Updated dependencies [76311bb]
  - @pie-qti/i18n@0.1.17
  - @pie-qti/item-player@0.1.17
  - @pie-qti/qti-common@0.1.17

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

- 22db6c6: Harden QTI content, package, upload, and assessment resource boundaries; make the player custom
  elements self-contained and registration-safe for NPM consumers; and correct confirmed QTI
  mapping, processing-template, record, extended-text, position-object, PCI, navigation, timing, and
  assessment XML delivery behavior.
- f4655e6: Apply the QTI `shuffle` attribute with a session-seeded Fisher-Yates shuffle.

  `shuffle` was parsed for `choiceInteraction`, `orderInteraction`, `matchInteraction`,
  `associateInteraction`, `gapMatchInteraction` and `inlineChoiceInteraction`, but only
  `orderInteraction` acted on it — and that implementation was effectively a no-op. It
  seeded a non-iterated LCG from a sum of the `responseIdentifier`'s character codes; a
  ±1 seed change moved the generator's output by less than one bucket width, so across
  600 realistic identifiers it produced 3 distinct permutations out of 720, one of them
  83% of the time. The character-code sum also collided on anagrams (`"AB"`/`"BA"`).

  Shuffling now happens once at extraction time for all six interactions, using
  `createSeededRng` (mulberry32) seeded from an FNV-1a hash of the item session GUID and
  the `responseIdentifier`:

  - Different candidates and different attempts get different orders, so `shuffle` again
    serves its purpose of reducing position bias and answer copying. Previously every
    candidate saw the same order for a given item.
  - The order is stable for the whole session, including across re-renders and reloads,
    because `Player` already persists and restores the session GUID — no new session
    field was required.
  - `fixed="true"` choices keep their authored index and only the remaining choices are
    permuted around them. This was previously extracted but ignored.
  - `matchInteraction`'s two sets are shuffled independently.

  `OrderInteraction.svelte` no longer shuffles: doing so on top of the extraction-time
  shuffle would re-order on every re-render.

  Interaction PRDs have been corrected — several claimed "✅ Full … shuffles at
  extraction time" when no shuffling occurred, and claimed `fixed` was not extracted when
  it was.

- Updated dependencies [3c56bd9]
- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
- Updated dependencies [f4655e6]
  - @pie-qti/item-player@0.1.16
  - @pie-qti/i18n@0.1.16
  - @pie-qti/qti-common@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.15
  - @pie-qti/item-player@0.1.15
  - @pie-qti/qti-common@0.1.15

## 0.1.14

### Patch Changes

- Updated dependencies [da6892f]
- Updated dependencies [a27cc3c]
  - @pie-qti/item-player@0.1.14
  - @pie-qti/i18n@0.1.14
  - @pie-qti/qti-common@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.13
  - @pie-qti/item-player@0.1.13
  - @pie-qti/qti-common@0.1.13

## 0.1.12

### Patch Changes

- abe0be5: Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

  `loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

  `@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.

- Updated dependencies [abe0be5]
  - @pie-qti/item-player@0.1.12
  - @pie-qti/i18n@0.1.12
  - @pie-qti/qti-common@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.11
  - @pie-qti/item-player@0.1.11
  - @pie-qti/qti-common@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.10
  - @pie-qti/item-player@0.1.10
  - @pie-qti/qti-common@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.9
  - @pie-qti/item-player@0.1.9
  - @pie-qti/qti-common@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.8
  - @pie-qti/item-player@0.1.8
  - @pie-qti/qti-common@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.7
  - @pie-qti/item-player@0.1.7
  - @pie-qti/qti-common@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.6
  - @pie-qti/item-player@0.1.6
  - @pie-qti/qti-common@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.5
  - @pie-qti/item-player@0.1.5
  - @pie-qti/qti-common@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.4
  - @pie-qti/item-player@0.1.4
  - @pie-qti/qti-common@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.3
  - @pie-qti/item-player@0.1.3
  - @pie-qti/qti-common@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.2
  - @pie-qti/item-player@0.1.2
  - @pie-qti/qti-common@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/item-player@0.1.1
