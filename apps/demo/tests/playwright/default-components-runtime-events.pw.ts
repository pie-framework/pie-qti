import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from './fixtures';

import { WCAG_AA_TAGS } from './a11y-utils';

type RecordedQtiChangeEvent = {
	responseId: string;
	value: unknown;
	bubbles: boolean;
	composed: boolean;
};

const SAMPLE_TAGS: Record<string, string> = {
	'gap-match': 'pie-qti-gap-match',
	'hottext-single': 'pie-qti-hottext',
	'order-interaction': 'pie-qti-order',
};

declare global {
	interface Window {
		__pieQtiRecordedQtiChangeEvents?: RecordedQtiChangeEvent[];
	}
}

test.describe('default component runtime response events', () => {
	test('hottextInteraction emits a composed qti-change event from the real custom element', async ({ page }) => {
		await openItemDemo(page, 'hottext-single');
		await startRecordingQtiChangeEvents(page);

		await clickInShadowRoot(page, 'pie-qti-hottext', 'hottext[identifier="H2"]');

		await expectQtiChangeEvents(page, [
			{
				responseId: 'RESPONSE',
				value: 'H2',
				bubbles: true,
				composed: true,
			},
		]);
	});

	test('orderInteraction emits ordered response values from the real custom element', async ({ page }) => {
		await openItemDemo(page, 'order-interaction');
		await startRecordingQtiChangeEvents(page);

		await clickInShadowRoot(page, 'pie-qti-order', 'button[aria-label="Confirm this order as your answer"]');

		const events = await waitForQtiChangeEvents(page, 1);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			responseId: 'RESPONSE',
			bubbles: true,
			composed: true,
		});
		expect(events[0].value).toEqual(expect.arrayContaining(['ChoiceA', 'ChoiceB', 'ChoiceC', 'ChoiceD']));
		expect(events[0].value).toHaveLength(4);
	});

	test('gapMatchInteraction emits directed-pair values from the real custom element', async ({ page }) => {
		await openItemDemo(page, 'gap-match');
		await startRecordingQtiChangeEvents(page);

		await pressKeyInShadowRoot(page, 'pie-qti-gap-match', 'button[data-word-id="W1"]', 'Enter');
		await clickInShadowRoot(page, 'pie-qti-gap-match', 'button[data-gap-id="G1"]');

		await expectQtiChangeEvents(page, [
			{
				responseId: 'RESPONSE',
				value: ['W1 G1'],
				bubbles: true,
				composed: true,
			},
		]);
	});
});

/**
 * A single-select hottext (maxChoices=1) is a radio group: what jsdom cannot show — the real
 * Tab order through the shadow root, the inline direction inherited into it, the focus ring —
 * checked in the browser against the sample "The cat jumps over the fence" (H1, H2, H3).
 */
