#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname;
const routeRoot = join(repoRoot, 'apps/demo/src/routes');

const allowedUncheckedDirectPlayerRoutes = new Set([
	'apps/demo/src/routes/wc-item/+page.svelte',
	'apps/demo/src/routes/wc-assessment/+page.svelte',
]);

const globallyAllowedPlayerTags = new Set(['pie-qti-item-player', 'pie-qti-assessment-player']);
const allowedPlayerTagsByRoute = new Map([
	['apps/demo/src/routes/wc-section-splitpane/+page.svelte', new Set(['pie-qti-section-player-splitpane'])],
	['apps/demo/src/routes/wc-section-vertical/+page.svelte', new Set(['pie-qti-section-player-vertical'])],
]);

const forbiddenPatterns = [
	{
		label: 'manual itemBody HTML extraction',
		pattern: /\bgetItemBodyHtml\s*\(/,
	},
	{
		label: 'regex stripping QTI interactions',
		pattern: /\.replace\s*\(\s*\/<[^/][^>]*(?:Interaction|interaction)/,
	},
	{
		label: 'manual interaction type render branch',
		pattern: /interaction\.type\s*={2,3}/,
	},
];

const playerTagPattern = /<(pie-qti-[a-z0-9-]+)(?:\s|>)/g;

function walk(dir) {
	const entries = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		const stat = statSync(path);
		if (stat.isDirectory()) {
			entries.push(...walk(path));
		} else if (path.endsWith('.svelte')) {
			entries.push(path);
		}
	}
	return entries;
}

const failures = [];

for (const path of walk(routeRoot)) {
	const rel = relative(repoRoot, path);
	if (allowedUncheckedDirectPlayerRoutes.has(rel)) {
		continue;
	}

	const source = readFileSync(path, 'utf8');
	for (const { label, pattern } of forbiddenPatterns) {
		if (pattern.test(source)) {
			failures.push(`${rel}: ${label}`);
		}
	}

	const routeAllowedTags = allowedPlayerTagsByRoute.get(rel) ?? new Set();
	for (const [, tagName] of source.matchAll(playerTagPattern)) {
		if (globallyAllowedPlayerTags.has(tagName) || routeAllowedTags.has(tagName)) {
			continue;
		}
		failures.push(`${rel}: direct interaction custom element`);
	}
}

if (failures.length > 0) {
	console.error('Demo routes must render QTI items through @pie-qti/item-player ItemBody.');
	console.error('Move low-level component checks into component fixtures instead of demo routes.');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log('Demo player contract check passed.');
