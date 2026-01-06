import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Player } from '../../src/core/Player.js';
import type { ConformanceCaseFile, ConformanceFixtureManifest } from './types.js';

export interface LoadedFixture {
	fixtureDir: string;
	itemXml: string;
	caseFile: ConformanceCaseFile;
	manifest?: ConformanceFixtureManifest;
}

export async function listFixtureDirs(fixturesRoot: string): Promise<string[]> {
	const entries = await readdir(fixturesRoot, { withFileTypes: true });
	return entries
		.filter((e) => e.isDirectory())
		.map((e) => join(fixturesRoot, e.name))
		.sort();
}

export async function loadFixture(fixtureDir: string): Promise<LoadedFixture> {
	const itemXml = await readFile(join(fixtureDir, 'item.xml'), 'utf8');
	const caseFileRaw = await readFile(join(fixtureDir, 'cases.json'), 'utf8');
	const caseFile = JSON.parse(caseFileRaw) as ConformanceCaseFile;

	let manifest: ConformanceFixtureManifest | undefined;
	try {
		const manifestRaw = await readFile(join(fixtureDir, 'manifest.json'), 'utf8');
		manifest = JSON.parse(manifestRaw) as ConformanceFixtureManifest;
	} catch {
		// optional
	}

	return { fixtureDir, itemXml, caseFile, manifest };
}

export function normalizeOutcomeValue(value: unknown): unknown {
	// Keep it intentionally simple initially; extend as we add more fixtures.
	if (typeof value === 'number') {
		if (Number.isNaN(value)) return 'NaN';
		if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
		return value;
	}
	if (Array.isArray(value)) return value.map(normalizeOutcomeValue);
	if (value && typeof value === 'object') {
		// stable key ordering for deep equality comparisons
		const obj = value as Record<string, unknown>;
		return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, normalizeOutcomeValue(obj[k])]));
	}
	return value;
}

export function normalizeOutcomes(outcomes: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.keys(outcomes)
			.sort()
			.map((k) => [k, normalizeOutcomeValue(outcomes[k])])
	);
}

export function runItemCase(args: {
	itemXml: string;
	responses: Record<string, unknown>;
	role?: 'candidate' | 'proctor' | 'scorer';
	seed?: number;
	useSubmitAttempt?: boolean;
	countAttempt?: boolean;
}) {
	const player = new Player({
		itemXml: args.itemXml,
		role: args.role ?? 'candidate',
		seed: args.seed ?? 42,
	});
	player.setResponses(args.responses as any);

	const itemBodyHtml = player.getItemBodyHtml();

	if (args.useSubmitAttempt) {
		return { result: player.submitAttempt(args.countAttempt ?? true), itemBodyHtml };
	}
	return { result: player.processResponses(), itemBodyHtml };
}


