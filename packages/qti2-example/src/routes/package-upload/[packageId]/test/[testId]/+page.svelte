<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { loadPackageDataAsync, getTestXml } from '$lib/package-processor';
	import type { PackageStructure } from '$lib/package-processor';
	import XmlEditor from '$lib/components/XmlEditor.svelte';

	let testXml = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Get package data from browser storage
	let packageData = $state<PackageStructure | null>(null);

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

				testXml = getTestXml(packageData, urlTestId);
				if (!testXml) {
					throw new Error(`Test ${urlTestId} not found in package`);
				}
			} catch (err) {
				error = err instanceof Error ? err.message : 'Failed to load test';
				console.error('Error loading test:', err);
			} finally {
				loading = false;
			}
		})();
	});

	function goBack() {
		goto(`${base}/package-upload`);
	}
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
		<!-- Test Information -->
		<div class="alert alert-info">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="stroke-current shrink-0 w-6 h-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<div>
				<h3 class="font-bold">QTI Assessment/Test</h3>
				<div class="text-sm">
					Full test player functionality is not yet implemented. Below is the raw QTI test XML which
					defines the assessment structure and item ordering.
				</div>
			</div>
		</div>

		<!-- Raw XML View -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Test XML</h2>
				<XmlEditor content={testXml} readOnly={true} />
			</div>
		</div>
	{/if}
</div>
