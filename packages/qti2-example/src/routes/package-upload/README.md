# QTI Package Upload Feature

## Overview

This feature allows users to upload complete QTI package ZIP files and browse all items, tests, and assets within the package.

## Phase 1 Implementation (Current)

✅ **Package Upload & Parsing**
- Upload ZIP file via drag-and-drop or file browser
- Extract ZIP contents
- Parse `imsmanifest.xml`
- Extract all items and tests from package
- Identify assets (images, styles, audio, video, passages)
- Display package contents in browser UI

## Files Created

### API Endpoint
- `src/routes/api/package-upload/+server.ts` - Enhanced upload handler that returns complete package structure

### Pages
- `src/routes/package-upload/+page.svelte` - Main upload page

### Components
- `src/routes/package-upload/components/PackageUploader.svelte` - File upload UI with drag-and-drop
- `src/routes/package-upload/components/PackageBrowser.svelte` - Package contents browser
- `src/routes/package-upload/components/ItemList.svelte` - List of items in package
- `src/routes/package-upload/components/TestList.svelte` - List of tests in package

## Usage

1. Navigate to `/package-upload`
2. Upload a QTI package ZIP file
3. View package summary (item count, test count, assets)
4. Browse items and tests in tables
5. Click "View" to view individual items/tests (Phase 2)

## Package Structure Supported

The uploader expects IMS Content Package format:
```
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

## API Response

The `/api/package-upload` endpoint returns:

```typescript
{
  success: true,
  package: {
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
    packageDir?: string; // For development
  }
}
```

## Next Steps (Phase 2)

- [ ] Create asset serving endpoint (`/api/package-assets/[packageId]/[...path]`)
- [ ] Create item viewer page (`/package-upload/[packageId]/item/[itemId]`)
- [ ] Create test viewer page (`/package-upload/[packageId]/test/[testId]`)
- [ ] Implement asset path resolution
- [ ] Integrate with QTI item/assessment players

## Testing

To test the feature:

1. Start the dev server: `bun run dev:example`
2. Navigate to http://localhost:5173/package-upload
3. Upload a QTI package ZIP file
4. Verify package contents are displayed correctly

## Known Limitations

- Packages are stored in temp directory (not persistent)
- Asset serving not yet implemented (Phase 2)
- Item/test viewing not yet implemented (Phase 2)
- No package persistence or management
