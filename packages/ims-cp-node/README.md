# @pie-qti/ims-cp-node

Node.js-specific IMS Content Package utilities for server-side QTI processing.

## Features

- **ZIP Extraction**: Secure ZIP/IMSCC package extraction with path traversal protection
- **Manifest Resolution**: Parse and resolve IMS manifest files using `@pie-qti/ims-cp-core`
- **Directory Support**: Work with both extracted directories and ZIP files
- **Temporary Extraction**: Automatic temp directory management with cleanup
- **Localized Resources**: Built-in support for multilingual content packages
- **Type-Safe API**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
bun add @pie-qti/ims-cp-node
```

## Usage

### Opening Packages

```typescript
import { openContentPackage, loadResolvedManifest } from '@pie-qti/ims-cp-node';

// Open a ZIP file (extracts to temp directory)
const pkg = await openContentPackage('/path/to/package.zip');
console.log(`Package root: ${pkg.packageRoot}`);

// Load and parse manifest
const manifest = await loadResolvedManifest(pkg.packageRoot);
console.log(`Items: ${manifest.items.length}`);

// Clean up temp directory
await pkg.close();
```

### Working with Directories

```typescript
// Open an already-extracted package directory
const pkg = await openContentPackage('/path/to/extracted-package');
const manifest = await loadResolvedManifest(pkg.packageRoot);

// No cleanup needed for directory packages
await pkg.close(); // no-op
```

### Extracting to Specific Directory

```typescript
// Extract to a specific location (no temp cleanup)
const pkg = await openContentPackage('/path/to/package.zip', {
  extractToDir: '/path/to/extract-location'
});
```

### Accessing Manifest Resources

```typescript
const manifest = await loadResolvedManifest(packageRoot);

// Access QTI items
for (const item of manifest.items) {
  console.log(`Item: ${item.identifier}`);
  console.log(`Main file: ${item.hrefResolved}`);
  console.log(`Dependencies: ${item.filesResolved.join(', ')}`);
}

// Get absolute file path for reading
import { toAbsolutePath } from '@pie-qti/ims-cp-node';
const itemPath = toAbsolutePath(packageRoot, item.hrefResolved);
const itemXml = await readFile(itemPath, 'utf-8');
```

### Localized Packages

```typescript
import { loadLocalizedResolvedManifest } from '@pie-qti/ims-cp-node';

// Load with locale support
const manifest = await loadLocalizedResolvedManifest(packageRoot, 'en-US');

console.log('Available locales:', manifest.localized.availableLocales);

// Access localized item variants
const item = getLocalizedItem(manifest.localized, 'item-id', 'es-ES');
```

## API

### `openContentPackage(inputPath, options?)`

Opens a content package from a ZIP file or directory.

**Parameters:**
- `inputPath: string` - Path to ZIP file or directory
- `options?: OpenContentPackageOptions`
  - `tmpRootDir?: string` - Custom temp directory location
  - `extractToDir?: string` - Extract to specific directory (disables temp cleanup)

**Returns:** `Promise<OpenContentPackage>`
- `packageRoot: string` - Absolute path to package root
- `isTemporary: boolean` - Whether package was extracted to temp
- `close: () => Promise<void>` - Cleanup function (removes temp dir)

### `loadResolvedManifest(packageRoot)`

Parses and resolves manifest with all resource paths.

**Parameters:**
- `packageRoot: string` - Absolute path to package root

**Returns:** `Promise<ResolvedManifest>`
- `identifier: string` - Package identifier
- `manifestPath: string` - Relative path to manifest file
- `resources: Map<string, ResolvedManifestResource>` - All resources by ID
- `items: ResolvedManifestResource[]` - QTI assessment items
- `passages: ResolvedManifestResource[]` - QTI passages
- `tests: ResolvedManifestResource[]` - QTI tests

### `loadLocalizedResolvedManifest(packageRoot, defaultLocale?)`

Loads manifest with localized resource grouping.

**Parameters:**
- `packageRoot: string` - Absolute path to package root
- `defaultLocale?: string` - Default locale (default: "en-US")

**Returns:** `Promise<LocalizedResolvedManifest>` - Extends `ResolvedManifest` with `localized` property

### `toAbsolutePath(packageRoot, packageRelativePosixPath)`

Converts package-relative POSIX path to absolute filesystem path.

**Parameters:**
- `packageRoot: string` - Package root directory
- `packageRelativePosixPath: string` - Package-relative path

**Returns:** `string` - Absolute filesystem path

### `extractZipToDir(zipPath, targetDir)`

Extracts a ZIP file to a directory with security checks.

**Parameters:**
- `zipPath: string` - Path to ZIP file
- `targetDir: string` - Target extraction directory

**Returns:** `Promise<void>`

## Security

This package includes protection against ZIP path traversal attacks:
- Validates all entry paths
- Rejects paths with `..` segments
- Rejects absolute paths
- Ensures all extracted files stay within target directory

## Dependencies

- **unzipper** - Secure ZIP extraction for Node.js
- **@pie-qti/ims-cp-core** - Universal manifest parsing utilities

## License

MIT
