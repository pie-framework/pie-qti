<script lang="ts">
	/**
	 * Reusable confirmation dialog component using DaisyUI modal
	 */
	import { getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/i18n';

	const i18nContext = getContext<{ value: SvelteI18nProvider | undefined }>('i18n');
	const i18n = $derived(i18nContext?.value);

	let {
		open = $bindable(false),
		title,
		message,
		confirmText,
		cancelText,
		confirmClass = 'btn-error',
		onConfirm,
	}: {
		open?: boolean;
		title?: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		confirmClass?: string;
		onConfirm: () => void | Promise<void>;
	} = $props();

	// Derive defaults from i18n if not provided
	const _title = $derived(title ?? i18n?.t('transform.dialog.defaultTitle') ?? 'Confirm Action');
	const _confirmText = $derived(confirmText ?? i18n?.t('transform.dialog.defaultConfirm') ?? 'Confirm');
	const _cancelText = $derived(cancelText ?? i18n?.t('common.cancel') ?? 'Cancel');

	let isProcessing = $state(false);

	async function handleConfirm() {
		isProcessing = true;
		try {
			await onConfirm();
			open = false;
		} catch (error) {
			console.error('Confirmation action failed:', error);
		} finally {
			isProcessing = false;
		}
	}

	function handleCancel() {
		if (!isProcessing) {
			open = false;
		}
	}
</script>

<dialog class="modal" class:modal-open={open} data-testid="delete-confirm-dialog">
	<div class="modal-box">
		<h3 class="font-bold text-lg">{_title}</h3>
		<p class="py-4">{message}</p>
		<div class="modal-action">
			<button class="btn" onclick={handleCancel} disabled={isProcessing} data-testid="delete-cancel-button">{_cancelText}</button>
			<button class="btn {confirmClass}" onclick={handleConfirm} disabled={isProcessing} data-testid="delete-confirm-button">
				{#if isProcessing}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				{_confirmText}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleCancel} disabled={isProcessing}>{i18n?.t('transform.dialog.close') ?? 'close'}</button>
	</form>
</dialog>
