<svelte:options customElement="pie-qti-graphic-associate" />

<script lang="ts">
	import type { GraphicAssociateInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { isCompatibleMatchGroup } from '../../shared/utils/matchGroupUtils';

	interface Props {
		interaction?: GraphicAssociateInteractionData | string;
		response?: string[] | null;
		correctResponse?: string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<GraphicAssociateInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);
	const correctPairs = $derived(Array.isArray(parsedCorrectResponse) ? parsedCorrectResponse : []);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Pairs are stored as "ID1 ID2" strings (space-separated)
	let pairs = $state<string[]>([]);
	let selectedHotspot: string | null = $state(null);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);

	const canInteract = $derived(!disabled);
	const canAddMore = $derived(!parsedInteraction || pairs.length < parsedInteraction.maxAssociations);

	// Hotspots incompatible with the currently selected hotspot due to matchGroup constraints
	const blockedHotspots = $derived.by(() => {
		if (!selectedHotspot || !parsedInteraction) return new Set<string>();
		type WithMatchGroup = { identifier: string; matchGroup?: string[] };
		const hotspots = parsedInteraction.associableHotspots as (typeof parsedInteraction.associableHotspots[number] & WithMatchGroup)[];
		const src = hotspots.find((h) => h.identifier === selectedHotspot);
		return new Set(
			hotspots
				.filter((h) => h.identifier !== selectedHotspot && !isCompatibleMatchGroup(src?.matchGroup, h.matchGroup))
				.map((h) => h.identifier)
		);
	});

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
			if (blockedHotspots.has(hotspotId)) return;

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

	function getSelectedHotspotAnnouncement(id: string): string {
		const label = getHotspotById(id)?.label ?? id;
		const localized =
			i18n?.t('interactions.associate.selectAnotherHotspot', { label }) ??
			`Selected: <strong>${label}</strong>. Click another hotspot to create an association.`;

		// This announcement is rendered as a Svelte text node. Remove the legacy
		// catalog's presentation-only markup so neither the translation nor a QTI
		// hotspot label is ever passed to an {@html} sink.
		return localized.replace(/<\/?strong>/gi, '');
	}

	function isCorrectPair(id1: string, id2: string): boolean {
		if (!isShowingCorrect) return false;
		return correctPairs.some((p) => p === `${id1} ${id2}` || p === `${id2} ${id1}`);
	}

	function isHotspotInCorrectPair(id: string): boolean {
		if (!isShowingCorrect) return false;
		return correctPairs.some((p) => p.includes(id));
	}

	// Calculate center point of a hotspot for visual connections
	function getHotspotCenter(coords: string, shape: string): { x: number; y: number } {
		const parts = coords.split(',').map(Number);
		if (shape === 'rect') {
			// rect: left,top,right,bottom
			return {
				x: (parts[0] + parts[2]) / 2,
				y: (parts[1] + parts[3]) / 2,
			};
		} else if (shape === 'circle' || shape === 'ellipse') {
			// circle: cx,cy,r  |  ellipse: cx,cy,rx,ry
			return { x: parts[0], y: parts[1] };
		} else if (shape === 'poly') {
			// poly: x1,y1,x2,y2,... — centroid average
			const xs = parts.filter((_, i) => i % 2 === 0);
			const ys = parts.filter((_, i) => i % 2 !== 0);
			return {
				x: xs.reduce((a, b) => a + b, 0) / xs.length,
				y: ys.reduce((a, b) => a + b, 0) / ys.length,
			};
		}
		// Default fallback
		return { x: parts[0] || 0, y: parts[1] || 0 };
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-graphic-associate-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-ga-prompt qti-rich-content font-semibold mb-3">
				{@html parsedInteraction.prompt}
			</div>
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
								alt={i18n?.t('interactions.associate.altText') ?? 'Association diagram'}
								class="w-full h-full object-contain"
							/>
						{/if}
					{/if}

					<!-- SVG overlay for drawing connection lines -->
					<svg
						part="overlay"
						class="qti-ga-overlay absolute inset-0 w-full h-full pointer-events-none"
						style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; z-index: 10;"
					>
						{#each pairs as pair, index}
							{@const [id1, id2] = pair.split(' ')}
							{@const hotspot1 = getHotspotById(id1)}
							{@const hotspot2 = getHotspotById(id2)}
							{#if hotspot1 && hotspot2}
								{@const center1 = getHotspotCenter(hotspot1.coords, hotspot1.shape)}
								{@const center2 = getHotspotCenter(hotspot2.coords, hotspot2.shape)}
								{@const isCorrect = isCorrectPair(id1, id2)}
								<line
									x1={center1.x}
									y1={center1.y}
									x2={center2.x}
									y2={center2.y}
									stroke={isCorrect ? 'var(--pie-qti-success, oklch(76% 0.177 163.223))' : 'var(--pie-qti-primary, oklch(45% 0.24 277))'}
									stroke-width="3"
									stroke-linecap="round"
								/>
							{/if}
						{/each}
						{#if isShowingCorrect}
							{#each correctPairs as pair}
								{@const [id1, id2] = pair.split(' ')}
								{@const hotspot1 = getHotspotById(id1)}
								{@const hotspot2 = getHotspotById(id2)}
								{@const isInUserPairs = pairs.some((p) => p === pair || p === `${id2} ${id1}`)}
								{#if hotspot1 && hotspot2 && !isInUserPairs}
									{@const center1 = getHotspotCenter(hotspot1.coords, hotspot1.shape)}
									{@const center2 = getHotspotCenter(hotspot2.coords, hotspot2.shape)}
									<line
										x1={center1.x}
										y1={center1.y}
										x2={center2.x}
										y2={center2.y}
										stroke="var(--pie-qti-success, oklch(76% 0.177 163.223))"
										stroke-width="2"
										stroke-dasharray="4,4"
										stroke-linecap="round"
										opacity="0.6"
									/>
								{/if}
							{/each}
						{/if}
					</svg>

					<!-- Clickable hotspot areas -->
					{#each parsedInteraction.associableHotspots as hotspot}
						{@const isSelected = isHotspotSelected(hotspot.identifier)}
						{@const isMaxed = isHotspotMaxed(hotspot.identifier)}
						{@const isBlocked = blockedHotspots.has(hotspot.identifier)}
						{@const usageCount = getHotspotUsageCount(hotspot.identifier)}
						{@const isCorrect = isHotspotInCorrectPair(hotspot.identifier)}

						{#if hotspot.shape === 'rect'}
							{@const [x1, y1, x2, y2] = hotspot.coords.split(',').map(Number)}
							<button
								part="hotspot"
								class="qti-ga-hotspot absolute border-2 transition-all {isSelected
									? 'bg-primary/40 border-primary border-4'
									: isCorrect
										? 'bg-success/20 border-success'
										: 'bg-primary/10 border-primary hover:bg-primary/20'} {isMaxed || isBlocked
									? 'opacity-40 cursor-not-allowed'
									: canInteract
										? 'cursor-pointer'
										: 'cursor-not-allowed opacity-70'}"
								style="left: {x1}px; top: {y1}px; width: {x2 - x1}px; height: {y2 -
									y1}px; z-index: 20;"
								onclick={() => handleHotspotClick(hotspot.identifier)}
								disabled={!canInteract || isMaxed}
								aria-disabled={isBlocked ? 'true' : undefined}
								aria-label="{hotspot.label} ({usageCount}/{hotspot.matchMax} connections){isCorrect ? '. Correct answer' : isBlocked ? '. Not available due to match group restriction' : ''}"
							>
								<span class="text-xs font-bold text-primary-content">{hotspot.label}</span>
							</button>
						{:else if hotspot.shape === 'circle'}
							{@const [cx, cy, r] = hotspot.coords.split(',').map(Number)}
							<button
								part="hotspot"
								class="qti-ga-hotspot qti-ga-hotspot-circle absolute rounded-full border-2 flex items-center justify-center transition-all {isSelected
									? 'bg-primary/40 border-primary border-4'
									: isCorrect
										? 'bg-success/20 border-success'
										: 'bg-primary/10 border-primary hover:bg-primary/20'} {isMaxed || isBlocked
									? 'opacity-40 cursor-not-allowed'
									: canInteract
										? 'cursor-pointer'
										: 'cursor-not-allowed opacity-70'}"
								style="left: {cx - r}px; top: {cy - r}px; width: {r * 2}px; height: {r *
									2}px; z-index: 20;"
								onclick={() => handleHotspotClick(hotspot.identifier)}
								disabled={!canInteract || isMaxed}
								aria-disabled={isBlocked ? 'true' : undefined}
								aria-label="{hotspot.label} ({usageCount}/{hotspot.matchMax} connections){isCorrect ? '. Correct answer' : isBlocked ? '. Not available due to match group restriction' : ''}"
							>
								<span class="text-xs font-bold text-primary-content">{hotspot.label}</span>
							</button>
						{:else if hotspot.shape === 'ellipse'}
							<!-- Ellipse: QTI coords are cx,cy,rx,ry — use bounding box for hit target -->
							{@const [cx, cy, rx, ry] = hotspot.coords.split(',').map(Number)}
							<button
								part="hotspot"
								class="qti-ga-hotspot absolute border-2 flex items-center justify-center transition-all {isSelected
									? 'bg-primary/40 border-primary border-4'
									: isCorrect
										? 'bg-success/20 border-success'
										: 'bg-primary/10 border-primary hover:bg-primary/20'} {isMaxed || isBlocked
									? 'opacity-40 cursor-not-allowed'
									: canInteract
										? 'cursor-pointer'
										: 'cursor-not-allowed opacity-70'}"
								style="left: {cx - rx}px; top: {cy - ry}px; width: {rx * 2}px; height: {ry * 2}px; border-radius: 50%; z-index: 20;"
								onclick={() => handleHotspotClick(hotspot.identifier)}
								disabled={!canInteract || isMaxed}
								aria-disabled={isBlocked ? 'true' : undefined}
								aria-label="{hotspot.label} ({usageCount}/{hotspot.matchMax} connections){isCorrect ? '. Correct answer' : isBlocked ? '. Not available due to match group restriction' : ''}"
							>
								<span class="text-xs font-bold text-primary-content">{hotspot.label}</span>
							</button>
						{:else if hotspot.shape === 'poly'}
							<!-- Polygon: use axis-aligned bounding box of all vertices for hit target -->
							{@const pts = hotspot.coords.split(',').map(Number)}
							{@const xs = pts.filter((_, i) => i % 2 === 0)}
							{@const ys = pts.filter((_, i) => i % 2 !== 0)}
							{@const x1 = Math.min(...xs)}
							{@const y1 = Math.min(...ys)}
							{@const x2 = Math.max(...xs)}
							{@const y2 = Math.max(...ys)}
							<button
								part="hotspot"
								class="qti-ga-hotspot absolute border-2 flex items-center justify-center transition-all {isSelected
									? 'bg-primary/40 border-primary border-4'
									: isCorrect
										? 'bg-success/20 border-success'
										: 'bg-primary/10 border-primary hover:bg-primary/20'} {isMaxed || isBlocked
									? 'opacity-40 cursor-not-allowed'
									: canInteract
										? 'cursor-pointer'
										: 'cursor-not-allowed opacity-70'}"
								style="left: {x1}px; top: {y1}px; width: {x2 - x1}px; height: {y2 - y1}px; z-index: 20;"
								onclick={() => handleHotspotClick(hotspot.identifier)}
								disabled={!canInteract || isMaxed}
								aria-disabled={isBlocked ? 'true' : undefined}
								aria-label="{hotspot.label} ({usageCount}/{hotspot.matchMax} connections){isCorrect ? '. Correct answer' : isBlocked ? '. Not available due to match group restriction' : ''}"
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
						<span>{getSelectedHotspotAnnouncement(selectedHotspot)}</span>
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
									{@const isCorrect = isCorrectPair(id1, id2)}
									<div
										class="flex items-center gap-2 p-2 rounded-lg bg-base-200 border border-base-300 {isCorrect ? 'border-success bg-success/10' : ''}"
									>
										<div class="badge badge-sm {isCorrect ? 'badge-success' : 'badge-primary'}">{index + 1}</div>
										<div class="flex-1 text-sm">
											<span class="font-medium">{hotspot1?.label}</span>
											<span class="mx-1">↔</span>
											<span class="font-medium">{hotspot2?.label}</span>
										</div>
										{#if canInteract}
											<button
												class="btn btn-xs btn-ghost btn-circle"
												onclick={() => removePair(index)}
												aria-label={i18n?.t('interactions.associate.removeAssociation') ?? 'Remove association'}
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
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
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
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}
	.qti-ga-card-body {
		padding: 1rem;
	}
</style>
