# Vendor Transform Plugin Developer Guide

This guide covers the supported ways to extend the transformation pipeline for
proprietary content: the **five vendor hooks** on `QtiToPiePlugin`, and the
lower-level **wrapper `TransformPlugin`** path.

> [!NOTE]
> For package-aware QTI → PIE imports, prefer source profiles for source detection, metadata extraction, sidecars, diagnostics, and composable item handling. See [QTI Source Profiles](./SOURCE-PROFILES.md). Full vendor plugins are a lower-level escape hatch for independent formats or cases that truly need to replace the generic pipeline. Host policy such as CDN/S3 URLs, private standards crosswalks, and publish destinations belongs in the host application, not in reusable `pie-qti` source profiles.

## Choosing an extension path

| Path | Use when | Documented |
|------|----------|------------|
| **Source profiles** | A known source/vintage of QTI that needs per-item handling with delegation back to built-in transforms, package sidecars, fallback policy, and a conversion trace | [SOURCE-PROFILES.md](./SOURCE-PROFILES.md) |
| **Vendor hooks** (this guide) | A distinct vendor's QTI dialect you want detected at runtime: replace the whole item transform, capture vendor CSS classes, extract vendor metadata | Here |
| **Wrapper plugin** | An independent format (not QTI), or taking over the entire pipeline for a format pair | Here and [TRANSFORMATION-ENGINE.md](./TRANSFORMATION-ENGINE.md) |
| **Player-side extractors** | Custom rendering/response extraction for a PIE element at delivery time (not a transform concern) | [`packages/item-player/docs/custom-extractors.md`](../packages/item-player/docs/custom-extractors.md) — `packages/acme-likert-plugin` is the worked example |

Rationale and acceptance criteria for the hook system live in the
[vendor-extensions PRD](./prds/architecture/vendor-extensions.md).

---

## Quick start: the five vendor hooks

The QTI → PIE plugin (`QtiToPiePlugin` from `@pie-qti/to-pie`) accepts five
hook lists, one interface each, all defined in `@pie-qti/transform-types`
(`packages/types/src/transform/vendor-extensions.ts`):

| Hook | Interface | Fires |
|------|-----------|-------|
| Detector | `VendorDetector` | First, per item — identifies the vendor |
| Transformer | `VendorTransformer` | Whole-item replacement when a detector matched |
| CSS class extractor | `CssClassExtractor` | After the standard transform, when a vendor matched |
| Metadata extractor | `MetadataExtractor` | After the standard transform, vendor-matched or standard |
| Asset resolver | `AssetResolver` | Never automatically — host-driven (see below) |

Register them as constructor options or via `register*` methods:

```typescript
import { TransformEngine } from '@pie-qti/transform-core';
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import { createAcmeExtensions } from '@pie-qti/demo-vendor-extensions';

const acme = createAcmeExtensions();

const engine = new TransformEngine();
engine.use(new QtiToPiePlugin({
  vendorDetectors: [acme.detector],
  vendorTransformers: [acme.transformer],
  assetResolvers: [acme.assetResolver],
  cssClassExtractors: [acme.cssExtractor],
  metadataExtractors: [acme.metadataExtractor],
}));
```

`@pie-qti/demo-vendor-extensions` (`packages/demo-vendor-extensions/`) is the
reference implementation: one small file per hook, all implementing the
contracts from `@pie-qti/transform-types`. Copy from it when writing your own.

---

## The five hooks in detail

### 1. `VendorDetector` — identify the vendor

```typescript
export interface VendorDetector {
  name: string;
  detect(qtiXml: string, parsedDoc: HTMLElement): VendorInfo | null;
}

export interface VendorInfo {
  vendor: string;
  confidence: number;   // 0..1 — a detection below 0.6 is ignored
  version?: string;
  metadata?: Record<string, any>;
}
```

Detection strategies that work well, in order of reliability:

1. **Namespace** — the vendor's extension namespace is present
   (`xmlns:acme="http://acme.com/qti/extensions"`).
2. **Signature markup** — vendor attributes/classes/elements
   (`data-vendor="acme"`, `class="acme-interaction"`). Require multiple
   matches before claiming high confidence.
