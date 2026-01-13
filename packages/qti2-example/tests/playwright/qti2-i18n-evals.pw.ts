import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { load as loadYaml } from 'js-yaml';

// i18n eval types
type EvalStep =
	| { action: 'navigate'; path: string }
	| { action: 'observe'; target?: { description?: string; hint?: string } }
	| { action: 'setLocalStorage'; key: string; value: string }
	| { action: 'select'; target: { description?: string; hint?: string }; option: { value: string } }
	| { action: 'click'; target: { description?: string; hint?: string } }
	| { action: 'pressKey'; key: string; target?: { description?: string; hint?: string } };

type LocalStorageMatcher = {
	equals?: string;
	isPresent?: boolean;
};

type EvalExpected = {
	localStorage?: Record<string, LocalStorageMatcher>;
	outcomes?: Record<string, any>;
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
	spiritualChecks?: string[];
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
	const evalRoot = path.join(repoRoot, 'docs/evals/qti2-i18n');
	const candidates = listFilesRecursive(evalRoot).filter((p) => p.endsWith('evals.yaml'));
	return candidates.map((filePath) => {
		const raw = fs.readFileSync(filePath, 'utf8');
		const data = loadYaml(raw) as EvalFile;
		return { filePath, data };
	});
}

async function collectCurrentResponses(page: Page): Promise<Record<string, any>> {
	return page.evaluate(() => {
		const els = Array.from(
			document.querySelectorAll(
				'pie-choice, pie-extended-text, pie-inline-choice, pie-text-entry, pie-hottext, pie-hotspot, pie-select-text, pie-match, pie-order, pie-drawing, pie-graphing, pie-placement-ordering, pie-graphic-gap-match, pie-explicit-constructed-response, pie-categorize, pie-math-inline, pie-matrix, pie-charting, pie-graph-lines, pie-multi-trait-rubric, pie-ruler, pie-number-line, pie-passage, pie-media-interaction, pie-calculator'
			)
		);
		const out: Record<string, any> = {};
		for (const el of els) {
			const interactionRaw = (el as any).interaction ?? el.getAttribute('interaction');
			const responseRaw = (el as any).response ?? el.getAttribute('response');
			if (!interactionRaw) continue;
			let interaction: any;
			try {
				interaction = typeof interactionRaw === 'string' ? JSON.parse(interactionRaw) : interactionRaw;
			} catch {
				continue;
			}
			const responseId = interaction?.responseIdentifier;
			if (!responseId) continue;
			let response: any = null;
			try {
				response = typeof responseRaw === 'string' ? JSON.parse(responseRaw) : responseRaw;
			} catch {
				response = responseRaw;
			}
			out[responseId] = response;
		}
		return out;
	});
}

async function runStep(page: Page, step: EvalStep): Promise<{ submitted?: boolean }> {
	switch (step.action) {
		case 'navigate':
			await page.goto(step.path);
			// Wait for any heading to appear (localized text may vary)
			await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
			await page.waitForTimeout(1000);
			return {};

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
			return {};

		case 'observe':
			// For i18n tests, observe is often checking for text presence
			await page.waitForTimeout(500);
			return {};

		case 'click': {
			const description = step.target?.description?.toLowerCase() || '';

			// Settings gear icon
			if (description.includes('settings') || description.includes('gear')) {
				const btn = page.getByRole('button', { name: /settings/i });
				await btn.click();
				await page.waitForTimeout(500);
				return {};
			}

			// Extract locale name from description like "Select 'Español' from the language list"
			const localeMatch = description.match(/'([^']+)'/);
			if (localeMatch) {
				const localeName = localeMatch[1];
				// Map common names to exact UI labels
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

				const targetLabel = localeLabels[localeName.toLowerCase()] || localeName;
				const localeButton = page.getByRole('menuitem', { name: targetLabel });
				await localeButton.click();
				// Wait for page reload after locale change
				await page.waitForLoadState('networkidle', { timeout: 15000 });
				await page.waitForTimeout(1000);
				return {};
			}

			// Extract theme name from description like "Click 'dark' in theme list"
			const themeMatch = description.match(/'([^']+)'/);
			if (themeMatch && (description.includes('theme') || description.includes('dark') || description.includes('light'))) {
				const themeName = themeMatch[1];
				const themeButton = page.getByRole('menuitem', { name: new RegExp(themeName, 'i') });
				await themeButton.click();
				await page.waitForTimeout(500);
				return {};
			}

			// Generic click - try to find by text (for non-menu items)
			const clickText = step.target.description || '';
			if (clickText) {
				await page.getByText(clickText, { exact: false }).first().click();
			}
			return {};
		}

		case 'pressKey':
			await page.keyboard.press(step.key);
			await page.waitForTimeout(300);
			return {};

		case 'select': {
			// For combobox/dropdown
			const select = page.getByRole('combobox').first();
			await select.selectOption(step.option.value);
			await page.waitForTimeout(1000);
			return {};
		}

		default:
			return {};
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

	if (expected.outcomes) {
		const responses = await collectCurrentResponses(page);
		// Check that outcomes match expected values
		for (const [key, expectedValue] of Object.entries(expected.outcomes)) {
			expect(responses[key]).toEqual(expectedValue);
		}
	}

	if (expected.assessmentResults?.ui?.currentQuestionTitle?.isPresent) {
		// Just verify we navigated to a different question
		await expect(page.getByRole('heading')).toBeVisible();
	}
}

const evalFiles = readEvalFiles();

test.describe('docs/evals/qti2-i18n (YAML-driven)', () => {
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
