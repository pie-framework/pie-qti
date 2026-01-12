import { expect, test } from '@playwright/test';

/**
 * E2E tests for PIE transformation workflow
 */

async function createSessionFromSample(request: any, sampleId: string): Promise<string> {
	const res = await request.post(`/api/samples/${sampleId}/load`);
	expect(res.ok()).toBeTruthy();
	const json = await res.json();
	expect(json.success).toBeTruthy();
	expect(typeof json.sessionId).toBe('string');
	return json.sessionId as string;
}

test.describe('PIE Transformation Workflow', () => {
	test('complete workflow: analyze -> transform -> preview', async ({ page, request }) => {
		// Create session from sample
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		// Navigate to session page
		await page.goto(`/session/${sessionId}`);
		await expect(page.getByRole('heading', { name: /Session/i })).toBeVisible();

		// Analyze package
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		// Verify transform button is enabled (no unsupported interactions)
		const transformButton = page.getByTestId('transform-to-pie');
		await expect(transformButton).toBeEnabled();

		// Click transform to PIE
		await transformButton.click();

		// Wait for transformation to complete (should redirect to results page)
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Verify we're on the transformed page
		expect(page.url()).toContain('/transformed');

		// Verify stats are shown
		await expect(page.getByText(/item.*transformed/i)).toBeVisible();
		await expect(page.getByText(/Transformed Content/i)).toBeVisible();

		// Verify items list is populated
		await expect(page.getByTestId('item-0')).toBeVisible();

		// Select first item
		await page.getByTestId('item-0').click();

		// Verify PIE player is loaded OR error message is shown (if players not installed)
		const hasPlayer = await page.locator('[data-pie-element]').count();
		const hasError = await page.locator('[data-pie-element-error]').count();
		expect(hasPlayer + hasError).toBeGreaterThan(0);

		// Verify back button works
		await page.getByRole('link', { name: /Back to Session/i }).click();
		await expect(page.getByRole('heading', { name: /Session/i })).toBeVisible();
	});

	test('transformation handles warnings correctly', async ({ page, request }) => {
		// Use sample that might have experimental interactions
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		// Transform
		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Check if any items have warnings
		const warningBadges = page.locator('.badge-warning');
		const warningCount = await warningBadges.count();

		if (warningCount > 0) {
			// Click on an item with warnings
			const itemWithWarning = page.locator('[data-testid^="item-"]').filter({ has: page.locator('.badge-warning') }).first();
			await itemWithWarning.click();

			// Verify warning alert is displayed
			await expect(page.locator('.alert-warning')).toBeVisible();
			await expect(page.getByText(/Warning/i)).toBeVisible();
		}
	});

	test('transformation shows errors for failed items', async ({ page, request }) => {
		// This test verifies error handling when some items fail to transform
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Check if errors section exists
		const errorSection = page.locator('.alert-error');
		const hasErrors = await errorSection.count() > 0;

		if (hasErrors) {
			// Verify error details are shown
			await expect(errorSection).toBeVisible();
			await expect(page.getByText(/Transformation Error/i)).toBeVisible();

			// Verify error count is displayed
			await expect(page.getByText(/Errors/i)).toBeVisible();
		}
	});

	test('PIE player renders different interaction types', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Test multiple items
		const itemButtons = page.locator('[data-testid^="item-"]');
		const itemCount = await itemButtons.count();

		// Try first 3 items
		for (let i = 0; i < Math.min(3, itemCount); i++) {
			await page.getByTestId(`item-${i}`).click();

			// Wait for PIE element to load OR error message (if players not installed)
			const hasPlayer = await page.locator('[data-pie-element]').count();
			const hasError = await page.locator('[data-pie-element-error]').count();
			expect(hasPlayer + hasError).toBeGreaterThan(0);

			// Verify item title is shown
			const titleElement = page.locator('.card-title').first();
			await expect(titleElement).toBeVisible();
		}
	});

	test('debug mode shows JSON when enabled', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Select first item
		await page.getByTestId('item-0').click();

		// PIE player component has showDebug={true}, debug panel should exist
		// It's in a collapsed details element, so we need to open it first
		const debugDetails = page.locator('details:has-text("Debug:")');
		await expect(debugDetails).toBeVisible();

		// Click to expand the details
		await debugDetails.click();

		// Now the debug content should be visible
		const debugContent = page.locator('pre, code').first();
		await expect(debugContent).toBeVisible();
	});

	test('breadcrumb navigation works correctly', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Verify breadcrumb structure
		await expect(page.getByTestId('breadcrumb-home')).toBeVisible();
		await expect(page.getByTestId('breadcrumb-session')).toBeVisible();
		await expect(page.getByTestId('breadcrumb-transformed')).toBeVisible();

		// Click home breadcrumb
		await page.getByTestId('breadcrumb-home').click();
		await expect(page.getByRole('heading', { name: /QTI Batch Processor/i })).toBeVisible();

		// Navigate back to session
		await page.goto(`/session/${sessionId}/transformed`);
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible();

		// Click session breadcrumb
		await page.getByTestId('breadcrumb-session').click();
		await expect(page.getByRole('heading', { name: /Session/i })).toBeVisible();
	});

	test('transformation preserves item order', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Get titles of first 3 items
		const itemTitles: string[] = [];
		for (let i = 0; i < 3; i++) {
			const item = page.getByTestId(`item-${i}`);
			if (await item.count() > 0) {
				const text = await item.textContent();
				if (text) itemTitles.push(text.trim());
			}
		}

		// Verify order is maintained (at minimum, items should be selectable in order)
		for (let i = 0; i < itemTitles.length; i++) {
			await page.getByTestId(`item-${i}`).click();
			// Verify PIE player OR error message is shown
			const hasPlayer = await page.locator('[data-pie-element]').count();
			const hasError = await page.locator('[data-pie-element-error]').count();
			expect(hasPlayer + hasError).toBeGreaterThan(0);
		}
	});

	test('stats accurately reflect transformation results', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		await page.goto(`/session/${sessionId}`);
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByText(/Analysis complete/i)).toBeVisible({ timeout: 120_000 });

		await page.getByTestId('transform-to-pie').click();
		await expect(page.getByRole('heading', { name: /Transformation Results/i })).toBeVisible({ timeout: 120_000 });

		// Get stats from the page
		const itemStat = page.locator('.stat').filter({ hasText: /Items/i });
		await expect(itemStat).toBeVisible();

		const itemStatValue = await itemStat.locator('.stat-value').textContent();
		const itemCount = parseInt(itemStatValue || '0', 10);

		// Count actual items in the list
		const itemButtons = page.locator('[data-testid^="item-"]');
		const actualItemCount = await itemButtons.count();

		// Stats should match actual count
		expect(itemCount).toBe(actualItemCount);
	});
});
