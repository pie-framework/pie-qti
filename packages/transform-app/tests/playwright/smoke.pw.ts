import { expect, test } from '@playwright/test';

/**
 * Smoke tests using Playwright's recommended semantic queries.
 * Uses data-testid only for dynamic lists and complex components.
 */

async function createSessionFromSample(request: any, sampleId: string): Promise<string> {
	const res = await request.post(`/api/samples/${sampleId}/load`);
	expect(res.ok()).toBeTruthy();
	const json = await res.json();
	expect(json.success).toBeTruthy();
	expect(typeof json.sessionId).toBe('string');
	return json.sessionId as string;
}

test.describe('transform-app', () => {
	test('home loads and shows samples + upload dropzone', async ({ page }) => {
		await page.goto('/');
		
		// Use semantic query for heading
		await expect(page.getByRole('heading', { name: /QTI Batch Processor/i })).toBeVisible();
		
		// Complex dropzone component - data-testid is appropriate
		await expect(page.getByTestId('upload-dropzone')).toBeVisible();
		
		// Use semantic query for card heading
		await expect(page.getByRole('heading', { name: /Sample QTI Package/i })).toBeVisible();
		
		// Dynamic sample list - data-testid is appropriate (order may vary)
		await expect(page.locator('[data-testid^="sample-load-"]').first()).toBeVisible();
	});

	test('sample -> analyze -> browse items', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);
		
		// Use semantic query for heading
		await expect(page.getByRole('heading', { name: /Session/i })).toBeVisible();

		// Use semantic query for button with accessible name
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		
		// Wait for link to appear (semantic query)
		await expect(page.getByRole('link', { name: /Browse & Preview Items/i })).toBeVisible({ timeout: 120_000 });

		await page.getByRole('link', { name: /Browse & Preview Items/i }).click();
		
		// Use semantic query for page heading
		await expect(page.getByRole('heading', { name: /Item Browser/i })).toBeVisible();

		// Dynamic item list where order matters - data-testid is appropriate
		await expect(page.getByTestId('item-select-0')).toBeVisible({ timeout: 60_000 });

		// Selecting a different item should update the title
		// For dynamic content, data-testid is appropriate
		const initialTitle = await page.getByTestId('selected-item-title').textContent();
		const secondItem = page.getByTestId('item-select-1');
		if (await secondItem.count()) {
			await secondItem.click();
			await expect(page.getByTestId('selected-item-title')).not.toHaveText(initialTitle ?? '');
		}
	});
});


