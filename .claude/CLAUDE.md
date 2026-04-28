# QTI Assessment Player - Project Instructions

## Project Context

This is an educational assessment framework implementing QTI 2.x standards for K-12 assessments.

**Critical Requirements**:

- **Accessibility**: WCAG 2.2 Level AA compliance is mandatory
- **Cross-platform**: Components must work on desktop and mobile (touch-friendly)
- **Standards compliance**: Must adhere to QTI 2.x specification
- **Type safety**: TypeScript strict mode is enforced
- **Modern Svelte**: Using Svelte 5 with runes

## Technology Stack

- **Frontend**: Svelte 5 with TypeScript
- **Build**: Vite + SvelteKit
- **Testing**: Vitest + Playwright for e2e
- **Package Management**: Bun (monorepo structure)
- **Internationalization**: Custom i18n framework (`@pie-qti/i18n` package)

## Code Quality Standards

**After completing each feature or fix**:

1. Run Biome with auto-fix: `bun run lint:fix` or `npx @biomejs/biome check --write .`
2. Run TypeScript type checking: `bunx tsc --noEmit`
3. Run Svelte type checking: `bunx svelte-check --workspace packages/components`
4. Fix all errors and warnings before marking the task as complete

These checks ensure:

- Code follows project style standards
- No type errors are introduced
- Svelte components are valid and type-safe
- Changes don't break existing functionality

**Before any merge request**:

1. TypeScript compilation must pass with no errors
2. All tests must pass (unit + e2e)
3. Mobile responsiveness verified manually
4. Accessibility checks pass (use accessibility-reviewer-assessments skill)
5. QTI specification compliance verified

## Claude Skills

This project has custom Claude skills available. Use them proactively when relevant:

- **qti-domain-expert**: Use when a question involves QTI spec semantics — how a feature should behave per the spec, whether an implementation is compliant, how response processing rules work, adaptive item lifecycle, navigation/submission mode behavior, or correct use of QTI variables and cardinality.
- **pie-domain-expert**: Use when a question involves PIE framework concepts — how Controllers, Models, Sessions, and Environments work; what goes in a PieModel vs a PieSession; how Mode×Role affects the ViewModel; how PIE scoring maps to QTI outcomes; how the SectionPlayer or AssessmentPlayer orchestrates items.
- **assessment-content-validator**: Use when creating QTI assessment items, reviewing test fixtures, or debugging assessment issues. Validates both technical correctness (QTI/PIE compliance) and pedagogical quality (appropriate difficulty, clear instructions, K-12 appropriateness).
- **accessibility-reviewer-assessments**: Use when implementing new interactions, reviewing UI changes, or conducting accessibility audits. Checks WCAG 2.2 Level AA compliance and assessment-specific accessibility needs.
- **api-design-reviewer**: Use when designing new APIs, reviewing API changes, or conducting framework code reviews. Checks consistency, usability, type safety, and breaking changes.
- **prd-author**: Use when writing a new PRD for an interaction, architecture subsystem, or cross-cutting system concern. It reads the relevant source, asks targeted questions to fill gaps, and produces a complete draft aligned to `docs/prds/TEMPLATE.md`. Also invoke proactively when a significant new feature is complete and lacks a PRD.
- **prd-reviewer**: Use when reviewing an existing PRD for accuracy, completeness, and staleness. Invoke proactively when opening a PR that touches a package covered by a PRD — check whether the PRD needs updating before merging.

## Monorepo Structure

```text
packages/
├── assessment-player/      # Full assessment test player
├── item-player/            # Individual item player
├── default-components/     # Standard QTI interaction components
├── i18n/                   # Internationalization framework
└── example/                # Demo/testing application
```

When making changes, consider cross-package impacts.

### Monorepo Dependency Management

**CRITICAL**: When creating new packages or adding imports between packages:

1. **Always verify package.json dependencies** - If package A imports from package B, package A's `package.json` MUST include `"@pie-qti/package-b": "workspace:*"` in dependencies
2. **Check after every import** - Whenever you add an import from another workspace package, immediately verify the dependency is declared
3. **Use workspace protocol** - All internal package references must use `"workspace:*"` not version numbers
4. **Verify with build** - After adding dependencies, run `bun install` and `bun run build` to verify

**Common mistake**: Adding imports like `import { foo } from '@pie-qti/ims-cp-core'` without adding the dependency to package.json. This may work due to hoisting but creates an incorrect dependency graph.

**Checklist for new cross-package imports**:

- [ ] Added import statement in TypeScript/JavaScript file
- [ ] Added corresponding `"@pie-qti/package-name": "workspace:*"` to package.json dependencies
- [ ] Ran `bun install` to update lockfile
- [ ] Verified build passes with `bun run build`

## Svelte 5 Patterns

Use modern Svelte 5 patterns:

- **State**: Use `$state()` runes, not `let` with reactivity
- **Props**: Use `$props()` for component properties
- **Effects**: Use `$effect()` for side effects
- **Derived**: Use `$derived()` for computed values

Avoid Svelte 4 patterns (stores, `$:` reactive statements) unless working with legacy code.

## Standard Components

### XML Display

**ALWAYS use XmlEditor component for displaying XML content** (never use plain `<pre><code>` blocks):

```svelte
import XmlEditor from '$lib/components/XmlEditor.svelte';

<!-- For read-only display -->
<XmlEditor content={xmlString} readOnly={true} />

<!-- For editable XML -->
<XmlEditor bind:content={xmlString} onContentChange={handleChange} />
```

**Features**:

- Syntax highlighting with TipTap and Lowlight
- Theme-aware (works with all 32 DaisyUI themes)
- Text selection enabled for copying
- Read-only and editable modes

## Testing Strategy

- **Unit tests**: For business logic, utilities, and pure functions
- **Component tests**: For isolated component behavior
- **E2e tests**: For full user workflows using Playwright
- **Accessibility tests**: Automated checks + manual verification

Always verify manually on both desktop and mobile before writing automated tests.
