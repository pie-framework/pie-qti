import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

import { WCAG_AA_TAGS } from './a11y-utils';

test.describe('assessment accessibility behavior', () => {
	test('section menu exposes disclosure state and returns focus on Escape', async ({ page }) => {
		await page.goto('a11y-components/assessment-section-menu');

		const toggle = page.getByRole('button', { name: /sections/i });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('menuitemradio', { name: /section 1/i })).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(toggle).toBeFocused();
	});

	test('navigation progress exposes a programmatic name', async ({ page }) => {
		await page.goto('a11y-components/assessment-navigation-bar');

		await expect(page.locator('progress')).toHaveAttribute(
			'aria-label',
			/progress: 20%: question 1 of 5/i
		);
	});

	test('file upload validation errors are announced and linked to the input', async ({ page }) => {
		await page.goto('a11y-components/file-upload');

		const input = page.locator('input[type="file"]');
		await input.setInputFiles({
			name: 'wrong-format.png',
			mimeType: 'image/png',
			buffer: Buffer.from('not a text file'),
		});

		const alert = page.getByRole('alert');
		await expect(alert).toContainText('.txt');
		await expect(input).toHaveAttribute('aria-invalid', 'true');
		await expect(input).toHaveAttribute('aria-describedby', /upload-UPLOAD_1-error/);
	});

	test('associate interaction exposes selected state and named remove controls', async ({ page }) => {
		await page.goto('a11y-components/associate-interaction');

		const fox = page.getByRole('button', { name: /fox/i }).first();
		const forest = page.getByRole('button', { name: /forest/i }).first();

		await fox.click();
		await expect(fox).toHaveAttribute('aria-pressed', 'true');

		await forest.click();
		await expect(
			page.getByRole('button', {
				name: /remove association between.*(?:fox.*forest|forest.*fox)/i,
			})
		).toBeVisible();
	});

	test('timer warning and expiry are exposed to assistive technology', async ({ page }) => {
		await page.goto('a11y-components/assessment-timer');

		await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /remaining/i);

		const warningButton = page.getByRole('button', { name: /simulate warning/i });
		await warningButton.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('status').filter({ hasText: /time remaining/i })).toBeAttached();
		await expect(warningButton).toBeFocused();

		const expiryButton = page.getByRole('button', { name: /simulate expiry/i });
		await expiryButton.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('alert').filter({ hasText: /time expired/i })).toBeAttached();
		await expect(expiryButton).toBeFocused();
	});

	test('timer controls remain reachable in a narrow reflow viewport', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await page.goto('a11y-components/assessment-timer');

		const root = page.locator('[data-testid="a11y-fixture-root"]');
		await expect(root).toBeVisible();
		await expect(page.getByRole('timer')).toBeVisible();

		for (const name of [/simulate tick/i, /simulate warning/i, /simulate expiry/i]) {
			const button = page.getByRole('button', { name });
			await expect(button).toBeVisible();
			await button.focus();
			await expect(button).toBeFocused();
		}
	});

	test('assessment dialog moves focus in, cancels on Escape and returns focus to its trigger', async ({ page }) => {
		await page.goto('a11y-components/assessment-dialog');

		const opener = page.getByRole('button', { name: 'Open submit confirmation' });
		await opener.click();
		const dialog = page.getByRole('dialog', { name: 'Submit your answers?' });
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveAccessibleDescription(/cannot change your answers/i);
		await expect(dialog.getByRole('heading', { name: 'Submit your answers?' })).toBeFocused();
		for (const name of ['Keep working', 'Submit']) {
			const box = await dialog.getByRole('button', { name, exact: true }).boundingBox();
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}

		const results = await new AxeBuilder({ page }).include('dialog').withTags(WCAG_AA_TAGS).analyze();
		expect(results.violations).toEqual([]);

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
		await expect(page.getByTestId('dialog-result')).toHaveText('Last result: cancel');

		await opener.press('Enter');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
		await expect(page.getByTestId('dialog-result')).toHaveText('Last result: confirm');
	});

	test('assessment shell has labelled landmarks and a skip link to the question', async ({ page }) => {
		await page.goto('/assessment-demo');
		await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 10000 });

		// One region named by the assessmentTest title, with labelled content and navigation.
		const shell = page.getByRole('region', { name: 'Reading Comprehension: The Water Cycle' });
		await expect(shell).toBeVisible();
		await expect(shell.getByRole('region', { name: 'Question content' })).toBeVisible();
		await expect(shell.getByRole('navigation', { name: 'Assessment navigation' })).toBeVisible();

		const skip = shell.getByRole('link', { name: 'Skip to question' });
		await skip.focus();
		await expect(skip).toBeInViewport();
		await page.keyboard.press('Enter');
		await expect(shell.getByRole('region', { name: 'Question', exact: true })).toBeFocused();
	});

	test('moving to the next question keeps the focused question clear of the shell bars', async ({ page }) => {
		await page.goto('/assessment-demo');
		const next = page.getByTestId('assessment-next');
		await expect(next).toBeEnabled({ timeout: 10000 });
		await page.getByRole('radio', { name: 'Evaporation', exact: true }).check();
		await next.press('Enter');

		const question = page.getByRole('region', { name: 'Question', exact: true });
		await expect(question).toBeFocused();
		const [questionBox, navBox] = await Promise.all([
			question.boundingBox(),
			page.getByRole('navigation', { name: 'Assessment navigation' }).boundingBox(),
		]);
		// The bars sit outside the scrolling question content instead of on top of it.
		expect(questionBox!.y + questionBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
	});

	test('composed assessment demo shell has no automated WCAG AA violations', async ({ page }) => {
		await page.goto('/assessment-demo');
		await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 10000 });

		const results = await new AxeBuilder({ page })
			.include('.assessment-shell')
			.withTags(WCAG_AA_TAGS)
			.analyze();

		expect(results.violations).toEqual([]);
	});
});
