# @pie-qti/transform-cli

> **Status**: Under active development

Command-line tool for QTI to PIE transformations, batch package operations, content analysis, and package discovery.

## Features

- **Transform** — Convert QTI XML to PIE JSON
- **Analyze** — Inspect QTI content packages and write optional markdown reports
- **Batch operations** — Process one or more package directories or ZIP files
- **Discover** — Print the structure of a QTI content package as JSON

## Quick Start

From the repository root:

```bash
# Install dependencies
bun install

# Transform a single QTI item to PIE
bun run pie-qti -- transform packages/to-pie/tests/fixtures/qti-samples/basic-interactions/choice_simple.xml \
  --format qti22:pie \
  --output ./output.json \
  --pretty

# Analyze a QTI content package
bun run pie-qti -- analyze-qti ./path/to/content-package/

# See all available commands
bun run pie-qti -- --help
```

## Commands

### transform

Transform QTI XML to PIE JSON.

```bash
bun run pie-qti -- transform <input> [options]

Options:
  --config, -c   Path to configuration file (JSON)
  --output, -o   Output file path (defaults to stdout)
  --format, -f   Transformation format (source:target), default qti22:pie
                 The route token remains qti22:pie; QTI XML version is auto-detected by @pie-qti/to-pie.
  --pretty, -p   Pretty-print JSON output
  --silent, -s   Suppress logs
  --help         Show help
```

**Examples:**

```bash
# QTI to PIE
bun run pie-qti -- transform item.xml -f qti22:pie -o item.json --pretty

# QTI 3 XML is accepted through the same route token
bun run pie-qti -- transform qti3-item.xml -f qti22:pie -o item.json --pretty
```

### analyze-qti

Analyze QTI content and report statistics and issues.

```bash
bun run pie-qti -- analyze-qti <input> [options]

Options:
  --output       Write a detailed markdown report to this file path
  --recursive    Recurse to find packages under the provided directory
  --cleanupTemp  Cleanup temporary extracted files when input is a ZIP
  --help         Show help
```

**Examples:**

```bash
# Analyze a directory
bun run pie-qti -- analyze-qti ./content-package/

# Write a markdown report
bun run pie-qti -- analyze-qti ./content-package/ --output report.md
```

### batch-transform

Transform multiple items or entire content packages.

```bash
bun run pie-qti -- batch-transform <inputs...> [options]

Options:
  --outputDir, -o       Output directory for transformed PIE package artifacts
  --maxParallel         Max parallel package transformations (default 10)
  --extractNestedZips   Extract nested ZIP files
  --copyMediaAssets     Copy sidecar source assets into output directory
  --generateReport      Generate a summary report
  --cleanupTemp         Cleanup temporary extraction directory
  --tempDir             Temporary directory for ZIP extraction
  --help                Show help
```

**Examples:**

```bash
# Transform a QTI package
bun run pie-qti -- batch-transform ./qti-package.zip -o ./pie-output/

# Transform multiple package inputs
bun run pie-qti -- batch-transform ./dir-a ./dir-b -o ./pie-output/ --no-cleanupTemp
```

### discover-qti

Discover and print the structure of a QTI content package.

```bash
bun run pie-qti -- discover-qti <input> [options]

Options:
  --output       Write the JSON result to this file path
  --pretty       Pretty-print JSON
  --verbose      Include more detail during discovery
  --extractDir   Directory to extract ZIPs into
  --help         Show help
```

**Examples:**

```bash
bun run pie-qti -- discover-qti ./content-package/ --pretty
bun run pie-qti -- discover-qti ./content-package.zip --output discovery.json
```

## Development

```bash
# Build the CLI
cd tools/cli
bun run build

# Run directly (development)
bun run analyze-qti -- ./path/to/content/
bun run batch-transform -- ./path/to/content/ -o ./output/
```

## Related Packages

- [@pie-qti/transform-core](../../packages/core) — Transform engine
- [@pie-qti/to-pie](../../packages/to-pie) — QTI → PIE transformer
- [@pie-qti/pie-to-qti2](../../packages/pie-to-qti2) — PIE → QTI transformer
- [apps/transform](../../apps/transform) — Internal reference harness for transform host integration

## License

ISC
