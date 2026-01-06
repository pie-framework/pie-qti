# PIE-QTI: Production-Ready QTI 2.2 Implementation

![QTI 2.2 Compliant](https://img.shields.io/badge/QTI%202.2-100%25%20Compliant-success)
![Interactions](https://img.shields.io/badge/Interactions-21%2F21-success)
![Tests](https://img.shields.io/badge/Tests-1112%2B-success)
![Accessibility](https://img.shields.io/badge/WCAG%202.2%20AA-99.5%25-success)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)

Monorepo for **QTI 2.2 → PIE transformation** and **direct QTI 2.2 rendering** in modern web applications.

## Documentation Site

📚 **[View Full Documentation](https://pie-framework.github.io/pie-qti/)** - Complete guides, API reference, and examples

## Features

- ✅ **Complete QTI 2.2 Implementation**: All 21 interaction types, 45 response processing operators
- ✅ **Dual-Mode Architecture**: Direct QTI XML rendering + optional PIE JSON transformation
- ✅ **Production-Grade Quality**: 1,112+ tests (99.9% pass rate), WCAG 2.2 Level AA accessibility
- ✅ **Modern Stack**: TypeScript, Svelte 5, Bun + Turbo monorepo
- ✅ **Framework-Agnostic Core**: Pluggable renderer system for any UI framework

> 📊 **Project Status**: Production-ready v1.0. See [STATUS.md](STATUS.md) for feature completeness details.

## Packages

Everything lives under `packages/`:

### Transformation core

- `@pie-framework/transform-types` (`packages/types`): shared TypeScript types (PIE + transform IO)
- `@pie-framework/element-schemas` (`packages/schemas`): PIE element JSON schemas used for validation
- `@pie-framework/transform-core` (`packages/core`): plugin registry + transform engine + validation
- `@pie-qti/qti2-to-pie` (`packages/qti2-to-pie`): QTI 2.2 transformer plugin (XML → PIE JSON)
- `@pie-qti/pie-to-qti2` (`packages/pie-to-qti2`): PIE transformer plugin (PIE JSON → QTI 2.2 XML)

### QTI Players

- `@pie-qti/qti2-item-player` (`packages/qti2-item-player`): single-item QTI 2.x player + interaction components
- `@pie-qti/qti2-assessment-player` (`packages/qti2-assessment-player`): assessment shell (multi-item navigation, sections, rubric blocks)

### Tools

- `@pie-framework/transform-cli` (`packages/cli`): Oclif CLI (installs `pie-qti`)
- `@pie-framework/transform-web` (`packages/transform-app`): web UI for trying transforms
- `@pie-qti/qti2-example` (`packages/qti2-example`): example SvelteKit app for the players + a11y test harness

## Quick Start

```bash
# Install CLI globally (puts `pie-qti` on your PATH)
bun add -g @pie-framework/transform-cli

# Alternatively, run without a global install:
# bunx @pie-framework/transform-cli <command> [...args]
#
# Example:
# bunx @pie-framework/transform-cli qti-package.zip --to pie --output ./output

# Transform QTI (zip/package) to PIE
pie-qti qti-package.zip --to pie --output ./output

# Batch transform
pie-qti batch ./packages/*.zip --to pie --parallel 10
```

## CLI

The CLI is implemented in `packages/cli` and exposes the `pie-qti` binary.

Common commands:

- `pie-qti --help`
- `pie-qti transform <input.xml> -o <output.json>`
- `pie-qti batch <glob-or-dir> --to pie --output <dir-or-jsonl>`
- `pie-qti analyze-qti <package-or-dir>`
- `pie-qti discover-qti <package-or-dir>`

## Development

```bash
# Install dependencies
bun install

# Build all packages (Turbo)
bun run build

# Run the transform web UI
bun run dev:transform-app

# Run the QTI player example app
bun run dev:example

# Or use these convenient shortcuts from root:
bun run dev:example       # Run example app in dev mode
bun run dev:pages         # Same as above (for GitHub Pages testing)
```

### Development with Local PIE Players

If you want to test QTI-generated PIE content with the PIE players from the [pie-players](https://github.com/pie-framework/pie-players) repository during development, local linking is automatically set up when both repositories are checked out side-by-side.

**Setup:**

1. Clone both repositories side-by-side:

   ```text
   dev/prj/pie/
     ├── pie-qti/
     └── pie-players/
   ```

2. Build pie-players packages:

   ```bash
   cd ../pie-players
   bun install
   bun run build
   ```

3. Install pie-qti dependencies:

   ```bash
   cd ../pie-qti
   bun install
   ```

**That's it!** The postinstall script automatically detects the pie-players sibling directory and creates `bunfig.local.toml` to link the local packages. Any changes you make in `pie-players/packages/*` will be immediately reflected without needing to rebuild or republish.

**For External Users:**

External users who clone only pie-qti will automatically get published versions from npm. The postinstall script silently does nothing when pie-players is not present, so there's no impact on standard workflows.

### Testing GitHub Pages Deployment Locally

```bash
# Build the site exactly as GitHub Pages will
bun run build:pages

# Preview the production build
bun run preview:pages

# IMPORTANT: Open http://localhost:4173/pie-qti/ (note the /pie-qti/ base path!)
# The production build is configured for GitHub Pages with /pie-qti base path
```

## Tests

At repo root:

```bash
# Run unit tests across the monorepo (Turbo)
bun run test

# Lint / typecheck
bun run lint
bun run typecheck
```

Package-level:

```bash
# Unit tests (Bun)
bun --filter @pie-framework/transform-core test
bun --filter @pie-qti/qti2-to-pie test
bun --filter @pie-qti/qti2-item-player test

# E2E + a11y (Playwright)
bun --filter @pie-qti/qti2-example test:e2e
```

Accessibility coverage lives in `packages/qti2-example/tests/e2e/` and includes both demo-based checks and component-fixture scans under:

- `GET /a11y-components`

For details, see [`packages/qti2-example/tests/README.md`](packages/qti2-example/tests/README.md).

## Documentation

### Getting Started

- **[PIE ↔ QTI Transformation Guide](docs/PIE-QTI-TRANSFORMATION-GUIDE.md)** - Complete guide to bidirectional transformations

### Package Documentation

- **[@pie-qti/pie-to-qti2](packages/pie-to-qti2/README.md)** - PIE to QTI transformation
- **[@pie-qti/qti2-to-pie](packages/qti2-to-pie/README.md)** - QTI to PIE transformation
- **[@pie-qti/qti2-item-player](packages/qti2-item-player/README.md)** - QTI item player
- **[@pie-qti/qti2-assessment-player](packages/qti2-assessment-player/README.md)** - QTI assessment player

### Feature Guides

- **[Assessment Transformations](packages/pie-to-qti2/docs/ASSESSMENT-TRANSFORMATIONS.md)** - Multi-item assessments with scoring, branching, and adaptive navigation
- **[External Passages](packages/pie-to-qti2/docs/EXTERNAL-PASSAGES.md)** - External passage support
- **[Manifest Generation](packages/pie-to-qti2/docs/MANIFEST-GENERATION.md)** - IMS Content Package generation
- **[QTI 2.2.2 Compliance](packages/pie-to-qti2/docs/QTI-COMPLIANCE.md)** - Standards compliance details

## License

ISC License - see [LICENSE](LICENSE) for details
