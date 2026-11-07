import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { A11Y_REGRESSION_FIXTURES } from '../../src/routes/fixtures/a11y-regression/items';

/**
 * Accessibility regressions that axe cannot catch (it sees rendered names and contrast
 * only in their initial state, and nothing about focus behavior or dialog mechanics):
 *
 *  - QTI identifiers must never reach an accessible name (many of ours give the answer
 *    away — `CHOICE_A_MARS_IS_THE_PLANET_CORRECT`);
 *  - authored image alternatives must reach the rendered graphic-interaction images and
 *    gapImg tiles; author-marked decorative images must render alt="";
 *  - image-only and MathML-only choices must produce content-derived names, not "Item";
 *  - state-dependent text (selection limits, validation errors) keeps 4.5:1; empty
 *    blanks and gap boundaries keep the 3:1 non-text minimum;
 *  - keyboard focus shows on custom-drawn controls (SVG hotspot regions, hidden-input
 *    choice rows) with a 3:1 indicator;
 *  - modal feedback and the math-input dialog trap focus, close on Escape and restore it.
 *
 * Every test is tagged @cross-browser: this file is also the WebKit/Firefox regression set.
 */

const CROSS_BROWSER = { tag: '@cross-browser' };

/**
 * The key that moves keyboard focus to the next control. Safari on macOS skips buttons,
 * radios and checkboxes on Tab unless "Press Tab to highlight each item" is enabled (the
 * default is off), and Option+Tab is that platform's all-controls key; WebKit on Linux
 * (CI), Chromium and Firefox move through every control on Tab.
 */
function nextControlKey(browserName: string): string {
	return browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
}

const fixture = (item: string) => `/fixtures/a11y-regression/?item=${item}`;

async function openFixture(page: Page, item: string): Promise<Locator> {
	await page.goto(fixture(item));
	const root = page.getByTestId('a11y-regression-root');
	await expect(root.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });
	await expect(root.locator('.alert-error')).toHaveCount(0);
	return root;
}

/** Contrast ratio of two CSS colors as the page renders them, any color syntax included. */
async function contrast(page: Page, foreground: string, background: string): Promise<number> {
	return page.evaluate(
		([fg, bg]) => {
			// The canvas normalizes every CSS color syntax (oklch, color(), named…) to sRGB.
			const canvas = document.createElement('canvas');
			canvas.width = 1;
			canvas.height = 1;
			const context = canvas.getContext('2d') as CanvasRenderingContext2D;
			const rgb = (color: string) => {
				context.clearRect(0, 0, 1, 1);
				context.fillStyle = '#fff';
				context.fillRect(0, 0, 1, 1);
				context.fillStyle = color;
				context.fillRect(0, 0, 1, 1);
				return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
			};
			const luminance = (color: string) => {
				const [r, g, b] = rgb(color).map((channel) => {
					const c = channel / 255;
					return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
				});
				return 0.2126 * r + 0.7152 * g + 0.0722 * b;
			};
			const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
			return (light + 0.05) / (dark + 0.05);
		},
		[foreground, background] as const,
	);
}

/** The nearest opaque background behind an element, walking out through shadow roots. */
async function effectiveBackground(locator: Locator): Promise<string> {
	return locator.evaluate((element: Element) => {
		let node: Element | null = element;
		while (node) {
			const background = getComputedStyle(node).backgroundColor;
			if (background && !/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(background) && background !== 'transparent') {
				return background;
			}
			const parent: Element | null = node.parentElement;
			if (parent) {
				node = parent;
				continue;
			}
			const owner = node.getRootNode();
			node = owner instanceof ShadowRoot ? owner.host : null;
		}
		return 'rgb(255, 255, 255)';
	});
}

/**
 * Everything a screen reader can speak that the aria snapshot may not show, gathered
 * through every shadow root: naming and description attributes (aria-label,
 * aria-description, aria-placeholder, aria-valuetext, title), visually hidden text, and
 * live-region content (announcements such as "Placed the Seine in blank 1 of 2").
 */
