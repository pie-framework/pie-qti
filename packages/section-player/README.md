# @pie-qti/section-player

QTI section renderer contracts and composition helpers for composing item players with shared
section context.

## What this package publishes

The npm package ships **headless TypeScript contracts and helpers** only:

- `ResolvedQtiSectionComposition` and the runtime-host contract (`.` entry),
- `resolveQtiSectionComposition()` — resolve an assessment test into section compositions,
- role-view visibility helpers and PNP tool-support helpers (`applyToolSupports`,
  `companionMaterialsOf`).

## Build model: where the UI lives

The Svelte renderers under `src/components/` are **not compiled into this package's dist**. They are
consumed as source by `@pie-qti/player-elements`, whose vite build compiles them into its
self-contained custom-element bundle (`pie-qti-section-player-splitpane` /
`pie-qti-section-player-vertical`). The npm artifact you install here is contracts-only by design;
see the [player-elements build model](../player-elements/README.md#build-model-this-package-ships-the-compiled-ui).

## Tool integration (`@pie-players`)

The section tool bar composes external tool packages from the sibling
[pie-players](https://github.com/pie-framework/pie-players) repository:

- `@pie-players/pie-assessment-toolkit` — generic tool framework (coordinator, registry),
- `@pie-players/pie-default-tool-loaders` — dynamic loaders for the bundled tools,
- `@pie-players/pie-tool-calculator-desmos` and `@pie-players/pie-tool-tts-inline` — the tools.

These packages are pinned to **exact matching versions** because they inter-depend internally with
exact pins; upgrading requires bumping all of them in lockstep (toolkit registry classes must not
be loaded twice under different version strings). Two of the toolkit's transitive tools
(`pie-calculator-desmos`, `tts-client-server`) resolve transitively and are intentionally not
declared directly.

### Text-to-speech endpoint

The default TTS tool configuration targets a host-served Polly endpoint at `/api/tts`
(`endpointMode: 'synthesizePath'`). Hosts must either serve that route or override
`sectionTools[].provider` when composing the section elements. Without it, TTS tool activations
fail at request time.

## License

MIT
