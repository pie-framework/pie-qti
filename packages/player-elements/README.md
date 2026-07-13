# @pie-qti/player-elements

Framework-agnostic **Web Components (Custom Elements)** for the QTI players in this repo.

## Elements

- `pie-qti-item-player`
- `pie-qti-assessment-player`

## Install

```bash
npm install @pie-qti/player-elements
```

## Register elements

```js
import '@pie-qti/player-elements/register';
```

`@pie-qti/player-elements/register` is the complete default browser runtime. It defines the player,
section, and standard QTI interaction custom elements. Svelte and the default interaction
implementation are bundled behind this entry and are not application imports. The published
package has no runtime dependencies, and its public declarations use framework-neutral browser
contracts rather than exposing Svelte or internal workspace packages.

Alternatively, install the loader and make one idempotent load call:

```bash
npm install @pie-qti/web-component-loaders
```

```js
import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';

await loadPieQtiPlayerElements();
```

The main `@pie-qti/player-elements` entry is registration-free and safe to import during SSR; it
retains the item element class without defining its tag. Import all browser constructors and
definition helpers from `@pie-qti/player-elements/elements` when you need manual registration.
Advanced hosts that provide their own interaction elements can import
`@pie-qti/player-elements/register-players`, which registers only the player and section elements.

> **Security boundary (2026-07-13):** the former gap-match and section-TTS raw-markup paths now use
> the shared sanitizer, and custom-element parsing/resource limits are enabled by default. Same-DOM
> sanitization is not a JavaScript sandbox; content that is not trusted to run in the host origin
> should still be delivered through a suitably sandboxed, cross-origin iframe.

## `pie-qti-item-player`

### Pass QTI

Prefer setting the XML via property (attributes are awkward for large XML strings):

```js
import '@pie-qti/player-elements/register';

const el = document.querySelector('pie-qti-item-player');
el.itemXml = qtiItemXmlString;
el.role = 'candidate'; // QTI role/view actor
```

Attribute-backed properties are `itemXml`, `role`, and `disabled`. JS-only properties currently
include `renderItemBodyRubrics`, `typeset`, `i18n`, `security`, `pnp`, `deliveryContext`,
`resolveProcessingFragment`, `processingFragmentLimits`, `pci`, and `responses`.

Portable Custom Interaction execution is disabled by default. Opt in with a host-owned allow-list;
the player does not import authored module paths itself:

```js
const trustedPciModules = new Map([
  ['modules/chem-editor.js', () => import('./trusted-pci/chem-editor.js')]
]);

el.pci = {
  baseUrl: 'https://content.example/items/item-1/',
  moduleResolver(_resolvedUrl, { authoredPath }) {
    const load = trustedPciModules.get(authoredPath);
    if (!load) throw new Error(`Untrusted PCI module: ${authoredPath}`);
    return load();
  }
};
```

### Listen for interactions/responses

```js
el.addEventListener('ready', () => console.log('ready'));
el.addEventListener('response-change', (event) => console.log(event.detail));
el.addEventListener('submit', (event) => console.log(event.detail));
el.addEventListener('complete', (event) => console.log(event.detail));
```

These custom events are typed, bubbling, and composed. Existing `onResponseChange`, `onSubmit`, and
`onComplete` callback properties remain available for compatibility.

Score the current responses imperatively when the host owns the submit UI:

```js
const result = el.submit();
```

TypeScript users get `HTMLElementTagNameMap` inference for all four player element tag names. Import
runtime constructors from the browser-only entry when needed:

```ts
import { QtiItemPlayerElement } from '@pie-qti/player-elements/elements';
```

## `pie-qti-assessment-player`

### Standard (B): pass `assessmentTest` XML + base URL for `href` item resolution

```js
import '@pie-qti/player-elements/register';

const el = document.querySelector('pie-qti-assessment-player');
el.referenceMode = true; // explicit preview/offline mode; see security boundary below
el.assessmentTestXml = assessmentTestXmlString; // QTI <assessmentTest>...</assessmentTest>
el.itemBaseUrl = 'https://my-cdn.example.com/qti/'; // used to resolve assessmentItemRef@href
```

### Fallback/convenience (A): pass `assessmentTest` XML + an in-memory item map

```js
import '@pie-qti/player-elements/register';

const el = document.querySelector('pie-qti-assessment-player');
el.referenceMode = true; // explicit preview/offline mode
el.assessmentTestXml = assessmentTestXmlString;

// Map keys can be either the assessmentItemRef@href value OR the assessmentItemRef@identifier
el.items = {
  'items/item-1.xml': item1Xml,
  'ITEM-2': item2Xml
};
```

### (Optional) config

```js
el.config = {
  role: 'candidate', // QTI role/view actor
  showSections: true
};
```

The assessment element also exposes the same JS-only `.pci` property. It is propagated through
section rendering to every item player, so no Svelte API or implementation package is required:

```js
el.pci = {
  baseUrl: 'https://content.example/assessment/',
  moduleResolver: trustedPciResolver
};
```

The standalone split-pane and vertical section elements expose `.pci` with the same shape.

Navigation and submission modes are read from the `assessmentTest` XML; setting them in `config`
does not override the document.

> **Reference/demo boundary:** raw `assessmentTest` XML is accepted only after explicitly enabling
> `referenceMode`; that mode uses the client-side `ReferenceBackendAdapter`, so correct responses,
> scoring rules, and item XML reach the browser. For authoritative delivery, set the element's
> `backend` and `initSession` properties (or `assessmentId` plus `candidateId`) instead. The local
> XML facade still parses only a limited subset of `assessmentTest` semantics.

### Listen for lifecycle + state events

```js
el.addEventListener('item-change', (e) => console.log('item', e.detail));
el.addEventListener('section-change', (e) => console.log('section', e.detail));
el.addEventListener('response-change', (e) => console.log('responses', e.detail.responses));
el.addEventListener('submit', (e) => console.log('results', e.detail.results));
el.addEventListener('complete', () => console.log('complete'));

// Optional loading lifecycle (useful if you rely on base-url fetching)
el.addEventListener('load-start', () => console.log('loading...'));
el.addEventListener('load-end', () => console.log('loaded'));
el.addEventListener('load-error', (e) => console.error(e.detail.message));
```

### Imperative API

```js
await el.next();
await el.previous();
await el.navigateTo(0);
await el.navigateToSection('section-1');
const results = await el.submit();
const state = el.getState();
el.restoreState(state);
```
