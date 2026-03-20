import { expect, test } from '@playwright/test';

test.describe('web component initialization', () => {
	test('wc item player registers and renders', async ({ page }) => {
		await page.goto('wc-item');

		await expect(page.getByRole('heading', { name: 'Web Component: Item Player' })).toBeVisible();

		await page.waitForFunction(() => !!customElements.get('pie-qti-item-player'), null, {
			timeout: 15_000,
		});

		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 35_000 });

		await expect(page.locator('pie-qti-item-player')).toBeAttached();
	});

	test('wc assessment player registers and renders', async ({ page }) => {
		await page.goto('wc-assessment');

		await expect(page.getByRole('heading', { name: 'Web Component: Assessment Player' })).toBeVisible();

		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 35_000 });

		await page.waitForFunction(() => !!customElements.get('pie-qti-assessment-player'), null, {
			timeout: 20_000,
		});

		await expect(page.locator('pie-qti-assessment-player')).toBeAttached();
	});
});
