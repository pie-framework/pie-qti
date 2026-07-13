# @pie-qti/player-elements

Framework-agnostic **Web Components (Custom Elements)** for the QTI players in this repo.

## Elements

- `pie-qti-item-player`
- `pie-qti-assessment-player`

## Install

The current default runtime is split across the player-element and interaction-component packages:

```bash
npm install @pie-qti/player-elements @pie-qti/default-components
```

## Register elements

```js
import '@pie-qti/default-components/plugins';
import '@pie-qti/player-elements/register';
```

`@pie-qti/player-elements/register` defines the player and section custom elements only. Importing
`@pie-qti/default-components/plugins` is currently required for the standard QTI interactions to
render. Without it, block interactions such as `choiceInteraction` are emitted as undefined custom
elements and are not usable.

Alternatively, install the loader and both of its runtime peers, then make one idempotent load call:

```bash
npm install @pie-qti/web-component-loaders @pie-qti/player-elements @pie-qti/default-components
```

```js
import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';

await loadPieQtiPlayerElements();
```

The split install is a known packaging gap. Consumers do not need to install Svelte; the published
JavaScript bundles its implementation runtime.

> **Security notice (2026-07-13):** same-DOM delivery currently has confirmed sanitizer bypasses
> in gap-match prompt reconstruction and the section/assessment TTS projection. Do not render
> untrusted QTI in the host origin until those sinks are fixed; use a cross-origin sandbox and
> enable parsing limits as defense in depth.

## `pie-qti-item-player`

### Pass QTI

Prefer setting the XML via property (attributes are awkward for large XML strings):

```js
import '@pie-qti/default-components/plugins';
import '@pie-qti/player-elements/register';

const el = document.querySelector('pie-qti-item-player');
el.itemXml = qtiItemXmlString;
el.role = 'candidate'; // QTI role/view actor
```

Attribute-backed properties are `itemXml`, `role`, and `disabled`. JS-only properties currently
include `renderItemBodyRubrics`, `typeset`, `i18n`, `security`, `pnp`, `deliveryContext`, and
`responses`.

### Listen for interactions/responses

```js
el.onResponseChange = (responseId, value) => console.log(responseId, value);
el.onSubmit = (responses, result) => console.log(responses, result);
el.onComplete = (result) => console.log(result);
```

The item element does not currently aggregate these callbacks into `response-change`, `submit`, or
`complete` DOM events, and it does not expose an imperative `submit()` method. Some block
interaction components emit bubbling `qti-change` events, but inline interactions do not, so use
the callback properties until the custom-element facade is completed.

## `pie-qti-assessment-player`

### Standard (B): pass `assessmentTest` XML + base URL for `href` item resolution

```js
import '@pie-qti/player-elements/register';

const el = document.querySelector('pie-qti-assessment-player');
el.assessmentTestXml = assessmentTestXmlString; // QTI <assessmentTest>...</assessmentTest>
el.itemBaseUrl = 'https://my-cdn.example.com/qti/'; // used to resolve assessmentItemRef@href
```

### Fallback/convenience (A): pass `assessmentTest` XML + an in-memory item map

```js
import '@pie-qti/player-elements/register';

const el = document.querySelector('pie-qti-assessment-player');
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

Navigation and submission modes are read from the `assessmentTest` XML; setting them in `config`
does not override the document.

> **Reference/demo boundary:** this element currently parses a limited subset of
> `assessmentTest` and always creates the client-side `ReferenceBackendAdapter`. Correct responses,
> scoring rules, and item XML therefore reach the browser. It is suitable for demos and low-stakes
> trusted content, not authoritative or high-stakes delivery. Use `@pie-qti/assessment-player`
> directly with a production `BackendAdapter` until the custom element supports backend injection.

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
