import { expect, test } from './fixtures';

test.describe('item demo answer and submit', () => {
	test('selecting a choice and submitting scores the item without runtime errors', async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (error) => pageErrors.push(error.message));

		await page.goto('/item-demo/simple-choice');

		const choice = page.locator('pie-qti-choice input[type="radio"]').first();
		await expect(choice).toBeVisible({ timeout: 40_000 });
		await choice.check();
		await expect(choice).toBeChecked();

		await page.getByRole('button', { name: /Submit Answer/i }).click();

		await expect(page.getByText('1.00 / 1.00')).toBeVisible();
		await expect(page.getByRole('button', { name: /Try Again/i })).toBeVisible();

		// A reactive-update loop (e.g. an editor emitting phantom content changes) aborts the
		// Svelte batch and leaves the page unresponsive while still looking rendered.
		expect(pageErrors).toEqual([]);
	});
});
