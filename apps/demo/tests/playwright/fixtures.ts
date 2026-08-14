import { expect, test as base, type Page } from '@playwright/test';

/**
 * Every spec imports `test` from here rather than from `@playwright/test`, so that an uncaught
 * exception on the page fails the test that provoked it.
 *
 * A Svelte reactive loop aborts the update batch before any DOM work and discards every later
 * update in it, leaving a page that is fully rendered and completely inert. Assertions about
 * content still pass against that stale DOM, so the only reliable signal is the uncaught error
 * itself — which is exactly how an `effect_update_depth_exceeded` loop shipped to production and
 * broke the whole item demo.
 *
 * Uncaught errors only. Console errors are not gated: the demo legitimately logs them for
 * blocked navigation, missing translations and deliberate error paths, so they carry no signal.
 */
export const test = base.extend<{ failOnUncaughtPageError: undefined }>({
	failOnUncaughtPageError: [
		async ({ page }, use, testInfo) => {
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message.split('\n')[0]));

			await use(undefined);

			// A test.fail() test owns its own failure; a teardown assertion would only obscure it.
			if (testInfo.expectedStatus === 'failed') return;
			expect(errors, `uncaught page error(s): ${errors.join(' | ')}`).toEqual([]);
		},
		{ auto: true },
	],
});

export { expect, type Page };
