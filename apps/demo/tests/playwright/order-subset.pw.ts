import { expect, test } from './fixtures';

/**
 * Subset ordering, end to end (QTI 2.2 ASI §5.73, §2.4.1.2): an orderInteraction with
 * minChoices="2" maxChoices="2" over five choices asks the candidate to choose two items and
 * order them. Driven by keyboard only: add from "Not in your order", reorder in "Your order"
 * with the SortableList grab/move/drop keys, a third add refused and announced, then submit.
 * The item scores 1 only for the exact ordered subset MERCURY, VENUS — a full five-item
 * permutation (the old behaviour) could never match it.
 */
test.describe('order interaction: rank your top 2 of 5', () => {
	test('orders two of five by keyboard, refuses a third, and scores the ordered subset', async ({ page }) => {
		await page.goto('/item-demo/order-subset-top-two');

		const order = page.locator('pie-qti-order');
		const addVenus = order.getByRole('button', { name: 'Add Venus to your order' });
		await expect(addVenus).toBeVisible({ timeout: 40_000 });

		// The limits are stated up front, and nothing is ordered yet, so nothing can be submitted.
		await expect(order.getByText('Choose 2 items and put them in order.')).toBeVisible();
		await expect(order.getByText('Nothing is in your order yet.')).toBeVisible();
		const submit = page.getByRole('button', { name: /Submit Answer/i });
		await expect(submit).toBeDisabled();

		// Add Venus with Enter: focus follows it into "Your order", onto its remove control.
		await addVenus.focus();
		await page.keyboard.press('Enter');
		await expect(order.getByRole('button', { name: 'Remove Venus from your order' })).toBeFocused();
		await expect(order.locator('[data-subset-live]')).toContainText(
			'Venus added to your order at position 1 of 1.',
		);

		// Tab leaves the order row for the pool, which now starts with Earth.
		await page.keyboard.press('Tab');
		await expect(order.getByRole('button', { name: 'Add Earth to your order' })).toBeFocused();

		// Add Mercury with Enter: it lands second.
		await order.getByRole('button', { name: 'Add Mercury to your order' }).focus();
		await page.keyboard.press('Enter');
		const ordered = order.locator('[part="ordered-zone"] button[part="item"]');
		await expect(ordered).toHaveText([/Venus/, /Mercury/]);

		// Reorder with the keyboard pattern: Space grabs, ArrowUp moves earlier, Space drops.
		await order.getByRole('button', { name: 'Mercury', exact: true }).focus();
		await page.keyboard.press('Space');
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('Space');
		await expect(ordered).toHaveText([/Mercury/, /Venus/]);

		// A third add is refused at the cap and the refusal says why; the order is unchanged.
		const addEarth = order.getByRole('button', { name: 'Add Earth to your order' });
		await expect(addEarth).toHaveAttribute('aria-disabled', 'true');
		await addEarth.focus();
		await page.keyboard.press('Enter');
		await expect(order.locator('[data-subset-live]')).toContainText(
			'Your order can hold up to 2 items. Remove one to add another.',
		);
		await expect(ordered).toHaveCount(2);

		// The ordered subset is complete: submit by keyboard and the exact subset scores in full.
		await expect(submit).toBeEnabled();
		await submit.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByText('1.00 / 1.00')).toBeVisible();
	});
});
