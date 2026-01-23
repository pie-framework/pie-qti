<script lang="ts">
	import { getContext } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { Player } from '@pie-qti/qti2-item-player';
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/qti2-item-player/components';
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	import { typesetAction } from '@pie-qti/qti2-default-components/shared';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';
import { loadPackageDataAsync, getItemXml, resolveImagesInXml } from '$lib/package-processor';
import type { PackageStructure } from '$lib/package-processor';
import { getSecurityConfig } from '$lib/player-config';

	let itemXml = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Get package data from browser storage to enable navigation
	let packageData = $state<PackageStructure | null>(null);
	let currentItemIndex = $state(-1);
	let totalItems = $state(0);

	// Player state
	let player = $state<Player | null>(null);
	let responses = $state<Record<string, any>>({});
	let outcomeValues = $state<Record<string, any>>({});

	// Get i18n provider from context
	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = i18nContext?.value ?? null;

	// React to URL parameter changes
	$effect(() => {
		// Read dependencies - effect will re-run when these change
		const urlPackageId = $page.params.packageId || '';
		const urlItemId = $page.params.itemId || '';

		if (!browser || !urlPackageId || !urlItemId) return;

				// Reset state for new item
		loading = true;
		error = null;
		itemXml = null;
		player = null;
		responses = {};
		outcomeValues = {};

		// Load item asynchronously
		(async () => {
			try {
				// Load package data from browser storage
				packageData = await loadPackageDataAsync();

				if (packageData && packageData.packageId === urlPackageId) {
					totalItems = packageData.items.length;
					currentItemIndex = packageData.items.findIndex(
						(item) => item.identifier === urlItemId
					);
				} else if (packageData) {
					// Package ID mismatch
					error = 'Package not found. Please upload the package again.';
					loading = false;
					return;
				} else {
					error = 'No package data found. Please upload a package first.';
					loading = false;
					return;
				}

				// Get item XML from browser storage
				if (!packageData) {
					throw new Error('Package data not loaded');
				}

				const item = packageData.items.find((i) => i.identifier === urlItemId);
				if (!item) {
					throw new Error(`Item ${urlItemId} not found in package`);
				}

				let rawItemXml = getItemXml(packageData, urlItemId);
				if (!rawItemXml) {
					throw new Error(`Item ${urlItemId} not found in package`);
				}

				// Resolve images from package and replace with data URLs
				itemXml = await resolveImagesInXml(rawItemXml, packageData, item.href);
				
				// Debug: Verify images are present in resolved XML
				const hasImages = itemXml.includes('data:image/') || itemXml.includes('<img') || itemXml.includes('<object');
				console.log('[Item Load] Images present in resolved XML:', hasImages);
				if (hasImages) {
					const imgMatches = itemXml.match(/<img[^>]*src="([^"]+)"/gi);
					console.log('[Item Load] Found img tags:', imgMatches?.length || 0);
				}

				// Initialize player
				player = new Player({
					itemXml: itemXml,
					role: 'candidate',
					security: getSecurityConfig()
				});

				// Register default components
				registerDefaultComponents(player.getComponentRegistry());

				// Process initial empty responses to set up outcome values (feedback will be hidden initially)
				player.setResponses({});
				const initialResult = player.processResponses();
				outcomeValues = initialResult.outcomeValues || {};
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to load item';
				console.error('Error loading item:', err);
			} finally {
				loading = false;
			}
		})();
	});

	function navigateToItem(index: number) {
		if (packageData && packageData.items[index]) {
			const item = packageData.items[index];
			goto(`/package-upload/${$page.params.packageId}/item/${item.identifier}`);
		}
	}

	function goToPrevious() {
		if (currentItemIndex > 0) {
			navigateToItem(currentItemIndex - 1);
		}
	}

	function goToNext() {
		if (currentItemIndex >= 0 && currentItemIndex < totalItems - 1) {
			navigateToItem(currentItemIndex + 1);
		}
	}

	function goBack() {
		goto('/package-upload');
	}

	function handleResponseChange(responseId: string, value: any) {
		responses = { ...responses, [responseId]: value };
		// Process responses to get outcome values for feedback visibility
		if (player) {
			try {
				player.setResponses(responses);
				const result = player.processResponses();
				outcomeValues = result.outcomeValues || {};
				
				// For preview mode: If FEEDBACK outcome exists but wasn't set by response processing,
				// automatically set it to the selected choice identifier to enable feedbackInline display.
				// This makes feedback work "out of the box" even with simple templates like CC2_match
				// that only set SCORE, not FEEDBACK.
				if (!outcomeValues.FEEDBACK && value && itemXml) {
					// Check if FEEDBACK outcome is declared in the XML
					const hasFeedbackOutcome = itemXml.includes('outcomeDeclaration identifier="FEEDBACK"');
					if (hasFeedbackOutcome) {
						// Set FEEDBACK to the selected choice identifier (for single choice)
						// or first selected choice (for multiple choice)
						const feedbackValue = Array.isArray(value) ? value[0] : value;
						outcomeValues = { ...outcomeValues, FEEDBACK: feedbackValue };
					}
				}
			} catch (err) {
				// If processing fails, clear outcome values (feedback will be hidden)
				outcomeValues = {};
			}
		}
	}

	function copyXmlToClipboard() {
		if (itemXml) {
			navigator.clipboard.writeText(itemXml).then(() => {
				// Show a brief success message (you could use a toast library here)
				const button = document.querySelector('.copy-xml-btn') as HTMLElement;
				if (button) {
					const originalText = button.textContent;
					button.textContent = 'Copied!';
					setTimeout(() => {
						button.textContent = originalText;
					}, 2000);
				}
			}).catch((err) => {
				console.error('Failed to copy XML to clipboard:', err);
			});
		}
	}
