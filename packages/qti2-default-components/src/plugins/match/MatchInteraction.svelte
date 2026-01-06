<svelte:options customElement="pie-qti-match" />

<script lang="ts">
	import type { MatchInteractionData } from '@pie-qti/qti2-item-player';
	import MatchDragDrop from '../../shared/components/MatchDragDrop.svelte';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: MatchInteractionData | string;
		response?: string[] | null;
		disabled?: boolean;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<MatchInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Convert response to pairs array, or empty array
	const pairs = $derived(parsedResponse && Array.isArray(parsedResponse) ? parsedResponse : []);

	function handlePairsChange(newPairs: string[]) {
		response = newPairs;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(newPairs);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, newPairs));
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} class="qti-match-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">No interaction data provided</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div class="mb-3 text-sm text-base-content/70">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<MatchDragDrop
			sourceSet={parsedInteraction.sourceSet}
			targetSet={parsedInteraction.targetSet}
			{pairs}
			{disabled}
			onPairsChange={handlePairsChange}
		/>
	{/if}
</div>
