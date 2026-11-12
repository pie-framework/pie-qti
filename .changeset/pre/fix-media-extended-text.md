---
'@pie-qti/default-components': patch
'@pie-qti/item-player': patch
'@pie-qti/i18n': patch
---

Media and extended text interactions: enforced play limits, captions, accessible names, and spelling-help integrity.

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
