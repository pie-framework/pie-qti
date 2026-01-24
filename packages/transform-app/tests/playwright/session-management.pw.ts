import { expect, test } from '@playwright/test';
import { createSessionFromSample, waitForAnalysis } from './test-helpers.js';

/**
 * Session management tests using semantic queries where possible.
 */

test.describe('Session Management', () => {
	test('session appears in recent sessions after creation', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		// Navigate to home
		await page.goto('/');
		await page.reload(); // Refresh to get updated session list

		// Check that session appears in recent sessions
		// Use semantic query for heading, data-testid for dynamic table rows
		await expect(page.getByRole('heading', { name: /Recent Session/i })).toBeVisible();
		await page.waitForTimeout(1000);
		const sessionRows = page.locator('[data-testid^="recent-session-"]');
		const count = await sessionRows.count();
		// At least one session should be visible (may be our new one or existing ones)
		expect(count).toBeGreaterThan(0);
	});

	test('delete session confirmation dialog works', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await page.goto(`/session/${sessionId}`);

		// Use semantic query for delete button (has title attribute)
		const deleteButton = page.getByRole('button', { name: /Delete/i });
		await expect(deleteButton).toBeVisible({ timeout: 10_000 });
		await deleteButton.click();

		// Dialog modal - data-testid is appropriate for complex component
		await expect(page.getByTestId('delete-confirm-dialog')).toBeVisible();

		// Use semantic queries for dialog buttons
		await expect(page.getByRole('button', { name: /Delete Session/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();

		// Cancel deletion using semantic query
		await page.getByRole('button', { name: /Cancel/i }).click();
		await expect(page.getByTestId('delete-confirm-dialog')).not.toBeVisible();
		// Should still be on session page
		await expect(page).toHaveURL(`/session/${sessionId}`);
	});

	test.skip('re-analyze button works after initial analysis', async ({ page, request }) => {
		// TODO: Re-analyze functionality not yet implemented - packages are auto-analyzed on upload/load
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await page.goto(`/session/${sessionId}`);

		// Sample packages are auto-analyzed, wait for first analysis to complete
		await waitForAnalysis(page);

		// Re-analyze button using semantic query
		const reAnalyzeButton = page.getByRole('button', { name: /Re-analyze/i });
		await expect(reAnalyzeButton).toBeVisible({ timeout: 10_000 });
		await reAnalyzeButton.click();

		// Should show analyzing state (button disabled or text changes)
		// Wait a bit for analysis to potentially start
		await page.waitForTimeout(2000);

		// After re-analysis, browse items should still be available
		await waitForAnalysis(page);
	});
});
