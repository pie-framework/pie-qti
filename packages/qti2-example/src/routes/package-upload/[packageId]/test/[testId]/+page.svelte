<script lang="ts">
	import { getContext } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { loadPackageDataAsync, getTestXml, loadTestItems } from '$lib/package-processor';
	import type { PackageStructure } from '$lib/package-processor';
	import { assignProps } from '$lib/utils/assignProps';
	import { getSecurityConfig } from '$lib/player-config';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	// Get i18n provider from context
	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = i18nContext?.value ?? null;

	let testXml = $state<string | null>(null);
	let testItems = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let playerElement = $state<any>(null);
	let playerReady = $state(false);

	// Get package data from browser storage
	let packageData = $state<PackageStructure | null>(null);
	let testHref = $state<string | null>(null);

	// React to URL parameter changes
	$effect(() => {
		// Read dependencies - effect will re-run when these change
		const urlPackageId = $page.params.packageId || '';
		const urlTestId = $page.params.testId || '';

		if (!browser || !urlPackageId || !urlTestId) return;

		// Reset state for new test
		loading = true;
		error = null;
		testXml = null;
		testItems = {};

		// Load test asynchronously
		(async () => {
			try {
				// Load package data from browser storage
				packageData = await loadPackageDataAsync();

				if (packageData && packageData.packageId === urlPackageId) {
					// Package found
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

				// Get test XML from browser storage
				if (!packageData) {
					throw new Error('Package data not loaded');
				}

				const test = packageData.tests.find((t) => t.identifier === urlTestId);
				if (!test) {
					throw new Error(`Test ${urlTestId} not found in package`);
				}
				
				testXml = getTestXml(packageData, urlTestId);
				if (!testXml) {
					throw new Error(`Test ${urlTestId} not found in package`);
				}
				
				testHref = test.href;
				
				// Load all items referenced in the test
				testItems = await loadTestItems(testXml, packageData, test.href);
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to load test';
				console.error('Error loading test:', err);
			} finally {
				loading = false;
			}
		})();
	});

	function goBack() {
		goto('/package-upload');
	}

	// Load assessment player web component (runs once on mount)
	onMount(async () => {
		try {
			// Load web components
			await import('@pie-qti/web-component-loaders').then((m) => m.loadPieQtiPlayerElements());
			await customElements.whenDefined('pie-qti2-assessment-player');
			
			playerReady = true;
		} catch (err) {
			console.error('Error loading assessment player:', err);
			error = err instanceof Error ? err.message : 'Failed to load assessment player';
		}
	});

	// Update player properties when component is ready and data is available
	$effect(() => {
		if (!playerElement || !playerReady || !testXml || Object.keys(testItems).length === 0) return;
		
		assignProps(playerElement, {
			assessmentTestXml: testXml,
			items: testItems,
			config: {
				role: 'candidate',
				navigationMode: 'nonlinear',
				showSections: true,
				i18nProvider: i18n ?? undefined
			},
			security: getSecurityConfig()
		});
	});
</script>

<svelte:head>
	<title>QTI Test: {$page.params.testId}</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<!-- Navigation Header -->
	<div class="flex justify-between items-center">
		<div class="flex items-center gap-4">
			<button class="btn btn-outline btn-sm" onclick={goBack}>← Back to Package</button>
			<div class="divider divider-horizontal"></div>
			<div>
				<h1 class="text-2xl font-bold">Test: {$page.params.testId}</h1>
			</div>
		</div>
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
			<p class="text-base-content/70">Loading test...</p>
		</div>
	{:else if testXml}
		<!-- Assessment Player -->
		{#if playerReady && Object.keys(testItems).length > 0}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body p-0">
					<pie-qti2-assessment-player bind:this={playerElement} class="block w-full"></pie-qti2-assessment-player>
				</div>
			</div>

			<!-- Raw XML View (Collapsible) -->
			<details class="collapse collapse-arrow bg-base-200">
				<summary class="collapse-title text-lg font-medium">View Raw XML</summary>
				<div class="collapse-content">
					<pre class="text-xs overflow-x-auto p-4 bg-base-300 rounded"><code>{testXml}</code></pre>
				</div>
			</details>
		{:else if Object.keys(testItems).length === 0}
			<div class="alert alert-warning">
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
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<div>
					<h3 class="font-bold">No Items Found</h3>
					<div class="text-sm">Could not load items referenced in the test. Below is the raw QTI test XML.</div>
				</div>
			</div>
			
			<!-- Raw XML View -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Test XML</h2>
					<pre class="text-xs overflow-x-auto p-4 bg-base-300 rounded"><code>{testXml}</code></pre>
				</div>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-4 py-12">
				<span class="loading loading-spinner loading-lg text-primary"></span>
				<p class="text-base-content/70">Loading assessment player...</p>
			</div>
		{/if}
	{/if}
</div>
