# PNP: structured labels and braille support (G-13)

This document covers the two most specialist PNP features: presenting interaction
structure to assistive technology (`structuredLabelSupport`), and exposing
`braille-text` catalog content for refreshable braille displays. It records what the
standards actually define, the markup the player emits, and the part that stays with
the host.

## Structured labels

### Where the term comes from — research findings

The plan named `structuredLabelSupport` as a PNP profile flag that adds group markup
around interactions. Checking the sources it could plausibly come from:

- **APIP 1.0** (`apipv1p0_qtiextv2p2_v1p0.xsd`) defines no label or sublabel support.
  An access element's `relatedElementInfo` holds spoken, brailleText, tactileFile,
  signing (`signFileASL` / `signFileSignedEnglish`), keyWordTranslation,
  keyWordEmphasis, revealAlternativeRepresentation, guidance, answerReduction and the
  graphic/material elements — nothing that labels a group of answers.
- **AfA PNP 3.0** (`imsqtiv3p0_afa3p0pnp_v1p0.xsd`) has no structured-label feature
  either; there is no feature name containing "label".

So structured labels are **a pie-qti player extension**, configured in the JSON
profile only (no AfA XML feature maps to it). The design anchors are the real ones:

- **WAI-ARIA `role="group"` + `aria-labelledby`** for a set of controls that share one
  question, announced by a screen reader before its choices.
- The **interaction prompt** as the group's accessible name, since QTI items state the
  question there.
- **WCAG 2.2 (2.4.6 Headings and Labels, 1.3.1 Info and Relationships)**: programmatic
  association of the visible question and column headings with the answers they govern.

### Markup contract

With `pnp.display.structuredLabelSupport: true`:

| Interaction | Markup |
| --- | --- |
| `choiceInteraction` | The interaction root becomes `role="group"`, named by the prompt via `aria-labelledby` → the prompt element's id. Without a prompt, an i18n fallback name (`interactions.choice.groupLabel`, "Answer choices") applies, unless the item authors an accessibility label, which wins. |
| `matchInteraction` | Same group treatment on the interaction root, plus each answer column takes its visible column heading ("Source items to match" / "Target items for matching") as its `aria-labelledby` name instead of the hidden `aria-label`. |

When the flag is off, rendering is byte-for-byte the behavior this player shipped
before G-13. The flag rides the presentation plan to every block interaction
(`BlockInteractionMount.structuredLabelSupport`), so third-party components can honor
it the same way.

### Manual verification (NVDA, ~5 minutes)

Automated tests pin the markup; one screen-reader pass confirms the announced
experience. No braille display or braille knowledge is needed:

1. Open an item with a prompted `choiceInteraction` and `structuredLabelSupport: true`.
2. Focus the first choice: NVDA should announce the prompt text, then the choice
   ("radio button, 1 of 4" and its label).
3. Shift+Tab back into the group from a later choice: NVDA should announce the group
   name (the prompt) on entry.
4. Open a `matchInteraction`: each column should announce its heading name when
   focused.
5. Repeat with the flag off: behavior is the pre-G-13 rendering (no group name).

## Braille (`braille-text`)

### What the player does

- The catalog carries braille content as ordinary catalog entries: usage
  **`braille-text`** in QTI 3 catalogs, and usage **`braille`** in APIP-derived
  catalogs (`apip:brailleText` → `brailleTextString`). A lookup under the QTI 3 usage
  falls back to the APIP name (`USAGE_ALIASES` in `catalogLookup.ts`), so one routing
  path serves both.
- Braille content is **pre-transcribed at authoring time** (Unicode braille, e.g.
  `⠑⠉⠕`). The player never translates to or from braille; it treats the payload as
  opaque text/HTML.
- An AfA PNP XML feature `<braille/>` grants the platform preference
  `pnp.content.catalogSupports.brailleText` (the player routes that one itself;
  untranslated feature names fall through to host-defined usage routing).

### Host contract

Two access paths, both already shipped with G-10/G-14:

1. **Pull**: `player.getCatalogEntry(idref, 'braille-text', lang)` returns the entry's
   HTML/text (URL-policy-checked, sanitized), or `null`.
2. **Push**: with the preference granted, each `data-catalog-idref` term gets a "B"
   trigger button that fires a bubbling, composed **`qti-catalog-lookup`**
   `CustomEvent` with `detail: { idref, usage, html, content, languageCode }`.

The host is responsible for routing the payload to the output device — a refreshable
braille display driver (e.g. via BRLTTY), a braille-enabled popup, or ARIA 1.3
`aria-braillelabel` (which requires a non-braille equivalent in the same markup; see
axe-core rule `aria-braille-equivalent`). The player never talks to devices.

### Boundaries

- No braille translation or back-translation in the player (authoring-time concern).
- No embossing or device management (host/platform concern).
- Tactile graphics arrive as `tactile` catalog entries under the same contract.
