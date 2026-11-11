# @pie-qti/section-player

QTI section renderer contracts and composition helpers for composing item players with shared
section context.

## What this package publishes

The npm package ships **headless TypeScript contracts and helpers** only:

- `ResolvedQtiSectionComposition` and the runtime-host contract (`.` entry),
- `resolveQtiSectionComposition()` — resolve an assessment test into section compositions; pass
  `assessmentId` and the candidate's `pnp`, which the composition carries to the layouts,
- role-view visibility helpers and PNP tool-support helpers (`applyToolSupports`,
  `companionMaterialsOf`, `companionToolIds`), and `filterToolsForRole`, the tool filter the
  composition applies (supports first, then enabled tools visible to the role),
- display-settings helpers (`withDisplaySettings`, `displaySettingsOf`, `QtiCandidateDisplaySettings`).

## Build model: where the UI lives

The Svelte renderers under `src/components/` are **not compiled into this package's dist**. They are
consumed as source by `@pie-qti/player-elements`, whose vite build compiles them into its
self-contained custom-element bundle (`pie-qti-section-player-splitpane` /
`pie-qti-section-player-vertical`). The npm artifact you install here is contracts-only by design;
see the [player-elements build model](../player-elements/README.md#build-model-this-package-ships-the-compiled-ui).

## Accommodations on the section surface

A section layout is one PNP display scope. It applies its profile — its `pnp` prop, else the
composition's `pnp`, with the candidate's display settings applied — to its own root with
`applyPnpToSurface` from `@pie-qti/item-player`. The colour scheme, inverted polarity,
single-column layout and text appearance then cover everything it renders: passages and stimuli,
rubric blocks, tool bars, the Passage/Question tabs, item headers and the items. Item bodies inside
the surface apply no display needs of their own, so one profile governs passage and question
alike. The host page outside the layout is never repainted;
[Display scope](../../docs/prds/systems/pnp.md#display-scope) gives the exact boundaries. A
single-column need stacks the split pane behind its tabs at any width. The default runtime
stylesheet (`@pie-qti/web-component-loaders/default-runtime.css`, or
`@pie-qti/default-components/qti-pnp.css`) renders the attributes.

### Display settings tool

The candidate adjusts their display themselves from the "Display settings" button in the item
tool bar: text size (four steps), higher-contrast text and extra text spacing, each through the PNP
display mechanism above, in a native modal dialog on the section surface. Settings last for the
page session, per assessment. Layout props:

| Prop | Purpose |
|------|---------|
| `displaySettings` | `false` leaves the tool out (default `true`) |
| `initialDisplaySettings` | The settings the controls start with, e.g. `displaySettingsOf(persistedPnp)` |
| `onDisplaySettingsChange` | Hears `{ sectionIdentifier, settings, pnp }`; `pnp` is the effective profile to persist and pass back as the candidate's PNP |

The same event reaches `QtiSectionRuntimeHostContract.onDisplaySettingsChange` (the composition's
`host`), which is how a custom-element host hears it.

## Framework errors

The layouts report their own failures through the runtime-host contract's `onFrameworkError`
callback. A host that cannot pass callbacks — the custom elements — hears the same reports as
`qti-section-framework-error`, a typed, bubbling, composed `CustomEvent` on the
`pie-qti-section-player-splitpane` / `pie-qti-section-player-vertical` elements (the
`invalid-composition` code they emit for a composition they cannot render is documented with
[the elements](../player-elements/README.md)).

The event's `detail` is `QtiSectionFrameworkError`:

| Field | Meaning |
|-------|---------|
| `code` | Stable identifier for the failure, from the table below |
| `message` | Raw engine/parser text. For host logs and diagnostics only — **never render it to candidates** |
| `sectionIdentifier` | The section that was presenting when the failure was reported (filled from the composition) |
| `itemIdentifier` | The item concerned, when known (filled from the active item otherwise) |
| `cause` | The original thrown value, when there is one |

Codes the section player itself reports:

| Code | When |
|------|------|
| `item-player-load-failed` | The `pie-qti-item-player` element's module failed to load for an item. The item renders a localized alert instead; presenting the next item retries the load. |
| `toolkit-load-failed` | The assessment toolkit's element chunks failed to load for a tool bar. The bar renders nothing that session; remounting the bar retries the load. |
| `item-speech-extraction-failed` | The item's SSML could not be extracted. The item renders without read-aloud catalogs. |
| `readable-block-failed` | A passage, rubric, stimulus or feedback block failed preparation or sanitization. The block renders its fallback markup. |

Codes forwarded from the mounted item player (its `error` event, bridged to the section):

| Code | When |
|------|------|
| `item-load-failed` | The item XML failed to parse or the item failed to load inside the player. |
| `response-processing-failed` | Response processing threw at submit time. |
| `submission-failed` | The submission could not be recorded. |
| `render-failed` | Rendering the item body (or mounting an interaction) threw. |
| `response-dispatch-failed` | The session rejected a response change (e.g. an unknown response identifier). |

## Tool integration (`@pie-players`)

The section tool bar composes external tool packages from the sibling
[pie-players](https://github.com/pie-framework/pie-players) repository:

- `@pie-players/pie-assessment-toolkit` — generic tool framework (coordinator, registry),
- `@pie-players/pie-default-tool-loaders` — dynamic loaders for the bundled tools,
- `@pie-players/pie-tool-calculator-desmos` and `@pie-players/pie-tool-tts-inline` — the tools,
- `@pie-players/pie-players-shared` and `@pie-players/pie-i18n-generated` — the toolkit's interface
  catalogs.

These packages are pinned to **exact matching versions** because they inter-depend internally with
exact pins; upgrading requires bumping all of them in lockstep (toolkit registry classes must not
be loaded twice under different version strings). Packages only the default tool loaders import,
such as `pie-calculator-desmos` and `tts-client-server`, are not listed here:
`pie-default-tool-loaders` declares them itself.

### Tool bar interface locale

The toolkit renders its own chrome (tool names, read-aloud controls, tool panel controls) from its
own catalogs, not from the section's `I18nProvider`. The tool bar gives it the section's interface
locale through its `locale` attribute, plus a provider over those catalogs through its `i18n`
property. The provider is composed as pie-players documents for its two catalog tiers:
`loadBundledCatalog(locale).catch(() => loadGeneratedCatalog(locale))`
(`src/tools/toolkit-i18n.ts`).

- **English** is the bundled tier, `@pie-players/pie-players-shared`. It is statically resident,
  so an English tool bar fetches nothing.
- **Every other locale** comes from `@pie-players/pie-i18n-generated`: Dutch, Arabic, Spanish,
  French, Romanian, Thai, Chinese and the rest that package ships. The section player imports it
  only dynamically, the first time a tool bar needs a non-English locale. Each locale's catalog is
  a lazy chunk of its own, fetched only for a tool bar in that locale and shared by every tool bar
  on the page. Keep the import dynamic: a static import would put the tier's loader map in every
  bundle. `tests/tools/toolkit-i18n.test.ts` fails on a static one.
- **Regional tags** reach their language (`es-MX` → `es`, `nl-BE` → `nl-NL`). The toolkit stamps
  the `lang` of the catalog it renders, and the matching `dir`.
- **A locale neither tier ships** renders English under its own tag. So does the pseudo-locale
  `ar-XB`, which stays right-to-left instead of resolving to the Arabic catalog. The pseudo-locales
  never fetch a catalog.

The catalog loads before the toolkit renders, so a non-English tool bar does not appear in English
first. If the generated package cannot load, the tool bars render in English and the section player
warns once. `apps/demo/tests/playwright/section-toolkit-locale.pw.ts` covers English, Dutch, Arabic
and regional Spanish, and checks that an English page fetches no generated catalog.

### Packaged tools

The tool bars register four packaged tools: `textToSpeech`, `calculator`, `ruler` and
`protractor`. The ruler and protractor load through the loaders package's lazy module loaders when
they first render, so they add no dependency of their own. Each tool bar binds its toolkit to the
composition's `assessmentId` (the section identifier when there is none) with PNP enforcement on
and the candidate's PNP tool supports as the bound profile: a granted tool shows whatever the
toolkit's content check makes of the markup, a prohibited one is withdrawn. An item's companion
materials (`calculator`, `rule`, `protractor`) become the item scope's required tools.
Section-scoped tools render on the active item's tool bar, beside its own. The packaged
registrations keep the calculator, ruler and protractor off passage tool bars, which render
read-aloud.

### Text-to-speech endpoint

The default TTS tool configuration targets a host-served Polly endpoint at `/api/tts`
(`endpointMode: 'synthesizePath'`). Hosts must either serve that route or override
`sectionTools[].provider` when composing the section elements. Without it, TTS tool activations
fail at request time.

A `textToSpeech` tool's `provider` is the toolkit's own TTS provider configuration (`backend`,
`serverProvider`, `apiEndpoint`, `endpointMode`, `transportMode`, `defaultVoice` and so on),
applied over these defaults as given. The section player sets its `language` from the content
language and, for Polly, a `defaultVoice` for that language unless the provider names one.

## License

MIT
