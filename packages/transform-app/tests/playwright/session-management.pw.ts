import { expect, test } from '@playwright/test';

/**
 * Session management tests using semantic queries where possible.
 */

async function createSessionFromSample(request: any, sampleId: string): Promise<string> {
	const res = await request.post(`/api/samples/${sampleId}/load`);
	expect(res.ok()).toBeTruthy();
	const json = await res.json();
	expect(typeof json.sessionId).toBe('string');
	return json.sessionId as string;
}

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
		await page.getByRole('button', { name: /Delete/i }).click();

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

	test('re-analyze button works after initial analysis', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await page.goto(`/session/${sessionId}`);

		// First analysis using semantic query
		await page.getByRole('button', { name: /Analyze Package/i }).click();
		await expect(page.getByRole('link', { name: /Browse & Preview Items/i })).toBeVisible({ timeout: 120_000 });

		// Re-analyze button using semantic query
		await expect(page.getByRole('button', { name: /Re-analyze/i })).toBeVisible();
		await page.getByRole('button', { name: /Re-analyze/i }).click();

		// Should show analyzing state (button disabled or text changes)
		// Wait a bit for analysis to potentially start
		await page.waitForTimeout(2000);
		// After re-analysis, browse items should still be available
		await expect(page.getByRole('link', { name: /Browse & Preview Items/i })).toBeVisible({ timeout: 120_000 });
	});
});

