import { expect, test } from './fixtures';

for (const width of [1280, 375]) {
	for (const stage of ['responses', 'finalize']) {
		test(`submission retries after a ${stage} failure at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto(`fixtures/assessment-submit?stage=${stage}`);
			const answer = page.getByRole('radio', { name: 'Water', exact: true });
			await answer.check();
			const submit = page.getByTestId('assessment-submit');
			await submit.click();
			await expect(submit).toBeDisabled();
			await expect(page.getByRole('alert')).toContainText('Your answers are still here');
			await expect(answer).toBeChecked();
			const retry = page.getByRole('button', { name: 'Try Again', exact: true });
			await expect(retry).toBeFocused();
			await retry.press('Enter');
			await expect(page.getByText('Assessment completed', { exact: true })).toBeVisible();
			await expect(page.getByRole('alert')).toHaveCount(0);
			await expect(answer).toBeChecked();
			await expect(submit).toBeDisabled();
			await expect(page.getByTestId('request-counts')).toHaveText(
				stage === 'responses' ? 'Responses: 2; finalizations: 1' : 'Responses: 1; finalizations: 2'
			);
		});
	}
}
