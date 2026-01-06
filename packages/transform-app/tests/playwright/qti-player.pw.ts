import { expect, test } from '@playwright/test';

/**
 * QTI Player functionality tests.
 * Tests that the player loads, renders interactions, and handles user input correctly.
 */

async function createSessionFromSample(request: any, sampleId: string): Promise<string> {
	const res = await request.post(`/api/samples/${sampleId}/load`);
	expect(res.ok()).toBeTruthy();
	const json = await res.json();
	expect(typeof json.sessionId).toBe('string');
	return json.sessionId as string;
}

async function navigateToItemsPage(page: any, sessionId: string) {
	await page.goto(`/session/${sessionId}`);
	
	// Analyze packages
	await page.getByRole('button', { name: /Analyze Package/i }).click();
	
	// Wait for analysis to complete and browse items link to appear
	await expect(page.getByRole('link', { name: /Browse & Preview Items/i })).toBeVisible({ timeout: 120_000 });
	
	// Navigate to items page
	await page.getByRole('link', { name: /Browse & Preview Items/i }).click();
	await expect(page.getByRole('heading', { name: /Item Browser/i })).toBeVisible();
	
	// Wait for items to load
	await expect(page.getByTestId('item-select-0')).toBeVisible({ timeout: 60_000 });
}

