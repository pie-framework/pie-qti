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

		// The focus ring is drawn on the region outline.
		expect(await star.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
		await expect(star).toHaveCSS('stroke-width', '3px');
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

