import { expect, test } from './fixtures';
import { scanA11yFixture } from './a11y-utils';

for (const input of ['mouse', 'touch', 'keyboard'] as const) {
	test.describe(input, () => {
		test.use({ hasTouch: input === 'touch', viewport: { width: input === 'touch' ? 375 : 1280, height: 900 } });
		test('completes ordering and each matching type without dragging', async ({ page }) => {
			await page.goto('fixtures/pointer-interactions');
			const activate = async (control: ReturnType<typeof page.getByRole>) => {
				if (input === 'touch') await control.tap();
				else if (input === 'keyboard') await control.press('Enter');
				else await control.click();
			};
			await activate(page.getByRole('button', { name: 'Move later: One', exact: true }));
			await expect(page.getByTestId('ORDER')).toHaveText('["two","one","three"]');
			await activate(page.getByRole('button', { name: 'Move later: One', exact: true }));
			await expect(page.getByTestId('ORDER')).toHaveText('["two","three","one"]');
			await expect(page.getByRole('button', { name: 'Move later: One', exact: true })).toBeDisabled();

			const match = page.locator('pie-qti-match');
			await activate(match.getByRole('button', { name: /^Paris/ }));
			await expect(match.getByRole('button', { name: /^Paris/ })).toHaveAttribute('aria-pressed', 'true');
			await activate(match.getByRole('button', { name: /^France/ }));
			await expect(match.getByRole('button', { name: /^Paris/ })).toBeFocused();
			await activate(match.getByRole('button', { name: /^Rome/ }));
			await activate(match.getByRole('button', { name: /^Italy/ }));
			await expect(page.getByTestId('MATCH')).toHaveText('["paris france","rome italy"]');
			await activate(match.getByRole('button', { name: 'Clear match for Paris', exact: true }));
			await expect(page.getByTestId('MATCH')).toHaveText('["rome italy"]');

			const gap = page.locator('pie-qti-gap-match');
			await activate(gap.getByRole('button', { name: 'Blue', exact: true }));
			await activate(gap.locator('button[data-gap-id="sky"]'));
			await expect(page.getByTestId('GAP')).toHaveText('["blue sky"]');
			await expect(gap.locator('button[data-gap-id="sky"]')).toBeFocused();

			const graphic = page.locator('pie-qti-graphic-gap-match');
			await activate(graphic.getByRole('button', { name: /^Rain/ }));
			await activate(graphic.getByRole('button', { name: /^Hotspot 1/ }));
			await activate(graphic.getByRole('button', { name: /^Sun/ }));
			await activate(graphic.getByRole('button', { name: /^Hotspot 2/ }));
			await expect(page.getByTestId('GRAPHIC')).toHaveText('["rain left","sun right"]');
			const scan = await scanA11yFixture(page);
			expect(scan.violations).toEqual([]);
		});
		test('the shared graphic gap component supports the same activation flow', async ({ page }) => {
			await page.goto('a11y-components/graphic-gap-match');
			const activate = async (control: ReturnType<typeof page.getByRole>) => {
				if (input === 'touch') await control.tap();
				else if (input === 'keyboard') await control.press('Enter');
				else await control.click();
			};
			await activate(page.getByRole('button', { name: /^Label A/ }));
			await activate(page.getByRole('button', { name: /^Hotspot 1/ }));
			await expect(page.getByRole('button', { name: /^Hotspot 1/ })).toHaveAccessibleName(/Contains Label A/);
			await expect(page.getByRole('button', { name: /^Label A/ })).toBeDisabled();
			await activate(page.getByRole('button', { name: 'Remove Label A from hotspot', exact: true }));
			await expect(page.getByRole('button', { name: /^Label A/ })).toBeEnabled();
		});
	});
}
