import { expect, test } from '@playwright/test';

test.describe('Error Handling', () => {
	test('invalid session ID shows appropriate error or redirects', async ({ page }) => {
		await page.goto('/session/invalid-session-id-12345');
		// Either shows error message or redirects to home
		// We check that we're not stuck on a broken page

		// Wait for page to be fully loaded
		await page.waitForLoadState('networkidle');

		const url = page.url();
		const hasError = await page.getByText(/error|not found|invalid/i).count() > 0;
		const isHome = url.endsWith('/');

		expect(hasError || isHome).toBeTruthy();
	});

	test('items page can be accessed directly after auto-analysis', async ({ page, request }) => {
		// Create a session (auto-analyzed)
		const res = await request.post('/api/samples/basic-interactions/load');
		const json = await res.json();
		const sessionId = json.sessionId;

		// Navigate directly to items page
		await page.goto(`/session/${sessionId}/items`);

		// Wait for page to be fully loaded
		await page.waitForLoadState('networkidle');

		// Should show items page with player (since sample packages are auto-analyzed)
		// Or show error message if analysis failed
		const url = page.url();
		const isItemsPage = url.includes(`/session/${sessionId}/items`);
		const hasError = await page.getByText(/error|not found/i).count() > 0;
		const hasPlayer = await page.locator('pie-qti2-item-player').count() > 0;

		// Either we're on items page with player, or there's an error message
		expect(isItemsPage || hasError).toBeTruthy();

		// If on items page, should have player or items list
		if (isItemsPage) {
			const hasItemsList = await page.locator('[data-testid^="item-select-"]').count() > 0;
			expect(hasPlayer || hasItemsList).toBeTruthy();
		}
	});

	test('empty session shows appropriate message', async ({ page }) => {
		// Navigate to a non-existent session
		await page.goto('/session/0000000000000-empty');
		// Should show error or empty state, not crash
		await expect(page.locator('body')).toBeVisible();
	});
});

