import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { WCAG_AA_TAGS } from './a11y-utils';

/**
 * Practice delivery, comments and the completion screen, end to end against
 * `fixtures/assessment-practice`: the item-level "Check answer" control with its
 * attempt counter and the item feedback dialog, the comments disclosure riding the
 * submission, the submit-on-move feedback transition in a linear part, no check
 * control in simultaneous parts, and the built-in completion screen with its opt-in
 * results summary.
 */

async function scan(page: import('@playwright/test').Page, include: string) {
	const results = await new AxeBuilder({ page }).include(include).withTags(WCAG_AA_TAGS).analyze();
	expect(results.violations, `${include} violations`).toEqual([]);
}

async function answer(page: import('@playwright/test').Page, choice: 'Alpha' | 'Beta') {
	await page.getByRole('radio', { name: choice, exact: true }).first().check();
}

test('practice flow: check answer stays on the item, shows feedback and counts attempts', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('fixtures/assessment-practice?scenario=practice');
	await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 30000 });

	const check = page.getByTestId('assessment-check-answer');
	const attempts = page.getByTestId('assessment-attempts');
	await expect(check).toBeVisible();
	await expect(check).toContainText('Check answer');
	await expect(attempts).toHaveText(/Attempt 1 of 2/i);

	// The comments disclosure rides the first item's allowComment.
	const comments = page.getByTestId('assessment-comments');
	await expect(comments).toBeVisible();
	await comments.locator('summary').click();
	const input = page.getByTestId('assessment-comments-input');
	await input.fill('The diagram is unclear.');

	// A wrong answer checked through the normal per-item path stays on the question.
	await answer(page, 'Alpha');
	await check.click();
	const feedback = page.getByTestId('assessment-item-feedback');
	const dialog = page.getByRole('dialog', { name: 'Feedback' });
	await expect(dialog).toBeVisible();
	await expect(feedback).toContainText('Check your addition.');
	await scan(page, 'dialog[open]');

	// Closing returns to the question; the counter shows the next attempt.
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(attempts).toHaveText(/Attempt 2 of 2/i);

	// The comment survived the check (it rides the session state).
	await expect(input).toHaveValue('The diagram is unclear.');

	// The revised answer checks again; then the control disables with its explanation.
	await answer(page, 'Beta');
	await check.click();
	await expect(feedback).toContainText('Nice work');
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(attempts).toContainText('used all your attempts');
	await expect(check).toBeDisabled();

	// Moving on needs no further submission; the second question offers its own check.
	const next = page.getByTestId('assessment-next');
	await expect(next).toBeEnabled();
	await next.click();
	await expect(page.getByTestId('assessment-attempts')).toHaveText(/Attempt 1 of 2/i);
	await expect(page.getByTestId('assessment-comments')).toHaveCount(0);
});

test('a simultaneous part never offers the check control', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('fixtures/assessment-practice?scenario=simultaneous');
	await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 30000 });

	await expect(page.getByTestId('assessment-check-answer')).toHaveCount(0);
	await expect(page.getByTestId('assessment-attempts')).toHaveCount(0);
});

test('linear single-attempt feedback rides the submit-on-move transition', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('fixtures/assessment-practice?scenario=linear-feedback');
	await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 30000 });

	// No check control for a single-attempt item: submit-on-move delivers the feedback.
	await expect(page.getByTestId('assessment-check-answer')).toHaveCount(0);
	await answer(page, 'Beta');

	const next = page.getByTestId('assessment-next');
	await next.click();
	const dialog = page.getByRole('dialog', { name: 'Feedback' });
	await expect(dialog).toBeVisible();
	await expect(page.getByTestId('assessment-item-feedback')).toContainText('Nice work');
	// The candidate moved to question 2 behind the dialog.
	await expect(page.locator('.progress-question')).toContainText('Question 2 of 2');
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toHaveCount(0);
	// Focus lands back inside the question content after the transition feedback closes.
	await expect
		.poll(() =>
			page.evaluate(() => document.activeElement?.closest('.assessment-content') !== null),
		)
		.toBe(true);
});

test('the completion screen reports the end; showResultsSummary adds the scores', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('fixtures/assessment-practice?scenario=complete&summary=1');
	await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 30000 });

	await answer(page, 'Beta');
	const next = page.getByTestId('assessment-next');
	await next.click();
	const submit = page.getByTestId('assessment-submit');
	await expect(submit).toBeVisible();
	await submit.click();
	const confirmDialog = page.getByRole('dialog', { name: 'Submit your test?' });
	await expect(confirmDialog).toBeVisible();
	await confirmDialog.getByRole('button', { name: 'Submit test', exact: true }).click();

	// The built-in completion screen replaces delivery; the host still heard onSubmit.
	const complete = page.getByTestId('assessment-complete');
	await expect(complete).toBeVisible();
	await expect(complete.getByRole('heading', { name: 'You have finished the test.' })).toBeFocused();
	await expect(page.getByTestId('practice-results')).toContainText('Results reached the host (1 of 2)');
	await expect(page.getByTestId('assessment-total-score')).toContainText('Total score: 1 out of 2');
	const items = page.getByTestId('assessment-result-item');
	await expect(items).toHaveCount(2);
	await expect(items.first()).toContainText('Question 1');
	await expect(items.first()).toContainText('Score: 1 / 1');
	await expect(items.nth(1)).toContainText('Not answered');
	await scan(page, '[data-testid="assessment-complete"]');
});

test('without the opt-in the completion screen shows no scores', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('fixtures/assessment-practice?scenario=complete');
	await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 30000 });

	await answer(page, 'Beta');
	await page.getByTestId('assessment-next').click();
	await page.getByTestId('assessment-submit').click();
	const confirmDialog = page.getByRole('dialog', { name: 'Submit your test?' });
	await confirmDialog.getByRole('button', { name: 'Submit test', exact: true }).click();

	await expect(page.getByTestId('assessment-complete')).toBeVisible();
	await expect(page.getByTestId('assessment-results-summary')).toHaveCount(0);
	await expect(page.getByTestId('practice-results')).toContainText('Results reached the host');
});

test('320px: the practice bar and completion screen reflow without horizontal scroll', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 700 });
	await page.goto('fixtures/assessment-practice?scenario=practice');
	await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 30000 });

	await expect(page.getByTestId('assessment-check-answer')).toBeVisible();
	// The shell itself never forces horizontal scroll at 320px (the demo page's own
	// top navigation is not part of the player).
	const shellOverflow = await page.evaluate(() => {
		const shell = document.querySelector('.assessment-shell');
		return shell ? shell.scrollWidth - shell.clientWidth : -1;
	});
	expect(shellOverflow).toBeLessThanOrEqual(1);

	await page.goto('fixtures/assessment-practice?scenario=complete&summary=1');
	await expect(page.locator('.assessment-shell')).toBeVisible({ timeout: 30000 });
	await answer(page, 'Beta');
	await page.getByTestId('assessment-next').click();
	await page.getByTestId('assessment-submit').click();
	await page
		.getByRole('dialog', { name: 'Submit your test?' })
		.getByRole('button', { name: 'Submit test', exact: true })
		.click();
	await expect(page.getByTestId('assessment-complete')).toBeVisible();
	const completeOverflow = await page.evaluate(() => {
		const complete = document.querySelector('[data-testid="assessment-complete"]');
		return complete ? complete.scrollWidth - complete.clientWidth : -1;
	});
	expect(completeOverflow).toBeLessThanOrEqual(1);
});
