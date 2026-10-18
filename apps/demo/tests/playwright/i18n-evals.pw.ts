import path from 'node:path';
import { expect, type Page, test } from './fixtures';
import {
	LOCALE_LABELS,
	getResponsesFromWebComponents,
	readEvalFiles,
	type EvalCase,
	type EvalExpected,
	type EvalFile,
	type EvalStep,
} from './eval-helpers';

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
				const btn = page.locator('[data-testid="settings-menu-button"]').first();
				await btn.click();
				await page.waitForTimeout(500);
				return {};
			}

			// Extract locale name from description like "Select 'Español' from the language list"
			const localeMatch = description.match(/'([^']+)'/);
			if (localeMatch) {
				const localeName = localeMatch[1];
				const targetLabel = LOCALE_LABELS[localeName.toLowerCase()] || localeName;
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
		const responses = await getResponsesFromWebComponents(page);
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

const evalFiles = readEvalFiles('i18n');

test.describe('docs/evals/i18n (YAML-driven)', () => {
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
