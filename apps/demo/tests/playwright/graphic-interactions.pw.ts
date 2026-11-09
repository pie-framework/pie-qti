import AxeBuilder from '@axe-core/playwright';
import type { Locator } from '@playwright/test';
import { WCAG_AA_TAGS } from './a11y-utils';
import { expect, type Page, test } from './fixtures';

/**
 * The graphic interactions in the real custom elements, against `fixtures/graphic-interactions`:
 * what jsdom cannot show — pointer hit testing on the SVG shapes themselves, touch, the Tab
 * order through the shadow root, and the overlay scaling with its image on a small screen.
 */

const fixture = (item: string) => `/fixtures/graphic-interactions/?item=${item}`;

async function openFixture(page: Page, item: string): Promise<Locator> {
	await page.goto(fixture(item));
	const root = page.getByTestId('graphic-interactions-root');
	await expect(root.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });
	await expect(root.locator('.alert-error')).toHaveCount(0);
	return root;
}

/** The page point over image coordinates (x, y) of a rendered image of the given natural size. */
async function imagePoint(
	image: Locator,
	natural: { width: number; height: number },
	x: number,
	y: number,
): Promise<{ x: number; y: number }> {
	const box = await image.boundingBox();
	if (!box) throw new Error('The image has no layout box');
	return { x: box.x + (x / natural.width) * box.width, y: box.y + (y / natural.height) * box.height };
}

async function scan(page: Page, selector: string) {
	return new AxeBuilder({ page }).include(selector).withTags(WCAG_AA_TAGS).analyze();
}

/**
 * Multiple selection (maxChoices=2, a multiple-cardinality response): toggle buttons, a refused
 * selection past the cap announced, and the player scoring the identifiers it receives.
 */
test.describe('hotspot multiple selection in the real custom element', () => {
	const LIMIT = 'You can select up to 2. Deselect one to choose another.';

	function regions(host: Locator) {
		return ['Sun', 'Tree', 'Star'].map((name) => host.getByRole('button', { name, exact: true }));
	}

	test('keyboard: each region a Tab stop, Space and Enter toggle, the cap refuses and announces, scored', async ({
		page,
	}) => {
		const root = await openFixture(page, 'hotspot-multiple');
		const host = root.locator('pie-qti-hotspot');
		const [sun, tree, star] = regions(host);
		await expect(host.locator('[role="radio"]')).toHaveCount(0);

		// Every region is its own Tab stop, in hotspotChoice order.
		await sun.focus();
		await page.keyboard.press('Space');
		await expect(sun).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Tab');
		await expect(tree).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(tree).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByTestId('response')).toHaveText('["SUN","TREE"]');
		// At the cap the limit is stated...
		await expect(host.locator('.qti-selection-message')).toHaveText(LIMIT);

		// ...and a further selection is refused and announced.
		await page.keyboard.press('Tab');
		await expect(star).toBeFocused();
		await page.keyboard.press('Space');
		await expect(star).toHaveAttribute('aria-pressed', 'false');
		await expect(host.locator('.qti-hotspot-live-region')).toHaveText(LIMIT);
		await expect(page.getByTestId('response')).toHaveText('["SUN","TREE"]');

		// Deselecting the tree frees a place for the star.
		await page.keyboard.press('Shift+Tab');
		await expect(tree).toBeFocused();
		await page.keyboard.press('Space');
		await expect(tree).toHaveAttribute('aria-pressed', 'false');
		await page.keyboard.press('Tab');
		await page.keyboard.press('Enter');
		await expect(star).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByTestId('response')).toHaveText('["SUN","STAR"]');

		// The star is selected AND keyboard-focused here: the shared offset ring is
		// its focus indicator — the region's halo layer widens into a focus-coloured
		// ring around the region, distinct from the selected outline by geometry
		// (WCAG 2.4.7).
		expect(await star.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
		await expect(star.locator('xpath=ancestor::g[1]').locator('.qti-graphic-halo')).toHaveCSS('stroke-width', '12px');
		await expect(star.locator('xpath=ancestor::g[1]').locator('.qti-graphic-halo')).toHaveCSS('stroke', 'rgb(67, 56, 202)');
		// Toggle buttons with aria-pressed, never radios: valid ARIA.
		expect((await scan(page, 'pie-qti-hotspot')).violations).toEqual([]);

		// The player scores the multiple response it received: the sun and the star, a point each.
		await page.getByRole('button', { name: 'Submit', exact: true }).click();
		await expect(page.getByTestId('score')).toHaveText('2');
	});

	test.describe('on a touch screen', () => {
		test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

		test('tapping toggles regions, a tap past the cap is refused, Clear answer clears them all', async ({ page }) => {
			const root = await openFixture(page, 'hotspot-multiple');
			const host = root.locator('pie-qti-hotspot');
			const [sun, tree, star] = regions(host);

			await sun.tap();
			await star.tap();
			await expect(sun).toHaveAttribute('aria-pressed', 'true');
			await expect(star).toHaveAttribute('aria-pressed', 'true');
			await expect(page.getByTestId('response')).toHaveText('["SUN","STAR"]');

			await tree.tap();
			await expect(tree).toHaveAttribute('aria-pressed', 'false');
			await expect(host.locator('.qti-hotspot-live-region')).toHaveText(LIMIT);

			// Tapping a selected region again deselects it.
			await sun.tap();
			await expect(sun).toHaveAttribute('aria-pressed', 'false');
			await expect(page.getByTestId('response')).toHaveText('["STAR"]');

			await host.getByRole('button', { name: 'Clear answer', exact: true }).tap();
			await expect(star).toHaveAttribute('aria-pressed', 'false');
			await expect(page.getByTestId('response')).toHaveText('[]');
			await expect(host.getByRole('button', { name: 'Clear answer', exact: true })).toHaveCount(0);
		});
	});
});

