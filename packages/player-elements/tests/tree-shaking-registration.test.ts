import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('published default-runtime registration', () => {
	test('survives consumer tree shaking', () => {
		const tempDirectory = mkdtempSync(join(tmpdir(), 'pie-qti-register-bundle-'));
		const outputPath = join(tempDirectory, 'register.js');
		const entryPath = new URL('../dist/register.js', import.meta.url).pathname;

		try {
			const result = Bun.spawnSync(
				['bunx', 'esbuild', entryPath, '--bundle', '--format=esm', `--outfile=${outputPath}`],
				{ stderr: 'pipe', stdout: 'pipe' },
			);
			const stderr = result.stderr.toString();
			expect(result.exitCode, stderr).toBe(0);
			expect(stderr).not.toContain('ignored-bare-import');
			const bundle = readFileSync(outputPath, 'utf8');
			expect(bundle).toContain('pie-qti-choice');
			expect(bundle).toContain('pie-qti-portable-custom');
		} finally {
			rmSync(tempDirectory, { recursive: true, force: true });
		}
	});
});
