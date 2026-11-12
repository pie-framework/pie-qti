# @pie-qti/item-player

## 1.0.0-beta.5

### Patch Changes

- 35bd0c3: The item session's built-in `completionStatus` now follows the QTI ASI §5.2.1 transitions table instead of jumping to its final value. **Breaking:** consumers reading `completionStatus` from the session view (`ItemSession.state()`, dispatch transitions, `ItemSessionActionResult.completionStatus`) see `unknown` from the moment the attempt has begun — the candidate's first response change (including a mounted PCI module reporting its own change and a `setResponses`/`openSession({ responses })` override), or activating a suspended handoff (`openSession({ restore, activate: true })`) — where they previously saw `not_attempted` until submission, and `completed` after a `scoreAttempt`-only flow where they previously stayed at `not_attempted`. `completed` remains the outcome of response processing completing a non-adaptive item's attempt (or an adaptive item's own rules); the engine never assigns `incomplete` itself, and `restoreResponses`/session restore keep the saved status instead of beginning an attempt. Items that already author `completionStatus` assignments in response processing keep governing their own value at those points.
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
- 4e5f1a8: Accommodations and tools in the section player.
  
  - **Display accommodations cover the whole section.** A section layout (`SectionPlayerSplitPane`, `SectionPlayerVertical` and their custom elements) applies the candidate's PNP display needs — colour scheme, inverted polarity, single-column layout, text appearance, magnification metadata — to its own root, a PNP surface, so passages, stimuli, rubric blocks, tool bars, the Passage/Question tabs, item headers and items all take them. The host page outside the layout is never repainted. Item bodies inside a surface leave their display needs to it, so one profile governs passage and question and an inverting filter applies once. A single-column need stacks the split pane behind its tabs at any width. The layouts apply their `pnp` prop, else the new `ResolvedQtiSectionComposition.pnp`, which `resolveQtiSectionComposition` now carries along with `assessmentId`.
  - **Candidates can adjust their display.** A "Display settings" button in the item tool bar opens an accessible native modal on the section surface: text size (Default, Large, Larger, Largest), higher-contrast text and extra text spacing, applied through the PNP mechanisms (`withDisplaySettings`). Settings last for the page session per assessment, also across a split-pane/vertical layout swap, and every change reaches the host as `{ sectionIdentifier, settings, pnp }` through the layouts' `onDisplaySettingsChange` and `QtiSectionRuntimeHostContract.onDisplaySettingsChange`, with the effective profile to persist. `displaySettings={false}` leaves the tool out; `initialDisplaySettings` and `displaySettingsOf()` restore persisted settings.
  - **Ruler and protractor render.** The tool bars register the packaged `ruler` and `protractor` tools, so the measurement tools the PNP and an item's companion materials grant are no longer granted but invisible. Companion materials become the item scope's required tools, and section-scoped tools render on the active item's tool bar.
  - **Tool bars bind the real assessment, with PNP enforcement on.** The hardcoded `qti-section-demo` id is gone: the toolkit takes the composition's `assessmentId` (else the section identifier) and the candidate's PNP tool supports as its profile, so granted tools are protected and prohibited ones withdrawn.
  - `@pie-qti/item-player` exports `applyPnpToSurface`, `clearPnpSurface`, `isWithinPnpSurface` and `PNP_SURFACE_ATTRIBUTE` for hosts that paint a larger surface themselves.
  - New catalog keys `sectionPlayer.displaySettings.*` in every locale.
- bc7e8f6: Security fix in the catalog entry lookup: an entry that merely ends in a filename-looking token (for example `<img src=x onerror=…>see photo.png`) took the URL branch of `catalogEntryOf` and reached the fallback catalog popup's `body.innerHTML` and the `qti-catalog-lookup` event unsanitized, because the URL sniff tested only the string's end and the default URL policy passes scheme-less values through. The new exported `isCatalogUrl` predicate routes an entry through the URL branch only when it is markup-free and matches a URL shape; everything else crosses `sanitizeHtml` like any HTML entry, and a blocked URL yields null per the sanitizer contract. The fallback popup now reuses the same predicate for its img-vs-HTML decision instead of its own divergent regex, so the `qti-catalog-lookup` event only ever carries `sanitizeHtml` output or a `sanitizeResourceUrl` result.
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
- 3d51b92: Fix `endAttemptInteraction` delivery inside assessments and honor `countAttempt` on every item:
  
  - **Assessment delivery decides the end-attempt submission.** The item player auto-submits only a session it owns (standalone). With an injected session (assessment delivery), the `AssessmentPlayer` recognizes the end-attempt response on the normal response path from the item's `endAttemptInteraction` metadata: in `individual` submission mode it submits the item through the normal per-item path (branching ignored — the candidate stays on the item); in `simultaneous` mode the response is recorded like any response and response processing stays deferred to the end of the testPart, so the final submission always succeeds. A locally closed session no longer makes a later submission throw.
  - **`countAttempt="false"` works on non-adaptive items.** Response processing runs (hint outcomes and feedback compute), but `numAttempts` is unchanged, `completionStatus` is not forced to `completed`, and the session stays open so the candidate continues. Only a counted attempt finalizes a non-adaptive item. Works for QTI 2.2 `countAttempt` and QTI 3.0 `count-attempt`.
  - **`SubmitResponsesRequest.countAttempt`** (default true) lets the client mark a hint submission; the reference backend honors it by skipping the maxAttempts rejection, not recording a result, and leaving the attempt count unchanged.
  - **Test-level outcome processing reads the built-in scope durations.** `duration` (test), `TESTPART_ID.duration` and `SECTION_ID.duration` are declared from the persisted timing clocks in QTI seconds (clocks stay in milliseconds), alongside the item-level `ITEM_ID.duration`.
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
- ac81831: Match delivery drops the never-rendered `firstColumnHeader` (QTI 3.0 `data-first-column-header`).
  
  The extractor read the attribute under a name no QTI version defines (`data-qti-first-column-header`), delivered it on `MatchInteractionData`, and nothing rendered it: this player's match interaction is not tabular, so the optional presentation attribute was dead delivery data. It is no longer extracted. A custom match component that wants the attribute can read it from the item XML the same way as any other presentation hint.
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
- 0cf8193: Implement `templateDeclaration@paramVariable` (QTI 2.2; QTI 3.0 `param-variable`): a `<param>` inside an `<object>` whose `value` names a template variable declared with `paramVariable="true"` is delivered with the variable's current value in place of the variable's name, so a plugin-style object receives its computed parameter instead of the literal variable name. The substitution resolves in the item content pass — the same pass as `printedVariable` — so the delivered parameter tracks `setTemplateVariables`, `newTemplate` and session restore without re-parsing the item. A param value naming an undeclared variable, a declaration without the flag, or a NULL/container variable delivers the authored value unchanged (the spec is silent on those; the literal is the safe reading).
- 9c75e43: Responses beyond the pattern subject cap skip `patternMask` validation instead of running authored regular expressions over huge subjects (the same divergence guard `@pie-qti/qti-processing` documents for `patternMatch`). A capped response passes unmasked; subjects at or under the cap are unchanged.
- 72b3545: Fix the PCI sandbox postMessage bridge, which could not deliver a message in either direction: the runner frame is `sandbox="allow-scripts"` (opaque origin, serialized as `"null"`), so the connector's incoming `event.origin` check against the runner tuple origin never matched and its outgoing tuple target origin never matched the frame. Incoming messages are now anchored on the frame's own `contentWindow` (the identity check, already first, stays the real anchor) and accept the runner origin or its `"null"` opaque serialization; outgoing messages post to the frame's window with target origin `'*'`, bounded by the recipient window, since no tuple target can ever match an opaque origin. The reasoning is documented in the connector JSDoc and in docs/iframe-mode.md. Note: jsdom-level tests assert the filter logic only; a manual/e2e verification of the real browser handshake against a deployed runner remains open.
- 99341e5: QTI specification fixes in the scoring engine and item player, plus QTI Results Reporting output.
  
  - **Durations are seconds, as QTI defines them.** `@pie-qti/qti-processing` reads duration values as seconds: the specified `xsd:double` form (`<baseValue baseType="duration">30</baseValue>`, previously rejected as invalid) and, as a leniency, ISO 8601 (`PT30S`). `durationLT`/`durationGTE` normalize both operands, so a malformed duration is invalid instead of silently comparing false, and `match`/`equal` compare durations by their seconds. In `@pie-qti/item-player` the built-in `duration` variable now holds seconds, so response processing compares it with seconds. **Behavior change:** the QTI variable value seen in `ScoringResult.outcomeValues.duration`, `SerializedItemSessionState.contextVariables.duration` and `ItemSessionView.context.duration` is now seconds (it was milliseconds). The host-facing `duration` fields — `SerializedItemSessionState.duration`, `ItemSessionActionResult.duration`, `ItemSessionView.duration` — stay in milliseconds, and sessions saved before this change restore correctly. New helpers: `parseDurationSeconds`, `durationSeconds`, `durationSecondsFromMilliseconds`.
  - **Unsupported response-processing templates fail explicitly.** An item whose `responseProcessing` only references a template the player does not implement now fails compilation with `UnsupportedResponseProcessingTemplateError` (exported), instead of logging a warning and scoring its outcome defaults. The predefined `no_response_processing` template is supported (the standard empty program: outcomes keep their defaults); strict QTI compliance no longer rejects QTI 3.0 items.
  - **`strictQtiCompliance` validates the item.** Compilation checks the item's QTI namespace, its element names against the XSD-verified QTI 2.2/3.0 vocabulary (unknown QTI-namespace elements and unknown `qti-` elements), interactions whose `responseIdentifier` has no `responseDeclaration`, QTI interactions without a `responseIdentifier`, and response-bound elements no registered extractor renders (previously skipped silently). Findings are listed on the new `AssessmentItemDefinition.diagnostics` and logged: warnings by default, errors in strict mode, where versions other than QTI 2.2 and 3.0 are findings too. Strict mode with `rejectUnknownExtensions` throws a `QtiComplianceError` carrying them. **Behavior change:** strict mode no longer rejects QTI 3.0 items for not being QTI 2.2.
  - **matchGroup is enforced in response validation.** `validateResponses` reports pairs that `matchGroup` forbids in associate, match, gap match, graphic gap match and graphic associate responses (`match_group` errors, which block submission), so restored or programmatic responses cannot bypass the renderers' restriction.
  - **Version detection says when it guessed.** `@pie-qti/qti-common` adds `detectQtiVersionDetailed`, which returns the version `detectQtiVersion` returns together with its basis, a confidence and warnings — for example when an unversioned `assessmentItem` is assumed to be QTI 2.2. It also exports the QTI element vocabularies (`isQtiVocabularyElement`, `QTI2_ELEMENTS`, `QTI2_XHTML_ELEMENTS`, `QTI3_ELEMENTS`).
  - **QTI Results Reporting.** `@pie-qti/assessment-player` adds `toAssessmentResultXml(results, { version: '2.2' | '3.0' })`, which writes the assessment's results as a QTI Results Reporting `assessmentResult` document (context, test result with outcomes and durations, an item result per item with its status, response and outcome variables), and `serializeAssessmentResult` for hand-built reports.
  
  Deliberate deviations from the specification (Unicode folding in string comparison, duration lexical forms, the matchGroup reading) are documented in `docs/QTI_techguide.md` §7.4.
- 9cd2772: QTI 3.0 items using these processing operators with nested expressions now compile: `integerModulus` (both operands), `integerToFloat`, `roundTo` (value), `substring` (optional length) and `record` (fieldValue member value) handed their build options — which carry the QTI 3 kebab-case name mapping — to nested expression builds, so a `qti-variable` or `qti-base-value` nested inside them no longer fails with "Unknown processing expression tag". `record` now also recognizes its `qti-field-value` members spelled for QTI 3, so constructed records keep their fields instead of silently compiling empty. The item-player validation golden was regenerated for the three conformance fixtures this unblocks.
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
- 410fe38: Spec-compliance fixes for template rules and container mapping (QTI ASI §5.1, §10.3, §15.3).
  
  **Scoring changes, stated plainly:**
  
  - `mapResponse` and `mapOutcome` no longer count duplicate container values twice. Per §15.3, each distinct value counts once: a multiple-cardinality response `{B,B,C}` maps to 1.5, not 2.5. Pair values dedupe on their order-normalized key; directedPair keeps direction significant. Items whose authors relied on duplicates adding extra credit will now score lower.
  - `setDefaultValue` is now the template rule the spec defines: it evaluates its contained expression, changes the variable's default value, and later resets (attempt starts, outcome resets at response-processing start, `templateConstraint` restarts) use the new default. It is only compiled inside `templateProcessing`; occurrences inside `responseProcessing` are ignored, matching the §10.3 rule vocabulary.
  - Restored item sessions keep their template-rule effects: the snapshot now records each response variable's `correctResponse` (including one computed by `setCorrectResponse`) and the declaration's `defaultValue`, so a resumed or re-scored session scores identically to the session that was saved.
  
  **Snapshot format:** `SerializedItemSessionVariable` gains an optional `correctResponse` field on response variables. Snapshots saved by older builds (without the field) still restore unchanged.
  
  Hosts that re-score browser-provided snapshots with `@pie-qti/item-player` should add `correctResponse` and `defaultValue` to the declaration checks they already run on untrusted save data.
