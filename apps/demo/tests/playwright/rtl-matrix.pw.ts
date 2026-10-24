import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * RTL gate: the item, section and assessment smoke routes under Arabic and the
 * `ar-XB` pseudo-locale. Chrome takes the interface direction, sequential keys
 * mirror, and pseudo strings (bracketed, so truncation shows) are not clipped.
 */

const LOCALES = ['ar', 'ar-XB'] as const;

const ORDER_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqti_asi_v3p0" identifier="rtl-order" title="Order" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="ordered" base-type="identifier"/>
  <qti-item-body>
    <qti-order-interaction response-identifier="RESPONSE" shuffle="false" orientation="horizontal">
      <qti-prompt>Order</qti-prompt>
      <qti-simple-choice identifier="A">One</qti-simple-choice>
      <qti-simple-choice identifier="B">Two</qti-simple-choice>
      <qti-simple-choice identifier="C">Three</qti-simple-choice>
    </qti-order-interaction>
  </qti-item-body>
</qti-assessment-item>`;

async function stubDesmos(page: Page) {
	await page.route('**/api/tools/desmos/auth', (route) =>
		route.fulfill({ contentType: 'application/json', body: JSON.stringify({ apiKey: null, config: {} }) }),
	);
}

async function openRoute(page: Page, route: string, locale: string) {
	await page.goto(`${route}?locale=${encodeURIComponent(locale)}`);
	// The section route shows no status line; its splitter appears once it renders.
	const ready = route === 'wc-section-splitpane' ? page.getByRole('separator') : page.getByText(/Status:\s*rendered/i);
	await expect(ready).toBeVisible({ timeout: 35_000 });
}

/**
 * Pseudo-locale findings under `root`, shadow roots included: how many visible
 * bracketed strings there are, which open a bracket they never close, and which
 * overflow a box that hides the overflow.
 */
async function pseudoStringReport(page: Page, selector: string) {
	return page.locator(selector).first().evaluate((root) => {
		const bracketed: Element[] = [];
		const visit = (node: Node) => {
			if (node instanceof Element) {
				const own = Array.from(node.childNodes)
					.filter((child) => child.nodeType === Node.TEXT_NODE)
					.map((child) => child.textContent ?? '')
					.join('');
				if (own.includes('[')) bracketed.push(node);
				if (node.shadowRoot) visit(node.shadowRoot);
			}
			for (const child of Array.from(node.childNodes)) visit(child);
		};
		visit(root);

		const visible = bracketed.filter((element) => {
			const rect = element.getBoundingClientRect();
			return rect.width > 1 && rect.height > 1 && getComputedStyle(element).visibility !== 'hidden';
		});
		const unbalanced = visible
			.map((element) => element.textContent ?? '')
			.filter((text) => (text.match(/\[/g) ?? []).length !== (text.match(/\]/g) ?? []).length);
		const clipped = visible
			.filter((element) => {
				const style = getComputedStyle(element);
				const hides = /hidden|clip/.test(style.overflowX) || style.textOverflow === 'ellipsis';
				return hides && element.scrollWidth > element.clientWidth + 1;
			})
			.map((element) => element.textContent?.trim() ?? '');
		return { visible: visible.length, unbalanced, clipped };
	});
}

async function expectPseudoStringsIntact(page: Page, selector: string) {
	const report = await pseudoStringReport(page, selector);
	expect(report.visible, 'pseudo-localised chrome strings').toBeGreaterThan(0);
	expect(report.unbalanced, 'truncated pseudo strings').toEqual([]);
	expect(report.clipped, 'clipped pseudo strings').toEqual([]);
}

for (const locale of LOCALES) {
	test.describe(`RTL matrix: ${locale}`, () => {
		test('item player chrome is right-to-left and horizontal ordering keys mirror', async ({ page }) => {
			await openRoute(page, 'wc-item', locale);
			const chrome = page.locator('pie-qti-item-player .qti-item-player');
			await expect(chrome).toHaveAttribute('lang', locale);
			await expect(chrome).toHaveAttribute('dir', 'rtl');

			await page.locator('pie-qti-item-player').evaluate((element: HTMLElement & { itemXml: string }, xml) => {
				element.itemXml = xml;
			}, ORDER_ITEM);
			const items = page.locator('pie-qti-item-player pie-qti-order [part="item"]');
			await expect(items).toHaveCount(3);
			expect(await items.first().evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');

			// Under RTL the inline end is on the left, so ArrowLeft moves an item later.
			await items.nth(1).focus();
			await page.keyboard.press('Enter');
			await page.keyboard.press('ArrowLeft');
			await expect(items).toHaveText([/One/, /Three/, /Two/]);

			if (locale === 'ar-XB') await expectPseudoStringsIntact(page, 'pie-qti-item-player');
		});

		test('section chrome and toolkit are right-to-left and the splitter keys mirror', async ({ page }) => {
			await stubDesmos(page);
			await openRoute(page, 'wc-section-splitpane', locale);
			const toolkit = page.locator('pie-assessment-toolkit').first();
			await expect(toolkit).toHaveAttribute('lang', locale);
			await expect(toolkit).toHaveAttribute('dir', 'rtl');

			const layout = page.locator('pie-qti-section-player-splitpane .split-layout');
			await expect(layout).toHaveAttribute('dir', 'rtl');
			const splitter = layout.getByRole('separator');
			const before = Number(await splitter.getAttribute('aria-valuenow'));
			await splitter.focus();
			await page.keyboard.press('ArrowLeft');
			await expect(splitter).toHaveAttribute('aria-valuenow', String(before + 2));

			if (locale === 'ar-XB') await expectPseudoStringsIntact(page, 'pie-qti-section-player-splitpane');
		});

		test('assessment shell is right-to-left', async ({ page }) => {
			await openRoute(page, 'wc-assessment', locale);
			const shell = page.locator('pie-qti-assessment-player .assessment-shell');
			await expect(shell).toHaveAttribute('lang', locale);
			await expect(shell).toHaveAttribute('dir', 'rtl');

			if (locale === 'ar-XB') await expectPseudoStringsIntact(page, 'pie-qti-assessment-player');
		});
	});
}
