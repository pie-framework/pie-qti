# QTI Section Player and Toolkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the contract-first `@pie-qti/section-player` foundation, shared-content security surface, assessment-player delegation path, web component exposure, and QTI-native toolkit helpers described in `docs/prds/architecture/qti-section-player-and-toolkit.md`.

**Architecture:** `@pie-qti/assessment-player` remains the full-assessment orchestrator for backend sessions, navigation, scoring, submission, timing, and persistence. `@pie-qti/section-player` owns neutral active-section rendering contracts and layout-only composition over `@pie-qti/item-player`; it never imports `BackendAdapter`, `SecureAssessment`, or `SecureSection`. `@pie-qti/assessment-toolkit` is introduced only for QTI-specific role/view and shared-context normalization helpers, while generic `pie-players` runtime/projection vocabulary remains owned upstream.

**Tech Stack:** TypeScript strict mode, Bun workspaces/tests, Svelte 5 runes, Vite for custom element bundles where needed, `svelte-check`, Biome, Playwright demo tests, Changesets fixed-version publishing.

## Global Constraints

- Keep `@pie-qti/item-player` focused on single `assessmentItem` rendering and item-level response/scoring behavior.
- Keep `@pie-qti/assessment-player` as the orchestration layer for full assessments. Do not move navigation, backend submission, timing, persistence, `AssessmentSessionCoordinator`, or hidden `Player` lifecycle into `@pie-qti/section-player`.
- `@pie-qti/section-player` must not import from `@pie-qti/assessment-player`.
- Every internal package import added to a source file must be matched by `"@pie-qti/<package>": "workspace:*"` in that package's `package.json`.
- New publishable packages must use version `0.1.13`, `type: "module"`, `engines.node: ">=20.19.0"`, `publishConfig.access: "public"`, `files: ["dist"]`, correct `repository.directory`, and a Changesets fixed-group entry.
- Do not expose `./components` from player packages. `scripts/publish-policy.json` forbids this pattern for existing player packages and should be extended for new player packages.
- Section-player Svelte components are source-only internals until a Vite bundle strategy exists. Keep the pure `tsc` publish build from compiling `.svelte` component barrels, and let consuming Svelte/Vite packages import source components through explicit source aliases or relative source imports.
- Do not use `development` or `svelte` export conditions in publishable packages.
- Shared passage, rubric, stimulus, catalog, stylesheet, asset, and test-feedback content is untrusted until sanitized through the shared QTI security surface.
- Shared content role/view filtering is mandatory before render. Candidate delivery must not expose scorer, proctor, author, tutor, or test-constructor shared blocks to visible layout or screen readers.
- Active item responses must be routed by both item identifier and response identifier. Never update section responses with response identifier alone because multiple items can reuse `RESPONSE`.
- Preserve Svelte 5 patterns: `$props()`, `$state()`, `$derived()`, and `$effect()` in new Svelte components.
- Do not commit unless the user explicitly asks for a commit.

---

## Planned File Structure

Create:

- `packages/section-player/package.json` — publishable section render package manifest.
- `packages/section-player/tsconfig.json` — TypeScript build for contracts and pure helpers.
- `packages/section-player/tsconfig.svelte.json` — Svelte typecheck config added when layout components are introduced.
- `packages/section-player/svelte.config.js` — Svelte 5 runes config added with layout components.
- `packages/section-player/src/index.ts` — public exports.
- `packages/section-player/src/contracts/layout-contract.ts` — section model, item refs, shared context, composition contract.
- `packages/section-player/src/contracts/runtime-host-contract.ts` — host hooks, diagnostics, lifecycle, events.
- `packages/section-player/src/contracts/index.ts` — contracts barrel.
- `packages/section-player/src/visibility/role-view.ts` — shared role/view token normalization used by resolver and renderers.
- `packages/section-player/src/composition/resolveQtiSectionComposition.ts` — pure resolver from section model and active item id/index to layout-ready composition.
- `packages/section-player/src/security/sanitizeSharedHtml.ts` — local wrapper around the public item-player security surface.
- `packages/section-player/src/components/SanitizedHtml.svelte` — sanitized shared HTML render sink.
- `packages/section-player/src/components/RubricDisplay.svelte` — section-player shared block renderer.
- `packages/section-player/src/components/SplitPaneResizer.svelte` — extracted split-pane shell.
- `packages/section-player/src/components/ItemRenderer.svelte` — item-player CE composition wrapper.
- `packages/section-player/src/components/SectionPlayerSplitPane.svelte` — active item plus shared context split-pane layout.
- `packages/section-player/src/components/SectionPlayerVertical.svelte` — active item plus shared context vertical layout.
- `packages/section-player/src/components/TestFeedback.svelte` — sanitized test-feedback renderer for assessment-player reuse.
- `packages/section-player/tests/contracts/delivery-context.test.ts` — contract-level delivery context pass-through tests.
- `packages/section-player/tests/composition/resolveQtiSectionComposition.test.ts` — layout/shared-context normalization tests.
- `packages/section-player/tests/security/sanitized-html.test.ts` — shared HTML security tests.
- `packages/assessment-player/src/integration/toSectionComposition.ts` — adapter from current assessment-player state to section-player contracts.
- `packages/player-elements/src/elements/QtiSectionPlayerSplitPaneElement.ts` — custom element wrapper.
- `packages/player-elements/src/elements/QtiSectionPlayerVerticalElement.ts` — custom element wrapper.
- `packages/assessment-toolkit/package.json` — publishable toolkit package manifest.
- `packages/assessment-toolkit/tsconfig.json` — pure TypeScript build.
- `packages/assessment-toolkit/src/index.ts` — public toolkit exports.
- `packages/assessment-toolkit/src/role-view.ts` — QTI role/view visibility helpers.
- `packages/assessment-toolkit/src/shared-context-normalization.ts` — QTI shared context normalization helpers.
- `packages/assessment-toolkit/tests/role-view.test.ts` — role/view tests.
- `packages/assessment-toolkit/tests/shared-context-normalization.test.ts` — shared context tests.
- `.changeset/<generated-name>.md` — new-package and public export changeset.

Modify:

- `packages/item-player/package.json` — add `./security` export.
- `packages/item-player/src/security/index.ts` — public security barrel and shared HTML facade.
- `packages/item-player/tests/security/public-api.test.ts` — public subpath tests.
- `docs/prds/architecture/security.md` — document the public security surface once implemented.
- `packages/assessment-player/package.json` — add `@pie-qti/section-player` dependency after section-player exists.
- `packages/assessment-player/src/components/AssessmentShell.svelte` — delegate active-section content rendering to section-player layouts and render sanitized test feedback.
- `packages/assessment-player/src/core/AssessmentPlayer.ts` — expose enough current state for the adapter without moving orchestration.
- `packages/assessment-player/tests/conformance-qti22-advanced.test.ts` — section/rubric regression.
- `packages/assessment-player/tests/conformance-qti30-advanced.test.ts` — QTI 3 delivery-context regression.
- `packages/player-elements/package.json` — add `@pie-qti/section-player` dependency.
- `packages/player-elements/src/constants.ts` — add section player tag constants.
- `packages/player-elements/src/define.ts` — define section player elements.
- `packages/player-elements/src/index.ts` — export section element types and define helpers.
- `packages/web-component-loaders/src/index.ts` — wait for section player custom elements.
- `packages/web-component-loaders/README.md` — document section player tags.
- `apps/demo/package.json` — add `@pie-qti/section-player` if demo routes import it directly.
- `apps/demo/src/routes/wc-section-splitpane/+page.svelte` — split-pane section player demo route.
- `apps/demo/src/routes/wc-section-vertical/+page.svelte` — vertical section player demo route.
- `apps/demo/tests/playwright/section-player.pw.ts` — demo-backed section player coverage.
- `scripts/check-demo-player-contract.mjs` — allow new section-player demo routes if the checker flags them.
- `.changeset/config.json` — add `@pie-qti/section-player` and `@pie-qti/assessment-toolkit` to the fixed group when packages are created.
- `scripts/publish-policy.json` — add forbidden `./components` public export for `@pie-qti/section-player`; add side-effect requirements only if the package itself ships side-effect element entries.

---

### Task 1: Public Shared-Content Security Surface

**Files:**

- Create: `packages/item-player/src/security/index.ts`
- Create: `packages/item-player/tests/security/public-api.test.ts`
- Modify: `packages/item-player/package.json`
- Modify: `docs/prds/architecture/security.md`

**Interfaces:**

- Consumes: existing `PlayerSecurityConfig`, `UrlPolicyConfig`, `ParsingLimitsConfig`, `HtmlContent`, `sanitizeHtml`, `sanitizeTextContent`, `sanitizeResourceUrl`, `normalizeParsingLimits`, `enforceItemXmlLimits`, `toTrustedHtml`, `htmlToString`, `applyInteractionSecurity`.
- Produces: `@pie-qti/item-player/security` subpath and `sanitizeSharedHtml(html, security?)`.

- [ ] **Step 1: Add the public security barrel**

Create `packages/item-player/src/security/index.ts`:

```ts
import { sanitizeHtml, sanitizeTextContent, type SanitizeHtmlOptions } from '../core/sanitizer.js';
import { sanitizeResourceUrl, type UrlKind } from '../core/urlPolicy.js';
import { toTrustedHtml, htmlToString } from '../core/trustedTypes.js';
import type { HtmlContent, PlayerSecurityConfig } from '../types/index.js';

export { sanitizeHtml, sanitizeTextContent, type SanitizeHtmlOptions };
export { sanitizeResourceUrl, type UrlKind };
export {
  enforceItemXmlLimits,
  normalizeParsingLimits,
  type NormalizedParsingLimits,
} from '../core/parsingLimits.js';
export { toTrustedHtml, htmlToString };
export { applyInteractionSecurity } from '../extraction/interactionSecurity.js';
export type {
  HtmlContent,
  ParsingLimitsConfig,
  PlayerSecurityConfig,
  TrustedTypesHtml,
  UrlPolicyConfig,
} from '../types/index.js';

export function sanitizeSharedHtml(html: string, security?: PlayerSecurityConfig): HtmlContent {
  const sanitized = sanitizeHtml(html, { security });
  return toTrustedHtml(sanitized, security?.trustedTypesPolicyName);
}
```

- [ ] **Step 2: Export the security subpath**

Add this entry to `packages/item-player/package.json` inside `exports`:

```json
"./security": {
  "types": "./dist/security/index.d.ts",
  "import": "./dist/security/index.js"
}
```

Keep existing exports unchanged.

- [ ] **Step 3: Write public security API tests**

