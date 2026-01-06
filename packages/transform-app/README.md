# @pie-framework/transform-web

> **Status**: Under active development

Interactive web application for QTI ↔ PIE transformations with analysis and preview capabilities.

## Features

- **Upload** — Single XML files or ZIP packages (including nested ZIPs and IMS Content Packages)
- **Analyze** — Discover items/tests, count interactions, identify issues
- **Transform** — Batch convert QTI 2.2 → PIE with progress reporting
- **Preview** — Side-by-side QTI player and PIE player rendering
- **Validation** — Schema validation and transformation pipeline feedback

## Quick Start

From the repository root:

```bash
# Install dependencies
bun install

# Start the transform app
bun run dev:transform-app

# Open http://localhost:5174
```

## Usage

### 1. Upload Content

- Drag and drop or click to upload QTI XML files or ZIP packages
- Supports nested ZIPs and IMS Content Packages with manifests
- Files are stored in a sessionized filesystem (local by default)

### 2. Analyze

- Click "Analyze" to scan uploaded content
- View discovered items, tests, and interaction types
- Review any issues or warnings

### 3. Transform

- Select items to transform
- Click "Transform" to convert QTI → PIE
- Monitor progress for batch operations

### 4. Preview

- **QTI Preview** — Renders the original QTI using the QTI 2.x players
- **PIE Preview** — Renders the transformed PIE using PIE players
- Compare rendering side-by-side to verify transformation quality

## Architecture

The transform app is a SvelteKit application that coordinates:

- **Session management** — Uploaded files persist per session
- **Analysis pipeline** — Extracts metadata from QTI content
- **Transform engine** — Uses `@pie-framework/transform-core` with `@pie-qti/qti2-to-pie`
- **Player integration** — QTI players for source preview, PIE players for output preview

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload files to a new session |
| `/api/sessions/[id]/analyze` | POST | Analyze session content |
| `/api/sessions/[id]/transform` | POST | Transform session content |
| `/api/sessions/[id]/items` | GET | List items in session |

### Backend Adapter Pattern

By default, the app uses local filesystem storage. The architecture supports custom backend adapters for:

- Cloud storage integration
- Database-backed sessions
- Authentication and authorization
- Server-side scoring

## Development

```bash
# Start dev server
cd packages/transform-app
bun run dev

# Build for production
bun run build

# Type checking
bun run typecheck

# E2E tests
bun run test:e2e
```

## Configuration

### PIE Players (Optional)

For PIE preview functionality, install PIE players:

```bash
bun add @pie-framework/pie-iife-player @pie-framework/pie-esm-player
```

Or for local development with [pie-players](https://github.com/pie-framework/pie-players), clone the repo alongside this one—the postinstall script auto-links them.

## Related Packages

- [@pie-framework/transform-cli](../cli) — Command-line transforms
- [@pie-framework/transform-core](../core) — Transform engine
- [@pie-qti/qti2-to-pie](../qti2-to-pie) — QTI → PIE transformer
- [@pie-qti/qti2-item-player](../qti2-item-player) — QTI player for preview
- [@pie-qti/qti2-assessment-player](../qti2-assessment-player) — Assessment player

## License

ISC

