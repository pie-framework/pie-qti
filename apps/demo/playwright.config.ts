import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Playwright configuration for accessibility testing
 * Tests target WCAG 2.2 Level AA compliance for player components
 */
// Use IPv4 explicitly to avoid environments where IPv6 ::1 binding is restricted.
const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT ?? '5201';
const ORIGIN = `http://127.0.0.1:${PLAYWRIGHT_PORT}`;
const REUSE_EXISTING_SERVER = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';
const CHROMIUM_EXECUTABLE_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
// SvelteKit `paths.base` is configured for GitHub Pages-style hosting.
// In dev, we serve at `/`. In production/static builds, the app is typically served under `/pie-qti/`.
// If you need to run Playwright against a non-root base path, set PLAYWRIGHT_BASE_PATH (e.g. "/pie-qti").
const BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? '';
const BASE_URL = `${ORIGIN}${BASE_PATH ? BASE_PATH.replace(/\/?$/, '/') : '/'}`;
const chromiumUse = CHROMIUM_EXECUTABLE_PATH
	? {
			...devices['Desktop Chrome'],
			launchOptions: {
				executablePath: CHROMIUM_EXECUTABLE_PATH
			}
		}
	: devices['Desktop Chrome'];

/**
 * WebKit and Firefox run only the tests tagged `@cross-browser`: the accessibility
 * regression set (`a11y-regression.pw.ts`), the core smoke subset
 * (`cross-browser-smoke.pw.ts`) — item rendering order, assessment navigation/submit and
 * a few scored interaction evals — plus the browser-sensitive UI suites (themes, CSS
 * cascade without host CSS, asset loading, web components, pointer/drag interactions,
 * contenteditable input, RTL layout). Chromium runs the whole suite, tagged tests included.
 * Select the extra engines explicitly: `playwright test --project=webkit --project=firefox`
 * (or `bun run test:e2e:cross-browser`).
 *
 * Safari is exercised through the bundled WebKit engine (Playwright cannot drive the
 * Safari.app binary) and Firefox through its bundled build rather than the system one.
 *
 * The system Chromium browsers on this machine (Google Chrome, Microsoft Edge, Opera)
 * run the whole suite like chromium and are opt-in via PLAYWRIGHT_SYSTEM_ENGINES=true,
 * because CI only provisions Playwright's bundled browsers.
 */
const CROSS_BROWSER_TAG = /@cross-browser/;
const SYSTEM_ENGINES_ENABLED = process.env.PLAYWRIGHT_SYSTEM_ENGINES === 'true';
const OPERA_EXECUTABLE_PATH = '/Applications/Opera.app/Contents/MacOS/Opera';

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
			use: chromiumUse
		},
		{
			name: 'webkit',
			use: devices['Desktop Safari'],
			grep: CROSS_BROWSER_TAG
		},
		{
			// Gecko resolves its app-data dir to ~/Library/Application Support/Firefox, which
			// macOS 27 TCC-protects as soon as the real Firefox.app is installed — the bundled
			// build then dies with "Could not find profile folder" (microsoft/playwright#42768,
			// fixed upstream in Firefox 158, not yet in Playwright's firefox-1555). Redirecting
			// the home lookup to a throwaway directory sidesteps the protected path.
			name: 'firefox',
			use: {
				...devices['Desktop Firefox'],
				launchOptions: {
					env: { ...process.env, CFFIXED_USER_HOME: mkdtempSync(join(tmpdir(), 'playwright-fx-home-')) }
				}
			},
			grep: CROSS_BROWSER_TAG
		},
		...(SYSTEM_ENGINES_ENABLED
			? [
					{
						name: 'chrome',
						use: { ...devices['Desktop Chrome'], channel: 'chrome' as const }
					},
					{
						name: 'msedge',
						use: { ...devices['Desktop Chrome'], channel: 'msedge' as const }
					},
					{
						// Opera ships no Playwright channel; it is Chromium, so the Desktop
						// Chrome device profile plus its binary works.
						name: 'opera',
						use: {
							...devices['Desktop Chrome'],
							launchOptions: { executablePath: OPERA_EXECUTABLE_PATH }
						}
					}
				]
			: [])
	],

	// Start dev server before tests
	webServer: {
		command: `bun run dev -- --host 127.0.0.1 --port ${PLAYWRIGHT_PORT} --strictPort`,
		url: BASE_URL,
		reuseExistingServer: REUSE_EXISTING_SERVER,
		timeout: 120 * 1000
	}
});
