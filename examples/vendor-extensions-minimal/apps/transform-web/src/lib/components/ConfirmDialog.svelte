<script lang="ts">
	/**
	 * Reusable confirmation dialog component using DaisyUI modal
	 */

	let {
		open = $bindable(false),
		title = 'Confirm Action',
		message,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
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
		<h3 class="font-bold text-lg">{title}</h3>
		<p class="py-4">{message}</p>
		<div class="modal-action">
			<button class="btn" onclick={handleCancel} disabled={isProcessing} data-testid="delete-cancel-button">{cancelText}</button>
			<button class="btn {confirmClass}" onclick={handleConfirm} disabled={isProcessing} data-testid="delete-confirm-button">
				{#if isProcessing}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				{confirmText}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleCancel} disabled={isProcessing}>close</button>
	</form>
</dialog>
