<script lang="ts">
	/**
	 * File upload component for uploadInteraction
	 *
	 * Produces a serializable QTIFileResponse (dataUrl-based) so session state / exports work.
	 */

	import type { QTIFileResponse } from '@pie-qti/qti2-item-player';

	interface Props {
		/** Optional label shown above the input */
		label?: string;
		/** Response id (used for stable ids/test selectors) */
		responseId: string;
		/** Allowed file types (MIME types and/or extensions); empty means accept any */
		fileTypes?: string[];
		disabled?: boolean;
		value?: QTIFileResponse | null;
		onChange: (value: QTIFileResponse | null) => void;
		/** Optional test id for the input */
		testId?: string;
	}

	const {
		label = 'Upload a file',
		responseId,
		fileTypes = [],
		disabled = false,
		value = null,
		onChange,
		testId,
	}: Props = $props();

	let error = $state<string>('');

	const acceptAttr = $derived(() => (fileTypes.length > 0 ? fileTypes.join(',') : undefined));

	async function fileToResponse(file: File): Promise<QTIFileResponse> {
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ''));
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});

		return {
			name: file.name,
			type: file.type,
			size: file.size,
			lastModified: file.lastModified,
			dataUrl,
		};
	}

	async function handleFileChange(e: Event) {
		error = '';
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			onChange(null);
			return;
		}

		// Best-effort type check: fileTypes may contain mime types and/or extensions
		if (fileTypes.length > 0) {
			const allowed = fileTypes.some((t) => {
				const trimmed = t.trim();
				if (!trimmed) return false;
				if (trimmed.startsWith('.')) return file.name.toLowerCase().endsWith(trimmed.toLowerCase());
				if (trimmed.includes('/')) return file.type === trimmed;
				return false;
			});
			if (!allowed) {
				error = `File type not allowed. Allowed: ${fileTypes.join(', ')}`;
				input.value = '';
				onChange(null);
				return;
			}
		}

		const response = await fileToResponse(file);
		onChange(response);
	}

	function clear() {
		error = '';
		onChange(null);
		const el = document.getElementById(`upload-${responseId}`) as HTMLInputElement | null;
		if (el) el.value = '';
	}
</script>

<div class="space-y-2" role="group" aria-label={label}>
	<label class="label" for={`upload-${responseId}`}>
		<span class="label-text font-semibold">{label}</span>
	</label>

	<input
		id={`upload-${responseId}`}
		data-testid={testId}
		class="file-input file-input-bordered w-full"
		type="file"
		accept={acceptAttr}
		disabled={disabled}
		onchange={handleFileChange}
	/>

	{#if fileTypes.length > 0}
		<div class="text-xs text-base-content/70">Allowed: {fileTypes.join(', ')}</div>
	{/if}

	{#if error}
		<div class="alert alert-error py-2">
			<span class="text-sm">{error}</span>
		</div>
	{/if}

	{#if value}
		<div class="flex items-start justify-between gap-4">
			<div class="text-sm">
				<div><strong>Selected:</strong> {value.name}</div>
				<div class="text-xs text-base-content/70">{value.type || 'unknown'} • {value.size} bytes</div>
			</div>
			<button type="button" class="btn btn-sm" onclick={clear} disabled={disabled}>Remove</button>
		</div>
	{/if}
</div>


