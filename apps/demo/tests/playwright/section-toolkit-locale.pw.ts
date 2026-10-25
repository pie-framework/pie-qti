import { expect, test } from './fixtures';

/**
 * The section's interface locale reaches the pie-players toolkit through its
 * `locale` attribute, so the tool chrome takes that locale's lang/dir and
 * renders from the toolkit's own catalogs.
 */

async function renderSection(page: import('@playwright/test').Page, locale: string) {
	await page.route('**/api/tools/desmos/auth', (route) =>
		route.fulfill({ contentType: 'application/json', body: JSON.stringify({ apiKey: null, config: {} }) }),
	);
	await page.goto('/wc-section-splitpane');
	await expect(page.locator('pie-assessment-toolkit').first()).toBeAttached({ timeout: 35_000 });
	await page.locator('pie-qti-section-player-splitpane').evaluate((element: HTMLElement & { i18n: unknown }, tag) => {
		element.i18n = {
			getLocale: () => tag,
			setLocale: () => {},
			getDirection: () => (tag.startsWith('ar') ? 'rtl' : 'ltr'),
			t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
		};
	}, locale);
}

test.describe('section toolkit locale', () => {
	test('an Arabic interface stamps the toolkit right-to-left', async ({ page }) => {
		await renderSection(page, 'ar');
		const toolkit = page.locator('pie-assessment-toolkit').first();
		await expect(toolkit).toHaveAttribute('lang', 'ar');
		await expect(toolkit).toHaveAttribute('dir', 'rtl');
	});

	test('a Dutch interface renders the toolkit from its Dutch catalog', async ({ page }) => {
		await renderSection(page, 'nl-NL');
		const toolkit = page.locator('pie-assessment-toolkit').first();
		await expect(toolkit).toHaveAttribute('lang', 'nl-NL');
		await expect(toolkit).toHaveAttribute('dir', 'ltr');
		await expect(page.locator('pie-item-toolbar').getByRole('button', { name: 'Voorlezen starten' }).first()).toBeVisible();
	});
});
