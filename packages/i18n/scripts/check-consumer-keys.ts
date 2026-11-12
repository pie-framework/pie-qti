#!/usr/bin/env bun
/**
 * Consumer key existence check.
 *
 * Walks consumer source (`packages/<pkg>/src`, `apps/<app>/src`) and asserts every
 * literal i18n key passed to `t()`, `translate()`, `translatePlural()`,
 * `interfaceText()`, `.plural()` or named in a `labelKey` exists in the catalog
 * that will serve it: the framework English catalog, or — for apps that keep
 * their own strings — the host custom-messages catalogs registered below.
 *
 * This is the guard the hardcoded-string scanner cannot provide. That scanner
 * is precision-built to report only strings that render by construction, so by
 * design it skips `<script>` literals, expression-valued attributes and
 * component props — exactly where round-4 review found five player keys
 * referenced by components yet carried by no catalog, rendering their hardcoded
 * English defaults in all seven other locales (finding L1/L3).
 *
 * Keys are recognized by shape (dot-separated identifier segments) at the call
 * patterns above. Dynamic keys — template literals and variables — and text in
 * comments are not candidates for this check; the compiler-level pair for the
 * first is the `MessageKey` overload on the providers, and a missing key warns
 * at runtime in every environment.
 *
 * Exits 1 on any unknown key.
 *
 * Usage:
 *   bun run scripts/check-consumer-keys.ts
 *   bun run scripts/check-consumer-keys.ts --path=../item-player/src
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '../../..');

const EXCLUDED_SEGMENTS = ['/node_modules/', '/dist/', '/.svelte-kit/', '/build/', '/test/', '/tests/', '/playwright/'];

/**
 * Host custom-messages catalogs whose keys are legitimate at call sites within
 * the app that ships them. The custom-messages parameter is the documented way
 * a host extends the key namespace (`createDefaultI18nProvider(locale,
 * customMessages)`), so an app's own keys are catalog members, not defects.
 */
const HOST_CUSTOM_CATALOGS = [
	// apps/demo keeps its UI strings here since they moved out of the framework catalogs.
	'apps/demo/src/lib/i18n/demo-messages.ts',
] as const;

export interface ConsumerKeyHit {
	key: string;
	kind: string;
	line: number;
}

/** A dot-separated identifier path: the shape of an i18n message key. */
export const KEYISH = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/;