/**
 * The default shape is the whole image, drawn beneath the other regions: a click on another
 * region stays that region's, a click anywhere else is the default region's. Keyboard order and
 * naming are those of any region.
 */
test.describe('hotspot default shape', () => {
	test('the whole-image region lies beneath the others and is reached by keyboard in its place', async ({ page }) => {
		const root = await openFixture(page, 'hotspot-default');
		const host = root.locator('pie-qti-hotspot');
		const group = host.getByRole('radiogroup');
		const [lake, island, elsewhere] = ['Lake', 'Island', 'Somewhere else'].map((name) =>
			group.getByRole('radio', { name, exact: true }),
		);
		await expect(group.getByRole('radio')).toHaveCount(3);
		const image = host.locator('[part="image"]');
		const click = async (x: number, y: number) => {
			const point = await imagePoint(image, { width: 400, height: 200 }, x, y);
			await page.mouse.click(point.x, point.y);
		};

		await click(100, 90);
		await expect(lake).toHaveAttribute('aria-checked', 'true');
		await expect(elsewhere).toHaveAttribute('aria-checked', 'false');
		await click(300, 100);
		await expect(island).toHaveAttribute('aria-checked', 'true');
		await click(380, 20);
		await expect(elsewhere).toHaveAttribute('aria-checked', 'true');
		await expect(page.getByTestId('response')).toHaveText('"ELSEWHERE"');

		// In the radio group it is the third region, as authored: the arrow keys wrap past it.
		await elsewhere.focus();
		await page.keyboard.press('ArrowRight');
		await expect(lake).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(elsewhere).toBeFocused();
		await expect(elsewhere).toHaveAttribute('aria-checked', 'true');
		expect((await scan(page, 'pie-qti-hotspot')).violations).toEqual([]);
	});
});

/**
 * Graphic order (QTI 3.0 §5.61: "The delivery engine must clearly indicate all defined area(s)
 * of the image"): every area outlined on the image, with its place in the order.
 */
