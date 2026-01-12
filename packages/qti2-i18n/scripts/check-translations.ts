#!/usr/bin/env bun
/**
 * Translation Coverage Checker
 *
 * This script compares all locale files against the en-US reference to detect:
 * 1. Missing keys in other locales
 * 2. Extra keys that don't exist in en-US (likely obsolete)
 * 3. Keys with identical values to en-US (likely untranslated)
 *
 * Usage:
 *   bun run scripts/check-translations.ts
 *   bun run scripts/check-translations.ts --locale nl-NL  # Check specific locale
 *   bun run scripts/check-translations.ts --fix           # Auto-add missing keys with TODO markers
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '../src/locales');
const REFERENCE_LOCALE = 'en-US';

interface TranslationObject {
	[key: string]: string | TranslationObject;
}

interface LocaleData {
	locale: string;
	data: TranslationObject;
	filePath: string;
}

/**
 * Flatten nested object into dot-notation keys
 * Example: { common: { submit: 'Submit' } } => { 'common.submit': 'Submit' }
 */
function flattenObject(obj: TranslationObject, prefix = ''): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			// Handle nested objects (but not arrays like plural forms)
			Object.assign(result, flattenObject(value, fullKey));
		} else {
			// Leaf node - store the value as string
			result[fullKey] = typeof value === 'string' ? value : JSON.stringify(value);
		}
	}

	return result;
}

/**
 * Load and parse a locale file
 */
async function loadLocale(localeName: string): Promise<LocaleData> {
	const filePath = join(LOCALES_DIR, `${localeName}.ts`);
	const content = await readFile(filePath, 'utf-8');

	// Extract the default export object
	// This is a simple approach - assumes the file exports a single object
	const match = content.match(/export default\s+({[\s\S]*})\s+as const;?/);
	if (!match) {
		throw new Error(`Could not parse locale file: ${localeName}`);
	}

	// Use eval to parse the object (safe since we control the source)
	// In production, you might want to use a proper TypeScript parser
	const objectString = match[1];
	const data = eval(`(${objectString})`);

	return {
		locale: localeName,
		data,
		filePath,
	};
}

/**
 * Get all locale files except the reference
 */
async function getLocaleFiles(): Promise<string[]> {
	const files = await readdir(LOCALES_DIR);
	return files
		.filter((f) => f.endsWith('.ts') && f !== `${REFERENCE_LOCALE}.ts`)
		.map((f) => f.replace('.ts', ''));
}

/**
 * Compare two flattened locale objects and find differences
 */
/**
 * Check if a key is a valid plural form extension
 * Languages like Arabic have more plural forms than English (zero, one, two, few, many, other)
 */
function isValidPluralExtension(key: string): boolean {
	// Arabic and other languages with extended plural forms
	const pluralForms = ['.zero', '.one', '.two', '.few', '.many', '.other'];
	return pluralForms.some(form => key.endsWith(form)) && key.startsWith('plurals.');
}

function compareLocales(reference: Record<string, string>, target: Record<string, string>) {
	const missing: string[] = [];
	const extra: string[] = [];
	const untranslated: string[] = [];

	// Find missing keys
	for (const key of Object.keys(reference)) {
		if (!(key in target)) {
			missing.push(key);
		} else if (reference[key] === target[key] && reference[key].length > 0) {
			// Key exists but value is identical to reference (likely untranslated)
			untranslated.push(key);
		}
	}

	// Find extra keys (exist in target but not in reference)
	for (const key of Object.keys(target)) {
		if (!(key in reference)) {
			// Don't flag valid plural form extensions as "extra"
			if (!isValidPluralExtension(key)) {
				extra.push(key);
			}
		}
	}

	return { missing, extra, untranslated };
}

/**
 * Format the report for a single locale
 */