/** One quoted string capture at a recognized call pattern. */
const PATTERNS: Array<{ re: RegExp; kind: string }> = [
	{ re: /\.t\(\s*(['"])((?:[^'"\\]|\\.)+?)\1/g, kind: 't()' },
	{ re: /\btranslate\(\s*[^,()[\]{}]*\s*,\s*(['"])((?:[^'"\\]|\\.)*)\1/g, kind: 'translate()' },
	{ re: /\btranslatePlural\(\s*[^,()[\]{}]*\s*,\s*(['"])((?:[^'"\\]|\\.)*)\1/g, kind: 'translatePlural()' },
	// section-player's interfaceText() wrapper forwards its key to translate(),
	// so its call-site literals must meet the same catalog check.
	{ re: /\binterfaceText\(\s*[^,()[\]{}]*\s*,\s*(['"])((?:[^'"\\]|\\.)*)\1/g, kind: 'interfaceText()' },
	{ re: /\.plural\(\s*(['"])((?:[^'"\\]|\\.)+?)\1/g, kind: 'plural()' },
	{ re: /\blabelKey\s*[:=]\s*(['"])((?:[^'"\\]|\\.)*)\1/g, kind: 'labelKey' },
];

function lineOf(source: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source[i] === '\n') line++;
	}
	return line;
}

function isCommentLine(line: string): boolean {
	const trimmed = line.trim();
	return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('<!--');
}

/**
 * The keyish string literals at i18n call patterns in one source file, with
 * their kind and line. Comment lines are skipped: doc examples teach the call
 * syntax and may cite keys that no longer exist.
 */
export function scanConsumerKeyLiterals(source: string): ConsumerKeyHit[] {
	// Per-offset line lookup: build a line-start index once.
	const lineStarts: number[] = [0];
	for (let i = 0; i < source.length; i++) {
		if (source[i] === '\n') lineStarts.push(i + 1);
	}
	const lineAt = (index: number): number => {
		let low = 0;
		let high = lineStarts.length - 1;
		while (low < high) {
			const mid = (low + high + 1) >> 1;
			if (lineStarts[mid] <= index) low = mid;
			else high = mid - 1;
		}
		return low;
	};

	const hits: ConsumerKeyHit[] = [];
	for (const { re, kind } of PATTERNS) {
		re.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = re.exec(source))) {
			const key = match[2];
			if (!KEYISH.test(key)) continue;
			// Report the line the key literal sits on: a multi-line translate()
			// call may start several lines above it. match[1] is the opening
			// quote of the key literal, the first quote in the match.
			const keyOffset = match.index + match[0].indexOf(match[1]);
			const line = lineAt(keyOffset);
			const lineStart = lineStarts[line];
			const lineEnd = source.indexOf('\n', lineStart);
			const lineText = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
			if (isCommentLine(lineText)) continue;
			hits.push({ key, kind, line: line + 1 });
		}
	}
	return hits;
}

/** The flattened leaf keys of a messages object; plural groups report the group key. */
function collectKeys(node: Record<string, unknown>, prefix: string, into: Set<string>): void {
	const pluralCategories = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
	for (const [key, value] of Object.entries(node)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value !== null && typeof value === 'object') {
			const keys = Object.keys(value as Record<string, unknown>);
			if (keys.length > 0 && keys.every((k) => pluralCategories.has(k))) {
				into.add(fullKey);
			} else {
				collectKeys(value as Record<string, unknown>, fullKey, into);
			}
		} else {
			into.add(fullKey);
		}
	}
}

/** Framework en catalog keys plus every registered host custom catalog's keys. */
async function loadCatalogKeys(): Promise<Set<string>> {
	const keys = new Set<string>();
	const en = (await import(resolve(here, '../src/locales/en.ts'))).default;
	collectKeys(en, '', keys);

	for (const catalogPath of HOST_CUSTOM_CATALOGS) {
		const absolute = resolve(projectRoot, catalogPath);
		// Shape: Record<localeTag, Record<string, unknown>> — union the keys of
		// every locale entry (they mirror each other; en is the fallback source).
		const module = (await import(absolute)) as Record<string, Record<string, Record<string, unknown>>>;
		for (const byLocale of Object.values(module)) {
			for (const messages of Object.values(byLocale)) {
				collectKeys(messages, '', keys);
			}
		}
	}
	return keys;
}

interface ScannedFile {
	file: string;
	hits: ConsumerKeyHit[];
}

async function scanRoots(roots: string[], catalogKeys: Set<string>): Promise<{ scanned: number; violations: ScannedFile[] }> {
	let scanned = 0;
	const violations: ScannedFile[] = [];

	const visit = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			const stats = statSync(path);
			if (stats.isDirectory()) {
				visit(path);
			} else if (/\.(svelte|ts)$/.test(name)) {
				const normalized = path.split('\\').join('/');
				if (EXCLUDED_SEGMENTS.some((segment) => normalized.includes(segment))) continue;
				scanned += 1;
				const source = readFileSync(path, 'utf8');
				const missing = scanConsumerKeyLiterals(source).filter((hit) => !catalogKeys.has(hit.key));
				if (missing.length > 0) violations.push({ file: path, hits: missing });
			}
		}
	};

	for (const root of roots) visit(root);
	return { scanned, violations };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const pathArg = args.find((arg) => arg.startsWith('--path='));

	const roots: string[] = [];
	if (pathArg) {
		const target = resolve(projectRoot, pathArg.slice('--path='.length));
		roots.push(target);
	} else {
		for (const topLevel of ['packages', 'apps']) {
			const topDir = join(projectRoot, topLevel);
			let entries: string[] = [];
			try {
				entries = readdirSync(topDir);
			} catch {
				continue;
			}
			for (const entry of entries) {
				const srcDir = join(topDir, entry, 'src');
				if (statSync(srcDir, { throwIfNoEntry: false })?.isDirectory()) roots.push(srcDir);
			}
		}
	}

	const catalogKeys = await loadCatalogKeys();
	const { scanned, violations } = await scanRoots(roots, catalogKeys);

	console.log('Consumer i18n key existence check');
	console.log(`Scanned ${scanned} files under ${roots.map((r) => relative(projectRoot, r)).join(', ')}.`);
	console.log(`Catalog: framework en + ${HOST_CUSTOM_CATALOGS.length} host custom catalog(s), ${catalogKeys.size} keys.\n`);

	let count = 0;
	for (const { file, hits } of violations.sort((a, b) => a.file.localeCompare(b.file))) {
		console.log(`${relative(projectRoot, file)}: ${hits.length} unknown key(s)`);
		for (const hit of hits) {
			console.log(`  ${hit.line} [${hit.kind}] '${hit.key}' — no catalog carries this key`);
			count += 1;
		}
	}

	if (count > 0) {
		console.log(`\n❌ ${count} unknown i18n key(s) referenced by consumer code.`);
		process.exit(1);
	}
	console.log('✅ Every literal i18n key referenced by consumer code exists in a catalog.');
}

if (import.meta.main) {
	await main();
}
