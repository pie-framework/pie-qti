#!/usr/bin/env bun
/**
 * Hardcoded learner-visible string scan. `--strict` exits 1 on any finding,
 * which is how `bun run check:i18n` gates CI.
 *
 * Parses Svelte templates with the Svelte compiler and reports a string only
 * where it renders by construction:
 *
 * - template text nodes;
 * - `aria-label`, `title` and `placeholder` on DOM elements, when the value is
 *   static text or a single template literal whose static parts carry words
 *   (`aria-label={`Remove ${item}`}`).
 *
 * Out of scope, each a precision trade: `<script>` literals (a literal there is
 * as often a diagnostic), attribute values mixing text with `{expressions}`,
 * component props named `title`, `apps/`, and test directories.
 *
 * `<!-- i18n-ignore -->` before an element or text exempts it and its subtree,
 * for text no learner reads in their language (a code sample, a brand name).
 *
 * A finding names the catalog key when `en.ts` already carries the string.
 * Ported from the pie-players scanner.
 *
 * Usage:
 *   bun run scan-hardcoded
 *   bun run scan-hardcoded --strict
 *   bun run scan-hardcoded --path=../default-components
 */

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '../../..');

const SCANNED_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder']);
const EXCLUDED_SEGMENTS = ['/node_modules/', '/dist/', '/.svelte-kit/', '/build/', '/test/', '/tests/', '/playwright/'];

interface Finding {
	file: string;
	line: number;
	channel: string;
	text: string;
	suggestedKey: string | null;
}

/** Visible letters in any script, not a lone glyph or punctuation. */
function isLearnerVisibleText(data: string): boolean {
	return /\p{L}{2}/u.test(data);
}

function collapse(data: string): string {
	return data.replace(/\s+/g, ' ').trim();
}

/** The English catalog flattened to `key → value`; plural groups report `other`. */
async function loadEnglishTranslations(): Promise<Record<string, string>> {
	const module = await import(resolve(here, '../src/locales/en.ts'));
	const pluralCategories = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
	const translations: Record<string, string> = {};
	const walk = (node: object, prefix: string) => {
		for (const [key, value] of Object.entries(node)) {
			const fullKey = prefix ? `${prefix}.${key}` : key;
			if (value !== null && typeof value === 'object') {
				const keys = Object.keys(value);
				if (keys.length > 0 && keys.every((k) => pluralCategories.has(k))) {
					translations[fullKey] = value.other ?? value.one;
				} else {
					walk(value, fullKey);
				}
			} else if (typeof value === 'string') {
				translations[fullKey] = value;
			}
		}
	};
	walk(module.default, '');
	return translations;
}

function findTranslationKey(translations: Record<string, string>, text: string): string | null {
	const lower = text.toLowerCase();
	let caseInsensitive: string | null = null;
	for (const [key, value] of Object.entries(translations)) {
		if (value === text) return key;
		if (!caseInsensitive && value.toLowerCase() === lower) caseInsensitive = key;
	}
	return caseInsensitive;
}

function lineOf(source: string, offset: number | undefined): number {
	if (typeof offset !== 'number') return 1;
	let line = 1;
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source[i] === '\n') line++;
	}
	return line;
}

/**
 * The reportable text of an attribute value, or null. A template literal reads
 * as its static parts with `{…}` marking each expression, matching the
 * catalog's placeholder syntax.
 */
function attributeText(value: any): string | null {
	if (!Array.isArray(value) || value.length !== 1) {
		const expression = value?.type === 'ExpressionTag' ? value.expression : null;
		return expression ? templateLiteralText(expression) : null;
	}
	const [part] = value;
	if (part?.type === 'Text') return isLearnerVisibleText(part.data ?? '') ? collapse(part.data) : null;
	if (part?.type === 'ExpressionTag') return templateLiteralText(part.expression);
	return null;
}

function templateLiteralText(expression: any): string | null {
	if (expression?.type !== 'TemplateLiteral') return null;
	const quasis: string[] = expression.quasis.map((q: any) => q.value.cooked ?? q.value.raw);
	if (!isLearnerVisibleText(quasis.join(''))) return null;
	return collapse(quasis.join('{…}'));
}

