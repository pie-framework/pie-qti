import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { WCAG_AA_TAGS } from './a11y-utils';

/**
 * Timer and time administration end to end, against `fixtures/assessment-timed`:
 * the countdown in the header with its threshold warning, the whole-test expiry with
 * its automatic submission, the expiry dead end (Submit offered outside the last item),
 * the begin gate's start screen, and the proctor pause. Short real-time limits keep the
 * flows quick but real.
 */

async function openTimed(page: import('@playwright/test').Page, scenario: string) {
	await page.goto(`fixtures/assessment-timed?scenario=${scenario}`);
	// The gated scenario shows the start screen instead of the shell.
	const surface = page.locator('.assessment-shell, [data-testid="assessment-start"]');
	await expect(surface).toBeVisible({ timeout: 30000 });
	return surface;
}

async function scan(page: import('@playwright/test').Page, include: string) {
	const results = await new AxeBuilder({ page }).include(include).withTags(WCAG_AA_TAGS).analyze();
	expect(results.violations, `${include} violations`).toEqual([]);
}

test('timed delivery: countdown in the header, warning announced, expiry auto-submits', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openTimed(page, 'auto-submit');

	// The countdown reserves space in the header, named programmatically.
	const readout = page.getByRole('timer');
	await expect(readout).toBeVisible();
	await expect(readout).toHaveAttribute('aria-live', 'off');
	await expect(readout).toHaveAttribute('aria-label', /time remaining: \d{1,2}:\d{2}/i);
	// The candidate can hide it and bring it back; the choice rides the session state.
	const toggle = page.getByTestId('assessment-timer-toggle');
	await toggle.click();
	await expect(readout).toHaveCount(0);
	await toggle.click();
	await expect(readout).toBeVisible();

	// The 3s threshold warning lands in the timer's own polite region (limit is 6s).
	const warning = page.getByTestId('assessment-timer-warning');
	await expect(warning).toHaveText(/remaining$/i, { timeout: 8000 });
	await expect(warning).toHaveAttribute('aria-live', 'polite');

	// At expiry the player submits by itself and the results reach the host.
	await expect(page.getByTestId('timed-completed')).toContainText('Assessment completed', { timeout: 10000 });
	await expect(page.getByTestId('timed-completed')).toContainText(/\d+ of \d+/);
	// The completed shell keeps no live countdown.
	await expect(page.getByRole('timer')).toHaveCount(0);
});

test("whole-test expiry dead end: Submit is offered on question 1 and finalizes", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openTimed(page, 'dead-end');

	const next = page.getByTestId('assessment-next');
	await expect(next).toBeEnabled({ timeout: 15000 });
	await page.getByRole('radio', { name: 'Alpha', exact: true }).first().check();

	// The part limit expires with nothing reachable: an expiry dialog offers Submit.
	const dialog = page.getByRole('dialog', { name: 'The time for this part is over' });
	await expect(dialog).toBeVisible({ timeout: 10000 });
	await expect(dialog).toContainText('Submit your test to finish.');
	await scan(page, 'dialog[open]');
	// Focus starts on the title, so a stray Enter cannot submit the test.
	await expect(dialog.getByRole('heading', { name: 'The time for this part is over' })).toBeFocused();

	// Submit takes Next's place although this is question 1 of 3.
	const submit = page.getByTestId('assessment-submit');
	await expect(submit).toBeVisible();
	await expect(next).toHaveCount(0);
	await expect(submit).toBeEnabled();

	// The dialog carries the Submit action; confirming finalizes from question 1.
	await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(page.getByTestId('timed-completed')).toContainText('Assessment completed', { timeout: 10000 });
	await expect(page.getByTestId('timed-completed')).toContainText(/of 3/);
});

test('begin gate: the start screen holds the clocks until Begin, then delivery starts', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openTimed(page, 'start-gate');

	const start = page.getByTestId('assessment-start');
	await expect(start).toBeVisible({ timeout: 15000 });
	await expect(page.locator('.assessment-start-title')).toHaveText('Begin gate check');
	await expect(page.getByTestId('assessment-start-time')).toHaveText('You have 10 minutes.');
	await expect(start).toContainText('Answer every question, then submit.');
	await expect(page.getByRole('timer')).toHaveCount(0);
	await expect(page.getByTestId('assessment-next')).toHaveCount(0);
	await scan(page, '[data-testid="assessment-start"]');

	// Focus starts on the screen's heading; Begin enters the question and starts the clock.
	await expect(page.locator('.assessment-start-title')).toBeFocused();
	await page.getByTestId('assessment-begin').click();
	// One item: the navigation bar shows Submit (the last item), not Next.
	await expect(page.getByTestId('assessment-submit')).toBeVisible({ timeout: 15000 });
	const readout = page.getByRole('timer');
	await expect(readout).toBeVisible();
	const firstName = await readout.getAttribute('aria-label');
	await expect(readout).toHaveAttribute('aria-label', /time remaining: 9:/i, { timeout: 10000 });
	expect(firstName).not.toBe(await readout.getAttribute('aria-label'));
});

