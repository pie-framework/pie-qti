# @pie-qti/transform-core

The transformation engine for the PIE ↔ QTI transform framework: plugin and format registries, format detection, configuration loading, and the in-memory orchestration layer that runs transforms.

This package is the engine. For architecture and how-to documentation, see:

- [Transformation Engine architecture](../../docs/TRANSFORMATION-ENGINE.md)
- [Configuration guide](../../docs/CONFIGURATION.md) — config file schema, environment variables, plugin loading
- [Transformation guide](../../docs/PIE-QTI-TRANSFORMATION-GUIDE.md) — user-facing overview
- [Vendor plugin guide](../../docs/VENDOR-TRANSFORM-PLUGIN-GUIDE.md) — building vendor extensions

## Install

```bash
bun add @pie-qti/transform-core @pie-qti/transform-types
```

## Usage

```ts
import { TransformEngine } from '@pie-qti/transform-core';

const engine = new TransformEngine();

// Built-in QTI and PIE format detectors are registered automatically;
// plugins come from configuration or registration:
engine.use(myPlugin);

// Single-item transform: resolves to { pieConfig, warnings, errors, metadata }
const handle = await engine.transform(qtiXml, { sourceFormat: 'qti22', targetFormat: 'pie' });
const output = await handle.result();
```

`transformBatch()` requires a storage backend (pass one to the constructor):
`new TransformEngine(orchestrator?, storage?)`.

## What the package exports

- **Engine** — `TransformEngine` (`use`, `transform`, `transformBatch`)
- **Registries** — plugin registry and format-detector registry; built-in `qti-detector` and `pie-detector`
- **Configuration** — `loadFromFile`, `loadFromEnv`, `merge` (config loader), the plugin loader, and the vendor registry (subpath exports `./config/*`)
- **Validation** — `PieItemValidator`, `validatePieItemStructure` (see [VALIDATION.md](./VALIDATION.md))
- **Orchestration** — `InMemoryOrchestrator` plus the workflow/activity definitions transforms run on

Types live in [`@pie-qti/transform-types`](../types) and are re-exported from the root entry.

## Related packages

- [`@pie-qti/to-pie`](../to-pie) — QTI → PIE plugin
- [`@pie-qti/pie-to-qti2`](../pie-to-qti2) — PIE → QTI 2.2 plugin
- [`@pie-qti/storage`](../storage) — filesystem/S3/database storage backends
- [`@pie-qti/transform-cli`](../../tools/cli) — CLI driving this engine