/**
 * Walk a template fragment. Any own property holding a fragment (an object with
 * a `nodes` array) descends, which covers every block's branches without naming
 * them; `attributes` is a plain array and is never walked as content.
 */
function walkTemplate(
	fragment: any,
	source: string,
	file: string,
	translations: Record<string, string>,
	findings: Finding[],
): void {
	let ignoreNext = false;
	for (const node of fragment?.nodes ?? []) {
		if (!node || typeof node !== 'object') continue;

		if (node.type === 'Comment') {
			if (/^\s*i18n-ignore\s*$/.test(node.data ?? '')) ignoreNext = true;
			continue;
		}
		if (node.type === 'Text' && !/\S/.test(node.data ?? '')) continue;
		if (ignoreNext) {
			ignoreNext = false;
			continue;
		}

		if (node.type === 'Text') {
			if (isLearnerVisibleText(node.data ?? '')) {
				const text = collapse(node.data);
				findings.push({
					file,
					line: lineOf(source, node.start),
					channel: 'text',
					text,
					suggestedKey: findTranslationKey(translations, text),
				});
			}
			continue;
		}

		if (node.type === 'RegularElement' && Array.isArray(node.attributes)) {
			for (const attribute of node.attributes) {
				if (attribute?.type !== 'Attribute' || !SCANNED_ATTRIBUTES.has(attribute.name)) continue;
				const text = attributeText(attribute.value);
				if (!text) continue;
				findings.push({
					file,
					line: lineOf(source, attribute.start ?? node.start),
					channel: `${attribute.name}=`,
					text,
					suggestedKey: findTranslationKey(translations, text),
				});
			}
		}

		for (const value of Object.values(node)) {
			if (value !== null && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as any).nodes)) {
				walkTemplate(value, source, file, translations, findings);
			}
		}
	}
}

/** Scan the Svelte templates under `roots`, relative to the repository root. */
export async function scanHardcodedStrings(roots: string[]): Promise<{ scanned: number; findings: Finding[] }> {
	const translations = await loadEnglishTranslations();
	const findings: Finding[] = [];
	let scanned = 0;
	for (const root of roots) {
		for (const match of new Bun.Glob('**/*.svelte').scanSync({ cwd: root, absolute: true })) {
			if (EXCLUDED_SEGMENTS.some((segment) => match.includes(segment))) continue;
			scanned += 1;
			const source = readFileSync(match, 'utf8');
			try {
				const ast = parse(source, { filename: match, modern: true });
				walkTemplate(ast.fragment, source, match, translations, findings);
			} catch (error) {
				console.error(`Could not parse ${relative(projectRoot, match)}: ${String(error)}`);
			}
		}
	}
	return { scanned, findings };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const strict = args.includes('--strict');
	const pathArg = args.find((arg) => arg.startsWith('--path='));
	const roots = pathArg ? [resolve(here, pathArg.slice('--path='.length))] : [join(projectRoot, 'packages')];
	const { scanned, findings } = await scanHardcodedStrings(roots);

	console.log(`Hardcoded learner-visible string scan${strict ? '' : ' (advisory)'}`);
	console.log(`Scanned ${scanned} Svelte templates.\n`);

	const byPackage = new Map<string, Finding[]>();
	for (const finding of findings) {
		const pkg = relative(projectRoot, finding.file).split('/').slice(0, 2).join('/');
		byPackage.set(pkg, [...(byPackage.get(pkg) ?? []), finding]);
	}

	for (const [pkg, list] of [...byPackage.entries()].sort()) {
		console.log(`${pkg}: ${list.length} finding(s)`);
		for (const finding of list) {
			const hint = finding.suggestedKey ? ` → t('${finding.suggestedKey}')` : ' → no catalog key; add one to en.ts if a learner sees it';
			console.log(`  ${relative(projectRoot, finding.file)}:${finding.line} ${finding.channel}"${finding.text}"${hint}`);
		}
		console.log('');
	}

	console.log(`Hardcoded-string scan: ${findings.length} findings in ${byPackage.size} package(s).`);
	if (strict && findings.length > 0) process.exit(1);
}

if (import.meta.main) {
	await main();
}
