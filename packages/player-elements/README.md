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

Compatibility callback properties `onResponseChange`, `onSubmit`, and `onComplete` also remain.

Portable Custom Interaction execution is disabled until the host supplies an allow-listed resolver:

```js
item.pci = {
  baseUrl: 'https://content.example/items/item-1/',
  moduleResolver(_resolvedUrl, { authoredPath }) {
    const load = trustedPciModules.get(authoredPath);
    if (!load) throw new Error(`Untrusted PCI module: ${authoredPath}`);
    return load();
  }
};
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
browser. It is for demos/offline preview, not authoritative assessment delivery.

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
assessment.addEventListener('submit', (event) => {});
assessment.addEventListener('complete', () => {});

await assessment.next();
await assessment.previous();
await assessment.navigateTo(0);
await assessment.navigateToSection('section-1');
const results = await assessment.submit();
const state = assessment.getState();
await assessment.restoreState(state);
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
