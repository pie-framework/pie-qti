#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname;
const routeRoot = join(repoRoot, 'apps/demo/src/routes');

const allowedDirectPlayerRoutes = new Set([
	'apps/demo/src/routes/wc-item/+page.svelte',
	'apps/demo/src/routes/wc-assessment/+page.svelte',
	'apps/demo/src/routes/wc-section-splitpane/+page.svelte',
	'apps/demo/src/routes/wc-section-vertical/+page.svelte',
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
	{
		label: 'direct interaction custom element',
		pattern: /<pie-qti-(?!item-player|assessment-player|section-player-splitpane|section-player-vertical)[a-z0-9-]+(?:\s|>)/,
	},
];

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
	if (allowedDirectPlayerRoutes.has(rel)) {
		continue;
	}

	const source = readFileSync(path, 'utf8');
	for (const { label, pattern } of forbiddenPatterns) {
		if (pattern.test(source)) {
			failures.push(`${rel}: ${label}`);
		}
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
