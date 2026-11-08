# @pie-qti/player-elements

Framework-neutral custom elements for item, section, and assessment delivery.

## Elements

- `pie-qti-item-player`
- `pie-qti-assessment-player`
- `pie-qti-section-player-splitpane`
- `pie-qti-section-player-vertical`

## Install and register

```bash
npm install @pie-qti/player-elements
```

```js
import '@pie-qti/player-elements/register';
```

The registration entry bundles the player, section, and standard interaction implementations. The
published package declares `@pie-qti/item-player` as its runtime dependency; package managers install
it automatically. Public declarations use framework-neutral browser contracts and do not expose
Svelte types.

The main `@pie-qti/player-elements` entry is registration-free and SSR-safe. Import constructors and
definition helpers from `@pie-qti/player-elements/elements` for manual registration. Advanced hosts
that provide their own interaction elements can import `@pie-qti/player-elements/register-players`
to register only the four player/section elements.

## Build model: this package ships the compiled UI

`@pie-qti/player-elements` is the publishable UI artifact of the platform. Its vite build compiles
Svelte component sources from the sibling packages' source trees (`assessment-player`,
`section-player`, `item-player`) and inlines them, together with the Svelte runtime and all
interaction implementations, into a self-contained bundle with zero runtime bare imports.

Consequences for consumers:

- The section and assessment **UI** you run is whatever was compiled into this package's `dist`.
  Install `@pie-qti/player-elements` and treat it (plus `@pie-qti/web-component-loaders`) as the
  versioned UI surface — do not expect UI changes from upgrading `@pie-qti/section-player` or
  `@pie-qti/assessment-player` alone.
- The headless **contracts and APIs** of those packages (`resolveQtiSectionComposition`,
  `AssessmentPlayer`, `BackendAdapter`, the item definition/session model) are real runtime
  dependencies and are published independently for JS-only and server-side use.
- Dependencies that exist only for this build-time source compilation (or only for the Svelte
  sources consumed here) are declared explicitly and allowlisted with reasons in
  `scripts/publish-policy.json` under `dependenciesUnreferencedByDist`; the
  `check:dist-dependencies` gate keeps that declaration honest.

Consequences for maintainers: this package can only be built inside the monorepo, and landing UI
changes requires a release of `@pie-qti/player-elements` (the platform fixed-version group releases
all packages in lockstep, so this is automatic).

## Item element

```js
const item = document.createElement('pie-qti-item-player');
item.itemXml = qtiItemXml;
item.role = 'candidate';
item.plugins = definitionPlugins;
item.security = securityPolicy;
item.addEventListener('response-change', (event) => {
  console.log(event.detail.responseId, event.detail.responses);
});
document.body.append(item);

const result = item.submit();
```

Attribute-backed properties are `itemXml`, `role`, and `disabled`. JavaScript-only properties are:

- `session` — an existing authoritative `ItemSession`; the element borrows it and never owns an
  injected session;
- `plugins` — immutable `AssessmentItemDefinitionPlugin` descriptors used only when the element
  creates its own definition/session;
- `renderItemBodyRubrics`, `typeset`, `i18n`, `security`, `pnp`, `deliveryContext`, `pci`,
  `resolveProcessingFragment`, `processingFragmentLimits`, and `responses`.

When `session` is supplied, its definition-fixed role and mutable state are authoritative. Do not
create a second session for the same rendered attempt.

Events are typed, bubbling, and composed:

```js
item.addEventListener('ready', () => {});
item.addEventListener('response-change', (event) => {});
item.addEventListener('submit', (event) => {});
item.addEventListener('complete', (event) => {});
```

Portable Custom Interaction execution is disabled until the host opts into one of two engines:
a page-realm resolver that returns the trusted module, or the sandboxed engine
(`pci.sandbox`), which runs the module inside a hardened cross-origin runner frame
(deploy `@pie-qti/pci-runner`) and evaluates nothing in the page:

