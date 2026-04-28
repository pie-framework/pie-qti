<svelte:options customElement="pie-qti-hotspot" />

<script lang="ts">
	import type { HotspotInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: HotspotInteractionData | string;
		response?: string | null;
		correctResponse?: string | string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: string) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<HotspotInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string | string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);

	// Get correct IDs as array
	const correctIds = $derived.by(() => {
		if (!isShowingCorrect) return [];
		if (Array.isArray(parsedCorrectResponse)) {
			return parsedCorrectResponse;
		}
		return parsedCorrectResponse ? [parsedCorrectResponse] : [];
	});

	function isCorrect(identifier: string): boolean {
		return isShowingCorrect && correctIds.includes(identifier);
	}

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	const imageWidth = $derived.by(() => {
		const w = parsedInteraction?.imageData?.width;
		const n = w ? Number(w) : NaN;
		return Number.isFinite(n) && n > 0 ? n : null;
	});

	const imageHeight = $derived.by(() => {
		const h = parsedInteraction?.imageData?.height;
		const n = h ? Number(h) : NaN;
		return Number.isFinite(n) && n > 0 ? n : null;
	});

	const mediaStyle = $derived.by(() => {
		if (imageWidth && imageHeight) {
			// Fill available width, but don't exceed the asset's natural width.
			return `width: 100%; max-width: ${imageWidth}px; aspect-ratio: ${imageWidth} / ${imageHeight};`;
		}
		return 'width: 100%;';
	});

	function handleClick(identifier: string) {
		if (!disabled) {
			response = identifier;
			// Call onChange callback if provided (for Svelte component usage)
			onChange?.(identifier);
			// Dispatch event for web component usage - event will bubble up to the host element
			if (rootElement) {
				rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, identifier));
			}
		}
	}

	function handleKeyDown(e: KeyboardEvent, identifier: string) {
		if (disabled) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick(identifier);
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} class="qti-hotspot-interaction space-y-3">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-hotspot-prompt font-semibold">{@html parsedInteraction.prompt}</p>
		{/if}

		<div part="stage" class="qti-hotspot-stage">
			<div class="qti-hotspot-media" style={mediaStyle}>
				<!-- Render the image/SVG -->
				{#if parsedInteraction.imageData}
					{#if parsedInteraction.imageData.type === 'svg'}
						<div part="image" class="qti-hotspot-image">
							{@html parsedInteraction.imageData.content}
						</div>
					{:else}
						<img
							src={parsedInteraction.imageData.src}
							alt={i18n?.t('interactions.hotspot.altText') ?? 'Hotspot interaction'}
							part="image"
							class="qti-hotspot-image"
						/>
					{/if}
				{/if}

				<!-- Overlay clickable areas using SVG -->
				<svg
					part="overlay"
					class="qti-hotspot-overlay"
					style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
					viewBox="0 0 {parsedInteraction.imageData?.width || '800'} {parsedInteraction.imageData?.height || '600'}"
					xmlns="http://www.w3.org/2000/svg"
				>
					{#each parsedInteraction.hotspotChoices as choice}
						{@const isSelected = parsedResponse === choice.identifier}
						{@const isCorrectChoice = isCorrect(choice.identifier)}
						{@const coords = choice.coords.split(',').map(Number)}

						{@const shapeLabel = choice.hotspotLabel || `Hotspot ${choice.identifier}`}
						{@const ariaLabel = `${shapeLabel}${isCorrectChoice ? '. Correct answer' : ''}`}

						{#if choice.shape === 'circle'}
							<!-- Circle: coords are cx, cy, radius -->
							<circle
								cx={coords[0]}
								cy={coords[1]}
								r={coords[2]}
								fill={isSelected ? 'rgba(59, 130, 246, 0.3)' : isCorrectChoice ? 'rgba(34, 197, 94, 0.3)' : 'rgba(0, 0, 0, 0)'}
								stroke={isSelected ? '#3b82f6' : isCorrectChoice ? '#22c55e' : 'transparent'}
								stroke-width="2"
								class="qti-hotspot-shape hover:fill-[rgba(59,130,246,0.1)] transition-all"
								role="button"
								aria-label={ariaLabel}
								aria-pressed={isSelected ? 'true' : 'false'}
								tabindex={disabled ? -1 : 0}
								onclick={() => handleClick(choice.identifier)}
								onkeydown={(e) => handleKeyDown(e, choice.identifier)}
							/>
						{:else if choice.shape === 'rect'}
							<!-- Rectangle: QTI coords are left,top,right,bottom -->
							<rect
								x={coords[0]}
								y={coords[1]}
								width={coords[2] - coords[0]}
								height={coords[3] - coords[1]}
								fill={isSelected ? 'rgba(59, 130, 246, 0.3)' : isCorrectChoice ? 'rgba(34, 197, 94, 0.3)' : 'rgba(0, 0, 0, 0)'}
								stroke={isSelected ? '#3b82f6' : isCorrectChoice ? '#22c55e' : 'transparent'}
								stroke-width="2"
								class="qti-hotspot-shape hover:fill-[rgba(59,130,246,0.1)] transition-all"
								role="button"
								aria-label={ariaLabel}
								aria-pressed={isSelected ? 'true' : 'false'}
								tabindex={disabled ? -1 : 0}
								onclick={() => handleClick(choice.identifier)}
								onkeydown={(e) => handleKeyDown(e, choice.identifier)}
							/>
						{:else if choice.shape === 'ellipse'}
							<!-- Ellipse: QTI coords are cx,cy,rx,ry -->
							<ellipse
								cx={coords[0]}
								cy={coords[1]}
								rx={coords[2]}
								ry={coords[3]}
								fill={isSelected ? 'rgba(59, 130, 246, 0.3)' : isCorrectChoice ? 'rgba(34, 197, 94, 0.3)' : 'rgba(0, 0, 0, 0)'}
								stroke={isSelected ? '#3b82f6' : isCorrectChoice ? '#22c55e' : 'transparent'}
								stroke-width="2"
								class="qti-hotspot-shape hover:fill-[rgba(59,130,246,0.1)] transition-all"
								role="button"
								aria-label={ariaLabel}
								aria-pressed={isSelected ? 'true' : 'false'}
								tabindex={disabled ? -1 : 0}
								onclick={() => handleClick(choice.identifier)}
								onkeydown={(e) => handleKeyDown(e, choice.identifier)}
							/>
						{:else if choice.shape === 'poly'}
							<!-- Polygon: coords are x1,y1,x2,y2,... -->
							{@const points = coords
								.reduce((acc: string[], val: number, idx: number) => {
									if (idx % 2 === 0 && idx + 1 < coords.length) {
										acc.push(`${coords[idx]},${coords[idx + 1]}`);
									}
									return acc;
								}, [])
								.join(' ')}
							<polygon
								{points}
								fill={isSelected ? 'rgba(59, 130, 246, 0.3)' : isCorrectChoice ? 'rgba(34, 197, 94, 0.3)' : 'rgba(0, 0, 0, 0)'}
								stroke={isSelected ? '#3b82f6' : isCorrectChoice ? '#22c55e' : 'transparent'}
								stroke-width="2"
								class="qti-hotspot-shape hover:fill-[rgba(59,130,246,0.1)] transition-all"
								role="button"
								aria-label={ariaLabel}
								aria-pressed={isSelected ? 'true' : 'false'}
								tabindex={disabled ? -1 : 0}
								onclick={() => handleClick(choice.identifier)}
								onkeydown={(e) => handleKeyDown(e, choice.identifier)}
							/>
						{/if}
					{/each}
				</svg>
			</div>
		</div>

		{#if parsedResponse || (isShowingCorrect && correctIds.length > 0)}
			<div part="selected" class="alert alert-info">
				{#if parsedResponse}
					<span>{i18n?.t('interactions.hotspot.selected') ?? 'Selected:'} {parsedResponse}</span>
				{/if}
				{#if isShowingCorrect && correctIds.length > 0}
					<span class="ml-2">Correct: {correctIds.join(', ')}</span>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind utilities */
	.qti-hotspot-interaction {
		display: grid;
		gap: 0.75rem;
	}
	.qti-hotspot-prompt {
		margin: 0;
	}
	.qti-hotspot-stage {
		position: relative;
		display: block;
		width: 100%;
		max-width: 100%;
	}
	.qti-hotspot-media {
		position: relative;
	}
	.qti-hotspot-image {
		display: block;
		width: 100%;
		height: 100%;
	}
	/* Inline SVG injected via {@html} is not scoped; use :global to size it inside the shadow root. */
	.qti-hotspot-image :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.qti-hotspot-overlay {
		position: absolute;
		inset: 0;
		cursor: pointer;
	}
	/* Tailwind `hover:` utilities won't exist everywhere; provide a real hover style too */
	.qti-hotspot-shape {
		transition: fill 120ms ease, stroke 120ms ease, opacity 120ms ease;
	}
	.qti-hotspot-shape:hover {
		fill: rgba(59, 130, 246, 0.1);
	}
</style>
