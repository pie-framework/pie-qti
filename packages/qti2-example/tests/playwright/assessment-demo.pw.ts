import { expect, test } from '@playwright/test';

test.describe('/assessment-demo', () => {
	test('multiple choice is selectable (reading comprehension)', async ({ page }) => {
		await page.goto('/assessment-demo');

		// Ensure we render a choice interaction (in shadow DOM)
		const choiceHost = page.locator('pie-qti-choice').first();
		await expect(choiceHost).toBeVisible();

		// Click first radio (Playwright CSS selectors pierce shadow DOM by default)
		const firstRadio = choiceHost.locator('input[type="radio"]').first();
		await firstRadio.click();
		await expect(firstRadio).toBeChecked();
	});

	test('science demo enforces "cannot go back" once you move forward', async ({ page }) => {
		await page.goto('/assessment-demo');

		// Select the Science sample from dropdown by value (sample id).
		await page.getByLabel('Sample Assessments').selectOption('science-1');

		// On Q1 (orderInteraction), "Previous" is disabled.
		const prev = page.getByRole('button', { name: /^Previous$/i });
		const next = page.getByRole('button', { name: /^Next$/i });
		await expect(prev).toBeDisabled();

		// Move forward without answering should be blocked (allowSkipping=false, validateResponses=true).
		await next.click();
		await expect(page.getByText(/must answer this item/i)).toBeVisible();

		// Provide an order response by dispatching a qti-change from the host element.
		const orderHost = page.locator('pie-qti-order').first();
		await expect(orderHost).toBeVisible();
		const interaction = await orderHost.evaluate((el: any) => {
			const raw = el.interaction ?? el.getAttribute('interaction');
			return typeof raw === 'string' ? JSON.parse(raw) : raw;
		});
		const responseId = interaction?.responseId;
		expect(responseId).toBeTruthy();
		const ids = (interaction?.choices ?? []).map((c: any) => c.identifier);
		expect(ids.length).toBeGreaterThan(0);

		// For a minimal "answered" state, send a valid ordered list.
		await orderHost.evaluate(
			(el: HTMLElement, detail: any) => {
				el.dispatchEvent(
					new CustomEvent('qti-change', {
						detail: { responseId: detail.responseId, value: detail.value, timestamp: Date.now() },
						bubbles: true,
						composed: true,
					}),
				);
			},
			{ responseId, value: ids },
		);

		// Now next should succeed.
		await next.click();

		// Once we've moved forward in this linear+no-review flow, we should not be able to go back.
		await expect(prev).toBeDisabled();
	});

	test('interaction showcase sample renders multiple interaction types', async ({ page }) => {
		await page.goto('/assessment-demo');
		await page.getByLabel('Sample Assessments').selectOption('interaction-showcase-1');

		// The showcase contains a passage split-pane + choice first.
		await expect(page.locator('pie-qti-choice').first()).toBeVisible();
		await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible();
	});
});


