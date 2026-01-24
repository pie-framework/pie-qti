import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for transform-app end-to-end tests.
 *
 * Notes:
 * - Uses a custom "*.pw.ts" match so Bun doesn't try to run these as unit tests.
 * - Runs a local dev server via `bun run dev` before tests.
 * - Timeout increased to 90s for analysis operations (which can be slow)
 * - Retries set to 3 in CI to handle occasional flakiness
 * - trace-on-first-retry enabled for debugging failed tests
 */
export default defineConfig({
	testDir: './tests/playwright',
	testMatch: '**/*.pw.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 3 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	timeout: 90_000, // 90 seconds for analysis operations
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174',
		trace: 'on-first-retry',
		actionTimeout: 10_000, // 10 seconds for individual actions
		navigationTimeout: 30_000 // 30 seconds for page navigations
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'bun run dev -- --port 5174 --strictPort',
		url: 'http://localhost:5174',
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000
	}
});


