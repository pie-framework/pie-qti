<script lang="ts">
	import type { GraphicAssociateInteractionData } from '../types/interactions';

	interface Props {
		interaction: GraphicAssociateInteractionData;
		response: string[] | null;
		disabled?: boolean;
		onChange: (value: string[]) => void;
	}

	let { interaction, response, disabled = false, onChange }: Props = $props();

	// Pairs are stored as "ID1 ID2" strings (space-separated)
	let pairs = $state<string[]>([]);
	let selectedHotspot: string | null = $state(null);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);

	const canInteract = $derived(!disabled);
	const canAddMore = $derived(pairs.length < interaction.maxAssociations);

	$effect(() => {
		// Sync with parent response changes
		pairs = response ? [...response] : [];
	});

	function handleHotspotClick(hotspotId: string) {
		if (!canInteract) return;

		const hotspot = interaction.associableHotspots.find((h) => h.identifier === hotspotId);
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
			onChange(pairs);
			selectedHotspot = null;
		}
	}

	function removePair(index: number) {
		if (!canInteract) return;
		pairs = pairs.filter((_, i) => i !== index);
		onChange(pairs);
	}

	function getHotspotById(id: string) {
		return interaction.associableHotspots.find((h) => h.identifier === id);
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

<div class="qti-graphic-associate-interaction">
	{#if interaction.prompt}
		<p class="font-semibold mb-3">{interaction.prompt}</p>
	{/if}

	<div class="flex flex-col lg:flex-row gap-4">
		<!-- Image with Hotspots -->
		<div class="flex-1">
			<div
				bind:this={imageContainer}
				class="relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
				style="width: {interaction.imageData?.width}px; height: {interaction.imageData?.height}px;"
			>
				{#if interaction.imageData}
					{#if interaction.imageData.type === 'svg' && interaction.imageData.content}
						<div
							bind:this={imageElement}
							class="w-full h-full"
						>
							{@html interaction.imageData.content}
						</div>
					{:else if interaction.imageData.src}
						<img
							bind:this={imageElement}
							src={interaction.imageData.src}
							alt="Association diagram"
							class="w-full h-full object-contain"
						/>
					{/if}
				{/if}

				<!-- SVG overlay for drawing connection lines -->
				<svg
					class="absolute inset-0 w-full h-full pointer-events-none"
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
								stroke="hsl(var(--p))"
								stroke-width="3"
								stroke-linecap="round"
							/>
						{/if}
					{/each}
				</svg>

				<!-- Clickable hotspot areas -->
				{#each interaction.associableHotspots as hotspot}
					{@const isSelected = isHotspotSelected(hotspot.identifier)}
					{@const isMaxed = isHotspotMaxed(hotspot.identifier)}
					{@const usageCount = getHotspotUsageCount(hotspot.identifier)}

					{#if hotspot.shape === 'rect'}
						{@const [x1, y1, x2, y2] = hotspot.coords.split(',').map(Number)}
						<button
							class="absolute border-2 transition-all {isSelected
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
							class="absolute rounded-full border-2 flex items-center justify-center transition-all {isSelected
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
						class="stroke-current shrink-0 w-6 h-6"
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
		<div class="w-full lg:w-80">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<h3 class="card-title text-sm">
						Associations ({pairs.length}/{interaction.maxAssociations})
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
												class="h-4 w-4"
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

					{#if interaction.minAssociations > 0}
						<div class="text-xs text-base-content/60 mt-2">
							Minimum required: {interaction.minAssociations}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Ensure proper clickable areas */
	:global(.qti-graphic-associate-interaction button) {
		min-height: unset;
	}
</style>
