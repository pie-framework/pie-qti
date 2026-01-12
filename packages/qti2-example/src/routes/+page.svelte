<script lang="ts">
	import { base } from '$app/paths';
	import { getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	// Get i18n from context
	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = $derived(i18nContext?.value);

	let fileInput: HTMLInputElement;
	let isDragging = $state(false);
	let selectedFile = $state<File | null>(null);

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			selectedFile = files[0];
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

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			selectedFile = target.files[0];
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
								<a href="{base}/item-demo" class="btn btn-primary mt-4">{i18n?.t('demo.loadInPlayer') ?? 'Load in Player'}</a>
							{:else}
								<p class="text-lg font-semibold mb-2">{i18n?.t('demo.dropQtiFile') ?? 'Drop QTI XML file here'}</p>
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
								accept=".xml"
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
