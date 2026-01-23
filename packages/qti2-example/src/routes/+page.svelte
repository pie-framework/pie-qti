<script lang="ts">
	import { base } from '$app/paths';
	import { getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';
	import JSZip from 'jszip';

	// Get i18n from context
	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = $derived(i18nContext?.value);

	let fileInput: HTMLInputElement;
	let isDragging = $state(false);
	let selectedFile = $state<File | null>(null);
	let showFileTypeError = $state(false);
	let isProcessing = $state(false);
	let foundXmlFiles = $state<string[]>([]);
	let selectedXmlFile = $state<string | null>(null);

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			// Accept XML and ZIP files
			const fileName = file.name.toLowerCase();
			if (fileName.endsWith('.xml') || fileName.endsWith('.zip')) {
				selectedFile = file;
				foundXmlFiles = [];
				selectedXmlFile = null;
				
				// If it's a ZIP file, automatically extract and find XML files
				if (fileName.endsWith('.zip')) {
					try {
						isProcessing = true;
						foundXmlFiles = await extractXmlFromZip(file);
						if (foundXmlFiles.length > 0) {
							selectedXmlFile = foundXmlFiles[0];
						}
					} catch (err) {
						console.error('Failed to extract ZIP:', err);
						alert(`Failed to extract ZIP file: ${err instanceof Error ? err.message : 'Unknown error'}`);
					} finally {
						isProcessing = false;
					}
				}
			} else {
				showFileTypeError = true;
			}
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];
			selectedFile = file;
			foundXmlFiles = [];
			selectedXmlFile = null;
			
			// If it's a ZIP file, automatically extract and find XML files
			if (file.name.toLowerCase().endsWith('.zip')) {
				try {
					isProcessing = true;
					foundXmlFiles = await extractXmlFromZip(file);
					if (foundXmlFiles.length > 0) {
						selectedXmlFile = foundXmlFiles[0];
					}
				} catch (err) {
					console.error('Failed to extract ZIP:', err);
					alert(`Failed to extract ZIP file: ${err instanceof Error ? err.message : 'Unknown error'}`);
				} finally {
					isProcessing = false;
				}
			}
		}
	}

	async function extractXmlFromZip(file: File): Promise<string[]> {
		const zip = new JSZip();
		const zipData = await file.arrayBuffer();
		const zipContents = await zip.loadAsync(zipData);
		
		const xmlFiles: string[] = [];
		
		// Find all XML files in the ZIP
		for (const [path, zipEntry] of Object.entries(zipContents.files)) {
			if (!zipEntry.dir && path.toLowerCase().endsWith('.xml')) {
				xmlFiles.push(path);
			}
		}
		
		return xmlFiles.sort();
	}

	async function getXmlContentFromZip(file: File, xmlPath: string): Promise<string> {
		const zip = new JSZip();
		const zipData = await file.arrayBuffer();
		const zipContents = await zip.loadAsync(zipData);
		const xmlEntry = zipContents.files[xmlPath];
		
		if (!xmlEntry) {
			throw new Error(`XML file not found: ${xmlPath}`);
		}
		
		return await xmlEntry.async('string');
	}

	async function handleLoadInPlayer() {
		if (!selectedFile) return;

		try {
			isProcessing = true;
			let xmlContent: string;
			let fileName: string;

			if (selectedFile.name.toLowerCase().endsWith('.zip')) {
				// Handle ZIP file
				// Ensure we have extracted XML files
				if (foundXmlFiles.length === 0) {
					foundXmlFiles = await extractXmlFromZip(selectedFile);
					
					if (foundXmlFiles.length === 0) {
						alert('No XML files found in the ZIP archive.');
						isProcessing = false;
						return;
					}
					
					// Auto-select the first XML file if none selected
					if (!selectedXmlFile) {
						selectedXmlFile = foundXmlFiles[0];
					}
				}
				
				// Load the selected XML file
				if (!selectedXmlFile) {
					alert('Please select an XML file to preview.');
					isProcessing = false;
					return;
				}
				
				xmlContent = await getXmlContentFromZip(selectedFile, selectedXmlFile);
				fileName = selectedXmlFile.split('/').pop() || selectedXmlFile;
			} else {
				// Handle XML file (existing behavior)
				xmlContent = await selectedFile.text();
				fileName = selectedFile.name;
			}

			// Store in sessionStorage for the item-demo page to pick up
			sessionStorage.setItem('uploadedItemXml', xmlContent);
			sessionStorage.setItem('uploadedItemName', fileName);

			// Navigate to item-demo with special 'custom' sample ID
			window.location.href = `${base}/item-demo/custom`;
		} catch (err) {
			console.error('Failed to process file:', err);
			alert(`Failed to process file: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			isProcessing = false;
		}
	}
</script>

<svelte:head>
	<title>{i18n?.t('demo.appName') ?? 'PIE QTI 2.2 Player Demo'}</title>
	<meta
		name="description"
		content={i18n?.t('demo.homeMetaDescription') ?? 'Modern QTI 2.2 player with optional backend integration'}
	/>
</svelte:head>

<div class="min-h-screen flex flex-col">
	<!-- Hero Section -->
	<div class="hero bg-base-200 py-20">
		<div class="hero-content text-center">
			<div class="max-w-2xl">
				<h1 class="text-5xl font-bold mb-6">{i18n?.t('demo.homeTitle') ?? 'QTI 2.2 Player'}</h1>
				<p class="text-xl mb-8">
					{i18n?.t('demo.homeSubtitle') ?? 'A modern, framework-agnostic player for QTI 2.2 assessment items. Works 100% client-side by default, with optional server-side hooks for production use.'}
				</p>
				<div class="flex gap-4 justify-center flex-wrap">
					<a href="{base}/item-demo" class="btn btn-primary btn-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						{i18n?.t('demo.tryItems') ?? 'Try Items'}
					</a>
					<a href="{base}/assessment-demo" class="btn btn-primary btn-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
						{i18n?.t('demo.tryAssessments') ?? 'Try Assessments'}
					</a>
					<a href="{base}/likert-demo" class="btn btn-secondary btn-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
							/>
						</svg>
						{i18n?.t('demo.pluginDemo') ?? 'Plugin Demo'}
					</a>
					<a href="{base}/package-upload" class="btn btn-accent btn-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>
						Package Upload
					</a>
				</div>
			</div>
		</div>
	</div>

	<!-- Try It Section -->
	<div class="bg-base-200 pt-2 pb-8">
		<div class="container mx-auto px-8">
			<div class="max-w-3xl mx-auto">
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<div
							class="border-4 border-dashed rounded-lg p-12 text-center transition-colors {isDragging
								? 'border-primary bg-primary/5'
								: 'border-base-300'}"
							ondrop={(e) => handleDrop?.(e)}
							ondragover={(e) => handleDragOver?.(e)}
							ondragleave={(e) => handleDragLeave?.(e)}
							role="button"
							tabindex="0"
							onclick={() => fileInput.click()}
							onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-16 w-16 mx-auto mb-4 opacity-50"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
								/>
							</svg>

							{#if selectedFile}
								<p class="text-lg font-semibold mb-2">{i18n?.t('demo.selectedFile') ?? 'Selected:'} {selectedFile.name}</p>
								
								{#if selectedFile.name.toLowerCase().endsWith('.zip') && foundXmlFiles.length > 0}
									<!-- Show XML files found in ZIP -->
									<div class="w-full mt-4">
										<p class="text-sm text-base-content/70 mb-2">Found {foundXmlFiles.length} XML file{foundXmlFiles.length !== 1 ? 's' : ''}:</p>
										<select 
											class="select select-bordered w-full mb-4"
											onchange={(e) => selectedXmlFile = (e.target as HTMLSelectElement).value}
											value={selectedXmlFile || ''}
										>
											{#each foundXmlFiles as xmlFile}
												<option value={xmlFile}>{xmlFile}</option>
											{/each}
										</select>
									</div>
								{/if}
								
								<button 
									class="btn btn-primary mt-4" 
									onclick={(e) => { e.stopPropagation(); handleLoadInPlayer(); }}
									disabled={isProcessing}
								>
									{#if isProcessing}
										<span class="loading loading-spinner loading-sm"></span>
										Processing...
									{:else}
										{i18n?.t('demo.loadInPlayer') ?? 'Load in Player'}
									{/if}
								</button>
							{:else}
								<p class="text-lg font-semibold mb-2">{i18n?.t('demo.dropQtiFile') ?? 'Drop QTI XML file or ZIP folder here'}</p>
								<p class="text-base-content/60 mb-4">{i18n?.t('demo.orClickToSelect') ?? 'or click to select a file'}</p>
								<button class="btn btn-primary btn-sm">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
										/>
									</svg>
									{i18n?.t('demo.selectFile') ?? 'Select File'}
								</button>
							{/if}

							<input
								type="file"
								bind:this={fileInput}
								onchange={(e) => handleFileSelect?.(e)}
								accept=".xml,.zip"
								class="hidden"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<footer class="footer footer-center p-10 bg-base-300 text-base-content">
		<div>
			<p class="font-bold">{i18n?.t('demo.footerTitle') ?? 'QTI 2.2 Player'}</p>
			<p>{i18n?.t('demo.footerLicense') ?? 'MIT Licensed • Open Source'}</p>
		</div>
	</footer>
</div>

<!-- File Type Error Dialog -->
<dialog class="modal" class:modal-open={showFileTypeError}>
	<div class="modal-box">
		<h3 class="font-bold text-lg">Wrong File Type</h3>
		<p class="py-4">
			Please select an XML file or ZIP folder containing XML files.
		</p>
		<div class="modal-action">
			<button class="btn" onclick={() => (showFileTypeError = false)}>Close</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={() => (showFileTypeError = false)}>close</button>
	</form>
</dialog>
