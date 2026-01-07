<svelte:options customElement="pie-qti-select-point" />

<script lang="ts">
	import type { Point, SelectPointInteractionData } from '@pie-qti/qti2-item-player';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: SelectPointInteractionData | string;
		/**
		 * QTI point responses are typically represented as a single "x y" string (cardinality=single),
		 * or an array of "x y" strings (cardinality=multiple/ordered). Some UI layers may pass
		 * an array of {x,y} points for convenience. We accept all of these and normalize internally.
		 */
		response?: any;
		disabled?: boolean;
		onChange?: (value: any) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<SelectPointInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<any>(response));

	let selectedPoints = $state<Point[]>([]);
	let rootElement: HTMLDivElement | null = $state(null);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);

	$effect(() => {
		// Sync with parent response changes
		const r = parsedResponse;
		if (Array.isArray(r)) {
			// Array can be [{x,y}, ...] or ["x y", ...]
			selectedPoints = r
				.map((v) => {
					if (typeof v === 'string') {
						const parts = v.trim().split(/\s+/);
						if (parts.length === 2) return { x: Number(parts[0]), y: Number(parts[1]) } satisfies Point;
						return null;
					}
					if (v && typeof v === 'object' && v.x !== undefined && v.y !== undefined) {
						return { x: Number(v.x), y: Number(v.y) } satisfies Point;
					}
					return null;
				})
				.filter(Boolean) as Point[];
		} else if (typeof r === 'string') {
			const parts = r.trim().split(/\s+/);
			selectedPoints =
				parts.length === 2
					? [{ x: Number(parts[0]), y: Number(parts[1]) }]
					: [];
		} else if (r && typeof r === 'object' && r.x !== undefined && r.y !== undefined) {
			selectedPoints = [{ x: Number(r.x), y: Number(r.y) }];
		} else {
			selectedPoints = [];
		}
	});

	/**
	 * Check if selection limit has been reached
	 */
	const canSelectMore = $derived(!parsedInteraction || selectedPoints.length < parsedInteraction.maxChoices);

	/**
	 * Check if minimum selection requirement has been met
	 */
	const hasMetMinChoices = $derived(
		parsedInteraction && selectedPoints.length >= parsedInteraction.minChoices
	);

	/**
	 * Handle click on image to select a point
	 */
	function handleImageClick(event: MouseEvent) {
		if (disabled || !canSelectMore || !imageElement || !parsedInteraction?.imageData) return;

		const rect = imageElement.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const clickY = event.clientY - rect.top;

		// Convert to absolute coordinates matching the SVG/image coordinate system
		// The image is displayed at rect.width x rect.height but has intrinsic dimensions
		const intrinsicWidth = parseInt(parsedInteraction.imageData.width) || rect.width;
		const intrinsicHeight = parseInt(parsedInteraction.imageData.height) || rect.height;

		const x = Math.round((clickX / rect.width) * intrinsicWidth);
		const y = Math.round((clickY / rect.height) * intrinsicHeight);

		selectedPoints = [...selectedPoints, { x, y }];

		// QTI canonical value representation for baseType="point" is "x y"
		const canonicalValue =
			parsedInteraction.maxChoices === 1
				? (selectedPoints[0] ? `${selectedPoints[0].x} ${selectedPoints[0].y}` : null)
				: selectedPoints.map((p) => `${p.x} ${p.y}`);
		// Normalize outward response shape to canonical QTI form (even if inbound was legacy/object form).
		response = canonicalValue;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(canonicalValue);
		// Dispatch event for web component usage - event will bubble up to the host element
		rootElement?.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, canonicalValue));
	}

	/**
	 * Remove a selected point
	 */
	function removePoint(index: number) {
		if (disabled) return;
		selectedPoints = selectedPoints.filter((_, i) => i !== index);
		const canonicalValue =
			parsedInteraction?.maxChoices === 1
				? (selectedPoints[0] ? `${selectedPoints[0].x} ${selectedPoints[0].y}` : null)
				: selectedPoints.map((p) => `${p.x} ${p.y}`);
		response = canonicalValue;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(canonicalValue);
		rootElement?.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, canonicalValue));
	}

	/**
	 * Clear all selected points
	 */
	function clearAllPoints() {
		if (disabled) return;
		selectedPoints = [];
		const canonicalValue =
			parsedInteraction?.maxChoices === 1
				? null
				: [];
		response = canonicalValue;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(canonicalValue);
		rootElement?.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, canonicalValue));
	}

	/**
	 * Initialize image element reference
	 */
	$effect(() => {
		if (imageContainer) {
			const img = imageContainer.querySelector('img, svg, object');
			if (img) {
				imageElement = img as HTMLElement;
			}
		}
	});
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} class="qti-select-point-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">No interaction data provided</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p class="font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<div class="space-y-3">

	<div
		bind:this={imageContainer}
		class="image-container relative inline-block"
		style={disabled ? 'cursor: default;' : 'cursor: crosshair;'}
		role="button"
		tabindex={disabled ? -1 : 0}
		aria-label="Click to select points on the image"
		onclick={handleImageClick}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
			}
		}}
	>
		{#if parsedInteraction.imageData}
			{#if parsedInteraction.imageData.type === 'svg'}
				<div
					style="width: {parsedInteraction.imageData.width}px; height: {parsedInteraction.imageData.height}px;"
				>
					{@html parsedInteraction.imageData.content}
				</div>
			{:else if parsedInteraction.imageData.src}
				<img
					src={parsedInteraction.imageData.src}
					alt="Selection canvas"
					style="width: {parsedInteraction.imageData.width}px; height: {parsedInteraction.imageData.height}px;"
					class="block"
				/>
			{/if}

			<!-- Render selected points as markers -->
			{#each selectedPoints as point, index}
				{@const intrinsicWidth = parseInt(parsedInteraction.imageData?.width || '500')}
				{@const intrinsicHeight = parseInt(parsedInteraction.imageData?.height || '300')}
				{@const xPercent = (point.x / intrinsicWidth) * 100}
				{@const yPercent = (point.y / intrinsicHeight) * 100}
				<button
					type="button"
					class="point-marker"
					style="left: {xPercent}%; top: {yPercent}%;"
					onclick={(e) => {
						e.stopPropagation();
						removePoint(index);
					}}
					aria-label="Remove point {index + 1} at coordinates {point.x}, {point.y}"
					title="Click to remove this point ({point.x}, {point.y})"
					{disabled}
				>
					<span class="point-number">{index + 1}</span>
				</button>
			{/each}
		{:else}
			<div
				class="no-image-placeholder bg-base-200 flex items-center justify-center"
				style="width: 500px; height: 300px;"
			>
				<p class="text-base-content/50">No image provided</p>
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-between text-sm text-base-content/70">
		<div>
			<span class="font-medium">Points selected:</span>
			<span class="ml-2">{selectedPoints.length} / {parsedInteraction.maxChoices}</span>
			{#if parsedInteraction.minChoices > 0}
				<span class="ml-2">
					{#if hasMetMinChoices}
						<span class="badge badge-success badge-sm">✓ Minimum met</span>
					{:else}
						<span class="badge badge-warning badge-sm">
							Select at least {parsedInteraction.minChoices}
						</span>
					{/if}
				</span>
			{/if}
		</div>

		{#if selectedPoints.length > 0}
			<button type="button" class="btn btn-sm btn-ghost" onclick={clearAllPoints} {disabled}>
				Clear All
			</button>
		{/if}
	</div>

	{#if !canSelectMore}
		<div class="alert alert-info">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
					part="limit-icon"
					class="qti-icon stroke-current shrink-0 w-6 h-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<span>Maximum points reached. Remove a point to add a new one.</span>
		</div>
	{/if}
	</div>
{/if}
</div>

<style>
	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
	}

	.image-container {
		position: relative;
		display: inline-block;
		border: 2px solid hsl(var(--bc) / 0.2);
		border-radius: 8px;
		overflow: hidden;
	}

	.point-marker {
		position: absolute;
		width: 32px;
		height: 32px;
		transform: translate(-50%, -50%);
		background-color: hsl(var(--p));
		border: 3px solid white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.point-marker:hover {
		background-color: hsl(var(--er));
		transform: translate(-50%, -50%) scale(1.1);
	}

	.point-marker:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.point-number {
		color: white;
		font-weight: 700;
		font-size: 14px;
	}

	.no-image-placeholder {
		border: 2px dashed hsl(var(--bc) / 0.2);
		border-radius: 8px;
	}
</style>
