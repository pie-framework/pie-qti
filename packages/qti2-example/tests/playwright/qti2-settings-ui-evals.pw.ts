import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { load as loadYaml } from 'js-yaml';

// Reuse types from i18n runner
type EvalStep =
	| { action: 'navigate'; path: string }
	| { action: 'observe'; target?: { description?: string; hint?: string } }
	| { action: 'click'; target: { description?: string; hint?: string } }
	| { action: 'setLocalStorage'; key: string; value: string }
	| { action: 'pressKey'; key: string; target?: { description?: string; hint?: string } };

type LocalStorageMatcher = {
	equals?: string;
	isPresent?: boolean;
};

type EvalExpected = {
	localStorage?: Record<string, LocalStorageMatcher>;
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
	const evalRoot = path.join(repoRoot, 'docs/evals/qti2-settings-ui');
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
			await expect(page.getByRole('heading', { name: /question/i })).toBeVisible({ timeout: 15000 });
			await page.waitForTimeout(1000);
			break;

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

			// Settings gear icon
			if (description.includes('settings') || description.includes('gear')) {
				const btn = page.getByRole('button', { name: /settings/i });
				await btn.click();
				await page.waitForTimeout(500);
				break;
			}

			// Extract quoted text from description (e.g., "Click 'Español' in language list")
			const match = description.match(/'([^']+)'/);
			if (match) {
				const targetText = match[1];

				// Check if it's a locale
				const localeLabels: Record<string, string> = {
					español: 'Español',
					spanish: 'Español',
					français: 'Français',
					french: 'Français',
					nederlands: 'Nederlands',
					dutch: 'Nederlands',
					română: 'Română',
					romanian: 'Română',
					ไทย: 'ไทย',
					thai: 'ไทย',
					'中文(简体)': '中文(简体)',
					'中文': '中文(简体)',
					chinese: '中文(简体)',
					العربية: 'العربية',
					arabic: 'العربية',
					'english (us)': 'English (US)',
					english: 'English (US)',
				};

				const targetLabel = localeLabels[targetText.toLowerCase()] || targetText;
				const menuItem = page.getByRole('menuitem', { name: targetLabel });
				await menuItem.click();
				await page.waitForTimeout(500);
				break;
			}

			// Click outside menu to close
			if (description.includes('outside') && description.includes('menu')) {
				// Click on the body/backdrop
				await page.locator('body').click({ position: { x: 10, y: 10 } });
				await page.waitForTimeout(300);
				break;
			}

			// Generic click
			const clickText = step.target.description || '';
			if (clickText) {
				await page.getByText(clickText, { exact: false }).first().click();
			}
			break;
		}

		case 'pressKey':
			await page.keyboard.press(step.key);
			await page.waitForTimeout(300);
			break;
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
}

const evalFiles = readEvalFiles();

test.describe('docs/evals/qti2-settings-ui (YAML-driven)', () => {
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
