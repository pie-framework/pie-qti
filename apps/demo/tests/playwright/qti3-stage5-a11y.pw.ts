import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { WCAG_AA_TAGS } from './a11y-utils';

// Clean-room browser evidence for QTI 3 PNP/catalog/shared-stimulus behavior.
// The fixture is repository-authored and intentionally independent of official
// 1EdTech/private conformance packages.
test.describe('QTI 3 Stage 5 PNP/catalog/stimulus browser evidence', () => {
	test('supports keyboard glossary popup behavior without duplicate stimulus content or answer leakage', async ({ page }) => {
		await page.goto('a11y-components/pnp-catalog-stimulus');
		const root = page.locator('[data-testid="a11y-fixture-root"]');
		await expect(root).toBeVisible();

		await expect(root.getByLabel('Shared river passage')).toBeVisible();
		await expect(root.locator('[data-stimulus-idref="passage_1"]')).toHaveCount(1);
		await expect(root.locator('[data-stimulus-idref="passage_1"] .stimulus-term')).toHaveCount(1);
		await expect(root.getByRole('textbox', { name: /text entry response/i })).toBeVisible();
		await expect(root.getByText(/braided delta|qti-correct-response|correctResponse|Item-local fallback definition/i)).toHaveCount(
			0
		);

		const exposure = await root.evaluate((el) => ({
			text: (el as HTMLElement).innerText,
			labels: Array.from(el.querySelectorAll<HTMLElement>('[aria-label], [aria-description], [title]')).map((node) =>
				[node.getAttribute('aria-label'), node.getAttribute('aria-description'), node.getAttribute('title')].join(' ')
			),
		}));
		expect([exposure.text, ...exposure.labels].join(' ')).not.toMatch(
			/braided delta|qti-correct-response|correctResponse/i
		);

		const glossaryTrigger = root.getByRole('button', { name: /show definition: delta/i });
		await expect(glossaryTrigger).toBeVisible();
		await expect(glossaryTrigger).toHaveAttribute('data-catalog-usage', 'glossary-on-screen');
		await glossaryTrigger.focus();
		await expect(glossaryTrigger).toBeFocused();

		await page.keyboard.press('Enter');
		await expect(root.getByRole('dialog', { name: /delta/i })).toContainText('Stimulus-scoped delta definition');

		await page.keyboard.press('Escape');
		await expect(root.getByRole('dialog', { name: /delta/i })).toHaveCount(0);
		await expect(glossaryTrigger).toBeFocused();
	});

	test('dynamically rebinds PNP catalog UI and emits host-routed support events only on user action', async ({ page }) => {
		await page.goto('a11y-components/pnp-catalog-stimulus');
		const root = page.locator('[data-testid="a11y-fixture-root"]');
		await expect(root).toBeVisible();

		await expect(root.getByTestId('catalog-event-status')).toContainText('none');
		const pronunciationTrigger = root.getByRole('button', { name: /request pronunciation: delta/i });
		await expect(pronunciationTrigger).toBeVisible();
		await pronunciationTrigger.click();
		await expect(root.getByTestId('catalog-event-status')).toContainText('tts-pronunciation:DEL-tuh');
		await expect(root.getByTestId('catalog-event-status')).not.toContainText(/braided delta|correctResponse/i);

		await root.getByRole('button', { name: /disable glossary support/i }).click();
		await expect(root.getByRole('button', { name: /show definition: delta/i })).toHaveCount(0);
		await expect(root.getByRole('button', { name: /request pronunciation: delta/i })).toBeVisible();

		await root.getByRole('button', { name: /enable glossary support/i }).click();
		await expect(root.getByRole('button', { name: /show definition: delta/i })).toHaveCount(1);
	});

	test('keeps resolved styles scoped to the item instance and stimulus wrapper', async ({ page }) => {
		await page.goto('a11y-components/pnp-catalog-stimulus');
		const root = page.locator('[data-testid="a11y-fixture-root"]');
		await expect(root).toBeVisible();

		const itemBody = root.locator('[data-qti-item-body-scope]');
		await expect(itemBody).toHaveCount(1);
		const scope = await itemBody.getAttribute('data-qti-item-body-scope');
		expect(scope).toBeTruthy();

		const styleText = await itemBody.locator('style[data-qti-stylesheets="resolved"]').textContent();
		expect(styleText).toContain(`[data-qti-item-body-scope="${scope}"] .item-note`);
		expect(styleText).toContain(`[data-qti-item-body-scope="${scope}"] [data-stimulus-idref="passage_1"] .stimulus-term`);
		expect(styleText).not.toContain('items/item.css');
		expect(styleText).not.toContain('stimuli/stimulus.css');
		expect(styleText).not.toContain('@import');
		expect(styleText).not.toContain('url(');
	});

	test('has no automated WCAG AA violations in the composed Stage 5 fixture', async ({ page }) => {
		await page.goto('a11y-components/pnp-catalog-stimulus');
		await expect(page.locator('[data-testid="a11y-fixture-root"]')).toBeVisible();

		const results = await new AxeBuilder({ page })
			.include('[data-testid="a11y-fixture-root"]')
			.withTags(WCAG_AA_TAGS)
			.analyze();

		expect(results.violations).toEqual([]);
	});
});
