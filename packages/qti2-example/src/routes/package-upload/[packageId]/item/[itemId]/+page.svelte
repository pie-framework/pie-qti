<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import '@pie-qti/qti2-item-player';

	let itemXml: string | null = null;
	let loading = true;
	let error: string | null = null;
	let packageId: string = '';
	let itemId: string = '';

	// Get package data from localStorage to enable navigation
	let packageData: any = null;
	let currentItemIndex = -1;
	let totalItems = 0;

	onMount(async () => {
		// Get params from URL
		packageId = $page.params.packageId || '';
		itemId = $page.params.itemId || '';

		// Load package data from localStorage for navigation
		if (browser) {
			try {
				const stored = localStorage.getItem('qti-package-data');
				if (stored) {
					packageData = JSON.parse(stored);
					if (packageData.packageId === packageId) {
						totalItems = packageData.items.length;
						currentItemIndex = packageData.items.findIndex(
							(item: any) => item.identifier === itemId
						);
					}
				}
			} catch (err) {
				console.error('Failed to load package data:', err);
			}
		}

		// Fetch item XML
		try {
			const response = await fetch(`/api/package-upload/${packageId}/item/${itemId}`);
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Failed to load item' }));
				throw new Error(errorData.error || `Failed to load item: ${response.statusText}`);
			}

			const data = await response.json();
			if (data.success && data.xml) {
				itemXml = data.xml;
			} else {
				throw new Error('Invalid response from server');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load item';
			console.error('Error loading item:', err);
		} finally {
			loading = false;
		}
	});

	function navigateToItem(index: number) {
		if (packageData && packageData.items[index]) {
			const item = packageData.items[index];
			window.location.href = `/package-upload/${packageId}/item/${item.identifier}`;
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
		window.location.href = '/package-upload';
	}
</script>

<svelte:head>
	<title>QTI Item: {itemId}</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<!-- Navigation Header -->
	<div class="flex justify-between items-center">
		<div class="flex items-center gap-4">
			<button class="btn btn-outline btn-sm" on:click={goBack}>← Back to Package</button>
			<div class="divider divider-horizontal"></div>
			<div>
				<h1 class="text-2xl font-bold">Item: {itemId}</h1>
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
					on:click={goToPrevious}
					disabled={currentItemIndex <= 0}
				>
					← Previous
				</button>
				<button
					class="btn btn-sm btn-outline"
					on:click={goToNext}
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
	{:else if itemXml}
		<!-- QTI Item Player -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<pie-qti2-item-player xml={itemXml}></pie-qti2-item-player>
			</div>
		</div>

		<!-- Raw XML View (Collapsible) -->
		<details class="collapse collapse-arrow bg-base-200">
			<summary class="collapse-title text-lg font-medium">View Raw XML</summary>
			<div class="collapse-content">
				<pre class="text-xs overflow-x-auto p-4 bg-base-300 rounded"><code>{itemXml}</code></pre>
			</div>
		</details>
	{/if}
</div>
