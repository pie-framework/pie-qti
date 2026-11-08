import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { WCAG_AA_TAGS } from './a11y-utils';

/**
 * Resilience end to end, against `fixtures/assessment-resilience`: a failing load
 * recovers through Retry with candidate-safe text only, a slow load stays a status
 * (never a permanent error), and a crashing question renderer is contained by the
 * shell's error boundary while the candidate moves on.
 */

async function open(page: import('@playwright/test').Page, scenario: string) {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(`fixtures/assessment-resilience?scenario=${scenario}`);
}

async function scan(page: import('@playwright/test').Page, include: string) {
	const results = await new AxeBuilder({ page }).include(include).withTags(WCAG_AA_TAGS).analyze();
	expect(results.violations, `${include} violations`).toEqual([]);
}

test('a failed load shows a retryable, candidate-safe error and Retry recovers', async ({ page }) => {
	await open(page, 'retry');

	// The developer message never reaches the candidate; the localized error does.
	const alert = page.locator('.assessment-error');
	await expect(alert).toBeVisible({ timeout: 15000 });
	await expect(alert).toContainText(/something went wrong/i);
	await expect(alert).not.toContainText('Backend unavailable');
	await expect(alert).not.toContainText('connection refused');
	await scan(page, '.assessment-error');

	// Retry re-initializes the session; the backend has recovered.
	await page.getByTestId('assessment-load-retry').click();
	await expect(page.getByRole('radio', { name: 'Alpha', exact: true }).first()).toBeVisible({
		timeout: 30000,
	});
	await expect(page.locator('.assessment-error')).toHaveCount(0);
	await expect(page.getByTestId('assessment-next')).toBeVisible();
});

test('a slow load says "still loading" and proceeds without becoming an error', async ({ page }) => {
	await open(page, 'slow');

	// After ~10s the polite status appears; it is a status, not an alert.
	const still = page.getByTestId('assessment-still-loading');
	await expect(still).toHaveText(/still loading/i, { timeout: 20000 });
	await expect(still).toHaveAttribute('aria-live', 'polite');

	// The load succeeds on its own: no error screen, delivery just starts.
	await expect(page.getByRole('radio', { name: 'Alpha', exact: true }).first()).toBeVisible({
		timeout: 15000,
	});
	await expect(page.locator('.assessment-error')).toHaveCount(0);
	await expect(page.getByTestId('assessment-still-loading')).toHaveCount(0);
});

test('a crashing question is contained: fallback, intact shell, and the candidate moves on', async ({ page }) => {
	await open(page, 'crash');

	// Question 1 renders normally.
	const firstChoice = page.getByRole('radio', { name: 'Alpha', exact: true }).first();
	await expect(firstChoice).toBeVisible({ timeout: 30000 });

	// Question 2's renderer throws: the boundary shows the plain-language fallback.
	await page.getByTestId('assessment-next').click();
	const fallback = page.getByTestId('assessment-content-fallback');
	await expect(fallback).toBeVisible({ timeout: 30000 });
	await expect(fallback).toContainText('This question could not be displayed.');
	await scan(page, '[data-testid="assessment-content-fallback"]');
	// The shell is intact: navigation, header and timer stay usable.
	await expect(page.getByTestId('assessment-next')).toBeVisible();
	await expect(page.locator('.assessment-shell')).toBeVisible();

	// Try again re-renders the question (it fails again, deterministically).
	await page.getByTestId('assessment-content-retry').click();
	await expect(page.getByTestId('assessment-content-fallback')).toBeVisible({ timeout: 15000 });

	// Continue moves on where navigation rules allow: question 3 renders.
	await page.getByTestId('assessment-content-continue').click();
	const thirdChoice = page.getByRole('radio', { name: 'Alpha', exact: true }).first();
	await expect(thirdChoice).toBeVisible({ timeout: 30000 });
	await expect(page.getByTestId('assessment-content-fallback')).toHaveCount(0);
	await expect(page.locator('.progress-question')).toContainText('Question 3 of 3');
});
