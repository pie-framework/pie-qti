import { expect, test } from '@playwright/test';

test.describe('section player web components', () => {
	test('regular demo homepage links to the section player passage demo', async ({ page }) => {
		await page.goto('/');

		const link = page.getByRole('link', { name: /section player/i });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', /\/wc-section-splitpane$/);
	});

	test('split-pane route renders shared passage and nested item player', async ({ page }) => {
		await page.goto('/wc-section-splitpane');

		await expect(page.getByRole('heading', { name: 'Web Component: Section Player Split Pane' })).toBeVisible();
		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 40_000 });

		const host = page.locator('pie-qti-section-player-splitpane');
		await expect(host.getByRole('heading', { name: 'Reading Passage', exact: true })).toBeVisible();
		await expect(host.locator('pie-qti-item-player')).toBeAttached();
	});

	test('vertical route renders nested item player without passage text', async ({ page }) => {
		await page.goto('/wc-section-vertical');

		await expect(page.getByRole('heading', { name: 'Web Component: Section Player Vertical' })).toBeVisible();
		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 40_000 });

		const host = page.locator('pie-qti-section-player-vertical');
		await expect(host.locator('pie-qti-item-player')).toBeAttached();
		await expect(host.getByText('Reading Passage')).toHaveCount(0);
	});

	test('choice selection emits section response delta identifiers', async ({ page }) => {
		await page.goto('/wc-section-splitpane');
		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 40_000 });

		const firstChoiceRadio = page.locator('pie-qti-choice').first().locator('input[type="radio"]').first();
		await firstChoiceRadio.click();

		const delta = page.getByTestId('section-delta');
		await expect(delta).toContainText('"sectionIdentifier":"section-passage"');
		await expect(delta).toContainText('"itemIdentifier":"q-passage-choice"');
		await expect(delta).toContainText('"responseIdentifier":"RESPONSE"');
		await expect(delta).toContainText('"value"');
	});
});
