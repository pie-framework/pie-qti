# @pie-qti/ims-cp-browser

Browser-compatible IMS Content Package utilities for loading and processing QTI packages in web applications.

## Features

- **ZIP Package Extraction**: Extract IMS Content Packages (ZIP/IMSCC) in the browser using JSZip
- **Virtual File System**: In-memory file system for accessing package contents
- **Manifest Parsing**: Parse and resolve IMS manifest files with resource dependencies
- **Storage Persistence**: Optional persistence using sessionStorage, localStorage, or custom backends
- **Type-Safe API**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
bun add @pie-qti/ims-cp-browser
```

## Usage

### Basic Package Loading

```typescript
import { openPackage } from '@pie-qti/ims-cp-browser';

// From file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const pkg = await openPackage(file);

  console.log(`Package: ${pkg.manifest.identifier}`);
  console.log(`Items: ${pkg.manifest.items.length}`);
  console.log(`Tests: ${pkg.manifest.tests.length}`);
});
```

### Accessing Package Files

```typescript
// Read text files (XML, HTML, etc.)
const itemXml = pkg.readText('items/item-1.xml');

// Read binary files as Blob
const imageBlob = pkg.readBinary('images/diagram.png');

// Get data URL for displaying images
const imageUrl = pkg.getDataUrl('images/diagram.png');
```

### Navigating Manifest Resources

```typescript
// Access items
for (const item of pkg.manifest.items) {
  console.log(`Item: ${item.identifier}`);
  console.log(`Main file: ${item.hrefResolved}`);
  console.log(`Dependencies: ${item.filesResolved.join(', ')}`);
}

// Access specific resource by ID
const resource = pkg.manifest.resources.get('ITEM-001');
if (resource) {
  const content = pkg.readText(resource.hrefResolved);
}
```

### Storage Persistence

```typescript
import { openPackage, loadPackageFromStorage, LocalStorageBackend } from '@pie-qti/ims-cp-browser';

// Use localStorage for persistence across sessions
const storage = new LocalStorageBackend();
const pkg = await openPackage(file, { storage });

// Later, reload from storage
const savedPkg = await loadPackageFromStorage(pkg.packageId, storage);
```

### Custom Storage Backend

```typescript
import type { StorageBackend } from '@pie-qti/ims-cp-browser';

class IndexedDBBackend implements StorageBackend {
  async store(key: string, data: any): Promise<void> {
    // Implement IndexedDB storage
  }

  async retrieve(key: string): Promise<any | null> {
    // Implement IndexedDB retrieval
  }

  async delete(key: string): Promise<void> {
    // Implement deletion
  }

  async clear(): Promise<void> {
    // Implement clear
  }
}
```

## API

### `openPackage(file, options)`

Opens and extracts an IMS Content Package from a browser File object.

**Parameters:**
- `file: File` - Browser File object (from file input or drag-and-drop)
- `options?: OpenPackageOptions`
  - `storage?: StorageBackend` - Storage backend for persistence (default: sessionStorage)
  - `maxFileSize?: number` - Maximum file size in bytes (default: 50MB)
  - `maxFiles?: number` - Maximum number of files (default: 1000)

**Returns:** `Promise<VirtualPackage>`

### `VirtualPackage`

Main interface for accessing package contents:

- `packageId: string` - Unique package identifier
- `files: Map<string, VirtualFile>` - All files in the package
- `manifest: ResolvedManifest` - Parsed manifest with resolved paths
- `getFile(path: string): VirtualFile | null` - Get file by path
- `readText(path: string): string | null` - Read text file content
- `readBinary(path: string): Blob | null` - Read binary file as Blob
- `getDataUrl(path: string): string | null` - Get data URL for file
- `listFiles(directory?: string): VirtualFile[]` - List files in directory
- `save(): Promise<void>` - Save to storage backend
- `close(): Promise<void>` - Clean up resources

### Storage Backends

- `SessionStorageBackend` - Uses browser sessionStorage (default)
- `LocalStorageBackend` - Uses browser localStorage (persistent)
- `MemoryStorageBackend` - In-memory storage (useful for testing)

## Limitations

- Binary files are not persisted to storage (only text files like XML/HTML)
- Storage backends have size limits (typically 5-10MB for sessionStorage/localStorage)
- For large packages, consider using IndexedDB (custom backend implementation required)

## Dependencies

- **jszip** - ZIP file extraction in the browser
- **@pie-qti/ims-cp-core** - Manifest parsing and resource resolution

## License

MIT