test('proctor pause: overlay names the reason, the countdown freezes, resume continues', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openTimed(page, 'pause');

	const readout = page.getByRole('timer');
	await expect(readout).toBeVisible({ timeout: 15000 });
	await expect(readout).toHaveAttribute('aria-label', /time remaining: \d{1,2}:\d{2}/i);

	await page.getByTestId('proctor-pause').click();
	const overlay = page.getByTestId('assessment-pause-overlay');
	await expect(overlay).toBeVisible();
	await expect(overlay).toContainText('Proctor needs your attention');
	await scan(page, '.pause-overlay');
	// Focus lands on the overlay heading.
	await expect(overlay.getByRole('heading', { name: 'Assessment paused' })).toBeFocused();
	await expect(readout).toHaveAttribute('aria-label', /paused: \d{1,2}:\d{2}/i);
	const frozen = await readout.getAttribute('aria-label');

	// Frozen: two tick intervals later the reading is unchanged.
	await page.waitForTimeout(2200);
	await expect(readout).toHaveAttribute('aria-label', frozen ?? '');

	await page.getByTestId('proctor-resume').click();
	await expect(overlay).toBeHidden();
	// The countdown continues from where it froze.
	const frozenTime = frozen?.match(/\d{1,2}:\d{2}$/)?.[0] ?? '';
	await expect(readout).toHaveAttribute('aria-label', `Time remaining: ${frozenTime}`, { timeout: 5000 });
	await expect(readout).not.toHaveAttribute('aria-label', `Time remaining: ${frozenTime}`, { timeout: 8000 });
});

test('a pause survives a reload: the overlay is up until the proctor resumes, then delivery works', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('fixtures/assessment-timed?scenario=pause&resume=1');
	const readout = page.getByRole('timer');
	await expect(readout).toBeVisible({ timeout: 30000 });

	// Answer, then pause; the pause rides the autosaved snapshot.
	await page.getByRole('radio', { name: 'Alpha', exact: true }).first().check();
	await page.getByTestId('proctor-pause').click();
	const overlay = page.getByTestId('assessment-pause-overlay');
	await expect(overlay).toBeVisible();
	await expect(page.getByTestId('assessment-save-status')).toHaveText(/saved/i, { timeout: 8000 });

	await page.reload();

	// The restored session reopens paused: the overlay is up with no proctor action,
	// every control beneath it is inert, and no resume prompt is offered.
	await expect(overlay).toBeVisible({ timeout: 30000 });
	await expect(overlay).toContainText('Proctor needs your attention');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(overlay.getByRole('heading', { name: 'Assessment paused' })).toBeFocused();
	// Tab (either direction) stays on the overlay heading: the inert chrome and the
	// covered host page cannot take focus while the modal pause holds (WCAG 2.4.11).
	await page.keyboard.press('Tab');
	await expect(overlay.getByRole('heading', { name: 'Assessment paused' })).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(overlay.getByRole('heading', { name: 'Assessment paused' })).toBeFocused();

	// The proctor resumes: delivery unlocks and the deferred resume prompt returns
	// (the draft was never answered).
	await page.getByTestId('proctor-resume').click();
	await expect(overlay).toBeHidden();
	const dialog = page.getByRole('dialog', { name: 'Resume your test?' });
	await expect(dialog).toBeVisible({ timeout: 10000 });
	await dialog.getByTestId('assessment-resume-continue').click();
	// Actions work again, and the answer survived the pause and the reload.
	await page.getByTestId('assessment-next').click();
	await expect(page.getByTestId('assessment-prev')).toBeEnabled({ timeout: 10000 });
	await page.getByTestId('assessment-prev').click();
	await expect(page.getByRole('radio', { name: 'Alpha', exact: true }).first()).toBeChecked({ timeout: 10000 });
});

test('an expired allowLateSubmission limit is announced but keeps the test open', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await openTimed(page, 'late');

	const readout = page.getByRole('timer');
	await expect(readout).toBeVisible({ timeout: 15000 });
	// Expired, yet nothing finalizes: the candidate may still work and submit.
	await expect(readout).toHaveAttribute('aria-label', /time expired/i, { timeout: 8000 });
	await expect(page.getByTestId('timed-completed')).toHaveCount(0);
	// One item: Submit sits in the bar and stays enabled past the expired limit.
	await expect(page.getByTestId('assessment-submit')).toBeEnabled();

	await page.getByRole('radio', { name: 'Alpha', exact: true }).first().check();
	await page.getByTestId('assessment-submit').click();
	const dialog = page.getByRole('dialog', { name: 'Submit your test?' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Submit test', exact: true }).click();
	await expect(page.getByTestId('timed-completed')).toContainText('Assessment completed', { timeout: 10000 });
});
