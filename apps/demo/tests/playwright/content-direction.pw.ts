import { expect, test } from './fixtures';

/**
 * The item player writes two `lang`/`dir` pairs: the interface locale's on its
 * chrome root, and the item's declared language on the item body.
 */

const item = (language: string | undefined, body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqti_asi_v3p0" identifier="direction" title="Direction"${language ? ` xml:lang="${language}"` : ''} adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="string"/>
  <qti-item-body>${body}<qti-text-entry-interaction response-identifier="RESPONSE"/></qti-item-body>
</qti-assessment-item>`;

async function render(page: import('@playwright/test').Page, interfaceLocale: string, itemXml: string) {
	await page.goto('wc-item');
	await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 35_000 });
	await page.locator('pie-qti-item-player').evaluate(
		(element: HTMLElement & { i18n: unknown; itemXml: string }, { locale, xml }) => {
			element.i18n = {
				getLocale: () => locale,
				setLocale: () => {},
				getDirection: () => (locale.startsWith('ar') ? 'rtl' : 'ltr'),
				t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
			};
			element.itemXml = xml;
		},
		{ locale: interfaceLocale, xml: itemXml }
	);
	await expect(page.locator('pie-qti-item-player .qti-item-body input').first()).toBeVisible();
}

test.describe('content and interface direction', () => {
	test('an Arabic item under an English interface is right-to-left in left-to-right chrome', async ({ page }) => {
		await render(page, 'en-US', item('ar', '<p>ما هو <span xml:lang="en">H2O</span>؟</p>'));
		const player = page.locator('pie-qti-item-player .qti-item-player');
		await expect(player).toHaveAttribute('lang', 'en-US');
		await expect(player).toHaveAttribute('dir', 'ltr');
		const body = page.locator('pie-qti-item-player .qti-item-body');
		await expect(body).toHaveAttribute('lang', 'ar');
		await expect(body).toHaveAttribute('dir', 'rtl');
		await expect(body.locator('span[lang="en"]')).toHaveAttribute('dir', 'ltr');
	});

	test('an English item under an Arabic interface is left-to-right in right-to-left chrome', async ({ page }) => {
		await render(page, 'ar-EG', item('en', '<p>What is water?</p>'));
		const player = page.locator('pie-qti-item-player .qti-item-player');
		await expect(player).toHaveAttribute('lang', 'ar-EG');
		await expect(player).toHaveAttribute('dir', 'rtl');
		const body = page.locator('pie-qti-item-player .qti-item-body');
		await expect(body).toHaveAttribute('lang', 'en');
		await expect(body).toHaveAttribute('dir', 'ltr');
	});

	test('an item that declares no language inherits the chrome', async ({ page }) => {
		await render(page, 'ar-EG', item(undefined, '<p>No declared language.</p>'));
		const body = page.locator('pie-qti-item-player .qti-item-body');
		await expect(body).not.toHaveAttribute('lang', /./);
		await expect(body).not.toHaveAttribute('dir', /./);
		expect(await body.evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');
	});
});
