import { expect, test } from '@playwright/test';

const silenceWavBase64 =
	'UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function speechMarksForText(text: string) {
	return Array.from(text.matchAll(/\S+/g)).map((match, index) => ({
		time: index * 80,
		type: 'word',
		start: match.index ?? 0,
		end: (match.index ?? 0) + match[0].length,
		value: match[0],
	}));
}

test.describe('section player web components', () => {
	test('regular demo homepage links to the section player passage demo', async ({ page }) => {
		await page.goto('/');

		const link = page.getByRole('link', { name: /section player/i });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', /\/wc-section-splitpane$/);
	});

	test('split-pane route renders shared passage and nested item player', async ({ page }) => {
		await page.goto('/wc-section-splitpane');

		const host = page.locator('pie-qti-section-player-splitpane');
		await expect(host.getByRole('heading', { name: 'Reading Passage', exact: true })).toBeVisible();
		await expect(host.locator('pie-qti-item-player')).toBeAttached();
		await expect(host.locator('math').first()).toBeVisible();
	});

	test('split-pane route exposes TTS and calculator tools for math content', async ({ page }) => {
		const ttsRequests: unknown[] = [];
		const failedIconRequests: string[] = [];
		await page.addInitScript(() => {
			HTMLMediaElement.prototype.play = function () {
				setTimeout(() => this.dispatchEvent(new Event('ended')), 0);
				return Promise.resolve();
			};
		});
		await page.route('**/api/tts/synthesize', async (route) => {
			ttsRequests.push(route.request().postDataJSON());
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					audio: silenceWavBase64,
					contentType: 'audio/wav',
					speechMarks: [],
					metadata: { providerId: 'test', voice: 'Joanna', duration: 0, charCount: 1, cached: false },
				}),
			});
		});
		await page.route('**/api/tools/desmos/auth', async (route) => {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({ apiKey: null, config: { settingsMenu: true } }),
			});
		});
		page.on('response', (response) => {
			if (response.status() >= 400 && response.url().includes('/_fa-pro/')) {
				failedIconRequests.push(response.url());
			}
		});

		await page.goto('/wc-section-splitpane');
		const host = page.locator('pie-qti-section-player-splitpane');
		await expect(host.locator('pie-qti-item-player')).toBeAttached({ timeout: 40_000 });

		await expect(page.locator('pie-assessment-toolkit').first()).toBeAttached();
		await expect(page.locator('pie-item-toolbar').first()).toBeAttached();
		await expect(page.locator('pie-tool-tts-inline').first()).toBeAttached();
		const calculatorButton = page.getByRole('button', { name: /calculator/i });
		await expect(calculatorButton).toBeVisible();
		await expect
			.poll(async () => {
				return calculatorButton.evaluate((button) => {
					const fallback = button.querySelector('[data-pie-qti-icon-fallback="calculator"]');
					if (!(fallback instanceof HTMLElement || fallback instanceof SVGElement)) return false;
					const rect = fallback.getBoundingClientRect();
					const style = window.getComputedStyle(fallback);
					return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
				});
			})
			.toBe(true);
		await page.locator('pie-item-toolbar[item-id="q-passage-choice"] pie-tool-tts-inline button').first().click();
		await expect.poll(() => ttsRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
		expect(ttsRequests[0]).toMatchObject({
			provider: 'polly',
			engine: 'standard',
		});
		await expect
			.poll(
				() => {
					const text = ttsRequests.map((request) => JSON.stringify(request)).join(' ');
					return text.includes('interpret-as') && text.includes('squared plus') && text.includes('Select the correct solution set');
				},
				{ timeout: 10_000 },
			)
			.toBe(true);
		const synthesizedText = ttsRequests.map((request) => JSON.stringify(request)).join(' ');
		expect(synthesizedText).toContain('interpret-as');
		expect(synthesizedText).toContain('squared plus');
		expect(synthesizedText).toContain('Select the correct solution set');

		await page.getByRole('button', { name: /calculator/i }).click();
		await expect(page.locator('pie-tool-calculator')).toBeAttached();
		await expect
			.poll(async () => {
				return page.locator('nds-icon-button').evaluateAll((buttons) => {
					return (
						buttons.length > 0 &&
						buttons.every((button) => button.shadowRoot?.querySelector('[data-pie-qti-icon-fallback]') ?? button.querySelector('[data-pie-qti-icon-fallback]'))
					);
				});
			})
			.toBe(true);
		expect(failedIconRequests).toEqual([]);
	});

	test('split-pane route marks passage text while TTS is playing', async ({ page }) => {
		await page.addInitScript(() => {
			HTMLMediaElement.prototype.play = function () {
				this.dispatchEvent(new Event('play'));
				return Promise.resolve();
			};
		});
		await page.route('**/api/tts/synthesize', async (route) => {
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					audio: silenceWavBase64,
					contentType: 'audio/wav',
					speechMarks: [
						{ time: 0, type: 'word', start: 0, end: 7, value: 'Reading' },
						{ time: 50, type: 'word', start: 8, end: 15, value: 'Passage' },
					],
					metadata: { providerId: 'test', voice: 'Joanna', duration: 5, charCount: 15, cached: false },
				}),
			});
		});

		await page.goto('/wc-section-splitpane');
		const host = page.locator('pie-qti-section-player-splitpane');
		await expect(host.locator('pie-qti-item-player')).toBeAttached({ timeout: 40_000 });

		await page.locator('pie-item-toolbar[item-id="passage-0"] pie-tool-tts-inline button').first().click();

		await expect(page.locator('[data-pie-tts-sentence-element="true"]')).toContainText(/Reading Passage/i, { timeout: 10_000 });
		await expect(page.locator('[data-pie-qti-tts-word-range-fallback="true"]').first()).toBeVisible({ timeout: 10_000 });
		await expect
			.poll(async () => {
				return page.locator('[data-pie-qti-tts-word-range-fallback="true"]').evaluateAll((overlays) =>
					overlays.some((overlay) => {
						const rect = overlay.getBoundingClientRect();
						return rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0;
					}),
				);
			})
			.toBe(true);
	});

	test('split-pane route maps projected interaction TTS tracking to visible question content', async ({ page }) => {
		await page.addInitScript(() => {
			HTMLMediaElement.prototype.play = function () {
				this.dispatchEvent(new Event('play'));
				let tick = 0;
				const interval = window.setInterval(() => {
					this.currentTime = tick * 0.08;
					tick += 1;
					if (tick > 18) {
						window.clearInterval(interval);
						this.dispatchEvent(new Event('ended'));
					}
				}, 80);
				return Promise.resolve();
			};
		});
		await page.route('**/api/tts/synthesize', async (route) => {
			const body = route.request().postDataJSON() as { text?: string };
			await route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					audio: silenceWavBase64,
					contentType: 'audio/wav',
					speechMarks: speechMarksForText(body.text ?? ''),
					metadata: { providerId: 'test', voice: 'Joanna', duration: 5, charCount: 15, cached: false },
				}),
			});
		});

		await page.goto('/wc-section-splitpane');
		const host = page.locator('pie-qti-section-player-splitpane');
		await expect(host.locator('pie-qti-item-player')).toBeAttached({ timeout: 40_000 });
		await page.evaluate(() => {
			const state = { prompt: false, choice: false, choiceWord: false };
			(window as typeof window & { __qtiTtsTrackingSeen?: typeof state }).__qtiTtsTrackingSeen = state;
			const collectRoots = (root: ParentNode, roots: ParentNode[] = []) => {
				roots.push(root);
				for (const element of Array.from(root.querySelectorAll('*'))) {
					if (element.shadowRoot) collectRoots(element.shadowRoot, roots);
				}
				return roots;
			};
			const inspect = () => {
				const roots = collectRoots(document);
				const query = (selector: string) => roots.flatMap((root) => Array.from(root.querySelectorAll(selector)));
				state.prompt ||= query('.qti-choice-prompt[data-pie-tts-sentence-element="true"]').length > 0;
				state.choice ||= query('.qti-choice-text[data-pie-tts-sentence-element="true"]').some((element) => element.textContent?.includes('x=-2 or x=-3'));
				const choice = query('.qti-choice-text').find((element) => element.textContent?.includes('x=-2 or x=-3'));
				const choiceRect = choice?.getBoundingClientRect();
				if (choiceRect) {
					state.choiceWord ||= query('[data-pie-qti-tts-word-range-fallback="true"]').some((overlay) => {
						const rect = overlay.getBoundingClientRect();
						return rect.width > 0 && rect.height > 0 && rect.x >= choiceRect.x && rect.x <= choiceRect.x + choiceRect.width && rect.y >= choiceRect.y && rect.y <= choiceRect.y + choiceRect.height;
					});
				}
			};
			window.setInterval(inspect, 50);
			inspect();
		});

		await page.locator('pie-item-toolbar[item-id="q-passage-choice"] pie-tool-tts-inline button').first().click();

		await expect
			.poll(async () => {
				return page.evaluate(() => (window as typeof window & { __qtiTtsTrackingSeen?: { prompt: boolean } }).__qtiTtsTrackingSeen?.prompt ?? false);
			}, { timeout: 15_000 })
			.toBe(true);
		await expect
			.poll(async () => {
				return page.evaluate(() => (window as typeof window & { __qtiTtsTrackingSeen?: { choice: boolean } }).__qtiTtsTrackingSeen?.choice ?? false);
			}, { timeout: 15_000 })
			.toBe(true);
		await expect
			.poll(async () => {
				return page.evaluate(() => (window as typeof window & { __qtiTtsTrackingSeen?: { choiceWord: boolean } }).__qtiTtsTrackingSeen?.choiceWord ?? false);
			}, { timeout: 15_000 })
			.toBe(true);
	});

	test('vertical route renders nested item player without passage text', async ({ page }) => {
		await page.goto('/wc-section-vertical');

		await expect(page.getByRole('heading', { name: 'Web Component: Section Player Vertical' })).toBeVisible();
		await expect(page.getByText(/Status:\s*rendered/i)).toBeVisible({ timeout: 40_000 });

		const host = page.locator('pie-qti-section-player-vertical');
		await expect(host.locator('pie-qti-item-player')).toBeAttached();
		await expect(host.getByText('Reading Passage')).toHaveCount(0);
	});

	test('choice selection emits section response delta identifiers', async ({ page }) => {
		await page.goto('/wc-section-splitpane');
		const host = page.locator('pie-qti-section-player-splitpane');
		await expect(host.locator('pie-qti-item-player')).toBeAttached({ timeout: 40_000 });

		const firstChoiceRadio = page.locator('pie-qti-choice').first().locator('input[type="radio"]').first();
		await firstChoiceRadio.click();

		const delta = page.getByTestId('section-delta');
		await expect(delta).toContainText('"sectionIdentifier":"section-passage"');
		await expect(delta).toContainText('"itemIdentifier":"q-passage-choice"');
		await expect(delta).toContainText('"responseIdentifier":"RESPONSE"');
		await expect(delta).toContainText('"value"');
	});
});
