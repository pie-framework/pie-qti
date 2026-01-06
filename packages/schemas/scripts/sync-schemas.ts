/**
 * Schema Sync Script
 *
 * Syncs PIE element schemas from the pie-elements repository.
 * Assumes pie-elements is checked out as a sibling directory.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Relative path to pie-elements repository
const PIE_ELEMENTS_PATH = resolve(import.meta.dirname, '../../../../pie-elements/packages');
const SCHEMAS_OUTPUT = resolve(import.meta.dirname, '../src/schemas');
const VERSIONS_FILE = resolve(import.meta.dirname, '../schema-versions.json');

// Elements to sync schemas for
const ELEMENTS_TO_SYNC = [
  'multiple-choice',
  'extended-text-entry',
  'placement-ordering',
  'match',
  'explicit-constructed-response',
  'select-text',
  'inline-dropdown',
  'drag-in-the-blank',
  'ebsr',
  'hotspot',
  'image-cloze-association',
  'match-list',
  'passage',
  // Add more elements as needed
];
interface SchemaVersion {
  version: string;
  schemaHash: string;
  syncedAt: string;
  sourcePath: string;
}

interface SchemaVersions {
  [elementName: string]: SchemaVersion;
}

/**
 * Calculate SHA-256 hash of schema content
 */
function calculateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Load existing schema versions
 */
async function loadVersions(): Promise<SchemaVersions> {
  if (!existsSync(VERSIONS_FILE)) {
    return {};
  }
  const content = await readFile(VERSIONS_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save schema versions
 */
async function saveVersions(versions: SchemaVersions): Promise<void> {
  const content = JSON.stringify(versions, null, 2);
  await writeFile(VERSIONS_FILE, content, 'utf-8');
}

/**
 * Get package version from package.json
 */
async function getPackageVersion(elementPath: string): Promise<string> {
  try {
    const pkgPath = resolve(elementPath, 'package.json');
    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Sync schemas from pie-elements
 */
async function syncSchemas() {
  console.log('🔄 Syncing PIE element schemas...\n');

  // Check if pie-elements exists
  if (!existsSync(PIE_ELEMENTS_PATH)) {
    console.error(`❌ PIE elements repository not found at: ${PIE_ELEMENTS_PATH}`);
    console.error('   Please ensure pie-elements is checked out as a sibling directory.');
    process.exit(1);
  }

  // Load existing versions
  const versions = await loadVersions();
  const updatedVersions: SchemaVersions = {};
  let syncCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Create output directory
  await mkdir(SCHEMAS_OUTPUT, { recursive: true });

  for (const element of ELEMENTS_TO_SYNC) {
    const elementPath = resolve(PIE_ELEMENTS_PATH, element);
    const schemaPath = resolve(elementPath, 'docs/pie-schema.json');
    const outputPath = resolve(SCHEMAS_OUTPUT, `${element}.json`);

    try {
      // Check if schema exists
      if (!existsSync(schemaPath)) {
        console.warn(`⚠️  ${element}: Schema not found at ${schemaPath}`);
        errorCount++;
        continue;
      }

      // Read schema
      const schemaContent = await readFile(schemaPath, 'utf-8');
      const schemaHash = calculateHash(schemaContent);
      const version = await getPackageVersion(elementPath);

      // Check if schema has changed
      const existing = versions[element];
      if (existing && existing.schemaHash === schemaHash) {
        console.log(`⏭️  ${element}: Already up-to-date (v${version})`);
        updatedVersions[element] = existing;
        skipCount++;
        continue;
      }

      // Write schema
      await writeFile(outputPath, schemaContent, 'utf-8');

      // Update version info
      updatedVersions[element] = {
        version,
        schemaHash,
        syncedAt: new Date().toISOString(),
        sourcePath: schemaPath,
      };

      console.log(`✅ ${element}: Synced v${version} (hash: ${schemaHash})`);
      syncCount++;

    } catch (error) {
      console.error(`❌ ${element}: ${(error as Error).message}`);
      errorCount++;
    }
  }

  // Save version metadata
  await saveVersions(updatedVersions);

  // Summary
  console.log('\n📊 Sync Summary:');
  console.log(`   ✅ Synced: ${syncCount}`);
  console.log(`   ⏭️  Skipped (up-to-date): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`\n✨ Schema versions saved to: ${VERSIONS_FILE}`);
}

// Run sync
syncSchemas().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
