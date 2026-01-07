<script lang="ts">
/**
 * Component to render HTML with inline interactive elements (textEntry, inlineChoice)
 * Uses a custom parsing approach to embed Svelte components within HTML
 */
interface Props {
	html: string;
	interactions: any[];
	responses: Record<string, any>;
	onResponseChange: (responseId: string, value: any) => void;
}

let { html, interactions, responses, onResponseChange }: Props = $props();

// Parse HTML and extract inline interaction placeholders
interface ParsedSegment {
	type: 'html' | 'textEntry' | 'inlineChoice';
	content?: string;
	interaction?: any;
}

const segments = $derived.by(() => {
	const result: ParsedSegment[] = [];

	let lastIndex = 0;
	let match;

	// Create a combined pattern to find all placeholders in order
	const combinedPattern = /\[TEXTENTRY:([^\]]+)\]|\[INLINECHOICE:([^\]]+)\]/g;

	while ((match = combinedPattern.exec(html)) !== null) {
		// Add HTML before this match
		if (match.index > lastIndex) {
			result.push({
				type: 'html',
				content: html.substring(lastIndex, match.index),
			});
		}

		// Determine which type of interaction this is
		if (match[0].startsWith('[TEXTENTRY:')) {
			const responseId = match[1];
			const interaction = interactions.find((i) => i.responseId === responseId);
			if (interaction) {
				result.push({
					type: 'textEntry',
					interaction,
				});
			}
		} else if (match[0].startsWith('[INLINECHOICE:')) {
			const responseId = match[2];
			const interaction = interactions.find((i) => i.responseId === responseId);
			if (interaction) {
				result.push({
					type: 'inlineChoice',
					interaction,
				});
			}
		}

		lastIndex = match.index + match[0].length;
	}

	// Add remaining HTML after last match
	if (lastIndex < html.length) {
		result.push({
			type: 'html',
			content: html.substring(lastIndex),
		});
	}

	// If no matches found, just return the HTML as one segment
	if (result.length === 0) {
		result.push({
			type: 'html',
			content: html,
		});
	}

	return result;
});
</script>

<div class="inline-interaction-container">
	{#each segments as segment}
		{#if segment.type === 'html'}
			{@html segment.content}
		{:else if segment.type === 'textEntry'}
			<input
				type="text"
				class="input input-bordered input-sm inline-input"
				style="width: {segment.interaction.expectedLength * 8}px; min-width: 100px; display: inline-block; margin: 0 4px;"
				placeholder="..."
				aria-label={`Text entry ${segment.interaction.responseId}`}
				value={responses[segment.interaction.responseId] || ''}
				oninput={(e) => onResponseChange(segment.interaction.responseId, e.currentTarget.value)}
			/>
		{:else if segment.type === 'inlineChoice'}
			<select
				class="select select-bordered select-sm inline-select"
				style="display: inline-block; margin: 0 4px; width: auto; min-width: 120px;"
				aria-label={`Inline choice ${segment.interaction.responseId}`}
				value={responses[segment.interaction.responseId] || ''}
				onchange={(e) => onResponseChange(segment.interaction.responseId, e.currentTarget.value)}
			>
				<option value="">Select...</option>
				{#each segment.interaction.choices as choice}
					<option value={choice.identifier}>{choice.text}</option>
				{/each}
			</select>
		{/if}
	{/each}
</div>

<style>
	.inline-interaction-container :global(p) {
		display: inline;
	}

	.inline-input,
	.inline-select {
		vertical-align: baseline;
	}
</style>