function formatLocaleReport(
	localeName: string,
	missing: string[],
	extra: string[],
	untranslated: string[],
	totalKeys: number
): string {
	const coveragePercent = ((totalKeys - missing.length) / totalKeys * 100).toFixed(1);

	let report = `\n${'='.repeat(80)}\n`;
	report += `📋 Locale: ${localeName}\n`;
	report += `${'='.repeat(80)}\n`;
	report += `Coverage: ${coveragePercent}% (${totalKeys - missing.length}/${totalKeys} keys)\n`;

	if (missing.length === 0 && extra.length === 0 && untranslated.length === 0) {
		report += `✅ Perfect! All keys are present and translated.\n`;
		return report;
	}

	if (missing.length > 0) {
		report += `\n❌ Missing Keys (${missing.length}):\n`;
		report += `${'─'.repeat(80)}\n`;
		missing.sort().forEach((key) => {
			report += `  • ${key}\n`;
		});
	}

	if (extra.length > 0) {
		report += `\n⚠️  Extra Keys (${extra.length}) - Not in reference, possibly obsolete:\n`;
		report += `${'─'.repeat(80)}\n`;
		extra.sort().forEach((key) => {
			report += `  • ${key}\n`;
		});
	}

	if (untranslated.length > 0) {
		report += `\n⚠️  Potentially Untranslated (${untranslated.length}) - Same value as en-US:\n`;
		report += `${'─'.repeat(80)}\n`;
		untranslated.sort().forEach((key) => {
			report += `  • ${key}\n`;
		});
	}

	return report;
}

/**
 * Main function
 */
async function main() {
	const args = process.argv.slice(2);
	const specificLocale = args.find((arg) => arg.startsWith('--locale='))?.split('=')[1];
	const fixMode = args.includes('--fix');

	console.log('🔍 Translation Coverage Checker\n');
	console.log(`📁 Locales directory: ${LOCALES_DIR}`);
	console.log(`📖 Reference locale: ${REFERENCE_LOCALE}\n`);

	// Load reference locale
	const reference = await loadLocale(REFERENCE_LOCALE);
	const referenceFlat = flattenObject(reference.data);
	const totalKeys = Object.keys(referenceFlat).length;

	console.log(`✓ Loaded reference: ${REFERENCE_LOCALE} (${totalKeys} keys)\n`);

	// Get all locales to check
	const allLocales = await getLocaleFiles();
	const localesToCheck = specificLocale
		? allLocales.filter((l) => l === specificLocale)
		: allLocales;

	if (localesToCheck.length === 0) {
		console.error(`❌ Locale not found: ${specificLocale}`);
		process.exit(1);
	}

	let hasIssues = false;
	const summaryData: Array<{
		locale: string;
		coverage: number;
		missing: number;
		extra: number;
		untranslated: number;
	}> = [];

	// Check each locale
	for (const localeName of localesToCheck) {
		const target = await loadLocale(localeName);
		const targetFlat = flattenObject(target.data);

		const { missing, extra, untranslated } = compareLocales(referenceFlat, targetFlat);

		const coverage = ((totalKeys - missing.length) / totalKeys * 100);
		summaryData.push({
			locale: localeName,
			coverage,
			missing: missing.length,
			extra: extra.length,
			untranslated: untranslated.length,
		});

		const report = formatLocaleReport(localeName, missing, extra, untranslated, totalKeys);
		console.log(report);

		if (missing.length > 0 || extra.length > 0) {
			hasIssues = true;
		}

		if (fixMode && missing.length > 0) {
			console.log(`\n🔧 Fix mode enabled - adding missing keys to ${localeName}...\n`);
			// Note: Actual fix implementation would go here
			// This requires reconstructing the nested object structure and updating the file
			console.log(`   (Fix mode not yet implemented - would add ${missing.length} keys)\n`);
		}
	}

	// Print summary table
	if (localesToCheck.length > 1) {
		console.log(`\n${'='.repeat(80)}`);
		console.log(`📊 SUMMARY TABLE`);
		console.log(`${'='.repeat(80)}\n`);
		console.log(`Locale      Coverage    Missing    Extra    Untranslated`);
		console.log(`${'─'.repeat(80)}`);

		summaryData
			.sort((a, b) => b.coverage - a.coverage)
			.forEach((item) => {
				const status = item.coverage === 100 && item.extra === 0 ? '✅' : '⚠️ ';
				const coverageStr = `${item.coverage.toFixed(1)}%`.padEnd(10);
				const localeStr = item.locale.padEnd(10);
				const missingStr = item.missing.toString().padEnd(9);
				const extraStr = item.extra.toString().padEnd(8);
				const untransStr = item.untranslated.toString().padEnd(8);

				console.log(`${status} ${localeStr} ${coverageStr} ${missingStr} ${extraStr} ${untransStr}`);
			});

		console.log(`${'─'.repeat(80)}\n`);
	}

	// Exit with error code if issues found
	if (hasIssues) {
		console.log('❌ Translation coverage issues detected.\n');
		process.exit(1);
	} else {
		console.log('✅ All locales have complete translation coverage!\n');
		process.exit(0);
	}
}

main().catch((error) => {
	console.error('❌ Error:', error.message);
	process.exit(1);
});
