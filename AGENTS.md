# QTI Assessment Player - Agent Instructions

## Project Context

This is an educational assessment framework implementing QTI standards for K-12 assessments.

Critical requirements:

- Accessibility: WCAG 2.2 Level AA compliance is mandatory.
- Cross-platform behavior: components must work on desktop and mobile, including touch-friendly interactions.
- Standards compliance: implementations must follow the relevant QTI specification version.
- Type safety: TypeScript strict mode is enforced.
- Modern Svelte: use Svelte 5 patterns with runes for new Svelte code.

## Technology Stack

- Frontend: Svelte 5 with TypeScript.
- Build: Vite and SvelteKit.
- Testing: Vitest for unit/component tests and Playwright for end-to-end tests.
- Package management: Bun in a monorepo.
- Internationalization: custom i18n framework in `@pie-qti/i18n`.

## Code Quality Standards

After completing each feature or fix:

1. Run Biome with auto-fix: `bun run lint:fix` or `npx @biomejs/biome check --write .`.
2. Run TypeScript type checking: `bunx tsc --noEmit`.
3. Run Svelte type checking where relevant, for example `bunx svelte-check --workspace packages/components`.
4. Fix errors and warnings before marking the task complete.

Before any merge request:

1. TypeScript compilation must pass with no errors.
2. Unit, component, and end-to-end tests affected by the change must pass.
3. Mobile responsiveness should be verified for UI changes.
4. Accessibility should be checked for new or changed assessment interactions.
5. QTI specification compliance should be verified for QTI behavior changes.

## Monorepo Structure

The repository contains many packages under `packages/`, including assessment and item players, section player, default components, QTI processing, schema/types packages, packaging utilities, themes, storage, and test utilities. When making changes, consider cross-package impacts.

Common package areas:

- `packages/assessment-player/`: full assessment test player.
- `packages/item-player/`: individual item player.
- `packages/section-player/`: section-level assessment player behavior.
- `packages/default-components/`: standard QTI interaction components.
- `packages/i18n/`: internationalization framework.
- `packages/qti-processing/`, `packages/qti-common/`, and `packages/schemas/`: shared QTI logic, common types, and schema support.
- `packages/test-utils/`: shared test support.

## Monorepo Dependency Management

When creating new packages or adding imports between packages:

1. Verify package dependencies. If package A imports from package B, package A's `package.json` must include `"@pie-qti/package-b": "workspace:*"` in `dependencies`.
2. Check dependencies immediately after adding a new workspace import.
3. Use the workspace protocol for internal package references: `"workspace:*"`, not version numbers.
4. Run `bun install` after dependency changes so `bun.lock` stays correct.
5. Verify with an appropriate build or test command.

Common mistake: adding an import such as `import { foo } from '@pie-qti/ims-cp-core'` without adding the corresponding dependency to `package.json`. Hoisting may hide the problem locally while leaving the dependency graph incorrect.

Checklist for new cross-package imports:

- Added the import statement in the TypeScript or JavaScript file.
- Added the corresponding `"@pie-qti/package-name": "workspace:*"` dependency to `package.json`.
- Ran `bun install` after dependency changes.
- Verified the affected package builds or tests pass.

## Svelte 5 Patterns

Use modern Svelte 5 patterns for new Svelte code:

- State: use `$state()` runes instead of `let` with reactive assumptions.
- Props: use `$props()` for component properties.
- Effects: use `$effect()` for side effects.
- Derived values: use `$derived()` for computed values.

Avoid Svelte 4 patterns such as stores and `$:` reactive statements unless working with legacy code that already uses them.

## Standard Components

### XML Display

Always use the `XmlEditor` component for displaying XML content. Do not use plain `<pre><code>` blocks for XML display.

```svelte
import XmlEditor from '$lib/components/XmlEditor.svelte';

<!-- For read-only display -->
<XmlEditor content={xmlString} readOnly={true} />

<!-- For editable XML -->
<XmlEditor bind:content={xmlString} onContentChange={handleChange} />
```

`XmlEditor` provides syntax highlighting with TipTap and Lowlight, theme-aware display, text selection for copying, and read-only/editable modes.

## Testing Strategy

- Unit tests: use for business logic, utilities, and pure functions.
- Component tests: use for isolated component behavior.
- End-to-end tests: use Playwright for full user workflows.
- Accessibility tests: combine automated checks with manual verification for changed assessment interactions.

For UI changes, verify behavior manually on both desktop and mobile before relying only on automated tests.
