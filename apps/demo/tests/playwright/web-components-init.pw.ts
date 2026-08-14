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

	test('wc item player emits one authoritative value after QTI coercion', async ({ page }) => {
		await page.goto('wc-item');
		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 35_000 });

		const item = page.locator('pie-qti-item-player');
		await item.evaluate((element: HTMLElement & { itemXml: string }) => {
			(window as any).__responseChanges = [];
			element.addEventListener('response-change', (event) => {
				(window as any).__responseChanges.push((event as CustomEvent).detail);
			});
			element.itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="integer-response" title="Integer response" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
  <itemBody><p>Enter an integer.</p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="5"/></itemBody>
</assessmentItem>`;
		});

		const input = item.locator('input[aria-label="Text entry RESPONSE"]');
		await expect(input).toBeVisible();
		await input.fill('007');
		await expect
			.poll(() => page.evaluate(() => (window as any).__responseChanges))
			.toEqual([{ responseId: 'RESPONSE', value: 7, responses: { RESPONSE: 7 } }]);
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
