<script lang="ts">
/**
 * Adapter component that transforms standard interaction props into GraphicGapMatch-specific props
 * This allows GraphicGapMatch to be used in the generic component rendering system
 */
import type { GraphicGapMatchInteractionData } from '../types/interactions';
import GraphicGapMatch from './GraphicGapMatch.svelte';

interface Props {
	interaction: GraphicGapMatchInteractionData;
	response: string[] | null;
	disabled?: boolean;
	typeset?: (element: HTMLElement) => void;
	onChange: (value: string[]) => void;
}

const { interaction, response = null, disabled = false, typeset, onChange }: Props = $props();

// Transform response format: string[] to the pairs format GraphicGapMatch expects
const pairs = $derived(response ?? []);

function handlePairsChange(newPairs: string[]) {
	onChange(newPairs);
}
</script>

<GraphicGapMatch
	gapTexts={interaction.gapTexts}
	hotspots={interaction.hotspots as any}
	{pairs}
	imageData={interaction.imageData?.content ?? ''}
	imageWidth={interaction.imageData?.width ?? '600'}
	imageHeight={interaction.imageData?.height ?? '500'}
	{disabled}
	onPairsChange={handlePairsChange}
/>
