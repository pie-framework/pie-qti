# PRD: Transform CLI

<!--
  Status: current
  Type: system
  Packages: @pie-qti/transform-cli
  Last reviewed: 2026-04-27
-->

**Status:** current  
**Type:** system  
**Packages:** `@pie-qti/transform-cli`  
**Last reviewed:** 2026-04-27

> **Note:** This package is under active development. The command interface and output formats described here reflect the current implementation but may change without a major version bump until the package reaches 1.0.

---

## Summary

`@pie-qti/transform-cli` is a Node.js command-line tool that exposes the PIE-QTI transform engine as a set of shell commands. It covers four use cases: transforming a single QTI XML item to PIE JSON (or vice versa), analyzing the composition of a QTI content package, batch-transforming entire directories or ZIP archives, and discovering the detailed structure of an IMS Content Package. The CLI is built on oclif and extends a shared `BaseCommand` that handles config file loading and plugin registration uniformly across all commands. The primary audiences are CI/CD pipelines automating item-bank migrations, content engineers auditing QTI packages received from vendors, and framework developers iterating on transform logic from the command line.

---

## Background and rationale

### CI/CD automation use case

Item-bank migrations — moving thousands of QTI items to PIE format for a new delivery platform — cannot be done item-by-item in a web UI. The CLI provides a single invocable command (`batch-transform`) that can run unattended in a pipeline, receive a directory or ZIP of QTI packages, and emit a directory of PIE JSON files along with a machine-readable summary report. Exit codes follow POSIX conventions so that pipeline stages can gate on success or failure counts.

### Item-bank migration use case

Before committing to a migration, a content team needs to understand what interaction types are in a package, how many items will transform without errors, and which items use passage patterns that require manual review. The `analyze` and `discover-qti` commands address this: `analyze` produces an aggregate summary across all packages in a directory (interaction type inventory, passage pattern counts, issues list), while `discover-qti` provides deep structural detail on a single package (manifest resources, per-item dependency graph, media asset inventory).

### Local developer tooling use case

Engineers extending the transform engine — adding a new interaction type handler, debugging response-processing conversion, or testing a vendor-specific QTI extension — need a fast feedback loop without starting the full web application. The `transform` command takes a single XML file and writes PIE JSON to stdout or a file in one step. The `--pretty` flag makes the output human-readable for inspection. The `--silent` flag suppresses logs so that stdout contains only the JSON payload, suitable for piping to `jq` or diffing.

### Why no global install yet

At `0.1.x` the CLI's command interface, output schemas, and config format are still evolving. Publishing to npm for global install would create a stable-looking artifact for a moving target. The current invocation via `bun run pie-qti --` keeps the CLI tied to the monorepo build and avoids semver pressures during early development. Global install via `npm install -g @pie-qti/transform-cli` is the intended end state, gated on a stable 1.0 release.

---

## Functional requirements

