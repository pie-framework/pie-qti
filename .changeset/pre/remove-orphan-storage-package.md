---
'@pie-qti/test-utils': patch
---

`@pie-qti/storage` has been removed from the repository and will not receive further releases. It had no consumers anywhere in the workspace (its only graph edge was an unused entry in `@pie-qti/test-utils`'s dependencies, now removed), shipped a bundler-hostile `sideEffects: false` flag contradicting its top-level registry side effects, and its S3 backend used dynamic-import escapes that nothing exercised. Existing npm installs of `@pie-qti/storage` keep working from their lockfiles; hosts needing the interfaces can find them in source history. `@pie-qti/test-utils` no longer declares a dependency on it — its mocks implement the `@pie-qti/transform-types` interfaces directly, as they always did.
