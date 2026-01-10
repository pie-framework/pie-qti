<script lang="ts">
	import type { EndAttemptInteractionData } from '../types/interactions';

	interface Props {
		interaction: EndAttemptInteractionData;
		response: boolean | null;
		disabled?: boolean;
		onChange: (value: boolean) => void;
	}

	let { interaction, response, disabled = false, onChange }: Props = $props();

	// Track if button has been clicked
	let hasEnded = $state(false);

	const canInteract = $derived(!disabled);

	$effect(() => {
		// Sync with parent response changes
		hasEnded = response ?? false;
	});

	function handleEndAttempt() {
		if (!canInteract || hasEnded) return;
		hasEnded = true;
		onChange(true);
	}
</script>

<div class="qti-end-attempt-interaction">
	{#if interaction.prompt}
		<p class="font-semibold mb-3">{interaction.prompt}</p>
	{/if}

	<div class="flex items-center gap-4">
		<button
			class="btn btn-error btn-lg {hasEnded ? 'btn-disabled' : ''}"
			onclick={handleEndAttempt}
			disabled={!canInteract || hasEnded}
			aria-label={interaction.title}
		>
			{#if hasEnded}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 mr-2"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
				{interaction.countAttempt ? 'Attempt Ended' : 'Requested'}
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 mr-2"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
				{interaction.title}
			{/if}
		</button>

		{#if hasEnded && interaction.countAttempt}
			<div class="alert alert-warning inline-flex items-center gap-2 w-auto">
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
				<span>Your attempt has been ended and can no longer be modified.</span>
			</div>
		{/if}
	</div>
</div>
