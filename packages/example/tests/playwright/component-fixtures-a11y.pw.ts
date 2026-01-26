import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { A11Y_FIXTURES } from '../../src/lib/a11y/fixtures';

test.describe('A11y component fixtures', () => {
	for (const fixture of A11Y_FIXTURES) {
		test(`${fixture.id} should not have WCAG 2.2 Level AA violations`, async ({ page }) => {
			await page.goto(`a11y-components/${fixture.id}`);
			await page.waitForLoadState('networkidle');

			const root = page.locator('[data-testid="a11y-fixture-root"]');
			await expect(root).toBeVisible();

			const results = await new AxeBuilder({ page })
				.include('[data-testid="a11y-fixture-root"]')
				.withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
				.analyze();

			if (results.violations.length > 0) {
				// Helpful local output when iterating on fixtures
				console.log(`A11y violations for ${fixture.id}:`, JSON.stringify(results.violations, null, 2));
			}

			expect(results.violations).toEqual([]);
		});

		test(`${fixture.id} should have focusable content`, async ({ page }) => {
			await page.goto(`a11y-components/${fixture.id}`);
			await page.waitForLoadState('networkidle');

			const root = page.locator('[data-testid="a11y-fixture-root"]');
			await expect(root).toBeVisible();

			const focusable = root
				.locator(
					'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
				)
				.first();

			await expect(focusable).toBeAttached();
			await focusable.focus();
			await expect(focusable).toBeFocused();
		});
	}
});


