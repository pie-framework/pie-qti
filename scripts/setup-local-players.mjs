#!/usr/bin/env node

/**
 * Automatically sets up local pie-players linking if the sibling repository exists.
 *
 * This script runs during `bun install` and checks if:
 * 1. The pie-players repository exists as a sibling directory
 * 2. The bunfig.local.toml file doesn't already exist
 *
 * If both conditions are met, it creates bunfig.local.toml to enable local linking.
 * External users without pie-players checked out will see no change.
 */

import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const playersPath = join(repoRoot, '../pie-players');
const localConfigPath = join(repoRoot, 'bunfig.local.toml');
const exampleConfigPath = join(repoRoot, 'bunfig.local.example.toml');

// Check if pie-players exists as a sibling
const playersExists = existsSync(playersPath) && existsSync(join(playersPath, 'package.json'));

// Check if local config already exists
const localConfigExists = existsSync(localConfigPath);

if (playersExists && !localConfigExists) {
  console.log('\n✓ Detected pie-players repository as sibling');
  console.log('✓ Setting up local player linking for development...\n');

  try {
    copyFileSync(exampleConfigPath, localConfigPath);
    console.log('✓ Created bunfig.local.toml');
    console.log('✓ Local pie-players packages will be linked');
    console.log('\nℹ  Run "bun install" again to activate the links\n');
  } catch (error) {
    console.error('✗ Failed to create bunfig.local.toml:', error.message);
    process.exit(0); // Don't fail the install
  }
} else if (playersExists && localConfigExists) {
  // Silent - already set up
} else if (!playersExists) {
  // Silent - external user without pie-players, perfectly normal
}
