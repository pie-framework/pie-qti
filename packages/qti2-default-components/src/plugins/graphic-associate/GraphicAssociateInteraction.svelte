<svelte:options customElement="pie-qti-graphic-associate" />

<script lang="ts">
	import type { GraphicAssociateInteractionData } from '@pie-qti/qti2-item-player';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';

	interface Props {
		interaction?: GraphicAssociateInteractionData | string;
		response?: string[] | null;
		disabled?: boolean;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<GraphicAssociateInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Pairs are stored as "ID1 ID2" strings (space-separated)
	let pairs = $state<string[]>([]);
	let selectedHotspot: string | null = $state(null);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);

	const canInteract = $derived(!disabled);
	const canAddMore = $derived(!parsedInteraction || pairs.length < parsedInteraction.maxAssociations);

	$effect(() => {
		// Sync with parent response changes
		pairs = parsedResponse ? [...parsedResponse] : [];
	});

	function handleHotspotClick(hotspotId: string) {
		if (!canInteract || !parsedInteraction) return;

		const hotspot = parsedInteraction.associableHotspots.find((h) => h.identifier === hotspotId);
		if (!hotspot) return;

		// Count how many times this hotspot is already used
		const usageCount = pairs.filter((pair) => pair.includes(hotspotId)).length;
		if (usageCount >= hotspot.matchMax) {
			// This hotspot is at its maximum connections
			return;
		}

		if (!selectedHotspot) {
			// First selection
			selectedHotspot = hotspotId;
		} else if (selectedHotspot === hotspotId) {
			// Clicking the same hotspot deselects it
			selectedHotspot = null;
		} else {
			// Second selection - create a pair
			if (!canAddMore) return;

			const newPair = `${selectedHotspot} ${hotspotId}`;
			pairs = [...pairs, newPair];
			response = pairs;
			// Call onChange callback if provided (for Svelte component usage)
			onChange?.(pairs);
			// Dispatch custom event for web component usage - event will bubble up to the host element
			if (rootElement) {
				rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, pairs));
			}
			selectedHotspot = null;
		}
	}

	function removePair(index: number) {
		if (!canInteract) return;
		pairs = pairs.filter((_, i) => i !== index);
		response = pairs;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(pairs);
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, pairs));
		}
	}

	function getHotspotById(id: string) {
		return parsedInteraction?.associableHotspots.find((h) => h.identifier === id);
	}

	function isHotspotSelected(id: string): boolean {
		return selectedHotspot === id;
	}

	function getHotspotUsageCount(id: string): number {
		return pairs.filter((pair) => pair.includes(id)).length;
	}

	function isHotspotMaxed(id: string): boolean {
		const hotspot = getHotspotById(id);
		if (!hotspot) return false;
		return getHotspotUsageCount(id) >= hotspot.matchMax;
	}

	// Calculate center point of a hotspot for visual connections
	function getHotspotCenter(coords: string, shape: string): { x: number; y: number } {
		const parts = coords.split(',').map(Number);
		if (shape === 'rect') {
			// rect: x1,y1,x2,y2
			return {
				x: (parts[0] + parts[2]) / 2,
				y: (parts[1] + parts[3]) / 2,
			};
		} else if (shape === 'circle') {
			// circle: cx,cy,r
			return { x: parts[0], y: parts[1] };
		}
		// Default fallback
		return { x: parts[0] || 0, y: parts[1] || 0 };
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-graphic-associate-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">No interaction data provided</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-ga-prompt font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<div part="layout" class="qti-ga-layout flex flex-col lg:flex-row gap-4">
			<!-- Image with Hotspots -->
			<div part="image-area" class="qti-ga-image-area flex-1">
				<div
					bind:this={imageContainer}
					part="stage"
					class="qti-ga-stage relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
					style="width: {parsedInteraction.imageData?.width}px; height: {parsedInteraction.imageData?.height}px;"
				>
					{#if parsedInteraction.imageData}
						{#if parsedInteraction.imageData.type === 'svg' && parsedInteraction.imageData.content}
							<div
								bind:this={imageElement}
								class="w-full h-full"
							>
								{@html parsedInteraction.imageData.content}
							</div>
						{:else if parsedInteraction.imageData.src}
							<img
								bind:this={imageElement}
								src={parsedInteraction.imageData.src}
								alt="Association diagram"
								class="w-full h-full object-contain"
							/>
						{/if}
					{/if}

					<!-- SVG overlay for drawing connection lines -->
					<svg
						part="overlay"
						class="qti-ga-overlay absolute inset-0 w-full h-full pointer-events-none"
						style="z-index: 10;"
					>
						{#each pairs as pair, index}
							{@const [id1, id2] = pair.split(' ')}
							{@const hotspot1 = getHotspotById(id1)}
							{@const hotspot2 = getHotspotById(id2)}
							{#if hotspot1 && hotspot2}
								{@const center1 = getHotspotCenter(hotspot1.coords, hotspot1.shape)}
								{@const center2 = getHotspotCenter(hotspot2.coords, hotspot2.shape)}
								<line
									x1={center1.x}
									y1={center1.y}
									x2={center2.x}
									y2={center2.y}
									stroke="var(--color-primary, oklch(45% 0.24 277))"
									stroke-width="3"
									stroke-linecap="round"
								/>
							{/if}
						{/each}
					</svg>

					<!-- Clickable hotspot areas -->
					{#each parsedInteraction.associableHotspots as hotspot}
						{@const isSelected = isHotspotSelected(hotspot.identifier)}
						{@const isMaxed = isHotspotMaxed(hotspot.identifier)}
						{@const usageCount = getHotspotUsageCount(hotspot.identifier)}

						{#if hotspot.shape === 'rect'}
							{@const [x1, y1, x2, y2] = hotspot.coords.split(',').map(Number)}
							<button
								part="hotspot"
								class="qti-ga-hotspot absolute border-2 transition-all {isSelected
									? 'bg-primary/40 border-primary border-4'
									: 'bg-primary/10 border-primary hover:bg-primary/20'} {isMaxed
									? 'opacity-50 cursor-not-allowed'
									: canInteract
										? 'cursor-pointer'
										: 'cursor-not-allowed opacity-70'}"
								style="left: {x1}px; top: {y1}px; width: {x2 - x1}px; height: {y2 -
									y1}px; z-index: 20;"
								onclick={() => handleHotspotClick(hotspot.identifier)}
								disabled={!canInteract || isMaxed}
								aria-label="{hotspot.label} ({usageCount}/{hotspot.matchMax} connections)"
							>
								<span class="text-xs font-bold text-primary-content">{hotspot.label}</span>
							</button>
						{:else if hotspot.shape === 'circle'}
							{@const [cx, cy, r] = hotspot.coords.split(',').map(Number)}
							<button
								part="hotspot"
								class="qti-ga-hotspot qti-ga-hotspot-circle absolute rounded-full border-2 flex items-center justify-center transition-all {isSelected
									? 'bg-primary/40 border-primary border-4'
									: 'bg-primary/10 border-primary hover:bg-primary/20'} {isMaxed
									? 'opacity-50 cursor-not-allowed'
									: canInteract
										? 'cursor-pointer'
										: 'cursor-not-allowed opacity-70'}"
								style="left: {cx - r}px; top: {cy - r}px; width: {r * 2}px; height: {r *
									2}px; z-index: 20;"
								onclick={() => handleHotspotClick(hotspot.identifier)}
								disabled={!canInteract || isMaxed}
								aria-label="{hotspot.label} ({usageCount}/{hotspot.matchMax} connections)"
							>
								<span class="text-xs font-bold text-primary-content">{hotspot.label}</span>
							</button>
						{/if}
					{/each}
				</div>

				{#if selectedHotspot}
					<div class="alert alert-info mt-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							part="selected-icon"
							class="qti-icon stroke-current shrink-0 w-6 h-6"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<span>
							Selected: <strong>{getHotspotById(selectedHotspot)?.label}</strong>. Click another
							hotspot to create an association.
						</span>
					</div>
				{/if}
			</div>

			<!-- Associations List -->
			<div part="panel" class="qti-ga-panel w-full lg:w-80">
				<div class="qti-ga-card card bg-base-100 border border-base-300">
					<div class="qti-ga-card-body card-body p-4">
						<h3 class="card-title text-sm">
							Associations ({pairs.length}/{parsedInteraction.maxAssociations})
						</h3>

						{#if pairs.length === 0}
							<p class="text-sm text-base-content/60">
								Click two hotspots on the image to create an association.
							</p>
						{:else}
							<div class="space-y-2">
								{#each pairs as pair, index}
									{@const [id1, id2] = pair.split(' ')}
									{@const hotspot1 = getHotspotById(id1)}
									{@const hotspot2 = getHotspotById(id2)}
									<div
										class="flex items-center gap-2 p-2 rounded-lg bg-base-200 border border-base-300"
									>
										<div class="badge badge-sm badge-primary">{index + 1}</div>
										<div class="flex-1 text-sm">
											<span class="font-medium">{hotspot1?.label}</span>
											<span class="mx-1">↔</span>
											<span class="font-medium">{hotspot2?.label}</span>
										</div>
										{#if canInteract}
											<button
												class="btn btn-xs btn-ghost btn-circle"
												onclick={() => removePair(index)}
												aria-label="Remove association"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													part="remove-icon"
													class="qti-icon-sm h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						{#if parsedInteraction.minAssociations > 0}
							<div class="text-xs text-base-content/60 mt-2">
								Minimum required: {parsedInteraction.minAssociations}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Ensure proper clickable areas */
	:global(.qti-graphic-associate-interaction button) {
		min-height: unset;
	}

	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
	}
	.qti-icon-sm {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
	}

	/* Minimal layout so this works without Tailwind utilities */
	.qti-ga-layout {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.qti-ga-image-area {
		flex: 1 1 520px;
		min-width: 280px;
	}
	.qti-ga-stage {
		position: relative;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
	}
	/* Critical: overlay must be absolutely positioned even without Tailwind utilities */
	.qti-ga-overlay {
		position: absolute;
		inset: 0;
	}
	/* Critical: hotspot buttons are absolutely positioned via inline styles; ensure `position:absolute` exists */
	.qti-ga-hotspot {
		position: absolute;
	}
	.qti-ga-panel {
		flex: 0 0 20rem;
		min-width: 18rem;
	}
	.qti-ga-card {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--color-base-100, oklch(100% 0 0));
	}
	.qti-ga-card-body {
		padding: 1rem;
	}
</style>
