import { expect, test } from '@playwright/test';
import { createSessionFromSample, waitForAnalysis } from './test-helpers.js';

/**
 * Navigation tests using semantic queries where possible.
 */

test.describe('Navigation', () => {
	test('breadcrumbs work correctly', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		// Navigate to session page
		await page.goto(`/session/${sessionId}`);

		// Use semantic query for breadcrumb links
		await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
		// Breadcrumb text (not a link) - data-testid is reasonable for non-interactive text
		await expect(page.getByTestId('session-breadcrumb-session')).toBeVisible();

		// Click home breadcrumb using semantic query
		await page.getByRole('link', { name: 'Home' }).first().click();
		await expect(page).toHaveURL('/');

		// Navigate back to session
		await page.goto(`/session/${sessionId}`);

		// Sample packages are auto-analyzed, wait for analysis to complete
		await waitForAnalysis(page);

		// Navigate to items page
		await page.getByRole('link', { name: /Browse & Preview Items/i }).click();

		// Check items page breadcrumbs - use semantic queries for links
		await expect(page.getByRole('link', { name: 'Home' }).first()).toBeVisible();
		await expect(page.getByRole('link', { name: /Session/i })).toBeVisible();
		// Non-link breadcrumb text - data-testid is reasonable
		await expect(page.getByTestId('items-breadcrumb-items')).toBeVisible();

		// Click session breadcrumb using semantic query
		await page.getByRole('link', { name: /Session/i }).click();
		await expect(page).toHaveURL(`/session/${sessionId}`);
	});

	test('home link in navbar works', async ({ page }) => {
		await page.goto('/session/123-test');
		// Use semantic query for navbar link
		await page.getByRole('link', { name: /QTI Batch Processor/i }).click();
		await expect(page).toHaveURL('/');
	});
});
