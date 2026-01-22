# Package Upload Feature - Phase 1 Implementation

## Overview

Phase 1 implements the foundation for uploading and browsing complete QTI packages. This allows users to upload a ZIP file containing a full QTI package and see all items, tests, and assets.

## What Was Implemented

### ✅ API Endpoint
- **File:** `src/routes/api/package-upload/+server.ts`
- **Functionality:**
  - Accepts ZIP file uploads
  - Extracts ZIP contents to temporary directory
  - Parses `imsmanifest.xml`
  - Extracts all items from `items/` directory
  - Extracts all tests from `tests/` directory
  - Identifies assets (images, styles, audio, video, passages)
  - Returns complete package structure

### ✅ User Interface
- **Main Page:** `src/routes/package-upload/+page.svelte`
  - Handles upload flow
  - Displays package browser after upload
  - Error handling

- **Components:**
  - `PackageUploader.svelte` - Drag-and-drop file upload
  - `PackageBrowser.svelte` - Package summary and navigation
  - `ItemList.svelte` - Table of all items in package
  - `TestList.svelte` - Table of all tests in package

### ✅ Navigation
- Added "Package Upload" button to home page

## Features

1. **Package Upload**
   - Drag-and-drop support
   - File browser support
   - Loading states
   - Error handling

2. **Package Parsing**
   - Extracts all items (not just first one)
   - Extracts all tests
   - Identifies all asset types
   - Preserves package structure

3. **Package Browser**
   - Summary statistics (item count, test count, assets)
   - Item list with identifiers and titles
   - Test list with identifiers and titles
   - Navigation buttons (ready for Phase 2)

## API Response Format

```typescript
{
  success: true,
  package: {
    packageId: string;           // Unique ID for this package
    items: Array<{                // All items in package
      identifier: string;
      href: string;               // Path to item XML file
      title?: string;
    }>;
    tests: Array<{                // All tests in package
      identifier: string;
      href: string;               // Path to test XML file
      title?: string;
    }>;
    assets: {
      images: string[];           // Paths to image files
      styles: string[];           // Paths to CSS files
      audio: string[];            // Paths to audio files
      video: string[];            // Paths to video files
      passages: string[];         // Paths to passage XML files
    };
    manifest: any;                // Parsed manifest XML
    packageDir?: string;          // Temp directory (dev only)
  }
}
```

## Testing

1. Start the dev server:
   ```bash
   bun run dev:example
   ```

2. Navigate to: http://localhost:5173/package-upload

3. Upload a QTI package ZIP file

4. Verify:
   - Package uploads successfully
   - Package contents are displayed
   - Item count matches package
   - Test count matches package
   - Asset counts are correct

## Known Limitations (Phase 1)

- ❌ Items/tests cannot be viewed yet (Phase 2)
- ❌ Assets are not served (Phase 2)
- ❌ Packages are stored in temp directory (not persistent)
- ❌ No package management (list, delete, etc.)

## Next Steps (Phase 2)

- [ ] Create asset serving endpoint (`/api/package-assets/[packageId]/[...path]`)
- [ ] Create item viewer page (`/package-upload/[packageId]/item/[itemId]`)
- [ ] Create test viewer page (`/package-upload/[packageId]/test/[testId]`)
- [ ] Implement asset path resolution in items
- [ ] Integrate with QTI item player
- [ ] Integrate with QTI assessment player

## Files Created

```
packages/qti2-example/src/routes/
├── api/
│   └── package-upload/
│       └── +server.ts              # API endpoint
└── package-upload/
    ├── +page.svelte                 # Main page
    ├── README.md                     # Documentation
    └── components/
        ├── PackageUploader.svelte   # Upload UI
        ├── PackageBrowser.svelte   # Browser UI
        ├── ItemList.svelte          # Items table
        └── TestList.svelte          # Tests table
```

## Dependencies

All dependencies are already in `package.json`:
- `unzipper` - ZIP extraction
- `xml2js` - XML parsing
- `@sveltejs/kit` - Framework

## Notes

- Packages are extracted to `os.tmpdir()/qti-packages/[packageId]`
- Package ID is generated: `pkg-[timestamp]-[random]`
- In production, consider using a database or file storage service
- Asset serving will be implemented in Phase 2
