<script lang="ts">
/**
 * Adapter component that transforms standard interaction props into GraphicGapMatch-specific props
 * This allows GraphicGapMatch to be used in the generic component rendering system
 */
import type { GraphicGapMatchInteractionData } from '@pie-qti/item-player';
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

// Build imageData HTML string: inline SVG content or an <img> tag for raster images
const imageDataHtml = $derived.by(() => {
	const img = interaction.imageData;
	if (!img) return '';
	if (img.content) return img.content as string;
	if (img.src) return `<img src="${img.src}" alt="" style="width: 100%; height: 100%; display: block; position: absolute; top: 0; left: 0;" />`;
	return '';
});

function handlePairsChange(newPairs: string[]) {
	onChange(newPairs);
}
</script>

<GraphicGapMatch
	gapTexts={interaction.gapTexts}
	hotspots={interaction.hotspots}
	{pairs}
	imageData={imageDataHtml}
	imageWidth={interaction.imageData?.width ?? '600'}
	imageHeight={interaction.imageData?.height ?? '500'}
	{disabled}
	onPairsChange={handlePairsChange}
/>
