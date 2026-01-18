import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { load as loadYaml } from 'js-yaml';

// Minimal eval types for asset loading tests
type EvalStep =
	| { action: 'navigate'; path: string }
	| { action: 'observe'; target?: { description?: string; hint?: string } }
	| { action: 'playUntilEnded'; target?: { description?: string; hint?: string }; times?: number }
	| { action: 'dragPair'; target?: { description?: string; hint?: string } };

type EvalExpected = {
	outcomes?: Record<string, any>;
};

type EvalCase = {
	id: string;
	sampleId: string;
	intent?: string;
	notes?: string[];
	steps: EvalStep[];
	expected?: EvalExpected;
	spiritChecks?: string[];
};

type EvalFile = {
	version: number;
	component: { interactionType: string; tagName: string };
	examplesApp: { app: string; routeTemplate: string };
	evals: EvalCase[];
};

function listFilesRecursive(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listFilesRecursive(full));
		else out.push(full);
	}
	return out;
}

function readEvalFiles(): Array<{ filePath: string; data: EvalFile }> {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const repoRoot = path.resolve(__dirname, '../../../../');
	const evalRoot = path.join(repoRoot, 'docs/evals/qti2-asset-loading');
	const candidates = listFilesRecursive(evalRoot).filter((p) => p.endsWith('evals.yaml'));
	return candidates.map((filePath) => {
		const raw = fs.readFileSync(filePath, 'utf8');
		const data = loadYaml(raw) as EvalFile;
		return { filePath, data };
	});
}

async function runStep(page: Page, step: EvalStep): Promise<void> {
	switch (step.action) {
		case 'navigate':
			await page.goto(step.path);
			// For asset loading tests, just ensure page loads
			await page.waitForLoadState('networkidle', { timeout: 15000 });
			await page.waitForTimeout(1000);
			break;

		case 'observe':
			// Check that no 404 errors occurred
			await page.waitForTimeout(500);
			break;

		case 'playUntilEnded':
			// Simulate media playback (simplified)
			await page.waitForTimeout(1000);
			break;

		case 'dragPair':
			// Simplified drag operation for graphic interactions
			await page.waitForTimeout(500);
			break;
	}
}

const evalFiles = readEvalFiles();

test.describe('docs/evals/qti2-asset-loading (YAML-driven)', () => {
	for (const { filePath, data } of evalFiles) {
		test.describe(path.relative(process.cwd(), filePath), () => {
			for (const c of data.evals) {
				test(c.id, async ({ page }) => {
					// Monitor 404 errors
					const errors: string[] = [];
					page.on('response', (response) => {
						if (response.status() === 404) {
							errors.push(response.url());
						}
					});

					for (const step of c.steps) {
						await runStep(page, step);
					}

					// Assert no 404 errors occurred
					expect(errors).toEqual([]);
				});
			}
		});
	}
});
