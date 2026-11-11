# @pie-qti/ims-cp-core

Core IMS Content Package utilities for manifest parsing and resource resolution.

**100% browser-compatible** - works in both browser and Node.js environments.

## Features

- **Manifest Parsing**: Parse IMS Content Package manifest files (imsmanifest.xml)
- **Localized Resources**: Extract and manage multilingual content variants
- **Passage Reusability**: Detect and deduplicate reusable passage content
- **Universal Hashing**: SHA-256 hashing using Web Crypto API (browser) or Node.js crypto

## Installation

```bash
bun add @pie-qti/ims-cp-core
```

## Usage

### Manifest Parsing

```typescript
import { parseManifest } from '@pie-qti/ims-cp-core';

const manifestXml = `<?xml version="1.0"?>
<manifest identifier="package-1" ...>
  ...
</manifest>`;

const manifest = parseManifest(manifestXml, '/path/to/package');
console.log(manifest.items); // Array of QTI items
console.log(manifest.tests); // Array of QTI tests
```

### Localized Resources

```typescript
import { buildLocalizedManifest } from '@pie-qti/ims-cp-core/localized-resources';

const localized = buildLocalizedManifest(manifest, 'en-US');
console.log(localized.availableLocales); // Set of all locales
```

### Passage Reusability

```typescript
import { generateStablePassageId, parseObjectReference, PassageRegistry } from '@pie-qti/ims-cp-core/passage-reusability';

// Generate stable ID from content (async)
const id = await generateStablePassageId({
  content: '<p>The Industrial Revolution...</p>'
});

// Parse an <object> element into a passage reference (sync).
// A text/* type is a passage; an untyped object only when its data file
// looks like a markup document (.html, .xhtml, .xml).
const reference = parseObjectReference(objectElement);

// Track passage references across a package
const registry = new PassageRegistry();
registry.registerReference('item-1', {
  id: 'passage-123',
  source: 'file',
  isReusable: false
});
```

## API

### Breaking Changes from to-pie

- `generateStablePassageId()` is **async** (returns `Promise<string>`); inject a sync hash
  with `createStablePassageIdGenerator(hashContent)` when you need synchronous IDs
- `PassageRegistry.detectAndMergeDuplicates()` is **async**
- `parseObjectReference()` is **sync** and strict about untyped objects: an `<object>`
  without a `type` is a passage only when its `data` file looks like markup
  (`.html`, `.xhtml`, `.xml`); figures and other assets are not passages

## License

MIT
