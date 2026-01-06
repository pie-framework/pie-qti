<script lang="ts">
	import type { MatchInteractionData } from '../types/interactions';
	import MatchDragDrop from './MatchDragDrop.svelte';

	interface Props {
		interaction: MatchInteractionData;
		response: string[] | null;
		disabled: boolean;
		onChange: (value: string[]) => void;
		typeset?: (element: HTMLElement) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	// Convert response to pairs array, or empty array
	const pairs = $derived(response && Array.isArray(response) ? response : []);

	function handlePairsChange(newPairs: string[]) {
		onChange(newPairs);
	}
</script>

<div class="qti-match-interaction">
	{#if interaction.prompt}
		<div class="mb-3 text-sm text-base-content/70">
			{interaction.prompt}
		</div>
	{/if}

	<MatchDragDrop
		sourceSet={interaction.sourceSet}
		targetSet={interaction.targetSet}
		{pairs}
		{disabled}
		onPairsChange={handlePairsChange}
	/>
</div>
