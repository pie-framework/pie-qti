<script lang="ts">
	import type { CustomInteractionData, InteractionData } from '../types/interactions';
	import CustomInteractionFallback from './CustomInteractionFallback.svelte';

	interface Props {
		interaction: InteractionData;
		response: string | null;
		disabled: boolean;
		onChange: (value: string | null) => void;
		typeset?: (element: HTMLElement) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	// Type assertion for custom interaction data
	const customInteraction = $derived(interaction as CustomInteractionData);
</script>

<div class="qti-custom-interaction">
	<!-- @ts-expect-error - CustomInteractionFallback has stricter prop types -->
	<CustomInteractionFallback
		responseId={customInteraction.responseId}
		prompt={customInteraction.prompt}
		rawAttributes={customInteraction.rawAttributes}
		xml={customInteraction.xml}
		{disabled}
		value={response}
		{onChange}
		testIdInput={`custom-input-${customInteraction.responseId}`}
	/>
</div>
