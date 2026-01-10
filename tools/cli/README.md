# @pie-qti/transform-cli

> **Status**: Under active development

Command-line tool for QTI ↔ PIE transformations, batch operations, and content analysis.

## Features

- **Transform** — Convert QTI 2.2 to PIE and vice versa
- **Analyze** — Inspect QTI content packages and report issues
- **Batch operations** — Process entire directories or ZIP packages
- **IMS Content Packages** — Generate manifests for multi-item exports

## Quick Start

From the repository root:

```bash
# Install dependencies
bun install

# Transform a single QTI item to PIE
bun run pie-qti -- transform packages/transform-app/static/samples/basic-interactions/choice_simple.xml \
  --format qti22:pie \
  --output ./output.json \
  --pretty

# Analyze a QTI content package
bun run pie-qti -- analyze ./path/to/content-package/

# See all available commands
bun run pie-qti -- --help
```

## Commands

### transform

Transform QTI 2.2 XML to PIE JSON (or vice versa).

```bash
bun run pie-qti -- transform <input> [options]

Options:
  --format, -f     Transform direction: qti22:pie or pie:qti22
  --output, -o     Output file path
  --pretty         Pretty-print JSON output
  --help           Show help
```

**Examples:**

```bash
# QTI to PIE
bun run pie-qti -- transform item.xml -f qti22:pie -o item.json --pretty

# PIE to QTI
bun run pie-qti -- transform item.json -f pie:qti22 -o item.xml
```

### analyze

Analyze QTI content and report statistics and issues.

```bash
bun run pie-qti -- analyze <path> [options]

Options:
  --verbose, -v    Show detailed output
  --json           Output as JSON
  --help           Show help
```

**Examples:**

```bash
# Analyze a directory
bun run pie-qti -- analyze ./content-package/

# Analyze with detailed output
bun run pie-qti -- analyze ./content-package/ --verbose

# Output analysis as JSON
bun run pie-qti -- analyze ./content-package/ --json > report.json
```

### batch-transform

Transform multiple items or entire content packages.

```bash
bun run pie-qti -- batch-transform <input-dir> [options]

Options:
  --format, -f     Transform direction: qti22:pie or pie:qti22
  --output, -o     Output directory
  --manifest       Generate IMS manifest (for pie:qti22)
  --help           Show help
```

**Examples:**

```bash
# Transform all QTI items in a directory
bun run pie-qti -- batch-transform ./qti-items/ -f qti22:pie -o ./pie-output/

# Generate IMS Content Package
bun run pie-qti -- batch-transform ./pie-items/ -f pie:qti22 -o ./qti-package/ --manifest
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
- [@pie-qti/qti2-to-pie](../../packages/qti2-to-pie) — QTI → PIE transformer
- [@pie-qti/pie-to-qti2](../../packages/pie-to-qti2) — PIE → QTI transformer
- [@pie-qti/transform-web](../../packages/transform-app) — Web UI for transforms

## License

ISC

