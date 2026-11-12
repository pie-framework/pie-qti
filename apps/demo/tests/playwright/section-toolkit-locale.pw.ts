import { expect, test } from './fixtures';

/**
 * The section's interface locale reaches the pie-players toolkit with a provider
 * over the toolkit's own catalogs: the bundled English, and every other locale
 * through `@pie-players/pie-i18n-generated`, loaded for that locale alone. The
 * tool chrome takes that locale's lang/dir and renders from its catalog.
 */

async function renderSection(page: import('@playwright/test').Page, locale: string) {
	const requests: string[] = [];
	page.on('request', (request) => requests.push(request.url()));
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
	return requests;
}

/**
 * Whether the page fetched a toolkit catalog chunk of the generated tier. These
 * tags are the tier's own (pie-qti's catalogs are `nl` and `th`), so a chunk
 * named after one is that tier's catalog.
 */
function fetchedToolkitCatalog(requests: string[], tag: 'nl-NL' | 'th-TH') {
	return requests.some((url) => new RegExp(`/${tag}-[\\w-]+\\.js(\\?|$)`).test(url));
}

/** The read-aloud button of the first item tool bar, by its accessible name. */
function playButton(page: import('@playwright/test').Page, name: string) {
	return page.locator('pie-item-toolbar').getByRole('button', { name }).first();
}

test.describe('section toolkit locale', () => {
	test('an English interface renders the toolkit from the bundled catalog', async ({ page }) => {
		const requests = await renderSection(page, 'en-US');
		const toolkit = page.locator('pie-assessment-toolkit').first();
		await expect(toolkit).toHaveAttribute('lang', 'en-US');
		await expect(playButton(page, 'Play reading')).toBeVisible();
		// English is resident: an English page fetches no generated catalog.
		expect(fetchedToolkitCatalog(requests, 'nl-NL')).toBe(false);
		expect(fetchedToolkitCatalog(requests, 'th-TH')).toBe(false);
	});

	test('an Arabic interface stamps the toolkit right-to-left and renders its Arabic catalog', async ({ page }) => {
		await renderSection(page, 'ar');
		const toolkit = page.locator('pie-assessment-toolkit').first();
		await expect(toolkit).toHaveAttribute('lang', 'ar');
		await expect(toolkit).toHaveAttribute('dir', 'rtl');
		await expect(playButton(page, 'تشغيل القراءة')).toBeVisible();
	});

	test('a Dutch interface renders the toolkit from its Dutch catalog', async ({ page }) => {
		const requests = await renderSection(page, 'nl-NL');
		const toolkit = page.locator('pie-assessment-toolkit').first();
		await expect(toolkit).toHaveAttribute('lang', 'nl-NL');
		await expect(toolkit).toHaveAttribute('dir', 'ltr');
		await expect(playButton(page, 'Voorlezen starten')).toBeVisible();
		// The Dutch catalog is fetched for the Dutch interface, and no other locale's.
		expect(fetchedToolkitCatalog(requests, 'nl-NL')).toBe(true);
		expect(fetchedToolkitCatalog(requests, 'th-TH')).toBe(false);
		// The section's own labels never leak a raw i18n key: the host provider here
		// answers a lookup it has no default for with the key itself, and the passage
		// toggle takes its name from the heading, which would read
		// "sectionPlayer.passage" as the name.
		const toggle = page.getByRole('button', { name: 'Passage', exact: true }).first();
		await expect(toggle).toBeVisible();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	});

	test('a regional Spanish interface renders the toolkit from the Spanish catalog', async ({ page }) => {
		await renderSection(page, 'es-MX');
		const toolkit = page.locator('pie-assessment-toolkit').first();
		// The toolkit's lang names the catalog its chrome is written in.
		await expect(toolkit).toHaveAttribute('lang', 'es');
		await expect(playButton(page, 'Reproducir la lectura')).toBeVisible();
	});
});
