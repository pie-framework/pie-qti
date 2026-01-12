#!/usr/bin/env bun
/**
 * Hardcoded String Scanner
 *
 * Scans component files (.svelte, .ts) for potential hardcoded English strings
 * that should use i18n translations instead.
 *
 * Usage:
 *   bun run scripts/scan-hardcoded-strings.ts
 *   bun run scripts/scan-hardcoded-strings.ts --path=../qti2-default-components
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '../src/locales');

interface HardcodedMatch {
	file: string;
	line: number;
	content: string;
	potentialKey?: string;
}

/**
 * Flatten nested object into key-value pairs
 */
function flattenObject(obj: any, prefix = ''): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			Object.assign(result, flattenObject(value, fullKey));
		} else if (typeof value === 'string') {
			result[fullKey] = value;
		}
	}

	return result;
}

/**
 * Load all English translation values to compare against
 */
async function loadEnglishTranslations(): Promise<Map<string, { key: string; value: string }>> {
	const enUSPath = join(LOCALES_DIR, 'en-US.ts');

	// Dynamically import the locale file
	const localeModule = await import(enUSPath);
	const localeData = localeModule.default;

	// Flatten the translations
	const flattened = flattenObject(localeData);
	const translations = new Map<string, { key: string; value: string }>();

	for (const [key, value] of Object.entries(flattened)) {
		// Normalize: lowercase, trim, collapse whitespace
		const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();

		// Skip very short strings, technical terms, and interpolations
		if (normalized.length >= 8 &&
		    !normalized.includes('{') &&
		    !normalized.includes('http') &&
		    !key.includes('demo.')) {
			translations.set(normalized, { key, value });
		}
	}

	return translations;
}

/**
 * Scan a file for potential hardcoded strings
 */
async function scanFile(
	filePath: string,
	knownTranslations: Map<string, { key: string; value: string }>
): Promise<HardcodedMatch[]> {
	const content = await readFile(filePath, 'utf-8');
	const lines = content.split('\n');
	const matches: HardcodedMatch[] = [];

	// Patterns to detect hardcoded strings
	const patterns = [
		// HTML text content between tags (but not attributes)
		/>([A-Z][a-zA-Z\s\(\)]{7,})</g,
		// String literals in quotes (but not in i18n calls or imports)
		/(?<!i18n\?\.t\(|i18n\.t\(|import |from )['"]([A-Z][a-zA-Z\s\(\)]{8,})['"]/g,
	];

	lines.forEach((line, index) => {
		// Skip comments
		if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('<!--')) {
			return;
		}

		// Skip lines that already use i18n
		if (line.includes('i18n?.t(') || line.includes('i18n.t(')) {
			return;
		}

		// Skip imports, type definitions, and console logs
		if (line.includes('import') || line.includes('interface') || line.includes('type ') || line.includes('console.')) {
			return;
		}

		for (const pattern of patterns) {
			pattern.lastIndex = 0; // Reset regex
			let match: RegExpExecArray | null;

			while ((match = pattern.exec(line)) !== null) {
				const text = match[1].trim();

				// Skip if too short or looks like code
				if (text.length < 8 || text.includes('{}') || text.includes('[]')) {
					continue;
				}

				// Check if this text exists in translations
				const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
				if (knownTranslations.has(normalized)) {
					const translation = knownTranslations.get(normalized)!;
					matches.push({
						file: filePath,
						line: index + 1,
						content: line.trim(),
						potentialKey: `Use: i18n?.t('${translation.key}') ?? '${translation.value}'`,
					});
				}
			}
		}
	});

	return matches;
}

/**
 * Recursively scan directory for component files
 */
async function scanDirectory(
	dirPath: string,
	knownTranslations: Map<string, { key: string; value: string }>
): Promise<HardcodedMatch[]> {
	const allMatches: HardcodedMatch[] = [];

	async function scan(currentPath: string) {
		const entries = await readdir(currentPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(currentPath, entry.name);

			if (entry.isDirectory()) {
				// Skip node_modules, dist, .git
				if (!['node_modules', 'dist', '.git', 'build'].includes(entry.name)) {
					await scan(fullPath);
				}
			} else if (entry.isFile()) {
				// Only scan component files
				if (entry.name.endsWith('.svelte') || entry.name.endsWith('.ts')) {
					// Skip test files and type definition files
					if (!entry.name.includes('.test.') && !entry.name.endsWith('.d.ts')) {
						const matches = await scanFile(fullPath, knownTranslations);
						allMatches.push(...matches);
					}
				}
			}
		}
	}

	await scan(dirPath);
	return allMatches;
}

/**
 * Main function
 */
async function main() {
	const args = process.argv.slice(2);
	let scanPaths: string[] = [];

	// Parse command line arguments
	let customPath = false;
	for (const arg of args) {
		if (arg.startsWith('--path=')) {
			const path = arg.substring('--path='.length);
			scanPaths = [join(__dirname, path)];
			customPath = true;
		}
	}

	// Default: scan all player packages
	if (!customPath) {
		scanPaths = [
			join(__dirname, '../../qti2-item-player/src'),
			join(__dirname, '../../qti2-assessment-player/src'),
			join(__dirname, '../../qti2-default-components/src'),
		];
	}

	console.log('🔍 Hardcoded String Scanner\n');
	console.log(`📁 Scanning directories:`);
	for (const path of scanPaths) {
		console.log(`   - ${path}`);
	}
	console.log(`\n📖 Loading English translations...\n`);

	const knownTranslations = await loadEnglishTranslations();
	console.log(`✓ Loaded ${knownTranslations.size} translation values\n`);

	console.log('🔎 Scanning for hardcoded strings...\n');

	// Scan all directories and collect matches
	const allMatches: HardcodedMatch[] = [];
	for (const scanPath of scanPaths) {
		const matches = await scanDirectory(scanPath, knownTranslations);
		allMatches.push(...matches);
	}

	const matches = allMatches;

	if (matches.length === 0) {
		console.log('✅ No hardcoded strings detected that match known translations!\n');
		process.exit(0);
	}

	// Group by file
	const byFile = new Map<string, HardcodedMatch[]>();
	for (const match of matches) {
		if (!byFile.has(match.file)) {
			byFile.set(match.file, []);
		}
		byFile.get(match.file)!.push(match);
	}

	console.log(`⚠️  Found ${matches.length} potential hardcoded strings in ${byFile.size} files:\n`);
	console.log('═'.repeat(80));

	const rootPath = join(__dirname, '../..');
	for (const [file, fileMatches] of byFile.entries()) {
		const relPath = relative(rootPath, file);
		console.log(`\n📄 ${relPath} (${fileMatches.length} matches)`);
		console.log('─'.repeat(80));

		for (const match of fileMatches) {
			console.log(`  Line ${match.line}: ${match.content}`);
			if (match.potentialKey) {
				console.log(`           ${match.potentialKey}`);
			}
		}
	}

	console.log('\n' + '═'.repeat(80));
	console.log(`\n💡 Tip: These strings should use i18n?.t('key') ?? 'fallback' pattern\n`);

	// Don't exit with error - this is informational
	process.exit(0);
}

main().catch((error) => {
	console.error('❌ Error:', error.message);
	process.exit(1);
});
