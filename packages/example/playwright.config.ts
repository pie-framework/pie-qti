import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for accessibility testing
 * Tests target WCAG 2.2 Level AA compliance for player components
 */
// Use IPv4 explicitly to avoid environments where IPv6 ::1 binding is restricted.
const ORIGIN = 'http://127.0.0.1:5173';
// SvelteKit `paths.base` is configured for GitHub Pages-style hosting.
// In dev, we serve at `/`. In production/static builds, the app is typically served under `/pie-qti/`.
// If you need to run Playwright against a non-root base path, set PLAYWRIGHT_BASE_PATH (e.g. "/pie-qti").
const BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? '';
const BASE_URL = `${ORIGIN}${BASE_PATH ? BASE_PATH.replace(/\/?$/, '/') : '/'}`;

export default defineConfig({
	testDir: './tests/playwright',
	testMatch: '**/*.pw.ts', // Custom pattern to avoid Bun test discovery
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	timeout: 60000, // Global test timeout: 60s
	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
		actionTimeout: 15000, // Individual action timeout: 15s
		navigationTimeout: 30000 // Page navigation timeout: 30s
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],

	// Start dev server before tests
	webServer: {
		command: 'bun run dev -- --host 127.0.0.1 --port 5173 --strictPort',
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000
	}
});
