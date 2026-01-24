import { type Page, type APIRequestContext, expect } from '@playwright/test';

/**
 * Shared test utilities for transform-app E2E tests.
 *
 * These helpers provide common patterns for:
 * - Session creation and management
 * - Waiting for analysis completion
 * - Player initialization and interaction
 * - File uploads
 *
 * Usage:
 *   import { createSessionFromSample, waitForAnalysis } from './test-helpers.js';
 */

/**
 * Creates a test session by loading a sample QTI package.
 *
 * @param request - Playwright API request context
 * @param sampleId - ID of the sample to load (e.g., 'basic-interactions')
 * @returns Session ID string
 */
export async function createSessionFromSample(
	request: APIRequestContext,
	sampleId: string
): Promise<string> {
	const res = await request.post(`/api/samples/${sampleId}/load`);
	expect(res.ok()).toBeTruthy();

	const json = await res.json();
	expect(json.success).toBeTruthy();
	expect(typeof json.sessionId).toBe('string');

	return json.sessionId as string;
}

/**
 * Waits for package analysis to complete.
 *
 * Looks for multiple signals that analysis has finished:
 * - "Browse & Preview Items" link appears
 * - "Analysis Results" heading appears
 * - "Analysis complete" text appears
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 * @param options.timeout - Maximum wait time in ms (default: 120000)
 */
export async function waitForAnalysis(
	page: Page,
	options: { timeout?: number } = {}
): Promise<void> {
	const timeout = options.timeout ?? 120_000;

	// Try multiple detection strategies - any one succeeding means analysis is done
	const strategies = [
		// Strategy 1: Browse Items link appears
		page.getByRole('link', { name: /Browse & Preview Items/i }).waitFor({
			state: 'visible',
			timeout
		}),
		// Strategy 2: Analysis Results heading appears
		page.getByRole('heading', { name: /Analysis Results/i }).waitFor({
			state: 'visible',
			timeout
		}),
		// Strategy 3: Analysis complete text appears
		page.getByText(/Analysis complete/i).waitFor({
			state: 'visible',
			timeout
		})
	];

	// Wait for any strategy to succeed
	await Promise.race(strategies);
}

/**
 * Waits for the QTI player web component to be ready.
 *
 * Checks that:
 * 1. Custom element is defined
 * 2. Player element is visible in DOM
 * 3. Loading spinner has disappeared
 *
 * @param page - Playwright page object
 * @param timeout - Maximum wait time in ms (default: 30000)
 */
export async function waitForPlayerReady(
	page: Page,
	timeout: number = 30_000
): Promise<void> {
	// Wait for custom element to be defined
	await page.waitForFunction(
		() => customElements.get('pie-qti2-item-player') !== undefined,
		{ timeout }
	);

	// Wait for player element to be visible
	const playerElement = page.locator('pie-qti2-item-player');
	await expect(playerElement).toBeVisible({ timeout });

	// Wait for loading spinner to disappear (if it exists)
	const loadingSpinner = page.getByText('Loading QTI player...');
	const spinnerCount = await loadingSpinner.count();
	if (spinnerCount > 0) {
		await expect(loadingSpinner).not.toBeVisible({ timeout });
	}
}

/**
 * Navigates to the items page for a given session.
 *
 * This is the complete workflow:
 * 1. Go to session page
 * 2. Click "Analyze Package" button
 * 3. Wait for analysis to complete
 * 4. Click "Browse & Preview Items" link
 * 5. Wait for items page to load
 *
 * @param page - Playwright page object
 * @param sessionId - Session ID
 */
export async function navigateToItemsPage(
	page: Page,
	sessionId: string
): Promise<void> {
	// Navigate to session page
	await page.goto(`/session/${sessionId}`);

	// Wait for page to load
	await expect(page.getByRole('heading', { name: /Session/i })).toBeVisible();

	// Check if analysis is already complete (look for "Browse & Preview Items" link)
	const browseLink = page.getByRole('link', { name: /Browse & Preview Items/i });
	const analyzeButton = page.getByRole('button', { name: /Analyze Package/i });

	const linkVisible = await browseLink.isVisible().catch(() => false);

	if (!linkVisible) {
		// Analysis not complete, need to run it
		await expect(analyzeButton).toBeVisible({ timeout: 10_000 });
		await analyzeButton.click();

		// Wait for analysis to complete
		await waitForAnalysis(page);
	}

	// Navigate to items page
	await page.getByRole('link', { name: /Browse & Preview Items/i }).click();
	await expect(page.getByRole('heading', { name: /Item Browser/i })).toBeVisible();

	// Wait for items list to load
	await expect(page.getByTestId('item-select-0')).toBeVisible({ timeout: 60_000 });
}

