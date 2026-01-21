<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import PackageUploader from './components/PackageUploader.svelte';
	import PackageBrowser from './components/PackageBrowser.svelte';

	const STORAGE_KEY = 'qti-package-data';

	let packageData: any = null;
	let loading = false;
	let error: string | null = null;

	// Load package data from localStorage on mount
	onMount(() => {
		if (browser) {
			try {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored) {
					packageData = JSON.parse(stored);
					console.log('Restored package data from browser storage:', packageData.packageId);
				}
			} catch (err) {
				console.error('Failed to restore package data from storage:', err);
				// Clear corrupted data
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	});

	// Save package data to localStorage
	function savePackageData(data: any) {
		if (browser) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
				console.log('Saved package data to browser storage');
			} catch (err) {
				console.error('Failed to save package data to storage:', err);
			}
		}
	}

	// Clear package data from localStorage
	function clearPackageData() {
		if (browser) {
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	async function handleUpload(file: File) {
		loading = true;
		error = null;
		packageData = null;

		try {
			// Debug: Log file info
			console.log('Frontend: Uploading file:', {
				name: file.name,
				type: file.type,
				size: file.size,
				isFile: file instanceof File,
				isBlob: file instanceof Blob
			});

			const formData = new FormData();
			formData.append('file', file);

			// Debug: Verify FormData
			const formDataFile = formData.get('file');
			console.log('Frontend: FormData file entry:', {
				type: typeof formDataFile,
				isFile: formDataFile instanceof File,
				isBlob: formDataFile instanceof Blob,
				value: formDataFile
			});

			const response = await fetch('/api/package-upload', {
				method: 'POST',
				body: formData,
				// Don't set Content-Type - let fetch set it automatically for FormData
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
				throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
			}

			const data = await response.json();
			if (data.success && data.package) {
				packageData = data.package;
				// Save to localStorage for persistence
				savePackageData(packageData);
			} else {
				throw new Error('Invalid response from server');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Upload failed';
			console.error('Upload error:', err);
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
			Upload a complete QTI package ZIP file to browse all items, tests, and assets. This tool
			extracts and parses the full package structure, allowing you to view individual items or
			complete assessments.
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
