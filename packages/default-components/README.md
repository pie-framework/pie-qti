# @pie-qti/default-components

The standard QTI 2.x and 3.0 interaction implementations for `@pie-qti/item-player`, compiled to
custom elements. Importing `@pie-qti/default-components/plugins` registers them. Hosts that use the
default runtime load them through `@pie-qti/player-elements/register` instead of importing this
package directly.

## Loading from a CDN

`@pie-qti/default-components/plugins` is an ES module that imports other `@pie-qti/*` packages by
bare name, so a CDN serving the raw file cannot run it on its own. Use a bundler, an import map, or
jsDelivr's `/+esm` endpoint, which rewrites bare imports. For a page without a build step, use
[`@pie-qti/player-elements`](../player-elements/README.md): its `register` entry is self-contained.
