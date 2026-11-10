<script lang="ts">
	import '../styles/srOnly.js';
	/**
	 * File upload component for uploadInteraction
	 *
	 * Produces a serializable QTIFileResponse (dataUrl-based) so session state / exports work.
	 */

	import type { QTIFileResponse } from '@pie-qti/item-player';
	import { translate, type I18nProvider } from '@pie-qti/i18n';

	const DEFAULT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

	interface Props {
		/** Optional label shown above the input */
		label?: string;
		/** Response id (used for stable ids/test selectors) */
		responseId: string;
		/** Allowed file types (MIME types and/or extensions); empty means accept any */
		fileTypes?: string[];
		/** Maximum accepted file size in bytes; use Infinity to disable the cap */
		maxFileSizeBytes?: number;
		disabled?: boolean;
		value?: QTIFileResponse | null;
		onChange: (value: QTIFileResponse | null) => void;
		/** Optional test id for the input */
		testId?: string;
		/** Optional i18n provider for translations */
		i18n?: I18nProvider;
	}

	const {
		label,
		responseId,
		fileTypes = [],
		maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE_BYTES,
		disabled = false,
		value = null,
		onChange,
		testId,
		i18n,
	}: Props = $props();

	// Translations: every string carries an English fallback, so a missing catalog
	// entry never reaches a candidate as a raw key.
	const translations = $derived({
		label: translate(i18n, 'interactions.upload.label', 'Upload a file'),
		allowedTypes: translate(i18n, 'interactions.upload.allowedTypes', 'Allowed file types:'),
		selectedFile: translate(i18n, 'interactions.upload.selectedFile', 'Selected:'),
		unknownType: translate(i18n, 'interactions.upload.unknownType', 'Unknown file type'),
		removeFile: translate(i18n, 'interactions.upload.removeFile', 'Remove file'),
		fileRemoved: translate(i18n, 'interactions.upload.fileRemoved', 'File removed.'),
		errorReadFailed: translate(i18n, 'interactions.upload.errorReadFailed', 'Failed to read file'),
		errorInvalidType: (types: string) =>
			translate(i18n, 'interactions.upload.errorInvalidType', 'File type not allowed. Allowed: {types}', { types }),
		errorFileTooLarge: (filename: string, maxBytes: number) =>
			translate(
				i18n,
				'interactions.upload.errorFileTooLarge',
				'File {filename} is too large. Maximum size is {maxBytes} bytes.',
				{ filename, maxBytes },
			),
		fileSize: (size: number) => translate(i18n, 'interactions.upload.fileSize', '{size} bytes', { size }),
	});

	// Use label prop or fallback to translated text
	const displayLabel = $derived(label || translations.label);
	const effectiveMaxFileSizeBytes = $derived(
		maxFileSizeBytes === Number.POSITIVE_INFINITY ||
			(Number.isFinite(maxFileSizeBytes) && maxFileSizeBytes >= 0)
			? maxFileSizeBytes
			: DEFAULT_MAX_FILE_SIZE_BYTES,
	);

	let error = $state<string>('');

	// The native file input, bound: resetting its value needs the element itself (see clear).
	let inputElement: HTMLInputElement | null = $state(null);

	// Polite announcement of a removal, for the live region below: the remove button
	// deletes itself with the response, so the region is what reports what happened.
	let removalAnnouncement = $state('');

	const acceptAttr = $derived(fileTypes.length > 0 ? fileTypes.join(',') : undefined);
	const allowedTypesId = $derived(fileTypes.length > 0 ? `upload-${responseId}-allowed-types` : undefined);
	const errorId = $derived(error ? `upload-${responseId}-error` : undefined);
	const describedBy = $derived([allowedTypesId, errorId].filter(Boolean).join(' ') || undefined);

	async function fileToResponse(file: File): Promise<QTIFileResponse> {
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ''));
			reader.onerror = () => reject(new Error(translations.errorReadFailed));
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

		// Reject before FileReader/base64 conversion, which otherwise creates an
		// additional in-memory copy roughly one third larger than the source file.
		if (file.size > effectiveMaxFileSizeBytes) {
			error = translations.errorFileTooLarge(file.name, effectiveMaxFileSizeBytes);
			input.value = '';
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
				error = translations.errorInvalidType(fileTypes.join(', '));
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
		// The remove button deletes itself with the response, which would drop keyboard
		// focus to the document; the native input is the interaction's surviving control.
		inputElement?.focus();
		// A bound reference, not document.getElementById: the component renders inside the
		// interaction's shadow root, where a document lookup cannot see the input.
		// Resetting the value also lets the candidate re-choose the same file.
		if (inputElement) inputElement.value = '';
		removalAnnouncement = removalAnnouncement === translations.fileRemoved ? `${translations.fileRemoved}\u200b` : translations.fileRemoved;
	}
</script>

<div class="space-y-2" role="group" aria-label={displayLabel}>
	<label class="label" for={`upload-${responseId}`}>
		<span class="label-text font-semibold">{displayLabel}</span>
	</label>

	<input
		bind:this={inputElement}
		id={`upload-${responseId}`}
		data-testid={testId}
		class="file-input file-input-bordered w-full"
		type="file"
		accept={acceptAttr}
		aria-describedby={describedBy}
		aria-invalid={error ? 'true' : undefined}
		disabled={disabled}
		onchange={handleFileChange}
	/>

	<!-- Polite removal announcements that survive the removed control itself. -->
	<div aria-live="polite" aria-atomic="true" class="qti-upload-live-region">{removalAnnouncement}</div>

	{#if fileTypes.length > 0}
		<div id={allowedTypesId} class="text-xs text-base-content/70">
			{translations.allowedTypes} {fileTypes.join(', ')}
		</div>
	{/if}

	{#if error}
		<div id={errorId} class="alert alert-error py-2" role="alert" aria-live="assertive">
			<span class="text-sm">{error}</span>
		</div>
	{/if}

	{#if value}
		<div class="flex items-start justify-between gap-4">
			<div class="text-sm">
				<div><strong>{translations.selectedFile}</strong> {value.name}</div>
				<div class="text-xs text-base-content/70">
					{value.type || translations.unknownType} •
					{translations.fileSize(value.size)}
				</div>
			</div>
			<button type="button" class="btn btn-sm" onclick={clear} disabled={disabled}>
				{translations.removeFile}
			</button>
		</div>
	{/if}
</div>

<style>
</style>