</script>

<svelte:head>
	<title>QTI Item: {$page.params.itemId}</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<!-- Navigation Header -->
	<div class="flex justify-between items-center">
		<div class="flex items-center gap-4">
			<button class="btn btn-outline btn-sm" onclick={goBack}>← Back to Package</button>
			<div class="divider divider-horizontal"></div>
			<div>
				<h1 class="text-2xl font-bold">Item: {$page.params.itemId}</h1>
				{#if currentItemIndex >= 0}
					<p class="text-sm text-base-content/70">
						Item {currentItemIndex + 1} of {totalItems}
					</p>
				{/if}
			</div>
		</div>

		{#if packageData && totalItems > 1}
			<div class="flex gap-2">
				<button
					class="btn btn-sm btn-outline"
					onclick={goToPrevious}
					disabled={currentItemIndex <= 0}
				>
					← Previous
				</button>
				<button
					class="btn btn-sm btn-outline"
					onclick={goToNext}
					disabled={currentItemIndex >= totalItems - 1}
				>
					Next →
				</button>
			</div>
		{/if}
	</div>

	{#if error}
		<div class="alert alert-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<div>
				<h3 class="font-bold">Error</h3>
				<div class="text-sm">{error}</div>
			</div>
		</div>
	{:else if loading}
		<div class="flex flex-col items-center gap-4 py-12">
			<span class="loading loading-spinner loading-lg text-primary"></span>
			<p class="text-base-content/70">Loading item...</p>
		</div>
	{:else if player && itemXml}
		<!-- QTI Item Player -->
		<div class="card bg-base-100 shadow-xl" use:typesetAction={{ typeset: (el) => typesetMathInElement(el) }}>
			<div class="card-body">
				<ItemBody
					{player}
					{responses}
					{outcomeValues}
					disabled={false}
					role="candidate"
					i18n={i18n ?? undefined}
					typeset={typesetMathInElement}
					onResponseChange={handleResponseChange}
				/>
			</div>
		</div>

		<!-- Raw XML View (Collapsible) -->
		<details class="collapse collapse-arrow bg-base-200">
			<summary class="collapse-title text-lg font-medium">View Raw XML</summary>
			<div class="collapse-content">
				<div class="flex justify-end mb-2">
					<button
						class="btn btn-sm btn-outline copy-xml-btn"
						onclick={copyXmlToClipboard}
						disabled={!itemXml}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 mr-1"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
						Copy to Clipboard
					</button>
				</div>
				<pre class="text-xs overflow-x-auto p-4 bg-base-300 rounded"><code>{itemXml}</code></pre>
			</div>
		</details>
	{/if}
</div>