test.describe('single-select hottext radio group in the real custom element', () => {
	test('one Tab stop, arrow keys that move and check, no toggle-off, and Clear answer', async ({ page }) => {
		await openItemDemo(page, 'hottext-single');
		const host = page.locator('pie-qti-hottext');
		const group = host.getByRole('radiogroup', { name: 'Text selection interaction' });
		const [cat, jumps, fence] = ['cat', 'jumps', 'fence'].map((word) =>
			group.getByRole('radio', { name: new RegExp(`^${word}\\b`) }),
		);
		await expect(group.getByRole('radio')).toHaveCount(3);
		await expect(host.locator('[aria-pressed]')).toHaveCount(0);
		await startRecordingQtiChangeEvents(page);

		// The group is one Tab stop: Tab leaves it from the first radio, Shift+Tab comes back to it.
		await cat.focus();
		await page.keyboard.press('Tab');
		await expect(jumps).not.toBeFocused();
		await expect(fence).not.toBeFocused();
		await page.keyboard.press('Shift+Tab');
		await expect(cat).toBeFocused();

		// An arrow key moves focus and checks; the focus ring stays visible.
		await page.keyboard.press('ArrowRight');
		await expect(jumps).toBeFocused();
		await expect(jumps).toHaveAttribute('aria-checked', 'true');
		await expect(jumps).toHaveCSS('outline-style', 'solid');
		// The checked radio group is valid ARIA (radio roles, aria-checked, no stray aria-pressed).
		const scan = await new AxeBuilder({ page }).include('pie-qti-hottext').withTags(WCAG_AA_TAGS).analyze();
		expect(scan.violations).toEqual([]);

		// Re-activating the checked radio changes nothing and emits nothing.
		await page.keyboard.press('Space');
		await page.keyboard.press('Enter');
		await jumps.click();
		await expect(jumps).toHaveAttribute('aria-checked', 'true');

		await page.keyboard.press('ArrowLeft');
		await expect(cat).toBeFocused();

		// Left/Right follow the inline direction the host inherits: under RTL, ArrowLeft moves forward.
		await host.evaluate((element) => element.setAttribute('dir', 'rtl'));
		await page.keyboard.press('ArrowLeft');
		await expect(jumps).toBeFocused();
		await expect(jumps).toHaveAttribute('aria-checked', 'true');

		// Clear answer retracts the answer, goes away with it and returns focus to the first radio.
		await host.getByRole('button', { name: 'Clear answer' }).click();
		await expect(cat).toBeFocused();
		await expect(cat).toHaveAttribute('tabindex', '0');
		await expect(host.getByRole('button', { name: 'Clear answer' })).toHaveCount(0);

		await expect
			.poll(async () => (await takeQtiChangeEvents(page)).map((event) => event.value))
			.toEqual(['H2', 'H1', 'H2', null]);
	});

	test.describe('on a touch screen', () => {
		test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

		test('tapping the selected word again keeps the answer', async ({ page }) => {
			await openItemDemo(page, 'hottext-single');
			const host = page.locator('pie-qti-hottext');
			const jumps = host.getByRole('radio', { name: /^jumps\b/ });
			await startRecordingQtiChangeEvents(page);

			await jumps.tap();
			await expect(jumps).toHaveAttribute('aria-checked', 'true');
			await jumps.tap();
			await expect(jumps).toHaveAttribute('aria-checked', 'true');

			await expect
				.poll(async () => (await takeQtiChangeEvents(page)).map((event) => event.value))
				.toEqual(['H2']);
		});
	});
});

async function openItemDemo(page: Page, sampleId: string) {
	await page.goto(`item-demo/${sampleId}`);
	await page.waitForLoadState('networkidle');
	await page.waitForFunction((tagName) => !!customElements.get(tagName), tagForSample(sampleId));
	await expect(page.locator(tagForSample(sampleId))).toBeAttached();
}

function tagForSample(sampleId: string): string {
	const tagName = SAMPLE_TAGS[sampleId];
	if (!tagName) {
		throw new Error(`No runtime-event test tag registered for sample ${sampleId}`);
	}
	return tagName;
}

async function startRecordingQtiChangeEvents(page: Page) {
	await page.evaluate(() => {
		window.__pieQtiRecordedQtiChangeEvents = [];
		document.addEventListener(
			'qti-change',
			(event) => {
				const qtiChangeEvent = event as CustomEvent;
				window.__pieQtiRecordedQtiChangeEvents?.push({
					responseId: qtiChangeEvent.detail?.responseId,
					value: qtiChangeEvent.detail?.value,
					bubbles: qtiChangeEvent.bubbles,
					composed: qtiChangeEvent.composed,
				});
			},
			{ capture: true }
		);
	});
}

async function clickInShadowRoot(page: Page, hostSelector: string, targetSelector: string) {
	await page.evaluate(
		({ hostSelector, targetSelector }) => {
			const host = document.querySelector(hostSelector);
			if (!host) {
				throw new Error(`Missing custom element host ${hostSelector}`);
			}
			const target = host.shadowRoot?.querySelector<HTMLElement>(targetSelector);
			if (!target) {
				throw new Error(`Missing ${targetSelector} inside ${hostSelector}`);
			}
			target.click();
		},
		{ hostSelector, targetSelector }
	);
}

async function pressKeyInShadowRoot(
	page: Page,
	hostSelector: string,
	targetSelector: string,
	key: string
) {
	await page.locator(hostSelector).locator(targetSelector).press(key);
}

async function expectQtiChangeEvents(page: Page, expectedEvents: RecordedQtiChangeEvent[]) {
	await expect.poll(() => takeQtiChangeEvents(page)).toEqual(expectedEvents);
}

async function waitForQtiChangeEvents(page: Page, count: number): Promise<RecordedQtiChangeEvent[]> {
	await expect.poll(() => takeQtiChangeEvents(page).then((events) => events.length)).toBe(count);
	return takeQtiChangeEvents(page);
}

async function takeQtiChangeEvents(page: Page): Promise<RecordedQtiChangeEvent[]> {
	return page.evaluate(() => window.__pieQtiRecordedQtiChangeEvents ?? []);
}
