import { expect, test } from './fixtures';

test.use({ hasTouch: true, viewport: { width: 375, height: 900 } });

for (const nested of [false, true]) {
	test(`touch reorders the published interaction through ${nested ? 'nested' : 'one'} shadow roots`, async ({ page }) => {
		await page.goto(`fixtures/touch-drag?nested=${nested}`);
		const source = page.getByRole('button', { name: 'One. Position 1 of 3', exact: true });
		const target = page.getByRole('button', { name: 'Three. Position 3 of 3', exact: true });
		await source.scrollIntoViewIfNeeded();
		await target.scrollIntoViewIfNeeded();
		const from = await source.boundingBox();
		const to = await target.boundingBox();
		expect(from).not.toBeNull();
		expect(to).not.toBeNull();
		const session = await page.context().newCDPSession(page);
		const x = from!.x + from!.width / 2;
		const y = from!.y + from!.height / 2;
		const endX = to!.x + to!.width / 2;
		const endY = to!.y + to!.height / 2;
		await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
		for (let step = 1; step <= 8; step += 1) {
			await session.send('Input.dispatchTouchEvent', {
				type: 'touchMove', touchPoints: [{ x: x + (endX - x) * step / 8, y: y + (endY - y) * step / 8 }],
			});
		}
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect(page.getByTestId('response')).toHaveText('["two","three","one"]');
		await expect(page.getByTestId('change-count')).toHaveText('Changes: 1');
		await expect(page.getByRole('button', { name: 'One. Position 3 of 3', exact: true })).not.toHaveCSS('opacity', '0.5');
		await session.detach();
	});
}

test('a cancelled touch does not commit an answer or leave the source faded', async ({ page }) => {
	await page.goto('fixtures/touch-drag?nested=true');
	const source = page.getByRole('button', { name: 'One. Position 1 of 3', exact: true });
	await source.scrollIntoViewIfNeeded();
	const box = await source.boundingBox();
	expect(box).not.toBeNull();
	const session = await page.context().newCDPSession(page);
	const x = box!.x + box!.width / 2;
	const y = box!.y + box!.height / 2;
	await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
	await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 30 }] });
	await expect(source).toHaveCSS('opacity', '0.5');
	await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
	await expect(source).not.toHaveCSS('opacity', '0.5');
	await expect(page.getByTestId('change-count')).toHaveText('Changes: 0');
	await session.detach();
});
