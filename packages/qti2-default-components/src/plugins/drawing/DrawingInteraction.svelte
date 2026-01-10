<svelte:options customElement="pie-qti-drawing" />

<script lang="ts">
	import type { DrawingInteractionData, QTIFileResponse } from '@pie-qti/qti2-item-player';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import DrawingCanvas from '../../shared/components/DrawingCanvas.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { typesetAction } from '../../shared/actions/typesetAction';

	interface Props {
		interaction?: DrawingInteractionData | string;
		response?: QTIFileResponse | string | null;
		disabled?: boolean;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: QTIFileResponse | null) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, typeset, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<DrawingInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<QTIFileResponse>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	function handleChange(value: QTIFileResponse | null) {
		response = value;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(value);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement && parsedInteraction) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction.responseId, value));
		}
	}

	// Extract drawing configuration from rawAttributes
	const strokeColor = $derived(parsedInteraction?.rawAttributes?.['data-stroke-color'] ?? '#111827');
	const lineWidth = $derived(
		parsedInteraction?.rawAttributes?.['data-line-width']
			? Number(parsedInteraction.rawAttributes['data-line-width'])
			: 3
	);
	const lineCap = $derived(
		(parsedInteraction?.rawAttributes?.['data-line-cap'] as 'butt' | 'round' | 'square') ?? 'round'
	);
	const lineJoin = $derived(
		(parsedInteraction?.rawAttributes?.['data-line-join'] as 'bevel' | 'round' | 'miter') ?? 'round'
	);
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-drawing-interaction" use:typesetAction={{ typeset }}>
	{#if !parsedInteraction}
		<div class="alert alert-error">
			<span>Error: No interaction data provided</span>
		</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p class="font-semibold mb-2">{parsedInteraction.prompt}</p>
		{/if}
		<DrawingCanvas
			responseId={parsedInteraction.responseId}
			imageData={parsedInteraction.imageData}
			{disabled}
			value={parsedResponse}
			onChange={handleChange}
			{strokeColor}
			{lineWidth}
			{lineCap}
			{lineJoin}
		/>
	{/if}
</div>

<style>
	/* Ensure pointer events work in Shadow DOM */
	:global(canvas) {
		pointer-events: auto !important;
	}

	:global(.touch-none) {
		touch-action: none;
	}
</style>