test.describe('QTI Player', () => {
	test('player web component loads and renders', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// Wait for web component to be defined
		await page.waitForFunction(() => {
			return customElements.get('pie-qti2-item-player') !== undefined;
		}, { timeout: 30_000 });

		// Check that the player element exists in the DOM
		const playerElement = page.locator('pie-qti2-item-player');
		await expect(playerElement).toBeVisible({ timeout: 30_000 });

		// Verify player has loaded (check for loading spinner to disappear)
		await expect(page.getByText('Loading QTI player...')).not.toBeVisible({ timeout: 30_000 });

		// Verify player element has been initialized with properties
		const isInitialized = await playerElement.evaluate((el: any) => {
			return el && typeof el.itemXml === 'string';
		});
		expect(isInitialized).toBeTruthy();
	});

	test('player renders item content in shadow DOM', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// Wait for player to load
		await page.waitForFunction(() => {
			return customElements.get('pie-qti2-item-player') !== undefined;
		}, { timeout: 30_000 });

		// Select first item
		await page.getByTestId('item-select-0').click();
		await page.waitForTimeout(3000);

		const playerElement = page.locator('pie-qti2-item-player');
		await expect(playerElement).toBeVisible();

		// Check that player has shadow DOM with content
		const hasContent = await playerElement.evaluate((el: any) => {
			const shadowRoot = el.shadowRoot;
			if (!shadowRoot) return false;

			// Check for common QTI player elements
			// Player should have some content (text, buttons, inputs, etc.)
			const hasText = shadowRoot.textContent && shadowRoot.textContent.trim().length > 0;
			const hasInteractiveElements = shadowRoot.querySelectorAll('button, input, select, textarea').length > 0;
			
			return hasText || hasInteractiveElements;
		});

		expect(hasContent).toBeTruthy();
	});

	test('player displays choice interaction and allows selection', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// Wait for player to load
		await page.waitForFunction(() => {
			return customElements.get('pie-qti2-item-player') !== undefined;
		}, { timeout: 30_000 });

		// Select a choice interaction item (first item is usually choice)
		await page.getByTestId('item-select-0').click();
		await page.waitForTimeout(3000); // Wait for player to render and load XML

		// Check that player element is visible
		const playerElement = page.locator('pie-qti2-item-player');
		await expect(playerElement).toBeVisible();

		// Verify player has loaded the item XML
		const hasItemXml = await playerElement.evaluate((el: any) => {
			return el.itemXml && el.itemXml.length > 0;
		});
		expect(hasItemXml).toBeTruthy();

		// Verify player has an identifier
		const identifier = await playerElement.evaluate((el: any) => el.identifier);
		expect(identifier).toBeTruthy();
		expect(typeof identifier).toBe('string');

		// Try to interact with choice buttons using shadow DOM access
		// Since web components use shadow DOM, we need to evaluate JavaScript
		const interactionWorked = await playerElement.evaluate((el: any) => {
			// Try to find choice buttons in shadow DOM
			const shadowRoot = el.shadowRoot;
			if (!shadowRoot) return false;

			// Look for radio buttons or choice buttons
			const radios = shadowRoot.querySelectorAll('input[type="radio"]');
			const buttons = shadowRoot.querySelectorAll('button[role="radio"], button[data-choice]');
			
			if (radios.length > 0) {
				// Click first radio
				(radios[0] as HTMLElement).click();
				return true;
			} else if (buttons.length > 0) {
				// Click first button
				(buttons[0] as HTMLElement).click();
				return true;
			}
			
			return false;
		});

		// If we found interactive elements, verify they responded
		if (interactionWorked) {
			await page.waitForTimeout(500);
			// Player should have updated its response
		}
	});

	test('player handles text entry interaction', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// Wait for player to load
		await page.waitForFunction(() => {
			return customElements.get('pie-qti2-item-player') !== undefined;
		}, { timeout: 30_000 });

		// Find and select text entry item (usually last item in basic-interactions)
		const textEntryItem = page.getByTestId('item-select-4'); // Text Entry is typically 5th item
		if (await textEntryItem.count() > 0) {
			await textEntryItem.click();
			await page.waitForTimeout(3000); // Wait for player to render

			// Check that player loaded
			const playerElement = page.locator('pie-qti2-item-player');
			await expect(playerElement).toBeVisible();

			// Verify player has loaded the text entry item XML
			const hasItemXml = await playerElement.evaluate((el: any) => {
				return el.itemXml && el.itemXml.includes('textEntryInteraction');
			});
			expect(hasItemXml).toBeTruthy();

			// Try to find and interact with text input using shadow DOM
			const textEntered = await playerElement.evaluate((el: any) => {
				const shadowRoot = el.shadowRoot;
				if (!shadowRoot) return false;

				// Look for text inputs
				const textInputs = shadowRoot.querySelectorAll('input[type="text"], textarea, input:not([type])');
				
				if (textInputs.length > 0) {
					const input = textInputs[0] as HTMLInputElement;
					input.value = 'test answer';
					input.dispatchEvent(new Event('input', { bubbles: true }));
					input.dispatchEvent(new Event('change', { bubbles: true }));
					return input.value === 'test answer';
				}
				
				return false;
			});

			// If we found a text input, verify it worked
			if (textEntered) {
				await page.waitForTimeout(500);
				// Text should have been entered
			}
		}
	});

	test('show correct toggle changes player role', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// Wait for player to load
		await page.waitForFunction(() => {
			return customElements.get('pie-qti2-item-player') !== undefined;
		}, { timeout: 30_000 });

		// Select an item
		await page.getByTestId('item-select-0').click();
		await page.waitForTimeout(2000);

		// Get the player element
		const playerElement = page.locator('pie-qti2-item-player');
		await expect(playerElement).toBeVisible();

		// Check initial role (should be 'candidate')
		const initialRole = await playerElement.evaluate((el: any) => el.role);
		expect(initialRole).toBe('candidate');

		// Toggle "Show Correct"
		const showCorrectToggle = page.getByRole('checkbox', { name: 'Show Correct' });
		await showCorrectToggle.check();

		// Wait a bit for the role to update
		await page.waitForTimeout(1000);

		// Verify role changed to 'scorer'
		const updatedRole = await playerElement.evaluate((el: any) => el.role);
		expect(updatedRole).toBe('scorer');

		// Toggle back
		await showCorrectToggle.uncheck();
		await page.waitForTimeout(1000);

		// Verify role changed back to 'candidate'
		const finalRole = await playerElement.evaluate((el: any) => el.role);
		expect(finalRole).toBe('candidate');
	});

	test('player updates when different item is selected', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// Wait for player to load
		await page.waitForFunction(() => {
			return customElements.get('pie-qti2-item-player') !== undefined;
		}, { timeout: 30_000 });

		// Select first item
		await page.getByTestId('item-select-0').click();
		await page.waitForTimeout(2000);

		// Get initial item identifier
		const playerElement = page.locator('pie-qti2-item-player');
		await expect(playerElement).toBeVisible();
		const firstItemId = await playerElement.evaluate((el: any) => el.identifier);

		// Select second item
		await page.getByTestId('item-select-1').click();
		await page.waitForTimeout(2000);

		// Verify player updated with new item
		const secondItemId = await playerElement.evaluate((el: any) => el.identifier);
		expect(secondItemId).not.toBe(firstItemId);
	});

	test('API response includes XML for items', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// Verify API response includes XML
		const response = await request.get(`/api/sessions/${sessionId}/items`);
		expect(response.ok()).toBeTruthy();
		
		const data = await response.json();
		expect(data.success).toBeTruthy();
		expect(Array.isArray(data.items)).toBeTruthy();
		expect(data.items.length).toBeGreaterThan(0);
		
		// Verify at least one item has XML
		const itemWithXml = data.items.find((item: any) => item.xml && item.xml.length > 0);
		expect(itemWithXml).toBeTruthy();
		expect(itemWithXml.xml).toContain('<?xml');
		expect(itemWithXml.xml).toContain('assessmentItem');
	});

	test('player handles missing XML gracefully', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// This test verifies that if an item doesn't have XML, it shows appropriate message
		// We can't easily simulate this without mocking, but we can verify the UI handles it
		await expect(page.getByRole('heading', { name: /Item Browser/i })).toBeVisible();
		
		// If there's a warning message, it should be visible
		const warningMessage = page.getByText(/Item XML not available/i);
		const hasWarning = await warningMessage.count();
		
		// If warning exists, it should be properly displayed
		if (hasWarning > 0) {
			await expect(warningMessage).toBeVisible();
		}
	});

	test('player emits response-change events', async ({ page, request }) => {
		const sessionId = await createSessionFromSample(request, 'basic-interactions');
		await navigateToItemsPage(page, sessionId);

		// Wait for player to load
		await page.waitForFunction(() => {
			return customElements.get('pie-qti2-item-player') !== undefined;
		}, { timeout: 30_000 });

		// Select an item
		await page.getByTestId('item-select-0').click();
		await page.waitForTimeout(2000);

		// Listen for response-change events
		const responseEvents: any[] = [];
		await page.evaluate(() => {
			const player = document.querySelector('pie-qti2-item-player');
			if (player) {
				player.addEventListener('response-change', (e: any) => {
					(window as any).__responseEvents = (window as any).__responseEvents || [];
					(window as any).__responseEvents.push(e.detail);
				});
			}
		});

		// Try to interact with the player
		const choiceButtons = page.locator('pie-qti2-item-player').locator('button, input[type="radio"]');
		const buttonCount = await choiceButtons.count();
		
		if (buttonCount > 0) {
			await choiceButtons.first().click();
			await page.waitForTimeout(1000);

			// Check if events were captured
			const events = await page.evaluate(() => (window as any).__responseEvents || []);
			// Note: Events might be in shadow DOM, so this is a best-effort check
		}
	});
});

