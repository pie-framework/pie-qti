---
'@pie-qti/section-player': patch
'@pie-qti/player-elements': patch
---

Align the `@pie-players` family on 0.3.67 and migrate off the removed packaged-tool factory.

Merging the four `@pie-players` Dependabot bumps individually left the family straddling
three releases — 0.3.53, 0.3.65 and 0.3.66 — and those packages pin each other at exact
versions, so the tree carried parallel copies of five of them. `pie-context` was installed
twice, which means two independent context instances: a provider registered through one is
invisible to consumers of the other.

The stale 0.3.53 pin was load-bearing rather than merely untidy. `createPackagedToolRegistry`
was removed from `pie-assessment-toolkit` in 0.3.65, and `QtiToolButtonBar` still imported
it, so the build only worked because the duplicate 0.3.53 copy was still resolvable.

Upstream moved the concrete tool registrations out of the toolkit core into
`@pie-players/pie-default-tool-loaders`, which hard-depends on all eleven packaged tools and
whose `PACKAGED_TOOL_REGISTRATIONS` references every one statically. Importing its
`createPackagedToolRegistry` therefore pulled nine unused tool packages into the
`player-elements` bundle. Instead the two registrations this player actually uses are
imported individually and installed onto a `ToolRegistry` directly, with a two-entry tag map
standing in for the default the toolkit no longer ships. No unused tool chunks are emitted.

`player-elements` had a `sideEffects` entry of `./dist/tag-names-*.js` — a rolldown chunk
name derived from an upstream module, not a source filename. At 0.3.67 that code merges into
`./dist/define-*.js`, so the entry stopped resolving and the publish check failed; the entry
and the test asserting it now name the define chunk. The glob remains coupled to upstream
chunk naming and will need the same treatment on a future reshuffle.

Two `section-player` e2e assertions were checking a workaround rather than a behaviour. The
toolkit used to render a vendored `nds-icon-button` whose FontAwesome Pro glyph 404ed,
leaving a blank button that `QtiToolButtonBar` patched with an inline SVG. Those icons are
licensed to Renaissance products only, so PIE-785 made them opt-in behind `ndsIcons` in
0.3.59 and plain `<button>` the default. Our previous 0.3.53 pin predated that, so this
alignment crosses onto the intended default path: no `nds-icon-button` is rendered and the
fallback marker cannot appear. The assertions now check that the calculator button has a
visibly rendered icon, whichever layer drew it.