- 9abdf17: Spec-compliance fixes for adaptive items, test-level weights, template constraints, validated end of attempt and PCI response JSON (QTI ASI §4, §5.2, §10.3, §15.1; PCI v1.0 Appendix A as adopted by QTI 3.0).
  
  **Scoring changes, stated plainly:**
  
  - Adaptive items keep their outcome values across attempts (§5.2). Response processing no longer resets an adaptive item's outcomes before each run, so rules that build on earlier attempts work: an item that counts tries and gives partial credit for a later correct attempt now scores the partial credit, where it previously scored full credit as if every attempt were the first. Non-adaptive items still reset outcomes before every run. Every response-processing run of an adaptive item builds on the current values, `scoreAttempt` included, so re-scoring a restored adaptive session applies its rules again; report such a session's score from its restored outcome values.
  - `<variable weightIdentifier>` in test-level outcome processing is now applied (§15.1): an item variable read as `ITEMREF.VARIABLE` is multiplied by that item reference's named weight (1.0 when the reference defines none). Weights apply to integer and float values only, and a weighted value is float. Weighted test scores previously came out unweighted.
  - A `templateConstraint` restart discards everything the rejected pass did (§10.3): a correct response set by `setCorrectResponse`, or a default changed by `setDefaultValue`, no longer carries into the accepted pass and into scoring.
  - `dispatch({ action: 'endAttempt', validateResponses: true })` now also rejects responses that miss their interaction's constraints (§4): fewer selections, associations, strings or plays than `minChoices`, `minAssociations`, `matchMin`, `minStrings` or `minPlays` require. The result reads `validation.valid === false` with an `incomplete` issue per response, the attempt is not counted, and the session stays writable. An item with no response at all is a skip, which `allowSkipping` governs at the caller, and is not rejected.
  
  **PCI contract change (PCI hosts and authors):** responses cross the PCI boundary in the PCI v1.0 Appendix A JSON binding. Seeded `getInstance` state, and the exported `toQtiVariableJson`, now write pair, directedPair and point values as two-element arrays (`{"base":{"pair":["A","B"]}}`), durations as ISO 8601 strings (`"PT90S"`), files as `{data, mime, name}`, and records as an array of `{name, base|list}` members. Previously a conformant PCI's pair response was stored as `"A,B"` and scored 0, and a spec-shaped record came back keyed by array index. `fromQtiVariableJson` returns a record in its typed form (each field `{ baseType, cardinality, value }`), takes an optional declaration for base-type names it does not know, and still accepts the earlier name-keyed record form. A PCI written against the previous shapes (pairs and points as `"A B"` strings, name-keyed records, numeric durations) must move to the spec binding. Record responses also keep list-valued fields as containers when a PCI reports them or a session restores them.
