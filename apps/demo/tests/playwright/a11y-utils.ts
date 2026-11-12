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

/**
 * The key that moves keyboard focus to the next control. Safari on macOS skips buttons,
 * radios and checkboxes on Tab unless "Press Tab to highlight each item" is enabled (the
 * default is off), and Option+Tab is that platform's all-controls key; WebKit on Linux
 * (CI), Chromium and Firefox move through every control on Tab.
 */
export function nextControlKey(browserName: string): string {
	return browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
}

/** The reverse of `nextControlKey`. */
export function previousControlKey(browserName: string): string {
	const next = nextControlKey(browserName);
	return next === 'Tab' ? 'Shift+Tab' : `Shift+${next}`;
}