- **FR-1:** The `transform <input>` command must read a single file, transform it using the specified format direction, and write the result either to a file path (via `--output`) or to stdout.
- **FR-2:** The `transform` command must accept `--format <source>:<target>` (default `qti22:pie`) and validate that the format string contains exactly one `:` separator.
- **FR-3:** When `--pretty` is passed, `transform` must produce indented JSON (two-space indent). Without it, the output must be compact (no whitespace between tokens).
- **FR-4:** When `--silent` is passed, `transform` must suppress all log output; only the JSON result (or nothing, if `--output` is specified) goes to stdout.
- **FR-5:** The `analyze <path>` command must accept a directory or a ZIP file, discover all QTI packages within it (recursing into subdirectories to find `imsmanifest.xml`), and print an aggregated summary to stdout. The summary must include: package count, total item count, total passage count, interaction type inventory (with supported/unsupported markers), passage pattern breakdown, and any parse errors encountered.
- **FR-6:** When `--output <file>` is passed to `analyze`, it must write a detailed Markdown report (one section per package) to the specified file path in addition to printing the summary to stdout.
- **FR-7:** When `--no-recursive` is passed to `analyze`, it must treat the input path as a single package and not recurse into subdirectories looking for nested packages.
- **FR-8:** The `batch-transform <inputs...>` command must accept one or more paths (directories or ZIP files), discover all QTI packages within them, and transform every `assessmentItem`, `assessmentTest`, and `assessmentPassage`/`assessmentStimulus` found. Input ZIPs must be extracted to a temporary directory before scanning.
- **FR-9:** `batch-transform` must write transformed items under `<outputDir>/<packageName>/items/`, assessments under `<outputDir>/<packageName>/assessments/`, and passages under `<outputDir>/<packageName>/passages/`.
- **FR-10:** When `--generate-report` is set (default true), `batch-transform` must write a `transformation-report.json` file to the output directory containing counts of successful and failed transforms, per-package results, and the list of files that failed with their error messages.
- **FR-11:** `batch-transform` must continue processing remaining items when a single item transform fails; it must not abort the entire job. Failed items must be recorded in the report rather than causing a non-zero exit code, unless all items fail.
- **FR-12:** When `--extract-nested-zips` is set (default true), `batch-transform` and `analyze` must recursively extract ZIP files found inside the initial extraction directory.
- **FR-13:** When `--cleanup-temp` is set (default true on both commands), all files extracted to the temporary directory must be deleted after the command completes (whether it succeeds or fails).
- **FR-14:** When `--load-passage-content` is set on `batch-transform`, `<object type="text/html">` references inside item XML must be resolved relative to the package directory and the referenced file content inlined before transformation.
- **FR-15:** When `--copy-media-assets` is set on `batch-transform`, image, audio, and video files found in the input packages must be copied to `<outputDir>/images/`, `<outputDir>/audio/`, and `<outputDir>/video/` respectively. Duplicate filenames (same basename) must be skipped after the first copy.
- **FR-16:** The `discover-qti <input>` command must accept a directory or ZIP file, parse its manifest (if present) or fall back to XML scanning, and emit a structured JSON document describing the package: file inventory, manifest summary, per-item interaction types and dependencies, per-passage inventory, per-test item counts, and media asset lists.
- **FR-17:** When `--output <file>` is passed to `discover-qti`, the JSON must be written to the file; otherwise it must be written to stdout.
- **FR-18:** All commands must accept `--config <path>` (or the `PIE_QTI_CONFIG` environment variable) and use the specified JSON config to load additional transform plugins and format detectors into the engine before running.
- **FR-19:** The CLI binary (`pie-transform`) must print help text for all commands when invoked with `--help` or with no arguments, including flag descriptions and examples.

---

## Non-functional requirements

- **Performance:** `batch-transform` uses a configurable `--max-parallel` concurrency limit (default 10). Note: the current implementation serializes package processing in a sequential `for` loop; the `maxParallel` option is wired but not yet applied to per-item concurrency. For large content banks (>1,000 items), the temporary extraction and sequential transform loop is the primary bottleneck. The `analyze` command uses synchronous `fs.readFileSync` throughout; for packages with hundreds of items this is acceptable in a CLI context but would not be appropriate in a server context.
- **Error handling:** Parse failures on individual XML files must be caught and accumulated, not thrown. The final summary must always be printed, and the temp directory must always be cleaned up, even after errors (the `try/finally` structure in `BatchTransformer.transform()` enforces this). The `transform` command exits non-zero on any error; `batch-transform` exits non-zero only when all items fail.
- **Security:** The CLI reads files from the local filesystem only. ZIP extraction uses `extractZipToDirSafe` from `@pie-qti/ims-cp-node`, which must prevent path-traversal attacks (entries with `..` components in their paths must be rejected). The CLI does not start any network listeners or make outbound network requests.
- **Node.js version:** Requires Node.js >=20.19.0 per `engines` in package.json. ESM-only output (the package is `"type": "module"`).
- **Stability:** At version `0.1.x` the CLI is under active development. Command names, flag names, and output formats are not yet considered stable. Callers in CI pipelines should pin to a specific version and review the changelog on upgrade.

