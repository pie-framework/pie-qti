import { expect, test } from '@playwright/test';

async function setTheme(page: any, theme: string) {
	await page.evaluate((t: string) => {
		document.documentElement.setAttribute('data-theme', t);
	}, theme);
	// Give the browser a tick to apply styles
	await page.waitForTimeout(50);
}

async function getColors(page: any) {
	return page.evaluate(() => {
		const editorContainer = document.querySelector('.tiptap-editor-container') as HTMLElement | null;
		const prose = document.querySelector('.pie-tiptap') as HTMLElement | null;
		const assessmentShell = document.querySelector('.assessment-shell') as HTMLElement | null;

		const bg = editorContainer ? getComputedStyle(editorContainer).backgroundColor : null;
		const fg = prose ? getComputedStyle(prose).color : null;
		const shellBg = assessmentShell ? getComputedStyle(assessmentShell).backgroundColor : null;

		return { bg, fg, shellBg };
	});
}

test.describe('DaisyUI theme cascades into player + TipTap editor', () => {
	test('item-demo: editor colors change when theme changes', async ({ page }) => {
		await page.goto('fixtures/item-player');
		// Wait for the page to be fully loaded
		await page.waitForLoadState('networkidle');

		// Select the extended-text sample
		await page.selectOption('#sample-select', 'extended-text');

		// Wait for network to settle and player to render
		await page.waitForLoadState('networkidle');

		// Ensure editor exists
		await expect(page.getByText('Explain the role of mitochondria in cellular function.')).toBeVisible({
			timeout: 10000,
		});
		await expect(page.locator('.tiptap-editor-container')).toBeVisible({ timeout: 10000 });

		await setTheme(page, 'light');
		const light = await getColors(page);
		expect(light.bg).toBeTruthy();
		expect(light.fg).toBeTruthy();
		expect(light.bg).not.toEqual('rgba(0, 0, 0, 0)');

		await setTheme(page, 'dark');
		const dark = await getColors(page);
		expect(dark.bg).toBeTruthy();
		expect(dark.fg).toBeTruthy();
		expect(dark.bg).not.toEqual('rgba(0, 0, 0, 0)');

		// Colors should differ across themes
		expect(dark.bg).not.toEqual(light.bg);
		expect(dark.fg).not.toEqual(light.fg);
	});

	test('assessment-demo: assessment shell background changes with theme', async ({ page }) => {
		await page.goto('fixtures/assessment-player');
		// Wait for the page to be fully loaded
		await page.waitForLoadState('networkidle');

		// Select the math assessment
		await page.selectOption('#sample-select', 'math-1');

		// Wait for network to settle and assessment to render
		await page.waitForLoadState('networkidle');

		// Ensure shell exists (assessment player mounted). The fixture page does not render a fixed heading,
		// so rely on the shell container rather than a brittle title string.
		await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 10000 });

		await setTheme(page, 'light');
		const light = await getColors(page);
		expect(light.shellBg).toBeTruthy();
		expect(light.shellBg).not.toEqual('rgba(0, 0, 0, 0)');

		await setTheme(page, 'dark');
		const dark = await getColors(page);
		expect(dark.shellBg).toBeTruthy();
		expect(dark.shellBg).not.toEqual('rgba(0, 0, 0, 0)');

		expect(dark.shellBg).not.toEqual(light.shellBg);
	});
});


