<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import PackageUploader from './components/PackageUploader.svelte';
	import PackageBrowser from './components/PackageBrowser.svelte';
	import { processPackage, loadPackageData, clearPackageData } from '$lib/package-processor';
	import type { PackageStructure } from '$lib/package-processor';

	let packageData: PackageStructure | null = null;
	let loading = false;
	let error: string | null = null;

	// Load package data from browser storage on mount
	onMount(() => {
		if (browser) {
			try {
				const stored = loadPackageData();
				if (stored) {
					packageData = stored;
					console.log('Restored package data from browser storage:', packageData.packageId);
				}
			} catch (err) {
				console.error('Failed to restore package data from storage:', err);
				// Clear corrupted data
				clearPackageData();
			}
		}
	});

	async function handleUpload(file: File) {
		loading = true;
		error = null;
		packageData = null;

		try {
			console.log('Processing package client-side:', {
				name: file.name,
				type: file.type,
				size: file.size
			});

			// Process the package entirely in the browser
			packageData = await processPackage(file);

			console.log('Package processed successfully:', packageData.packageId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to process package';
			console.error('Package processing error:', err);
		} finally {
			loading = false;
		}
	}

	function handleReset() {
		packageData = null;
		error = null;
		clearPackageData();
	}
</script>

<svelte:head>
	<title>QTI Package Upload</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
	<div class="prose max-w-none">
		<h1>QTI Package Upload</h1>
		<p>
			<strong>Note:</strong> Processing happens entirely in your browser and consumes local memory and storage.
			Large packages may impact performance.
		</p>
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
				<h3 class="font-bold">Upload Error</h3>
				<div class="text-sm">{error}</div>
			</div>
		</div>
	{/if}

	{#if !packageData}
		<PackageUploader onUpload={handleUpload} {loading} />
	{:else}
		<div class="flex justify-between items-center mb-4">
			<div>
				<h2 class="text-2xl font-bold">Package Contents</h2>
				<p class="text-sm text-base-content/70 mt-1">
					Package ID: <code class="text-xs">{packageData.packageId}</code>
					<span class="ml-2 text-xs badge badge-success">Saved in browser</span>
				</p>
			</div>
			<button class="btn btn-outline btn-sm" on:click={handleReset}>Upload New Package</button>
		</div>
		<PackageBrowser {packageData} />
	{/if}
</div>
