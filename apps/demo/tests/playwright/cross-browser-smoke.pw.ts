import { expect, test, type Page } from './fixtures';

/**
 * The core smoke subset that also runs on WebKit and Firefox (tag @cross-browser): item
 * rendering order, assessment navigation and submission, and a few scored interaction
 * evals. Engine differences that matter to candidates surface here first — shadow DOM
 * event retargeting, native form controls, focus and layout — without paying for the
 * whole Chromium suite three times.
 *
 * The accessibility regression set (`a11y-regression.pw.ts`) carries the same tag.
 */

const CROSS_BROWSER = { tag: '@cross-browser' };

async function expandOutcomeVariables(page: Page) {
	const details = page.locator('details', { has: page.getByText('Outcome Variables', { exact: true }) }).first();
	await expect(details).toBeVisible();
	if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
		await details.locator('summary').click();
	}
}

/** The value the item demo's debug table shows for one outcome, after submission. */
async function outcome(page: Page, identifier: string): Promise<string> {
	await expandOutcomeVariables(page);
	const row = page.locator('table tr', { has: page.locator('td', { hasText: identifier }) }).first();
	await expect(row).toBeVisible();
	return (await row.locator('td').nth(1).innerText()).trim();
}

async function submitItemDemo(page: Page) {
	const submit = page.getByRole('button', { name: /submit answer/i });
	await expect(submit).toBeEnabled();
	await submit.click();
}

test.describe('cross-browser smoke: item rendering', () => {
	test('interactions render at their authored positions and inline blanks stay in their paragraph', CROSS_BROWSER, async ({
		page,
	}) => {
		await page.goto('/fixtures/item-rendering/?item=parts');
		await expect(page.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });
		await expect(page.locator('pie-qti-choice').first()).toBeVisible();

		const layout = await page.evaluate(() => {
			const element = (selector: string) => document.querySelector(selector) as Element;
			const precedes = (a: string, b: string) =>
				Boolean(element(a).compareDocumentPosition(element(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
			return {
				partABeforeChoice: precedes('p.part-a', 'pie-qti-choice'),
				choiceBeforePartB: precedes('pie-qti-choice', 'p.part-b'),
				essayInLayoutColumn: Boolean(document.querySelector('.qti-layout-col6.right-column pie-qti-extended-text')),
				choiceInTableCell: Boolean(document.querySelector('td.answer-cell pie-qti-choice')),
				renderedAfterBody: document.querySelectorAll('.qti-item-body-unslotted').length,
			};
		});
		expect(layout).toEqual({
			partABeforeChoice: true,
			choiceBeforePartB: true,
			essayInLayoutColumn: true,
			choiceInTableCell: true,
			renderedAfterBody: 0,
		});

		const blanks = page.locator('p.blanks');
		await expect(blanks.locator('input')).toHaveCount(2);
		await expect(blanks.locator('select')).toHaveCount(1);
		await expect(blanks.locator('input').first()).toHaveAccessibleName('Blank 1 of 4');
	});

	test('typing into a blank keeps the value and focus while other interactions answer', CROSS_BROWSER, async ({ page }) => {
		await page.goto('/fixtures/item-rendering/?item=parts');
		await expect(page.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });

		await page.locator('pie-qti-choice input[type="radio"]').first().check();
		const blank = page.locator('p.blanks input').first();
		await blank.click();
		await blank.pressSequentially('Paris');
		await page.locator('p.blanks select').selectOption('eu');
		await blank.focus();
		await blank.press('End');
		await blank.pressSequentially('!');

		await expect(blank).toHaveValue('Paris!');
		await expect(blank).toBeFocused();
		await expect(page.locator('pie-qti-choice input[type="radio"]').first()).toBeChecked();
		await expect(page.locator('p.blanks select')).toHaveValue('eu');
	});
});

test.describe('cross-browser smoke: assessment navigation and submission', () => {
	test('navigating between items keeps the typed answer', CROSS_BROWSER, async ({ page }) => {
		await page.goto('fixtures/assessment-input');
		const input = page.getByRole('textbox', { name: 'Blank 1 of 1' });
		await input.pressSequentially('water', { delay: 20 });
		await expect(input).toHaveValue('water');

		await page.getByTestId('assessment-next').click();
		await expect(page.locator('pie-qti-order')).toBeVisible();
		await expect(page.getByRole('button', { name: 'One', exact: true })).toBeVisible();

		await page.getByTestId('assessment-prev').click();
		await expect(input).toHaveValue('water');
	});

	test('answering and submitting completes the assessment', CROSS_BROWSER, async ({ page }) => {
		// stage=none: the fixture's backend fails nothing, so this is the plain happy path.
		await page.goto('fixtures/assessment-submit?stage=none');
		const answer = page.getByRole('radio', { name: 'Water', exact: true });
		await answer.check();
		await expect(answer).toBeChecked();

		const submit = page.getByTestId('assessment-submit');
		await submit.click();
		// Submitting routes through the confirmation dialog (WCAG 3.3.4); finalization
		// only runs on its explicit confirm.
		const dialog = page.getByRole('dialog', { name: 'Submit your test?' });
		await expect(dialog).toBeVisible();
		await dialog.getByTestId('assessment-dialog-confirm').click();
		await expect(dialog).toBeHidden();
		await expect(page.getByText('Assessment completed', { exact: true })).toBeVisible();
		// No submit-error alert; the shell's announcer regions stay mounted (persistent
		// live regions, emptied after each announcement).
		await expect(page.locator('.assessment-submit-error [role="alert"]')).toHaveCount(0);
		await expect(page.getByTestId('request-counts')).toHaveText('Responses: 1; finalizations: 1');
	});
});

test.describe('cross-browser smoke: scored interaction evals', () => {
	test('choice: the correct answer scores full marks', CROSS_BROWSER, async ({ page }) => {
		await page.goto('/item-demo/simple-choice');
		await expect(page.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });
		await page.locator('pie-qti-choice').getByRole('radio', { name: '7', exact: true }).check();
		await submitItemDemo(page);
		expect(Number(await outcome(page, 'SCORE'))).toBe(1);
	});

	test('text entry: the typed answer is scored through its mapping', CROSS_BROWSER, async ({ page }) => {
		await page.goto('/item-demo/text-entry');
		await expect(page.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });
		await page.locator('.qti-item-body input').first().fill('Photosynthesis');
		await submitItemDemo(page);
		expect(Number(await outcome(page, 'SCORE'))).toBe(2);
	});

	test('inline choice: the selected option is scored', CROSS_BROWSER, async ({ page }) => {
		await page.goto('/item-demo/inline-choice');
		await expect(page.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });
		await page.locator('.qti-item-body select').first().selectOption('vertebrate');
		await submitItemDemo(page);
		expect(Number(await outcome(page, 'SCORE'))).toBe(1);
	});
});
