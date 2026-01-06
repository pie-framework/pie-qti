<script lang="ts">
	import type { AssociateInteractionData } from '../types/interactions';

	interface Props {
		interaction: AssociateInteractionData;
		response: string[] | null;
		disabled: boolean;
		selectedForPairing?: string | null;
		onChange: (pairs: string[]) => void;
		onSelectionChange?: (selected: string | null) => void;
	}

	let {
		interaction,
		response,
		disabled,
		selectedForPairing = null,
		onChange,
		onSelectionChange = () => {},
	}: Props = $props();

	// Ensure response is always an array
	const pairs = $derived(response || []);

	function handleChoiceClick(choiceId: string) {
		if (disabled) return;

		// If no item selected yet, select this one
		if (selectedForPairing === null) {
			onSelectionChange(choiceId);
		}
		// If same item clicked again, deselect
		else if (selectedForPairing === choiceId) {
			onSelectionChange(null);
		}
		// If different item clicked, create a pair
		else {
			const newPair = `${selectedForPairing} ${choiceId}`;
			const newPairs = [...pairs, newPair];
			onChange(newPairs);
			onSelectionChange(null);
		}
	}

	function removePair(index: number) {
		const newPairs = pairs.filter((_, i) => i !== index);
		onChange(newPairs);
	}

	function isInPair(choiceId: string): boolean {
		return pairs.some((p) => p.includes(choiceId));
	}
</script>

<div class="qti-associate-interaction space-y-3">
	{#if interaction.prompt}
		<p class="font-semibold">{interaction.prompt}</p>
	{/if}

	<!-- Display choices as buttons that can be clicked to form pairs -->
	<div class="grid grid-cols-2 gap-2">
		{#each interaction.choices as choice}
			{@const isSelected = selectedForPairing === choice.identifier}
			<button
				class="btn btn-outline {isSelected ? 'btn-accent' : isInPair(choice.identifier) ? 'btn-primary' : 'btn-neutral'}"
				onclick={() => handleChoiceClick(choice.identifier)}
				{disabled}
			>
				{choice.text}
				{#if isSelected}
					<span class="ml-2">◉</span>
				{:else if isInPair(choice.identifier)}
					<span class="ml-2">✓</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Display current pairs -->
	{#if pairs.length > 0}
		<div class="divider">Current Associations</div>
		<div class="space-y-2">
			{#each pairs as pair, index}
				{@const [id1, id2] = pair.split(' ')}
				{@const choice1 = interaction.choices.find((c: any) => c.identifier === id1)}
				{@const choice2 = interaction.choices.find((c: any) => c.identifier === id2)}
				{#if choice1 && choice2}
					<div class="flex items-center gap-4 p-2 bg-primary/10 rounded">
						<span class="flex-1">{choice1.text}</span>
						<span class="text-primary">↔</span>
						<span class="flex-1">{choice2.text}</span>
						<button
							class="btn btn-sm btn-ghost btn-circle"
							onclick={() => removePair(index)}
							{disabled}
						>
							✕
						</button>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Selection helper -->
	<div class="alert alert-info">
		<span class="text-sm">
			{#if selectedForPairing}
				Click another item to create an association (or click again to deselect)
			{:else}
				Click two items to create an association between them
			{/if}
		</span>
	</div>
</div>
