import { expect, test, type Page } from './fixtures';

/**
 * Item rendering through the standalone ItemPlayer (`/fixtures/item-rendering`):
 *
 *  - every interaction renders where it was authored — between Part A and Part B text, before
 *    the text that follows it, inside layout columns and table cells — not after the body;
 *  - a paragraph with inline blanks is one paragraph, and the paragraphs around it stay apart;
 *  - inline blanks are named by position, never by their (answer-hinting) identifiers;
 *  - modal feedback is a real modal, and activating an end-attempt hint button submits without
 *    counting the attempt, re-rendering the body without remounting its interactions.
 *
 * The fixture mounts the player without an i18n provider, so every string must read as English.
 */

const fixture = (item: string) => `/fixtures/item-rendering/?item=${item}`;

async function openFixture(page: Page, item: string) {
	await page.goto(fixture(item));
	await expect(page.locator('.qti-item-body')).toBeVisible({ timeout: 40_000 });
}

/** Contrast ratio of two CSS colors as the page renders them, any color syntax included. */
async function contrast(page: Page, foreground: string, background: string): Promise<number> {
	return page.evaluate(
		([fg, bg]) => {
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
		[foreground, background] as const
	);
}

test.describe('item rendering order', () => {
	test('block interactions render at their authored positions, inside layout columns and table cells', async ({
		page,
	}) => {
		await openFixture(page, 'parts');
		await expect(page.locator('pie-qti-choice').first()).toBeVisible();

		const order = await page.evaluate(() => {
			const element = (selector: string) => document.querySelector(selector) as Element;
			const precedes = (a: string, b: string) =>
				Boolean(element(a).compareDocumentPosition(element(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
			const below = (a: string, b: string) =>
				element(b).getBoundingClientRect().top >= element(a).getBoundingClientRect().bottom - 1;
			return {
				partABeforeChoice: precedes('p.part-a', 'pie-qti-choice'),
				choiceBeforePartB: precedes('pie-qti-choice', 'p.part-b'),
				partBBeforeEssay: precedes('p.part-b', 'pie-qti-extended-text'),
				essayBeforeTextAfter: precedes('pie-qti-extended-text', 'p.after-b'),
				partBLaidOutBelowChoice: below('pie-qti-choice', 'p.part-b'),
				textAfterLaidOutBelowEssay: below('pie-qti-extended-text', 'p.after-b'),
				essayInLayoutColumn: Boolean(document.querySelector('.qti-layout-col6.right-column pie-qti-extended-text')),
				choiceInTableCell: Boolean(document.querySelector('td.answer-cell pie-qti-choice')),
				renderedAfterBody: document.querySelectorAll('.qti-item-body-unslotted').length,
			};
		});

		expect(order).toEqual({
			partABeforeChoice: true,
			choiceBeforePartB: true,
			partBBeforeEssay: true,
			essayBeforeTextAfter: true,
			partBLaidOutBelowChoice: true,
			textAfterLaidOutBelowEssay: true,
			essayInLayoutColumn: true,
			choiceInTableCell: true,
			renderedAfterBody: 0,
		});
	});

	test('a paragraph with inline blanks stays one paragraph; separate paragraphs stay separate', async ({
		page,
	}) => {
		await openFixture(page, 'parts');
		const blanks = page.locator('p.blanks');
		await expect(blanks.locator('input')).toHaveCount(2);
		await expect(blanks.locator('select')).toHaveCount(1);
		await expect(blanks).toContainText('The capital of France is');
		await expect(blanks).toContainText('bridges and lies in');

		const layout = await page.evaluate(() => {
			const paragraphs = Array.from(document.querySelectorAll('.qti-item-body p'));
			const blanks = document.querySelector('p.blanks') as Element;
			const separate = document.querySelector('p.separate') as Element;
			const afterB = document.querySelector('p.after-b') as Element;
			return {
				displays: [...new Set(paragraphs.map((p) => getComputedStyle(p).display))],
				blanksBelowPrevious: blanks.getBoundingClientRect().top >= afterB.getBoundingClientRect().bottom,
				separateBelowBlanks: separate.getBoundingClientRect().top >= blanks.getBoundingClientRect().bottom,
			};
		});
		expect(layout).toEqual({ displays: ['block'], blanksBelowPrevious: true, separateBelowBlanks: true });
	});

	test('inline blanks are named by position, never by identifier, and described by their sentence', async ({
		page,
	}) => {
		await openFixture(page, 'parts');
		const inputs = page.locator('p.blanks input');
		await expect(inputs.nth(0)).toHaveAccessibleName('Blank 1 of 4');
		await expect(inputs.nth(1)).toHaveAccessibleName('Blank 2 of 4');
		await expect(page.locator('p.blanks select')).toHaveAccessibleName('Blank 3 of 4');
		await expect(page.locator('p.dated input')).toHaveAccessibleName('Blank 4 of 4');
		await expect(inputs.nth(0)).toHaveAccessibleDescription(/The capital of France is/);

		const leaked = await page.evaluate(() =>
			Array.from(document.querySelectorAll('.qti-item-body [aria-label], .qti-item-body [title]'))
				.map((element) => `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`)
				.filter((text) => /CAPITAL_PARIS|BRIDGES|CONTINENT|\bDATE\b|Text entry|Inline choice/.test(text))
		);
		expect(leaked).toEqual([]);
	});

	test('text entry offers no spelling help, and a numeric keyboard only when no minus can be needed', async ({ page }) => {
		await openFixture(page, 'parts');
		const capital = page.locator('p.blanks input').nth(0);
		await expect(capital).toHaveAttribute('spellcheck', 'false');
		await expect(capital).toHaveAttribute('autocorrect', 'off');
		await expect(capital).toHaveAttribute('autocapitalize', 'off');
		await expect(capital).toHaveAttribute('autocomplete', 'off');
		// Phone number pads have no minus key: a numeric keyboard is only safe
		// behind a patternMask that excludes `-`. The string responses keep the
		// text keyboard — even the date with its digit-only mask (its response
		// is a string, so its answer could legitimately hold a minus).
		expect(await capital.getAttribute('inputmode')).toBeNull();
		expect(await page.locator('p.dated input').getAttribute('inputmode')).toBeNull();
		await expect(page.locator('p.blanks input').nth(1)).toHaveAttribute('inputmode', 'numeric');
	});

	test('a pattern mismatch explains the expected format without exposing the pattern', async ({ page }) => {
		await openFixture(page, 'parts');
		const date = page.locator('p.dated input');
		expect(await date.getAttribute('title')).toBeNull();

		await date.fill('2024');
		await date.blur();

		const alert = page.locator('p.dated [role="alert"]');
		await expect(alert).toHaveText('This answer is not in the expected format. Use this format: dd/mm/yyyy');
		await expect(date).toHaveAttribute('aria-invalid', 'true');
		await expect(date).toHaveAccessibleDescription(/not in the expected format/);
		expect(await alert.textContent()).not.toContain('[0-9]');

		const style = await alert.evaluate((element) => {
			const computed = getComputedStyle(element);
			return { color: computed.color, size: Number.parseFloat(computed.fontSize) };
		});
		expect(style.size).toBeGreaterThanOrEqual(14);
		expect(await contrast(page, style.color, '#ffffff')).toBeGreaterThanOrEqual(4.5);
	});

	test('inline controls have a 3:1 boundary and a solid 2px focus ring', async ({ page }) => {
		await openFixture(page, 'parts');
		for (const control of [page.locator('p.blanks input').nth(0), page.locator('p.blanks select')]) {
			await control.focus();
			const style = await control.evaluate((element) => {
				const computed = getComputedStyle(element);
				return {
					border: computed.borderTopColor,
					background: computed.backgroundColor,
					outlineStyle: computed.outlineStyle,
					outlineWidth: computed.outlineWidth,
					outlineOffset: computed.outlineOffset,
				};
			});
			expect(await contrast(page, style.border, style.background)).toBeGreaterThanOrEqual(3);
			expect(style).toMatchObject({ outlineStyle: 'solid', outlineWidth: '2px', outlineOffset: '2px' });
		}
	});

	test('responses update interactions in place: nothing remounts and focus stays', async ({ page }) => {
		await openFixture(page, 'parts');
		await expect(page.locator('pie-qti-choice input[type="radio"]').first()).toBeVisible();
		await page.evaluate(() => {
			(document.querySelector('pie-qti-choice') as unknown as Record<string, unknown>).__fixtureMarker = 'choice';
			(document.querySelector('p.blanks input') as unknown as Record<string, unknown>).__fixtureMarker = 'blank';
		});

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
		const kept = await page.evaluate(() => ({
			choice: (document.querySelector('pie-qti-choice') as unknown as Record<string, unknown>).__fixtureMarker,
			blank: (document.querySelector('p.blanks input') as unknown as Record<string, unknown>).__fixtureMarker,
		}));
		expect(kept).toEqual({ choice: 'choice', blank: 'blank' });
	});

	test.describe('on a phone', () => {
		test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

		test('authored order and paragraphs hold on a narrow screen', async ({ page }) => {
			await openFixture(page, 'parts');
			await expect(page.locator('pie-qti-choice').first()).toBeVisible();
			const layout = await page.evaluate(() => {
				const box = (selector: string) => (document.querySelector(selector) as Element).getBoundingClientRect();
				return {
					choiceBetweenParts: box('p.part-a').bottom <= box('pie-qti-choice').top && box('pie-qti-choice').bottom <= box('p.part-b').top,
					separateBelowBlanks: box('p.blanks').bottom <= box('p.separate').top,
					fitsViewport: document.querySelector('.qti-item-body')!.scrollWidth <= window.innerWidth,
				};
			});
			expect(layout).toEqual({ choiceBetweenParts: true, separateBelowBlanks: true, fitsViewport: true });
		});
	});
});

test.describe('item player feedback, end attempt and errors', () => {
	test('modal feedback is a real modal: focus moves in, Escape closes, focus returns', async ({ page }) => {
		await openFixture(page, 'adaptive');
		await page.locator('pie-qti-choice input[type="radio"]').nth(1).check();
		const submit = page.getByRole('button', { name: 'Submit', exact: true });
		await submit.focus();
		await page.keyboard.press('Enter');

		const dialog = page.getByRole('dialog', { name: 'Not yet' });
		await expect(dialog).toBeVisible();
		expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
		await expect(dialog.getByRole('heading', { name: 'Not yet' })).toBeFocused();
		// The page behind a modal is inert: its controls cannot take focus.
		const backgroundFocusable = await page.evaluate(() => {
			(document.querySelector('.qti-player-button') as HTMLElement).focus();
			return document.activeElement?.closest('dialog') === null;
		});
		expect(backgroundFocusable).toBe(false);

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(submit).toBeFocused();

		// A click on the backdrop closes it as well.
		await page.keyboard.press('Enter');
		await expect(dialog).toBeVisible();
		await page.mouse.click(5, 5);
		await expect(dialog).toBeHidden();
	});

	test('a hint button submits without counting the attempt and keeps the interactions mounted', async ({ page }) => {
		await openFixture(page, 'adaptive');
		await expect(page.locator('pie-qti-end-attempt')).toBeAttached();
		await expect(page.getByText('Attempt 1', { exact: true })).toBeVisible();
		await expect(page.locator('p.hint-text')).toHaveCount(0);
		await page.evaluate(() => {
			(document.querySelector('pie-qti-choice') as unknown as Record<string, unknown>).__fixtureMarker = 'kept';
		});

		// Activating the end-attempt interaction emits the standard change with value true; the
		// player owns what follows. Dispatched here as the component does, whatever its own UI.
		await page.evaluate(() => {
			document.querySelector('pie-qti-end-attempt')?.dispatchEvent(
				new CustomEvent('qti-change', {
					bubbles: true,
					composed: true,
					detail: { responseId: 'HINT', value: true, timestamp: Date.now() },
				})
			);
		});

		await expect(page.locator('p.hint-text')).toHaveText('Hint: it is named after the Roman god of war.');
		await expect(page.getByTestId('submission-count')).toHaveText('1');
		// countAttempt="false": the hint did not use up an attempt.
		await expect(page.getByText('Attempt 1', { exact: true })).toBeVisible();

		const after = await page.evaluate(() => {
			const element = (selector: string) => document.querySelector(selector) as Element;
			const precedes = (a: string, b: string) =>
				Boolean(element(a).compareDocumentPosition(element(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
			return {
				marker: (element('pie-qti-choice') as unknown as Record<string, unknown>).__fixtureMarker,
				hintAfterChoice: precedes('pie-qti-choice', 'p.hint-text'),
				hintBeforeButton: precedes('p.hint-text', 'pie-qti-end-attempt'),
			};
		});
		expect(after).toEqual({ marker: 'kept', hintAfterChoice: true, hintBeforeButton: true });
	});

	test('a load error is announced as an alert', async ({ page }) => {
		await page.goto(fixture('broken'));
		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toHaveClass(/qti-player-alert-error/);
		// The parser's own message, whatever the engine words it as.
		await expect(alert).toHaveText(/\S/);
	});
});
