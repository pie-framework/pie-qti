import { expect, test } from '@playwright/test';
import { createSessionFromSample, waitForAnalysis } from './test-helpers.js';

/**
 * Smoke tests using Playwright's recommended semantic queries.
 * Uses data-testid only for dynamic lists and complex components.
 */

test.describe('transform-app', () => {
	test('home loads and shows samples + upload area', async ({ page }) => {
		await page.goto('/');

		// Use semantic query for main heading
		await expect(page.getByRole('heading', { name: /QTI Batch Processor/i })).toBeVisible();

		// Check for file input (upload functionality) - more robust than testid
		await expect(page.locator('input[type="file"]')).toBeAttached();

		// Use semantic query for samples section heading
		await expect(page.getByRole('heading', { name: /Sample QTI Package/i })).toBeVisible();

		// Dynamic sample list - data-testid is appropriate (order may vary)
		await expect(page.locator('[data-testid^="sample-load-"]').first()).toBeVisible();
	});

	test('sample -> analyze -> browse items', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);

		// Use semantic query for heading
		await expect(page.getByRole('heading', { name: /Session/i })).toBeVisible();

		// Sample packages are auto-analyzed, so just wait for analysis to complete
		await waitForAnalysis(page);

		// Navigate to items page
		await page.getByRole('link', { name: /Browse & Preview Items/i }).click();

		// Use semantic query for page heading
		await expect(page.getByRole('heading', { name: /Item Browser/i })).toBeVisible();

		// Dynamic item list where order matters - data-testid is appropriate
		await expect(page.getByTestId('item-select-0')).toBeVisible({ timeout: 60_000 });

		// Selecting a different item should update the title
		// For dynamic content, data-testid is appropriate
		const initialTitle = await page.getByTestId('selected-item-title').textContent();
		const secondItem = page.getByTestId('item-select-1');
		const secondItemCount = await secondItem.count();
		if (secondItemCount > 0) {
			await secondItem.click();
			await page.waitForTimeout(500); // Wait for title to update
			await expect(page.getByTestId('selected-item-title')).not.toHaveText(initialTitle ?? '');
		}
	});
});


