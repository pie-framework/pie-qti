# Contributing to PIE-QTI

Thank you for your interest in contributing to the PIE-QTI project! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- **Bun** ≥1.1.0 (package manager and runtime)
- **Node.js** ≥18.0.0 (for compatibility)
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
   bun test
   ```

5. **Start development server**
   ```bash
   cd packages/qti2-example
   bun run dev
   ```

## Project Structure

This is a monorepo with multiple packages:

- **`packages/qti2-item-player/`** - Core item player (21 interaction types)
- **`packages/qti2-assessment-player/`** - Multi-item assessment player
- **`packages/qti2-player-elements/`** - Web component wrappers
- **`packages/qti2-example/`** - Demo application
- **`packages/transform-app/`** - Transform web UI (includes QTI package upload and manifest parsing)

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
- Run tests with `bun test`
- E2E tests: `bun run test:e2e` (requires dev server running)

### Commits

- Write clear, descriptive commit messages
- Reference issues in commits when applicable
- Keep commits focused and atomic

## Pull Request Process

1. **Fork the repository** and create a branch from `main`

2. **Make your changes**
   - Follow code standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   bun run build
   bun test
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

1. Create processor in `packages/qti2-item-player/src/processors/`
2. Add Svelte component in `packages/qti2-item-player/src/components/`
3. Update `InlineInteractionRenderer.svelte` or `BlockInteractionRenderer.svelte`
4. Add tests in `packages/qti2-item-player/tests/processors/`
5. Update documentation in README

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

If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md) for responsible disclosure.

## Questions?

- Open an issue for bug reports or feature requests
- Check existing issues before creating new ones
- Be respectful and constructive in discussions

## License

By contributing, you agree that your contributions will be licensed under the ISC License (see [LICENSE](LICENSE)).
