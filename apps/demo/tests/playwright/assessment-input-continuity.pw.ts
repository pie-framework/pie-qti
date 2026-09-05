import { expect, test } from './fixtures';

test.describe('assessment input continuity through published elements', () => {
	for (const width of [1280, 375]) {
		test(`preserves typing, caret, and answers at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 812 });
			await page.goto('fixtures/assessment-input');
			const input = page.getByRole('textbox', { name: 'Text entry RESPONSE' });
			await input.pressSequentially('water', { delay: 30 });
			await expect(input).toHaveValue('water');
			await expect(input).toBeFocused();
			await page.keyboard.press('ArrowLeft');
			await page.keyboard.type('X');
			await expect(input).toHaveValue('wateXr');
			await expect(input).toBeFocused();
			await page.getByTestId('assessment-next').click();
			await expect(page.locator('pie-qti-order')).toBeVisible();
			await page.getByTestId('assessment-prev').click();
			await expect(input).toHaveValue('wateXr');
		});
	}

	test('preserves the grabbed item and focus through consecutive keyboard moves', async ({ page }) => {
		await page.goto('fixtures/assessment-input');
		await expect(page.getByRole('textbox')).toBeVisible();
		await page.getByTestId('assessment-next').click();
		const one = page.getByRole('button', { name: /^One\. Position/ });
		await one.focus();
		await page.keyboard.press('Space');
		await expect(one).toHaveAttribute('data-grabbed', 'true');
		await page.keyboard.press('ArrowDown');
		await expect(one).toHaveAttribute('aria-label', /Position 2 of 3/);
		await expect(one).toBeFocused();
		await expect(one).toHaveAttribute('data-grabbed', 'true');
		await page.keyboard.press('ArrowDown');
		await expect(one).toHaveAttribute('aria-label', /Position 3 of 3/);
		await expect(one).toBeFocused();
		await page.keyboard.press('Space');
		await expect(one).toHaveAttribute('data-grabbed', 'false');
	});

	test('replacing assessment session inputs still starts the requested session', async ({ page }) => {
		await page.goto('fixtures/assessment-input');
		const input = page.getByRole('textbox');
		await input.fill('previous candidate');
		await page.locator('pie-qti-assessment-player').evaluate((element) => {
			const player = element as HTMLElement & { initSession: { assessmentId: string; candidateId: string } };
			player.initSession = { assessmentId: 'input-continuity', candidateId: 'next-candidate' };
		});
		await expect(input).toHaveValue('');
		await input.pressSequentially('water', { delay: 30 });
		await expect(input).toHaveValue('water');
	});
});
