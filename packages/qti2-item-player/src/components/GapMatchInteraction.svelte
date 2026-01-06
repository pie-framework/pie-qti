<script lang="ts">
	import type { GapMatchInteractionData } from '../types/interactions';

	interface Props {
		interaction: GapMatchInteractionData;
		response: string[];
		disabled: boolean;
		onChange: (pairs: string[]) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	const pairs = $derived(Array.isArray(response) ? response : []);
	const textParts = $derived(interaction.promptText.split(/\[GAP:([^\]]+)\]/));

	function handleGapChange(gapId: string, wordId: string) {
		// Remove any existing pair for this gap
		const newPairs = pairs.filter((p: string) => !p.endsWith(` ${gapId}`));

		// Add new pair if a word was selected
		if (wordId) {
			newPairs.push(`${wordId} ${gapId}`);
		}

		onChange(newPairs);
	}

	function isWordUsed(wordId: string): boolean {
		return pairs.some((p: string) => p.startsWith(wordId));
	}

	function getSelectedWord(gapId: string): string {
		const pair = pairs.find((p: string) => p.endsWith(` ${gapId}`));
		return pair ? pair.split(' ')[0] : '';
	}
</script>

<div class="qti-gap-match-interaction space-y-3">
	{#if interaction.prompt}
		<p class="font-semibold">{interaction.prompt}</p>
	{/if}

	<!-- Available gap texts (draggable words) -->
	<div class="flex flex-wrap gap-2 p-3 bg-base-200 rounded">
		<span class="font-semibold text-sm">Available words:</span>
		{#each interaction.gapTexts as gapText}
			<button
				class="btn btn-sm {isWordUsed(gapText.identifier) ? 'btn-disabled opacity-50' : 'btn-primary'}"
				disabled={isWordUsed(gapText.identifier) || disabled}
			>
				{gapText.text}
			</button>
		{/each}
	</div>

	<!-- Render the text with gaps as dropdowns -->
	<div class="p-4 bg-base-100 border border-base-300 rounded">
		<div class="inline">
			{#each textParts as part, index}
				{#if index % 2 === 0}
					<!-- Regular text -->
					<span>{part}</span>
				{:else}
					<!-- Gap - render as dropdown -->
					{@const gapId = part}
					<select
						class="select select-bordered select-sm inline-block mx-1"
						aria-label={`Gap ${gapId}`}
						value={getSelectedWord(gapId)}
						onchange={(e: Event) => {
							const selectValue = (e.currentTarget as HTMLSelectElement).value;
							handleGapChange(gapId, selectValue);
						}}
						{disabled}
					>
						<option value="">Select...</option>
						{#each interaction.gapTexts as gapText}
							<option value={gapText.identifier}>{gapText.text}</option>
						{/each}
					</select>
				{/if}
			{/each}
		</div>
	</div>
</div>
