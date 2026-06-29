import { expect, test } from '@playwright/test';

test.describe('item demo diagnostics panel', () => {
	test('QTI diagnostics are collapsed by default and expandable', async ({ page }) => {
		await page.goto('/item-demo/simple-choice');

		const diagnostics = page.getByRole('button', { name: /QTI diagnostics/i });
		await expect(diagnostics).toBeVisible({ timeout: 40_000 });
		await expect(diagnostics).toHaveAttribute('aria-expanded', 'false');

		await expect(page.getByText('Checks this item against the standard player')).toBeHidden();

		await diagnostics.click();
		await expect(diagnostics).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByText('Checks this item against the standard player')).toBeVisible();
	});
});
