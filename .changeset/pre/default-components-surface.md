---
'@pie-qti/default-components': patch
---

Narrow the published surface and expose the shared global stylesheet:

- The deep wildcard exports `./plugins/*/index`, `./shared/utils/*`, `./shared/actions/*`, and `./shared/extensions/*` are removed. They had no consumers in the workspace and permanently froze internal file layout; import from the `.` or `./plugins` / `./shared` entries instead.
- The global light-DOM stylesheet that the build already emitted (shared `.sr-only` classes plus the KaTeX stylesheet/fonts used by the rich-text editor) was previously shipped in `dist/assets/` but reachable by no export. It is now published as a stable `@pie-qti/default-components/shared.css` entry (`"style"` condition) and documented in STYLING.md: import it only when hosting light-DOM shared components.
