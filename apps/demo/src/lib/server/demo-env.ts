import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

let cachedEnv: Record<string, string> | null = null;

function parseEnvFile(contents: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const line of contents.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
		if (!match) continue;
		const [, key, rawValue] = match;
		let value = rawValue.trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		values[key] = value;
	}
	return values;
}

function findWorkspaceEnv(startDirectory: string): string | null {
	let current = startDirectory;
	for (let depth = 0; depth < 6; depth += 1) {
		const candidate = join(current, '.env');
		if (existsSync(candidate)) return candidate;
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
}

function workspaceEnv(): Record<string, string> {
	if (cachedEnv) return cachedEnv;
	const envFile = findWorkspaceEnv(process.cwd());
	cachedEnv = envFile ? parseEnvFile(readFileSync(envFile, 'utf8')) : {};
	return cachedEnv;
}

export function demoEnv(name: string): string | undefined {
	return process.env[name] ?? workspaceEnv()[name];
}