3. **Metadata** — vendor fields in QTI metadata or `qti-metadata-field`
   elements.
4. **Input hints** — `TransformInput.metadata` (set by the calling host) or
   `TransformContext.vendor` — useful when the vendor is known outside the
   content.

The demo detector (`packages/demo-vendor-extensions/src/acme-vendor-detector.ts`)
checks the namespace, the vendor attribute, and generator metadata, and scales
`confidence` with how many signals matched.

### 2. `VendorTransformer` — replace the whole item transform

```typescript
export interface VendorTransformer {
  vendor: string;
  canHandle(qtiXml: string, vendorInfo: VendorInfo, parsedDoc: HTMLElement): boolean;
  transform(
    qtiXml: string,
    vendorInfo: VendorInfo,
    context: TransformContext,
    parsedDoc: HTMLElement
  ): Promise<TransformOutput>;
}
```

Per item, when a detector matched with confidence ≥ 0.6, the **first**
transformer whose `vendor` equals the detected vendor and whose `canHandle`
returns true runs instead of the standard pipeline; its `TransformOutput` is
the item's result. If it throws, the plugin logs a warning and falls back to
the standard transform — a broken vendor transformer degrades, it does not
fail the item.

Return a standard `TransformOutput` (same shape the plugin itself returns —
see [TRANSFORMATION-ENGINE.md](./TRANSFORMATION-ENGINE.md#output-structure)):
`items` with PIE models as `content`, plus the metadata fields you want on
the record. The demo transformer
(`acme-slider-transformer.ts`) shows the minimal scaffolding for one vendor
interaction type.

### 3. `CssClassExtractor` — capture vendor classes

```typescript
export interface CssClassExtractor {
  vendor: string;
  extract(element: HTMLElement): VendorClasses;
}

export interface VendorClasses {
  behavioral: string[]; // change interaction behavior
  styling: string[];    // pure presentation
  semantic: string[];   // carry meaning (labels, roles)
  unknown: string[];    // unrecognized — keep for diagnostics
}
```

Runs only when a vendor was detected, against the extractor whose `vendor`
matches. Results land in `pieItem.metadata.vendorExtensions.cssClasses`, so
hosts can decide what to do with each category rather than the transform
guessing. The demo extractor
(`acme-css-extractor.ts`) categorizes by prefix conventions and puts
everything unrecognized into `unknown`.

### 4. `MetadataExtractor` — extract vendor metadata

```typescript
export interface MetadataExtractor {
  vendor: string;
  extract(qtiXml: string, parsedDoc: HTMLElement, vendorInfo: VendorInfo): Record<string, any>;
}
```

After the standard transform, the plugin picks the extractor whose `vendor`
matches the detected vendor — otherwise the built-in
`StandardMetadataExtractor` (`vendor: 'standard'`, registered by default,
which maps standard LOM/QTI metadata). The returned record's
`extractedMetadata.extensions` merge into `pieItem.extensions`; if no
extractor matches at all, the plugin falls back to its generic
`extractExtensions()` pass.

The demo extractor (`acme-metadata-extractor.ts`) pulls difficulty,
item-bank id, authoring tool, and subject/standards fields. For richer
metadata needs (LOM taxonomies, standards crosswalks), see the LOM guide:
[LOM_techguide.md](./LOM_techguide.md).

### 5. `AssetResolver` — a host-driven contract

```typescript
export interface AssetResolver {
  name: string;
  canResolve(assetType: string, assetUrl: string): boolean;
  resolve(
    assetType: 'stylesheet' | 'html' | 'audio' | 'image' | 'video' | string,
    assetUrl: string,
    baseDir: string
  ): Promise<ResolvedAsset>;
}

export interface ResolvedAsset {
  url: string;
  content?: string;
  buffer?: Buffer;
  mimeType?: string;
  filePath?: string;
}
```

**Important:** unlike the other four hooks, the transform pipeline does not
invoke asset resolvers on its own. Asset URLs pass through the transform as
authored — a stylesheet `href` arrives in `config.resources.stylesheets[]`
exactly as the conversion received it. The hook exists so your host code can
drive resolution explicitly with the exported helper:

```typescript
import { resolveAssetWithHooks } from '@pie-qti/to-pie';

const resolved = await resolveAssetWithHooks(assetResolvers, 'image', 'acme://img/1.png', baseDir);
```

Two workable host patterns:

- **Rewrite before transforming** — resolve package-relative or proprietary
  URLs to durable references in your ingestion step, and the transform
  carries the final URLs through.
- **Resolve after transforming** — walk the produced PIE models and call
  `resolveAssetWithHooks` (or your own chain) for each vendor URL, then patch
  the content.

The demo resolver (`acme-asset-resolver.ts`) is a no-op that logs
resolution attempts — use it as the wiring example, not as production code.

---

## Config-driven registration

For hosts that assemble plugins from configuration rather than code, the
hooks also have a module-spec form (`VendorExtensionConfig`, keys
`detectors`/`transformers`/`assetResolvers`/`cssClassExtractors`/
`metadataExtractors`, each entry `{ module, export?, options? }`), loaded
dynamically by `@pie-qti/transform-core`'s vendor registry
(`config/vendor-registry.js`). See
[CONFIGURATION.md](./CONFIGURATION.md) for the config file and environment
variables around it.

---

## Wrapper plugins (the `TransformPlugin` path)

For an independent format (not QTI), or to replace the whole pipeline for a
format pair, implement `TransformPlugin` from `@pie-qti/transform-types` and
register it on the engine. The full interface — including the optional
`initialize`/`validate`/`dispose` lifecycle methods and the
`TransformOutput` contract — is specified in
[TRANSFORMATION-ENGINE.md](./TRANSFORMATION-ENGINE.md#plugin-system).

**How the engine selects plugins — read this before relying on `canHandle`:**

> The engine picks the plugin for a `(sourceFormat, targetFormat)` pair by
> **priority order alone**: it filters the registry to that exact pair, sorts
> by `priority` (highest first, default 100), and transforms with the first
> candidate. **`canHandle()` is not consulted by the engine.** It exists for
> your own consumers and tests (`PluginRegistry.findCompatiblePlugins` calls
> it) — the engine path never does.

Consequences:

- A wrapper plugin registered at a higher priority than `QtiToPiePlugin` for
  the `qti22` → `pie` pair takes over **all** traffic for that pair, not just
  "its" vendor's content. Build the vendor decision *inside* `transform()`
  (delegate to `QtiToPiePlugin` for content you don't handle), exactly as the
  detection strategies above suggest — just invoked from `transform()`, not
  `canHandle()`.
- If you need two behaviors for the same pair, split them by making the
  delegate decision inside one plugin, or use the vendor hooks instead —
  that is what they are for.
- Duplicate plugin `id`s throw on registration (`engine.use()`).

For vendor content on the QTI → PIE side, prefer the hooks; the wrapper path
earns its complexity for genuinely independent formats.

---

## Configuration

Vendor plugin options are plain constructor values — the framework config
loader handles only the framework's own `TransformConfig`. Load framework
config from env/file, and your own options from your own environment:

```typescript
import {
  loadFromEnv,
  loadFromFile,
  merge,
} from '@pie-qti/transform-core/config/config-loader.js';

// Framework config: env vars first (PIE_QTI_STORAGE_BACKEND, PIE_QTI_LOG_LEVEL, ...)
const frameworkConfig = merge(
  loadFromEnv(),
  process.env.ACME_CONFIG_PATH ? await loadFromFile(process.env.ACME_CONFIG_PATH) : {}
);

// Vendor options: your own environment variables
const vendorOptions = {
  vendorId: process.env.ACME_VENDOR_ID ?? 'acme',
  cdnBaseUrl: process.env.ACME_CDN_URL,
  assetUrlExpiration: Number(process.env.ACME_URL_TTL ?? 3600),
};

const engine = new TransformEngine();
engine.use(new QtiToPiePlugin({ /* hooks wired with vendorOptions */ }));
```

Keep secrets in environment variables or your secret manager; never log them
(sanitize before logging config objects), and never bake them into config
files that travel with the content.

---

## Testing

`@pie-qti/test-utils` provides the shared helpers:

| Export | Purpose |
|--------|---------|
| `createQtiWrapper(content, identifier?, title?)` | Wraps a body fragment in a full QTI 2.2 `assessmentItem` XML string |
| `createResponseDeclaration(...)` / `createChoiceInteraction(...)` | QTI snippet builders |
| `expectValidPieModel(model)` | Asserts basic PIE model structure (`id`, `element`) |
| `expectSuccessfulTransform(result, expectedItemCount?)` | Asserts a plugin-level `TransformOutput` (items + metadata fields) |
| `MockTransformPlugin` / `createMockPlugin(...)` | Scriptable `TransformPlugin` stand-ins |
| `MockStorageBackend` | In-memory `StorageBackend` for batch-transform tests |
| `SilentLogger` | Noise-free logger for `TransformContext` |

**Unit-test the plugin, not the engine.** Call `transform()` directly — this
exercises exactly the contract your code implements:

```typescript
import { describe, test, expect } from 'bun:test';
import { parse } from 'node-html-parser';
import { QtiToPiePlugin } from '@pie-qti/to-pie';
import { createAcmeExtensions } from '@pie-qti/demo-vendor-extensions';
import {
  createQtiWrapper,
  expectSuccessfulTransform,
  expectValidPieModel,
  SilentLogger,
} from '@pie-qti/test-utils';

const acme = createAcmeExtensions();
const plugin = new QtiToPiePlugin({
  vendorDetectors: [acme.detector],
  vendorTransformers: [acme.transformer],
});

describe('Acme vendor hooks', () => {
  test('detector recognizes Acme-marked content', () => {
    const qti = createQtiWrapper(
      '<itemBody data-vendor="acme"><p>Test</p></itemBody>',
      'acme-001'
    );
    const info = acme.detector.detect(qti, parse(qti));
    expect(info?.vendor).toBe('acme');
    expect(info?.confidence).toBeGreaterThanOrEqual(0.6);
  });

  test('standard content converts through the standard pipeline', async () => {
    const qti = createQtiWrapper('<itemBody><p>Standard QTI</p></itemBody>');
    const result = await plugin.transform(
      { content: qti },
      { logger: new SilentLogger() }
    );
    expectSuccessfulTransform(result, 1);
    expectValidPieModel(result.items[0].content);
  });
});
```

**Engine-level tests** go through the `WorkflowHandle`; the awaited result is
the single-item workflow output `{ pieConfig, warnings, errors, metadata }`,
where `errors` is a `string[]`:

```typescript
const handle = await engine.transform(qtiXml, { targetFormat: 'pie' });
const result = await handle.result();

expect(result.errors).toHaveLength(0);
expect(result.pieConfig).toBeDefined();
expect(result.metadata.sourceFormat).toBe('qti22');
```

For lossless round-trip coverage, use the PIE source sidecar: QTI items
carry `<item>.pie.json` sidecars and `extractPieExtension` (from
`@pie-qti/to-pie`) round-trips the original PIE data — see
[PIE-QTI-TRANSFORMATION-GUIDE.md](./PIE-QTI-TRANSFORMATION-GUIDE.md).

---

## Deployment

Open-source plugin package:

```json
{
  "name": "@vendor-acme/qti-transform-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "peerDependencies": {
    "@pie-qti/transform-core": "^1.0.0-beta.5",
    "@pie-qti/transform-types": "^1.0.0-beta.5"
  }
}
```

For proprietary plugins, keep the package private (`"private": true` or an
internal registry in `publishConfig`); the contract is the same. Depend on
`@pie-qti/to-pie` too when you wrap or extend `QtiToPiePlugin`.

---

## Related

- [TRANSFORMATION-ENGINE.md](./TRANSFORMATION-ENGINE.md) — engine architecture, plugin
  selection, result shapes
- [SOURCE-PROFILES.md](./SOURCE-PROFILES.md) — the preferred surface for package-aware
  QTI → PIE imports
- [CONFIGURATION.md](./CONFIGURATION.md) — config files, env vars, plugin loading
- [vendor-extensions PRD](./prds/architecture/vendor-extensions.md) — rationale and
  acceptance criteria for the hook system
- Contracts: `packages/types/src/transform/vendor-extensions.ts`, `packages/types/src/transform/plugin.ts`
- Reference implementation: `packages/demo-vendor-extensions/`
