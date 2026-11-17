# @pie-qti/transform-types

Shared type contracts for the pie-qti transformation framework: transform
plugin and engine types, vendor extension hooks, source profiles and digests,
PIE/LOM models, orchestration contracts, config types, and the `StorageBackend`
storage abstraction.

No concrete storage backends ship in this repository — hosts implement
`StorageBackend` (from `src/storage/index.ts`) against their own infrastructure
and pass it to `TransformEngine` (see `@pie-qti/transform-core`). A test mock is
available in `@pie-qti/test-utils`.

This package is types-only; it has no runtime behavior. It is consumed by
`@pie-qti/transform-core` (engine + registries), `@pie-qti/to-pie`,
`@pie-qti/pie-to-qti2`, and vendor transform plugins.

## Docs

- Engine and plugin architecture: [`docs/TRANSFORMATION-ENGINE.md`](../../docs/TRANSFORMATION-ENGINE.md)
- Vendor plugin authoring: [`docs/VENDOR-TRANSFORM-PLUGIN-GUIDE.md`](../../docs/VENDOR-TRANSFORM-PLUGIN-GUIDE.md)
- Source profiles: [`docs/SOURCE-PROFILES.md`](../../docs/SOURCE-PROFILES.md)
- Configuration: [`docs/CONFIGURATION.md`](../../docs/CONFIGURATION.md)
