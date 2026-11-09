# @pie-qti/section-player

QTI section renderer contracts and composition helpers for composing item players with shared
section context.

## What this package publishes

The npm package ships **headless TypeScript contracts and helpers** only:

- `ResolvedQtiSectionComposition` and the runtime-host contract (`.` entry),
- `resolveQtiSectionComposition()` — resolve an assessment test into section compositions; pass
  `assessmentId` and the candidate's `pnp`, which the composition carries to the layouts,
- role-view visibility helpers and PNP tool-support helpers (`applyToolSupports`,
  `companionMaterialsOf`, `companionToolIds`),
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

## Tool integration (`@pie-players`)

The section tool bar composes external tool packages from the sibling
[pie-players](https://github.com/pie-framework/pie-players) repository:

- `@pie-players/pie-assessment-toolkit` — generic tool framework (coordinator, registry),
- `@pie-players/pie-default-tool-loaders` — dynamic loaders for the bundled tools,
- `@pie-players/pie-tool-calculator-desmos` and `@pie-players/pie-tool-tts-inline` — the tools.

These packages are pinned to **exact matching versions** because they inter-depend internally with
exact pins; upgrading requires bumping all of them in lockstep (toolkit registry classes must not
be loaded twice under different version strings). `pie-calculator-desmos` and `tts-client-server`
are declared directly as well: the tool bar's Svelte sources, compiled into
`@pie-qti/player-elements`, reach them.

The tool bar gives the toolkit the section's interface locale through its `locale` attribute. The
toolkit stamps that locale's `lang` and `dir` and renders its own chrome (tool names, read-aloud
controls, tool panel controls) from its own catalogs, not from the section's `I18nProvider`. The
packages stay on `1.0.0-beta.7` for that reason: from `1.0.0-beta.9`,
`@pie-players/pie-players-shared` bundles only the English catalog and moves every other locale
to the optional `@pie-players/pie-i18n-generated` package, so a newer toolkit renders a Dutch (or
any non-English) interface in English. Upgrading means adding that package and passing the
toolkit an `i18n` provider whose catalog loader falls back to it;
`apps/demo/tests/playwright/section-toolkit-locale.pw.ts` fails until then.

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

## License

MIT
