---
"@pie-qti/transform-cli": patch
---

Remove the unused `@oclif/plugin-help` runtime dependency. `--help` is provided natively by
`@oclif/core`; the help plugin was never registered in the CLI's `oclif` config (`plugins` is
absent), so it was never loaded at runtime. Also removes the three `package.json` dev scripts
(`analyze-qti`, `discover-qti`, `batch-transform`) that required the undeclared `ts-node` package
and therefore never ran; the commands themselves are unchanged CLI subcommands
(`pie-transform analyze-qti`, `pie-transform discover-qti`, `pie-transform batch-transform`).