Create `packages/item-player/tests/security/public-api.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import {
  enforceItemXmlLimits,
  sanitizeResourceUrl,
  sanitizeSharedHtml,
  type PlayerSecurityConfig,
} from '../../src/security/index.js';

describe('@pie-qti/item-player/security public API', () => {
  test('sanitizeSharedHtml strips script tags and event handlers', () => {
    const html = '<p onclick="alert(1)">Safe text</p><script>alert(2)</script>';

    const sanitized = String(sanitizeSharedHtml(html));

    expect(sanitized).toContain('Safe text');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onclick');
  });

  test('sanitizeSharedHtml applies the same URL policy shape as item-player', () => {
    const security: PlayerSecurityConfig = {
      urlPolicy: {
        allowHttps: true,
        allowHttp: false,
      },
    };

    const sanitized = String(sanitizeSharedHtml('<img src="javascript:alert(1)"><a href="http://example.test">x</a>', security));

    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('http://example.test');
  });

  test('sanitizeResourceUrl honors blocked URL schemes', () => {
    expect(sanitizeResourceUrl('javascript:alert(1)', undefined, 'img')).toBeNull();
  });

  test('enforceItemXmlLimits remains opt-in through parsingLimits', () => {
    expect(() => enforceItemXmlLimits('<!DOCTYPE qti><assessmentItem />')).not.toThrow();
    expect(() =>
      enforceItemXmlLimits('<!DOCTYPE qti><assessmentItem />', {
        parsingLimits: { enabled: true, rejectDoctype: true },
      })
    ).toThrow();
  });
});
```

- [ ] **Step 4: Run the item-player security tests and verify the expected failure first**

Run:

```bash
cd packages/item-player && bun test tests/security/public-api.test.ts
```

Expected before implementation is complete: fail because `src/security/index.ts` or the export does not exist. Expected after Steps 1-3: pass.

- [ ] **Step 5: Document the public security surface**

Add a short "Public shared-content API" subsection to `docs/prds/architecture/security.md` after the functional requirements:

