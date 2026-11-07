import { expect, test, type Page } from './fixtures';

/**
 * The section player applies the candidate's PNP display needs to the whole section
 * surface it renders — passages, rubrics, tool bars and items — and offers the
 * candidate a display settings tool built on the same mechanism. Fixture:
 * `apps/demo/src/lib/a11y/fixtures/SectionPnpDisplayFixture.svelte` (a passage and an
 * item whose companion materials list a ruler and a protractor, PNP `yellowblue`).
 */
const FIXTURE = 'a11y-components/section-pnp-display';

const YELLOW = 'rgb(255, 255, 0)';
const BLUE = 'rgb(0, 51, 153)';

async function openFixture(page: Page) {
	await page.goto(FIXTURE);
	const surface = page.locator('.section-player-vertical');
	await expect(surface).toHaveAttribute('data-qti-pnp-surface', '');
	await expect(page.locator('pie-qti-item-player')).toBeAttached({ timeout: 30_000 });
	return surface;
}

const color = (locator: ReturnType<Page['locator']>, property: 'color' | 'backgroundColor') =>
	locator.evaluate((el, prop) => getComputedStyle(el)[prop], property);

test.describe('section PNP display', () => {
	test('a passage takes the candidate colour scheme; the host page does not', async ({ page }) => {
		const surface = await openFixture(page);
		await expect(surface).toHaveAttribute('data-qti-colorscheme', 'yellowblue');

		const passage = surface.locator('article.passage');
		await expect(passage).toBeVisible();
		expect(await color(passage, 'color')).toBe(YELLOW);
		expect(await color(passage, 'backgroundColor')).toBe(BLUE);
		expect(await color(passage.locator('.passage-content p').first(), 'color')).toBe(YELLOW);

		// The section chrome and the item take the same scheme.
		expect(await color(surface.locator('.item-title'), 'color')).toBe(YELLOW);
		// The item body leaves its display needs to the section surface.
		await expect(surface.locator('.qti-item-body')).not.toHaveAttribute('data-qti-colorscheme', /.*/);

		// Outside the section, the host page keeps its own colours.
		const hostText = page.getByTestId('section-pnp-host-text');
		expect(await color(hostText, 'color')).not.toBe(YELLOW);
		await expect(page.locator('[data-testid="a11y-fixture-root"]')).not.toHaveAttribute('data-qti-colorscheme', /.*/);
	});

	test('the display settings tool changes text size, contrast and spacing for the passage too', async ({ page }) => {
		const surface = await openFixture(page);
		const passageText = surface.locator('article.passage .passage-content p').first();
		const sizeBefore = await passageText.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

		const button = page.getByRole('button', { name: 'Display settings' });
		await expect(button).toBeVisible();
		await button.focus();
		await page.keyboard.press('Enter');

		const dialog = page.getByRole('dialog', { name: 'Display settings' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('heading', { name: 'Display settings' })).toBeFocused();
		// The dialog is on the section surface: the candidate reads it in their own scheme.
		expect(await color(dialog, 'color')).toBe(YELLOW);
		expect(await color(dialog, 'backgroundColor')).toBe(BLUE);

		await dialog.getByRole('radio', { name: 'Largest' }).check();
		await expect
			.poll(() => passageText.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize)))
			.toBeGreaterThan(sizeBefore * 1.5);

		await dialog.getByRole('checkbox', { name: 'Higher-contrast text' }).check();
		await expect(surface).toHaveAttribute('data-qti-colorscheme', 'blackwhite');
		await expect.poll(() => color(surface.locator('article.passage'), 'color')).toBe('rgb(0, 0, 0)');
		await expect.poll(() => color(surface.locator('article.passage'), 'backgroundColor')).toBe('rgb(255, 255, 255)');

		await dialog.getByRole('checkbox', { name: 'Extra text spacing' }).check();
		await expect
			.poll(() => passageText.evaluate((el) => getComputedStyle(el).wordSpacing))
			.not.toBe('0px');

		// The host hears every change, with the profile the section now renders with.
		const event = page.getByTestId('section-display-settings-event');
		await expect(event).toContainText('"textSize":3');
		await expect(event).toContainText('"highContrast":true');
		await expect(event).toContainText('"colorScheme":"blackwhite"');

		// Escape closes the dialog, keeps the settings and returns focus to the trigger.
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(button).toBeFocused();
		await expect(surface).toHaveAttribute('data-qti-colorscheme', 'blackwhite');

		// Turning contrast off restores the profile's own scheme.
		await button.click();
		await dialog.getByRole('checkbox', { name: 'Higher-contrast text' }).uncheck();
		await expect(surface).toHaveAttribute('data-qti-colorscheme', 'yellowblue');
		await dialog.getByRole('button', { name: 'Close' }).click();
		await expect(dialog).toBeHidden();
	});

	test('the settings controls are touch-sized on a phone', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 740 });
		await openFixture(page);
		const button = page.getByRole('button', { name: 'Display settings' });
		const buttonBox = await button.boundingBox();
		expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
		expect(buttonBox?.width ?? 0).toBeGreaterThanOrEqual(44);

		await button.click();
		const dialog = page.getByRole('dialog', { name: 'Display settings' });
		await expect(dialog).toBeVisible();
		for (const option of await dialog.locator('label').all()) {
			const box = await option.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
		}
		const close = await dialog.getByRole('button', { name: 'Close' }).boundingBox();
		expect(close?.height ?? 0).toBeGreaterThanOrEqual(44);
	});

	// The ruler is offered on the item, the protractor at section scope; both arrive off
	// and the item's companion materials turn them on.
	test('the ruler and protractor the item asks for show in its tool bar and open', async ({ page }) => {
		await openFixture(page);
		const toolbar = page.locator('pie-item-toolbar[item-id="q-angles"]');
		const ruler = toolbar.getByRole('button', { name: 'Ruler' });
		const protractor = toolbar.getByRole('button', { name: 'Protractor' });
		await expect(ruler).toBeVisible({ timeout: 30_000 });
		await expect(protractor).toBeVisible();

		await ruler.click();
		await expect(page.locator('pie-tool-ruler')).toBeAttached();
		await protractor.click();
		await expect(page.locator('pie-tool-protractor')).toBeAttached();
	});
});
