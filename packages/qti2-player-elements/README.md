# @pie-qti/qti2-player-elements

Framework-agnostic **Web Components (Custom Elements)** for the QTI 2.x players in this repo.

## Elements

- `pie-qti2-item-player`
- `pie-qti2-assessment-player`

## Install

```bash
npm install @pie-qti/qti2-player-elements
```

## Register elements

```js
import '@pie-qti/qti2-player-elements/register';
```

## `pie-qti2-item-player`

### Pass QTI

Prefer setting the XML via property (attributes are awkward for large XML strings):

```js
import '@pie-qti/qti2-player-elements/register';

const el = document.querySelector('pie-qti2-item-player');
el.itemXml = qtiItemXmlString;
el.identifier = 'item-1';
el.title = 'My Item';
el.role = 'candidate'; // QTI 2.x standard role
```

### Listen for interactions/responses

```js
el.addEventListener('response-change', (e) => {
  // e.detail = { responseId, value, responses }
  console.log(e.detail.responseId, e.detail.value);
});
```

## `pie-qti2-assessment-player`

### Standard (B): pass `assessmentTest` XML + base URL for `href` item resolution

```js
import '@pie-qti/qti2-player-elements/register';

const el = document.querySelector('pie-qti2-assessment-player');
el.assessmentTestXml = assessmentTestXmlString; // QTI <assessmentTest>...</assessmentTest>
el.itemBaseUrl = 'https://my-cdn.example.com/qti/'; // used to resolve assessmentItemRef@href
```

### Fallback/convenience (A): pass `assessmentTest` XML + an in-memory item map

```js
import '@pie-qti/qti2-player-elements/register';

const el = document.querySelector('pie-qti2-assessment-player');
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
  role: 'candidate', // QTI 2.x standard role
  navigationMode: 'nonlinear', // QTI 2.x navigation mode
  showSections: true
};
```

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


