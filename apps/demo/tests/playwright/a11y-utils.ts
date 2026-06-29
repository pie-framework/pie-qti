import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

export const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function scanA11yFixture(page: Page) {
	return new AxeBuilder({ page })
		.include('[data-testid="a11y-fixture-root"]')
		.withTags(WCAG_AA_TAGS)
		.analyze();
}

export function logA11yViolations(label: string, violations: unknown[]) {
	if (violations.length > 0) {
		console.log(`A11y violations for ${label}:`, JSON.stringify(violations, null, 2));
	}
}