```js
// Page realm: the resolver's return runs the module with page authority.
item.pci = {
  baseUrl: 'https://content.example/items/item-1/',
  moduleResolver(_resolvedUrl, { authoredPath }) {
    const load = trustedPciModules.get(authoredPath);
    if (!load) throw new Error(`Untrusted PCI module: ${authoredPath}`);
    return load();
  }
};

// Or sandboxed: module URLs are resolved and handed to the runner frame.
// item.pci = {
//   baseUrl: 'https://content.example/items/item-1/',
//   sandbox: { runnerUrl: 'https://qti.pie-framework.org/pci-runner.html' },
// };
```

## Assessment element

### Authoritative backend delivery

```js
const assessment = document.createElement('pie-qti-assessment-player');
assessment.backend = backend;
assessment.initSession = {
  assessmentId: 'assessment-1',
  candidateId: 'candidate-1'
};
assessment.config = {
  plugins: definitionPlugins,
  showSections: true,
  allowSectionNavigation: true,
  showProgress: true
};
document.body.append(assessment);
```

`backend`, `initSession`, `assessmentId`, `candidateId`, `config`, `security`, and `pci` are
JavaScript properties. `config.plugins` is propagated to every compiled item definition.

### Explicit reference/preview delivery

Raw assessment XML must opt into the local answer-bearing adapter:

```js
const assessment = document.createElement('pie-qti-assessment-player');
assessment.referenceMode = true;
assessment.assessmentTestXml = assessmentTestXml;
assessment.items = {
  'items/item-1.xml': item1Xml,
  'ITEM-2': item2Xml
};
document.body.append(assessment);
```

Instead of `items`, set `itemBaseUrl` for bounded `assessmentItemRef@href` resolution and optionally
configure `itemFetchPolicy`. Reference mode puts item XML, correct answers, and scoring rules in the
browser. It is for demos/offline preview, not authoritative assessment delivery. Its local backend
scores from the candidate's serialized item session, so every submission carries it
(`config.sendItemSessionToBackend` cannot turn that off there): a templated item is scored against
the instance the candidate saw, an adaptive item from its outcomes as submitted.

Navigation and submission modes come from the QTI assessment structure; `config` does not override
them.

```js
assessment.addEventListener('ready', () => {});
assessment.addEventListener('load-start', () => {});
assessment.addEventListener('load-end', () => {});
assessment.addEventListener('load-error', (event) => console.error(event.detail.message));
assessment.addEventListener('item-change', (event) => {});
assessment.addEventListener('section-change', (event) => {});
assessment.addEventListener('response-change', (event) => {});
assessment.addEventListener('submit', (event) => {}); // { results } — once, for every ending
assessment.addEventListener('complete', () => {});

await assessment.next();
await assessment.previous();
await assessment.navigateTo(0);
await assessment.navigateToSection('section-1');
const results = await assessment.submit();
const state = assessment.getState();
await assessment.restoreState(state);
```

### Proctor console

A proctor console (or any host supervising delivery) reads and drives the session through the
element:

```js
assessment.pause('Please wait for your proctor.'); // candidate-facing reason
assessment.resume();
assessment.isPaused();          // true while a pause holds (also right after a paused session restores)
assessment.getPauseReason();    // the reason shown, if any
assessment.getTimeState();      // { limited, remainingSeconds, elapsedSeconds, expired, scope, paused, started, ... }
assessment.isFinalized();       // true once the session is terminal
await assessment.flushAutosave(); // save the draft now
await assessment.submit({ force: true }); // proctor force-submit: during a pause, queued behind a candidate action

assessment.addEventListener('player-pause', (event) => console.log(event.detail.reason));
assessment.addEventListener('player-resume', () => {});
assessment.addEventListener('time-expired', (event) => {}); // whole test, or nothing left open
assessment.addEventListener('scope-time-expired', (event) => {}); // { scope, identifier, deliveryContinues, nextIndex }
assessment.addEventListener('session-finalized', (event) => {}); // { restored, results, endReason }
```

- A candidate's `submit()` is refused while paused; `submit({ force: true })` is the administrative
  end of the test: it ignores minimum times and the QTI `allowSkipping` / `validateResponses`
  controls, and each collected submission carries `timing.submissionReason: 'proctor'` — except
  questions an expired time limit closed, which keep `time-expired` (time wins). It never
  fails because the candidate is mid-action: it waits for the navigation or submission in flight
  and then ends the test. Behind the begin gate it ends the test too (the completion screen
  replaces the start screen).
