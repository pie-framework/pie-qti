/**
 * Schema Version Checker
 *
 * Checks if local schemas are up-to-date with pie-elements repository.
 * Useful for CI to detect schema drift.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PIE_ELEMENTS_PATH = resolve(import.meta.dirname, '../../../../pie-elements/packages');
const SCHEMAS_OUTPUT = resolve(import.meta.dirname, '../src/schemas');
const VERSIONS_FILE = resolve(import.meta.dirname, '../schema-versions.json');

interface SchemaVersion {
  version: string;
  schemaHash: string;
  syncedAt: string;
  sourcePath: string;
}

interface SchemaVersions {
  [elementName: string]: SchemaVersion;
}

function calculateHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

async function loadVersions(): Promise<SchemaVersions> {
  if (!existsSync(VERSIONS_FILE)) {
    console.warn('⚠️  No schema-versions.json found. Run `bun run sync` first.');
    return {};
  }
  const content = await readFile(VERSIONS_FILE, 'utf-8');
  return JSON.parse(content);
}

async function checkSchemas() {
  console.log('🔍 Checking schema versions...\n');

  if (!existsSync(PIE_ELEMENTS_PATH)) {
    console.error(`❌ PIE elements repository not found at: ${PIE_ELEMENTS_PATH}`);
    process.exit(1);
  }

  const versions = await loadVersions();
  const elements = Object.keys(versions);

  if (elements.length === 0) {
    console.error('❌ No schemas tracked. Run `bun run sync` first.');
    process.exit(1);
  }

  let outdatedCount = 0;
  let upToDateCount = 0;
  let missingCount = 0;

  for (const element of elements) {
    const info = versions[element];
    const schemaPath = resolve(PIE_ELEMENTS_PATH, element, 'docs/pie-schema.json');
    const localPath = resolve(SCHEMAS_OUTPUT, `${element}.json`);

    // Check if local schema exists
    if (!existsSync(localPath)) {
      console.error(`❌ ${element}: Local schema missing at ${localPath}`);
      missingCount++;
      continue;
    }

    // Check if source schema exists
    if (!existsSync(schemaPath)) {
      console.warn(`⚠️  ${element}: Source schema not found at ${schemaPath}`);
      continue;
    }

    try {
      // Check if source has changed
      const sourceContent = await readFile(schemaPath, 'utf-8');
      const sourceHash = calculateHash(sourceContent);

      if (sourceHash !== info.schemaHash) {
        console.warn(`⚠️  ${element}: Schema out of date (local: ${info.schemaHash}, remote: ${sourceHash})`);
        outdatedCount++;
      } else {
        console.log(`✅ ${element}: Up-to-date (v${info.version})`);
        upToDateCount++;
      }
    } catch (error) {
      console.error(`❌ ${element}: Error checking schema - ${(error as Error).message}`);
    }
  }

  console.log('\n📊 Status:');
  console.log(`   ✅ Up-to-date: ${upToDateCount}`);
  console.log(`   ⚠️  Outdated: ${outdatedCount}`);
  console.log(`   ❌ Missing: ${missingCount}`);

  if (outdatedCount > 0 || missingCount > 0) {
    console.log('\n💡 Run `bun run sync` to update schemas.');
    process.exit(1);
  }

  console.log('\n✨ All schemas are up-to-date!');
}

checkSchemas().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
