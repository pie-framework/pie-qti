<svelte:options customElement="pie-qti-graphic-associate" />

<script lang="ts">
	import type { GraphicAssociateHotspot, GraphicAssociateInteractionData } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { normalizePixelDimension } from '@pie-qti/item-player/security';
	import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { isCompatibleMatchGroup } from '../../shared/utils/matchGroupUtils';
	import { countPairsWithId, pairIncludesId } from '../../shared/utils/pairHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import { imageAltText, shapeBounds, shapeCenter } from '../hotspot/graphicRegions';

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

	const uid = $props.id();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<GraphicAssociateInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);
	const correctPairs = $derived(Array.isArray(parsedCorrectResponse) ? parsedCorrectResponse : []);
	const imageWidth = $derived(
		Number(normalizePixelDimension(parsedInteraction?.imageData?.width, '500') ?? '500'),
	);
	const imageHeight = $derived(
		Number(normalizePixelDimension(parsedInteraction?.imageData?.height, '300') ?? '300'),
	);
	// Reflow (WCAG 1.4.10): the stage scales with its container up to the image's
	// natural size; hotspots are positioned in percentages of the natural size.
	const stageStyle = $derived(`max-width: calc(${imageWidth}px + 4px);`);
	const canvasStyle = $derived(`aspect-ratio: ${imageWidth} / ${imageHeight};`);

	const imageData = $derived(parsedInteraction?.imageData ?? null);
	const imageAlt = $derived(
		imageAltText(imageData, translate(i18n, 'interactions.graphicAssociate.imageFallback', 'Image for this question')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`${uid}-image-description`);
	let failedSrc = $state<string | null>(null);
	const imageFailed = $derived(!!imageData?.src && failedSrc === imageData.src);

	function handleImageError() {
		failedSrc = imageData?.src ?? null;
		console.warn(`[pie-qti-graphic-associate] The image failed to load: ${imageData?.src ?? ''}`);
	}

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Pairs are stored as "ID1 ID2" strings (space-separated)
	let pairs = $state<string[]>([]);
	let selectedHotspot: string | null = $state(null);

	const canInteract = $derived(!disabled);
	const canAddMore = $derived(!parsedInteraction || pairs.length < parsedInteraction.maxAssociations);

	// Hotspots incompatible with the currently selected hotspot due to matchGroup constraints
	const blockedHotspots = $derived.by(() => {
		if (!selectedHotspot || !parsedInteraction) return new Set<string>();
		const hotspots = parsedInteraction.associableHotspots;
		const src = hotspots.find((h) => h.identifier === selectedHotspot);
		return new Set(
			hotspots
				.filter((h) => h.identifier !== selectedHotspot && !isCompatibleMatchGroup(src, h))
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
		const usageCount = countPairsWithId(pairs, hotspotId);
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
			emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: pairs, onChange });
			selectedHotspot = null;
		}
	}

	function removePair(index: number) {
		if (!canInteract) return;
		pairs = pairs.filter((_, i) => i !== index);
		response = pairs;
		// Call onChange callback if provided (for Svelte component usage)
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: pairs, onChange });
	}

	function getHotspotById(id: string) {
		return parsedInteraction?.associableHotspots.find((h) => h.identifier === id);
	}

	/** Visible and accessible name: the authored label, else a localized ordinal. Never the identifier. */
	function hotspotName(hotspot: GraphicAssociateHotspot | undefined): string {
		if (!hotspot) return '';
		const index = parsedInteraction?.associableHotspots.indexOf(hotspot) ?? -1;
		return (
			hotspot.label?.trim() ||
			translate(i18n, 'interactions.graphicAssociate.unlabeledHotspot', 'Region {index}', { index: index + 1 })
		);
	}

	function hotspotNameById(id: string): string {
		return hotspotName(getHotspotById(id));
	}

	function isHotspotSelected(id: string): boolean {
		return selectedHotspot === id;
	}

	function getHotspotUsageCount(id: string): number {
		return countPairsWithId(pairs, id);
	}

	function isHotspotMaxed(id: string): boolean {
		const hotspot = getHotspotById(id);
		if (!hotspot) return false;
		return getHotspotUsageCount(id) >= hotspot.matchMax;
	}

	function hotspotAriaLabel(hotspot: GraphicAssociateHotspot, usageCount: number, isCorrect: boolean, isBlocked: boolean): string {
		return joinSentences(
			translate(i18n, 'accessibility.sentence', '{text}.', {
				text: translate(i18n, 'interactions.graphicAssociate.hotspotConnections', '{label} ({usageCount}/{matchMax} connections)', {
					label: hotspotName(hotspot),
					usageCount,
					matchMax: hotspot.matchMax,
				}),
			}),
			isCorrect
				? translate(i18n, 'accessibility.correctAnswer', 'Correct answer.')
				: isBlocked && translate(i18n, 'interactions.graphicAssociate.notAvailableSentence', 'Not available due to a match group restriction.'),
		);
	}

	function isCorrectPair(id1: string, id2: string): boolean {
		if (!isShowingCorrect) return false;
		return correctPairs.some((p) => p === `${id1} ${id2}` || p === `${id2} ${id1}`);
	}

	function isHotspotInCorrectPair(id: string): boolean {
		if (!isShowingCorrect) return false;
		return correctPairs.some((p) => pairIncludesId(p, id));
	}

	/**
	 * Hotspot button box in percentages of the natural image, centred on the
	 * region so the 24×24 CSS px minimum target (WCAG 2.5.8) grows symmetrically.
	 */
	function hotspotBoxStyle(hotspot: GraphicAssociateHotspot): string {
		const bounds = shapeBounds(hotspot.shape, hotspot.coords) ?? { x: 0, y: 0, width: 0, height: 0 };
		const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(4)}%`;
		return [
			`left: ${pct(bounds.x + bounds.width / 2, imageWidth)}`,
			`top: ${pct(bounds.y + bounds.height / 2, imageHeight)}`,
			`width: ${pct(bounds.width, imageWidth)}`,
			`height: ${pct(bounds.height, imageHeight)}`,
		].join('; ');
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class="qti-graphic-associate-interaction">
	<InteractionDescription interaction={parsedInteraction} />
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
					part="stage"
					class="qti-ga-stage relative border-2 border-base-300 rounded-lg bg-base-200"
					style={stageStyle}
				>
					<!-- Borderless positioning canvas: exactly the image's aspect ratio, so the
					     percentage hotspot boxes and the overlay's viewBox align at any scale. -->
					<div class="qti-ga-canvas" style={canvasStyle}>
					{#if imageData}
						{#if imageData.type === 'svg' && imageData.content}
							<div
								part="image"
								class="qti-ga-image"
								role={imageData.decorative ? undefined : 'img'}
								aria-hidden={imageData.decorative ? 'true' : undefined}
								aria-label={imageData.decorative ? undefined : imageAlt}
								aria-describedby={imageDescription ? imageDescriptionId : undefined}
							>
								{@html imageData.content}
							</div>
						{:else if imageFailed}
							<div part="image-error" class="qti-ga-image qti-ga-image-error">
								<p>{translate(i18n, 'interactions.graphicAssociate.imageLoadError', 'The image could not be loaded.')}</p>
								{#if imageData.alt && !imageData.decorative}
									<p>{imageData.alt}</p>
								{/if}
							</div>
						{:else if imageData.src}
							<img
								part="image"
								src={imageData.src}
								alt={imageAlt}
								aria-describedby={imageDescription ? imageDescriptionId : undefined}
								class="qti-ga-image"
								onerror={handleImageError}
							/>
						{/if}
					{/if}

					<!-- SVG overlay for drawing connection lines (natural image coordinates, scales with the stage) -->
					<svg
						part="overlay"
						class="qti-ga-overlay"
						viewBox="0 0 {imageWidth} {imageHeight}"
						aria-hidden="true"
					>
						{#each pairs as pair}
							{@const [id1, id2] = pair.split(' ')}
							{@const hotspot1 = getHotspotById(id1)}
							{@const hotspot2 = getHotspotById(id2)}
							{#if hotspot1 && hotspot2}
								{@const center1 = shapeCenter(hotspot1.shape, hotspot1.coords)}
								{@const center2 = shapeCenter(hotspot2.shape, hotspot2.coords)}
								{@const isCorrect = isCorrectPair(id1, id2)}
								<line
									x1={center1.x}
									y1={center1.y}
									x2={center2.x}
									y2={center2.y}
									class="qti-ga-line {isCorrect ? 'qti-ga-line-correct' : ''}"
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
									{@const center1 = shapeCenter(hotspot1.shape, hotspot1.coords)}
									{@const center2 = shapeCenter(hotspot2.shape, hotspot2.coords)}
									<line
										x1={center1.x}
										y1={center1.y}
										x2={center2.x}
										y2={center2.y}
										class="qti-ga-line qti-ga-line-expected"
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
						<button
							type="button"
							part="hotspot"
							class="qti-ga-hotspot"
							class:qti-ga-hotspot-round={hotspot.shape === 'circle' || hotspot.shape === 'ellipse'}
							class:qti-ga-hotspot-selected={isSelected}
							class:qti-ga-hotspot-correct={isCorrect && !isSelected}
							class:qti-ga-hotspot-unavailable={isMaxed || isBlocked}
							style={hotspotBoxStyle(hotspot)}
							onclick={() => handleHotspotClick(hotspot.identifier)}
							disabled={!canInteract || isMaxed}
							aria-disabled={isBlocked ? 'true' : undefined}
							aria-pressed={isSelected}
							aria-label={hotspotAriaLabel(hotspot, usageCount, isCorrect, isBlocked)}
						>
							<span class="qti-ga-hotspot-label" aria-hidden="true">{hotspotName(hotspot)}</span>
						</button>
					{/each}
					</div>
				</div>
				{#if imageDescription}
					<p id={imageDescriptionId} class="qti-ga-sr-only">{imageDescription}</p>
				{/if}

				{#if selectedHotspot}
					<div class="alert alert-info mt-2" role="status">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							part="selected-icon"
							class="qti-icon stroke-current shrink-0 w-6 h-6"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						<span>{translate(i18n, 'interactions.graphicAssociate.selectAnotherHotspot', 'Selected: {label}. Select another hotspot to create an association.', {
							label: hotspotNameById(selectedHotspot),
						})}</span>
					</div>
				{/if}
			</div>

			<!-- Associations List -->
			<div part="panel" class="qti-ga-panel w-full lg:w-80">
				<div class="qti-ga-card card bg-base-100 border border-base-300">
					<div class="qti-ga-card-body card-body p-4">
						<h3 class="card-title text-sm">
							{translate(i18n, 'interactions.graphicAssociate.associationsCount', 'Associations ({count}/{max})', {
								count: pairs.length,
								max: parsedInteraction.maxAssociations,
							})}
						</h3>

						{#if pairs.length === 0}
							<p class="text-sm text-base-content/60">
								{translate(
									i18n,
									'interactions.graphicAssociate.clickHotspotsToAssociate',
									'Select two hotspots on the image to create an association.',
								)}
							</p>
						{:else}
							<ul class="qti-ga-pairs space-y-2">
								{#each pairs as pair, index}
									{@const [id1, id2] = pair.split(' ')}
									{@const isCorrect = isCorrectPair(id1, id2)}
									{@const first = hotspotNameById(id1)}
									{@const second = hotspotNameById(id2)}
									<li
										class="qti-ga-pair flex items-center gap-2 p-2 rounded-lg bg-base-200 border border-base-300"
										class:qti-ga-pair-correct={isCorrect}
									>
										<span class="badge badge-sm {isCorrect ? 'badge-success' : 'badge-primary'}" aria-hidden="true">{isCorrect ? '✓' : index + 1}</span>
										<span class="flex-1 text-sm">
											<span class="qti-ga-sr-only">
												{joinSentences(
													translate(i18n, 'accessibility.sentence', '{text}.', {
														text: translate(i18n, 'interactions.graphicAssociate.pairDescription', '{first} associated with {second}', { first, second }),
													}),
													isCorrect && translate(i18n, 'accessibility.correctAnswer', 'Correct answer.'),
												)}
											</span>
											<span aria-hidden="true">
												<span class="font-medium">{first}</span>
												<span class="qti-ga-pair-arrow">↔</span>
												<span class="font-medium">{second}</span>
											</span>
										</span>
										{#if canInteract}
											<button
												type="button"
												class="qti-ga-remove btn btn-xs btn-ghost btn-circle"
												onclick={() => removePair(index)}
												aria-label={translate(i18n, 'interactions.graphicAssociate.removeAssociation', 'Remove association between {first} and {second}', { first, second })}
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													part="remove-icon"
													class="qti-icon-sm h-4 w-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													aria-hidden="true"
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
									</li>
								{/each}
							</ul>
						{/if}

						{#if parsedInteraction.minAssociations > 0}
							<div class="text-xs text-base-content/60 mt-2">
								{translate(i18n, 'interactions.graphicAssociate.minimumRequired', 'Minimum required: {minAssociations}', {
									minAssociations: parsedInteraction.minAssociations,
								})}
							</div>
						{/if}
					</div>
				</div>
			</div>
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
		min-width: min(280px, 100%);
	}
	/* The stage frame fills the available width up to the image's natural size (+ its border).
	   No overflow clipping: focus rings and grown hit areas at the image edge must stay visible. */
	.qti-ga-stage {
		position: relative;
		width: 100%;
		box-sizing: border-box;
		border-radius: 0.75rem;
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}
	.qti-ga-canvas {
		position: relative;
		width: 100%;
	}
	.qti-ga-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.qti-ga-image :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.qti-ga-image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 1rem;
		box-sizing: border-box;
		text-align: center;
		color: var(--pie-qti-error-text, #b91c1c);
	}
	.qti-ga-image-error p {
		margin: 0;
	}
	/* Critical: overlay must be absolutely positioned even without Tailwind utilities */
	.qti-ga-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 10;
	}
	.qti-ga-line {
		stroke: var(--pie-qti-primary, oklch(45% 0.24 277));
		stroke-width: 3px;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}
	.qti-ga-line-correct {
		stroke: var(--pie-qti-success-text, #15803d);
		stroke-width: 4px;
	}
	.qti-ga-line-expected {
		stroke: var(--pie-qti-success-text, #15803d);
		stroke-width: 2px;
		stroke-dasharray: 4px 4px;
	}

	/*
	 * Hotspot buttons: centred on their region (positions are percentages of the
	 * natural image), never smaller than the 24×24 CSS px target minimum.
	 * A light halo under a dark outline keeps the boundary visible on any image.
	 */
	.qti-ga-hotspot {
		position: absolute;
		z-index: 20;
		transform: translate(-50%, -50%);
		min-width: 24px;
		min-height: 24px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		margin: 0;
		overflow: hidden;
		cursor: pointer;
		border: 2px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.25rem;
		box-shadow: 0 0 0 2px #fff;
		background: color-mix(in srgb, var(--pie-qti-primary, #4338ca) 10%, transparent);
		color: var(--pie-qti-base-content, #1f2937);
		font: inherit;
		transition: background-color 120ms ease, border-color 120ms ease;
	}
	.qti-ga-hotspot-round {
		border-radius: 50%;
	}
	.qti-ga-hotspot:hover:not(:disabled) {
		background: color-mix(in srgb, var(--pie-qti-primary, #4338ca) 22%, transparent);
	}
	.qti-ga-hotspot:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	/* Selected: thicker border plus a stripe pattern — never colour alone (WCAG 1.4.1) */
	.qti-ga-hotspot-selected {
		border-width: 4px;
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: repeating-linear-gradient(
			45deg,
			color-mix(in srgb, var(--pie-qti-primary, #4338ca) 40%, transparent) 0 6px,
			color-mix(in srgb, var(--pie-qti-primary, #4338ca) 12%, transparent) 6px 12px
		);
	}
	/* Correct answer (scorer view): dashed success border */
	.qti-ga-hotspot-correct {
		border-style: dashed;
		border-color: var(--pie-qti-success-text, #15803d);
	}
	.qti-ga-hotspot-unavailable,
	.qti-ga-hotspot:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
	.qti-ga-hotspot-label {
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1.1;
		padding: 0 0.125rem;
		background: var(--pie-qti-base-100, #fff);
		border-radius: 0.25rem;
		color: var(--pie-qti-base-content, #1f2937);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
	.qti-ga-panel {
		flex: 0 0 20rem;
		min-width: min(18rem, 100%);
	}
	.qti-ga-card {
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}
	.qti-ga-card-body {
		padding: 1rem;
	}
	.qti-ga-pairs {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.qti-ga-pair-correct {
		border-color: var(--pie-qti-success-text, #15803d);
	}
	.qti-ga-pair-arrow {
		margin-inline: 0.25rem;
	}
	.qti-ga-remove {
		min-width: 24px;
		min-height: 24px;
	}
	.qti-ga-remove:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-ga-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
