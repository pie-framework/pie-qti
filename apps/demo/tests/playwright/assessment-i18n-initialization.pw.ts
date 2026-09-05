import { expect, test } from './fixtures';

test('a cold assessment load renders translated controls and headings', async ({ page }) => {
	await page.goto('assessment-demo');
	await expect(page.getByTestId('assessment-next')).toHaveText(/Next/);
	await expect(page.getByRole('region', { name: 'Reading passages', exact: true })).toBeVisible();
	await expect(page.getByTestId('assessment-prev')).toHaveText(/Previous/);
	await expect(page.getByRole('heading', { name: 'Reading Passage', exact: true })).toBeVisible();
});

test('a late context provider updates the assessment without losing its answer', async ({ page }) => {
	await page.goto('fixtures/assessment-i18n');
	const answer = page.getByRole('radio', { name: 'Evaporation', exact: true });
	await answer.check();
	await expect(page.getByTestId('assessment-next')).toHaveText(/Next/);
	await page.getByRole('button', { name: 'Load French translations' }).click();
	await expect(page.getByTestId('assessment-next')).toHaveText(/Suivant/);
	await expect(answer).toBeChecked();
	await page.getByRole('button', { name: 'Use explicit English provider' }).click();
	await expect(page.getByTestId('assessment-next')).toHaveText(/Next/);
	await expect(answer).toBeChecked();
});


test('a stored French locale stays translated when navigating between items', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('pie-qti-locale', 'fr-FR'));
	await page.goto('assessment-demo');
	await expect(page.getByTestId('assessment-next')).toHaveText(/Suivant/);
	await page.getByRole('radio', { name: 'Evaporation', exact: true }).check();
	await page.getByTestId('assessment-next').click();
	await expect(page.getByRole('progressbar')).toHaveAccessibleName(/Question 2 sur 3/);
	await expect(page.getByTestId('assessment-next')).toHaveText(/Suivant/);
	await expect(page.getByTestId('assessment-prev')).toHaveText(/Précédent/);
});