async function perceivedText(root: Locator): Promise<string> {
	return root.evaluate((element) => {
		const texts: string[] = [];
		const walk = (scope: Element | ShadowRoot) => {
			for (const el of scope.querySelectorAll<HTMLElement>('*')) {
				for (const attribute of ['aria-label', 'aria-description', 'aria-placeholder', 'aria-valuetext', 'title']) {
					const value = el.getAttribute(attribute);
					if (value) texts.push(value);
				}
				const announces =
					el.hasAttribute('aria-live') || ['status', 'alert', 'log'].includes(el.getAttribute('role') ?? '');
				if (announces || el.classList.contains('sr-only') || /sr-only/.test(el.className)) {
					texts.push(el.textContent ?? '');
				}
				if (el.shadowRoot) walk(el.shadowRoot);
			}
		};
		walk(element);
		return texts.join(' \n ');
	});
}

/** Every leaky identifier really is in the fixture XML — the scans below are not vacuous. */
const LEAKY_IDENTIFIERS = [
	'CHOICE_CORRECT_MARS_IS_PLANET',
	'CHOICE_A_MARS_IS_THE_PLANET_CORRECT',
	'TEXT_ENTRY_CAPITAL_IS_PARIS',
	'INLINE_CHOICE_CONTINENT_IS_EUROPE',
	'INLINE_CHOICE_EUROPE_CORRECT_ANSWER',
	'GAP_MATCH_SEINE_IN_PARIS',
	'GAP_TEXT_SEINE_FLOWS_THROUGH_PARIS',
	'GAP_RIVER_PARIS_IS_THE_SEINE',
	'ORDER_FIRST_STEP_IS_MEASURE_CORRECT',
	'ORDER_STEP1_MEASURE_FIRST_CORRECT',
	'MATCH_PAIR_EIFFEL_TOWER_PARIS_CORRECT',
	'MATCH_LANDMARK_EIFFEL_TOWER_GOES_PARIS',
	'ASSOCIATE_FIRST_PAIR_SEINE_PARIS_CORRECT',
	'ASSOCIATE_SEINE_BELONGS_PARIS_CORRECT',
	'HOTSPOT_LEAKY_CIRCLE_IS_STOP_SIGN_CORRECT',
	'HOTSPOT_C_OCTAGON_STOP_SIGN_CORRECT',
	'GRAPHIC_ORDER_TOP_LAYER_FIRST_IS_CORRECT',
	'GRAPHIC_ORDER_SANDSTONE_IS_FIRST_CORRECT',
	'GRAPHIC_ORDER_SHALE_IS_SECOND_CORRECT',
	'GRAPHIC_ORDER_GRANITE_IS_LAST_CORRECT',
];

