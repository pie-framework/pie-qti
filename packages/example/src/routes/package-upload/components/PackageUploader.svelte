<script lang="ts">
	export let loading = false;
	export let onUpload: (file: File) => void = () => {};

	let dragOver = false;
	let fileInput: HTMLInputElement;

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			handleFile(target.files[0]);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
			handleFile(event.dataTransfer.files[0]);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleFile(file: File) {
		if (!file.name.endsWith('.zip')) {
			alert('Please select a ZIP file');
			return;
		}
		
		// Use callback prop instead of event to avoid Svelte 5 stringification
		onUpload(file);
	}

	function triggerFileInput() {
		fileInput?.click();
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title">Upload QTI Package</h2>
		<p class="text-sm text-base-content/70">
			Select a QTI package ZIP file to extract and browse its contents
		</p>

		<div
			role="button"
			tabindex="0"
			class="border-2 border-dashed rounded-lg p-12 text-center transition-colors {dragOver
				? 'border-primary bg-primary/10'
				: 'border-base-300'}"
			on:dragover={handleDragOver}
			on:dragleave={handleDragLeave}
			on:drop={handleDrop}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					triggerFileInput();
				}
			}}
		>
			{#if loading}
				<div class="flex flex-col items-center gap-4">
					<span class="loading loading-spinner loading-lg text-primary"></span>
					<p class="text-base-content/70">Processing package...</p>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-16 w-16 text-base-content/30"
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
					<div>
						<p class="text-lg font-semibold mb-2">Drag and drop a ZIP file here</p>
						<p class="text-sm text-base-content/70 mb-4">or</p>
						<button class="btn btn-primary" on:click={triggerFileInput} disabled={loading}>Browse Files</button>
					</div>
					<p class="text-xs text-base-content/50 mt-4">
						Supports IMS Content Package format with QTI 2.x items and tests
					</p>
				</div>
			{/if}
		</div>

		<input
			type="file"
			accept=".zip"
			class="hidden"
			bind:this={fileInput}
			on:change={handleFileSelect}
			disabled={loading}
		/>
	</div>
</div>
