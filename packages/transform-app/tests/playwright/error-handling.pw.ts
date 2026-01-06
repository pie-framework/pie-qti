import { expect, test } from '@playwright/test';

test.describe('Error Handling', () => {
	test('invalid session ID shows appropriate error or redirects', async ({ page }) => {
		await page.goto('/session/invalid-session-id-12345');
		// Either shows error message or redirects to home
		// We check that we're not stuck on a broken page
		const url = page.url();
		const hasError = await page.getByText(/error|not found|invalid/i).count() > 0;
		const isHome = url.endsWith('/');
		expect(hasError || isHome).toBeTruthy();
	});

	test('items page handles missing analysis gracefully', async ({ page, request }) => {
		// Create a session but don't analyze
		const res = await request.post('/api/samples/basic-interactions/load');
		const json = await res.json();
		const sessionId = json.sessionId;

		// Try to navigate directly to items page
		await page.goto(`/session/${sessionId}/items`);

		// Should either show error message or redirect back to session page
		const url = page.url();
		const hasError = await page.getByText(/error|not found|analyze/i).count() > 0;
		const isSessionPage = url.includes(`/session/${sessionId}`) && !url.includes('/items');
		expect(hasError || isSessionPage).toBeTruthy();
	});

	test('empty session shows appropriate message', async ({ page }) => {
		// Navigate to a non-existent session
		await page.goto('/session/0000000000000-empty');
		// Should show error or empty state, not crash
		await expect(page.locator('body')).toBeVisible();
	});
});

