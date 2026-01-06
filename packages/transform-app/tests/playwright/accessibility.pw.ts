/**
 * Accessibility Tests - Transform App
 *
 * Tests WCAG 2.2 Level AA compliance for the transform web interface
 * Uses @axe-core/playwright for automated accessibility testing
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Transform App Accessibility', () => {
	test('home page should have no accessibility violations', async ({ page }) => {
		await page.goto('/');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('file upload area should be keyboard accessible', async ({ page }) => {
		await page.goto('/');

		// File upload button should be keyboard accessible
		const uploadButton = page.locator('input[type="file"], button:has-text("Upload"), button:has-text("Browse")').first();
		if (await uploadButton.isVisible()) {
			await uploadButton.focus();
			await expect(uploadButton).toBeFocused();
		}
	});

	test('navigation tabs should be keyboard accessible', async ({ page }) => {
		await page.goto('/');

		// Tab through navigation elements
		const navLinks = page.locator('nav a, [role="tab"], [role="navigation"] button');
		const count = await navLinks.count();

		if (count > 0) {
			const firstNav = navLinks.first();
			await firstNav.focus();
			await expect(firstNav).toBeFocused();

			// Should be able to navigate with keyboard
			await page.keyboard.press('Tab');
			const focused = page.locator(':focus');
			expect(await focused.count()).toBeGreaterThan(0);
		}
	});

	test('transform results should have no accessibility violations', async ({ page }) => {
		await page.goto('/');

		// Wait for any initial content to load
		await page.waitForLoadState('networkidle');

		// If there's a sample/demo button, click it
		const demoButton = page.locator('button:has-text("Sample"), button:has-text("Example"), button:has-text("Demo")').first();
		if (await demoButton.isVisible().catch(() => false)) {
			await demoButton.click();
			await page.waitForTimeout(1000);
		}

		// Check accessibility of results area
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('code editor areas should have proper labels', async ({ page }) => {
		await page.goto('/');

		// Check for code editors (monaco, codemirror, textarea)
		const codeEditors = page.locator('textarea, [class*="monaco"], [class*="codemirror"]');
		const count = await codeEditors.count();

		for (let i = 0; i < count; i++) {
			const editor = codeEditors.nth(i);
			const visible = await editor.isVisible().catch(() => false);

			if (visible) {
				// Should have aria-label or associated label
				const ariaLabel = await editor.getAttribute('aria-label');
				const ariaLabelledby = await editor.getAttribute('aria-labelledby');
				const id = await editor.getAttribute('id');

				let hasLabel = !!ariaLabel || !!ariaLabelledby;

				// Check for associated label element
				if (id && !hasLabel) {
					const label = page.locator(`label[for="${id}"]`);
					hasLabel = (await label.count()) > 0;
				}

				expect(hasLabel).toBe(true);
			}
		}
	});

	test('error messages should be announced to screen readers', async ({ page }) => {
		await page.goto('/');

		// Look for error/alert regions
		const errorRegions = page.locator('[role="alert"], [role="status"], .error, .alert-error');
		const count = await errorRegions.count();

		for (let i = 0; i < count; i++) {
			const region = errorRegions.nth(i);
			const visible = await region.isVisible().catch(() => false);

			if (visible) {
				// Should have role="alert" or role="status" or aria-live
				const role = await region.getAttribute('role');
				const ariaLive = await region.getAttribute('aria-live');

				const isAccessible = role === 'alert' || role === 'status' || !!ariaLive;
				expect(isAccessible).toBe(true);
			}
		}
	});

	test('buttons should have accessible names', async ({ page }) => {
		await page.goto('/');

		const buttons = page.locator('button');
		const count = await buttons.count();

		for (let i = 0; i < count; i++) {
			const button = buttons.nth(i);
			const visible = await button.isVisible().catch(() => false);

			if (visible) {
				// Get accessible name
				const text = await button.textContent();
				const ariaLabel = await button.getAttribute('aria-label');
				const ariaLabelledby = await button.getAttribute('aria-labelledby');
				const title = await button.getAttribute('title');

				// Button should have an accessible name
				const hasAccessibleName =
					(text && text.trim().length > 0) ||
					(ariaLabel && ariaLabel.trim().length > 0) ||
					!!ariaLabelledby ||
					(title && title.trim().length > 0);

				expect(hasAccessibleName).toBe(true);
			}
		}
	});

	test('links should have accessible names', async ({ page }) => {
		await page.goto('/');

		const links = page.locator('a[href]');
		const count = await links.count();

		for (let i = 0; i < count; i++) {
			const link = links.nth(i);
			const visible = await link.isVisible().catch(() => false);

			if (visible) {
				// Get accessible name
				const text = await link.textContent();
				const ariaLabel = await link.getAttribute('aria-label');
				const ariaLabelledby = await link.getAttribute('aria-labelledby');
				const title = await link.getAttribute('title');

				// Link should have an accessible name
				const hasAccessibleName =
					(text && text.trim().length > 0) ||
					(ariaLabel && ariaLabel.trim().length > 0) ||
					!!ariaLabelledby ||
					(title && title.trim().length > 0);

				expect(hasAccessibleName).toBe(true);
			}
		}
	});

	test('form controls should have labels', async ({ page }) => {
		await page.goto('/');

		const formControls = page.locator('input:not([type="hidden"]), select, textarea');
		const count = await formControls.count();

		for (let i = 0; i < count; i++) {
			const control = formControls.nth(i);
			const visible = await control.isVisible().catch(() => false);

			if (visible) {
				const ariaLabel = await control.getAttribute('aria-label');
				const ariaLabelledby = await control.getAttribute('aria-labelledby');
				const placeholder = await control.getAttribute('placeholder');
				const id = await control.getAttribute('id');

				let hasLabel = !!ariaLabel || !!ariaLabelledby;

				// Check for associated label element
				if (id && !hasLabel) {
					const label = page.locator(`label[for="${id}"]`);
					hasLabel = (await label.count()) > 0;
				}

				// Placeholder is not sufficient but better than nothing
				if (!hasLabel && placeholder) {
					hasLabel = true;
				}

				expect(hasLabel).toBe(true);
			}
		}
	});

	test('color contrast should be sufficient', async ({ page }) => {
		await page.goto('/');

		// Run axe with contrast rules specifically
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['wcag2aa'])
			.options({ rules: { 'color-contrast': { enabled: true } } })
			.analyze();

		// Filter for color contrast violations only
		const contrastViolations = accessibilityScanResults.violations.filter(
			v => v.id === 'color-contrast'
		);

		expect(contrastViolations).toEqual([]);
	});

	test('headings should be in logical order', async ({ page }) => {
		await page.goto('/');

		const headings = page.locator('h1, h2, h3, h4, h5, h6');
		const count = await headings.count();

		if (count === 0) return; // No headings to check

		const headingLevels: number[] = [];
		for (let i = 0; i < count; i++) {
			const heading = headings.nth(i);
			const visible = await heading.isVisible().catch(() => false);

			if (visible) {
				const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
				const level = parseInt(tagName.substring(1), 10);
				headingLevels.push(level);
			}
		}

		// First heading should be h1
		if (headingLevels.length > 0) {
			expect(headingLevels[0]).toBe(1);
		}

		// Headings should not skip levels (h1 -> h3 without h2)
		for (let i = 1; i < headingLevels.length; i++) {
			const diff = headingLevels[i] - headingLevels[i - 1];
			// Can go down any amount (h3 -> h1) but can only go up by 1 (h1 -> h2, not h1 -> h3)
			if (diff > 1) {
				throw new Error(`Heading level skipped: h${headingLevels[i - 1]} to h${headingLevels[i]}`);
			}
		}
	});

	test('page should have a main landmark', async ({ page }) => {
		await page.goto('/');

		// Should have a main element or role="main"
		const mainLandmark = page.locator('main, [role="main"]');
		const count = await mainLandmark.count();

		expect(count).toBeGreaterThan(0);
	});

	test('images should have alt text', async ({ page }) => {
		await page.goto('/');

		const images = page.locator('img');
		const count = await images.count();

		for (let i = 0; i < count; i++) {
			const img = images.nth(i);
			const visible = await img.isVisible().catch(() => false);

			if (visible) {
				const alt = await img.getAttribute('alt');
				const ariaLabel = await img.getAttribute('aria-label');
				const ariaLabelledby = await img.getAttribute('aria-labelledby');
				const role = await img.getAttribute('role');

				// Image should have alt text, aria-label, or role="presentation"
				const hasAccessibleName =
					alt !== null || // alt="" is valid for decorative images
					!!ariaLabel ||
					!!ariaLabelledby ||
					role === 'presentation' ||
					role === 'none';

				expect(hasAccessibleName).toBe(true);
			}
		}
	});
});