test.describe('no QTI identifiers in accessible names', () => {
	test('the fixture identifiers are in the item XML but absent from the accessibility tree', CROSS_BROWSER, async ({
		page,
	}) => {
		// Sanity: the fixture really is leaky, so the absence assertions mean something.
		const xml = A11Y_REGRESSION_FIXTURES['leaky-names'];
		for (const identifier of LEAKY_IDENTIFIERS) {
			expect(xml).toContain(identifier);
		}

		const root = await openFixture(page, 'leaky-names');
		const snapshot = await root.ariaSnapshot();
		for (const identifier of LEAKY_IDENTIFIERS) {
			expect(snapshot, `aria snapshot leaked ${identifier}`).not.toContain(identifier);
		}
	});

	test('choice, inline blanks and hotspot regions are named by content, never by identifier', CROSS_BROWSER, async ({
		page,
	}) => {
		const root = await openFixture(page, 'leaky-names');

		// Choice: each radio is named by its rendered text; the group by its prompt.
		const choice = root.locator('pie-qti-choice');
		for (const label of ['Mars', 'Venus', 'The Moon']) {
			await expect(choice.getByRole('radio', { name: label, exact: true })).toHaveCount(1);
		}
		await expect(choice.getByRole('group', { name: /Which of these is a planet/ })).toHaveCount(1);

		// Inline blanks: positional names, the sentence as description, option text only.
		const blanks = root.locator('p.blanks');
		await expect(blanks.locator('input')).toHaveAccessibleName('Blank 1 of 2');
		await expect(blanks.locator('select')).toHaveAccessibleName('Blank 2 of 2');
		await expect(blanks.locator('input')).toHaveAccessibleDescription(/The capital of France is/);
		const options = await blanks.locator('select option').allTextContents();
		expect(options.join(' ')).not.toMatch(/INLINE_CHOICE_/);

		// Hotspot regions: the authored hotspot labels.
		const hotspot = root.locator('pie-qti-hotspot');
		for (const label of ['Circle', 'Square', 'Octagon']) {
			await expect(hotspot.getByRole('button', { name: label, exact: true })).toHaveCount(1);
		}
	});

	test('gap match, order, match, associate and graphic-order controls are named by content, never by identifier', CROSS_BROWSER, async ({
		page,
	}) => {
		const root = await openFixture(page, 'leaky-names');

		// Gap match: palette words by their text, gaps by position.
		const gapMatch = root.locator('pie-qti-gap-match');
		await expect(gapMatch.getByRole('button', { name: 'the Seine', exact: true })).toHaveCount(1);
		await expect(gapMatch.getByRole('button', { name: 'the Tamis', exact: true })).toHaveCount(1);
		const gaps = gapMatch.locator('[part="gap"]');
		await expect(gaps).toHaveCount(2);
		await expect(gaps.nth(0)).toHaveAccessibleName(/^Blank 1 of 2/);
		await expect(gaps.nth(1)).toHaveAccessibleName(/^Blank 2 of 2/);

		// Order: each item by its rendered text (move buttons name the item too).
		const order = root.locator('pie-qti-order');
		for (const label of ['Measure', 'Cut', 'Sew']) {
			await expect(order.getByRole('button', { name: label, exact: true })).toHaveCount(1);
		}
		await expect(order.getByRole('button', { name: 'Move Measure later' })).toHaveCount(1);

		// Match: the source choices by their text.
		const match = root.locator('pie-qti-match');
		for (const label of ['Eiffel Tower', 'Sagrada Familia']) {
			await expect(match.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
		}

		// Associate: every choice by its text.
		const associate = root.locator('pie-qti-associate');
		for (const label of ['the Seine', 'the Manzanares', 'the Volga']) {
			await expect(associate.getByRole('button', { name: label, exact: true })).toHaveCount(1);
		}

		// Graphic order: each region by its authored hotspot label — never its
		// identifier, which reveals the correct order.
		const graphicOrder = root.locator('pie-qti-graphic-order');
		for (const label of ['Sandstone', 'Shale', 'Granite']) {
			await expect(graphicOrder.getByRole('button', { name: label, exact: true })).toHaveCount(1);
		}
	});

	test('no naming attribute anywhere in the rendered item leaks an identifier', CROSS_BROWSER, async ({ page }) => {
		const root = await openFixture(page, 'leaky-names');
		const perceived = await perceivedText(root);
		for (const identifier of LEAKY_IDENTIFIERS) {
			expect(perceived, `naming attribute leaked ${identifier}`).not.toContain(identifier);
		}
	});

	test('names and announcements stay identifier-free after the candidate answers every interaction', CROSS_BROWSER, async ({
		page,
	}) => {
		// Names are recomputed from state ("Blank 1 of 2, filled with …", "Remove association
		// between …", move-button and live-region text): a static scan of the initial render
		// cannot see them, so answer everything first.
		const root = await openFixture(page, 'leaky-names');

		await root.locator('pie-qti-choice').getByRole('radio', { name: 'Mars', exact: true }).check();
		const blanks = root.locator('p.blanks');
		await blanks.locator('input').fill('Paris');
		await blanks.locator('select').selectOption({ label: 'Europe' });

		const gapMatch = root.locator('pie-qti-gap-match');
		await gapMatch.getByRole('button', { name: 'the Seine', exact: true }).click();
		await gapMatch.locator('[part="gap"]').first().click();
		await expect(gapMatch.locator('[part="gap"]').first()).toHaveAccessibleName(/^Blank 1 of 2, filled with the Seine/);

		const order = root.locator('pie-qti-order');
		await order.getByRole('button', { name: 'Move Measure later' }).click();

		const match = root.locator('pie-qti-match');
		await match.getByRole('button', { name: 'Eiffel Tower', exact: true }).click();
		await match.getByRole('button', { name: 'Paris', exact: true }).click();

		const associate = root.locator('pie-qti-associate');
		await associate.getByRole('button', { name: 'the Seine', exact: true }).click();
		await associate.getByRole('button', { name: 'the Manzanares', exact: true }).click();
		// A pair is unordered: the list may show it either way round.
		await expect(
			associate.getByRole('button', {
				name: /^Remove association between (the Seine and the Manzanares|the Manzanares and the Seine)$/,
			}),
		).toHaveCount(1);

		await root.locator('pie-qti-hotspot').getByRole('button', { name: 'Octagon', exact: true }).click();
		await root.locator('pie-qti-graphic-order').getByRole('button', { name: 'Move Sandstone later' }).click();

		// Every interaction really changed state, and announced it by content.
		await expect(root.locator('pie-qti-choice').getByRole('radio', { name: 'Mars', exact: true })).toBeChecked();
		await expect(root.locator('pie-qti-hotspot').getByRole('button', { name: 'Octagon', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await expect.poll(() => perceivedText(root)).toContain('Eiffel Tower matched with Paris.');
		const perceived = await perceivedText(root);
		expect(perceived).toContain('Placed the Seine in blank 1 of 2.');
		expect(perceived).toContain('Measure moved to position 2 of 3');
		expect(perceived).toContain('Sandstone moved to position 2 of 3');

		const snapshot = await root.ariaSnapshot();
		for (const identifier of LEAKY_IDENTIFIERS) {
			expect(snapshot, `aria snapshot leaked ${identifier} after answering`).not.toContain(identifier);
			expect(perceived, `naming attribute or announcement leaked ${identifier} after answering`).not.toContain(
				identifier,
			);
		}
	});
});

test.describe('graphic image alternatives', () => {
	/**
	 * The rendered alternative of a graphic interaction's response image, however it is
	 * drawn: a raster `<img>` (its `alt`) or inline SVG in a `role="img"` wrapper (its
	 * `aria-label`). Images inside buttons are draggable tiles, not the response image.
	 */
	async function imageAlternative(host: Locator): Promise<string | null> {
		return host.evaluate((element: Element) => {
			const scope = element.shadowRoot ?? element;
			for (const selector of ['img[part="image"]', '[part="image"][role="img"]', '[role="img"]', 'img']) {
				const image = Array.from(scope.querySelectorAll(selector)).find((node) => !node.closest('button'));
				if (image) return image.tagName === 'IMG' ? image.getAttribute('alt') : image.getAttribute('aria-label');
			}
			return null;
		});
	}

	test('authored alternatives reach every rendered graphic-interaction image and gapImg tile', CROSS_BROWSER, async ({
		page,
	}) => {
		await openFixture(page, 'image-alternatives');

		const expected: Array<[string, string]> = [
			['pie-qti-hotspot', 'Hotspot response panel with three shapes'],
			['pie-qti-select-point', 'Number line from zero to ten'],
			['pie-qti-graphic-order', 'Graphic order strata panel'],
			['pie-qti-graphic-associate', 'Graphic associate pairing panel'],
			['pie-qti-graphic-gap-match', 'Graphic gap match drop zones'],
			['pie-qti-position-object', 'Position object placement board'],
			['pie-qti-drawing', 'Drawing canvas'],
		];
		for (const [host, alternative] of expected) {
			// Custom elements upgrade and render asynchronously: poll until the image is drawn.
			await expect
				.poll(() => imageAlternative(page.locator(host)), { message: `${host} image alternative` })
				.toBe(alternative);
		}

		// The gapImg tile is named by its authored alternative; its inner img either repeats
		// that alternative or is empty (the button carries the name) — never an identifier.
		const tile = page.locator('pie-qti-graphic-gap-match').getByRole('button', { name: 'Compass star tile' });
		await expect(tile).toHaveCount(1);
		expect(['', 'Compass star tile']).toContain(await tile.locator('img').getAttribute('alt'));

		// The position-object marker is named by its authored alternative.
		await expect(
			page.locator('pie-qti-position-object').getByRole('button', { name: /Placement marker/ }).first(),
		).toBeVisible();
	});

	test('an author-marked decorative image renders alt="", an <object> fallback text becomes the alt', CROSS_BROWSER, async ({
		page,
	}) => {
		await openFixture(page, 'decorative-image');
		const hotspots = page.locator('pie-qti-hotspot');
		await expect(hotspots).toHaveCount(2);

		// <img alt="">: decorative, kept out of the accessibility tree.
		await expect.poll(() => imageAlternative(hotspots.nth(0))).toBe('');

		// QTI 2.x <object data="…">fallback</object>: the fallback text is the alternative.
		await expect
			.poll(() => imageAlternative(hotspots.nth(1)))
			.toBe('Cross-section of four sedimentary rock layers');
		await expect(
			hotspots.nth(1).getByRole('img', { name: 'Cross-section of four sedimentary rock layers' }),
		).toHaveCount(1);
	});
});

test.describe('rich content choice names', () => {
	test('image-only and MathML choices produce content-derived names, never "Item"', CROSS_BROWSER, async ({
		page,
	}) => {
		const root = await openFixture(page, 'rich-choices');

		// Order: the image-only choice is named by its img alt.
		const order = root.locator('pie-qti-order');
		await expect(order.getByRole('button', { name: 'Red star marker', exact: true })).toHaveCount(1);

		// Order/match: MathML-only choices are named by their math content.
		const items = order.locator('button.qti-sortable-item');
		await expect(items).toHaveCount(3);
		await expect(items.nth(1)).toHaveAccessibleName(/x\s*\+\s*1/);
		await expect(items.nth(2)).toHaveAccessibleName(/3\s*\/?\s*4/);
		const match = root.locator('pie-qti-match');
		const sources = match.locator('button.qti-match-source');
		await expect(sources).toHaveCount(2);
		await expect(sources.nth(0)).toHaveAccessibleName(/1\s*\/?\s*2/);
		await expect(sources.nth(1)).toHaveAccessibleName(/1\s*\/?\s*4/);

		// Associate: image-only choices are named by their authored alts.
		const associate = root.locator('pie-qti-associate');
		await expect(associate.getByRole('button', { name: 'Gold star', exact: true })).toHaveCount(1);
		await expect(associate.getByRole('button', { name: 'Red star', exact: true })).toHaveCount(1);

		// No rendered name degenerates to the generic "Item" or an identifier.
		const snapshot = await root.ariaSnapshot();
		expect(snapshot).not.toMatch(/"Item( \d+)?"/);
		expect(snapshot).not.toMatch(/ORDER_RICH_|MATCH_RICH_|ASSOCIATE_RICH_/);
	});
});

test.describe('state-dependent contrast', () => {
	test('the selection-limit message keeps 4.5:1 text contrast', CROSS_BROWSER, async ({ page }) => {
		const root = await openFixture(page, 'validation-contrast');
		const choice = root.locator('pie-qti-choice');
		await choice.getByRole('radio', { name: 'Red', exact: true }).check();

		const message = choice.getByRole('alert');
		await expect(message).toContainText('Only one color can be picked.');
		const style = await message.evaluate((element: Element) => {
			const computed = getComputedStyle(element);
			return { color: computed.color, fontSize: Number.parseFloat(computed.fontSize) };
		});
		expect(style.fontSize).toBeGreaterThanOrEqual(14);
		expect(await contrast(page, style.color, await effectiveBackground(message))).toBeGreaterThanOrEqual(4.5);
	});

	test('the text-entry validation error keeps 4.5:1 text contrast', CROSS_BROWSER, async ({ page }) => {
		const root = await openFixture(page, 'validation-contrast');
		const date = root.locator('p.dated input');
		await date.fill('2024');
		await date.blur();

		const alert = root.locator('p.dated [role="alert"]');
		await expect(alert).toBeVisible();
		await expect(date).toHaveAttribute('aria-invalid', 'true');
		const style = await alert.evaluate((element: Element) => {
			const computed = getComputedStyle(element);
			return { color: computed.color, fontSize: Number.parseFloat(computed.fontSize) };
		});
		expect(style.fontSize).toBeGreaterThanOrEqual(14);
		expect(await contrast(page, style.color, await effectiveBackground(alert))).toBeGreaterThanOrEqual(4.5);
	});

	test('empty blanks and gap targets keep a 3:1 non-text boundary', CROSS_BROWSER, async ({ page }) => {
		const root = await openFixture(page, 'validation-contrast');

		for (const control of [root.locator('p.dated input'), root.locator('pie-qti-gap-match [part="gap"]').first()]) {
			const border = await control.evaluate((element: Element) => getComputedStyle(element).borderTopColor);
			const ratio = await contrast(page, border, await effectiveBackground(control));
			expect(ratio, `boundary contrast of ${await control.evaluate((element) => element.outerHTML.slice(0, 60))}`).toBeGreaterThanOrEqual(3);
		}
	});
});

test.describe('keyboard focus visibility', () => {
	/**
	 * Move focus by keyboard from the fixture's known start point until the deepest focused
	 * element (looking through shadow roots — `document.activeElement` is retargeted to the
	 * host) matches `selector`. The target must already be rendered: custom elements upgrade
	 * asynchronously, and Tab skips a control that is not drawn yet.
	 */
	async function tabTo(page: Page, browserName: string, selector: string, maxStops = 80): Promise<void> {
		const key = nextControlKey(browserName);
		await page.getByTestId('a11y-focus-start').focus();
		for (let stop = 0; stop < maxStops; stop += 1) {
			await page.keyboard.press(key);
			const reached = await page.evaluate((target) => {
				let active: Element | null = document.activeElement;
				while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
				return active?.matches(target) ?? false;
			}, selector);
			if (reached) return;
		}
		throw new Error(`focus never reached ${selector} by keyboard (${key})`);
	}

	test('an SVG hotspot region shows a 3:1 focus indicator when reached by keyboard', CROSS_BROWSER, async ({
		page,
		browserName,
	}) => {
		await openFixture(page, 'leaky-names');
		const shape = page.locator('pie-qti-hotspot .qti-hotspot-shape').first();
		await expect(shape).toBeVisible();
		await expect(page.locator('pie-qti-choice input[type="radio"]').first()).toBeAttached();
		await tabTo(page, browserName, '.qti-hotspot-shape');

		await expect(shape).toBeFocused();
		const focused = await shape.evaluate((element: Element) => {
			const computed = getComputedStyle(element);
			return {
				isFocusVisible: element.matches(':focus-visible'),
				stroke: computed.stroke,
				strokeWidth: Number.parseFloat(computed.strokeWidth),
			};
		});
		expect(focused.isFocusVisible).toBe(true);
		expect(focused.stroke).not.toBe('none');
		expect(focused.strokeWidth).toBeGreaterThanOrEqual(2);
		// The ring straddles the region's edge: inside is the drawn shape's fill (#e5e7eb in
		// the fixture image), outside the white panel. It must stand out against both.
		for (const adjacent of ['#ffffff', '#e5e7eb']) {
			expect(await contrast(page, focused.stroke, adjacent), `focus ring vs ${adjacent}`).toBeGreaterThanOrEqual(3);
		}
	});

	test('a hidden-input choice row shows a 3:1 outline when its radio is reached by keyboard', CROSS_BROWSER, async ({
		page,
		browserName,
	}) => {
		await openFixture(page, 'leaky-names');
		const radio = page.locator('pie-qti-choice input[type="radio"]').first();
		await expect(radio).toBeAttached();
		await tabTo(page, browserName, 'input[type="radio"]');
		await expect(radio).toBeFocused();

		const row = page.locator('pie-qti-choice label[part="label"]').first();
		const indicator = await row.evaluate((element: Element) => {
			const computed = getComputedStyle(element);
			return {
				outlineStyle: computed.outlineStyle,
				outlineWidth: Number.parseFloat(computed.outlineWidth),
				outlineColor: computed.outlineColor,
			};
		});
		expect(indicator.outlineStyle).toBe('solid');
		expect(indicator.outlineWidth).toBeGreaterThanOrEqual(2);
		expect(await contrast(page, indicator.outlineColor, await effectiveBackground(row))).toBeGreaterThanOrEqual(3);
	});
});

test.describe('modal semantics', () => {
	/**
	 * Where keyboard focus is relative to an open dialog: inside it, on the browser chrome
	 * (a native modal lets Tab reach the browser UI, reported as the body), or on a control
	 * in the page behind — the one place a modal must never let it go.
	 */
	async function focusRelativeTo(dialog: Locator): Promise<'dialog' | 'chrome' | 'background'> {
		return dialog.evaluate((element) => {
			let active: Element | null = document.activeElement;
			while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
			if (!active || active === document.body || active === document.documentElement) return 'chrome';
			// Composed containment: focus inside a shadow root (a math-field's internals)
			// counts as inside the dialog that hosts it.
			for (let node: Node | null = active; node; ) {
				if (node === element) return 'dialog';
				const parent: Node | null = node.parentNode;
				node = parent instanceof ShadowRoot ? parent.host : parent;
			}
			return 'background';
		});
	}

	test('modal feedback traps focus, closes on Escape and restores focus to the submitter', CROSS_BROWSER, async ({
		page,
		browserName,
	}) => {
		const root = await openFixture(page, 'modal-feedback');
		await root.locator('pie-qti-choice input[type="radio"]').nth(1).check();
		const submit = page.getByRole('button', { name: 'Submit', exact: true });
		await submit.focus();
		await page.keyboard.press('Enter');

		const dialog = page.getByRole('dialog', { name: 'Not yet' });
		await expect(dialog).toBeVisible();
		expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
		await expect(dialog.getByRole('heading', { name: 'Not yet' })).toBeFocused();

		// Keyboard navigation cycles through the dialog's controls and never lands on the
		// page behind it (a native modal may pass through the browser chrome on the way),
		// in both directions.
		const key = nextControlKey(browserName);
		const backKey = `Shift+${key}`;
		const visited: string[] = [];
		for (const [press, pressed] of [key, key, key, key, key, key, backKey, backKey, backKey, backKey].entries()) {
			await page.keyboard.press(pressed);
			const where = await focusRelativeTo(dialog);
			visited.push(where);
			expect(where, `${pressed} (press ${press + 1}) moved focus to the page behind the modal`).not.toBe('background');
		}
		expect(visited.filter((where) => where === 'dialog').length).toBeGreaterThanOrEqual(5);

		// The page behind is inert: its controls cannot take focus even by script.
		const backgroundTookFocus = await page.evaluate(() => {
			(document.querySelector('[data-testid="a11y-focus-start"]') as HTMLElement).focus();
			return document.activeElement?.getAttribute('data-testid') === 'a11y-focus-start';
		});
		expect(backgroundTookFocus).toBe(false);

		// Escape closes it; focus returns to the control that submitted.
		await dialog.getByRole('heading', { name: 'Not yet' }).focus();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(submit).toBeFocused();
	});

	test('the math-input dialog is a named modal: focus moves in, Tab cycles, Escape restores focus', CROSS_BROWSER, async ({
		page,
		browserName,
	}) => {
		const root = await openFixture(page, 'math-editor');
		const opener = root.locator('pie-qti-extended-text').getByRole('button', { name: 'Insert inline math' });
		await opener.focus();
		await page.keyboard.press('Enter');

		const dialog = page.getByRole('dialog', { name: 'Insert inline math' });
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveAttribute('aria-modal', 'true');
		await expect(dialog).toHaveAccessibleDescription(/Press Escape to cancel/);
		const field = dialog.locator('math-field');
		await expect(field).toBeFocused();

		// Tab out of the math field is MathLive's own move (it handles Tab inside the field);
		// between the buttons it is the platform's next-control key. The walk visits the three
		// buttons, then wraps back to the field, never reaching the page behind the overlay.
		await page.keyboard.press('Tab');
		await expect(dialog.getByRole('button', { name: 'Math keyboard', exact: true })).toBeFocused();
		const key = nextControlKey(browserName);
		for (const name of ['Cancel', 'Insert']) {
			await page.keyboard.press(key);
			await expect(dialog.getByRole('button', { name, exact: true })).toBeFocused();
		}
		await page.keyboard.press(key);
		await expect(field).toBeFocused();
		expect(await focusRelativeTo(dialog)).toBe('dialog');

		// Escape cancels and returns focus to the toolbar button that opened the dialog.
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(opener).toBeFocused();
	});

	// Known product bug: Shift+Tab from the math field (the dialog's first control and its
	// initial focus) does not wrap to the last control. MathLive handles Shift+Tab itself
	// Regression: MathLive claims Shift+Tab itself, so the dialog's Tab trap deferred to it
	// and backward navigation was dead from the field. The dialog now listens for MathLive's
	// `move-out` event (fired when an arrow/Tab key has nowhere to go inside the field) and
	// wraps focus to the dialog's controls.
	test('the math-input dialog wraps Shift+Tab from the math field to the last control', CROSS_BROWSER, async ({
		page,
	}) => {
		const root = await openFixture(page, 'math-editor');
		const opener = root.locator('pie-qti-extended-text').getByRole('button', { name: 'Insert inline math' });
		await opener.focus();
		await page.keyboard.press('Enter');

		const dialog = page.getByRole('dialog', { name: 'Insert inline math' });
		await expect(dialog.locator('math-field')).toBeFocused();
		await page.keyboard.press('Shift+Tab');
		await expect(dialog.getByRole('button', { name: 'Insert', exact: true })).toBeFocused();
	});
});
