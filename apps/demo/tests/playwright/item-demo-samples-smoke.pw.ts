import { SAMPLE_ITEMS } from '../../src/lib/sample-items.js';
import { expect, test } from './fixtures';

/**
 * Every sample in the picker, driven from SAMPLE_ITEMS so a new sample is covered the day it is
 * added rather than whenever someone writes its eval. The per-interaction evals go deeper but
 * only cover the samples they name; this is the floor beneath them.
 *
 * Three things, each of which has shipped broken:
 *  - the item renders at all (a positionObjectStage nested the wrong way round failed extraction,
 *    so the item showed only a validation error);
 *  - it renders something interactive (a rendered-but-empty item body reads as success to any
 *    content assertion);
 *  - its images actually loaded. Not merely "no 404": a url policy that rejects the resolved
 *    scheme blanks the src before any request is made, so a 404 watcher sees nothing at all.
 *
 * Uncaught page errors are covered for free by the failOnUncaughtPageError fixture.
 */

type ItemProbe = {
	componentHosts: string[];
	interactiveCount: number;
	images: Array<{ tag: string; src: string; naturalWidth: number }>;
};

/**
 * Whether the item's own XML references a bitmap/vector asset by URL. Asserting only "no image
 * is broken" would be vacuous: when a url policy rejects the resolved src the component renders
 * no `<img>` at all, so the item ends up with zero images and passes. The XML is the statement of
 * intent, so it decides whether an image is required to be on screen.
 */
function declaresImageAsset(xml: string): boolean {
	return (
		/<(?:object|qti-object)\b[^>]*\bdata\s*=\s*"[^"]*\.(?:png|jpe?g|gif|webp|svg)/i.test(xml) ||
		/<img\b[^>]*\bsrc\s*=\s*"[^"]*\.(?:png|jpe?g|gif|webp|svg)/i.test(xml)
	);
}

test.describe('item demo samples smoke', () => {
	for (const sample of SAMPLE_ITEMS) {
		test(`${sample.id} renders, is interactive, and loads its images`, async ({ page }) => {
			await page.goto(`/item-demo/${sample.id}`);

			await expect(page.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });
			await expect(page.locator('.alert-error')).toHaveCount(0);

			const probeItem = () =>
				page.evaluate((): ItemProbe | null => {
					const body = document.querySelector('.qti-item-body');
					if (!body) return null;

					const roots: Array<Element | ShadowRoot> = [body];
					const walk = (root: Element | ShadowRoot) => {
						for (const el of root.querySelectorAll('*')) {
							if (el.shadowRoot) {
								roots.push(el.shadowRoot);
								walk(el.shadowRoot);
							}
						}
					};
					walk(body);
					const queryAll = (selector: string) =>
						roots.flatMap((root) => [...root.querySelectorAll(selector)]);

					const interactiveSelector = [
						'input:not([type="hidden"])',
						'select',
						'textarea',
						'button',
						'[contenteditable="true"]',
						'[draggable="true"]',
						'[role="button"]',
						'[role="radio"]',
						'[role="checkbox"]',
						'[role="application"]',
						'audio',
						'video',
						'canvas',
					].join(',');

					return {
						componentHosts: [
							...new Set(
								[...body.querySelectorAll('*')]
									.map((el) => el.tagName.toLowerCase())
									.filter((tag) => tag.startsWith('pie-qti-')),
							),
						],
						interactiveCount: queryAll(interactiveSelector).length,
						images: queryAll('img, image').map((el) => ({
							tag: el.tagName.toLowerCase(),
							src: el.getAttribute('src') ?? el.getAttribute('href') ?? '',
							// Only <img> reports decode state; treat SVG <image> as loaded if it has a href.
							naturalWidth: el instanceof HTMLImageElement ? el.naturalWidth : 1,
						})),
					};
				});

			// Custom elements upgrade asynchronously and images decode after that, so poll rather
			// than sleeping — a fixed wait is either flaky on a cold dev server or wasted time.
			await expect
				.poll(async () => (await probeItem())?.interactiveCount ?? 0, { timeout: 20_000 })
				.toBeGreaterThan(0);

			const probe = await probeItem();
			expect(probe, 'item body disappeared after load').not.toBeNull();
			const { componentHosts, images } = probe as ItemProbe;

			const blank = images.filter((image) => !image.src.trim() || image.naturalWidth === 0);
			expect(
				blank,
				`image(s) failed to load in ${componentHosts.join(', ') || 'item body'}: ${blank
					.map((image) => `${image.tag}[src=${image.src || 'empty'}]`)
					.join(', ')}`,
			).toEqual([]);

			if (declaresImageAsset(sample.xml)) {
				await expect
					.poll(async () => (await probeItem())?.images.length ?? 0, { timeout: 10_000 })
					.toBeGreaterThan(0);
			}
		});
	}
});
