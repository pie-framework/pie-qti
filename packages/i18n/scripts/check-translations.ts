#!/usr/bin/env bun
/**
 * Translation Coverage Checker
 *
 * This script compares all locale files against the en reference to detect:
 * 1. Missing keys in other locales
 * 2. Extra keys that don't exist in en (likely obsolete)
 * 3. Keys with identical values to en (likely untranslated)
 *
 * Usage:
 *   bun run scripts/check-translations.ts
 *   bun run scripts/check-translations.ts --locale=nl  # Check specific locale
 *   bun run scripts/check-translations.ts --fix           # Auto-add missing keys with TODO markers
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '../src/locales');
const REFERENCE_LOCALE = 'en';

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
 *
 * A locale may carry more CLDR categories than en does — Arabic has six where
 * English has two — so a `.two` or `.few` leaf is expected extra data, not an
 * obsolete key. Recognised anywhere a plural sub-object lives, not just under
 * `plurals.*`: the transform.* namespace uses the same convention. The sibling
 * check is what keeps this from excusing a genuine typo — the key only passes if
 * en defines the same parent with at least one category leaf.
 */
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

function isValidPluralExtension(key: string, reference: Record<string, string>): boolean {
	const lastDot = key.lastIndexOf('.');
	if (lastDot === -1) return false;

	const category = key.slice(lastDot + 1);
	if (!PLURAL_CATEGORIES.includes(category)) return false;

	const parent = key.slice(0, lastDot);
	return PLURAL_CATEGORIES.some((form) => `${parent}.${form}` in reference);
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
			if (!isValidPluralExtension(key, reference)) {
				extra.push(key);
			}
		}
	}

	return { missing, extra, untranslated };
}

/** A leaf of a plural group (`.one`, `.few`, …), where a locale may spell the number out. */
const PLURAL_LEAF = /\.(zero|one|two|few|many|other)$/;

/**
 * The unique `{name}` interpolation names a message uses, in order of first
 * appearance.
 */
export function placeholderNames(value: string): string[] {
	const names: string[] = [];
	for (const match of value.matchAll(/\{(\w+)\}/g)) {
		if (!names.includes(match[1])) names.push(match[1]);
	}
	return names;
}

/**
 * Why a locale's value for `key` uses different interpolation names than en, or
 * null when they agree.
 *
 * Regular keys must use exactly en's placeholder set: a renamed placeholder
 * leaves en's `{name}` unfilled in the translation, and a placeholder en does
 * not carry is never supplied a value and renders literally.
 *
 * A plural leaf may use a subset: locales that spell small counts out as words
 * (Romanian and Arabic `.one` forms such as "Mai este un caracter", "عنصر واحد")
 * are complete sentences that legitimately omit `{count}`. Inventing a name en
 * does not carry is still a violation there.
 */
export function placeholderViolation(key: string, reference: string, target: string): string | null {
	const expected = placeholderNames(reference);
	const actual = placeholderNames(target);

	if (PLURAL_LEAF.test(key)) {
		const invented = actual.filter((name) => !expected.includes(name));
		if (invented.length > 0) {
			return `introduces placeholder(s) {${invented.join('}, {')}} that en's "${reference}" does not carry`;
		}
		return null;
	}

	const missing = expected.filter((name) => !actual.includes(name));
	const invented = actual.filter((name) => !expected.includes(name));
	if (missing.length === 0 && invented.length === 0) return null;

	const parts: string[] = [];
	if (missing.length > 0) parts.push(`drops {${missing.join('}, {')}}`);
	if (invented.length > 0) parts.push(`introduces {${invented.join('}, {')}} which en does not carry`);
	return `${parts.join('; ')} (en: "${reference}", locale: "${target}")`;
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
		report += `\n⚠️  Potentially Untranslated (${untranslated.length}) - Same value as en:\n`;
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
		placeholderDrift: number;
	}> = [];

	// Check each locale
	for (const localeName of localesToCheck) {
		const target = await loadLocale(localeName);
		const targetFlat = flattenObject(target.data);

		const { missing, extra, untranslated } = compareLocales(referenceFlat, targetFlat);

		// Placeholder-name drift on keys both catalogs carry. Key parity alone
		// cannot see a renamed `{count}`: the key exists, the translation renders
		// a literal `{name}` to the candidate.
		const placeholderDrift: Array<{ key: string; detail: string }> = [];
		for (const key of Object.keys(referenceFlat)) {
			if (!(key in targetFlat)) continue;
			const violation = placeholderViolation(key, referenceFlat[key], targetFlat[key]);
			if (violation) placeholderDrift.push({ key, detail: violation });
		}

		const coverage = ((totalKeys - missing.length) / totalKeys * 100);
		summaryData.push({
			locale: localeName,
			coverage,
			missing: missing.length,
			extra: extra.length,
			untranslated: untranslated.length,
			placeholderDrift: placeholderDrift.length,
		});

		const report = formatLocaleReport(localeName, missing, extra, untranslated, totalKeys);
		if (placeholderDrift.length > 0) {
			let driftSection = `\n❌ Placeholder Drift (${placeholderDrift.length}) - interpolation names differ from en:\n`;
			driftSection += `${'─'.repeat(80)}\n`;
			for (const { key, detail } of placeholderDrift.sort((a, b) => a.key.localeCompare(b.key))) {
				driftSection += `  • ${key}: ${detail}\n`;
			}
			console.log(report + driftSection);
		} else {
			console.log(report);
		}

		if (missing.length > 0 || extra.length > 0 || placeholderDrift.length > 0) {
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
		console.log(`Locale      Coverage    Missing    Extra    Untranslated    PlaceholderDrift`);
		console.log(`${'─'.repeat(80)}`);

		summaryData
			.sort((a, b) => b.coverage - a.coverage)
			.forEach((item) => {
				const status = item.coverage === 100 && item.extra === 0 && item.placeholderDrift === 0 ? '✅' : '⚠️ ';
				const coverageStr = `${item.coverage.toFixed(1)}%`.padEnd(10);
				const localeStr = item.locale.padEnd(10);
				const missingStr = item.missing.toString().padEnd(9);
				const extraStr = item.extra.toString().padEnd(8);
				const untransStr = item.untranslated.toString().padEnd(8);
				const driftStr = item.placeholderDrift.toString().padEnd(8);

				console.log(`${status} ${localeStr} ${coverageStr} ${missingStr} ${extraStr} ${untransStr} ${driftStr}`);
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

if (import.meta.main) {
	main().catch((error) => {
		console.error('❌ Error:', error.message);
		process.exit(1);
	});
}