test.describe('graphic order shows its areas on the image', () => {
	function areaBadges(host: Locator) {
		return host.locator('svg[part="overlay"] .qti-go-area').evaluateAll((areas) =>
			areas.map((area) => area.querySelector('.qti-go-badge')?.textContent?.trim() ?? ''),
		);
	}

	test('each area carries its place in the order, following the list', async ({ page }) => {
		const root = await openFixture(page, 'graphic-order-areas');
		const host = root.locator('pie-qti-graphic-order');
		await expect(host.locator('svg[part="overlay"] .qti-go-area')).toHaveCount(3);
		// Areas in hotspotChoice order (Granite, Sandstone, Shale), numbered as the list orders them.
		expect(await areaBadges(host)).toEqual(['1', '2', '3']);

		await host.getByRole('button', { name: 'Move Sandstone earlier', exact: true }).click();
		await expect.poll(() => areaBadges(host)).toEqual(['2', '1', '3']);
		expect((await scan(page, 'pie-qti-graphic-order')).violations).toEqual([]);
	});

	test.describe('on a small touch screen', () => {
		test.use({ hasTouch: true, viewport: { width: 320, height: 720 } });

		test('the overlay scales with the image and leaves the ordering controls their taps', async ({ page }) => {
			const root = await openFixture(page, 'graphic-order-areas');
			const host = root.locator('pie-qti-graphic-order');
			const image = host.locator('[part="image"]');
			const overlay = host.locator('svg[part="overlay"]');
			const [imageBox, overlayBox] = await Promise.all([image.boundingBox(), overlay.boundingBox()]);
			expect(imageBox && overlayBox).toBeTruthy();
			// The image is scaled down from its 400 px, and the overlay covers exactly the image.
			expect(imageBox!.width).toBeLessThan(400);
			for (const key of ['x', 'y', 'width', 'height'] as const) {
				expect(Math.abs(overlayBox![key] - imageBox![key])).toBeLessThanOrEqual(1);
			}
			await expect(overlay).toHaveCSS('pointer-events', 'none');

			await host.getByRole('button', { name: 'Move Shale earlier', exact: true }).tap();
			await expect.poll(() => areaBadges(host)).toEqual(['1', '3', '2']);
		});
	});
});

/**
 * Reflow (WCAG 1.4.10): at 320 CSS px the ordering list's labels wrap instead of
 * truncating, nothing overflows the viewport, and the move controls keep working.
 */
test.describe('graphic order list reflows at 320 px', () => {
	test.use({ hasTouch: true, viewport: { width: 320, height: 720 } });

	test('long labels wrap with no loss of content or function', async ({ page }) => {
		const root = await openFixture(page, 'graphic-order-long-labels');
		const host = root.locator('pie-qti-graphic-order');

		// Every label is fully visible: no clipping (scrollWidth past clientWidth)
		// and no one-line squeeze (the text spans at least two rendered lines).
		const texts = host.locator('[part="text"]');
		await expect(texts).toHaveCount(3);
		const labels = host.locator('[part="list"] [role="listitem"]');
		await expect(labels).toHaveCount(3);
		for (let index = 0; index < 3; index++) {
			const item = labels.nth(index);
			const measurements = await item.locator('[part="item"]').evaluate((element) => {
				const text = element.querySelector('[part="text"]')!;
				const range = document.createRange();
				range.selectNodeContents(text);
				const lines = range.getClientRects().length;
				return {
					scrollWidth: text.scrollWidth,
					clientWidth: text.clientWidth,
					lines,
				};
			});
			expect(measurements.scrollWidth, `label ${index + 1} clips horizontally`).toBeLessThanOrEqual(measurements.clientWidth + 1);
			expect(measurements.lines, `label ${index + 1} renders on a single squeezed line`).toBeGreaterThanOrEqual(2);
		}
		// No horizontal overflow anywhere in the interaction.
		const overflow = await host.evaluate((element) => element.scrollWidth - element.clientWidth);
		expect(overflow).toBeLessThanOrEqual(1);

		// The list keeps its function: the move controls reorder, and the areas follow.
		await host.getByRole('button', { name: 'Move Shale layer, dark and thinly bedded with fossil impressions earlier', exact: true }).tap();
		// Shale moved before Sandstone: the areas' badges follow the list, in choice order.
		await expect
			.poll(() =>
				host.locator('svg[part="overlay"] .qti-go-area').evaluateAll((areas) =>
					areas.map((area) => area.querySelector('.qti-go-badge')?.textContent?.trim() ?? ''),
				),
			)
			.toEqual(['1', '3', '2']);
	});
});

/**
 * Graphic gap match: a whole-image (`default`) hotspot listed last must not take the
 * clicks and drops of the hotspots it covers — its zone lies beneath the others, like the
 * hotspot interaction's default region.
 */