---

## Design decisions

### oclif over minimist / yargs / commander

**Decision:** The CLI is built on oclif (`@oclif/core` ^4.0.0).

**Rationale:** oclif provides: automatic help generation from static metadata (`description`, `examples`, `flags`, `args`), typed flag parsing with built-in validation (required, default, `allowNo` for boolean flags), an oclif manifest that enables command discovery by scanning `dist/commands` without explicit registration, and a plugin system for future CLI-level extensions. The TypeScript class model (commands as `Command` subclasses) aligns naturally with the `BaseCommand` pattern used for shared config loading. oclif's `--help` output is well-formatted and includes examples without manual formatting.

**Alternatives considered:**
- `commander`: lighter, but requires manual help formatting and has no manifest or plugin system.
- `yargs`: similar weight to oclif, but builder API is callback-based and less idiomatic with TypeScript classes.
- `minimist` / hand-rolled: minimal overhead but no type safety on flags, no auto-help, and significantly more boilerplate per command.

**Consequences:** oclif adds non-trivial dependency weight (~600 KB unpacked for `@oclif/core`). The `prepack` script must run `oclif manifest` to generate `oclif.manifest.json`; forgetting this step produces a CLI where `--help` shows no commands. The manifest file must be committed or generated at build time.

---

### BaseCommand for shared config loading

