import { test, expect } from '@playwright/test';

test.describe('i18n Verification', () => {
	test('home page should show translated text, not raw keys', async ({ page }) => {
		await page.goto('/');

		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Wait a bit for i18n to initialize
		await page.waitForTimeout(1000);

		// Take a screenshot
		await page.screenshot({ path: '/tmp/transform-app-home.png', fullPage: true });

		// Check that we see translated text, NOT raw translation keys
		const pageContent = await page.textContent('body');

		// These should NOT appear (they are translation keys)
		expect(pageContent).not.toContain('transform.appName');
		expect(pageContent).not.toContain('transform.upload.selectFiles');
		expect(pageContent).not.toContain('transform.upload.dropPrompt');
		expect(pageContent).not.toContain('transform.sessions.title');

		// These SHOULD appear (they are translated text)
		expect(pageContent).toContain('QTI Batch Processor');
		expect(pageContent).toContain('Select Files');

		console.log('✅ Home page i18n test passed');
	});

	test('assessment page should show translated navigation buttons', async ({ page }) => {
		// First, we need to load a sample to get a session
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Look for a sample load button
		const sampleButton = page.locator('[data-testid^="sample-load-"]').first();
		if (await sampleButton.count() > 0) {
			await sampleButton.click();
			await page.waitForURL(/\/session\/.+/);

			// Navigate to assessments
			const assessmentsLink = page.locator('text=Assessment Tests').first();
			if (await assessmentsLink.count() > 0) {
				await assessmentsLink.click();
				await page.waitForLoadState('networkidle');
				await page.waitForTimeout(2000); // Wait for i18n to load

				// Take a screenshot
				await page.screenshot({ path: '/tmp/transform-app-assessments.png', fullPage: true });

				const pageContent = await page.textContent('body');

				// These should NOT appear (they are translation keys)
				expect(pageContent).not.toContain('common.next');
				expect(pageContent).not.toContain('common.previous');
				expect(pageContent).not.toContain('transform.assessments.title');

				console.log('✅ Assessment page i18n test passed');
			} else {
				console.log('⚠️ No assessments link found, skipping assessment test');
			}
		} else {
			console.log('⚠️ No sample data found, skipping assessment test');
		}
	});
});
