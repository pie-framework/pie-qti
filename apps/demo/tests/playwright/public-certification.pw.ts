import { expect, type Page, test } from '@playwright/test';

async function selectAssessmentSample(page: Page, sampleId: string) {
	await page.goto('/assessment-demo');
	await page.waitForFunction(() => typeof (window as any).__testHelpers !== 'undefined', { timeout: 10000 });
	await page.evaluate((id) => (window as any).__testHelpers.selectSample(id), sampleId);
}

async function openSection(page: Page, sectionTitle: string) {
	const sectionsButton = page.locator('button.btn:has(svg path[d*="M4 6h16M4 12h16M4 18h16"])').first();
	await expect(sectionsButton).toBeVisible({ timeout: 10000 });
	await sectionsButton.click();
	const sectionButton = page.locator(`button.section-item:has-text("${sectionTitle}")`).first();
	await expect(sectionButton).toBeVisible({ timeout: 10000 });
	await sectionButton.click();
}

test.describe('public QTI certification browser coverage', () => {
	test('renders section rubric and item-level stimulus in the assessment shell', async ({ page }) => {
		await selectAssessmentSample(page, 'interaction-showcase-1');
		await expect(page.getByRole('heading', { name: 'SHOWCASE-001' })).toBeVisible({ timeout: 10000 });

		await expect(page.getByText('Reading Passage (Standalone Rubric)')).toBeVisible();
		await openSection(page, 'Inline Stimulus');
		await expect(page.getByText('Read the following passage')).toBeVisible({ timeout: 10000 });
	});

	test('renders advanced interaction affordances in the browser', async ({ page }) => {
		await selectAssessmentSample(page, 'interaction-showcase-1');
		await expect(page.getByRole('heading', { name: 'SHOWCASE-001' })).toBeVisible({ timeout: 10000 });

		await openSection(page, 'Hotspot');
		await expect(page.locator('pie-qti-hotspot').first()).toBeVisible({ timeout: 15000 });

		await openSection(page, 'Drag & Drop');
		await expect(page.locator('pie-qti-order').first()).toBeVisible({ timeout: 10000 });

		const next = page.locator('[data-testid="assessment-next"]');
		await next.click();
		await expect(page.locator('pie-qti-match').first()).toBeVisible({ timeout: 10000 });

		await next.click();
		await expect(page.locator('pie-qti-gap-match').first()).toBeVisible({ timeout: 10000 });
	});

	test('renders graphic gap match and MathML samples without official packages', async ({ page }) => {
		await page.goto('/fixtures/item-player');

		await page.locator('#sample-select').selectOption('graphic-gap-match-solar-system');
		await expect(page.getByRole('button', { name: /Mercury/ })).toBeVisible({ timeout: 10000 });
		await expect(page.locator('svg').first()).toBeVisible({ timeout: 10000 });

		await page.locator('#sample-select').selectOption('math-inline');
		await expect(page.locator('.katex').first()).toBeVisible({ timeout: 10000 });
	});
});
