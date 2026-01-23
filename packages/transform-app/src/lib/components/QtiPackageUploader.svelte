<script lang="ts">
	/**
	 * Reusable QTI Package Uploader Component
	 * Provides drag-and-drop and file selection for ZIP files
	 */

	interface Props {
		loading?: boolean;
		multiple?: boolean;
		onUpload: (files: FileList) => void;
		maxSizeMB?: number;
	}

	let { loading = false, multiple = true, onUpload, maxSizeMB = 500 }: Props = $props();

	let _isDragging = $state(false);
	let _fileInput: HTMLInputElement;

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		_isDragging = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFiles(files);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		_isDragging = true;
	}

	function handleDragLeave() {
		_isDragging = false;
	}

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			handleFiles(target.files);
		}
	}

	function handleFiles(files: FileList) {
		// Validate ZIP files
		for (let i = 0; i < files.length; i++) {
			if (!files[i].name.endsWith('.zip')) {
				alert('Only ZIP files are allowed');
				return;
			}
			if (maxSizeMB && files[i].size > maxSizeMB * 1024 * 1024) {
				alert(`File too large: ${files[i].name}. Maximum size is ${maxSizeMB}MB.`);
				return;
			}
		}

		onUpload(files);
	}

	function triggerFileInput() {
		_fileInput?.click();
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<div
			class="border-4 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer {_isDragging
				? 'border-primary bg-primary/5'
				: 'border-base-300'}"
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			role="button"
			tabindex="0"
			onclick={triggerFileInput}
			onkeydown={(e) => e.key === 'Enter' && triggerFileInput()}
		>
			{#if loading}
				<div class="mb-4">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
				<p class="text-lg font-semibold">Processing...</p>
			{:else}
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
				<p class="text-lg font-semibold mb-2">Drop QTI ZIP files here</p>
				<p class="text-base-content/60 mb-4">or click to select files</p>
				<span class="btn btn-primary btn-sm pointer-events-none">
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
					Select Files
				</span>
			{/if}

			<input
				type="file"
				bind:this={_fileInput}
				onchange={handleFileSelect}
				accept=".zip"
				multiple={multiple}
				class="hidden"
				disabled={loading}
			/>
		</div>
	</div>
</div>