/**
 * Selects an item from the item list by index.
 *
 * @param page - Playwright page object
 * @param index - Zero-based index of item to select
 */
export async function selectItem(
	page: Page,
	index: number
): Promise<void> {
	const itemSelector = page.getByTestId(`item-select-${index}`);
	await expect(itemSelector).toBeVisible({ timeout: 10_000 });
	await itemSelector.click();

	// Wait for player to update (small delay for content to render)
	await page.waitForTimeout(1000);
}

/**
 * Gets the QTI player element locator.
 *
 * @param page - Playwright page object
 * @returns Playwright locator for the player element
 */
export function getPlayerElement(page: Page) {
	return page.locator('pie-qti2-item-player');
}

/**
 * Toggles the "Show Correct" checkbox to change player role.
 *
 * When enabled, switches player from 'candidate' to 'scorer' role
 * to display correct answers.
 *
 * @param page - Playwright page object
 */
export async function clickShowCorrect(page: Page): Promise<void> {
	// Find the "Show Correct" checkbox by label
	const checkbox = page.getByLabel(/Show Correct/i);
	await expect(checkbox).toBeVisible({ timeout: 5_000 });
	await checkbox.click();

	// Wait for player to update
	await page.waitForTimeout(500);
}

/**
 * Uploads a QTI file or package and returns the session ID.
 *
 * @param page - Playwright page object
 * @param filePath - Path to the file to upload
 * @returns Session ID string
 */
export async function uploadQtiFile(
	page: Page,
	filePath: string
): Promise<string> {
	await page.goto('/');

	// Find the file input (hidden behind dropzone)
	const fileInput = page.locator('input[type="file"]');
	await fileInput.setInputFiles(filePath);

	// Wait for upload to complete and redirect to session page
	await page.waitForURL(/\/session\/.+/, { timeout: 30_000 });

	// Extract session ID from URL
	const url = page.url();
	const match = url.match(/\/session\/([^\/]+)/);
	if (!match) {
		throw new Error(`Could not extract session ID from URL: ${url}`);
	}

	return match[1];
}

/**
 * Waits for an element to be clickable (visible and enabled).
 *
 * @param page - Playwright page object
 * @param selector - Element selector (role, text, testid, etc.)
 * @param timeout - Maximum wait time in ms (default: 10000)
 */
export async function waitForClickable(
	_page: Page,
	selector: ReturnType<typeof _page.getByRole | typeof _page.getByText | typeof _page.getByTestId>,
	timeout: number = 10_000
): Promise<void> {
	await expect(selector).toBeVisible({ timeout });
	await expect(selector).toBeEnabled({ timeout });
}

/**
 * Gets text content from the selected item title.
 *
 * @param page - Playwright page object
 * @returns Item title text or null
 */
export async function getSelectedItemTitle(page: Page): Promise<string | null> {
	const titleElement = page.getByTestId('selected-item-title');
	const count = await titleElement.count();
	if (count === 0) {
		return null;
	}
	return await titleElement.textContent();
}

/**
 * Checks if a player has loaded content (either text or interactive elements).
 *
 * @param page - Playwright page object
 * @returns True if player has content, false otherwise
 */
export async function playerHasContent(page: Page): Promise<boolean> {
	const playerElement = getPlayerElement(page);

	return await playerElement.evaluate((el: any) => {
		// QTI players use light DOM for better accessibility
		const hasText = el.textContent && el.textContent.trim().length > 0;
		const hasInteractiveElements = el.querySelectorAll('button, input, select, textarea').length > 0;
		return hasText || hasInteractiveElements;
	});
}

/**
 * Verifies that a player element has been initialized with item XML.
 *
 * @param page - Playwright page object
 * @returns True if player has itemXml property set, false otherwise
 */
export async function playerIsInitialized(page: Page): Promise<boolean> {
	const playerElement = getPlayerElement(page);

	return await playerElement.evaluate((el: any) => {
		return el && typeof el.itemXml === 'string' && el.itemXml.length > 0;
	});
}
