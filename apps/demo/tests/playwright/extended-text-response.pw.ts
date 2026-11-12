/**
 * A string answer is the candidate's text. Text that reads as JSON — here a decimal with a
 * trailing zero — must stay exactly as typed: in the field while the candidate types, and in the
 * response the player stores and hands back to the interaction.
 *
 * The QTI 3 demo shows the session's current responses, so the stored value is checked as well
 * as the field.
 */

import { expect, type Page, test } from './fixtures';

async function openExtendedTextItem(page: Page) {
	await page.goto('qti3-demo');
	await page.locator('#sample-select').selectOption('qti3-extended-text');
	const field = page.locator('pie-qti-extended-text textarea');
	await expect(field).toBeVisible({ timeout: 40_000 });
	return field;
}

/** The session responses the demo renders as JSON. */
function storedResponses(page: Page) {
	return page.locator('div:has(> h3:text-is("Current Responses:")) > pre');
}

/** Tagged @cross-browser: text input handling in textareas/contenteditable also runs on WebKit and Firefox. */
const CROSS_BROWSER = { tag: '@cross-browser' };

test.describe('extended text keeps a typed answer exactly as written', CROSS_BROWSER, () => {
	// 1e5 reads as a number once its last character is typed: the field must not turn it into
	// 100000 under the candidate's cursor.
	for (const answer of ['1.50', '1e5']) {
		test(`typing ${answer} keeps it in the field and in the stored response`, async ({ page }) => {
			const field = await openExtendedTextItem(page);

			await field.pressSequentially(answer);
			await expect(field).toHaveValue(answer);
			await expect(storedResponses(page)).toContainText(`"RESPONSE": "${answer}"`);

			// Leaving the field changes nothing.
			await field.blur();
			await expect(field).toHaveValue(answer);
			await expect(storedResponses(page)).toContainText(`"RESPONSE": "${answer}"`);
		});
	}

	test('pasting 1.50 keeps 1.50 in the field and in the stored response', async ({ page }) => {
		const field = await openExtendedTextItem(page);

		await field.fill('1.50');
		await expect(field).toHaveValue('1.50');
		await expect(storedResponses(page)).toContainText('"RESPONSE": "1.50"');
	});
});
