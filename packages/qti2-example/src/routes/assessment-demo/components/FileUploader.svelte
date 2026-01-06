<script lang="ts">
	interface Props {
		isUploading: boolean;
		uploadError: string | null;
		onFileUpload: (event: Event) => void;
	}

	let { isUploading, uploadError, onFileUpload }: Props = $props();
</script>

<div class="space-y-4">
	<div class="divider">OR</div>

	<!-- File upload -->
	<div class="form-control">
		<label class="label" for="file-upload">
			<span class="label-text">Upload QTI ZIP Package</span>
		</label>
		<input
			id="file-upload"
			type="file"
			accept=".zip"
			class="file-input file-input-bordered"
			onchange={onFileUpload}
			disabled={isUploading}
		/>
	</div>

	{#if isUploading}
		<div class="alert">
			<span class="loading loading-spinner"></span>
			<span>Processing ZIP file...</span>
		</div>
	{/if}

	{#if uploadError}
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
			<span>{uploadError}</span>
		</div>
	{/if}
</div>
