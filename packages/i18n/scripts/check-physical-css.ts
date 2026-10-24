#!/usr/bin/env bun
/**
 * Physical-direction CSS check: flags left/right properties, values and
 * Tailwind utilities in player source, which do not mirror under `dir="rtl"`.
 * Part of `bun run check:i18n`; exits 1 on any finding.
 *
 * Scans `<style>` blocks, `style` and `class` attributes in `.svelte` files,
 * `.css` files, and CSS declarations (`left: 0;`) inside template literals in
 * `.ts` files. Comments are ignored.
 *
 * Exempt:
 *
 * - graphic and spatial interactions, whose coordinates are physical image
 *   space (`PHYSICAL_PATHS`);
 * - any line carrying, or directly below, an `i18n-physical` comment, for CSS
 *   that is physical by definition (`qti-align-left`, a `top-left` position).
 *
 * Usage:
 *   bun run check-physical-css
 *   bun run check-physical-css --path=../default-components
 */

import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '../../..');

const EXCLUDED_SEGMENTS = ['/node_modules/', '/dist/', '/.svelte-kit/', '/build/', '/test/', '/tests/', '/playwright/'];

/** Graphic and spatial interactions lay out in image coordinates, which do not mirror. */
const PHYSICAL_PATHS = [
	'/plugins/hotspot/',
	'/plugins/graphic-',
	'/plugins/select-point/',
	'/plugins/position-object/',
	'/shared/components/GraphicGapMatch',
];

const MARKER = 'i18n-physical';

const SIDE_PROPERTY = /(?<![\w-])(?:margin|padding|border|scroll-margin|scroll-padding)-(?:left|right)(?:-[a-z]+)?\s*:/;
const CORNER_PROPERTY = /(?<![\w-])border-(?:top|bottom)-(?:left|right)-radius\s*:/;
const OFFSET_PROPERTY = /(?<![\w-])(?:left|right)\s*:\s*[^;:{}]+(?:;|}|["']|$)/;
const SIDE_VALUE = /(?<![\w-])(?:text-align|float|clear)\s*:\s*(?:left|right)\b/;
const TAILWIND_UTILITY =
	/^-?(?:m[lr]|p[lr]|left|right|border-[lr]|rounded-[lr]|rounded-[tb][lr]|scroll-m[lr]|scroll-p[lr])(?:-|$)|^(?:text|float|clear)-(?:left|right)$/;
/** A TypeScript line that is a CSS declaration inside a template literal, not an object member. */
const TS_DECLARATION = /^\s*[a-z-]+\s*:\s*[^;]+;\s*$/;

export interface PhysicalFinding {
	file: string;
	line: number;
	text: string;
}

function isCssDeclarationPhysical(line: string): boolean {
	return SIDE_PROPERTY.test(line) || CORNER_PROPERTY.test(line) || OFFSET_PROPERTY.test(line) || SIDE_VALUE.test(line);
}

function physicalUtilities(line: string): string[] {
	const tokens: string[] = [];
	for (const match of line.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
		tokens.push(...(match[1] ?? match[2] ?? '').split(/\s+/));
	}
	for (const match of line.matchAll(/\bclass:([\w-]+)/g)) tokens.push(match[1]!);
	// Responsive and state variants (`md:ml-2`, `hover:pr-1`) carry the same utility.
	return tokens.filter((token) => TAILWIND_UTILITY.test(token.split(':').pop() ?? ''));
}

/** Replace every character except newlines with a space, keeping line numbers. */
function blank(text: string): string {
	return text.replace(/[^\n]/g, ' ');
}

/** Blank comments, and in Svelte the `<script>` blocks, so only markup and styles remain. */
function stripNonStyle(source: string, kind: 'svelte' | 'css' | 'ts'): string {
	let text = source;
	if (kind === 'svelte') text = text.replace(/<script\b[\s\S]*?<\/script>/g, blank);
	text = text.replace(/\/\*[\s\S]*?\*\//g, blank);
	if (kind === 'svelte') text = text.replace(/<!--[\s\S]*?-->/g, blank);
	return text;
}

/** Line indexes that lie inside a backtick template literal, where TypeScript carries CSS. */
function templateLiteralLines(source: string): Set<number> {
	const inside = new Set<number>();
	let line = 0;
	let open = false;
	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		if (char === '\n') {
			line += 1;
			if (open) inside.add(line);
		} else if (char === '\\') {
			i += 1;
		} else if (char === '`') {
			open = !open;
			if (open) inside.add(line);
		}
	}
	return inside;
}

/** Physical-direction findings in one source file. */
export function scanPhysicalCss(file: string, source: string): PhysicalFinding[] {
	if (PHYSICAL_PATHS.some((path) => file.includes(path))) return [];
	const kind = file.endsWith('.svelte') ? 'svelte' : file.endsWith('.css') ? 'css' : 'ts';
	const original = source.split('\n');
	const lines = stripNonStyle(source, kind).split('\n');
	const templateLines = kind === 'ts' ? templateLiteralLines(source) : undefined;
	const findings: PhysicalFinding[] = [];
	lines.forEach((line, index) => {
		if (original[index]?.includes(MARKER) || original[index - 1]?.includes(MARKER)) return;
		const physical =
			kind === 'ts'
				? templateLines!.has(index) && TS_DECLARATION.test(line) && isCssDeclarationPhysical(line)
				: isCssDeclarationPhysical(line) || (kind === 'svelte' && physicalUtilities(line).length > 0);
		if (physical) findings.push({ file, line: index + 1, text: line.trim() });
	});
	return findings;
}

/** Scan player source under `roots` for physical-direction CSS. */
export function scanPhysicalCssRoots(roots: string[]): { scanned: number; findings: PhysicalFinding[] } {
	const findings: PhysicalFinding[] = [];
	let scanned = 0;
	for (const root of roots) {
		for (const match of new Bun.Glob('*/src/**/*.{svelte,css,ts}').scanSync({ cwd: root, absolute: true })) {
			if (EXCLUDED_SEGMENTS.some((segment) => match.includes(segment)) || match.endsWith('.d.ts')) continue;
			scanned += 1;
			findings.push(...scanPhysicalCss(match, readFileSync(match, 'utf8')));
		}
	}
	return { scanned, findings };
}

function main(): void {
	const pathArg = process.argv.slice(2).find((arg) => arg.startsWith('--path='));
	const roots = pathArg ? [resolve(here, pathArg.slice('--path='.length), '..')] : [join(projectRoot, 'packages')];
	const { scanned, findings } = scanPhysicalCssRoots(roots);
	console.log(`Physical-direction CSS check: scanned ${scanned} files.`);
	for (const finding of findings) {
		console.log(`  ${relative(projectRoot, finding.file)}:${finding.line} ${finding.text}`);
	}
	if (findings.length > 0) {
		console.log(
			`\n${findings.length} finding(s). Use a logical property (margin-inline-start, inset-inline-end, text-align: start), or mark CSS that is physical by definition with an \`${MARKER}\` comment.`,
		);
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}
