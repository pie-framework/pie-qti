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

		// Wait for test helpers to be available
		await page.waitForFunction(() => typeof (window as any).__testHelpers !== 'undefined', { timeout: 10000 });

		// Select the Science sample using test helper (workaround for Svelte 5 + Playwright compatibility)
		await page.evaluate(() => (window as any).__testHelpers.selectSample('science-1'));

		// Wait for the assessment shell to re-render with new content
		// The shell shows the assessment identifier as a heading when loaded
		await expect(page.getByRole('heading', { name: 'SCIENCE-001' })).toBeVisible({ timeout: 10000 });

		// Wait for the order interaction to fully render before interacting
		const orderHost = page.locator('pie-qti-order').first();
		await expect(orderHost).toBeVisible({ timeout: 10000 });

		// On Q1 (orderInteraction), "Previous" is disabled.
		const prev = page.getByRole('button', { name: /^Previous$/i });
		const next = page.getByRole('button', { name: /^Next$/i });
		await expect(prev).toBeDisabled();
		await expect(next).toBeEnabled();

		// Move forward without answering should be blocked (allowSkipping=false, validateResponses=true).
		await next.click();
		// Wait a bit for validation to trigger
		await page.waitForTimeout(500);
		await expect(page.getByText(/must answer this item/i)).toBeVisible({ timeout: 10000 });

		// Provide an order response by dispatching a qti-change from the host element.
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

		// Wait for test helpers to be available
		await page.waitForFunction(() => typeof (window as any).__testHelpers !== 'undefined', { timeout: 10000 });

		// Select the interaction showcase sample using test helper
		await page.evaluate(() => (window as any).__testHelpers.selectSample('interaction-showcase-1'));

		// The showcase contains a passage split-pane + choice first.
		await expect(page.locator('pie-qti-choice').first()).toBeVisible();
		await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible();
	});

	test('section switching navigates to the selected section (interaction showcase)', async ({ page }) => {
		await page.goto('/assessment-demo');

		// Wait for test helpers to be available
		await page.waitForFunction(() => typeof (window as any).__testHelpers !== 'undefined', { timeout: 10000 });

		// Select the interaction showcase sample using test helper
		await page.evaluate(() => (window as any).__testHelpers.selectSample('interaction-showcase-1'));

		// Wait for the assessment shell to re-render with new content
		await expect(page.getByRole('heading', { name: 'SHOWCASE-001' })).toBeVisible({ timeout: 10000 });

		// Wait for initial section to load
		await expect(page.locator('pie-qti-choice').first()).toBeVisible({ timeout: 10000 });

		// Open the section menu (only shown when multiple sections exist).
		const sectionsButton = page.getByRole('button', { name: /^Sections$/i });
		await expect(sectionsButton).toBeVisible();
		await sectionsButton.click();

		// Wait for menu to open
		await page.waitForTimeout(300);

		// Select the "Hotspot" section and verify we now render a hotspot interaction.
		const hotspotButton = page.getByRole('button', { name: /^Hotspot$/i });
		await expect(hotspotButton).toBeVisible();
		await hotspotButton.click();

		// Wait for navigation and new interaction to render
		await page.waitForTimeout(500);
		await expect(page.locator('pie-qti-hotspot').first()).toBeVisible({ timeout: 15000 });
	});

	test('after submit, an end screen shows total and per-question scores', async ({ page }) => {
		await page.goto('/assessment-demo');

		// Wait for test helpers to be available
		await page.waitForFunction(() => typeof (window as any).__testHelpers !== 'undefined', { timeout: 10000 });

		// Use Reading Comprehension sample (nonlinear/simultaneous) so we can move through items easily.
		await page.evaluate(() => (window as any).__testHelpers.selectSample('reading-comp-1'));

		const next = page.getByRole('button', { name: /^Next$/i });
		const submit = page.getByRole('button', { name: /^Submit Assessment$/i });

		// Navigate through items, answering each with the first choice, until we reach Submit.
		for (let i = 0; i < 5; i++) {
			if (await submit.isVisible()) break;

			const choiceHost = page.locator('pie-qti-choice').first();
			await expect(choiceHost).toBeVisible();
			await choiceHost.locator('input[type="radio"]').first().click();

			await next.click();
		}

		await expect(submit).toBeVisible();
		await submit.click();

		// End screen should render.
		await expect(page.getByRole('heading', { name: /assessment complete/i })).toBeVisible();
		await expect(page.getByText(/total score/i)).toBeVisible();
		await expect(page.getByRole('heading', { name: /scores by question/i })).toBeVisible();
		// At least one scored row should be present.
		const rowCount = await page.locator('table tbody tr').count();
		expect(rowCount).toBeGreaterThan(0);
	});

	test('interaction showcase scoring is non-zero when answering a known-correct item', async ({ page }) => {
		await page.goto('/assessment-demo');

		// Wait for test helpers to be available
		await page.waitForFunction(() => typeof (window as any).__testHelpers !== 'undefined', { timeout: 10000 });

		// Select the interaction showcase sample using test helper
		await page.evaluate(() => (window as any).__testHelpers.selectSample('interaction-showcase-1'));

		// First item is based on reading comprehension q1 where correct choice is identifier "A" (Evaporation).
		const choiceHost = page.locator('pie-qti-choice').first();
		await expect(choiceHost).toBeVisible();
		await choiceHost.locator('input[type="radio"][value="A"]').click();

		// Navigate to the end and submit.
		const next = page.getByRole('button', { name: /^Next$/i });
		const submit = page.getByRole('button', { name: /^Submit Assessment$/i });
		for (let i = 0; i < 30; i++) {
			if (await submit.isVisible()) break;
			await next.click();
		}
		await expect(submit).toBeVisible();
		await submit.click();

		// End screen: total score should not be 0.
		await expect(page.getByRole('heading', { name: /assessment complete/i })).toBeVisible();
		const totalText = await page.locator('.stat-value').first().innerText();
		const total = Number(totalText.split('/')[0]?.trim() ?? 0);
		expect(total).toBeGreaterThan(0);
	});

	test('interaction showcase scores two known-correct choice items', async ({ page }) => {
		await page.goto('/assessment-demo');

		// Wait for test helpers to be available
		await page.waitForFunction(() => typeof (window as any).__testHelpers !== 'undefined', { timeout: 10000 });

		// Select the interaction showcase sample using test helper
		await page.evaluate(() => (window as any).__testHelpers.selectSample('interaction-showcase-1'));

		// Wait for the assessment shell to re-render with new content
		await expect(page.getByRole('heading', { name: 'SHOWCASE-001' })).toBeVisible({ timeout: 10000 });

		const next = page.getByRole('button', { name: /^Next$/i });
		const submit = page.getByRole('button', { name: /^Submit Assessment$/i });

		// Capture qti-change events to ensure responses are emitted for both items.
		await page.evaluate(() => {
			(window as any).__qtiChanges = [];
			document.addEventListener('qti-change', (e: any) => {
				(window as any).__qtiChanges.push(e?.detail);
			});
		});

		// Q1 (water cycle) correct is "A"
		const q1Choice = page.locator('pie-qti-choice').first();
		await expect(q1Choice).toBeVisible({ timeout: 10000 });
		const q1Radio = q1Choice.locator('input[type="radio"][value="A"]');
		await expect(q1Radio).toBeVisible();
		await q1Radio.click();
		await expect(q1Radio).toBeChecked();
		await next.click();

		// Wait for Q2 to load
		await page.waitForTimeout(500);

		// Q2 (industrial revolution stimulus) correct is "ChoiceB"
		const q2Choice = page.locator('pie-qti-choice').first();
		await expect(q2Choice).toBeVisible({ timeout: 10000 });
		const q2Radio = q2Choice.locator('input[type="radio"][value="ChoiceB"]');
		await expect(q2Radio).toBeVisible({ timeout: 10000 });
		await q2Radio.click();
		await expect(q2Radio).toBeChecked();

		const changes = await page.evaluate(() => (window as any).__qtiChanges);
		console.log('qti-change events:', JSON.stringify(changes, null, 2));

		// Skip the rest to submit.
		for (let i = 0; i < 30; i++) {
			if (await submit.isVisible()) break;
			await next.click();
		}
		await expect(submit).toBeVisible();
		await submit.click();

		await expect(page.getByRole('heading', { name: /assessment complete/i })).toBeVisible();
		const totalText = await page.locator('.stat-value').first().innerText();
		const total = Number(totalText.split('/')[0]?.trim() ?? 0);

		// Debug: inspect stored session to understand which item scored 0 if this fails.
		const stored = await page.evaluate(() => {
			const keys = Object.keys(localStorage).filter((k) => k.startsWith('qti_session_SHOWCASE-001:qti2-example:'));
			const sessions = keys
				.map((k) => {
					try {
						return { key: k, session: JSON.parse(localStorage.getItem(k) || 'null') };
					} catch {
						return null;
					}
				})
				.filter(Boolean) as Array<{ key: string; session: any }>;
			sessions.sort((a, b) => (b.session?.createdAt ?? 0) - (a.session?.createdAt ?? 0));
			const s = sessions[0]?.session;
			return {
				latestKey: sessions[0]?.key,
				itemResponses: s?.state?.itemResponses ?? null,
				itemScores: s?.state?.itemScores ?? null,
			};
		});

		// Print debug info when running locally / in CI logs.
		console.log('SHOWCASE session debug:', JSON.stringify(stored, null, 2));

		expect(stored).toBeTruthy();
		// Expect total score >= 2 for two correct answers.
		expect(total).toBeGreaterThanOrEqual(2);
	});
});


