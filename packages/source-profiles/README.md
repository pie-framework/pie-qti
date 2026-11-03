# @pie-qti/source-profiles

Source-profile detectors and extraction helpers for real-world QTI packages.

A *source profile* describes the shape of a family of authoring exports (element
naming, attribute conventions, packaging quirks) so `@pie-qti/to-pie` can parse
them without hard-coding vendor specifics. This package implements the
`QtiSourceProfile` interface from `@pie-qti/transform-types` and exports
detection/extraction logic plus the built-in profile set.

Consumers wire profiles into the transformation pipeline when constructing
`QtiToPiePlugin`; the package itself is a pure library with no runtime
dependencies beyond `@pie-qti/transform-types`.

## Status

Ships to npm but has no in-repo consumer yet: hosts wire `defaultSourceProfiles`
themselves (see `@pie-qti/to-pie`). Covered by its own unit tests.

## License

MIT
