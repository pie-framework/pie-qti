<script lang="ts">
	import type { OrderInteractionData } from '../types/interactions';
	import SortableList from './SortableList.svelte';

	interface Props {
		interaction: OrderInteractionData;
		response: string[] | null;
		disabled: boolean;
		onChange: (value: string[]) => void;
		typeset?: (element: HTMLElement) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	// Get ordered IDs from response, or use original order
	const orderedIds = $derived(
		response && response.length > 0
			? response
			: interaction.choices.map((c) => c.identifier)
	);

	function handleReorder(newOrder: string[]) {
		onChange(newOrder);
	}
</script>

<div class="qti-order-interaction">
	{#if interaction.prompt}
		<div class="mb-3 text-sm text-base-content/70">
			{interaction.prompt}
		</div>
	{/if}

	<SortableList
		items={interaction.choices.map(c => ({ id: c.identifier, text: c.text }))}
		{orderedIds}
		orientation="vertical"
		{disabled}
		onReorder={handleReorder}
	/>
</div>
