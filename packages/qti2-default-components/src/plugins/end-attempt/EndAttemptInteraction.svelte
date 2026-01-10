<svelte:options customElement="pie-qti-end-attempt" />

<script lang="ts">
	import type { EndAttemptInteractionData } from '@pie-qti/qti2-item-player';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: EndAttemptInteractionData | string;
		response?: boolean | null;
		disabled?: boolean;
		onChange?: (value: boolean) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<EndAttemptInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<boolean>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Track if button has been clicked
	let hasEnded = $state(false);

	const canInteract = $derived(!disabled);

	$effect(() => {
		// Sync with parent response changes
		hasEnded = parsedResponse ?? false;
	});

	function handleEndAttempt() {
		if (!canInteract || hasEnded) return;
		hasEnded = true;
		response = true;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(true);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, true));
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} class="qti-end-attempt-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">No interaction data provided</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p class="font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<div class="qti-end-row flex items-center gap-4">
			<button
				part="button"
				class="btn btn-error btn-lg {hasEnded ? 'btn-disabled' : ''}"
				onclick={handleEndAttempt}
				disabled={!canInteract || hasEnded}
				aria-label={parsedInteraction.title}
			>
			{#if hasEnded}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					part="icon"
					class="qti-icon h-6 w-6 mr-2"
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
				{parsedInteraction.countAttempt ? 'Attempt Ended' : 'Requested'}
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					part="icon"
					class="qti-icon h-6 w-6 mr-2"
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
				{parsedInteraction.title}
			{/if}
		</button>

		{#if hasEnded && parsedInteraction.countAttempt}
			<div part="ended-message" class="alert alert-warning inline-flex items-center gap-2 w-auto">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					part="ended-icon"
					class="qti-icon stroke-current shrink-0 h-6 w-6"
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
	{/if}
</div>

<style>
	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
	}
	/* Minimal layout if host doesn't provide utility classes */
	.qti-end-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
</style>
