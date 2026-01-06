<script lang="ts">
	import type { Point, SelectPointInteractionData } from '../types/interactions';

	interface Props {
		interaction: SelectPointInteractionData;
		response: Point[] | null;
		disabled: boolean;
		onChange: (value: Point[]) => void;
	}

	let { interaction, response, disabled, onChange }: Props = $props();

	let selectedPoints = $state<Point[]>([]);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);

	$effect(() => {
		// Sync with parent response changes
		selectedPoints = response ? [...response] : [];
	});

	/**
	 * Check if selection limit has been reached
	 */
	const canSelectMore = $derived(selectedPoints.length < interaction.maxChoices);

	/**
	 * Check if minimum selection requirement has been met
	 */
	const hasMetMinChoices = $derived(selectedPoints.length >= interaction.minChoices);

	/**
	 * Handle click on image to select a point
	 */
	function handleImageClick(event: MouseEvent) {
		if (disabled || !canSelectMore || !imageElement) return;

		const rect = imageElement.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		// Store coordinates as percentages for responsiveness
		const xPercent = (x / rect.width) * 100;
		const yPercent = (y / rect.height) * 100;

		selectedPoints = [...selectedPoints, { x: xPercent, y: yPercent }];
		onChange(selectedPoints);
	}

	/**
	 * Remove a selected point
	 */
	function removePoint(index: number) {
		if (disabled) return;
		selectedPoints = selectedPoints.filter((_, i) => i !== index);
		onChange(selectedPoints);
	}

	/**
	 * Clear all selected points
	 */
	function clearAllPoints() {
		if (disabled) return;
		selectedPoints = [];
		onChange(selectedPoints);
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

<div class="qti-select-point-interaction space-y-3">
	{#if interaction.prompt}
		<p class="font-semibold">{interaction.prompt}</p>
	{/if}

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
		{#if interaction.imageData}
			{#if interaction.imageData.type === 'svg'}
				<div
					style="width: {interaction.imageData.width}px; height: {interaction.imageData.height}px;"
				>
					{@html interaction.imageData.content}
				</div>
			{:else if interaction.imageData.src}
				<img
					src={interaction.imageData.src}
					alt="Selection canvas"
					style="width: {interaction.imageData.width}px; height: {interaction.imageData.height}px;"
					class="block"
				/>
			{/if}

			<!-- Render selected points as markers -->
			{#each selectedPoints as point, index}
				<button
					type="button"
					class="point-marker"
					style="left: {point.x}%; top: {point.y}%;"
					onclick={(e) => {
						e.stopPropagation();
						removePoint(index);
					}}
					aria-label="Remove point {index + 1}"
					title="Click to remove this point"
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
			<span class="ml-2">{selectedPoints.length} / {interaction.maxChoices}</span>
			{#if interaction.minChoices > 0}
				<span class="ml-2">
					{#if hasMetMinChoices}
						<span class="badge badge-success badge-sm">✓ Minimum met</span>
					{:else}
						<span class="badge badge-warning badge-sm">
							Select at least {interaction.minChoices}
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
				class="stroke-current shrink-0 w-6 h-6"
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

<style>
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