test.describe('graphic gap match default shape lies beneath the others', () => {
	test('a click on the lake places the held label on the lake, not the whole-image zone', async ({ page }) => {
		const root = await openFixture(page, 'graphic-gap-match-default');
		const host = root.locator('pie-qti-graphic-gap-match');
		const image = host.locator('[part="image"]');

		// Pick the label up (the click-to-place flow), then click inside the lake's area.
		await host.locator('[part="labels"]').getByRole('button', { name: 'Rain' }).click();
		const point = await imagePoint(image, { width: 400, height: 200 }, 100, 100);
		await page.mouse.click(point.x, point.y);
		await expect(page.getByTestId('response')).toHaveText('["RAIN LAKE"]');
	});

	test('a click outside every other hotspot fills the whole-image zone', async ({ page }) => {
		const root = await openFixture(page, 'graphic-gap-match-default');
		const host = root.locator('pie-qti-graphic-gap-match');
		const image = host.locator('[part="image"]');

		await host.locator('[part="labels"]').getByRole('button', { name: 'Rain' }).click();
		const point = await imagePoint(image, { width: 400, height: 200 }, 340, 170);
		await page.mouse.click(point.x, point.y);
		await expect(page.getByTestId('response')).toHaveText('["RAIN ALL"]');
	});
});

/**
 * Graphic associate: pointer input hits the hotspot's real shape (QTI 3.0 §5.7.5–5.7.6), drawn
 * inside its button, never the rest of the button's bounding box; the buttons stay the keyboard
 * and assistive-technology controls.
 */
test.describe('graphic associate pointer hit areas are the hotspot shapes', () => {
	for (const input of ['mouse', 'touch'] as const) {
		test.describe(input, () => {
			test.use({ hasTouch: input === 'touch', viewport: { width: input === 'touch' ? 390 : 1280, height: 900 } });

			test("a press inside a polygon's bounding box but outside the polygon does not select it", async ({ page }) => {
				const root = await openFixture(page, 'graphic-associate-polygon');
				const host = root.locator('pie-qti-graphic-associate');
				const mountain = host.getByRole('button', { name: /^Mountain/ });
				const image = host.locator('[part="image"]');
				const press = async (x: number, y: number) => {
					const point = await imagePoint(image, { width: 400, height: 240 }, x, y);
					if (input === 'touch') await page.touchscreen.tap(point.x, point.y);
					else await page.mouse.click(point.x, point.y);
				};

				// Inside the triangle's bounding box (40–360 × 20–200), outside the triangle.
				await press(60, 40);
				await expect(mountain).toHaveAttribute('aria-pressed', 'false');
				// Inside the triangle.
				await press(200, 150);
				await expect(mountain).toHaveAttribute('aria-pressed', 'true');
				// The sun completes the association.
				await press(360, 40);
				await expect(page.getByTestId('response')).toHaveText('["MOUNTAIN SUN"]');
			});
		});
	}

	test('a pointer press on a button activates it: its centre is on its shape', async ({ page }) => {
		const root = await openFixture(page, 'graphic-associate-polygon');
		const host = root.locator('pie-qti-graphic-associate');
		// Playwright clicks the centre of each button, and checks the button receives the click.
		await host.getByRole('button', { name: /^Mountain/ }).click();
		await host.getByRole('button', { name: /^Sun/ }).click();
		await expect(page.getByTestId('response')).toHaveText('["MOUNTAIN SUN"]');
	});

	test('the buttons keep keyboard operation and their focus indicator', async ({ page }) => {
		const root = await openFixture(page, 'graphic-associate-polygon');
		const host = root.locator('pie-qti-graphic-associate');
		const mountain = host.getByRole('button', { name: /^Mountain/ });
		const sun = host.getByRole('button', { name: /^Sun/ });

		await mountain.focus();
		await page.keyboard.press('Enter');
		await expect(mountain).toHaveAttribute('aria-pressed', 'true');
		expect(await mountain.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
		await expect(mountain).toHaveCSS('outline-style', 'solid');
		await page.keyboard.press('Tab');
		await expect(sun).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('response')).toHaveText('["MOUNTAIN SUN"]');
		expect((await scan(page, 'pie-qti-graphic-associate')).violations).toEqual([]);
	});
});