**Decision:** All commands that use the transform engine extend `BaseCommand` (which extends oclif's `Command`). `BaseCommand` exposes `createEngine(configPath?)`, which loads config from the `--config` flag or `PIE_QTI_CONFIG` env var, registers plugins and format detectors, and returns a fully-configured `TransformEngine`.

**Rationale:** Every transform-capable command (currently `transform`; eventually `batch-transform` if migrated) needs the same initialization sequence: read env config, merge file config, register plugins, register format detectors. Centralizing this in `BaseCommand` ensures it cannot be partially omitted by a new command author, and ensures every command respects both the flag and the env-var config path.

**Alternatives considered:**
- A standalone `createEngine()` utility function imported by each command: achieves the same result but requires every command to remember to call it rather than inheriting the behavior.
- Config loaded at CLI startup and shared via oclif config: oclif's `config` object is for CLI-level settings (bin name, plugin list), not for domain configuration. Mixing them would be confusing.

**Consequences:** Commands that do not use the transform engine (`analyze`, `discover-qti`) currently extend oclif's `Command` directly rather than `BaseCommand`, because they do not call `createEngine()`. If these commands are later extended to support config-driven plugins (e.g., a custom passage detector), they should be migrated to `BaseCommand`.

---

### Same plugin system as the transform engine

**Decision:** CLI plugins are transform engine plugins loaded from the config JSON's `plugins` field. There is no CLI-specific plugin API.

**Rationale:** The transform engine's plugin system (`loadAndRegisterPlugins`, `loadFormatDetectors`) already provides the extension mechanism needed: register custom `TransformPlugin` implementations that handle additional interaction types or vendor-specific QTI extensions. Reusing this system means plugins are shared across host applications and the CLI with no additional wrapping. There is no need to design a separate CLI plugin contract.

**Alternatives considered:**
- oclif's own plugin system (CLI plugins as npm packages that add commands): appropriate for adding new CLI commands, not for adding transform logic. The two concerns are orthogonal.
- A CLI-specific `ICliPlugin` interface: unnecessary layering that would require plugin authors to implement two separate interfaces.

**Consequences:** CLI plugins must be CommonJS/ESM modules resolvable from the path where the CLI is invoked. The config JSON's `plugins` field must use resolvable module paths. This is straightforward in a monorepo context but requires care in globally-installed deployments where the working directory may not have the plugin packages installed.

---

### `--manifest` flag on batch-transform for IMS CP output (planned)

**Decision:** Generating an IMS Content Package manifest is an optional post-processing step controlled by a `--manifest` flag on `batch-transform`, not the default behavior.

**Rationale:** Most `pie:qti22` batch transforms are producing QTI XML for internal consumption or for import into a specific LMS that does not require a standards-compliant manifest. Generating a manifest adds complexity (resource enumeration, dependency declaration, XML serialization) and is only needed when the output must be a compliant IMS Content Package. Making it a flag makes the default simpler and avoids generating a potentially-wrong manifest for consumers who will ignore it.

**Alternatives considered:**
- Always generate a manifest: forces consumers who do not need it to parse and discard it; adds latency.
- Manifest generation as a separate `package` command: more composable but requires users to run two commands for what is logically one workflow.

**Consequences:** The `--manifest` flag is documented in the README but is not yet implemented in the current `BatchTransform` command (the oclif command delegates to `BatchTransformer` which does not have manifest generation wired). This is a known gap for the `pie:qti22` direction. The flag is reserved in the public interface.

---

## Extension points

| Extension point | Interface/type | How to use | Example |
|----------------|----------------|------------|---------|
| Custom transform plugin | `TransformPlugin` from `@pie-qti/transform-core` | Implement `TransformPlugin`; list module path in config JSON `plugins` field | Add a vendor-specific `customInteraction` handler |
| Custom format detector | `FormatDetector` from `@pie-qti/transform-core` | Implement `FormatDetector`; list module path in config JSON `formatDetectors` field | Detect proprietary QTI dialects by namespace URI |
| Config file | JSON matching `TransformConfig` schema | Pass via `--config <path>` or `PIE_QTI_CONFIG` env var | Per-project config checked in to the repo root |
| Additional oclif commands | oclif `Command` subclass | Not supported in the current release; oclif's plugin system would enable this in a future version | Add a `validate` command via a CLI plugin package |

---

## Data model / contracts

### Config JSON schema

The config JSON loaded via `--config` or `PIE_QTI_CONFIG` must satisfy the `TransformConfig` type from `@pie-qti/transform-types`. The two CLI-relevant fields are:

```jsonc
{
  "plugins": {
    // keyed by sourceFormat, then targetFormat
    "qti22": {
      "pie": "./path/to/custom-plugin.js"
    }
  },
  "formatDetectors": [
    "./path/to/my-detector.js"
  ]
}
```

Module paths in `plugins` and `formatDetectors` must be resolvable via `import()` from the process's working directory.

### `BatchTransformResult` (output of `--generate-report`)

Written to `<outputDir>/transformation-report.json`. Key fields (from `batch-transform.ts`):

```typescript
interface BatchTransformResult {
  totalPackages: number;
  totalItems: number;
  totalAssessments: number;
  totalPassages: number;
  successfulTransforms: number;
  failedTransforms: number;
  errors: Array<{ file: string; error: string; packagePath: string }>;
  outputDir: string;
  duration: number; // milliseconds
  packages: PackageResult[];
}

interface PackageResult {
  packagePath: string;
  packageName: string;
  hasManifest: boolean;
  itemsTransformed: number;
  assessmentsTransformed: number;
  passagesTransformed: number;
  errors: string[]; // file paths that failed
  mediaAssets: { images: number; audio: number; video: number };
}
```

`failedTransforms` counts files that threw during transformation. `errors[].error` is currently hardcoded to `"Transformation failed"` (the actual error message is not propagated from `BatchTransformer`); this is a known gap.

### `DiscoveryResult` (output of `discover-qti`)

Emitted as JSON to stdout or `--output`. Defined in `tools/cli/src/commands/discover-qti.ts`. Key invariant: when a manifest is present, `items`, `passages`, and `tests` arrays are populated from manifest resource entries. When no manifest is present, `items` and `passages` are populated by scanning all XML files for `assessmentItem` and `assessmentStimulus` root elements. `tests` will be empty in the no-manifest path.

### `AnalysisResult` (internal; summary printed to stdout)

Defined in `tools/cli/src/commands/analyze-qti.ts`. Not serialized to JSON by the `analyze` command (the `--json` flag in the README is not yet implemented in the current oclif command; the command only accepts `--output` for a Markdown report). The stdout summary format is plain text, not machine-parseable.

---

## Acceptance criteria

### Functional

**AC-1: Single item transform to file**
```
Given: A valid QTI 2.2 XML file at ./item.xml
  and the CLI is run from the monorepo root
When: bun run pie-qti -- transform ./item.xml --format qti22:pie --output ./out.json --pretty
Then: ./out.json is created and contains valid JSON
  and the JSON is formatted with two-space indentation
  and the process exits with code 0
  and stdout contains "Transformed 1 item(s) to ./out.json"
```

**AC-2: Single item transform to stdout**
```
Given: A valid QTI 2.2 XML file at ./item.xml
When: bun run pie-qti -- transform ./item.xml --format qti22:pie --silent
Then: stdout contains only the compact JSON string (no log lines)
  and the process exits with code 0
```

**AC-3: Transform with invalid format string**
```
Given: The CLI is invoked with --format "qti22pie" (no colon separator)
When: bun run pie-qti -- transform ./item.xml --format qti22pie
Then: stderr contains a message referencing the invalid format
  and the process exits with a non-zero code
  and no output file is created
```

**AC-4: Transform of missing input file**
```
Given: The input path ./nonexistent.xml does not exist
When: bun run pie-qti -- transform ./nonexistent.xml --format qti22:pie
Then: stderr contains an error message referencing the file path
  and the process exits with a non-zero code
```

**AC-5: Analyze a directory package**
```
Given: A directory ./pkg/ containing imsmanifest.xml and at least one assessmentItem XML file
When: bun run pie-qti -- analyze ./pkg/
Then: stdout contains "Found 1 QTI packages"
  and stdout contains an interaction type table with at least one entry
  and the process exits with code 0
```

**AC-6: Analyze a ZIP archive**
```
Given: A ZIP file ./pkg.zip containing a QTI content package with imsmanifest.xml
When: bun run pie-qti -- analyze ./pkg.zip
Then: stdout contains "ZIP file detected. Extracting..."
  and stdout contains the interaction type summary
  and the temporary extraction directory is removed after completion
  and the process exits with code 0
```

**AC-7: Analyze with --output writes Markdown report**
```
Given: A directory ./pkg/ containing a QTI package
When: bun run pie-qti -- analyze ./pkg/ --output ./report.md
Then: ./report.md is created
  and it contains a markdown section for each discovered package
  and each section lists interaction types found
  and stdout also prints the summary (the --output flag does not suppress stdout)
```

**AC-8: Batch transform a directory**
```
Given: A directory ./qti-items/ containing three QTI packages (each with imsmanifest.xml)
  each package contains two assessmentItem XML files
When: bun run pie-qti -- batch-transform ./qti-items/ -o ./pie-output/
Then: ./pie-output/ is created
  and each package's items appear under ./pie-output/<packageName>/items/
  and ./pie-output/transformation-report.json is created
  and transformation-report.json shows totalItems: 6 and failedTransforms: 0
  and the process exits with code 0
```

**AC-9: Batch transform with one failing item continues**
```
Given: A directory containing a QTI package where one XML file is malformed
When: bun run pie-qti -- batch-transform ./mixed-pkg/ -o ./out/
Then: The other items are transformed successfully
  and transformation-report.json shows failedTransforms: 1
  and the malformed file path appears in transformation-report.json errors array
  and the process exits with code 0 (not all items failed)
```

**AC-10: Batch transform a ZIP with nested ZIPs**
```
Given: A ZIP file ./bundle.zip that contains a nested ZIP ./pkg.zip inside it
  and ./pkg.zip contains a valid QTI package
When: bun run pie-qti -- batch-transform ./bundle.zip -o ./out/ --extract-nested-zips
Then: The nested package is discovered and its items are transformed
  and the output directory contains the transformed items
```

**AC-11: Batch transform cleanup-temp**
```
Given: A ZIP file input is used for batch-transform
When: the command completes (success or failure)
Then: the /tmp/pie-batch-<timestamp> extraction directory does not exist
Notes: This applies whether --cleanup-temp is default (true) or explicitly set
```

**AC-12: Batch transform --no-cleanup-temp preserves extraction**
```
Given: A ZIP file input is used for batch-transform
When: bun run pie-qti -- batch-transform ./pkg.zip -o ./out/ --no-cleanupTemp
Then: the temporary extraction directory is not deleted after completion
  and stdout logs the extraction path
```

**AC-13: discover-qti on a directory with manifest**
```
Given: A directory ./pkg/ with imsmanifest.xml listing 3 items and 1 passage
When: bun run pie-qti -- discover-qti ./pkg/ --pretty
Then: stdout contains a JSON object with items array of length 3
  and passages array of length 1
  and manifest.itemCount equals 3
  and manifest.passageCount equals 1
  and the process exits with code 0
```

**AC-14: discover-qti on a directory without manifest falls back to XML scan**
```
Given: A directory ./pkg/ with two assessmentItem XML files and no imsmanifest.xml
When: bun run pie-qti -- discover-qti ./pkg/
Then: stdout contains a JSON object with items array of length 2
  and manifest is undefined (not present in output)
```

**AC-15: discover-qti --output writes to file**
```
Given: A valid QTI package directory
When: bun run pie-qti -- discover-qti ./pkg/ --output ./discovery.json --pretty
Then: ./discovery.json is created with indented JSON
  and stdout contains "Wrote discovery output to ./discovery.json"
  and stdout does not contain the JSON payload
```

**AC-16: Config loading from --config flag**
```
Given: A config JSON file at ./my-config.json with a valid plugins entry
When: bun run pie-qti -- transform ./item.xml --format qti22:pie --config ./my-config.json
Then: stdout contains "Loaded configuration from ./my-config.json"
  and the configured plugins are registered before transformation runs
```

**AC-17: Config loading from PIE_QTI_CONFIG env var**
```
Given: The environment variable PIE_QTI_CONFIG is set to ./my-config.json
  and --config is not passed
When: bun run pie-qti -- transform ./item.xml --format qti22:pie
Then: stdout contains "Loaded configuration from ./my-config.json"
  and the plugins from the config are used
```

**AC-18: --config flag takes precedence over PIE_QTI_CONFIG**
```
Given: PIE_QTI_CONFIG=./env-config.json is set
  and --config ./flag-config.json is also passed
When: bun run pie-qti -- transform ./item.xml --config ./flag-config.json
Then: stdout confirms loading from ./flag-config.json
  and ./env-config.json is not loaded
```

**AC-19: --help prints command list**
```
Given: No additional arguments
When: bun run pie-qti -- --help
Then: stdout lists all four commands: transform, analyze-qti, batch-transform, discover-qti
  and each command entry shows its description
  and the process exits with code 0
```

**AC-20: --help on a specific command prints flag descriptions**
```
Given: The batch-transform command
When: bun run pie-qti -- batch-transform --help
Then: stdout lists all flags including --output-dir, --max-parallel, --extract-nested-zips, --load-passage-content, --copy-media-assets, --generate-report, --cleanup-temp, --temp-dir
  and each flag entry includes its description and default value
```

### Error handling

**AC-E1: Malformed config file produces a warning, not a crash**
```
Given: --config points to a file containing invalid JSON
When: bun run pie-qti -- transform ./item.xml --config ./bad-config.json
Then: stderr (or stdout) contains a warning message referencing the config path
  and the command falls back to built-in plugins
  and the transform proceeds (does not abort)
Notes: This reflects the fallback path in transform.ts where config load failure triggers engine construction without config
```

**AC-E2: Missing output directory is created automatically**
```
Given: The output directory specified with -o does not exist
When: bun run pie-qti -- batch-transform ./pkg/ -o ./new-dir/subdir/
Then: ./new-dir/subdir/ is created
  and the transform proceeds normally
```

**AC-E3: ZIP extraction temp directory cleaned up on transform error**
```
Given: A ZIP input where all items are malformed
When: bun run pie-qti -- batch-transform ./bad.zip -o ./out/
Then: The /tmp/pie-batch-<timestamp> directory is removed (cleanup in finally block)
  and transformation-report.json is still written with failedTransforms > 0
```

### Edge cases

**AC-EC1: analyze with --no-recursive treats path as single package**
```
Given: A directory ./root/ that contains subdirectories each with their own imsmanifest.xml
  and ./root/ itself does not have an imsmanifest.xml
When: bun run pie-qti -- analyze ./root/ --no-recursive
Then: stdout shows "Found 0 QTI packages" (root itself is not a package)
  and the subdirectory packages are not analyzed
```

**AC-EC2: batch-transform with passageContent loading inlines object references**
```
Given: A QTI item that contains <object type="text/html" data="passage.html">
  and passage.html exists in the same package directory
When: bun run pie-qti -- batch-transform ./pkg/ -o ./out/ --load-passage-content
Then: The transformed output for that item contains the inlined passage HTML
  and the <object> tag is replaced by the passage content
```

**AC-EC3: discover-qti on a ZIP file cleans up extraction**
```
Given: A ZIP file ./pkg.zip
  and no --extract-dir is specified
When: bun run pie-qti -- discover-qti ./pkg.zip
Then: The package is analyzed correctly
Notes: The discover-qti command uses openContentPackage which manages its own temp directory lifecycle via pkg.close(). Verify no leftover temp files after command exit.
```

---

## Open questions

- [ ] **`analyze` --json flag**: The README documents `--json` as a flag on `analyze` that outputs machine-readable JSON. The actual oclif command only defines `--output` (for Markdown) and `--recursive`/`--cleanupTemp`. Should `--json` be implemented to emit the `AnalysisResult` as structured JSON to stdout, enabling pipeline use? This would align `analyze` with `discover-qti`'s JSON-first output model.
- [ ] **`batch-transform` does not use BaseCommand**: `BatchTransform` extends oclif `Command` directly rather than `BaseCommand`, so it does not support `--config` or `PIE_QTI_CONFIG`. The `BatchTransformer` class hardcodes `QtiToPiePlugin` and does not accept a `TransformEngine` instance. Should `batch-transform` be migrated to `BaseCommand` so that config-driven plugins apply to batch operations?
- [ ] **Error detail in BatchTransformResult**: `errors[].error` is currently hardcoded to `"Transformation failed"` rather than the actual exception message. This makes the report unhelpful for diagnosing which items failed and why. Should the caught error message be propagated?
- [ ] **`maxParallel` not applied**: `BatchTransformer` accepts `maxParallel` but the inner transformation loop is sequential (`for...of`). For large packages this is a bottleneck. Should a `p-limit` or equivalent be introduced before the 1.0 release?
- [ ] **`pie:qti22` direction in transform command**: The `transform` command's fallback path only handles `qti22:pie`. If a user passes `--format pie:qti22`, the fallback throws `"Unsupported transformation"`. The `createEngine()` path would need a `PieToQti2Plugin` registered. Is `pie:qti22` in the single-item `transform` command a supported use case?
- [ ] **Global install timeline**: What are the criteria for cutting a 1.0 release and publishing for global install? Likely blockers: stable config schema, `pie:qti22` direction support, `--json` on `analyze`, error detail in batch report.

---

## Related

- Implementation: `tools/cli/src/`
- Package README: `tools/cli/README.md`
- Transform engine: `packages/core/` (`@pie-qti/transform-core`)
- QTI-to-PIE transformer: `packages/to-pie/` (`@pie-qti/to-pie`)
- PIE-to-QTI transformer: `packages/pie-to-qti2/` (`@pie-qti/pie-to-qti2`)
- Transform reference harness: `apps/transform/` (`@pie-qti/app-transform`) — historical host integration example, not a supported deployable app
- Config types: `@pie-qti/transform-types` (`TransformConfig`, `TransformPlugin`, `FormatDetector`)
- Adjacent PRDs: none yet; a `transform-core` architecture PRD would document the engine, plugin contract, and config loader that this CLI depends on
