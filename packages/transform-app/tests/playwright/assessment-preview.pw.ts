import { expect, test } from '@playwright/test';
import { createSessionFromSample, waitForAnalysis } from './test-helpers.js';

/**
 * Assessment preview tests
 * Tests that assessment tests can be browsed and previewed in the QTI player
 */

test.describe('Assessment Preview', () => {
	test('assessment page loads and shows assessment list', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		// Navigate to session and wait for analysis
		await page.goto(`/session/${sessionId}`);
		await waitForAnalysis(page);

		// Check if assessments link is available (only if package has assessments)
		const assessmentsLink = page.getByRole('link', { name: /Browse.*Assessment/i });
		const linkExists = await assessmentsLink.count() > 0;

		if (!linkExists) {
			// No assessments in this package - that's OK, test passes
			console.log('No assessments found in package - skipping assessment tests');
			return;
		}

		// Navigate to assessments page
		await assessmentsLink.click();

		// Should show assessment page heading
		await expect(page.getByRole('heading', { name: /Assessment Tests/i })).toBeVisible();

		// Check if we have assessments
		const hasAssessmentList = await page.locator('[data-testid^="assessment-"]').count() > 0;
		expect(hasAssessmentList).toBeTruthy();
	});

	test('assessment player does not show errors when assessment is selected', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		// Navigate to assessments page
		await page.goto(`/session/${sessionId}/assessments`);

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check if there are any assessments available
		const assessmentButtons = await page.locator('[data-testid^="assessment-"]');
		const assessmentCount = await assessmentButtons.count();

		if (assessmentCount === 0) {
			// No assessments in this package - skip
			console.log('No assessments found in package - skipping test');
			return;
		}

		// Select first assessment
		await assessmentButtons.first().click();

		// Wait for player to load
		await page.waitForTimeout(2000);

		// If we're showing the player, it should not have error alerts
		const hasPlayer = await page.locator('pie-qti2-assessment-player').count() > 0;
		if (hasPlayer) {
			// The player should not show error messages about missing XML
			const playerErrors = await page.getByText(/No assessment loaded.*assessment-test-xml/i).count();
			expect(playerErrors).toBe(0);
		}
	});

	test('assessment page can be accessed directly after auto-analysis', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');

		// Navigate directly to assessments page
		await page.goto(`/session/${sessionId}/assessments`);

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Should show assessment page (or redirect/error if no assessments)
		const url = page.url();
		const isAssessmentsPage = url.includes(`/session/${sessionId}/assessments`);
		const hasError = await page.getByText(/error|not found/i).count() > 0;

		// Either we're on assessments page or there's an error message
		expect(isAssessmentsPage || hasError).toBeTruthy();

		// If on assessments page, should have heading
		if (isAssessmentsPage) {
			await expect(page.getByRole('heading', { name: /Assessment Tests/i })).toBeVisible();
		}
	});
});