- Every ending — the candidate's submit, a proctor's force-submit, a QTI `EXIT_TEST` branch, a
  whole-test time expiry — fires `complete`, `session-finalized` (`restored: false`) and `submit`
  (`{ results }`) once. `session-finalized` and `results.endReason` say which: `candidate`,
  `expiry`, `proctor` or `branch`; a proctor's ending shows "Your test was submitted by your
  proctor." and announces it. An ending that collects a delivery the time already closed (the
  whole test expired, or a scope expiry left nothing open) is `expiry` whoever submits it — the
  automatic submission, the candidate after it failed, or a proctor — and shows the time-expired
  heading.
- A session restored paused fires `player-pause` once at mount; a session restored already
  finalized fires `session-finalized` with `restored: true` (and no `endReason`, nor `submit`).
- While paused, the player closes every dialog it contains and dispatches
  `pie-qti-close-transient-ui` (`detail: { reason: 'pause' }`) on `document` for editors and popups
  outside dialogs. Focus containment covers only the player: the host page stays operable.

### Resume and Start over

When the backend restores a draft, the shell offers "Resume where you left off" or "Start over".
Start over clears the candidate's answers, flags and comments but keeps the time accounting:
clocks, expired limits and a whole-test expiry persist, so restarting never grants new time.
Set `allow-start-over="false"` (`allowStartOver = false`) to remove the Start over path; a restored
draft then simply continues.

### Layout and styling

The shell needs no host stylesheet (no Tailwind or DaisyUI): it styles itself on the
`--pie-qti-*` theme tokens, with fallbacks when no theme is loaded.

- By default it fills the element's box. Give the element a height (it is a block box), or let
  it size to its content between `--pie-qti-assessment-min-block-size` (default
  `min(32rem, 100dvh)`) and `--pie-qti-assessment-max-block-size` (default `100dvh`).
- `full-viewport` (`fullViewport`) fills the dynamic viewport inside the safe-area insets — add
  `viewport-fit=cover` to the page's viewport meta — with page-level `header`/`main`/`nav`
  landmarks. Use it when the player owns the page.
- `heading-level` (`headingLevel`, 1–6) sets the assessment title's heading level so it fits
  your page outline (default 2, or 1 with `full-viewport`); passage and item titles follow one
  level below. Section elements accept `heading-level` for their passage and item titles
  (default 3).

Set these before the element mounts; changing them on a mounted assessment re-renders the
shell, like `config`.

```html
<pie-qti-assessment-player full-viewport heading-level="1"></pie-qti-assessment-player>
```

## Section elements

Section elements are standalone render adapters for a resolved section composition:

```js
const section = document.createElement('pie-qti-section-player-splitpane');
section.composition = resolvedComposition;
section.security = securityPolicy;
section.pci = pciPolicy;
section.typeset = typesetMath;
section.addEventListener('qti-section-response-delta', (event) => {
  console.log(event.detail);
});
document.body.append(section);
```

Use `pie-qti-section-player-vertical` with the same `composition`, `security`, `pci`, and `typeset`
properties for a vertical layout. The composition may carry the active item's live `session`; other
item refs carry response snapshots. Shared passages/rubrics and direct item rubrics remain separate
placement surfaces.

## TypeScript and manual registration

All four tags participate in `HTMLElementTagNameMap` inference:

```ts
import {
  QtiAssessmentPlayerElement,
  QtiItemPlayerElement,
  QtiSectionPlayerSplitPaneElement,
  defineQtiPlayerElements
} from '@pie-qti/player-elements/elements';

defineQtiPlayerElements();
```

The `/elements` entry is browser-only. Use the package root when only constants, parser helpers, or
public types are needed in SSR/tooling code.

## Security boundary

The runtime applies the shared sanitizer, URL policy, parsing limits, and optional Trusted Types
finalization to declared content sinks. Same-DOM sanitization is not a JavaScript sandbox. Content
that is not trusted to execute in the host origin should be delivered through a suitably sandboxed,
cross-origin iframe.
