import path from 'node:path';
import { expect, type Page, test } from './fixtures';

import { readEvalFiles, type EvalCase, type EvalExpected, type EvalStep } from './eval-helpers';

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

const evalFiles = readEvalFiles('asset-loading');

test.describe('docs/evals/asset-loading (YAML-driven)', () => {
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