```md
### Public shared-content API

`@pie-qti/item-player/security` exposes the sanitizer, URL policy, parsing-limit helpers, Trusted Types bridge, and `sanitizeSharedHtml(html, security?)` facade for QTI-derived shared content outside item bodies. Section-player and assessment-player shared passage, rubric, stimulus, and test-feedback render sinks must use this API instead of deep-importing `item-player/src/core/*`.
```

- [ ] **Step 6: Verify Task 1**

Run:

```bash
cd packages/item-player && bun test tests/security/public-api.test.ts
bun run typecheck
bun run build
```

Expected: both commands pass.

---

### Task 2: Section Player Contracts Package

**Files:**

- Create: `packages/section-player/package.json`
- Create: `packages/section-player/tsconfig.json`
- Create: `packages/section-player/src/index.ts`
- Create: `packages/section-player/src/contracts/index.ts`
- Create: `packages/section-player/src/contracts/layout-contract.ts`
- Create: `packages/section-player/src/contracts/runtime-host-contract.ts`
- Create: `packages/section-player/src/visibility/role-view.ts`
- Create: `packages/section-player/tests/contracts/delivery-context.test.ts`
- Modify: `.changeset/config.json`
- Modify: `scripts/publish-policy.json`
- Create: `.changeset/<generated-name>.md`

**Interfaces:**

- Consumes: `ResolvedItemDeliveryContext` from `@pie-qti/ims-cp-core`, `SerializedItemSessionState` and `PlayerSecurityConfig` from `@pie-qti/item-player`.
- Produces: public `@pie-qti/section-player` contracts without Svelte components or assessment-player imports.

- [ ] **Step 1: Scaffold package metadata**

Create `packages/section-player/package.json`:

```json
{
  "name": "@pie-qti/section-player",
  "version": "0.1.13",
  "description": "QTI section renderer contracts and layouts for composing item players with shared section context",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  },
  "keywords": ["qti", "qti2", "qti3", "assessment", "section", "player"],
  "license": "MIT",
  "dependencies": {
    "@pie-qti/ims-cp-core": "workspace:*",
    "@pie-qti/item-player": "workspace:*"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.8",
    "@types/node": "^25.0.3",
    "typescript": "^5.9.3"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/pie-framework/pie-qti.git",
    "directory": "packages/section-player"
  },
  "homepage": "https://github.com/pie-framework/pie-qti/tree/master/packages/section-player",
  "bugs": {
    "url": "https://github.com/pie-framework/pie-qti/issues"
  },
  "publishConfig": {
    "access": "public"
  },
  "sideEffects": false,
  "engines": {
    "node": ">=20.19.0"
  },
  "files": ["dist"]
}
```

- [ ] **Step 2: Add TypeScript config**

Create `packages/section-player/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "tsBuildInfoFile": "./tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/*.svelte",
    "src/components/index.ts"
  ]
}
```

- [ ] **Step 3: Add layout contracts**

Create `packages/section-player/src/contracts/layout-contract.ts`:

```ts
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { HtmlContent, PlayerSecurityConfig, SerializedItemSessionState } from '@pie-qti/item-player';
import type { QtiSectionDiagnostic, QtiSectionRuntimeHostContract } from './runtime-host-contract.js';

export type QtiSectionLayoutPreference = 'split-pane' | 'vertical' | 'auto';
export type QtiSectionResolvedLayout = 'split-pane' | 'vertical';
export type QtiSectionRole = 'candidate' | 'scorer' | 'author' | 'proctor' | 'tutor' | 'testConstructor';
export type QtiSectionNavigationMode = 'linear' | 'nonlinear';
export type QtiSectionSubmissionMode = 'individual' | 'simultaneous';
export type QtiSharedHtmlBlockKind = 'passage' | 'instructions' | 'rubric' | 'stimulus' | 'test-feedback';
export type QtiSharedHtmlBlockScope = 'assessment' | 'testPart' | 'section' | 'item' | 'stimulus';

export interface QtiSectionModel {
  identifier: string;
  title?: string;
  role?: QtiSectionRole;
  view?: string[];
  layoutPreference?: QtiSectionLayoutPreference;
  navigationMode?: QtiSectionNavigationMode;
  submissionMode?: QtiSectionSubmissionMode;
  itemRefs: QtiSectionItemRef[];
  sharedContext?: QtiSharedContext;
  diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiSectionItemRef {
  identifier: string;
  sourcePath?: string;
  href?: string;
  title?: string;
  itemXml: string;
  responses?: Record<string, unknown>;
  sessionSnapshot?: SerializedItemSessionState;
  deliveryContext?: ResolvedItemDeliveryContext;
  diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiSharedHtmlBlock {
  identifier: string;
  kind: QtiSharedHtmlBlockKind;
  scope: QtiSharedHtmlBlockScope;
  source?: string;
  view?: string[];
  rawHtml?: string;
  html?: HtmlContent;
}

export interface QtiSharedStimulus {
  identifier: string;
  href?: string;
  source?: string;
  bodyHtml?: HtmlContent;
  rawBodyHtml?: string;
  stylesheets?: QtiResolvedStylesheetRef[];
  catalogSource?: QtiResolvedCatalogSource;
  diagnostics?: QtiSectionDiagnostic[];
}

export interface QtiResolvedStylesheetRef {
  href: string;
  resolvedHref?: string;
  source?: string;
}

export interface QtiResolvedCatalogSource {
  scope: 'item' | 'stimulus' | 'section';
  xml: string;
  baseHref?: string;
  stimulusIdentifier?: string;
}

export interface QtiSharedContext {
  passages: QtiSharedHtmlBlock[];
  stimuli: QtiSharedStimulus[];
  rubricBlocks: QtiSharedHtmlBlock[];
  testFeedback: QtiSharedHtmlBlock[];
  stylesheets: QtiResolvedStylesheetRef[];
  catalogSources: QtiResolvedCatalogSource[];
  assetDiagnostics: QtiSectionDiagnostic[];
}

export interface QtiSectionSnapshot {
  sectionIdentifier: string;
  activeItemIdentifier: string;
  activeItemIndex: number;
  itemCount: number;
  responses: Record<string, Record<string, unknown>>;
}

export interface ResolvedQtiSectionComposition {
  section: QtiSectionModel;
  activeItem: QtiSectionItemRef;
  activeItemIndex: number;
  sharedContext: QtiSharedContext;
  layout: QtiSectionResolvedLayout;
  canPrevious: boolean;
  canNext: boolean;
  snapshot: QtiSectionSnapshot;
  diagnostics: QtiSectionDiagnostic[];
  security?: PlayerSecurityConfig;
  host?: QtiSectionRuntimeHostContract;
}

export interface ResolveQtiSectionCompositionOptions {
  section: QtiSectionModel;
  activeItemIdentifier?: string;
  activeItemIndex?: number;
  canPrevious?: boolean;
  canNext?: boolean;
  responsesByItemIdentifier?: Record<string, Record<string, unknown>>;
  security?: PlayerSecurityConfig;
  host?: QtiSectionRuntimeHostContract;
}
```

- [ ] **Step 4: Add runtime host contracts**

Create `packages/section-player/src/contracts/runtime-host-contract.ts`:

```ts
export type QtiSectionDiagnosticSeverity = 'info' | 'warning' | 'error';
export type QtiSectionDiagnosticSource =
  | 'assessment-player'
  | 'composer'
  | 'manifest'
  | 'assessment-test'
  | 'item'
  | 'stimulus'
  | 'security'
  | 'section-player';

export interface QtiSectionDiagnostic {
  severity: QtiSectionDiagnosticSeverity;
  source: QtiSectionDiagnosticSource;
  code: string;
  message: string;
  path?: string;
}

export interface QtiPackageResolveContext {
  ownerHref?: string;
  referenceKind: 'item' | 'passage' | 'stimulus' | 'stylesheet' | 'catalog-file' | 'asset' | 'source-xml';
}

export interface QtiSharedHtmlSanitizeContext {
  source?: string;
  kind: 'passage' | 'rubric' | 'stimulus' | 'test-feedback' | 'instructions';
}

export interface QtiAssetUrlPolicyContext {
  source?: string;
  kind: 'img' | 'media' | 'object' | 'link' | 'any';
}

export interface QtiSectionResponseDeltaEvent {
  sectionIdentifier: string;
  itemIdentifier: string;
  responseIdentifier: string;
  value: unknown;
}

export interface QtiSectionActiveItemChangeEvent {
  sectionIdentifier: string;
  itemIdentifier: string;
  itemIndex: number;
  itemCount: number;
}

export interface QtiSectionFrameworkError {
  sectionIdentifier?: string;
  itemIdentifier?: string;
  code: string;
  message: string;
  cause?: unknown;
}

export interface QtiSectionRuntimeHostContract {
  resolvePackageUrl?(href: string, context: QtiPackageResolveContext): string | null;
  readPackageFile?(href: string, context: QtiPackageResolveContext): Promise<string | Uint8Array | null>;
  sanitizeSharedHtml?(html: string, context: QtiSharedHtmlSanitizeContext): string;
  sanitizeAssetUrl?(href: string, context: QtiAssetUrlPolicyContext): string | null;
  onResponseDelta?(event: QtiSectionResponseDeltaEvent): void;
  onActiveItemChange?(event: QtiSectionActiveItemChangeEvent): void;
  onSnapshotChange?(snapshot: import('./layout-contract.js').QtiSectionSnapshot): void;
  onFrameworkError?(error: QtiSectionFrameworkError): void;
}
```

- [ ] **Step 5: Add barrels**

Create `packages/section-player/src/visibility/role-view.ts`:

```ts
import type { QtiSectionRole } from '../contracts/index.js';

export function normalizeQtiViewTokens(view: string[] | undefined): string[] {
  return (view ?? [])
    .flatMap((token) => token.split(/[\s,]+/))
    .map((token) => token.trim())
    .filter(Boolean);
}

export function isQtiViewVisibleForRole(view: string[] | undefined, role: QtiSectionRole = 'candidate'): boolean {
  const tokens = normalizeQtiViewTokens(view);
  if (tokens.length === 0) return true;
  return tokens.includes(role);
}
```

Create `packages/section-player/src/contracts/index.ts`:

```ts
export * from './layout-contract.js';
export * from './runtime-host-contract.js';
```

Create `packages/section-player/src/index.ts`:

```ts
export * from './contracts/index.js';
export * from './visibility/role-view.js';
```

- [ ] **Step 6: Add delivery context contract test**

Create `packages/section-player/tests/contracts/delivery-context.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';
import type { QtiSectionItemRef } from '../../src/index.js';

describe('QtiSectionItemRef', () => {
  test('accepts per-item ResolvedItemDeliveryContext without reshaping', () => {
    const deliveryContext: ResolvedItemDeliveryContext = {
      itemHref: 'items/item-1.xml',
      stimuli: {
        stim1: {
          identifier: 'stim1',
          href: 'stimuli/stim1.xml',
          resolvedHref: 'stimuli/stim1.xml',
          bodyHtml: '<p>Stimulus</p>',
          stylesheets: [
            {
              href: 'stimuli/stim1.css',
              resolvedHref: 'stimuli/stim1.css',
            },
          ],
          validationMessages: [],
        },
      },
      stylesheets: [],
      catalogSources: [],
      validationMessages: [],
    };

    const itemRef: QtiSectionItemRef = {
      identifier: 'item-1',
      href: 'items/item-1.xml',
      itemXml: '<assessmentItem identifier="item-1" />',
      deliveryContext,
    };

    expect(itemRef.deliveryContext).toBe(deliveryContext);
    expect(itemRef.deliveryContext?.stimuli.stim1.stylesheets[0]?.href).toBe('stimuli/stim1.css');
  });
});
```

- [ ] **Step 7: Register publish metadata**

Add `@pie-qti/section-player` to the fixed package array in `.changeset/config.json`.

Add this to `scripts/publish-policy.json` under `forbiddenPublicExports`:

```json
"@pie-qti/section-player": [
  "./components"
]
```

Create a changeset:

```md
---
"@pie-qti/section-player": patch
"@pie-qti/item-player": patch
"@pie-qti/assessment-player": patch
"@pie-qti/player-elements": patch
"@pie-qti/web-component-loaders": patch
---

Add section-player contracts and expose the shared item-player security surface for QTI shared content.
```

- [ ] **Step 8: Verify Task 2**

Run:

```bash
bun install
cd packages/section-player && bun test && bun run typecheck && bun run build
bun --cwd ../.. run check:package-metadata
bun --cwd ../.. run check:fixed-versioning
bun --cwd ../.. run check:publish-surface
```

Expected: all commands pass. If `check:deps` fails later, add only the missing runtime dependencies that correspond to actual imports.

---

### Task 3: Section Composition Resolver

**Files:**

- Create: `packages/section-player/src/composition/resolveQtiSectionComposition.ts`
- Modify: `packages/section-player/src/index.ts`
- Create: `packages/section-player/tests/composition/resolveQtiSectionComposition.test.ts`

**Interfaces:**

- Consumes: contracts from Task 2.
- Produces: `resolveQtiSectionComposition(options)` pure helper.

- [ ] **Step 1: Write failing resolver tests**

Create `packages/section-player/tests/composition/resolveQtiSectionComposition.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { resolveQtiSectionComposition, type QtiSectionModel } from '../../src/index.js';

const section: QtiSectionModel = {
  identifier: 'section-1',
  title: 'Reading section',
  itemRefs: [
    {
      identifier: 'item-1',
      itemXml: '<assessmentItem identifier="item-1" />',
      responses: { RESPONSE: 'A' },
    },
    {
      identifier: 'item-2',
      itemXml: '<assessmentItem identifier="item-2" />',
    },
  ],
  sharedContext: {
    passages: [
      {
        identifier: 'passage-1',
        kind: 'passage',
        scope: 'section',
        rawHtml: '<p>Passage</p>',
        view: ['candidate'],
      },
    ],
    stimuli: [],
    rubricBlocks: [],
    testFeedback: [],
    stylesheets: [],
    catalogSources: [],
    assetDiagnostics: [],
  },
};

describe('resolveQtiSectionComposition', () => {
  test('selects active item by identifier and split-pane layout when passages exist', () => {
    const composition = resolveQtiSectionComposition({
      section,
      activeItemIdentifier: 'item-2',
      canPrevious: true,
      canNext: false,
      responsesByItemIdentifier: {
        'item-1': { RESPONSE: 'A' },
        'item-2': {},
      },
    });

    expect(composition.activeItem.identifier).toBe('item-2');
    expect(composition.activeItemIndex).toBe(1);
    expect(composition.layout).toBe('split-pane');
    expect(composition.snapshot.activeItemIdentifier).toBe('item-2');
    expect(composition.snapshot.responses['item-1']?.RESPONSE).toBe('A');
  });

  test('uses vertical layout when no passages or split-pane stimuli exist', () => {
    const composition = resolveQtiSectionComposition({
      section: {
        ...section,
        sharedContext: {
          passages: [],
          stimuli: [],
          rubricBlocks: [],
          testFeedback: [],
          stylesheets: [],
          catalogSources: [],
          assetDiagnostics: [],
        },
      },
      activeItemIndex: 0,
    });

    expect(composition.layout).toBe('vertical');
  });

  test('adds an error diagnostic and falls back to first item for an unknown active item', () => {
    const composition = resolveQtiSectionComposition({
      section,
      activeItemIdentifier: 'missing-item',
    });

    expect(composition.activeItem.identifier).toBe('item-1');
    expect(composition.diagnostics.some((d) => d.code === 'active-item-not-found')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the resolver test to verify it fails**

Run:

```bash
cd packages/section-player && bun test tests/composition/resolveQtiSectionComposition.test.ts
```

Expected: fail because `resolveQtiSectionComposition` is not exported.

- [ ] **Step 3: Implement the pure resolver**

Create `packages/section-player/src/composition/resolveQtiSectionComposition.ts`:

```ts
import type {
  QtiSectionDiagnostic,
  QtiSectionModel,
  QtiSectionSnapshot,
  ResolveQtiSectionCompositionOptions,
  ResolvedQtiSectionComposition,
} from '../contracts/index.js';

function emptySharedContext(): NonNullable<QtiSectionModel['sharedContext']> {
  return {
    passages: [],
    stimuli: [],
    rubricBlocks: [],
    testFeedback: [],
    stylesheets: [],
    catalogSources: [],
    assetDiagnostics: [],
  };
}

function resolveActiveIndex(options: ResolveQtiSectionCompositionOptions, diagnostics: QtiSectionDiagnostic[]): number {
  if (options.activeItemIdentifier) {
    const index = options.section.itemRefs.findIndex((item) => item.identifier === options.activeItemIdentifier);
    if (index >= 0) return index;

    diagnostics.push({
      severity: 'error',
      source: 'section-player',
      code: 'active-item-not-found',
      message: `Active item "${options.activeItemIdentifier}" was not found in section "${options.section.identifier}".`,
    });
  }

  if (typeof options.activeItemIndex === 'number' && options.activeItemIndex >= 0 && options.activeItemIndex < options.section.itemRefs.length) {
    return options.activeItemIndex;
  }

  return 0;
}

function resolveLayout(section: QtiSectionModel, sharedContext: NonNullable<QtiSectionModel['sharedContext']>): 'split-pane' | 'vertical' {
  if (section.layoutPreference === 'split-pane') return 'split-pane';
  if (section.layoutPreference === 'vertical') return 'vertical';
  return sharedContext.passages.length > 0 ? 'split-pane' : 'vertical';
}

export function resolveQtiSectionComposition(options: ResolveQtiSectionCompositionOptions): ResolvedQtiSectionComposition {
  const diagnostics: QtiSectionDiagnostic[] = [...(options.section.diagnostics ?? [])];

  if (options.section.itemRefs.length === 0) {
    diagnostics.push({
      severity: 'error',
      source: 'section-player',
      code: 'empty-section',
      message: `Section "${options.section.identifier}" does not contain any item refs.`,
    });
  }

  const activeItemIndex = resolveActiveIndex(options, diagnostics);
  const activeItem = options.section.itemRefs[activeItemIndex] ?? {
    identifier: '',
    itemXml: '',
  };
  const sharedContext = options.section.sharedContext ?? emptySharedContext();
  const role = options.section.role ?? 'candidate';
  const filterBlock = (block: { view?: string[] }) => isQtiViewVisibleForRole(block.view, role);
  const visibleSharedContext = {
    ...sharedContext,
    passages: sharedContext.passages.filter(filterBlock),
    rubricBlocks: sharedContext.rubricBlocks.filter(filterBlock),
    testFeedback: sharedContext.testFeedback.filter(filterBlock),
  };
  const responsesByItemIdentifier = options.responsesByItemIdentifier ?? {
    [activeItem.identifier]: activeItem.responses ?? {},
  };
  const snapshot: QtiSectionSnapshot = {
    sectionIdentifier: options.section.identifier,
    activeItemIdentifier: activeItem.identifier,
    activeItemIndex,
    itemCount: options.section.itemRefs.length,
    responses: responsesByItemIdentifier,
  };

  return {
    section: {
      ...options.section,
      sharedContext: visibleSharedContext,
    },
    activeItem,
    activeItemIndex,
    sharedContext: visibleSharedContext,
    layout: resolveLayout(options.section, visibleSharedContext),
    canPrevious: options.canPrevious ?? activeItemIndex > 0,
    canNext: options.canNext ?? activeItemIndex < options.section.itemRefs.length - 1,
    snapshot,
    diagnostics: [...diagnostics, ...visibleSharedContext.assetDiagnostics],
    security: options.security,
    host: options.host,
  };
}
```

Import `isQtiViewVisibleForRole` from `../visibility/role-view.js`. Add a resolver test proving scorer-only shared blocks are absent from both `composition.sharedContext` and `composition.section.sharedContext` for a candidate `ResolvedQtiSectionComposition`, not merely hidden by Svelte renderers.

- [ ] **Step 4: Export the resolver**

Update `packages/section-player/src/index.ts`:

```ts
export * from './contracts/index.js';
export * from './visibility/role-view.js';
export { resolveQtiSectionComposition } from './composition/resolveQtiSectionComposition.js';
```

- [ ] **Step 5: Add shared asset URL policy tests**

Extend `packages/section-player/tests/composition/resolveQtiSectionComposition.test.ts` with a blocked shared stylesheet case:

```ts
test('emits diagnostics for shared asset URLs blocked by host policy', () => {
  const composition = resolveQtiSectionComposition({
    section: {
      ...section,
      sharedContext: {
        passages: [],
        stimuli: [],
        rubricBlocks: [],
        testFeedback: [],
        stylesheets: [{ href: 'javascript:alert(1)' }],
        catalogSources: [],
        assetDiagnostics: [],
      },
    },
    activeItemIndex: 0,
    host: {
      sanitizeAssetUrl: () => null,
    },
  });

  expect(composition.diagnostics.some((diagnostic) => diagnostic.code === 'shared-asset-url-blocked')).toBe(true);
});

test('blocks unsafe shared asset URLs with the baseline security policy even without a host hook', () => {
  const composition = resolveQtiSectionComposition({
    section: {
      ...section,
      sharedContext: {
        passages: [],
        stimuli: [],
        rubricBlocks: [],
        testFeedback: [],
        stylesheets: [{ href: 'http://example.test/unsafe.css' }],
        catalogSources: [],
        assetDiagnostics: [],
      },
    },
    activeItemIndex: 0,
  });

  expect(composition.diagnostics.some((diagnostic) => diagnostic.code === 'shared-asset-url-blocked')).toBe(true);
});
```

Update `resolveQtiSectionComposition` so package-relative hrefs and browser-renderable URLs stay separate. Preflight raw package hrefs with `sanitizeResourceUrl(href, { ...security?.urlPolicy, assetBaseUrl: undefined }, kind)` so dangerous schemes are blocked without rewriting package paths. Then call `host?.resolvePackageUrl` with the original package-relative href. Sanitize the returned browser URL with `sanitizeResourceUrl(browserHref, security?.urlPolicy, kind)`, then let `host?.sanitizeAssetUrl` further restrict it. Store package-relative evidence in `href` / `resolvedHref`; store only sanitized renderable URLs in a separate `renderHref` / `browserHref` field if a renderer needs them. In v1, shared `stylesheets` and stimulus stylesheet refs are diagnostics/pass-through data and must not be inserted into DOM `<link>` or `<style>` sinks. If a later task renders shared CSS, add scoped CSS sanitization using existing stylesheet-blocking helpers and malicious CSS tests for `@import`, `url(...)`, `javascript:`, and `data:`.

For v1, `QtiSharedContext.stimuli[*].rawBodyHtml` and `bodyHtml` are context data for diagnostics and future layout work, not a render surface. If implementation renders stimulus bodies outside the nested item-player delivery context, add a `StimulusDisplay.svelte` component that uses `SanitizedHtml` and add malicious stimulus-body tests before exposing that rendering.

- [ ] **Step 6: Verify Task 3**

Run:

```bash
cd packages/section-player && bun test tests/composition/resolveQtiSectionComposition.test.ts && bun run typecheck
```

Expected: pass.

---

### Task 4: Section Player Layout Components

**Files:**

- Create: `packages/section-player/tsconfig.svelte.json`
- Create: `packages/section-player/svelte.config.js`
- Modify: `packages/section-player/package.json`
- Create: `packages/section-player/src/security/sanitizeSharedHtml.ts`
- Create: `packages/section-player/src/components/SanitizedHtml.svelte`
- Create: `packages/section-player/src/components/RubricDisplay.svelte`
- Create: `packages/section-player/src/components/SplitPaneResizer.svelte`
- Create: `packages/section-player/src/components/ItemRenderer.svelte`
- Create: `packages/section-player/src/components/SectionPlayerSplitPane.svelte`
- Create: `packages/section-player/src/components/SectionPlayerVertical.svelte`
- Create: `packages/section-player/src/components/index.ts`
- Create: `packages/section-player/tests/security/sanitized-html.test.ts`

**Interfaces:**

- Consumes: `ResolvedQtiSectionComposition`, `QtiSharedHtmlBlock`, `PlayerSecurityConfig`, `@pie-qti/item-player/security`, `@pie-qti/item-player/element`, `@pie-qti/default-components/plugins`, `@pie-qti/qti-common`.
- Produces: internal Svelte components for later `assessment-player` and `player-elements` usage. No `./components` package export.

- [ ] **Step 1: Add Svelte package dependencies and scripts**

Update `packages/section-player/package.json`:

```json
"dependencies": {
  "@pie-qti/default-components": "workspace:*",
  "@pie-qti/i18n": "workspace:*",
  "@pie-qti/ims-cp-core": "workspace:*",
  "@pie-qti/item-player": "workspace:*",
  "@pie-qti/qti-common": "workspace:*"
},
"devDependencies": {
  "@biomejs/biome": "^2.4.8",
  "@sveltejs/vite-plugin-svelte": "^7.0.0",
  "@types/node": "^25.0.3",
  "svelte": "^5.54.0",
  "svelte-check": "^4.3.5",
  "typescript": "^5.9.3"
},
"scripts": {
  "build": "tsc",
  "test": "bun test",
  "typecheck": "tsc --noEmit",
  "check": "svelte-check --tsconfig ./tsconfig.svelte.json",
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "format": "biome format --write ."
}
```

- [ ] **Step 2: Add Svelte config files**

Create `packages/section-player/svelte.config.js`:

```js
export default {
  compilerOptions: {
    runes: true,
  },
};
```

Create `packages/section-player/tsconfig.svelte.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "allowArbitraryExtensions": true
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Add shared HTML sanitizer wrapper**

Create `packages/section-player/src/security/sanitizeSharedHtml.ts`:

```ts
import { sanitizeSharedHtml as sanitizeItemPlayerSharedHtml } from '@pie-qti/item-player/security';
import type { HtmlContent, PlayerSecurityConfig } from '@pie-qti/item-player';
import type { QtiSharedHtmlSanitizeContext, QtiSectionRuntimeHostContract } from '../contracts/index.js';

export function sanitizeSectionSharedHtml(
  html: string,
  security: PlayerSecurityConfig | undefined,
  context: QtiSharedHtmlSanitizeContext,
  host?: QtiSectionRuntimeHostContract
): HtmlContent {
  const hostResult = host?.sanitizeSharedHtml?.(html, context);
  return sanitizeItemPlayerSharedHtml(hostResult ?? html, security);
}
```

- [ ] **Step 4: Add security test before component wiring**

Create `packages/section-player/tests/security/sanitized-html.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { sanitizeSectionSharedHtml } from '../../src/security/sanitizeSharedHtml.js';

describe('sanitizeSectionSharedHtml', () => {
  test('sanitizes shared passage html before render sinks', () => {
    const sanitized = String(
      sanitizeSectionSharedHtml('<p onclick="alert(1)">Passage</p><script>alert(2)</script>', undefined, {
        kind: 'passage',
        source: 'section-1',
      })
    );

    expect(sanitized).toContain('Passage');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('<script');
  });

  test('re-sanitizes precomputed html values before render sinks', () => {
    const sanitized = String(
      sanitizeSectionSharedHtml('<img src=x onerror="alert(1)">', undefined, {
        kind: 'rubric',
        source: 'section-1',
      })
    );

    expect(sanitized).not.toContain('onerror');
  });
});
```

Run:

```bash
cd packages/section-player && bun test tests/security/sanitized-html.test.ts
```

Expected: pass after Step 3.

- [ ] **Step 5: Implement `SanitizedHtml.svelte`**

Create `packages/section-player/src/components/SanitizedHtml.svelte`:

```svelte
<script lang="ts">
  import { typesetAction } from '@pie-qti/default-components/shared';
  import { htmlToString } from '@pie-qti/item-player/security';
  import type { HtmlContent, PlayerSecurityConfig } from '@pie-qti/item-player';
  import type { QtiSectionRuntimeHostContract, QtiSharedHtmlSanitizeContext } from '../contracts/index.js';
  import { sanitizeSectionSharedHtml } from '../security/sanitizeSharedHtml.js';

  interface Props {
    html?: HtmlContent;
    rawHtml?: string;
    security?: PlayerSecurityConfig;
    host?: QtiSectionRuntimeHostContract;
    sanitizeContext: QtiSharedHtmlSanitizeContext;
    class?: string;
    typeset?: (root: HTMLElement) => void | Promise<void>;
  }

  const {
    html,
    rawHtml = '',
    security,
    host,
    sanitizeContext,
    class: className = '',
    typeset,
  }: Props = $props();

  const unsafeHtml = $derived(html === undefined ? rawHtml : htmlToString(html));
  const content = $derived(sanitizeSectionSharedHtml(unsafeHtml, security, sanitizeContext, host));
</script>

<div use:typesetAction={{ typeset }} class={className}>
  {@html content}
</div>
```

- [ ] **Step 6: Extract shared block renderer**

Create `packages/section-player/src/components/RubricDisplay.svelte` by copying the existing assessment-player structure, but replace every `{@html ...}` with `SanitizedHtml`. The critical render block must look like:

```svelte
<SanitizedHtml
  rawHtml={passage.rawHtml}
  html={passage.html}
  {security}
  {host}
  sanitizeContext={{ kind: 'passage', source: passage.source }}
  class="passage-content prose max-w-none"
  {typeset}
/>
```

The component props must include the render role and must filter before rendering:

```ts
interface Props {
  passages?: QtiSharedHtmlBlock[];
  rubricBlocks?: QtiSharedHtmlBlock[];
  role?: QtiSectionRole;
  collapsed?: boolean;
  i18n?: I18nProvider;
  security?: PlayerSecurityConfig;
  host?: QtiSectionRuntimeHostContract;
  typeset?: (root: HTMLElement) => void | Promise<void>;
}
```

The role/view filtering must be mandatory:

```ts
import { isQtiViewVisibleForRole } from '../visibility/role-view.js';

const isVisibleForRole = (block: QtiSharedHtmlBlock) => isQtiViewVisibleForRole(block.view, role);

const visiblePassages = $derived(passages.filter(isVisibleForRole));
const visibleRubricBlocks = $derived(rubricBlocks.filter(isVisibleForRole));
```

Default the prop before this filter runs:

```ts
const {
  passages = [],
  rubricBlocks = [],
  role = 'candidate',
  collapsed = false,
  i18n,
  security,
  host,
  typeset,
}: Props = $props();
```

- [ ] **Step 7: Copy split-pane resizer with preserved behavior**

Create `packages/section-player/src/components/SplitPaneResizer.svelte` from `packages/assessment-player/src/components/SplitPaneResizer.svelte`, but make the left pane layout-only. Do not keep an internal `RubricDisplay blocks={leftContent}` path from the old component because that would bypass the new role/security/host/typeset props.

Preserve:

- keyboard resizing with ArrowLeft, ArrowRight, Home, End
- touch and pointer behavior
- `storageKey="pie-qti22-assessment-player.splitLeftPct"` default, unless a prop overrides it
- `accessibility.resizer` i18n label

The new component API must let `SectionPlayerSplitPane.svelte` own sanitized left-pane rendering:

```ts
interface Props {
  i18n?: I18nProvider;
  storageKey?: string;
  leftPane?: Snippet;
  children?: Snippet;
}
```

If Svelte snippets are not compatible with the package's current Svelte version, use named slots or a minimal wrapper component. The key requirement is that the split-pane resizer does not render shared HTML itself.

- [ ] **Step 8: Extract item renderer**

Create `packages/section-player/src/components/ItemRenderer.svelte` from the assessment-player component.

The props must include:

```ts
interface Props {
  itemRef: QtiSectionItemRef;
  responses?: Record<string, unknown>;
  role?: QtiSectionRole;
  disabled?: boolean;
  i18n?: I18nProvider;
  security?: PlayerSecurityConfig;
  pnp?: PnpProfile;
  extendedTextEditor?: 'tiptap' | 'textarea';
  typeset?: (root: HTMLElement) => void | Promise<void>;
  onResponseChange?: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
  onFrameworkError?: (error: QtiSectionFrameworkError) => void;
}
```

When the nested `pie-qti-item-player` emits a response change, call:

```ts
onResponseChange?.(itemRef.identifier, responseIdentifier, value);
```

This item identifier is required because multiple items can reuse the same QTI response identifier.

When assigning props to the nested `pie-qti-item-player`, pass:

```ts
responses: responses ?? itemRef.responses ?? {},
deliveryContext: itemRef.deliveryContext,
itemXml: itemRef.itemXml,
security,
pnp,
role,
disabled,
typeset,
```

Add a regression test before or during Task 5 that answers item 1, navigates to item 2, navigates back, and verifies item 1's response remains visible and isolated from item 2 even when both items use `responseIdentifier="RESPONSE"`.

- [ ] **Step 9: Implement split-pane and vertical layout wrappers**

Create `packages/section-player/src/components/SectionPlayerSplitPane.svelte`:

```svelte
<script lang="ts">
  import type { I18nProvider } from '@pie-qti/i18n';
  import type { PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
  import type { ResolvedQtiSectionComposition } from '../contracts/index.js';
  import ItemRenderer from './ItemRenderer.svelte';
  import RubricDisplay from './RubricDisplay.svelte';
  import SplitPaneResizer from './SplitPaneResizer.svelte';

  interface Props {
    composition: ResolvedQtiSectionComposition;
    i18n?: I18nProvider;
    security?: PlayerSecurityConfig;
    pnp?: PnpProfile;
    extendedTextEditor?: 'tiptap' | 'textarea';
    typeset?: (root: HTMLElement) => void | Promise<void>;
    onResponseChange?: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
    onItemPaneReady?: (element: HTMLElement) => void;
  }

  const { composition, i18n, security, pnp, extendedTextEditor, typeset, onResponseChange, onItemPaneReady }: Props = $props();
  const role = $derived(composition.section.role ?? 'candidate');
  const effectiveSecurity = $derived(security ?? composition.security);
</script>

<SplitPaneResizer
  storageKey="pie-qti22-assessment-player.splitLeftPct"
  {i18n}
>
  {#snippet leftPane()}
    <RubricDisplay
      passages={composition.sharedContext.passages}
      {role}
      {i18n}
      security={effectiveSecurity}
      host={composition.host}
      {typeset}
    />
  {/snippet}
  <div class="section-player-right-pane" tabindex="-1" bind:this={onItemPaneReady}>
    <RubricDisplay
      rubricBlocks={composition.sharedContext.rubricBlocks}
      {role}
      {i18n}
      security={effectiveSecurity}
      host={composition.host}
      {typeset}
    />
    <ItemRenderer
      itemRef={composition.activeItem}
      responses={composition.snapshot.responses[composition.activeItem.identifier] ?? composition.activeItem.responses ?? {}}
      {role}
      disabled={role !== 'candidate'}
      {i18n}
      security={effectiveSecurity}
      {pnp}
      {extendedTextEditor}
      {typeset}
      {onResponseChange}
    />
  </div>
</SplitPaneResizer>
```

Adjust `bind:this={onItemPaneReady}` if Svelte rejects binding to a callback; the accepted form is to bind to a local `HTMLElement | null` variable and call `onItemPaneReady?.(element)` in `$effect`.

Create `packages/section-player/src/components/SectionPlayerVertical.svelte` with the same `RubricDisplay` and `ItemRenderer` order, rendering passages first, then non-passage rubrics, then the active item. Resolve `role` and `effectiveSecurity` the same way as the split-pane layout:

```ts
const role = $derived(composition.section.role ?? 'candidate');
const effectiveSecurity = $derived(security ?? composition.security);
```

The vertical layout must pass the same `responses={composition.snapshot.responses[composition.activeItem.identifier] ?? composition.activeItem.responses ?? {}}` expression into `ItemRenderer`.

- [ ] **Step 10: Add source-only internal component barrel**

Create `packages/section-player/src/components/index.ts`:

```ts
export { default as SectionPlayerSplitPane } from './SectionPlayerSplitPane.svelte';
export { default as SectionPlayerVertical } from './SectionPlayerVertical.svelte';
export { default as TestFeedback } from './TestFeedback.svelte';
```

Do not export `./components` from `packages/section-player/package.json`. This barrel is for source consumers that are compiled by Svelte/Vite (`assessment-player` Svelte checks and `player-elements` Vite build). It must stay excluded from the pure `tsc` publish build in `packages/section-player/tsconfig.json`.

- [ ] **Step 11: Add sanitized test feedback renderer**

Create `packages/section-player/src/components/TestFeedback.svelte`:

```svelte
<script lang="ts">
  import type { I18nProvider } from '@pie-qti/i18n';
  import type { PlayerSecurityConfig } from '@pie-qti/item-player';
  import type { QtiSectionRole, QtiSectionRuntimeHostContract, QtiSharedHtmlBlock } from '../contracts/index.js';
  import { isQtiViewVisibleForRole } from '../visibility/role-view.js';
  import SanitizedHtml from './SanitizedHtml.svelte';

  interface Props {
    feedback: QtiSharedHtmlBlock[];
    role?: QtiSectionRole;
    i18n?: I18nProvider;
    security?: PlayerSecurityConfig;
    host?: QtiSectionRuntimeHostContract;
    typeset?: (root: HTMLElement) => void | Promise<void>;
  }

  const { feedback, role = 'candidate', security, host, typeset }: Props = $props();
  const visibleFeedback = $derived(feedback.filter((item) => isQtiViewVisibleForRole(item.view, role)));
</script>

{#if visibleFeedback.length > 0}
  <section class="test-feedback" aria-live="polite">
    {#each visibleFeedback as item}
      <SanitizedHtml
        rawHtml={item.rawHtml}
        html={item.html}
        {security}
        {host}
        sanitizeContext={{ kind: 'test-feedback', source: item.source }}
        class="test-feedback-content"
        {typeset}
      />
    {/each}
  </section>
{/if}
```

Assessment-player must map its current `{ identifier, content, access }` feedback shape to `QtiSharedHtmlBlock` before using this renderer:

```ts
const feedbackBlocks = testFeedback.map((item) => ({
  identifier: item.identifier,
  kind: 'test-feedback' as const,
  scope: 'assessment' as const,
  rawHtml: item.content,
  view: ['candidate'],
  source: item.access,
}));
```

`item.access` values such as `atEnd` or `during` are timing/availability metadata, not QTI role/view values. Keep them separate from `view`; if timing is needed later, add an explicit field rather than putting access values into `view`.

Alternatively, update the existing assessment-player `TestFeedback.svelte` to keep its current props and sanitize `item.content` directly. Do not leave raw `{@html item.content}` in assessment-player after Task 5.

- [ ] **Step 12: Verify Task 4**

Run:

```bash
cd packages/section-player && bun test && bun run check && bun run typecheck
bun --cwd ../.. run check:deps
bun --cwd ../.. run check:publish-surface
```

Expected: pass. If Svelte components are not emitted by `tsc`, do not add public exports for them yet; they will be bundled by `player-elements` in Task 6.

---

### Task 5: Assessment Player Delegation

**Files:**

- Create: `packages/assessment-player/src/integration/toSectionComposition.ts`
- Modify: `packages/assessment-player/package.json`
- Modify: `packages/assessment-player/src/components/AssessmentShell.svelte`
- Modify: `packages/assessment-player/src/core/AssessmentPlayer.ts` only if existing public getters are insufficient.
- Modify: `packages/assessment-player/tests/conformance-qti22-advanced.test.ts`
- Modify: `packages/assessment-player/tests/conformance-qti30-advanced.test.ts`

**Interfaces:**

- Consumes: `resolveQtiSectionComposition`, `QtiSharedContext`, `ResolvedQtiSectionComposition`.
- Produces: assessment-player middle-pane delegation while preserving header/nav/submission/test feedback.

- [ ] **Step 1: Add dependency**

Update `packages/assessment-player/package.json`:

```json
"@pie-qti/section-player": "workspace:*"
```

- [ ] **Step 2: Write adapter tests around current behavior**

Add focused tests to `packages/assessment-player/tests/conformance-qti22-advanced.test.ts` for:

```ts
test('maps current section passage rubric blocks into section composition', async () => {
  const player = await createPlayerWithSectionRubrics();
  await player.navigateTo(0);

  const composition = toSectionComposition(player);

  expect(composition.layout).toBe('split-pane');
  expect(composition.sharedContext.passages[0]?.rawHtml).toContain('passage');
  expect(composition.activeItem.identifier).toBe(player.getCurrentItem()?.identifier);
});
```

Use the existing fixture factory patterns in the file instead of introducing a new backend adapter.

Add candidate role filtering coverage before changing the shell:

```ts
test('does not expose scorer-only section rubric blocks to candidate section composition', async () => {
  const player = await createPlayerWithSectionRubrics([
    { identifier: 'candidate-rubric', use: 'rubric', content: '<p>Candidate</p>', view: ['candidate'] },
    { identifier: 'scorer-rubric', use: 'rubric', content: '<p>Scorer secret</p>', view: ['scorer'] },
  ]);

  const composition = toSectionComposition(player, { role: 'candidate' });

  expect(composition.sharedContext.rubricBlocks.map((block) => block.identifier)).toContain('candidate-rubric');
  expect(composition.sharedContext.rubricBlocks.map((block) => block.identifier)).not.toContain('scorer-rubric');
});
```

Add response-isolation coverage before changing `ItemRenderer`:

```ts
test('preserves active item responses by item identifier when response identifiers repeat', async () => {
  const player = await createTwoItemPlayerWithRepeatedResponseIdentifier();

  player.updateResponseForItem('item-1', 'RESPONSE', 'A');
  player.updateResponseForItem('item-2', 'RESPONSE', 'B');
  await player.navigateTo(0);

  const composition = toSectionComposition(player, { role: 'candidate' });

  expect(composition.snapshot.responses['item-1']?.RESPONSE).toBe('A');
  expect(composition.snapshot.responses['item-2']?.RESPONSE).toBe('B');
  expect(composition.activeItem.responses?.RESPONSE).toBe('A');
});
```

- [ ] **Step 3: Implement `toSectionComposition`**

Before writing the adapter, add narrow `AssessmentPlayer` getters if they do not already exist:

```ts
public getCurrentSectionItemRefs(): Array<{
  identifier: string;
  href?: string;
  title?: string;
  itemXml: string;
  deliveryContext?: ResolvedItemDeliveryContext;
}> {
  const current = this.items[this.currentItemIndex];
  if (!current) return [];
  return this.items
    .filter((item) => item.section.identifier === current.section.identifier)
    .map((item) => ({
      identifier: item.identifier,
      href: item.href,
      title: item.title,
      itemXml: item.itemXml,
      deliveryContext: item.deliveryContext,
    }));
}

public getResponsesForItem(itemIdentifier: string): Record<string, unknown> {
  return { ...(this.state.itemResponses[itemIdentifier] ?? {}) };
}

public getCurrentSharedRubricBlocks(): AssessmentRubricBlock[] {
  const current = this.items[this.currentItemIndex];
  if (!current) return [];
  return [...(current.testPart.rubricBlocks ?? []), ...(current.section.rubricBlocks ?? [])];
}
```

Use actual internal field names from `AssessmentPlayer.ts`; the getter contract is the important part. These getters must return cloned/safe data and must not expose mutable internal arrays. If navigation/submission modes are not available from current state, omit them from the section contract instead of reading non-existent config fields.

Create `packages/assessment-player/src/integration/toSectionComposition.ts`:

```ts
import {
  resolveQtiSectionComposition,
  type QtiSectionItemRef,
  type QtiSectionRole,
  type QtiSharedContext,
  type QtiSharedHtmlBlock,
  type ResolvedQtiSectionComposition,
  isQtiViewVisibleForRole,
} from '@pie-qti/section-player';
import type { BackendAssessmentPlayerConfig, AssessmentPlayer } from '../core/AssessmentPlayer.js';

function isVisibleForRole(block: QtiSharedHtmlBlock, role: QtiSectionRole): boolean {
  return isQtiViewVisibleForRole(block.view, role);
}

function normalizeRubricBlocks(rubricBlocks: ReturnType<AssessmentPlayer['getCurrentRubricBlocks']>, role: QtiSectionRole): QtiSharedContext {
  const passages: QtiSharedHtmlBlock[] = [];
  const sharedRubrics: QtiSharedHtmlBlock[] = [];

  for (const [index, block] of rubricBlocks.entries()) {
    const normalized: QtiSharedHtmlBlock = {
      identifier: block.identifier ?? `${block.use ?? 'rubric'}-${index}`,
      kind: block.use === 'passage' ? 'passage' : block.use === 'instructions' ? 'instructions' : 'rubric',
      scope: 'section',
      view: block.view,
      rawHtml: block.content,
    };

    if (!isVisibleForRole(normalized, role)) continue;

    if (block.use === 'passage') {
      passages.push(normalized);
    } else {
      sharedRubrics.push(normalized);
    }
  }

  return {
    passages,
    stimuli: [],
    rubricBlocks: sharedRubrics,
    testFeedback: [],
    stylesheets: [],
    catalogSources: [],
    assetDiagnostics: [],
  };
}

export function toSectionComposition(
  player: AssessmentPlayer,
  config: Partial<BackendAssessmentPlayerConfig> = {}
): ResolvedQtiSectionComposition {
  const navState = player.getNavigationState();
  const currentItem = player.getCurrentItem();
  const rubricBlocks = player.getCurrentSharedRubricBlocks();
  const role = config.role ?? 'candidate';
  const sharedContext = normalizeRubricBlocks(rubricBlocks, role);
  const sectionItems: QtiSectionItemRef[] = player.getCurrentSectionItemRefs().map((item) => ({
    identifier: item.identifier,
    href: item.href,
    title: item.title,
    itemXml: item.itemXml,
    responses: player.getResponsesForItem(item.identifier),
    deliveryContext: item.deliveryContext,
  }));

  return resolveQtiSectionComposition({
    section: {
      identifier: navState.currentSection?.id ?? currentItem?.sectionIdentifier ?? 'active-section',
      title: navState.currentSection?.title ?? currentItem?.sectionTitle,
      role,
      layoutPreference: sharedContext.passages.length > 0 ? 'split-pane' : 'vertical',
      itemRefs: sectionItems,
      sharedContext,
    },
    activeItemIdentifier: currentItem?.identifier,
    responsesByItemIdentifier: Object.fromEntries(sectionItems.map((item) => [item.identifier, item.responses ?? {}])),
    canPrevious: navState.canPrevious,
    canNext: navState.canNext,
    security: config.security,
  });
}
```

Adjust field names to match the actual `currentItem` type in `AssessmentPlayer.ts`; do not add assessment-player types to `section-player` to make this compile. Do not use optional chaining for required adapter getters; if a getter is missing, add it before the adapter compiles.

- [ ] **Step 4: Delegate the middle pane in `AssessmentShell.svelte`**

Keep these responsibilities in `AssessmentShell.svelte`:

- player creation/destruction
- nav state and current item state
- `NavigationBar`
- `AssessmentHeader`
- `AccessibilityAnnouncer`
- test feedback after submit
- `handlePrevious`, `handleNext`, `handleSubmit`

Render test feedback through the sanitized section-player `TestFeedback` component or update the existing assessment-player `TestFeedback.svelte` to use `sanitizeSectionSharedHtml`. The final shell must not contain any direct `{@html item.content}` path for test feedback.

Replace only the existing passage/rubric/item middle-pane branch with section-player layouts:

```svelte
<script lang="ts">
  import { SectionPlayerSplitPane, SectionPlayerVertical } from '../../../section-player/src/components/index.js';

  let responseVersion = $state(0);
  let stateVersion = $state(0);
  const sectionComposition = $derived.by(() => {
    responseVersion;
    stateVersion;
    return player ? toSectionComposition(player, config) : null;
  });
</script>

{#if sectionComposition}
  {#if sectionComposition.layout === 'split-pane'}
    <SectionPlayerSplitPane
      composition={sectionComposition}
      {i18n}
      security={config.security}
      pnp={config.pnp}
      extendedTextEditor={config.extendedTextEditor}
      {typeset}
      onResponseChange={handleSectionResponseChange}
      onItemPaneReady={(el) => (itemPaneEl = el)}
    />
  {:else}
    <SectionPlayerVertical
      composition={sectionComposition}
      {i18n}
      security={config.security}
      pnp={config.pnp}
      extendedTextEditor={config.extendedTextEditor}
      {typeset}
      onResponseChange={handleSectionResponseChange}
      onItemPaneReady={(el) => (itemPaneEl = el)}
    />
  {/if}
{/if}
```

Use a source import like the example above or a local tsconfig/Vite alias that points to `packages/section-player/src/components/index.ts`. Do not add `./components` to `@pie-qti/section-player` package exports.

Make this import path deterministic before implementation:

- For `packages/assessment-player`, either use the exact relative source import shown above or add a `paths` alias in `packages/assessment-player/tsconfig.svelte.json` that resolves only for Svelte checking.
- For `packages/player-elements`, either use exact relative imports from `packages/section-player/src/components/*.svelte` or add a Vite alias in `packages/player-elements/vite.config.ts`.
- Verify both paths with `cd packages/assessment-player && bun run check` and `cd packages/player-elements && bun run build`.

Add:

```ts
function handleSectionResponseChange(itemIdentifier: string, responseIdentifier: string, value: unknown) {
  player?.updateResponseForItem(itemIdentifier, responseIdentifier, value);
  responseVersion += 1;
}
```

If `updateResponseForItem` is not public, add a narrowly scoped method to `AssessmentPlayer` that delegates to the existing session coordinator. Do not route through `updateResponse(responseIdentifier, value)` because reused `RESPONSE` identifiers across items must remain isolated.

Also increment `responseVersion` in the existing `player.onResponseChange` subscription after `currentResponses = responses`. Increment `stateVersion` at the end of `updateState()` after `navState`, `currentItem`, `currentRubricBlocks`, and `currentResponses` have been refreshed. This keeps `sectionComposition` fresh after navigation, section changes, restored state, and response changes.

- [ ] **Step 5: Preserve focus and scroll behavior**

After delegation, verify these existing effects still work:

- `itemPaneEl?.scrollTo({ top: 0, behavior: 'auto' })` after item change.
- `manageFocusAfterNavigation()` focuses the active item pane.
- `announceCurrentQuestion()` still fires after previous/next navigation.

If needed, make `SectionPlayerSplitPane` and `SectionPlayerVertical` call `onItemPaneReady` when the focusable active item container mounts.

- [ ] **Step 6: Verify Task 5**

Run:

```bash
cd packages/assessment-player && bun test && bun run check && bun run typecheck
bun --cwd ../.. run check:deps
```

Expected: pass. If tests show item responses crossing between items, fix callback routing before proceeding.

---

### Task 6: Browser Entrypoints, Loader, and Demo

**Files:**

- Create: `packages/player-elements/src/elements/QtiSectionPlayerSplitPaneElement.ts`
- Create: `packages/player-elements/src/elements/QtiSectionPlayerVerticalElement.ts`
- Modify: `packages/player-elements/package.json`
- Modify: `packages/player-elements/src/constants.ts`
- Modify: `packages/player-elements/src/define.ts`
- Modify: `packages/player-elements/src/index.ts`
- Modify: `packages/web-component-loaders/src/index.ts`
- Modify: `packages/web-component-loaders/README.md`
- Modify: `apps/demo/package.json`
- Create: `apps/demo/src/routes/wc-section-splitpane/+page.svelte`
- Create: `apps/demo/src/routes/wc-section-vertical/+page.svelte`
- Create: `apps/demo/tests/playwright/section-player.pw.ts`
- Modify: `scripts/check-demo-player-contract.mjs` if required by checker output.

**Interfaces:**

- Consumes: section-player internal components, `BaseSvelteMountElement` pattern from player-elements, loader `loadPieQtiPlayerElements`.
- Produces: `pie-qti-section-player-splitpane`, `pie-qti-section-player-vertical`, loader docs, demo coverage.

- [ ] **Step 1: Add tag constants**

Update `packages/player-elements/src/constants.ts`:

```ts
export const QTI_ITEM_PLAYER_TAG = 'pie-qti-item-player';
export const QTI_ASSESSMENT_PLAYER_TAG = 'pie-qti-assessment-player';
export const QTI_SECTION_PLAYER_SPLITPANE_TAG = 'pie-qti-section-player-splitpane';
export const QTI_SECTION_PLAYER_VERTICAL_TAG = 'pie-qti-section-player-vertical';
```

- [ ] **Step 2: Add section-player dependency**

Update `packages/player-elements/package.json`:

```json
"@pie-qti/section-player": "workspace:*"
```

- [ ] **Step 3: Implement CE wrappers**

Model `QtiAssessmentPlayerElement.ts`. The section CE wrapper should accept a JS property:

```ts
composition: ResolvedQtiSectionComposition | null;
security: PlayerSecurityConfig | undefined;
```

and dispatch:

```ts
this.dispatchEvent(
  new CustomEvent('qti-section-response-delta', {
    detail: { sectionIdentifier, itemIdentifier, responseIdentifier, value },
    bubbles: true,
    composed: true,
  })
);
```

Import section-player Svelte components from source for the Vite bundle, for example:

```ts
import SectionPlayerSplitPane from '../../../section-player/src/components/SectionPlayerSplitPane.svelte';
import SectionPlayerVertical from '../../../section-player/src/components/SectionPlayerVertical.svelte';
```

If the relative source import becomes brittle, add an explicit Vite alias in `packages/player-elements/vite.config.ts` that points to `../section-player/src/components`. Do not solve this by publishing `@pie-qti/section-player/components`.

Guard mount/update until `composition` is non-null, or render an inert waiting state. The wrapper must not instantiate `SectionPlayerSplitPane` or `SectionPlayerVertical` with `composition: null`. Model the existing `BaseSvelteMountElement` API exactly:

```ts
export class QtiSectionPlayerSplitPaneElement extends BaseSvelteMountElement<SectionPlayerElementProps> {
  protected Component: any = SectionPlayerSplitPane;
  #composition: ResolvedQtiSectionComposition | null = null;
  #security: PlayerSecurityConfig | undefined;

  set composition(value: ResolvedQtiSectionComposition | null) {
    this.#composition = value;
    this._mountOrUpdate();
  }

  set security(value: PlayerSecurityConfig | undefined) {
    this.#security = value;
    this._mountOrUpdate();
  }

  protected getProps(): SectionPlayerElementProps {
    if (!this.#composition) {
      throw new Error('composition is required before section-player mount');
    }

    const composition = this.#composition;
    const effectiveSecurity = this.#security ?? composition.security;
    return {
      composition: {
        ...composition,
        security: effectiveSecurity,
      },
      onResponseChange: (itemIdentifier, responseIdentifier, value) => {
        this.dispatchEvent(
          new CustomEvent('qti-section-response-delta', {
            detail: {
              sectionIdentifier: composition.section.identifier,
              itemIdentifier,
              responseIdentifier,
              value,
            },
            bubbles: true,
            composed: true,
          })
        );
      },
    };
  }

  protected override _mountOrUpdate() {
    if (!this.#composition) {
      this._teardownInstance();
      return;
    }

    super._mountOrUpdate();
  }
}
```

Do not use `_mount`, `_mountController`, or `mountOrUpdate(Component, props)`; those are not exposed by `BaseSvelteMountElement`.

The vertical wrapper should use the same `getProps()` and null-composition guard with `protected Component: any = SectionPlayerVertical`.

Add a custom-element test that connects the element before assigning `composition` and expects no thrown error, then assigns `composition` and expects the nested item player to render. Also add an event test:

```ts
test('dispatches qti-section-response-delta with item and response identifiers', () => {
  const element = new QtiSectionPlayerSplitPaneElement();
  const events: unknown[] = [];
  element.addEventListener('qti-section-response-delta', (event) => events.push((event as CustomEvent).detail));

  element.composition = makeSectionComposition();
  element.dispatchSectionResponseChangeForTest?.('item-1', 'RESPONSE', 'A');

  expect(events).toEqual([
    {
      sectionIdentifier: 'section-1',
      itemIdentifier: 'item-1',
      responseIdentifier: 'RESPONSE',
      value: 'A',
    },
  ]);
});
```

If no test-only dispatch helper is added, trigger the callback through the mounted component props using the existing player-elements test pattern.

Every `customElements.define` must be guarded:

```ts
export function defineQtiSectionPlayerSplitPaneElement() {
  if (!customElements.get(QTI_SECTION_PLAYER_SPLITPANE_TAG)) {
    customElements.define(QTI_SECTION_PLAYER_SPLITPANE_TAG, QtiSectionPlayerSplitPaneElement);
  }
}
```

- [ ] **Step 4: Wire player-elements exports and registration**

Update `packages/player-elements/src/define.ts`:

```ts
import { defineQtiAssessmentPlayerElement } from './elements/QtiAssessmentPlayerElement.js';
import { defineQtiItemPlayerElement } from './elements/QtiItemPlayerElement.js';
import { defineQtiSectionPlayerSplitPaneElement } from './elements/QtiSectionPlayerSplitPaneElement.js';
import { defineQtiSectionPlayerVerticalElement } from './elements/QtiSectionPlayerVerticalElement.js';

export function defineQtiPlayerElements() {
  defineQtiItemPlayerElement();
  defineQtiAssessmentPlayerElement();
  defineQtiSectionPlayerSplitPaneElement();
  defineQtiSectionPlayerVerticalElement();
}
```

Update `packages/player-elements/src/index.ts` to export the new constants, classes, event detail types, and define helpers.

- [ ] **Step 5: Update web-component loader**

Update `packages/web-component-loaders/src/index.ts` so `loadPieQtiPlayerElements()` imports/registers the new player-elements bundle and waits for:

```ts
'pie-qti-section-player-splitpane'
'pie-qti-section-player-vertical'
```

Update `packages/web-component-loaders/README.md` with the two new tags and a short example that sets the `composition` property from JavaScript.

- [ ] **Step 6: Add demo fixtures**

Create `apps/demo/src/routes/wc-section-splitpane/+page.svelte` with a static `ResolvedQtiSectionComposition` containing:

- one passage block with raw HTML
- one active item XML with a simple choice interaction
- `layout: 'split-pane'`

Create `apps/demo/src/routes/wc-section-vertical/+page.svelte` with the same item but no passage blocks and `layout: 'vertical'`.

- [ ] **Step 7: Add Playwright coverage**

Create `apps/demo/tests/playwright/section-player.pw.ts`:

```ts
import { expect, test } from '@playwright/test';

test('section split-pane renders passage and active item', async ({ page }) => {
  await page.goto('/wc-section-splitpane');

  await expect(page.getByText('Reading Passage')).toBeVisible();
  await expect(page.locator('pie-qti-item-player')).toBeVisible();
});

test('section vertical route renders active item fallback layout', async ({ page }) => {
  await page.goto('/wc-section-vertical');

  await expect(page.locator('pie-qti-item-player')).toBeVisible();
  await expect(page.getByText('Reading Passage')).toHaveCount(0);
});

test('section player emits response deltas with item identifier', async ({ page }) => {
  await page.goto('/wc-section-splitpane');

  const eventPromise = page.evaluate(
    () =>
      new Promise((resolve) => {
        document
          .querySelector('pie-qti-section-player-splitpane')
          ?.addEventListener('qti-section-response-delta', (event) => resolve((event as CustomEvent).detail), { once: true });
      })
  );

  await page.locator('pie-qti-choice').first().click();

  await expect(eventPromise).resolves.toMatchObject({
    sectionIdentifier: 'section-1',
    itemIdentifier: 'item-1',
    responseIdentifier: 'RESPONSE',
  });
});
```

- [ ] **Step 8: Update player-elements test DOM setup**

Before adding section CE tests, ensure `packages/player-elements/tests/setup.ts` installs enough DOM globals from `linkedom` for custom-element registration tests:

```ts
import { parseHTML } from 'linkedom';

const { window } = parseHTML('<!doctype html><html><body></body></html>');

Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  customElements: window.customElements,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
});
```

Run section custom-element register smoke tests with this preload, or keep `@pie-qti/player-elements/register` smoke coverage in Playwright if the Bun DOM shim cannot support the needed APIs.

- [ ] **Step 9: Verify Task 6**

Run:

```bash
cd packages/player-elements && bun test && bun run typecheck
bun run build
cd ../web-component-loaders && bun run build
cd ../../apps/demo && bun run test:e2e -- section-player.pw.ts
bun --cwd ../.. run check:custom-elements
bun --cwd ../.. run check:ce-define-safety
bun --cwd ../.. run check:demo-player-contract
```

Expected: pass. If the demo contract checker fails on the new routes, explicitly allow only `apps/demo/src/routes/wc-section-splitpane/+page.svelte` and `apps/demo/src/routes/wc-section-vertical/+page.svelte`, or update the negative lookahead to allow only `pie-qti-section-player-splitpane` and `pie-qti-section-player-vertical` in addition to the existing player tags. Do not weaken the checker globally.

---

### Task 7: QTI Assessment Toolkit Helpers

**Files:**

- Create: `packages/assessment-toolkit/package.json`
- Create: `packages/assessment-toolkit/tsconfig.json`
- Create: `packages/assessment-toolkit/src/index.ts`
- Create: `packages/assessment-toolkit/src/role-view.ts`
- Create: `packages/assessment-toolkit/src/shared-context-normalization.ts`
- Create: `packages/assessment-toolkit/tests/role-view.test.ts`
- Create: `packages/assessment-toolkit/tests/shared-context-normalization.test.ts`
- Modify: `.changeset/config.json`
- Modify: `.changeset/<generated-name>.md`

**Interfaces:**

- Consumes: `QtiSharedHtmlBlock`, `QtiSharedContext`, `ResolvedItemDeliveryContext`.
- Produces: pure QTI role/view filtering and shared context helpers. No `pie-players` projection type definitions.

- [ ] **Step 1: Scaffold pure TypeScript package**

Create `packages/assessment-toolkit/package.json` like:

```json
{
  "name": "@pie-qti/assessment-toolkit",
  "version": "0.1.13",
  "description": "QTI assessment toolkit helpers for role/view mapping and shared section context normalization",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  },
  "keywords": ["qti", "assessment", "toolkit", "section", "stimulus"],
  "license": "MIT",
  "dependencies": {
    "@pie-qti/ims-cp-core": "workspace:*",
    "@pie-qti/section-player": "workspace:*"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.8",
    "@types/node": "^25.0.3",
    "typescript": "^5.9.3"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/pie-framework/pie-qti.git",
    "directory": "packages/assessment-toolkit"
  },
  "homepage": "https://github.com/pie-framework/pie-qti/tree/master/packages/assessment-toolkit",
  "bugs": {
    "url": "https://github.com/pie-framework/pie-qti/issues"
  },
  "publishConfig": {
    "access": "public"
  },
  "sideEffects": false,
  "engines": {
    "node": ">=20.19.0"
  },
  "files": ["dist"]
}
```

Create `tsconfig.json` using the same pure package pattern as Task 2.

- [ ] **Step 2: Implement role/view helper with tests first**

Create `packages/assessment-toolkit/tests/role-view.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { isQtiViewVisibleForRole } from '../src/role-view.js';

describe('isQtiViewVisibleForRole', () => {
  test('shows candidate content to candidate role', () => {
    expect(isQtiViewVisibleForRole(['candidate'], 'candidate')).toBe(true);
  });

  test('hides scorer-only content from candidate role', () => {
    expect(isQtiViewVisibleForRole(['scorer'], 'candidate')).toBe(false);
  });

  test('treats missing view as visible to all roles for compatibility with current rubric rendering', () => {
    expect(isQtiViewVisibleForRole(undefined, 'candidate')).toBe(true);
    expect(isQtiViewVisibleForRole(undefined, 'scorer')).toBe(true);
  });

  test('hides explicit candidate-only content from scorer role', () => {
    expect(isQtiViewVisibleForRole(['candidate'], 'scorer')).toBe(false);
  });

  test('normalizes comma and whitespace separated view tokens', () => {
    expect(isQtiViewVisibleForRole(['candidate, scorer'], 'scorer')).toBe(true);
    expect(isQtiViewVisibleForRole(['candidate,scorer'], 'scorer')).toBe(true);
    expect(isQtiViewVisibleForRole(['candidate scorer'], 'scorer')).toBe(true);
  });
});
```

Create `packages/assessment-toolkit/src/role-view.ts`:

```ts
import type { QtiSectionRole } from '@pie-qti/section-player';

export function normalizeQtiViewTokens(view: string[] | undefined): string[] {
  return (view ?? [])
    .flatMap((token) => token.split(/[\s,]+/))
    .map((token) => token.trim())
    .filter(Boolean);
}

export function isQtiViewVisibleForRole(view: string[] | undefined, role: QtiSectionRole = 'candidate'): boolean {
  const tokens = normalizeQtiViewTokens(view);
  if (tokens.length === 0) return true;
  return tokens.includes(role);
}

export function filterQtiRoleVisible<T extends { view?: string[] }>(blocks: T[], role: QtiSectionRole = 'candidate'): T[] {
  return blocks.filter((block) => isQtiViewVisibleForRole(block.view, role));
}
```

- [ ] **Step 3: Implement shared context normalization helper**

Create `packages/assessment-toolkit/tests/shared-context-normalization.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { normalizeQtiSharedContext } from '../src/shared-context-normalization.js';

describe('normalizeQtiSharedContext', () => {
  test('splits passage rubric blocks from other rubric blocks', () => {
    const sharedContext = normalizeQtiSharedContext({
      role: 'candidate',
      rubricBlocks: [
        { identifier: 'p1', use: 'passage', content: '<p>Passage</p>', view: ['candidate'] },
        { identifier: 'r1', use: 'rubric', content: '<p>Rubric</p>', view: ['candidate'] },
      ],
    });

    expect(sharedContext.passages).toHaveLength(1);
    expect(sharedContext.rubricBlocks).toHaveLength(1);
    expect(sharedContext.passages[0]?.rawHtml).toContain('Passage');
  });

  test('filters scorer-only blocks from candidate context', () => {
    const sharedContext = normalizeQtiSharedContext({
      role: 'candidate',
      rubricBlocks: [
        { identifier: 'candidate-rubric', use: 'rubric', content: '<p>Candidate</p>', view: ['candidate'] },
        { identifier: 'scorer-rubric', use: 'rubric', content: '<p>Scorer secret</p>', view: ['scorer'] },
      ],
    });

    expect(sharedContext.rubricBlocks.map((block) => block.identifier)).toEqual(['candidate-rubric']);
  });
});
```

Create `packages/assessment-toolkit/src/shared-context-normalization.ts`:

```ts
import type { QtiSharedContext, QtiSharedHtmlBlock } from '@pie-qti/section-player';
import type { QtiSectionRole } from '@pie-qti/section-player';
import { isQtiViewVisibleForRole } from './role-view.js';

export interface QtiRubricLikeBlock {
  identifier?: string;
  use?: 'passage' | 'instructions' | 'rubric' | string;
  content: string;
  view?: string[];
}

export interface NormalizeQtiSharedContextOptions {
  role?: QtiSectionRole;
  rubricBlocks?: QtiRubricLikeBlock[];
}

export function normalizeQtiSharedContext(options: NormalizeQtiSharedContextOptions): QtiSharedContext {
  const role = options.role ?? 'candidate';
  const passages: QtiSharedHtmlBlock[] = [];
  const rubricBlocks: QtiSharedHtmlBlock[] = [];

  for (const [index, block] of (options.rubricBlocks ?? []).entries()) {
    const normalized: QtiSharedHtmlBlock = {
      identifier: block.identifier ?? `${block.use ?? 'rubric'}-${index}`,
      kind: block.use === 'passage' ? 'passage' : block.use === 'instructions' ? 'instructions' : 'rubric',
      scope: 'section',
      view: block.view,
      rawHtml: block.content,
    };

    if (!isQtiViewVisibleForRole(normalized.view, role)) continue;

    if (block.use === 'passage') {
      passages.push(normalized);
    } else {
      rubricBlocks.push(normalized);
    }
  }

  return {
    passages,
    stimuli: [],
    rubricBlocks,
    testFeedback: [],
    stylesheets: [],
    catalogSources: [],
    assetDiagnostics: [],
  };
}
```

- [ ] **Step 4: Add package exports and fixed group**

Create `packages/assessment-toolkit/src/index.ts`:

```ts
export * from './role-view.js';
export * from './shared-context-normalization.js';
```

Add `@pie-qti/assessment-toolkit` to `.changeset/config.json` fixed array.

Update the changeset from Task 2 or create a second one:

```md
---
"@pie-qti/assessment-toolkit": patch
"@pie-qti/section-player": patch
"@pie-qti/assessment-player": patch
---

Add QTI assessment toolkit helpers for role/view filtering and shared section context normalization.
```

- [ ] **Step 5: Replace local assessment-player normalization with toolkit helper**

If `toSectionComposition.ts` still has local role/view or rubric splitting logic, replace it with:

```ts
import { normalizeQtiSharedContext } from '@pie-qti/assessment-toolkit';
```

Call it with the active render role:

```ts
const sharedContext = normalizeQtiSharedContext({ rubricBlocks, role });
```

Then add `"@pie-qti/assessment-toolkit": "workspace:*"` to `packages/assessment-player/package.json`.

Only do this after Task 7 tests pass; do not create a dependency cycle. The scorer-only-hidden-from-candidate regression from Task 5 must still pass after this replacement.

- [ ] **Step 6: Verify Task 7**

Run:

```bash
cd packages/assessment-toolkit && bun test && bun run typecheck
bun --cwd ../.. run check:package-metadata
bun --cwd ../.. run check:fixed-versioning
bun --cwd ../.. run check:deps
```

Expected: pass.

---

### Task 8: Final Verification and PRD Sync

**Files:**

- Modify: `docs/prds/architecture/qti-section-player-and-toolkit.md` only if implementation decisions changed.
- Modify: `docs/prds/architecture/security.md` if public security API details changed during Task 1.
- Modify: `docs/prds/INVENTORY.md` only if PRD status changes are intentional.

**Interfaces:**

- Consumes: all prior tasks.
- Produces: verified implementation ready for review.

- [ ] **Step 1: Run package-level checks**

Run:

```bash
cd packages/item-player && bun test tests/security/public-api.test.ts && bun run typecheck
cd ../section-player && bun test && bun run check && bun run typecheck
cd ../assessment-player && bun test && bun run check && bun run typecheck
cd ../assessment-toolkit && bun test && bun run typecheck
cd ../player-elements && bun test && bun run typecheck
cd ../web-component-loaders && bun run build
```

Expected: all commands pass.

- [ ] **Step 2: Run repo publish and dependency gates**

Run from repo root:

```bash
bun run build
bun run verify:publish:quick
bun run check:demo-player-contract
```

Expected: all commands pass. `verify:publish:quick` covers fixed versioning, package metadata, side effects, custom elements, publint, types publishing, packed exports, pack smoke, sourcemaps, dependency checks, publish surface, and CE define safety.

- [ ] **Step 3: Run built export smoke tests**

Run from repo root after `bun run build`:

```bash
bun --eval "import('@pie-qti/item-player/security').then((m) => { if (typeof m.sanitizeSharedHtml !== 'function') throw new Error('missing sanitizeSharedHtml'); })"
bun --eval "import('@pie-qti/section-player').then((m) => { if (typeof m.resolveQtiSectionComposition !== 'function') throw new Error('missing resolveQtiSectionComposition'); })"
bun --eval "import('@pie-qti/player-elements').then((m) => { if (!m.QTI_SECTION_PLAYER_SPLITPANE_TAG) throw new Error('missing section tag export'); })"
bun --eval "import('@pie-qti/web-component-loaders').then((m) => { if (typeof m.loadPieQtiPlayerElements !== 'function') throw new Error('missing loader export'); })"
bun --preload ./packages/player-elements/tests/setup.ts --eval "import('@pie-qti/player-elements/register').then(() => true)"
```

Expected: all imports resolve through package exports, not source-relative test paths.

- [ ] **Step 4: Run demo-backed tests after CE/demo work**

Run:

```bash
bun run test:e2e -- section-player.pw.ts
bun run verify:a11y
```

Expected: section-player Playwright tests pass; a11y suite passes or reports only unrelated existing failures.

- [ ] **Step 5: Run full pre-PR checks when local runtime allows**

Run:

```bash
bun run test
bun run lint:all
bun run verify:publish:quick
```

Expected: pass. If any command is too expensive for the current session, record exactly which command was skipped and why.

- [ ] **Step 6: Review PRDs against implementation**

Check:

- `docs/prds/architecture/qti-section-player-and-toolkit.md` still matches the implemented security choice (`./security` subpath vs future `@pie-qti/qti-security`).
- The PRD does not imply multi-item-in-view behavior if the implementation remains active-item-only.
- `docs/prds/architecture/security.md` documents `@pie-qti/item-player/security`.
- `docs/prds/INVENTORY.md` still has the section-player PRD row.

Expected: documentation matches implementation decisions and no stale acceptance criteria remain.
