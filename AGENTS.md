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
- Testing: Bun's built-in test runner (`bun test`) for unit tests, Vitest with jsdom for Svelte component behavior tests (`packages/default-components`, run with `bun run test:component`), and Playwright for end-to-end tests.
- Package management: Bun in a monorepo.
- Internationalization: custom i18n framework in `@pie-qti/i18n`.

## Code Quality Standards

After completing each feature or fix:

1. Run Biome with auto-fix: `bun run lint:fix` or `npx @biomejs/biome check --write .`.
2. Run TypeScript type checking: `bun run typecheck` (Turborepo runs `tsc --noEmit` in every workspace; the root tsconfig is solution-style and checks nothing on its own).
3. Run Svelte type checking where relevant: `bun run check` (runs svelte-check in every Svelte workspace), or for a single package, for example `cd packages/item-player && bun run check`.
4. If any markdown documentation changed: `bun run check:doc-links` (validates relative links, heading anchors, and repo paths named in inline code across all markdown; CI enforces this).
5. Fix errors and warnings before marking the task complete.

Before any merge request:

1. TypeScript compilation must pass with no errors.
2. Unit, component, and end-to-end tests affected by the change must pass.
3. Mobile responsiveness should be verified for UI changes.
4. Accessibility should be checked for new or changed assessment interactions.
5. QTI specification compliance should be verified for QTI behavior changes.

## Spec Compliance and No Legacy Code

This project is pre-1.0. There is no backwards-compatibility surface to preserve.

- **Follow the QTI spec wherever it is clear, per QTI version.** Do not document a divergence from a clear spec rule as a deliberate choice; fix it. Supporting a behavior an older QTI version defines (2.1 vs 2.2 vs 3.0 differences) is compliance, not legacy. Keep a documented divergence only where the spec is ambiguous or silent, with the reasoning.
- **No legacy code.** Do not add or keep shims, deprecated aliases, ignored parameters, pure-delegation wrappers, mirror types, or migration paths for this project's own past APIs, formats or behavior. Remove them, with a "Breaking:" note in the changeset.
- **No non-spec leniency.** Do not read attributes or elements no QTI version defines. Where real-world content needs a tolerance, document the evidence next to the code and record the decision in the "Deliberate extensions" or "Deliberate keeps" ledger at the top of `docs/SPEC-GAPS-PLAN.md`.

## Serious Findings Are Never Out Of Scope

Report a potentially serious finding whenever you see it, whatever the task and whoever wrote the code. "This change did not touch it" is never a reason to stay silent. Serious means:

- Security: script injection through item content (XHTML, MathML, stylesheets, media URLs) or attributes, reaching the DOM unsanitised; a portable custom interaction that escapes its isolation in `pci-runner` or reaches the host page, its storage or its credentials; a content package entry that writes or reads outside its target (`..` or absolute paths), or an archive that exhausts memory, in the `ims-cp-*` packages; delivery that hands the candidate the correct response, mapping or response processing; a secret or credential in the tree, a build output or a log; an exploitable or compromised dependency, or a published package carrying code its source does not.
- Data integrity: response or outcome processing that scores wrongly, or candidate responses lost or attached to the wrong item.
- Production stability: a change that breaks the published element or package surface for hosts already running it.

The source does not matter: Upwind, Dependabot, CodeQL, `bun audit`, a failing test, a log line, reading code in passing.

- Report it in the reply, right after the answer: the location (`file:line`, package and version), the evidence, and an honest severity estimate. A suspicion stays a finding; say what would confirm or clear it.
- Check the "Deliberate extensions" and "Deliberate keeps" ledgers in `docs/SPEC-GAPS-PLAN.md` first and cite the entry when the behaviour is a recorded decision. A decision you cannot find is no reason to drop the finding.
- Propose the fix: a small one with the current change, after asking; one that is work of its own as a follow-up session with a brief (finding, evidence, what done looks like).
- This repository is public, so everything pushed to it is published. Describe an unfixed vulnerability only in the session, never in an issue, pull request, commit message, changeset or document here. The fix lands under a neutral description, and disclosure is the user's decision.
- Never file a ticket, post outward, or rotate, revoke or delete a credential without the user's explicit yes for that action.

**Upwind.** As of 2026-11-27 Upwind does not scan this repository. When the `upwind-server` MCP tools are available and a task touches dependencies, content rendering, PCI isolation, content packages, secrets handling or security review, run `code_scans_search` with `repository_name = pie-qti`, newest first. Once scans exist, search the newest `default_branch` scan's SCA, SAST, IaC and secret domains for critical and high findings, and medium where `is_exploitable` is true. Secret findings carry no severity: read every `category: secret` finding, and treat `pii`, `pci` and `phi` as serious outright. Fetch details with the `*_get_by_id` tools, verify them against the code, and report them as above with the Upwind finding id. The Upwind tools that create or update scan schedules, scopes, threat policies or rules write to a shared security platform: use them only on an explicit request.

## Monorepo Structure

The repository contains many packages under `packages/`, including assessment and item players, section player, default components, QTI processing, schema/types packages, packaging utilities, themes, storage, and test utilities. When making changes, consider cross-package impacts.

Common package areas:

- `packages/assessment-player/`: full assessment test player.
- `packages/item-player/`: individual item player.
- `packages/section-player/`: section-level assessment player behavior.
- `packages/default-components/`: standard QTI interaction components.
- `packages/i18n/`: internationalization framework.
- `packages/qti-processing/` and `packages/qti-common/`: shared QTI logic and common types.
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

`XmlEditor` provides syntax highlighting with TipTap and Lowlight, theme-aware display, text selection for copying, and read-only/editable modes. (The component lives in the demo app at `apps/demo/src/lib/components/XmlEditor.svelte`; this rule applies to demo/docs app code, not to published packages.)

## Agent Skills

Project skills live in `.agents/skills/`; `.claude/skills/` is a mirrored copy for tools that only read that path. Edit the `.agents/skills/` file, then copy it over: `bun run check:skills-sync` (run in CI's doc-links job) fails when the two differ.

## Testing Strategy

- Unit tests: use for business logic, utilities, and pure functions. Run with `bun test` (per package, via the package's `test` script); import from `bun:test`.
- Component tests: use for isolated component behavior. `packages/default-components` mounts its real Svelte interaction components in jsdom under Vitest (`tests/component/*.vitest.ts`, run via `bun run test:component`); the `.vitest.ts` suffix keeps them out of `bun test`.
- End-to-end tests: use Playwright for full user workflows.
- Accessibility tests: combine automated checks with manual verification for changed assessment interactions.

For UI changes, verify behavior manually on both desktop and mobile before relying only on automated tests.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
