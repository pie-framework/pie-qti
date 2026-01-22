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
	import { loadPackageDataAsync, getItemXml } from '$lib/package-processor';
	import type { PackageStructure } from '$lib/package-processor';
	import { getSecurityConfig } from '$lib/player-config';
	import XmlEditor from '$lib/components/XmlEditor.svelte';

	let itemXml = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Get package data from browser storage to enable navigation
	let packageData = $state<PackageStructure | null>(null);
	let currentItemIndex = $state(-1);
	let totalItems = $state(0);
	let itemTitle = $state<string | null>(null);
	let itemMetadata = $state<any>(null);

	// Player state
	let player = $state<Player | null>(null);
	let responses = $state<Record<string, any>>({});

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

					// Get the item title and metadata if available
					const currentItem = packageData.items.find((item) => item.identifier === urlItemId);
					if (currentItem) {
						itemTitle = currentItem.title || null;
						itemMetadata = currentItem.metadata || null;
					}
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

				itemXml = getItemXml(packageData, urlItemId);
				if (!itemXml) {
					throw new Error(`Item ${urlItemId} not found in package`);
				}

				// Initialize player
				player = new Player({
					itemXml: itemXml,
					role: 'candidate',
					security: getSecurityConfig()
				});

				// Register default components
				registerDefaultComponents(player.getComponentRegistry());
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
	}
</script>

<svelte:head>
	<title>{itemTitle ? `${itemTitle} - QTI Item` : `QTI Item: ${$page.params.itemId}`}</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<!-- Navigation Header -->
	<div class="flex justify-between items-center">
		<div class="flex items-center gap-4">
			<button class="btn btn-outline btn-sm" onclick={goBack}>← Back to Package</button>
			<div class="divider divider-horizontal"></div>
			<div>
				<h1 class="text-2xl font-bold">
					{itemTitle || `Item: ${$page.params.itemId}`}
				</h1>
				{#if currentItemIndex >= 0}
					<p class="text-sm text-base-content/70">
						Item {currentItemIndex + 1} of {totalItems}
						{#if itemTitle}
							<span class="ml-2 text-xs opacity-70">({$page.params.itemId})</span>
						{/if}
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
					disabled={false}
					role="candidate"
					i18n={i18n ?? undefined}
					typeset={typesetMathInElement}
					onResponseChange={handleResponseChange}
				/>
			</div>
		</div>

		<!-- Metadata View (Collapsible) -->
		{#if itemMetadata}
			<details class="collapse collapse-arrow bg-base-200">
				<summary class="collapse-title text-lg font-medium">Item Metadata</summary>
				<div class="collapse-content space-y-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#if itemMetadata.identifier}
							<div>
								<h3 class="font-semibold text-sm text-base-content/70">Identifier</h3>
								<code class="text-xs">{itemMetadata.identifier}</code>
							</div>
						{/if}

						{#if itemMetadata.title}
							<div>
								<h3 class="font-semibold text-sm text-base-content/70">Title</h3>
								<p>{itemMetadata.title}</p>
							</div>
						{/if}

						{#if itemMetadata.interactionTypes && itemMetadata.interactionTypes.length > 0}
							<div>
								<h3 class="font-semibold text-sm text-base-content/70">Interaction Types</h3>
								<div class="flex flex-wrap gap-1 mt-1">
									{#each itemMetadata.interactionTypes as interactionType}
										<span class="badge badge-sm badge-primary">{interactionType}</span>
									{/each}
								</div>
							</div>
						{/if}

						{#if itemMetadata.searchMetadata && Object.keys(itemMetadata.searchMetadata).length > 0}
							<div class="md:col-span-2">
								<h3 class="font-semibold text-sm text-base-content/70">Search Metadata</h3>
								<div class="bg-base-300 rounded p-3 mt-1">
									<pre class="text-xs">{JSON.stringify(itemMetadata.searchMetadata, null, 2)}</pre>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</details>
		{/if}

		<!-- Raw XML View (Collapsible) -->
		<details class="collapse collapse-arrow bg-base-200">
			<summary class="collapse-title text-lg font-medium">View Raw XML</summary>
			<div class="collapse-content pt-4">
				<XmlEditor content={itemXml} readOnly={true} />
			</div>
		</details>
	{/if}
</div>
