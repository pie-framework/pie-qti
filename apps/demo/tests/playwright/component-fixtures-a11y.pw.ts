import { expect, test } from '@playwright/test';

import { A11Y_FIXTURES } from '../../src/lib/a11y/fixtures';
import { logA11yViolations, scanA11yFixture } from './a11y-utils';

test.describe('A11y component fixtures', () => {
	for (const fixture of A11Y_FIXTURES) {
		test(`${fixture.id} should not have WCAG 2.2 Level AA violations`, async ({ page }) => {
			await page.goto(`a11y-components/${fixture.id}`);
			await page.waitForLoadState('networkidle');

			const root = page.locator('[data-testid="a11y-fixture-root"]');
			await expect(root).toBeVisible();

			const results = await scanA11yFixture(page);
			logA11yViolations(fixture.id, results.violations);

			expect(results.violations).toEqual([]);
		});

		test(`${fixture.id} should have focusable content`, async ({ page }) => {
			await page.goto(`a11y-components/${fixture.id}`);
			await page.waitForLoadState('networkidle');

			const root = page.locator('[data-testid="a11y-fixture-root"]');
			await expect(root).toBeVisible();

			const focusable = root
				.locator(
					'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), audio[controls], video[controls], [tabindex]:not([tabindex="-1"]):not([disabled])',
				)
				.first();

			await expect(focusable).toBeAttached();
			await focusable.focus();
			await expect(focusable).toBeFocused();
		});
	}
});


