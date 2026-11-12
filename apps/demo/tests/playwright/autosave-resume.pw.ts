import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { WCAG_AA_TAGS } from './a11y-utils';

/**
 * Autosave and resume end to end, against `fixtures/assessment-autosave`: the save
 * indicator riding the real save state, drafts durable across a reload, the resume
 * prompt restoring answers, flags and the hidden countdown, Start over clearing the
 * draft (with its confirmation), the disabled-autosave path and the failure state.
 */

async function open(page: import('@playwright/test').Page, params: Record<string, string> = {}) {
	await page.setViewportSize({ width: 1280, height: 900 });
	// `resume=1` makes the fixture resume the stored draft when there is one; a first
	// visit finds nothing and starts fresh, so every run can pass it harmlessly.
	const query = new URLSearchParams({ resume: '1', ...params }).toString();
	await page.goto(`fixtures/assessment-autosave?${query}`);
	const entry = page.getByRole('textbox');
	await expect(entry).toBeVisible({ timeout: 30000 });
	return entry;
}

async function scanDialog(page: import('@playwright/test').Page) {
	const results = await new AxeBuilder({ page }).include('dialog[open]').withTags(WCAG_AA_TAGS).analyze();
	expect(results.violations, 'dialog violations').toEqual([]);
}

test('autosave persists drafts, the indicator follows, and a reload offers resume', async ({ page }) => {
	const entry = await open(page);

	// The indicator shows the real save states. The navigation save may already have
	// landed; typing starts a fresh cycle: saving, then saved with the time.
	const indicator = page.getByTestId('assessment-save-status');
	await expect(indicator).toBeVisible();
	await expect(indicator).toHaveAttribute('aria-live', 'polite');
	await expect(indicator).toHaveText(/saved/i, { timeout: 5000 });

	await entry.pressSequentially('water');
	await expect(indicator).toHaveText(/saving/i, { timeout: 5000 });
	await expect(indicator).toHaveText(/saved · \d{1,2}:\d{2}/i, { timeout: 5000 });
	// The save reached the host through the typed event as well.
	await expect(page.getByTestId('host-save-events')).toContainText('failures: 0');

	// Answer, flag and hide the countdown: everything a resume must restore.
	await page.getByTestId('assessment-next').click();
	await page.getByRole('radio', { name: 'Alpha', exact: true }).first().check();
	await page.getByTestId('assessment-flag').click();
	await expect(page.getByTestId('assessment-flag')).toHaveAttribute('aria-pressed', 'true');
	await page.getByTestId('assessment-timer-toggle').click();
	await expect(page.getByRole('timer')).toHaveCount(0);
	await expect(indicator).toHaveText(/saved · \d{1,2}:\d{2}/i, { timeout: 8000 });

	// Reload: the backend draft comes back and the shell asks what to do with it.
	await page.reload();
	const dialog = page.getByRole('dialog', { name: 'Resume your test?' });
	await expect(dialog).toBeVisible({ timeout: 30000 });
	await scanDialog(page);
	await expect(dialog).toContainText(/answers saved from/i);

	// Resume restores the draft: answers, the flag, and the hidden countdown.
	await dialog.getByTestId('assessment-resume-continue').click();
	await expect(page.getByRole('timer')).toHaveCount(0);
	await expect(page.getByTestId('assessment-save-status')).toBeVisible();
	await expect(page.getByTestId('assessment-flag')).toHaveAttribute('aria-pressed', 'true');
	await page.getByTestId('assessment-prev').click();
	await expect(page.getByRole('textbox')).toHaveValue('water', { timeout: 10000 });
	// The answered count survived too.
	await expect(page.getByTestId('assessment-answered-count')).toContainText('2 of 3');
});

test('Start over deletes the saved draft after its confirmation and restarts at question 1', async ({ page }) => {
	const entry = await open(page);
	await entry.fill('water');
	await expect(page.getByTestId('assessment-save-status')).toHaveText(/saved ·/i, { timeout: 8000 });

	await page.reload();
	const dialog = page.getByRole('dialog', { name: 'Resume your test?' });
	await expect(dialog).toBeVisible({ timeout: 30000 });

	// Start over is irreversible, so it confirms before deleting.
	await dialog.getByTestId('assessment-resume-start-over').click();
	const confirm = page.getByRole('dialog', { name: 'Start over and delete your saved answers?' });
	await expect(confirm).toBeVisible();
	await scanDialog(page);
	await expect(confirm).toContainText('This cannot be undone.');

	await confirm.getByRole('button', { name: 'Delete and start over' }).click();
	// Fresh delivery at question 1, no answers, no flag; the saved draft is gone.
	await expect(page.getByRole('textbox')).toHaveValue('', { timeout: 10000 });
	await expect(page.getByTestId('assessment-answered-count')).toContainText('0 of 3');
	await expect(page.getByRole('dialog')).toHaveCount(0);

	// A second reload finds nothing to resume: no prompt appears.
	await page.waitForTimeout(700);
	await page.reload();
	await expect(page.getByRole('textbox')).toBeVisible({ timeout: 30000 });
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('with autosave disabled the indicator is hidden and no resume prompt appears', async ({ page }) => {
	const entry = await open(page, { autosave: 'off' });

	await expect(page.getByTestId('assessment-save-status')).toHaveCount(0);
	await entry.pressSequentially('water');
	await page.waitForTimeout(800);
	// No saves, no failures: autosave never ran.
	await expect(page.getByTestId('host-save-events')).toHaveText('Host save events: 0; failures: 0');

	// The session was never saved, so a reload starts fresh with no prompt.
	await page.reload();
	await expect(page.getByRole('textbox')).toBeVisible({ timeout: 30000 });
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a failed save shows "Not saved" and recovers on the next change', async ({ page }) => {
	const entry = await open(page, { 'save-fails': '1' });

	const indicator = page.getByTestId('assessment-save-status');
	await expect(indicator).toHaveText(/saved/i, { timeout: 5000 });
	await entry.pressSequentially('water');
	// The first two saves are refused: the indicator says so instead of lying.
	await expect(indicator).toHaveText(/not saved/i, { timeout: 8000 });
	await expect(page.getByTestId('host-save-events')).toContainText('failures: 2');

	// The next change retries the draft; the backend accepts it.
	await entry.pressSequentially('x');
	await expect(indicator).toHaveText(/saved · \d{1,2}:\d{2}/i, { timeout: 8000 });
});
