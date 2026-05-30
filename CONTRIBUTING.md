# Contributing to PIE-QTI

Thank you for your interest in contributing to the PIE-QTI project! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- **Bun** ≥1.3.11 (package manager and runtime)
- **Node.js** ≥20.19.0 (for compatibility)
- **Git** for version control

### Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/pie-framework/pie-qti.git
   cd pie-qti
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Build all packages**

   ```bash
   bun run build
   ```

4. **Run tests**

   ```bash
   bun run test
   ```

5. **Start development server**

   ```bash
   cd apps/demo
   bun run dev
   ```

## Project Structure

This is a monorepo with multiple packages:

- **`packages/item-player/`** - Core item player (21 interaction types)
- **`packages/assessment-player/`** - Multi-item assessment player
- **`packages/default-components/`** - Default web-component renderers for QTI interactions
- **`packages/qti-common/`** - QTI 2.x / 3.0 version abstraction utilities
- **`packages/to-pie/`**, **`packages/pie-to-qti2/`**, **`packages/core/`** - Transformation packages
- **`packages/player-elements/`** - Web component wrappers
- **`tools/cli/`** - Transform and analysis CLI
- **`apps/demo/`** - Demo application
- **`apps/docs/`** - Published docs site
- **`apps/transform/`** - Internal transform reference harness; not part of supported app CI

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Prefer explicit types over `any` (with pragmatic exceptions for complex DOM types)
- Document public APIs with JSDoc comments

### Code Style

- We use **Biome** for linting and formatting
- Run `bun run lint` before committing
- Format code with `bun run format`

### Testing

- Write tests for new features
- Maintain existing test coverage
- Run tests with `bun run test`
- For QTI certification-facing changes, run `bun run test:certification:public`
- E2E tests: `bun run test:e2e` (Playwright starts the demo server unless `PLAYWRIGHT_REUSE_EXISTING_SERVER=true`)

### Commits

- Write clear, descriptive commit messages
- Reference issues in commits when applicable
- Keep commits focused and atomic

## Pull Request Process

1. **Fork the repository** and create a branch from `master`

2. **Make your changes**
   - Follow code standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**

   ```bash
   bun run build
   bun run test
   bun run test:certification:public  # Required for QTI delivery behavior changes
   bun run test:e2e  # If applicable
   ```

4. **Submit a pull request**
   - Provide a clear description of the changes
   - Reference related issues
   - Ensure CI checks pass

5. **Code review**
   - Address reviewer feedback
   - Make requested changes
   - Once approved, maintainers will merge

## Development Workflow

### Adding New Interaction Types

1. Add extraction and data-model support under `packages/item-player/src/interactions/<interaction>/`.
2. Add the default Svelte custom element under `packages/default-components/src/plugins/<interaction>/`.
3. Register the interaction in the item-player interaction modules and the default-components plugin index.
4. Add extractor, component, and browser-visible tests that cover the interaction's QTI attributes and response semantics.
5. Update the relevant README, PRD, eval YAML, and certification matrix entries when behavior or coverage changes.

### Fixing Bugs

1. Create a test that reproduces the bug
2. Fix the bug
3. Ensure the test passes
4. Add regression test if needed

### Improving Documentation

- Update READMEs in relevant packages
- Add examples for complex features
- Document breaking changes in PR description

## Security

If you discover a security vulnerability, please follow the security model in [docs/prds/architecture/security.md](docs/prds/architecture/security.md) and contact the maintainers privately before opening a public issue.

## Questions?

- Open an issue for bug reports or feature requests
- Check existing issues before creating new ones
- Be respectful and constructive in discussions

## License

By contributing, you agree that your contributions will be licensed under the ISC License (see [LICENSE](LICENSE)).