- ad99965: Accessibility fixes from the round-4 WCAG 2.2 AA review:
  
  - **Interactions state their minimum requirement** (WCAG 3.3.2, 3.3.3). Choice, match, associate, order, gap match, hotspot and graphic order interactions show a visible hint while the response is below its authored minimum (`minChoices`, `minAssociations`, a choice's `matchMin` in match, associate and gap match), the same minimums response validation enforces before an answer counts as complete. The author's `data-min-selections-message` wins over the localized default ("Select at least 2 answers.", "Needs more associations: Red.", "Still to place in the blanks: blue and green."). The hint describes the answer group (`aria-describedby`), draws in `--pie-qti-warning-text`, and is announced politely once when a change leaves the minimum unmet, not on every change. It shows only while the candidate can answer: not when the interaction is disabled or rendered for another role.
  - `@pie-qti/item-player` delivers `minSelectionsMessage` for order and associate interactions, also reads the QTI 3.0 `data-min-selections-message` on match interactions, and extracts graphic order `minChoices` (with its message), which response validation now enforces. `GapMatchInteractionData` choices carry `matchMin`.
  - New `interactions.*` catalog keys in every locale: `choice.minChoicesHint`, `match.minAssociationsHint`, `match.minChoiceUsesHint`, `associate.minAssociationsHint`, `associate.minChoiceUsesHint`, `order.minChoicesHint`, `graphicOrder.minChoicesHint`, `hotspot.minChoicesHint` and `gapMatch.minPlacementsHint`.
  - **PNP inverted polarity no longer inverts a forced-colours palette**: under `@media (forced-colors: active)` the inversion filter is off, so Windows high contrast keeps the colours the candidate chose.
  - **A proctor pause keeps a typed math expression**: the math dialog reports a host close as an interrupted cancel with the LaTeX typed so far, and the rich-text editor offers it again in its next insert dialog. The draft is session-only and per response field; inserting the math or the candidate's own cancel discards it.
  - **Nested languages in section content**: an `xml:lang` inside test feedback, instructions or rubrics now renders as HTML `lang` (with `dir` where the direction changes), as in passages (WCAG 3.1.2).
- fff7dd7: Spec-compliance fixes for attempt counting, new template instances, numeric `base` input and mapping a NULL container (QTI ASI §5.1, §10.3, stringInteraction `base`, mapping bounds).
  
  **Timing change, stated plainly (hosts that read `numAttempts` during processing):**
  
  - `numAttempts` on a non-adaptive item is now incremented at the start of a counted attempt, before response processing, as it already was for adaptive items (§5.1). Response processing and item outcome processing now read the attempt's own number: 1 on the first attempt, 2 on the second. Before, they read the count before the attempt (0 on the first attempt) and the increment came afterwards, so a rule such as "half credit when `numAttempts > 1`" never applied. The count after the attempt is unchanged: the action result, the session view and `serialize()` (both the top-level `numAttempts` and `contextVariables.numAttempts`) report 1 after the first counted attempt. Code that reads `numAttempts` while response processing runs, such as a custom operator, now sees the incremented value. `scoreAttempt` and an uncounted attempt (`countAttempt: false`) never increment. `submitAttempt` with `countAttempt: false` on a non-adaptive item no longer counts or finalizes the attempt, matching `endAttempt`. A restored session reads the count from `contextVariables.numAttempts`; a host that reopens an item for its next attempt must restore a state that carries the attempts already counted.
  
  **Scoring changes, stated plainly:**
  
  - `newTemplate` starts the new instance from the declared defaults and correct responses (§10.3 with §5.1). A correct response set by `setCorrectResponse`, or a default set by `setDefaultValue`, in the previous instance no longer carries into a draw whose template processing skips that rule; before, such a draw scored the declared key as wrong. `assessmentItemRef` `templateDefault` values still apply to every instance.
  - An `extendedTextInteraction` with a non-decimal `base` no longer changes its numeric response when the value reaches the session again. The base now applies only to text the candidate enters; a value that already is a number (the delivered extended-text component's response, which it converts from the typed text itself, a restored session, the declared correct response or default, a value read back from the session) passes through unchanged. Before, a base-16 answer `FF` (255) arriving as a number was read again as base-16 `255` (597) on entry and on every restore, and a base-2 answer restored as NULL; restored correct responses and defaults changed the same way.
  - `textEntryInteraction` now honours its `base` attribute for an integer or float response: `101` typed into a base-2 entry is 5. Before, it was read as decimal 101. The extracted interaction data carries `base` when it is not 10.
  - `mapResponse` and `mapOutcome` map a NULL multiple or ordered variable as the empty container: 0, clamped to the mapping's `lowerBound` and `upperBound`. Before, a NULL container returned the mapping's `defaultValue` unclamped, so an unanswered canonical multi-select with `defaultValue="-2" lowerBound="0"` scored -2 instead of 0 in rules that call `mapResponse` without an `isNull` guard. A NULL single value still takes `defaultValue`, now within the bounds like any unmapped value. `mapResponsePoint` treats a NULL point the same way. The standard `map_response` templates, which guard NULL with `isNull`, are unaffected.
- d54f5f7: The render-failed interaction placeholder (`qti-interaction-error`) strokes its border with the error *text* token (`--pie-qti-error-text`, ≈ 5.9:1 on white) instead of the error *fill* token (`--pie-qti-error`, ≈ 2.9:1 on white, below the 3:1 non-text contrast minimum of WCAG 1.4.11). The border is the only visual mark of where an interactive element is missing inside a live exam question, and the repo's own convention (documented on `ShadowBaseStyles`'s correctness indicators) reserves `*-text` tokens for non-text indicator strokes with fills as tinted backgrounds — the 8% error fill tint on the placeholder is unchanged. The mirrored player/baseline alert borders that share this weakness are untouched here and remain a follow-up.
- d54f5f7: The item body's presentation cache no longer hard-skips the built-in `duration` context variable. Round 4 exempted it on the claim that it "renders nowhere", but `duration` is printable: an item whose body or rubric contains `<printedVariable identifier="duration"/>` (legal against any declared variable, and against the QTI built-ins) substituted the elapsed time on every rebuild, while the cache hit on every dispatch after the first — the candidate saw a permanently frozen elapsed time with no diagnostic. The context side of the cache now keys on the same printed-set principle the response side already used: the Player's printed-content scan reports printed *context* identifiers alongside the printed response ones (`Player.getContextIdentifiersPrintedInContent()`, threaded through the internal session binding), and the cache compares exactly the context values the markup prints. An item that prints `duration` re-presents as the elapsed time moves; an item that prints no context variable still never rebuilds on typing. The built-in context classification (`duration`/`numAttempts`/`completionStatus` + declared context variables) is single-sourced with the serializer (`BUILT_IN_CONTEXT_IDENTIFIERS`/`isContextSerialized` in `core/serialization/sessionState`), so the scan and `ItemSessionView.context` cannot drift. No public contract change: the scan method and binding member are internal, as for the response set.
- d54f5f7: An interaction whose component the registry cannot resolve (no component renders the type) no longer vanishes from the item body. It previously dropped out of the presentation plan with only a host-side coded `render-failed` report, leaving the candidate a silent gap where a question's interaction should be — while mount/update failures already rendered a visible `role="alert"` placeholder. Registry failures now route through the same placeholder and the same coded error path: `createItemPresentation` records each unresolved interaction in the new `ItemPresentation.failedInteractions` (key, authored slot, interaction data — mounts keep the same keying, so a host reconciling keys sees consistent identities), and the item body stands the shared `qti-interaction-error` alert in the interaction's authored slot, named per interaction type, for as long as the failure stands. The body around it keeps rendering. Additive type surface (`FailedInteractionMount`, the `failedInteractions` member on `ItemPresentation`); the candidate-visible change is the completion of the round-3 render-failed placeholder contract, not a new divergence.
- fe9e624: Spec-compliance fixes for the container operators, NULL operands, `round`/`truncate` and graphicGapMatch response validation (QTI ASI §5 and §15.3, graphicGapMatchInteraction).
  
  **Scoring changes, stated plainly (items whose response processing uses these operators can score differently):**
  
  - `contains(container1, container2)` now tests whether the first container contains the second: for multiple containers every value of the second, counted, must be in the first (`[A,B,C]` contains `[C,A]` but not `[B,B]`); for ordered containers the second must be a contiguous sub-sequence of the first (`[A,B,C]` contains `[B,C]` but not `[C,A]` or `[A,C]`). Before, the second operand was read as one value to look for, so `contains(RESPONSE, multiple(A, B))` was always false. A single value as the second operand still asks whether that value is in the container. Two containers of different cardinality are now invalid.
  - `delete` now reads its operands in QTI order: the value to remove first, the container second (`delete(A, {B,A,C,A})` is `{B,C}`). Before, the engine read the first child as the container, so content written in QTI order got NULL; content written in the old engine order (`<delete><variable/><baseValue/></delete>`) must swap its two children. Removing every value now gives NULL (the empty container), and values compare as `member` compares them (a `pair` ignores the order of its two identifiers).
  - NULL operands now propagate: `match`, `member`, `contains`, `stringMatch`, `patternMatch`, `lt`, `lte`, `gt`, `gte` and `not` result in NULL when an operand is NULL. Before, they returned false and `not(NULL)` returned true. `and` is false when any operand is false and otherwise NULL when any is NULL; `or` is true when any operand is true and otherwise NULL when any is NULL. A NULL condition is not true, so `responseIf(not(match(RESPONSE, correct)))` no longer takes its branch for an unanswered item: response processing continues with the `responseElseIf`/`responseElse` branches. An empty container or empty string is NULL, as QTI defines, in these operators and in `isNull`/`isNotNull`, `equal`, `equalRounded`, `durationLT`/`durationGTE` and `inside`; before, `isNull` was false for a cleared multiple response. `lt`/`lte`/`gt`/`gte` with a non-numeric operand, and `and`/`or`/`not` with an invalid operand, are now invalid instead of false or true.
  - `round` and `truncate` now result in an integer, as QTI defines (before: float). `match(round(x), <integer>)` is now true when the values agree and `match(round(x), <float>)` is now false; a `sum` or `product` of their results and integers is an integer. A float outcome still receives the value as a float. `roundTo` is unchanged.
  - `multiple` and `ordered` now ignore NULL sub-expressions and are NULL when every sub-expression is NULL. Before, each NULL sub-expression added a null value, which `containerSize` counted, which made `match` fail on length, and which made `statsOperator` NULL.
  
  **Validation change:**
  
  - Response validation now enforces a graphicGapMatchInteraction's `maxAssociations` and the `matchMax` of each gap choice (`gapText`, `gapImg`) and each hotspot (0 means no restriction). A response over a limit is invalid with an `invalid_shape` issue, as an extended-text response over `maxStrings` is: `dispatch({ action: 'endAttempt', validateResponses: true })` rejects it and the session cannot submit it until it is corrected.
- 7cff6aa: Internal consolidation, pinned behavior-identical by the extractors' existing tests. The duplicate-identifier validation loop that was inlined thirteen times across the eleven interaction extractors is now one shared `validateUniqueIdentifiers` (`src/extraction/utils.ts`), parameterized by the set's two message nouns ("source choices" / "source"); each extractor pushes the same errors with the same wording as before. The three private serialized-HTML attribute readers — stimulus docking (`stimulusRender`), gap-match prompt rewriting, and the feedback announcement — are now one shared `readHtmlAttribute` (`src/utils/htmlAttributes.ts`) with the most correct of the three shapes: quotes must pair, an empty value is present-and-empty rather than absent, a camelCase name also tries its kebab spelling (`outcomeIdentifier` or `outcome-identifier`), and values are returned untrimmed. Markup the loose stimulus reader mis-parsed (an unpaired quote such as `identifier="x'`, or `data-identifier` reading as `identifier`) now reads as absent — the strict reading was already the other two readers' contract — so stimulus docking of malformed tags could differ.
- 362b7c1: Round-6 interaction feedback fixes (WCAG 2.2 AA). Order and graphic-order confirmations keep their control mounted as an inert "Order confirmed" state (aria-disabled, focus retained) and announce the confirmation from an always-present polite region — the control used to be removed, dropping focus to the page. Graphic associate announces associations made, removed and refused, no longer sets `disabled` on the focused hotspot (aria-disabled plus a handler guard), and refocuses a surviving control after a pair removal. Remove/clear controls in match, gap match, graphic gap match, position object, hottext and file upload move focus to the related surviving control (now-enabled word/label/source, canvas, first hottext, native file input), and gap-match and file-upload announce the removal. Unmet minimums are now stated on the question: extended text states `minStrings` and refuses removing responses below it, graphic gap match states per-label `matchMin` honouring the authored `data-min-selections-message`, and graphic associate states `minAssociations` and per-hotspot `matchMin`. Rich text editors can re-edit inserted math from the keyboard (Enter/F2 beside the expression) and via an "Edit math" toolbar button, instead of pointer-only clicking. File upload translates every string with an English fallback (raw catalog keys could reach candidates) and resets the native input through a bound reference, so re-choosing the same file works even inside a shadow root. The PCI sandbox init payload gains optional `language`, `direction` and `frameTitle` fields, which the runner frame applies to its document (language, direction, title) before instantiating the interaction. All new strings ship in all 8 locales.
- 2e4f6fb: Associate and graphic gap-match interactions now enforce the QTI association maxima in the component instead of letting an over-limit response reach a submit that response validation rejects (WCAG 3.3.1/3.3.2):
  
  - **associateInteraction**: a pairing that would pass the interaction's `maxAssociations` or either choice's `matchMax` is refused with a polite live-region announcement ("Association not possible: the limit of {max} is reached." / "Not possible: {label} cannot be in more associations."). Maxed choices carry `aria-disabled` and stay focusable (never `disabled`, so focus cannot fall off the activated control), deselecting the pending choice stays possible at a cap, and the helper text names the interaction cap up front ("You can make up to {count} associations."). Both caps are re-checked when a pair is completed, so a selection arriving through the `selectedForPairing` prop obeys the same rules.
  - **graphicGapMatchInteraction**: a placement (pointer drop or keyboard) whose response would exceed `maxAssociations` is refused and announced; the author's `data-max-selections-message` wins over the localized message, and a keyboard-held label stays held on refusal. Replacing a placed label within the cap is still allowed.
  - **i18n**: new keys in `interactions.associate` (`maxAssociationsHint`, `choiceLimitReached`, `associationLimitReached`) and `interactions.graphicGapMatch` (`associationLimitReached`) across all 8 locales.
  - **Extractor default**: the associate extractor now applies the spec default `maxAssociations = 1` for an absent attribute (QTI 2.1 XSD `default="1"`, QTI 2.2 Table 5.6.2, QTI 3.0 Table 5.8.2). The graphic-gap-match extractor deliberately keeps `0` (= unlimited) for absent attributes — documented divergence from the 2.2/3.0 default of 1 (2.2 Table 5.41.2, 3.0 Table 5.60.2) so items authored without the attribute keep their delivered behaviour; author the attribute explicitly for strict conformance.
- 816c8f8: Spec-compliance fixes for operator NULL semantics and the container-taking numeric operators (QTI ASI §5, §10.2 and §15.3, carried to QTI 2.2 and 3.0).
  
  **Scoring changes, stated plainly (items whose response processing uses these operators can score differently):**
  
  - `anyN` is now three-valued: it is false when more than `max` operands are true or more than n − `min` are false, true when at least `min` are true, and otherwise NULL when the NULL operands leave the result undetermined. With `min` 3 and `max` 4, `{true,true,false,NULL}` is NULL, `{true,false,false,NULL}` is false and `{true,true,true,NULL}` is true. Before, NULL operands counted as false. A NULL `anyN` is not true, so the enclosing condition falls through like any other NULL condition. `anyN`'s `min` and `max` are `integerOrVariableRef`, so they may now name a template variable (`min="THEMIN"` or `min="{THEMIN}"`); before, a variable reference silently fell back to the defaults.
  - `max`, `min`, `gcd` and `lcm` now accept single, multiple and ordered operands and range over every value of a container: `max({1,5,3})` is 5 and `gcd({12,18})` is 6. Before, a container operand made the result NULL. An operand that is not a numerical value — including an empty container, which QTI reads as NULL — now gives NULL, as the spec defines, instead of an error.
  - `divide` by 0, `integerDivide` and `integerModulus` by 0, and a `divide` or `power` result outside the float range now result in NULL, as the spec requires, instead of an error. `integerDivide` now rounds x/y down to the greatest integer not above it (-7/2 is -4), matching `integerModulus`'s x − z·y, instead of truncating towards zero (-3).
  - An empty string is NULL in every numeric operator (`sum`, `product`, `subtract`, `divide`, `power`, `mod`, `integerDivide`, `integerModulus`, `max`, `min`, `gcd`, `lcm`, `mathOperator`, `roundTo`), as QTI reads empty strings as NULL (ASI §5). Before, it coerced to 0, so `subtract("", 3)` was -3 and `sum("")` was 0.
  - `substring` now results in NULL for a NULL string, start or length — the empty string included — instead of an error. A start past the end still gives the empty string.
  - Each `mapEntry` is now matched as case sensitively as its own `caseSensitive` attribute says: a case-sensitive entry matches only its own spelling, so a response in another case takes the mapping default. Before, the lookup also tried the response lower-cased, so a response "A" could match a case-sensitive entry "a".
  
  **Template scoring change:**
  
  - The built-in `map_response` (and `map_response_point`, `CC2_map_response`) templates now score a cleared response 0: their NULL test reads an empty container as NULL too, matching the official template programs, so a cleared multi-select no longer maps to a value that `lowerBound` can clamp above 0. Before, a cleared multi-select with `lowerBound="1"` scored 1; now it scores 0, as the official template's `isNull` branch gives. A non-empty response is still mapped within the bounds.
  
  **API:**
  
  - `@pie-qti/qti-processing` exports `isNullValue(value)`, the QTI NULL test the operators use: true for NULL, an empty container and an empty string.
- 9cb24ad: Spec-compliance fixes for mapping string matching and the integer division operators (QTI 2.2 XSD, ASI §15.3 and §17).
  
  **Scoring change, stated plainly (items that map string responses can score differently):** a mapping that authors no `caseSensitive` now matches case-insensitively, as the spec default (`mapEntry@caseSensitive` is optional with `default="false"` in the QTI 2.2 XSD; the QTI 3.0 implementation guide has mapping "by default, NOT case sensitive"). Before, the default matching was case-sensitive, so a typed "Photosynthesis" missed a `photosynthesis` entry and took the mapping default; now it matches and scores the entry's mapped value. Items relying on the old case-sensitive default matching must author `caseSensitive="true"` on the entry (or the mapping element, which the player reads as leniency) to keep matching exactly. Mapping a container also counts once the values a case-insensitive entry matches together: `{Paris, paris}` maps Paris once, not twice. Identifier and the other non-string base types always match exactly, whatever `caseSensitive` says (ASI §17).
  
  **Operator fixes:**
  
  - `integerDivide` and `integerModulus` now divide their operands as they are, without truncating them to integers first. `integerDivide(6.9, 1.9)` is 3 (the spec's floor of 6.9/1.9; before, 6), `integerDivide(-6.9, 1.9)` is -4 (before, -6), and `integerDivide(5.5, 0.9)` is 6 (before, NULL — only an actual zero divisor is NULL). The identity x = `integerDivide(x,y)`·y + `integerModulus(x,y)` now holds for float operands too. Integer operands are unchanged: -7 `integerDivide` 2 is still -4 and its `integerModulus` is still 1.
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
- d7d744e: - **textEntryInteraction@stringIdentifier is implemented** (QTI 2.1/2.2 ASI §5.122.3; `string-identifier` in QTI 3.0). A text entry bound to a numeric response can also capture the text as entered in a companion string response: typing "3.50" sets the float response to 3.5 and the named string response to "3.50" (with `base="2"`, "101" where the integer response is 5); an empty field gives NULL. Response processing can score that text with `stringMatch`, and a restored session shows it in the field instead of the coerced number. Completion and validation still read the main response only, and a `stringIdentifier` that repeats `responseIdentifier` or names no declared response is ignored, as extendedTextInteraction already does.
  - **`<inside shape="default">` compiles.** The `default` shape is the entire area of the image and takes no coordinates, so `coords=""` or absent no longer throws "<inside> requires coords attribute"; every point evaluates inside it. Every other shape still requires its coords.
  - **Text-entry blanks no longer force horizontal scrolling** (WCAG 2.2 SC 1.4.10 Reflow): the input gains `max-width: 100%`, so an authored `expectedLength` wider than the viewport keeps the blank inside its container at 400% zoom. Its width is otherwise unchanged.
- 9e07058: The item body's failures now reach the coded error channel. Interaction mount/update failures and component-registry failures report `render-failed` — the code finally means what it says, after real render failures previously got nothing but a console line — while the rest of the item keeps rendering, and a failed mount stands in as a visible `role="alert"` placeholder naming the interaction type, styled like the player's load-failure alert. A rejected response write reports the new additive `response-dispatch-failed` code on `ItemPlayerErrorCode` instead of mislabelling itself `render-failed`; it keeps the generic "Failed to process responses" message as before.
  
  Breaking: the exported `ItemBody` component's `onError` prop now receives an `ItemBodyError` (`{ code: 'render-failed' | 'response-dispatch-failed', cause: unknown }`) instead of the bare thrown value.
- c85ea64: Restored item sessions now keep the NULL defaults and NULL correct responses that template processing set (QTI 2.1 ASI §8 / QTI 3.0 ASI §10, Template Processing: `setDefaultValue` and `setCorrectResponse`; QTI ASI §10.3 fixes their effects for the session). Restore previously fell back to the values parsed from the item XML whenever the snapshot carried NULL — a NULL `defaultValue` (or NULL `correctResponse`) restored as the XML-declared value, so a resumed session could score differently from the one that was saved. The snapshot is now authoritative: `defaultValue` is always applied as serialized (null restores a NULL default), and `correctResponse` is written on every response variable that has or had a correct response — null meaning the correct response is NULL, the field absent meaning the variable has none — and applied as-is on restore.
  
  Serialized-format change: response variables with an XML-declared correct response that template processing set to NULL now serialize `"correctResponse": null` where they previously omitted or kept the XML value. Snapshots written by earlier versions restore unchanged; pre-1.0, no migration.
- 74c3886: **Behavior change: interaction attributes that an item leaves out now take the QTI default for the item's QTI version.** The player detects the version of each item (2.1, 2.2 or 3.0) and applies the default that version's schema and information model define. An attribute you author is always honoured as written, and `0` on a `max…` limit still means no limit.
  
  - **Graphic gap match:** QTI 2.2 and 3.0 items that omit `maxAssociations` (`max-associations`) now allow one association, the spec default. Before, they allowed any number. To let candidates fill several hotspots, state `maxAssociations` explicitly, for example `maxAssociations="3"`, or `"0"` for no limit. QTI 2.1 items have no such attribute, so they still have no overall limit.
  - **Gap match:** `maxAssociations` is now supported. The player used to ignore it. QTI 2.2 and 3.0 items that omit it now allow one association, the spec default, so a cloze meant to fill several gaps must state `maxAssociations`, for example the number of gaps. QTI 2.1 items have no such attribute and keep no overall limit. A placement past the limit, by keyboard or pointer, is refused and announced: the author's `data-max-selections-message` if there is one, otherwise the new localized message `interactions.gapMatch.associationLimitReached`. A held word stays held, so the candidate can place it elsewhere or cancel. Response validation rejects a restored or programmatic response with more associations than the limit.
  - **Choice:** QTI 2.1 items that omit `maxChoices` now allow any number of selections, as QTI 2.1 defines (`maxChoices = 0`). Before, they allowed one. A 2.1 item bound to a single-cardinality response still allows one. QTI 2.2 and 3.0 are unchanged, with a default of 1.
  - **Select point:** QTI 2.2 and 3.0 items that omit `maxChoices` now allow any number of points, the spec default (`0`), when the response has multiple cardinality. Before, they allowed one point. Items bound to a single-cardinality response still take one point. QTI 2.1 items are unchanged.
  
  For hosts and plugin authors: extraction now receives the item's QTI version as `ExtractionConfig.qtiVersion`, and `GapMatchInteractionData` gains an optional `maxAssociations`. The full table of audited defaults is in `docs/QTI_attribute_defaults.md`.
- de1eed5: `patternMatch` and the `patternMask` input check now read patterns as XML Schema regular expressions, as QTI specifies, instead of as JavaScript ones. These patterns now behave as the XSD standard defines them:
  
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
  
  Response validation now enforces `patternMask` on text entry and extended text responses, as QTI specifies: a response must match the pattern to be valid. A `string` response with any text that does not match is reported invalid, both by `canSubmit` and by the assessment player's `validateResponses` check. Numeric responses store the number rather than the typed text, so for them only the text entry field's own check applies.
  
  An `inlineChoiceInteraction` marked `required="true"` now needs a selection before its response counts as complete, as QTI specifies. The same applies to a QTI 3.0 dropdown with `min-choices` of 1 or more. The interaction data carries the requirement as `minChoices`. An unanswered dropdown that is not required stays valid, and its empty first option can still be selected.
  
  A `gapMatchInteraction` with `minAssociations` (QTI 2.2 and 3.0) now needs at least that many pairs before its response counts as complete. The interaction data carries the value as `minAssociations`.
- a1c989d: String answers now compare as QTI defines them. `match`, `member`, `contains`, `delete`, `stringMatch` and `mapResponse` entry lookup compare `string` values for equality: `match` is true "if the two expressions represent the same value" (QTI 3.0 §6.9.21). Case folds only where the item asks for it, through `stringMatch` with `caseSensitive="false"` or a `mapEntry` whose `caseSensitive` is false (its default). Both values are composed to Unicode NFC first. QTI is silent on normalization, and canonically equivalent text must not be treated as distinct (Unicode conformance clause C6), so `é` typed with a combining accent still matches `é`.
  
  The new delivery option `stringComparison` lets a host opt in to more folding. You can set it on `createAssessmentItemDefinition` (client and server entry points), on the `ItemPlayer` component and the `<pie-qti-item-player>` element, on `AssessmentPlayer.create` (or the `config` of the assessment shell and of `<pie-qti-assessment-player>`), on `ReferenceBackendAdapter` and on `scoreAssessmentItem`:
  
  - `foldScriptInput: true` removes bidi controls (ALM, LRM, RLM, embeddings, overrides, isolates) and tatweel. It folds Arabic presentation forms to their base letters, every script's decimal digits to 0–9, and the Arabic decimal and thousands separators to the content language's marks.
  - `foldLetterVariants: true` folds Arabic spelling variants: hamza and madda alef forms become bare alef, tashkeel is removed, ة becomes ه and ى becomes ي.
  
  Give the player and the scoring backend the same value. Numbers typed into `integer` and `float` responses read digits in any script and the Arabic separators either way. `patternMatch` and `patternMask` always test the text as entered.
  
  Breaking: before this change, string comparisons always folded script input. A string answer that matched only because of that fold now scores as non-matching. Examples are an answer typed with tatweel, a bidi mark or Arabic presentation forms, or a string answer typed with Arabic-Indic digits. To restore the earlier scoring, set `stringComparison: { foldScriptInput: true }` on the player and on the scorer. For example, use `createAssessmentItemDefinition({ itemXml, stringComparison: { foldScriptInput: true } })` and `new ReferenceBackendAdapter({ stringComparison: { foldScriptInput: true } })`.
  
  Breaking: `normalizeResponse` from `@pie-qti/qti-processing` now folds script input only when called with `foldScriptInput: true`. Without it, the function returns the text composed to NFC, and case-folded when `ignoreCase` is set. `foldLetterVariants` is now independent of `foldScriptInput`. It was documented as "an authoring choice per response", but no authored attribute or element ever set it. It is now the host option `stringComparison.foldLetterVariants`.
  
  When `mapResponse` maps a container, a string value that no `mapEntry` matches now keeps its case: `{London, LONDON}` counts as two values, each with the mapping's `defaultValue`. Values that a case-insensitive entry matches still count once.
  
  A `graphicGapMatchInteraction` with `minAssociations` (QTI 2.2; `min-associations` in QTI 3.0) now needs at least that many associations before its response counts as complete. Response validation (`canSubmit`, and `endAttempt` with `validateResponses`) reports a response with fewer associations as incomplete. The interaction data carries the value as `minAssociations`. An absent attribute or `0` sets no minimum.
- b34d710: String answers that look like JSON are no longer rewritten. The interactions JSON-parsed every string `response` and `correctResponse` the host set, so an extended text field rewrote a typed `1.50` to `1.5` and `1e5` to `100000` while the candidate typed, dropped the quotes of `"quoted"`, turned `[1]` into `1`, and lost the answer `null`; a choice, hottext or hotspot region identified `true`, `false` or `null` lost its selection, and a portable custom interaction got its JSON-text response back as an object. Responses are now values: a string response is kept exactly as given, and only `null` means no response. The identifier-list interactions (order, match, associate, gap match, the graphic interactions, a multiple-selection hotspot) still read the JSON array an HTML attribute carries as that list. The interaction data and the PNP profile still accept their JSON text, as an HTML attribute carries it. Upload and drawing no longer type their `response` prop as `| string`.
  
  Extended text interaction data whose `base` is absent or not an integer from 2 through 36 is now read in base 10: showing a numeric response no longer throws (it crashed the field, and the text entry's string companion), and a typed number is no longer dropped.
- 68c8b37: Validation feedback where the candidate answers, and correct-answer mode only for items that have a correct response.
  
  - **Extended text says when a response does not match its `patternMask`** (WCAG 3.3.1). A string response that fails the mask is invalid under `validateResponses` (QTI 2.1; QTI 3.0 §5.48.4); the field now says so. When the candidate leaves a field (plain text or rich text) whose text fails the mask, the author's `data-patternmask-message` shows below it, else the new localized `interactions.extendedText.patternMismatch` sentence. The message describes the field (`aria-describedby`), the field states `aria-invalid="true"`, and the message is announced once through the interaction's polite live region; it clears as soon as the text matches and never blocks typing. The mask is compiled with the player's own XSD translation (`xsdPatternToRegExp`) and tested against the text the response holds, so the message and validation agree: an empty field and a numeric response are never flagged. Each field of a multi-part response is checked on its own. `@pie-qti/default-components` now depends on `@pie-qti/qti-processing` for that translation.
  - **The extended-text extractor reads the QTI 3 `data-patternmask-message`.** It read a `patternMaskMessage` attribute that no QTI version defines, so `ExtendedTextInteractionData.patternMaskMessage` was never set from authored content; it now reads `data-patternmask-message` (QTI 3.0 `qti-extended-text-interaction`; QTI 2.x has no equivalent), as the text entry extractor does.
  - **Gap match marks its required gaps** (WCAG 3.3.2). A gap authored `required` (QTI 2.1 gap; QTI 3.0 §5.55.5) must be filled for a valid response, which validation enforces; the candidate is now told which gaps those are. Each required gap shows an asterisk — a character, not a colour alone — that a visible legend before the passage explains (new key `interactions.gapMatch.requiredBlanksLegend`, "Blanks marked * are required."). A gap is a button, on which ARIA does not allow `aria-required`, so the requirement is the gap's accessible description instead ("Required.", from the existing `common.required`). Gaps carry `data-required="true"` for styling.
  - **Correct-answer mode needs a correct response** (QTI-observable rendering change for scorer views of items without one). Order, match, hottext, slider, select point, position object, gap match and graphic gap match now take correct-answer mode from the shared interaction shell — the scorer's view of an item that *has* a correct response (`role === 'scorer'` and a correct response present) — instead of their own inline `!== null` checks, which put a scorer view of an item without a correct response (hosts pass `null`) into correct-answer mode. Two of them showed it: the **slider** was disabled, announced "undefined Correct answer: {answer}." and showed an empty "Selected Value" readout instead of the untouched slider, and **graphic gap match** hid its label palette, so the scorer could not place labels. They now render and emit as for a candidate; only `disabled` stops interaction outside the correct-answer view. The other six already rendered the same (their correct-answer data was empty without a correct response). Items that have a correct response render as before.
  - **Graphic gap match no longer names the correct label outside the correct-answer view.** A hotspot's accessible name said "Correct answer: {label}" whenever a correct response was passed, for a candidate too, while the visible marker was rightly hidden; screen-reader users alone heard the key. The name now carries it only in the scorer's correct-answer view.
- 795c767: QTI spec-conformance fixes for interaction extraction and delivery data.
  
  **Image element forms (QTI 3.0).** Every graphic interaction (hotspot, graphic order/associate/gap match, select point, drawing, position object) and the `gapImg`/`qti-gap-img` label now accepts the full QTI 3.0 `object|img|picture` choice. A `<picture>` background previously extracted `imageData: null`, leaving the interaction unanswerable; a QTI 3.0 `<img>` position-object stage or draggable made extraction throw and the whole item fail to load. The delivered image data is derived from the `<picture>`'s `<img>` fallback, so its shape is unchanged for renderers.
  
  **Response completeness.** `graphicGapMatchInteraction` now extracts `matchMin` on `gapImg` and `associableHotspot` (it had gapText only) and response validation enforces the hotspots' minimum, so a response using such a choice or hotspot fewer than `matchMin` times is no longer accepted as complete. The delivered `gapTexts`/`gapImages`/`hotspots` types carry `matchMin`; `hotspots` also carries the authored `hotspotLabel`, which the default graphic gap match component uses to name zones for assistive technology (placement announcements included) instead of the generic "Hotspot 1/2".
  
  **Authored names.** Gap images deliver the gapImg `objectLabel` attribute (QTI 2.1 `objectLabel.GapImg.Attr`, QTI 3.0 `object-label`); both gap-match components use it after the image's alt text, before the generic fallback.
  
  **Booleans and shuffle.** Interaction boolean attributes now read the full xs:boolean lexical space, so `shuffle="1"`, `fixed="1"`, `required="1"`, `count-attempt="1"`, `step-label="1"` and `reverse="1"` extract as on. `fixed` is now read on match and associate `simpleAssociableChoice` (and on QTI 2.1 `gapText`/`gapImg`, read for QTI 2.1 content only — 2.2/3.0 define none), so authored fixed choices keep their position under `shuffle="true"` instead of being shuffled.
  
  **Removed surfaces (previously tolerated inputs stop working):**
  - The PCI extractor reads only the schema-defined `customInteractionTypeIdentifier` / `custom-interaction-type-identifier`. The never-standardized `customInteractionIdentifierType` / `custom-interaction-identifier-type` spellings it also accepted are no longer read; hosts passing those must use the schema name. `@pie-qti/to-pie` follows: its PCI type-identifier read is the same two schema names, and its unsupported-interaction diagnostic names the field `customInteractionTypeIdentifier`.
  - Three dead delivered-type members are deleted: `AssociateData.minSelectionsMessage`, `GraphicOrderData.minSelectionsMessage` (attributes no QTI version defines; never populated) and `GapMatchInteractionData.gapTexts[].inputWidth` (never populated; the `qti-input-width-*` class reaches the renderer via `classes`). Plugin authors reading them must switch to the delivered `classes` (input width) or drop the read (the messages).
- 35bd0c3: Hot-path work on the response-dispatch path (typing into `textEntryInteraction`/`extendedTextInteraction`, choice clicks, gap drops): the item body no longer rebuilds its whole presentation plan per response change. The plan is now built once per content-bearing input — outcomes (integrated feedback), template and context values, lifecycle, PnP, and the response values the item's content actually prints (`printedVariable` targets declared as responses) — while the mounted interactions keep receiving every new response value without a rebuild. A per-keystroke dispatch no longer deep-clones the response graph several times: the session view freezes the serializer's own fresh copies in place, the transition freeze no longer re-clones the previous and current views, every listener receives the same deeply frozen transition (its unfreezable typed-array leaves stay per-recipient, as pinned), and a response change runs response validation exactly once instead of twice. The body's `qti-change` listener and display-settings application are wired per element identity and per PnP change rather than per dispatch, so the listener interactions dispatch through is no longer momentarily detached on every keystroke. Additive surface: `Player.getResponseIdentifiersPrintedInContent()` and the internal `ItemSessionBinding` gain the same probe.
- 47e9176: Remove unused public API from `@pie-qti/item-player` (verified zero consumers repo-wide): `PerformanceMonitor`/`globalPerformanceMonitor` (and `@pie-qti/assessment-player`'s dead re-export shim), the `core/constants` star-export, `isResponseEmpty`/`countAnsweredForResponseIds`, `QTIInteractionBase` (no web-component subclassers exist — the `/web-components` entry keeps the event classes and types that consumers use), and a drifted duplicate of the MathLive editor extension. The extraction package's `VariableDeclaration` (a divergent, smaller shape that shadowed the main one in the root barrel under the same name) is renamed to `ExtractionVariableDeclaration`. "Meaningful response" logic used by response validation and attempted-state tracking now shares one implementation instead of two verbatim copies.
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
- 7cf746f: Response value types, serialized session state and parsing-limit cleanups (cleanup phase 2). Runtime behavior is unchanged except for snapshot variables without `defaultValue`; see below.
  
  **Breaking: `InteractionValueMap` describes what each component emits (types only).** Each entry is now the raw value the standard component's `qti-change` event and `onChange` callback carry, before the player normalizes it into the response declaration, instead of a guess from the QTI base type and cardinality. The runtime payload is unchanged, but event handlers and code typed against the old shapes through `InteractionValueMap`, `InteractionResponseValue`, `QTIChangeEventDetail` or `QTIInteractionElement.response` no longer compile:
  
  | Entry | Was | Now |
  | --- | --- | --- |
  | `matchInteraction`, `gapMatchInteraction`, `graphicGapMatchInteraction` | `Record<string, string>` | `string[]` of `"source target"` pairs |
  | `associateInteraction`, `graphicAssociateInteraction` | `Array<[string, string]>` | `string[]` of `"A B"` pairs |
  | `positionObjectInteraction` | `Record<string, { x: number; y: number }>` | `string[]` of `"x y"` points |
  | `selectPointInteraction` | `Array<{ x: number; y: number }>` | `string \| string[] \| null`: `"x y"` points, null once cleared |
  | `hotspotInteraction` | `string[]` | `string \| null`: the selected hotspot, null once cleared |
  | `hottextInteraction` | `string[]` | `string \| string[] \| null` |
  | `choiceInteraction` | `string \| string[]` | `string \| string[] \| null` |
  | `orderInteraction`, `graphicOrderInteraction` | `string[]` | `string[] \| null`: null for an empty subset order |
  | `extendedTextInteraction` | `string` | `string \| number \| Array<string \| number> \| ExtendedTextNumericRecord \| null` |
  | `drawingInteraction` | `string` | `QTIFileResponse \| null` |
  | `customInteraction` | `any` | `string \| null` |
  | `mediaInteraction` | `any` | `number`: the play count |
  
  The other entries are unchanged.
  
  **Breaking: serialized session variables require `defaultValue`.** `SerializedItemSessionVariable.defaultValue`, and `ServerSerializedVariable.defaultValue` in `@pie-qti/item-player/server`, are no longer optional: `serialize()` always writes the field, `null` when the variable has no default value. Restore reads `null` as "no default value"; a snapshot variable without the field now restores a NULL default instead of the default declared in the item XML. Snapshots written by `serialize()` are unaffected; hand-built snapshots must include the field.
  
  Also:
  
  - `<pie-qti-assessment-player>` no longer rewrites the host's `security` config to force `parsingLimits.enabled: true`. It passes the config through and decides the section depth limit with `normalizeParsingLimits`, which already treats limits as on unless the host passes `enabled: false`. Behavior is unchanged for every config, including `maxHtmlDepth` without `enabled`; an explicit `enabled: undefined` now bounds section depth too, as it already did every other limit.
  - Documentation corrections: the `qti-change` payload examples in the order, position-object, graphic-order, hottext, extended-text and web-components PRDs, and structured labels described as implemented and match-only (QTI tech guide, SPEC-GAPS G-13, accessibility and PNP PRDs, QTI 3 migration guide).
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
- 4f9a07c: Internal restructuring of the item session engine (Phase 6 of the player cleanup): the
  `Player` god object is decomposed into focused modules behind the public facade —
  `createAssessmentItemDefinition`, `openSession`, `dispatch`, `state()`, `present()`,
  `serialize()` — with no behaviour change. Declaration building and value coercion live in
  `core/declarations/`, response processing execution and response validation in
  `core/processing/` (the validation special cases — media `minPlays`, end-attempt, extended-text
  `maxStrings` — are per-type entries keyed on the delivered interaction type; every interaction
  keeps the generic field checks), the item content pass and HTML rendering in `core/rendering/`,
  session serialization and the duration clock in `core/serialization/`, the per-session PCI host
  registry in `pci/sessionHosts.ts`, and the session catalog index and lookup in
  `catalog/sessionCatalog.ts`. Response validation is memoized per response revision and
  interaction-data generation (the end-attempt gate stays separate; serialized
  `validationMessages` never contain `incomplete`), and the extended-text numeric `base` is read
  once per interaction identifier instead of re-parsing per coercion. The earliest
  `enforceItemXmlLimits` still runs on every entry path, at definition compile time.
  
  **Breaking:** the session engine's test-only method wrappers were removed from the exported
  `Player` class (reachable through deep imports such as `@pie-qti/item-player/dist/core/Player.js`;
  no package entry exports the class, and the public `ItemSession` facade is unaffected):
  
  - `player.suspendAttempt()`, `player.endAttempt(...)`, `player.scoreAttempt()` — dispatch the
    same actions through the session: `session.dispatch({ action: 'suspendAttempt' })`,
    `session.dispatch({ action: 'endAttempt', countAttempt?, validateResponses? })`,
    `session.dispatch({ action: 'scoreAttempt' })`.
  - `player.getSessionState()` — read `session.state()`, or the serialized snapshot via
    `session.serialize()`.
  - `player.getTemplateVariables()` — read `session.state().templates`.
  - `player.getCorrectResponse(responseId)` — read correct responses from a scorer-role
    `session.present().correctResponses`, or `player.getCorrectResponses()`.
  
  `newTemplate` stays as an engine-level test seam; sessions dispatch it through
  `session.dispatch({ action: 'newTemplate' })`.
- edd4020: Last legacy and compatibility paths removed from the item player (cleanup addendum).
  
  **Breaking: PCI responses are read only in the PCI v1.0 Appendix A binding.** `fromQtiVariableJson`, and so every PCI `getResponse()` answer, no longer reads two non-spec forms; both now read as NULL:
  
  - a `{"base": {...}}` or `{"list": {...}}` wrapper whose key is not a QTI base-type name (it used to be read by the response declaration's base type);
  - anything that is not variable JSON: a raw runtime value such as `"A B"`, a number, an array, or an object with no `base`, `list` or `record` key (it used to pass through unchanged).
  
  A PCI module answering in such a form stores no response and scores as unanswered. PCI modules must answer in the PCI v1.0 Appendix A binding (`{"base": {"<baseType>": value}}`, `{"list": {"<baseType>": [...]}}`, `{"record": [{"name": ..., "base" | "list": ...}]}`). A valid base-type name keeps being read by that base type, also when it differs from the declaration's. `fromQtiVariableJson` takes no second argument any more, and the `QtiVariableJsonDeclaration` type is no longer exported; drop the argument.
  
  **Breaking: parsing limits apply unless the host opts out.** `security.parsingLimits` (item XML size, HTML size, element count and depth, DOCTYPE rejection) used to apply below the custom elements only when a host passed `enabled: true`. It now applies at every layer unless the host passes `enabled: false`: `Player`, `createAssessmentItemDefinition` (the root and the `/server` entry), `AssessmentItemDocument`, `sanitizeHtml`, and `sanitizeSharedHtml` / `enforceItemXmlLimits` / `normalizeParsingLimits` from `@pie-qti/item-player/security`. With no security config, an item containing `<!DOCTYPE` or over 10 MB is rejected, and HTML over 5 MB, 200 000 elements or depth 200 sanitizes to an empty string. To opt out, for trusted content or behind an equivalent upstream limit, pass `security.parsingLimits.enabled: false`; to allow more, raise the individual limit. The `<pie-qti-item-player>` and assessment custom elements already applied these defaults and behave as before.
  
  Also:
  
  - The `@pie-qti/item-player/server` entry's DOM-free `Server*` types are now checked against the engine's at compile time, so the two cannot drift apart unnoticed. The published types are unchanged.
  - Documentation corrections: why the sandbox init payload's `language` is optional (an item with no content language), what PNP `magnification` does (it is set on the player root for host stylesheets, and the default stylesheet does not render it), that QTI 3.0 defines `qti-position-object-interaction`, and the structured-label NVDA checklist (the choice group is always named by its prompt; the flag adds the match interaction's group and column labels).
- 281d6fb: Remove the processing elements no QTI version defines from the expression/rule builder. All were
  checked against the three in-repo XSDs (QTI 2.1, 2.2, 3.0 ASI): none is an `xs:element` in any of
  them, and none is used by official fixtures or third-party content in the repo. The builder cases,
  AST node types and evaluator branches are gone, so the elements fail like any unknown element.
  `xi:include` stays: it is spec-defined (XInclude, referenced by `ResponseProcessing.Type`) and is
  only accepted in the XInclude namespace.
  
  **Breaking:** items using these elements no longer compile (they were invalid QTI before). The
  spec-defined replacements:
  
  - `isNotNull` — write `not(isNull(...))`.
  - `notEqual` — write `not(equal(...))`.
  - `allN` — write `anyN` with `min="0"` and the same `max`.
  - `mean`, `sampleVariance`, `sampleSD`, `popVariance`, `popSD` — write `statsOperator name="..."`,
    the only spelling any QTI version defines.
  - `mod` — write `integerModulus`.
  - `isTypeOf` — no replacement: QTI has no runtime type-inspection operator.
  - `mapOutcome` — no replacement: mappings exist on response declarations only (`mapResponse`); the
    item player also stops reading `<mapping>` inside outcome declarations, which no QTI version
    defines.
  - `setResponseValue` — no replacement: response rules never write response variables; keep derived
    values in outcome variables via `setOutcomeValue`.
  - `lookupTable` (the expression wrapping an inline table) — write the `lookupOutcomeValue` rule and
    put the `matchTable`/`interpolationTable` on the outcome declaration, as the spec paths it.
  - `record` (the constructor) — no replacement: records are a declaration cardinality; deliver the
    record value with the session and read its fields with `fieldValue`.
  - `preCondition` (as an expression) — no replacement: no QTI version defines it outside test
    structure (`assessmentItemRef`/`sectionPart` conditions, which the assessment player owns); the
    fixture that exercised it is deleted. A test pins that every removed name now throws.
  
  The conformance fixtures that exercised the removed elements are rewritten to the spec spellings
  with unchanged cases and outcomes (three renamed: `isNull_not`,
  `responseProcessing_not_equal_basic`, `responseProcessing_anyN_bounds`;
  `responseProcessing_lookupOutcomeValue_interpolationTable` replaces the lookupTable-expression
  fixture), and the fixtures that existed only for a removed element are deleted
  (`responseProcessing_setResponseValue`, `responseProcessing_mapOutcome_basic`,
  `responseProcessing_lookupTable_matchTable` — matchTable coverage stays on the existing
  `responseProcessing_random_lookupOutcomeValue` fixture, which gained a no-matching-entry case).
  All rewritten fixtures now compile as QTI 3.0 as well.
- 0bdb7f1: QTI parsing now follows the spec's own grammar: content that no QTI version (2.1, 2.2 or 3.0) defines is no longer silently tolerated. Per the project's pre-1.0 policy there is no compatibility surface for invalid content.
  
  Breaking: the following were accepted before but are invalid per the QTI XSDs, and now error (or stop matching) instead:
  
  - **ISO 8601 durations in item XML** (`<baseValue baseType="duration">PT1H</baseValue>`): QTI binds item-XML durations to `xsd:double` seconds, so write `3600`. ISO 8601 (`PT90S`) remains the required encoding at the PCI v1.0 Appendix A variable-JSON boundary, which is unchanged.
  - **`equalRounded` roundingMode misspellings** (`significantFigure`, `decimalplace`): the XSDs enumerate exactly `decimalPlaces` and `significantFigures` (default `significantFigures`); any other spelling now fails item compilation.
  - **Child-element `randomInteger`/`randomFloat`**: they are empty elements in every QTI version — `min`/`max`/`step` are attributes; the legacy form that passes `min`/`max` as child expressions now fails compilation (`max` is a required attribute).
  - **`<console>` in responseProcessing**: defined by no QTI version; it now fails compilation instead of being ignored as a no-op.
  - **`caseSensitive` on `<mapping>`**: `caseSensitive` exists on `mapEntry` only. A mapping-level attribute is no longer read; entries without their own `caseSensitive` match case-insensitively, which is the XSD default. Identifier values keep matching exactly.
  
  Fix: `randomInteger` and `randomFloat` now default an absent `min` to 0, as every QTI version defines (only `max` is required, and `randomInteger`'s `step` still defaults to 1). A valid `<randomInteger max="10"/>` previously failed to compile.
- 7c767d4: **Breaking: `OperatorRegistry` is removed from `@pie-qti/qti-processing`, and `EvalEnv` loses its `ops` field** (beta prerelease). The evaluator never read it: every built-in operator is an inline `switch` case in the evaluator, `<customOperator>` dispatch uses the separate `EvalEnv.customOperators` record, and nothing could ever be registered that had an effect — so every caller just constructed an empty registry to satisfy the type. Hosts that build an `EvalEnv` drop the `ops: new OperatorRegistry()` entry; hosts that import `OperatorRegistry` remove the import. Nothing else migrates: the fields that matter (`ctx`, `rng`, `language`, `stringComparison`, `customOperators`, `test`) are unchanged, and scoring is identical. The players' internal environments (`processingEnv`, the test-level expression evaluator, the adapter's outcome-processing run) already dropped the field with it.
  
  Also deduplicates the point-in-shape geometry (rect, circle, ellipse, poly hit tests) that `<inside>` and `mapResponsePoint` each carried as their own verbatim ~55-line copies in the evaluator: both operators now share one module-scope implementation, pinned by tests covering every shape on both operators (boundary inclusivity, zero radii, malformed polygon coords), so the two can no longer drift apart.
- b38cb07: Conformance fixtures rewritten to spec shape for the substring and patternMatch changes (containment semantics; case sensitivity via explicit character classes). Extended text compares responses and derives its minimum-hint change key without stringifying the essay on every keystroke.
- 3b3927e: The `qti-role` role list and its parser are one shared export (`parseQtiRole`/`isQtiRole` from `@pie-qti/item-player`) consumed by both the item and assessment elements, replacing the duplicated copy with its own warning style. An unknown `qti-role` on the assessment element now warns once and renders the candidate view (storing `'candidate'`) instead of warning on every occurrence and leaving the config fallback in charge — the same contract as the item element.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- 9ec0f69: Close the remaining `any`-typed public seams (type-only changes, no runtime behavior change):
  
  - `@pie-qti/item-player`: the player config's `i18nProvider` and `getI18nProvider()` are now typed as `I18nProvider` instead of `any`, so consumers get real checking on the provider contract.
  - `@pie-qti/assessment-player`: `AssessmentRubricBlock.view` models QTI's `view` attribute as `string[]` (it is an arbitrary token list; role semantics live in the toolkit/section-player filtering layer). This removes the `as any[]` casts at both parse sites.
  - `@pie-qti/core`: vendor-extension plugin hooks (`registerVendorDetector`, `registerVendorTransformer`, `registerAssetResolver`, `registerCssClassExtractor`, `registerMetadataExtractor`) take `unknown` instead of `any` — the registry is generic plumbing and can no longer silently widen host plugin objects; the five `as any` call-site casts are gone.
- Updated dependencies [310b975]
- Updated dependencies [30bc3bf]
- Updated dependencies [23a4077]
- Updated dependencies [bd67d58]
- Updated dependencies [0f11f98]
- Updated dependencies [4e5f1a8]
- Updated dependencies [2fa635f]
- Updated dependencies [756771f]
- Updated dependencies [bdfc40e]
- Updated dependencies [0973689]
- Updated dependencies [f6e7714]
- Updated dependencies [eb50277]
- Updated dependencies [7c451f7]
- Updated dependencies [3a31af2]
- Updated dependencies [2f43e0e]
- Updated dependencies [8c4274b]
- Updated dependencies [ee233f4]
- Updated dependencies [fc99dd9]
- Updated dependencies [cfb78e2]
- Updated dependencies [99341e5]
- Updated dependencies [9cd2772]
- Updated dependencies [372037e]
- Updated dependencies [9814c9b]
- Updated dependencies [410fe38]
- Updated dependencies [9abdf17]
- Updated dependencies [c6ae98c]
- Updated dependencies [ad99965]
- Updated dependencies [fe86d42]
- Updated dependencies [fe86d42]
- Updated dependencies [d6ac3bb]
- Updated dependencies [fff7dd7]
- Updated dependencies [fe9e624]
- Updated dependencies [362b7c1]
- Updated dependencies [2e4f6fb]
- Updated dependencies [816c8f8]
- Updated dependencies [3ed760e]
- Updated dependencies [9cb24ad]
- Updated dependencies [90d1c60]
- Updated dependencies [01fb4d1]
- Updated dependencies [d7d744e]
- Updated dependencies [dc38e3b]
- Updated dependencies [af961a1]
- Updated dependencies [2667df1]
- Updated dependencies [74c3886]
- Updated dependencies [de1eed5]
- Updated dependencies [a1c989d]
- Updated dependencies [f13613d]
- Updated dependencies [88b69c0]
- Updated dependencies [68c8b37]
- Updated dependencies [6d4d19d]
- Updated dependencies [6d4d19d]
- Updated dependencies [e7188e4]
- Updated dependencies [30bc3bf]
- Updated dependencies [fe86d42]
- Updated dependencies [1449b94]
- Updated dependencies [562182a]
- Updated dependencies [281d6fb]
- Updated dependencies [93df941]
- Updated dependencies [fa577a0]
- Updated dependencies [0bdb7f1]
- Updated dependencies [7c767d4]
- Updated dependencies
- Updated dependencies [b668938]
  - @pie-qti/qti-common@1.0.0-beta.5
  - @pie-qti/i18n@1.0.0-beta.5
  - @pie-qti/qti-processing@1.0.0-beta.5
  - @pie-qti/ims-cp-core@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- a4ef12c: Move the feedback-text utilities (`cleanFeedbackText`, `processFeedbackInline`, `DEFAULT_FEEDBACK_TRANSFORMS`, `DEFAULT_FEEDBACK_OUTCOME_ID`, `FeedbackTransform`, `ProcessFeedbackInlineOptions`) to `@pie-qti/qti-common`, which already owns the feedback visibility rule they build on (`isShownByIdentifier`). The `@pie-qti/item-player/components/utils` subpath export is removed — it existed only to expose these two functions to a single internal consumer. Import the functions from `@pie-qti/item-player`'s or `@pie-qti/qti-common`'s main entry instead.
- bc58949: Fix the MathLive stylesheet import in the optional `MathLiveEditor` extension: `mathlive/mathlive-static.css` is not an exported path in `mathlive@0.111.x` (the exports map only exposes `./static.css`), so resolving the extension failed under strict package-exports resolution. Now imports `mathlive/static.css`, matching `@pie-qti/default-components`.
- 406c76c: Surface silently-degraded host setup as one-time console warnings (new `warnOnce` helper in `@pie-qti/qti-common`):
  
  - No `i18n` provider on the item player: UI messages would render as raw keys (e.g. `item.parsingError`) and `lang`/`dir` attributes are never set.
  - `locale` attribute set without an `i18n` provider: previously a silent no-op.
  - Section TTS tool using the default host-served `/api/tts` endpoint: the host must serve that route or override the provider config.
  
  Warnings fire only on actual misconfiguration (deliberately not environment-gated, since the workspace ships both tsc- and vite-built outputs and a missing-wiring warning is useful in production too).
- 29210b4: Type the extension seams that were previously `any`:
  
  - `@pie-qti/transform-types` now owns the vendor extension contracts (`VendorDetector`, `VendorTransformer`, `AssetResolver`, `CssClassExtractor`, `MetadataExtractor`, `VendorInfo`, `VendorClasses`, `CustomAttributes`, `VendorExtensionHooks`), so config-driven vendor modules are type-checked at the transform-core registry boundary instead of being cast through `any`. `@pie-qti/to-pie` re-exports the same names from its historical import path. `TransformContext.storage` is now typed as `StorageBackend` (the interface already lived in transform-types). `@pie-qti/transform-core` no longer re-exports its orchestration-internal `VendorInfo` variant, which was ambiguous next to the canonical contract.
  - `@pie-qti/item-player`'s definition config extension points are now typed: `elementNameMapper`/`attributeNameMapper` (`@pie-qti/qti-common` mapper types), `componentRegistry`/`extractionRegistry` (the publicly exported registry classes), and `i18nProvider` (`@pie-qti/i18n`). Code that passed arbitrary objects to these options will now fail typecheck; pass the documented types instead.
- Updated dependencies [a4ef12c]
- Updated dependencies [406c76c]
- Updated dependencies [fb2b4e2]
  - @pie-qti/qti-common@1.0.0-beta.4
  - @pie-qti/ims-cp-core@1.0.0-beta.4
  - @pie-qti/qti-processing@1.0.0-beta.4
  - @pie-qti/i18n@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [c408053]
  - @pie-qti/ims-cp-core@1.0.0-beta.3
  - @pie-qti/i18n@1.0.0-beta.3
  - @pie-qti/qti-common@1.0.0-beta.3
  - @pie-qti/qti-processing@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- d8f9b4d: Accessible names, live-region announcements and visible interaction text now come from the catalog in every locale, built from whole-phrase keys, and a plain-language count uses CLDR plural rules. Escape handlers in the math editor and glossary popups ignore keys an input method editor is composing, and text-entry and extended-text inputs take `dir="auto"`. `@pie-qti/i18n` exports `translate`, `translatePlural`, `joinSentences`, `formatList` and `isImeComposing`, and `@pie-qti/default-components` now depends on `@pie-qti/i18n` directly.
- 5dbabcc: Content and interface direction are now separate: player chrome takes `lang` and `dir` from the interface locale, while the item body, passages, rubrics and modal feedback take them from the content's `xml:lang`, and content that declares no language inherits the chrome's. Nested `xml:lang` spans get a `dir` where their direction differs from the surrounding text. `@pie-qti/i18n` exports `languageDirection`, `canonicalLanguageTag`, `contentLanguageAttributes` and `interfaceLocaleAttributes`, and `@pie-qti/section-player` now depends on `@pie-qti/i18n` directly.
- d0e249b: Locales negotiate by language to catalogs keyed `en`, `ar`, `es`, `fr`, `nl`, `ro`, `th` and `zh-Hans` (the old regional codes stay valid inputs, the `./locales/*` file names follow the new keys), and both players default to an English provider. The package no longer reads a stored locale: hosts relying on the provider restoring its stored locale and reloading the page must now opt in with `persistLocale` and `reloadOnLocaleChange` and read the key at startup.
- a202037: Response processing reads responses in the item's content language: string comparisons and mapping keys ignore bidi controls, tatweel and Unicode encoding differences, case-insensitive comparisons fold case in that language, and numbers accept digits in any script, the Arabic separators and the language's decimal mark. `EvalEnv` takes an optional `language`, and `coerceBaseValue` an optional third argument. Stored responses are unchanged.
- 67d94ee: Player chrome and interaction layout use logical CSS properties, so they mirror under `dir="rtl"`, and horizontal order lists move items with the arrow keys in the inline direction. `AssessmentTimer` accepts `top-end`/`top-start`/`bottom-end`/`bottom-start` and defaults to `top-end`; the physical values keep working.
- dba1477: `patternMatch` and the text-entry `patternMask` follow XML Schema pattern rules: a pattern must match the whole response, and `\d` matches decimal digits in any script. `patternMatch` reads its pattern from the `pattern` attribute, including a `{TEMPLATE}` reference, where it previously required a second child expression and failed to build otherwise. `xsdPatternToRegExp` and `xsdPatternSource` are exported from `@pie-qti/qti-processing`.
- Updated dependencies [d8f9b4d]
- Updated dependencies [5dbabcc]
- Updated dependencies [d0e249b]
- Updated dependencies [e874155]
- Updated dependencies [a202037]
- Updated dependencies [572c3d3]
- Updated dependencies [dba1477]
  - @pie-qti/i18n@1.0.0-beta.2
  - @pie-qti/qti-common@1.0.0-beta.2
  - @pie-qti/qti-processing@1.0.0-beta.2
  - @pie-qti/ims-cp-core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- @pie-qti/i18n@1.0.0-beta.1
  - @pie-qti/ims-cp-core@1.0.0-beta.1
  - @pie-qti/qti-common@1.0.0-beta.1
  - @pie-qti/qti-processing@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- 3c70cc3: Declare the player platform's 1.0 feature set complete with a beta: all tracked QTI 2.2 / 3.0 spec gaps are closed — the spec-conformant PCI runtime (registry contract, `getInstance`, QTI variable JSON, AMD loading with resolution configs, clean-room conformance fixtures) plus the opt-in sandboxed execution engine (`@pie-qti/pci-runner`), PNP structured labels and braille data exposure, and manifest-level shared catalog files. The player/platform packages move together to the prerelease line and publish under the `beta` npm dist-tag; `latest` stays on 0.1.x. The transformation packages (`@pie-qti/pie-to-qti2`, `to-pie`, `transform-cli`, `transform-core`, `transform-types`, `source-profiles`) stay pre-alpha on their own 0.1.x lockstep and keep their current versioning: they ride along as the plain patch their dependents' release requires and publish to `latest` with no `beta` suffix. The final 1.0.0 follows the official-suite evidence refresh and a production-host validation.

### Patch Changes

- 32c08b7: Content language follows `xml:lang`. `prepareContentMarkup` restates it as `lang`; the item body takes its `lang` from the item, exposed as `Player.getContentLanguage()`, and glossary lookups pass it. The section player sets the toolbar and TTS language from it and picks a Polly voice for that language unless the host configures `defaultVoice`, which no longer defaults to Joanna; shared HTML blocks take an optional `language`.
- 6c209e2: AfA PNP drives more of delivery. `pnpProfileFromAfa` maps interface language, inverted polarity, single-column layout, text appearance, fixed-minute extra time, answer masking and the tool supports (`PnpProfile.tools`); `answer-masking` now masks choices in `choiceInteraction` and no longer turns on the elimination tool. `qti-pnp.css` in default-components styles the colour schemes and display needs, and the loaders' runtime CSS imports it. The section player takes `pnp` and, with the item's companion materials, turns on the tools the host offers with `enabled: false` and removes prohibited ones.
- 0f93a03: Read-aloud markup reaches delivery. `prepareContentMarkup` moves from to-pie into `@pie-qti/qti-common/accessibility` and reads QTI 3 names; the item player renders SSML docked as catalog idrefs and `data-qti-suppress-tts` as `data-tts-suppress`, and the section player registers the SSML as `spoken` catalogs and projects QTI 3 interactions without suppressed content.
- 1521a74: Shared vocabulary classes, authored interaction aria and richer catalogs. `qti-shared-vocabulary.css` and the interactions honour the QTI 3 shared classes: choice labels and suffixes, writing orientation, `qti-choices-*` placement and `qti-unselected-hidden`. Every interaction takes its authored `aria-label`, `aria-labelledby` and `aria-describedby` through `interactionAria`, resolved to text at extraction (`BaseInteractionData.accessibility`). Catalog entries render multi-part content and media; object replacement keeps aria, role and `lang`. The section player's read-aloud takes native `qti-catalog-info` and APIP spoken cards and docks the SSML of passages.
- a7c714e: `feedbackInline` resolves in either QTI spelling, nested and by membership in a container outcome, in the item body, choice text, rubric blocks and modal feedback; `qti-common` exports the shared visibility rule as `isShownByIdentifier`.
- 5be190e: Evaluate `feedbackBlock`, `templateBlock`, `templateInline`, choice-level `templateIdentifier` and MathML template variables in both QTI spellings, show modal feedback by membership, and read context variables, including `QTI_CONTEXT`, set through `openSession({ contextVariables })`.
- bac1158: `printedVariable` honours `format`, `base`, `index`, `powerForm`, `field`, `delimiter` and `mappingIndicator` in both QTI spellings, and resolves in rubric blocks and modal feedback as well as the item body.
- a4353af: Prompts, choices and interaction hosts keep their authored `lang`, catalog idref and read-aloud suppression.
- 8063850: `ItemSession` takes `templateDefaults`, applied before template processing, and a `presentation` policy whose `showFeedback` and `showSolution` gate integrated feedback and the solution view.
- f20a87e: `interpolationTable` is a step lookup per QTI: the first entry in document order whose `sourceValue` the source exceeds, or equals unless `includeBoundary="false"`, else `defaultValue`, else NULL. Lookup results and `defaultValue` take the outcome's base type, `interpolationMethod` is gone, and `qti-match-table` and `qti-interpolation-table` build.
- 30b045d: Test-level outcome processing sees every delivered item with its typed variables, section path, categories, weights, declared normal bounds and presented/responded/correct/incorrect/selected flags, so `numberResponded`, `numberSelected`, `numberCorrect` without `MAXSCORE`, section and category filters and weighted `testVariables` evaluate as authored. Item scoring reports `correct`; `outcomeMinimum`/`outcomeMaximum` read `normalMinimum`/`normalMaximum`.
- bbaab53: PCI module loading reaches the spec's AMD default resolution (G-08 phase 2): every authored `qti-interaction-module` entry is extracted with its id, multi-module declarations load through a `define`/`require` implementation that wires dependencies by id, and the RequireJS-shaped resolution config is parsed from the authored `primary-configuration` reference or the defined default locations (`modules/module_resolution.js`, then `modules/fallback_module_resolution.js`). The entry module is picked by the `customInteractionTypeIdentifier` tail, falling back to its authored fallback path on failure. Evaluation still goes through the host resolver — the loader decides how dependencies wire up, the resolver still decides whether code runs.
- 0ca867a: PCI conformance evidence and a fallback-loading fix (G-08 phase 3): on a multi-module load's fallback attempt, the entry module's id now rebinds to the authored fallback path, so a fallback declared beside a wrong primary path registers instead of re-fetching the broken path. Clean-room conformance fixtures under `tests/conformance/pci/` drive the full delivery path over real module files — registration, `getInstance` state seeding in QTI variable JSON, `onready`/`ondone`, `getState()` restore, and fallback resolution.
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
- 33b1a1a: PCI adopts the QTI 3.0 §6.1 registry contract (G-08 phase 1), replacing the bespoke `PciModule` interface outright: modules register against the page's `qtiCustomInteractionContext` and the host instantiates through `getInstance(dom, configuration, state)` with `onready`/`ondone`, a derived `status` (`interacting`/`closed`/`solution`/`review`), and QTI variable JSON (`base`/`list`/`record`) at the boundary. Responses are owned by the mounted module — `restore()` re-seeds `getInstance` state instead of pushing a setter — and `getState()` is exposed on the host. Host resolver trust gating is unchanged. A module written against the retired `PciModule` breaks; none is known to exist.
- 765423c: Structured labels and braille routing (G-13): `pnp.display.structuredLabelSupport` presents choice and match answer sets as one ARIA group named by the interaction prompt, with match columns named by their visible headings. An AfA PNP `<braille/>` grant now routes to the platform `brailleText` preference (`sign-language` to `signingDefinition`), and `getCatalogEntry` under a QTI 3 usage falls back to the APIP support name (`braille-text` → `braille`, `signing-definition` → `sign-language`), so QTI 3 and APIP catalogs share one lookup path. The research note, markup contract, and NVDA checklist live in `packages/item-player/docs/PNP.md`.
- 0edef83: Resolve external QTI processing fragments during packaged assessment delivery.
  
  `xi:include` fragments referenced by an item's `responseProcessing`, `templateProcessing`, or `outcomeProcessing` are now preloaded from the content package during reference-mode assessment parsing and executed through a package-contained resolver, so packaged fragments work without host wiring. Nested includes resolve relative to the fragment that references them, and authored `xi:fallback` content runs when a fragment file is missing. The processing engine now requires the XInclude namespace for `include` and `fallback` elements and fails loudly when another vocabulary uses those local names. Test-scope (`scope: 'test'`) fragments still require a host-supplied resolver and fail closed, unchanged.
- 953e5d1: Shared catalog files from the content package manifest (G-15, QTI 3.0 §6.3): `loadResolvedManifest` surfaces resources of type `imsqti_catalog_xmlv3p0` as `sharedCatalogs`; `createResolvedItemDeliveryContext` accepts `packageCatalogSources` and the reference backend adapter threads a host-supplied list (`parseAssessmentTestXml({ sharedCatalogs })`, exposed as `QtiAssessmentPlayerConfig.sharedCatalogs`) into every item's delivery context. The item player merges package-scope entries at the bottom, so an item-level `qti-catalog-info` wins a shared identifier and a shared file backs items that declare none.
- Updated dependencies [65e62f6]
- Updated dependencies [0d99546]
- Updated dependencies [32c08b7]
- Updated dependencies [6c209e2]
- Updated dependencies [0f93a03]
- Updated dependencies [a7c714e]
- Updated dependencies [f20a87e]
- Updated dependencies [30b045d]
- Updated dependencies [765423c]
- Updated dependencies [0edef83]
- Updated dependencies [953e5d1]
- Updated dependencies [c785703]
  - @pie-qti/qti-processing@1.0.0-beta.0
  - @pie-qti/ims-cp-core@1.0.0-beta.0
  - @pie-qti/qti-common@1.0.0-beta.0
  - @pie-qti/i18n@1.0.0-beta.0

## 0.1.28

### Patch Changes

- Updated dependencies [6af3354]
- Updated dependencies [8fd28e3]
  - @pie-qti/qti-common@0.1.28
  - @pie-qti/qti-processing@0.1.28
  - @pie-qti/i18n@0.1.28
  - @pie-qti/ims-cp-core@0.1.28

## 0.1.27

### Patch Changes

- 498b1e2: The item player resolves a QTI 2.x item's APIP access elements as catalogs, docking each link on the element, word or characters it names as `data-catalog-idref`.
- Updated dependencies [498b1e2]
  - @pie-qti/qti-common@0.1.27
  - @pie-qti/qti-processing@0.1.27
  - @pie-qti/i18n@0.1.27
  - @pie-qti/ims-cp-core@0.1.27

## 0.1.26

### Patch Changes

- 34c0034: Read the PNP as a per-candidate AfA PNP 3.0 profile. `parsePnpXml` now parses an `access-for-all-pnp` document, `parseAfaPnpXml` returns its whole record and `pnpProfileFromAfa` maps a record onto `PnpProfile`. to-pie no longer emits `personalNeedsProfile` for an assessmentTest and warns `QTI_PNP_IN_CONTENT` instead; the `PersonalNeedsProfile` type is removed.
- Updated dependencies [ff00d31]
- Updated dependencies [5627ce1]
  - @pie-qti/ims-cp-core@0.1.26
  - @pie-qti/qti-common@0.1.26
  - @pie-qti/qti-processing@0.1.26
  - @pie-qti/i18n@0.1.26

## 0.1.25

### Patch Changes

- Updated dependencies [0bb51e3]
  - @pie-qti/qti-processing@0.1.25
  - @pie-qti/i18n@0.1.25
  - @pie-qti/ims-cp-core@0.1.25
  - @pie-qti/qti-common@0.1.25

## 0.1.24

### Patch Changes

- 67e4c23: Update mounted player components through reactive props so entering answers preserves input focus, caret position, and keyboard interaction state. Keep externally supplied session and provider objects intact across updates.
- Updated dependencies [5c8a8e8]
- Updated dependencies [080f254]
- Updated dependencies [e532f4f]
- Updated dependencies [67e4c23]
  - @pie-qti/qti-common@0.1.24
  - @pie-qti/i18n@0.1.24
  - @pie-qti/qti-processing@0.1.24
  - @pie-qti/ims-cp-core@0.1.24

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
- @pie-qti/i18n@0.1.23
  - @pie-qti/ims-cp-core@0.1.23
  - @pie-qti/qti-common@0.1.23
  - @pie-qti/qti-processing@0.1.23

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
  - @pie-qti/i18n@0.1.22
  - @pie-qti/ims-cp-core@0.1.22
  - @pie-qti/qti-common@0.1.22
  - @pie-qti/qti-processing@0.1.22

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

- 2c00bd1: Initialize numeric outcome variables to 0 when no default is declared. Per QTI 2.1 §5.2, carried
  into 2.2 and 3.0, an outcome with no `<defaultValue>` initializes to NULL unless its base type is
  `integer` or `float`, where it initializes to 0. Every defaultless outcome was initialized to NULL,
  so accumulating response processing such as `SCORE = sum(SCORE, 1)` propagated NULL and the item
  never scored: 1EdTech acceptance criteria Q12-L2-D3/D4/D5 require `SCORE` of 1, 0 and 2 for the
  composite inline-choice sample, and pie-qti returned NULL for every response set. The rule is
  applied at parse time, so it also governs the reset before each response-processing run and the
  `<default>` expression. Response and template variables are unaffected — an unanswered numeric
  response must stay distinguishable from an answered zero — and an authored `<defaultValue>` still
  wins. `@pie-qti/assessment-player` already applied this rule to test-level declarations; item and
  test level now agree.

  A `MAXSCORE` declared without a default is consequently 0 rather than absent, so an item that never
  assigns it scores against a maximum of zero. Substituting 1 inside response processing would make
  this engine disagree with a conformant one, so the value stands and the player warns once per item,
  naming the item and the remedy. `ScoringResult.maxScore` still falls back to `1.0` when `MAXSCORE`
  is not declared at all, which the spec leaves open.

  `Declaration` gains `impliedNumericDefault`, marking a `defaultValue` that came from this rule
  rather than from the author.

  Remove the unused `core/declarations.js` exports (`initializeDeclarations`, `addDeclaration`,
  `addMapping`, `addAreaMapping`, `getVariableValue`, `setVariableValue`, `resetDeclarations`,
  `cloneDeclarations`, `DeclarationsContext`) and `BUILTIN_DECLARATIONS`. Nothing in the framework
  called them; they were a second declaration model that took no response/outcome kind, so they could
  not carry the numeric-outcome rule and would have kept returning NULL defaults. `BUILTIN_DECLARATIONS`
  also described built-ins the runtime does not use and typed `completionStatus` as `string` where the
  runtime seeds `identifier`. Hosts that built declaration maps by hand should use
  `createAssessmentItemDefinition()` and the session interface instead.

- Updated dependencies [8836ebf]
- Updated dependencies [2c00bd1]
  - @pie-qti/qti-processing@0.1.21
  - @pie-qti/i18n@0.1.21
  - @pie-qti/ims-cp-core@0.1.21
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
  - @pie-qti/qti-common@0.1.20
  - @pie-qti/qti-processing@0.1.20
  - @pie-qti/i18n@0.1.20
  - @pie-qti/ims-cp-core@0.1.20

## 0.1.19

### Patch Changes

- ffe996d: Scope SMIL element removal to `<svg>` subtrees, so item HTML using those tag names keeps its text.

  `ACTIVE_SVG_ELEMENTS` — `animate`, `animateColor`, `animateMotion`, `animateTransform`,
  `discard`, `set` — was matched by tag name anywhere in the document, and matches were removed
  along with their children. The policy exists because SMIL can mutate `href` and other
  URL-bearing attributes after the static attribute pass, which is only true inside SVG.

  Outside an `<svg>` subtree these are inert unknown elements, and `<set>` reaches real content:
  ExamView-style QTI 2.1 exports wrap parts of a question stem in `<set bf="">`. Removing it
  discarded the wrapped text, truncating a stem mid-sentence — a myPerspectives item asking
  "Which evidence from paragraph 1 of Selection 1 **best** supports the inference that the
  narrator enjoys playing outdoors?" rendered as "Which evidence from paragraph 1 of Selection 1".

  These elements are now unwrapped outside SVG, preserving their sanitized children, which is
  what non-QTI hyphenated elements already did — both paths now share one helper. Inside an
  `<svg>` subtree they are still removed outright, so a `<set attributeName="href">` animation
  cannot survive.

  - @pie-qti/i18n@0.1.19
  - @pie-qti/ims-cp-core@0.1.19
  - @pie-qti/qti-common@0.1.19
  - @pie-qti/qti-processing@0.1.19

## 0.1.18

### Patch Changes

- 2ebee31: Scope QTI stylesheets with an at-rule-aware walker, so `@media` conditions are no longer dropped.

  `scopeCssRules` matched rules with `([^{}@]+)\{([^{}]*)\}`. Excluding `@` from the selector
  pattern kept the scope from being glued onto an at-rule, but it did not make the walker
  understand at-rules, and the failure that remained is worse than a visibly broken selector.

  An `@media` block never matched as a unit, so its inner rules matched on their own and were
  emitted **without the condition**. A `@media print` rule therefore applied on screen as well,
  and a narrow-viewport rule applied at every width — valid CSS that silently renders in the
  wrong places, which is harder to notice than a rule that fails outright. `@supports` behaved
  the same way. `@keyframes spin { 0% { … } }` had its percentage selectors scoped into
  `[scope] 0%` and lost the animation name, so the animation could not run, and `@font-face`
  became `[scope] font-face`.

  Scoping now walks the stylesheet brace-by-brace:

  - `@media`, `@supports`, `@container`, `@layer` and `@scope` keep their prelude and have
    their inner rules scoped, recursively.
  - `@font-face`, `@keyframes` (including vendor-prefixed), `@page`, `@property` and
    `@counter-style` pass through untouched, as do at-rules the walker does not recognise.
  - Parsing is string- and paren-aware, so a `{` inside `content: "{"` does not end a block and
    a `,` inside `:is(a, b)` does not split a selector list. Comment stripping is string-aware
    too, so a literal `content: "/*"` survives where the previous regex strip corrupted it.
  - Style-rule blocks are emitted verbatim, which is what native CSS nesting needs: nested
    selectors are relative to a parent that has already been scoped.

  `:root`, `html` and `body` are still replaced by the scope selector rather than prefixed, and
  now preserve whatever followed them — `html.dark .a` becomes `[scope].dark .a` instead of
  discarding the `.dark` compound.

  One deliberate behaviour change beyond at-rules: **a leading pseudo is now scoped as a
  descendant rather than attached.** `:is(.a, .b) .c` becomes `[scope] :is(.a, .b) .c`, not
  `[scope]:is(.a, .b) .c`. The authored selector means "some element matching `.a` or `.b`", so
  attaching it required the item body itself to carry the authored class, which it does not.
  The same applies to `:hover` and `::selection`.

  **This both adds and removes rendering.** At-rules have never applied correctly, so some
  styles start applying — but `@media` rules that currently apply unconditionally will now
  apply only behind their real condition, so styles that render today may stop. That is the
  fix, and it is worth eyeballing against real content: a print stylesheet that appeared to
  work on screen was never meant to.

  Flat selector rules scope exactly as before, and `isBlockedStylesheetCss` still rejects any
  stylesheet containing `url(` or `@import` before scoping runs, so `@font-face` with a real
  `src` never reaches this path in practice.

  - @pie-qti/i18n@0.1.18
  - @pie-qti/ims-cp-core@0.1.18
  - @pie-qti/qti-common@0.1.18
  - @pie-qti/qti-processing@0.1.18

## 0.1.17

### Patch Changes

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
  - @pie-qti/ims-cp-core@0.1.17
  - @pie-qti/qti-common@0.1.17
  - @pie-qti/qti-processing@0.1.17

## 0.1.16

### Patch Changes

- 3c56bd9: Generate identifiers from a CSPRNG and fix a non-uniform shuffle.

  - `item-player`: `createSessionGuid` previously fell back to `Math.random()` when
    `crypto.randomUUID` was unavailable — which is precisely the case when the player is
    served over plain HTTP, since `randomUUID` is restricted to secure contexts. It now
    falls back to `crypto.getRandomValues`, and throws a descriptive error if no Web Crypto
    API is present at all rather than silently producing predictable session GUIDs.
  - `ims-cp-node`: temporary extraction directories are now created with `fs.mkdtemp`
    instead of a `Date.now()` + `Math.random()` name. The old name was predictable and was
    built before the directory was created, so a local attacker could pre-create the path or
    plant a symlink there. `mkdtemp` creates the directory atomically with mode `0700`
    (previously `0755`, i.e. readable by other local users).
  - `assessment-player`: `ReferenceBackendAdapter` item-bank selection used
    `sort(() => Math.random() - 0.5)`, which is not a uniform shuffle — measured over 60k
    trials it left the first element in place 21.9% of the time against an expected 16.7%.
    Replaced with the Fisher-Yates helper already used by `AssessmentPlayer`.

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

- Updated dependencies [5a4e39a]
- Updated dependencies [22db6c6]
  - @pie-qti/i18n@0.1.16
  - @pie-qti/ims-cp-core@0.1.16
  - @pie-qti/qti-common@0.1.16
  - @pie-qti/qti-processing@0.1.16

## 0.1.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.15
  - @pie-qti/ims-cp-core@0.1.15
  - @pie-qti/qti-common@0.1.15
  - @pie-qti/qti-processing@0.1.15

## 0.1.14

### Patch Changes

- da6892f: Add section-player contracts, assessment toolkit helpers, and expose the shared item-player security surface for QTI shared content.
- a27cc3c: Add QTI section tool contracts and header controls for text-to-speech and calculator demos, including MathML-aware speech payloads and section web component typesetting support.
  - @pie-qti/i18n@0.1.14
  - @pie-qti/ims-cp-core@0.1.14
  - @pie-qti/qti-common@0.1.14
  - @pie-qti/qti-processing@0.1.14

## 0.1.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.13
  - @pie-qti/ims-cp-core@0.1.13
  - @pie-qti/qti-common@0.1.13
  - @pie-qti/qti-processing@0.1.13
  - @pie-qti/typeset-katex@0.1.13

## 0.1.12

### Patch Changes

- abe0be5: Add package-owned QTI theme tokens and a DaisyUI bridge so host applications can cascade their active theme into QTI players through stable `--pie-qti-*` variables.

  `loadPieQtiPlayerElements()` now also loads the bundled default interaction web components, giving browser hosts a single stable loader for the default player runtime.

  `@pie-qti/web-component-loaders/default-runtime.css` now exposes the default browser runtime CSS, including the DaisyUI theme bridge and QTI shared vocabulary classes.

  - @pie-qti/i18n@0.1.12
  - @pie-qti/ims-cp-core@0.1.12
  - @pie-qti/qti-common@0.1.12
  - @pie-qti/qti-processing@0.1.12
  - @pie-qti/typeset-katex@0.1.12

## 0.1.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.11
  - @pie-qti/ims-cp-core@0.1.11
  - @pie-qti/qti-common@0.1.11
  - @pie-qti/qti-processing@0.1.11
  - @pie-qti/typeset-katex@0.1.11

## 0.1.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.10
  - @pie-qti/ims-cp-core@0.1.10
  - @pie-qti/qti-common@0.1.10
  - @pie-qti/qti-processing@0.1.10
  - @pie-qti/typeset-katex@0.1.10

## 0.1.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.9
  - @pie-qti/ims-cp-core@0.1.9
  - @pie-qti/qti-common@0.1.9
  - @pie-qti/qti-processing@0.1.9
  - @pie-qti/typeset-katex@0.1.9

## 0.1.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.8
  - @pie-qti/ims-cp-core@0.1.8
  - @pie-qti/qti-common@0.1.8
  - @pie-qti/qti-processing@0.1.8
  - @pie-qti/typeset-katex@0.1.8

## 0.1.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.7
  - @pie-qti/ims-cp-core@0.1.7
  - @pie-qti/qti-common@0.1.7
  - @pie-qti/qti-processing@0.1.7
  - @pie-qti/typeset-katex@0.1.7

## 0.1.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.6
  - @pie-qti/ims-cp-core@0.1.6
  - @pie-qti/qti-common@0.1.6
  - @pie-qti/qti-processing@0.1.6
  - @pie-qti/typeset-katex@0.1.6

## 0.1.5

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.5
  - @pie-qti/ims-cp-core@0.1.5
  - @pie-qti/qti-common@0.1.5
  - @pie-qti/qti-processing@0.1.5
  - @pie-qti/typeset-katex@0.1.5

## 0.1.4

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.4
  - @pie-qti/ims-cp-core@0.1.4
  - @pie-qti/qti-common@0.1.4
  - @pie-qti/qti-processing@0.1.4

## 0.1.3

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.3
  - @pie-qti/ims-cp-core@0.1.3
  - @pie-qti/qti-common@0.1.3
  - @pie-qti/qti-processing@0.1.3

## 0.1.2

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-qti/i18n@0.1.2
  - @pie-qti/ims-cp-core@0.1.2
  - @pie-qti/qti-common@0.1.2
  - @pie-qti/qti-processing@0.1.2

## 0.1.1

### Patch Changes

- 2243643: Publish the initial public release of all publishable PIE-QTI packages.
- Updated dependencies [2243643]
  - @pie-qti/qti-processing@0.1.1
