import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { load as loadYaml } from 'js-yaml';

// Web component eval types
type EvalStep =
	| { action: 'navigate'; path: string }
	| { action: 'observe'; target?: { description?: string; hint?: string } }
	| { action: 'click'; target: { description?: string; hint?: string } }
	| { action: 'setLocalStorage'; key: string; value: string };

type EvalExpected = {
	localStorage?: Record<string, { equals?: string; isPresent?: boolean }>;
	assessmentResults?: {
		ui?: {
			currentQuestionTitle?: { isPresent?: boolean };
		};
	};
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
	const evalRoot = path.join(repoRoot, 'docs/evals/qti2-web-components');
	const candidates = listFilesRecursive(evalRoot).filter((p) => p.endsWith('evals.yaml'));
	return candidates.map((filePath) => {
		const raw = fs.readFileSync(filePath, 'utf8');
		const data = loadYaml(raw) as EvalFile;
		return { filePath, data };
	});
}

async function runStep(page: Page, step: EvalStep): Promise<void> {
	switch (step.action) {
		case 'navigate': {
			await page.goto(step.path);
			// For assessment demo, wait for the heading
			const heading = page.getByRole('heading').first();
			await expect(heading).toBeVisible({ timeout: 15000 });
			await page.waitForTimeout(1000);
			break;
		}

		case 'setLocalStorage':
			// Navigate to base URL first if not already there to avoid SecurityError
			if (page.url() === 'about:blank') {
				await page.goto('/');
				await page.waitForLoadState('networkidle');
			}
			await page.evaluate(
				({ key, value }) => {
					localStorage.setItem(key, value);
				},
				{ key: step.key, value: step.value }
			);
			break;

		case 'observe':
			await page.waitForTimeout(500);
			break;

		case 'click': {
			const description = step.target?.description?.toLowerCase() || '';

			// Handle "Next" button clicks
			if (description.includes('next')) {
				await page.getByRole('button', { name: /next/i }).click();
				await page.waitForTimeout(1000);
				break;
			}

			// Generic click
			const clickText = step.target.description || '';
			if (clickText) {
				await page.getByText(clickText, { exact: false }).first().click();
				await page.waitForTimeout(500);
			}
			break;
		}
	}
}

async function assertExpected(page: Page, expected: EvalExpected | undefined) {
	if (!expected) return;

	if (expected.localStorage) {
		for (const [key, matcher] of Object.entries(expected.localStorage)) {
			const actual = await page.evaluate((k) => localStorage.getItem(k), key);

			if (matcher.equals !== undefined) {
				expect(actual).toEqual(matcher.equals);
			}

			if (matcher.isPresent) {
				expect(actual).not.toBeNull();
			}
		}
	}

	if (expected.assessmentResults?.ui?.currentQuestionTitle?.isPresent) {
		// Just verify we navigated - use first() to handle multiple headings
		await expect(page.getByRole('heading').first()).toBeVisible();
	}
}

const evalFiles = readEvalFiles();

test.describe('docs/evals/qti2-web-components (YAML-driven)', () => {
	for (const { filePath, data } of evalFiles) {
		test.describe(path.relative(process.cwd(), filePath), () => {
			for (const c of data.evals) {
				test(c.id, async ({ page }) => {
					for (const step of c.steps) {
						await runStep(page, step);
					}
					await assertExpected(page, c.expected);
				});
			}
		});
	}
});
