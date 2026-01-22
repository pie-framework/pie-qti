/**
 * Fixture Loading Utilities
 * Helpers for loading test fixtures from various locations
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load fixture from a specific package's fixtures directory
 *
 * @param packageName Name of the package (e.g., 'qti2-to-pie')
 * @param fixturePath Relative path within the package's tests/fixtures directory
 * @returns File contents as string
 *
 * @example
 * ```typescript
 * const qti = loadFixture('qti2-to-pie', 'multiple-choice/basic.xml');
 * ```
 */
export function loadFixture(packageName: string, fixturePath: string): string {
	// Try to resolve from project root
	const possiblePaths = [
		// Absolute path from cwd
		join(process.cwd(), 'packages', packageName, 'tests', 'fixtures', fixturePath),
		// Relative from this file
		join(process.cwd(), '..', packageName, 'tests', 'fixtures', fixturePath),
	];

	for (const fullPath of possiblePaths) {
		try {
			return readFileSync(fullPath, 'utf-8');
		} catch {
			// Try next path
		}
	}

	throw new Error(
		`Fixture not found: ${fixturePath} in package ${packageName}\n` +
			`Tried paths:\n${possiblePaths.map((p) => `  - ${p}`).join('\n')}`,
	);
}

/**
 * Load fixture from test-utils shared fixtures directory
 *
 * @param fixturePath Relative path within test-utils/fixtures
 * @returns File contents as string
 *
 * @example
 * ```typescript
 * const qti = loadSharedFixture('qti/multiple-choice/basic.xml');
 * const vendorQti = loadSharedFixture('vendors/pearson/hotspot-001.xml');
 * ```
 */
export function loadSharedFixture(fixturePath: string): string {
	// Get the directory of this file
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	// Go up from helpers/ to test-utils root, then into fixtures/
	const fullPath = join(__dirname, '..', '..', 'fixtures', fixturePath);

	try {
		return readFileSync(fullPath, 'utf-8');
	} catch (error) {
		throw new Error(
			`Shared fixture not found: ${fixturePath}\n` +
				`Tried path: ${fullPath}\n` +
				`Error: ${(error as Error).message}`,
		);
	}
}

/**
 * Load fixture as Buffer (for binary files)
 *
 * @param packageName Name of the package
 * @param fixturePath Relative path within the package's tests/fixtures directory
 * @returns File contents as Buffer
 */
export function loadFixtureBuffer(
	packageName: string,
	fixturePath: string,
): Buffer {
	const possiblePaths = [
		join(process.cwd(), 'packages', packageName, 'tests', 'fixtures', fixturePath),
		join(process.cwd(), '..', packageName, 'tests', 'fixtures', fixturePath),
	];

	for (const fullPath of possiblePaths) {
		try {
			return readFileSync(fullPath);
		} catch {
			// Try next path
		}
	}

	throw new Error(`Fixture not found: ${fixturePath} in package ${packageName}`);
}

/**
 * Load shared fixture as Buffer (for binary files)
 *
 * @param fixturePath Relative path within test-utils/fixtures
 * @returns File contents as Buffer
 */
export function loadSharedFixtureBuffer(fixturePath: string): Buffer {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);
	const fullPath = join(__dirname, '..', '..', 'fixtures', fixturePath);

	try {
		return readFileSync(fullPath);
	} catch (error) {
		throw new Error(
			`Shared fixture not found: ${fixturePath}\n` +
				`Tried path: ${fullPath}\n` +
				`Error: ${(error as Error).message}`,
		);
	}
}
