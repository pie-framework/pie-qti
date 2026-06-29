import { expect, type Page, test } from '@playwright/test';

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
	await page.evaluate(
		({ hostSelector, key, targetSelector }) => {
			const host = document.querySelector(hostSelector);
			if (!host) {
				throw new Error(`Missing custom element host ${hostSelector}`);
			}
			const target = host.shadowRoot?.querySelector<HTMLElement>(targetSelector);
			if (!target) {
				throw new Error(`Missing ${targetSelector} inside ${hostSelector}`);
			}
			target.focus();
			target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		},
		{ hostSelector, key, targetSelector }
	);
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
