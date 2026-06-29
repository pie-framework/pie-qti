# QTI Package Upload Feature

## Overview

This feature allows users to upload complete QTI package ZIP files and browse all items, tests, and assets within the package. **All processing happens entirely in the browser** — no server required!

## Implementation

✅ **Client-Side Package Processing**

- Upload ZIP file via drag-and-drop or file browser
- Extract ZIP contents in the browser using the shared IMS CP browser loader
- Parse `imsmanifest.xml` client-side
- Extract all items and tests from package
- Identify assets (images, styles, audio, video, passages)
- Store package data in browser storage (localStorage + sessionStorage)
- Display package contents in browser UI
- Navigate and view individual items

## Architecture

### Client-Side Processing

All package processing happens in the browser:

- **No server upload** — files stay on your machine
- **Privacy-first** — package data never leaves your browser
- **Works offline** — once loaded, no network required
- **Static deployment** — works on GitHub Pages

### Browser Storage

- **localStorage**: Package metadata (items list, structure)
- **sessionStorage**: File contents (XML files)
- **Data URLs**: Binary assets (images, etc.) for demo purposes

## Files

### Library

- `src/lib/package-processor.ts` - Client-side ZIP processing and storage utilities

### Pages

- `src/routes/package-upload/+page.svelte` - Main upload page
- `src/routes/package-upload/[packageId]/item/[itemId]/+page.svelte` - Item viewer

### Components

- `src/routes/package-upload/components/PackageUploader.svelte` - File upload UI with drag-and-drop
- `src/routes/package-upload/components/PackageBrowser.svelte` - Package contents browser
- `src/routes/package-upload/components/ItemList.svelte` - List of items in package
- `src/routes/package-upload/components/TestList.svelte` - List of tests in package

## Usage

1. Navigate to `/package-upload`
2. Upload a QTI package ZIP file (drag-and-drop or browse)
3. Package is processed entirely in your browser
4. View package summary (item count, test count, assets)
5. Browse items and tests in tables
6. Click "View" to render individual items in the QTI player
7. Navigate between items with Previous/Next buttons
8. Package data persists across page reloads (stored in browser)

## Package Structure Supported

The uploader expects IMS Content Package format:

```text
package.zip
├── imsmanifest.xml
├── items/
│   └── ITEM-*.xml
├── tests/
│   └── TEST-*.xml
├── images/
├── styles/
├── passages/
├── audio/
└── video/
```

## Package Structure

The `processPackage()` function returns:

```typescript
{
  packageId: string;
  items: Array<{ identifier, href, title? }>;
  tests: Array<{ identifier, href, title? }>;
  assets: {
    images: string[];
    styles: string[];
    audio: string[];
    video: string[];
    passages: string[];
  };
  manifest: any;
}
```

## Security Features

- **File size limit**: 50MB maximum to prevent browser memory issues
- **File count limit**: 1000 files maximum to prevent zip bomb attacks
- **Path validation**: Prevents path traversal attacks
- **Client-side only**: No server-side vulnerabilities

## Testing

To test the feature:

1. Start the dev server: `bun run dev`
2. Navigate to <http://localhost:5173/package-upload>
3. Upload a QTI package ZIP file
4. Verify package contents are displayed correctly
5. Click an item to view it
6. Test navigation between items

## Known Limitations

- **Storage limits**: Browser storage has size limits (~5-10MB for localStorage, more for sessionStorage)
- **Large packages**: Packages with many large images may exceed browser storage capacity
- **Session-based**: Package files cleared when browser tab is closed (sessionStorage)
- **No test viewer**: Only item viewing is implemented currently

## Future Enhancements

- [ ] Implement test/assessment viewer
- [ ] Add IndexedDB support for larger packages
- [ ] Implement asset path resolution in items
- [ ] Add package export functionality
- [ ] Support for shared stimulus/passages
