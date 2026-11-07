import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { WCAG_AA_TAGS } from './a11y-utils';

/**
 * Submit safety (WCAG 3.3.4), the candidate review screen + item palette, and the
 * per-item flag-for-review toggle, against the `fixtures/assessment-review` fixture.
 * `?layout=linear-parts` delivers a linear test part (for the cannot-return warning).
 */

async function openShell(page: import('@playwright/test').Page, query = '') {
	await page.goto(`fixtures/assessment-review${query}`);
	const shell = page.locator('.assessment-shell');
	await expect(shell).toBeVisible({ timeout: 15000 });
	await expect(page.getByTestId('assessment-prev')).toBeVisible({ timeout: 15000 });
	return shell;
}

async function scan(page: import('@playwright/test').Page, include: string) {
	const results = await new AxeBuilder({ page }).include(include).withTags(WCAG_AA_TAGS).analyze();
	expect(results.violations, `${include} violations`).toEqual([]);
}

test('submit with unanswered questions: the dialog names them, cancel jumps back, then confirm', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openShell(page);
	const submit = page.getByTestId('assessment-submit');
	const next = page.getByTestId('assessment-next');

	// The answered count is visible and named from the start.
	await expect(page.getByTestId('assessment-answered-count')).toHaveText('0 of 3 answered');
	await page.getByRole('radio', { name: 'Alpha', exact: true }).check();
	await expect(page.getByTestId('assessment-answered-count')).toHaveText('1 of 3 answered');
	await next.click();
	await expect(page.locator('.progress-question')).toHaveText('Question 2 of 3');
	await page.getByRole('radio', { name: 'Beta', exact: true }).check();
	await next.click();
	await expect(page.locator('.progress-question')).toHaveText('Question 3 of 3');

	// Submit opens a confirmation, not an immediate finalization.
	await submit.click();
	const dialog = page.getByRole('dialog', { name: 'Submit your test?' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveAccessibleDescription('You cannot change your answers after you submit.');
	await expect(dialog.getByTestId('submit-dialog-summary')).toContainText('2 of 3 answered');
	await expect(dialog).toContainText('1 question is not answered');
	const jump = dialog.getByTestId('submit-dialog-jump-3');
	await expect(jump).toContainText('Go to question 3');
	await scan(page, 'dialog[open]');

	// Escape cancels; nothing was submitted and focus returns to the Submit control.
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(submit).toBeFocused();
	await expect(page.getByRole('status').filter({ hasText: 'Assessment completed' })).toHaveCount(0);

	// The dialog links back to the unanswered question when navigation allows it.
	await submit.click();
	await expect(dialog).toBeVisible();
	await jump.click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('.progress-question')).toHaveText('Question 3 of 3');

	// Answer the composite item fully, then confirm for real.
	await page.getByRole('radio', { name: 'First A', exact: true }).check();
	await page.getByRole('radio', { name: 'Second C', exact: true }).check();
	await expect(page.getByTestId('assessment-answered-count')).toHaveText('3 of 3 answered');
	await submit.click();
	await expect(dialog).toBeVisible();
	await expect(dialog.getByTestId('submit-dialog-summary')).toContainText('3 of 3 answered');
	await expect(dialog).toContainText('You have answered all the questions.');
	await expect(dialog).not.toContainText('not answered');
	await dialog.getByRole('button', { name: 'Submit test' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Assessment completed' })).toBeVisible();
	await expect(dialog).toBeHidden();
	await expect(submit).toBeDisabled();
});

test('keeping work: the safe action closes the dialog without submitting', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openShell(page);
	const next = page.getByTestId('assessment-next');
	await next.click();
	await next.click();
	await expect(page.locator('.progress-question')).toHaveText('Question 3 of 3');
	const submit = page.getByTestId('assessment-submit');
	await submit.click();
	const dialog = page.getByRole('dialog', { name: 'Submit your test?' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Keep working' }).click();
	await expect(dialog).toBeHidden();
	await expect(submit).toBeFocused();
	await expect(page.getByRole('status').filter({ hasText: 'Assessment completed' })).toHaveCount(0);
	// Still on the last item, still able to submit later.
	await expect(submit).toBeEnabled();
});

test('flag for review shows in the palette, survives jumps, per item (375px)', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await openShell(page);
	const flag = page.getByTestId('assessment-flag');

	// A visible label with the pressed state — never an icon-only toggle.
	await expect(flag).toContainText('Flag for review');
	await expect(flag).toHaveAttribute('aria-pressed', 'false');
	await flag.click();
	await expect(flag).toHaveAttribute('aria-pressed', 'true');

	// The review palette lists all delivered items with text + icon statuses.
	const review = page.getByTestId('assessment-review');
	await review.click();
	const screen = page.locator('.review-screen');
	await expect(screen).toBeVisible();
	await expect(screen).toContainText('Review your answers');
	await expect(screen).toContainText('Alphabet');
	await expect(screen).toContainText('Flagged');
	await expect(screen.locator('[aria-current="true"]')).toContainText('Go to question 1');
	for (const status of await screen.locator('.review-status').all()) {
		await expect(status.locator('svg')).toBeVisible();
	}
	await scan(page, '.review-screen');

	// Jumping from the palette navigates and closes it; the flag stays on its item.
	await screen.getByRole('button', { name: 'Go to question 2' }).click();
	await expect(screen).toBeHidden();
	await expect(page.locator('.progress-question')).toHaveText('Question 2 of 3');
	await expect(flag).toHaveAttribute('aria-pressed', 'false');

	await review.click();
	await screen.getByRole('button', { name: 'Go to question 1' }).click();
	await expect(page.locator('.progress-question')).toHaveText('Question 1 of 3');
	await expect(flag).toHaveAttribute('aria-pressed', 'true');

	// Unflagging works from the toggle.
	await flag.click();
	await expect(flag).toHaveAttribute('aria-pressed', 'false');
});

test('the review palette reflows and stays usable at 320px', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 640 });
	await openShell(page);
	await page.getByTestId('assessment-review').click();
	const screen = page.locator('.review-screen');
	await expect(screen).toBeVisible();

	// The shell reflows inside a 320px viewport: its content never scrolls sideways.
	// (The demo host page's own header is out of scope here.)
	const overflow = await page.evaluate(() => {
		const shell = document.querySelector('.assessment-shell');
		return shell ? shell.scrollWidth - shell.clientWidth : -1;
	});
	expect(overflow).toBeLessThanOrEqual(1);

	await screen.getByRole('button', { name: 'Go to question 3' }).click();
	await expect(page.locator('.progress-question')).toHaveText('Question 3 of 3');
});

test('leaving a linear test part warns that you cannot return', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openShell(page, '?layout=linear-parts');
	await expect(page.locator('.progress-question')).toHaveText('Question 1 of 2');

	// Forward into the next test part: confirmed, with the consequence spelled out.
	const next = page.getByTestId('assessment-next');
	await next.click();
	const dialog = page.getByRole('dialog', { name: 'Leave this part?' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('you cannot return to the questions in this part');
	await scan(page, 'dialog[open]');

	// Staying put leaves the candidate on the same question.
	await dialog.getByRole('button', { name: 'Stay on this part' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('.progress-question')).toHaveText('Question 1 of 2');

	await next.click();
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('.progress-question')).toHaveText('Question 2 of 2');
});
