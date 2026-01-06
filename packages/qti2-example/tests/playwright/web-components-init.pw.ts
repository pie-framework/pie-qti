import { expect, test } from '@playwright/test';

test.describe('web component initialization', () => {
	test('wc item player registers and renders', async ({ page }) => {
		await page.goto('wc-item');

		await expect(page.getByRole('heading', { name: 'Web Component: Item Player' })).toBeVisible();

		// The page itself reports status; wait for it to hit rendered
		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 15_000 });

		// Verify the custom element is defined
		await page.waitForFunction(() => !!customElements.get('pie-qti2-item-player'), null, {
			timeout: 15_000,
		});

		// Verify rendered content - element exists
		const el = page.locator('pie-qti2-item-player');
		await expect(el).toBeVisible();
		// Status reaching "rendered" is sufficient proof the component mounted and rendered
	});

	test('wc assessment player registers and renders', async ({ page }) => {
		await page.goto('wc-assessment');

		await expect(page.getByRole('heading', { name: 'Web Component: Assessment Player' })).toBeVisible();

		// The page itself reports status; wait for it to hit rendered
		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 20_000 });

		// Verify the custom element is defined
		await page.waitForFunction(() => !!customElements.get('pie-qti2-assessment-player'), null, {
			timeout: 20_000,
		});

		// Verify rendered content - element exists
		const el = page.locator('pie-qti2-assessment-player');
		await expect(el).toBeVisible();
		// Status reaching "rendered" is sufficient proof the component mounted and rendered
	});
});


