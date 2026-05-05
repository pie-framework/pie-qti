import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { WCAG_AA_TAGS } from './a11y-utils';

test.describe('assessment accessibility behavior', () => {
	test('section menu exposes disclosure state and returns focus on Escape', async ({ page }) => {
		await page.goto('a11y-components/assessment-section-menu');

		const toggle = page.getByRole('button', { name: /sections/i });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('menuitemradio', { name: /section 1/i })).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle).toBeFocused();
	});

	test('navigation progress exposes a programmatic name', async ({ page }) => {
		await page.goto('a11y-components/assessment-navigation-bar');

		await expect(page.locator('progress')).toHaveAttribute(
			'aria-label',
			/progress: 20%: question 1 of 5/i
		);
	});

	test('file upload validation errors are announced and linked to the input', async ({ page }) => {
		await page.goto('a11y-components/file-upload');

		const input = page.locator('input[type="file"]');
		await input.setInputFiles({
			name: 'wrong-format.png',
			mimeType: 'image/png',
			buffer: Buffer.from('not a text file'),
		});

		const alert = page.getByRole('alert');
		await expect(alert).toContainText('.txt');
		await expect(input).toHaveAttribute('aria-invalid', 'true');
		await expect(input).toHaveAttribute('aria-describedby', /upload-UPLOAD_1-error/);
	});

	test('associate interaction exposes selected state and named remove controls', async ({ page }) => {
		await page.goto('a11y-components/associate-interaction');

		const fox = page.getByRole('button', { name: /fox/i }).first();
		const forest = page.getByRole('button', { name: /forest/i }).first();

		await fox.click();
		await expect(fox).toHaveAttribute('aria-pressed', 'true');

		await forest.click();
		await expect(page.getByRole('button', { name: /remove association between.*fox.*forest/i })).toBeVisible();
	});

	test('timer warning and expiry are exposed to assistive technology', async ({ page }) => {
		await page.goto('a11y-components/assessment-timer');

		await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /remaining/i);

		await page.getByRole('button', { name: /simulate warning/i }).click();
		await expect(page.getByRole('status').filter({ hasText: /time remaining/i })).toBeAttached();

		await page.getByRole('button', { name: /simulate expiry/i }).click();
		await expect(page.getByRole('alert').filter({ hasText: /time expired/i })).toBeAttached();
	});

	test('composed assessment demo shell has no automated WCAG AA violations', async ({ page }) => {
		await page.goto('/assessment-demo');
		await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 10000 });

		const results = await new AxeBuilder({ page })
			.include('.assessment-shell')
			.withTags(WCAG_AA_TAGS)
			.analyze();

		expect(results.violations).toEqual([]);
	});
});
