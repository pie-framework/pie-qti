<svelte:options customElement="pie-qti-hotspot" />

<script lang="ts">
	import type { HotspotChoice, HotspotInteractionData } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { formatList, joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import HotspotShape from '../../shared/components/HotspotShape.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { minimumHint } from '../../shared/utils/minimumRequirement';
	import { hitStrokeWidth, imageAltText, observeWidth, shapeCenter } from './graphicRegions';

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

	const uid = $props.id();

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

	const choices = $derived(parsedInteraction?.hotspotChoices ?? []);
	const imageData = $derived(parsedInteraction?.imageData ?? null);
	const imageSrc = $derived(imageData?.type === 'image' ? (imageData.src ?? '') : '');

	// Raster images report their natural size once loaded; that is the pixel space
	// QTI coords are authored in when the item declares no width/height.
	let loadedImage = $state<{ src: string; width: number; height: number } | null>(null);
	let failedSrc = $state<string | null>(null);
	const naturalSize = $derived(loadedImage && loadedImage.src === imageSrc ? loadedImage : null);
	const imageFailed = $derived(!!imageSrc && failedSrc === imageSrc);

	function positiveNumber(value: unknown): number | null {
		const n = value ? Number(value) : Number.NaN;
		return Number.isFinite(n) && n > 0 ? n : null;
	}

	const authoredWidth = $derived(positiveNumber(imageData?.width));
	const authoredHeight = $derived(positiveNumber(imageData?.height));
	const hasAuthoredDimensions = $derived(authoredWidth !== null && authoredHeight !== null);
	const imageWidth = $derived(hasAuthoredDimensions ? authoredWidth : (naturalSize?.width ?? null));
	const imageHeight = $derived(hasAuthoredDimensions ? authoredHeight : (naturalSize?.height ?? null));

	const mediaStyle = $derived.by(() => {
		if (imageWidth && imageHeight) {
			// Fill available width, but don't exceed the asset's natural width.
			return `width: 100%; max-width: ${imageWidth}px; aspect-ratio: ${imageWidth} / ${imageHeight};`;
		}
		return 'width: 100%;';
	});

	// Hotspot `coords` are in the source image's pixel space, so the overlay
	// viewBox has to be the image's intrinsic dimensions. Without them there is
	// no correct viewBox: any guess silently misplaces every region. Refuse to
	// draw the overlay; tell authors why (console, and visibly outside the
	// candidate role) — candidates never see authoring diagnostics.
	const hasImageDimensions = $derived(imageWidth !== null && imageHeight !== null);
	const awaitingNaturalSize = $derived(!!imageSrc && !hasAuthoredDimensions && !naturalSize && !imageFailed);
	const missingDimensions = $derived(!!parsedInteraction && !hasImageDimensions && !awaitingNaturalSize);
	const showDiagnostics = $derived(role !== 'candidate');

	let warnedMissingDimensions = false;
	$effect(() => {
		if (missingDimensions && !warnedMissingDimensions) {
			warnedMissingDimensions = true;
			console.warn(
				'[pie-qti-hotspot] The hotspot image has no known width/height, so its regions cannot be placed. Add width and height to the image, or supply the asset dimensions.',
			);
		}
	});

	// Rendered width of the image, to size hit targets and markers in CSS px.
	let renderedWidth = $state(0);
	const renderScale = $derived(imageWidth && renderedWidth > 0 ? renderedWidth / imageWidth : 1);

	const imageAlt = $derived(
		imageAltText(imageData, translate(i18n, 'interactions.hotspot.imageFallback', 'Image for this question')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`${uid}-image-description`);

	function handleImageLoad(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		if (img.naturalWidth > 0 && img.naturalHeight > 0) {
			loadedImage = { src: imageSrc, width: img.naturalWidth, height: img.naturalHeight };
		}
	}

	function handleImageError() {
		failedSrc = imageSrc;
		console.warn(`[pie-qti-hotspot] The hotspot image failed to load: ${imageSrc}`);
	}

	/** Accessible, visible name of a region: its authored label, else its position. Never its identifier. */
	function regionName(choice: HotspotChoice, index: number): string {
		return (
			choice.hotspotLabel?.trim() ||
			translate(i18n, 'interactions.hotspot.regionOfTotal', 'Region {index} of {total}', {
				index: index + 1,
				total: choices.length,
			})
		);
	}

	function regionNameById(identifier: string): string {
		const index = choices.findIndex((choice) => choice.identifier === identifier);
		return index === -1 ? '' : regionName(choices[index], index);
	}

	function regionAriaLabel(name: string, correct: boolean): string {
		if (!correct) return name;
		return joinSentences(
			translate(i18n, 'accessibility.sentence', '{text}.', { text: name }),
			translate(i18n, 'accessibility.correctAnswer', 'Correct answer.'),
		);
	}

	const selectedRegionName = $derived(parsedResponse ? regionNameById(parsedResponse) : '');
	// Scorer view: correct regions by name; an id that matches no region is dropped, never shown raw.
	const correctRegionNames = $derived(correctIds.map((id) => regionNameById(id)).filter(Boolean));

	// Minimum requirement (minChoices): stated while fewer regions are selected, the same minimum
	// response validation enforces; the author's message wins. The regions have no group of
	// their own, so each region is described by it. Only while the candidate can still answer.
	const minHintId = `${uid}-min-hint`;
	const selectionCount = $derived(Array.isArray(parsedResponse) ? parsedResponse.length : parsedResponse ? 1 : 0);
	const minHint = $derived(
		minimumHint({
			i18n,
			minimum: !disabled && role === 'candidate' ? parsedInteraction?.minChoices : 0,
			count: selectionCount,
			authored: parsedInteraction?.minSelectionsMessage,
			key: 'interactions.hotspot.minChoicesHint',
			fallback: { one: 'Select at least {count} region.', other: 'Select at least {count} regions.' },
		})
	);

	function handleClick(identifier: string) {
		if (!disabled) {
			response = identifier;
			// Call onChange callback if provided (for Svelte component usage)
			emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: identifier, onChange });
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

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} class={['qti-hotspot-interaction space-y-3', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-hotspot-prompt qti-rich-content font-semibold">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		{#if missingDimensions && showDiagnostics}
			<div part="diagnostic" class="alert alert-error qti-hotspot-diagnostic" role="alert">
				{translate(
					i18n,
					'interactions.hotspot.unknownImageDimensions',
					'This hotspot cannot be shown: the size of its image is unknown, so the selectable regions cannot be placed. Add width and height to the image, or supply the asset dimensions.',
				)}
			</div>
		{/if}

		<div part="stage" class="qti-hotspot-stage">
			<div class="qti-hotspot-media" style={mediaStyle} use:observeWidth={(width) => (renderedWidth = width)}>
				<!-- Render the image/SVG with the author's text alternative -->
				{#if imageData}
					{#if imageData.type === 'svg'}
						<div
							part="image"
							class="qti-hotspot-image"
							role={imageData.decorative ? undefined : 'img'}
							aria-hidden={imageData.decorative ? 'true' : undefined}
							aria-label={imageData.decorative ? undefined : imageAlt}
							aria-describedby={imageDescription ? imageDescriptionId : undefined}
						>
							{@html imageData.content}
						</div>
					{:else if imageFailed}
						<div part="image-error" class="qti-hotspot-image qti-hotspot-image-error">
							<p>{translate(i18n, 'interactions.hotspot.imageLoadError', 'The image could not be loaded.')}</p>
							{#if imageData.alt && !imageData.decorative}
								<p>{imageData.alt}</p>
							{/if}
						</div>
					{:else}
						<img
							src={imageData.src}
							alt={imageAlt}
							aria-describedby={imageDescription ? imageDescriptionId : undefined}
							part="image"
							class="qti-hotspot-image"
							onload={handleImageLoad}
							onerror={handleImageError}
						/>
					{/if}
					{#if imageDescription}
						<p id={imageDescriptionId} class="qti-hotspot-sr-only">{imageDescription}</p>
					{/if}
				{/if}

				<!-- Overlay clickable areas using SVG.
				     Only rendered when the image's intrinsic dimensions are known: the
				     viewBox must match the pixel space the coords were authored in. -->
				{#if hasImageDimensions}
				<svg
					part="overlay"
					class="qti-hotspot-overlay"
					viewBox="0 0 {imageWidth} {imageHeight}"
					xmlns="http://www.w3.org/2000/svg"
					data-disabled={disabled ? '' : undefined}
				>
					{#each choices as choice, index}
						{@const isSelected = parsedResponse === choice.identifier}
						{@const isCorrectChoice = isCorrect(choice.identifier)}
						{@const center = shapeCenter(choice.shape, choice.coords)}
						<!-- One region: light halo + dark outline (visible on any image), a check
						     marker for selected/correct (not colour alone), then the invisible
						     interactive target on top, grown to 24×24 CSS px when small. -->
						<g
							class="qti-hotspot-region"
							data-selected={isSelected ? '' : undefined}
							data-correct={isCorrectChoice ? '' : undefined}
						>
							<HotspotShape shape={choice.shape} coords={choice.coords} interactive={false} presentation={{ class: 'qti-hotspot-halo' }} />
							<HotspotShape shape={choice.shape} coords={choice.coords} interactive={false} presentation={{ class: 'qti-hotspot-outline' }} />
							{#if isSelected || isCorrectChoice}
								<g
									class="qti-hotspot-marker"
									aria-hidden="true"
									transform="translate({center.x} {center.y}) scale({1 / renderScale})"
								>
									<circle r="10" />
									<path d="M-4.5 0.5 L-1.5 3.5 L4.5 -3" />
								</g>
							{/if}
							<HotspotShape
								shape={choice.shape}
								coords={choice.coords}
								label={regionAriaLabel(regionName(choice, index), isCorrectChoice)}
								{disabled}
								pressed={isSelected}
								presentation={{
									class: 'qti-hotspot-shape',
									style: `--qti-hit-stroke: ${hitStrokeWidth(choice.shape, choice.coords, renderScale)}px;`,
									'data-selected': isSelected ? '' : undefined,
									'aria-describedby': minHint ? minHintId : undefined,
								}}
								onclick={() => handleClick(choice.identifier)}
								onkeydown={(e) => handleKeyDown(e, choice.identifier)}
							/>
						</g>
					{/each}
				</svg>
				{/if}
			</div>
		</div>

		{#if selectedRegionName || correctRegionNames.length > 0}
			<div part="selected" class="alert alert-info">
				{#if selectedRegionName}
					<span>{translate(i18n, 'interactions.hotspot.selectedRegion', 'Selected: {region}', { region: selectedRegionName })}</span>
				{/if}
				{#if correctRegionNames.length > 0}
					<span class="qti-hotspot-correct-list">{translate(i18n, 'interactions.hotspot.correctList', 'Correct: {ids}', { ids: formatList(i18n, correctRegionNames) })}</span>
				{/if}
			</div>
		{/if}
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(parsedResponse ?? null)} />
		{#if parsedInteraction.maxSelectionsMessage}
			{@const selected = Array.isArray(parsedResponse) ? parsedResponse : (parsedResponse ? [parsedResponse] : [])}
			{#if selected.length >= parsedInteraction.maxChoices && parsedInteraction.maxChoices > 0}
				<p class="qti-selection-message" role="alert">{parsedInteraction.maxSelectionsMessage}</p>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.qti-selection-message {
		font-size: 0.875rem;
		color: var(--pie-qti-warning-text, #92400e);
		margin-block-start: 0.25rem;
	}

	/*
	 * Region outlines must show on any image (WCAG 1.4.11): a light halo under a
	 * dark outline gives at least 3:1 against both light and dark pixels.
	 * qti-selections-light / qti-selections-dark (QTI shared vocabulary) flip the
	 * pair for images that are predominantly dark or light.
	 */
	.qti-hotspot-interaction {
		--qti-hotspot-halo: #fff;
		--qti-hotspot-outline: var(--pie-qti-border-strong, #767676);
		--qti-hotspot-selected: var(--pie-qti-primary, oklch(45% 0.24 277));
		--qti-hotspot-correct: var(--pie-qti-success-text, #15803d);
	}
	.qti-hotspot-interaction.qti-selections-light {
		--qti-hotspot-halo: #000;
		--qti-hotspot-outline: #fff;
	}
	.qti-hotspot-interaction.qti-selections-dark {
		--qti-hotspot-halo: #fff;
		--qti-hotspot-outline: #000;
	}

	.qti-hotspot-overlay :global(.qti-hotspot-halo),
	.qti-hotspot-overlay :global(.qti-hotspot-outline),
	.qti-hotspot-overlay :global(.qti-hotspot-marker) {
		pointer-events: none;
	}
	.qti-hotspot-overlay :global(.qti-hotspot-halo) {
		fill: none;
		stroke: var(--qti-hotspot-halo);
		stroke-width: 5px;
		vector-effect: non-scaling-stroke;
	}
	.qti-hotspot-overlay :global(.qti-hotspot-outline) {
		fill: transparent;
		stroke: var(--qti-hotspot-outline);
		stroke-width: 2px;
		vector-effect: non-scaling-stroke;
		transition: fill 120ms ease;
	}
	/* Pointer hover affordance */
	.qti-hotspot-overlay:not([data-disabled]) :global(.qti-hotspot-region:hover .qti-hotspot-outline) {
		fill: color-mix(in srgb, var(--qti-hotspot-selected) 12%, transparent);
	}
	/* Selected: thicker outline, tint and a check marker — never colour alone (WCAG 1.4.1) */
	.qti-hotspot-overlay :global(.qti-hotspot-region[data-selected] .qti-hotspot-outline) {
		stroke: var(--qti-hotspot-selected);
		stroke-width: 4px;
		fill: color-mix(in srgb, var(--qti-hotspot-selected) 25%, transparent);
	}
	.qti-hotspot-overlay :global(.qti-hotspot-region[data-selected] .qti-hotspot-halo) {
		stroke-width: 8px;
	}
	/* Correct answer (scorer view): dashed outline and a check marker */
	.qti-hotspot-overlay :global(.qti-hotspot-region[data-correct]:not([data-selected]) .qti-hotspot-outline) {
		stroke: var(--qti-hotspot-correct);
		stroke-width: 3px;
		stroke-dasharray: 6px 3px;
	}
	.qti-hotspot-overlay :global(.qti-hotspot-marker circle) {
		fill: var(--qti-hotspot-selected);
		stroke: #fff;
		stroke-width: 2px;
	}
	.qti-hotspot-overlay :global(.qti-hotspot-region[data-correct]:not([data-selected]) .qti-hotspot-marker circle) {
		fill: var(--qti-hotspot-correct);
	}
	.qti-hotspot-overlay :global(.qti-hotspot-marker path) {
		fill: none;
		stroke: #fff;
		stroke-width: 2px;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/*
	 * The interactive target: invisible (but painted, so its interior takes the
	 * pointer), with a transparent non-scaling stroke that grows small regions to
	 * the 24×24 CSS px minimum (WCAG 2.5.8) without changing scoring geometry.
	 */
	.qti-hotspot-overlay :global(.qti-hotspot-shape) {
		fill: rgba(0, 0, 0, 0);
		stroke: rgba(0, 0, 0, 0);
		stroke-width: var(--qti-hit-stroke, 0px);
		vector-effect: non-scaling-stroke;
		cursor: pointer;
		outline: none;
	}
	.qti-hotspot-overlay[data-disabled] :global(.qti-hotspot-shape) {
		cursor: not-allowed;
	}
	/* Focus indicator drawn on the region outline (WCAG 2.4.7), haloed for any background */
	.qti-hotspot-overlay :global(.qti-hotspot-shape:focus-visible) {
		stroke: var(--pie-qti-focus, #4338ca);
		stroke-width: 3px;
	}
	.qti-hotspot-overlay :global(.qti-hotspot-region:focus-within .qti-hotspot-halo) {
		stroke-width: 9px;
	}

	/* qti-unselected-hidden: unselected regions show only while focused; they stay operable */
	.qti-unselected-hidden .qti-hotspot-overlay :global(.qti-hotspot-region:not([data-selected]):not(:focus-within) :is(.qti-hotspot-halo, .qti-hotspot-outline)) {
		fill: transparent;
		stroke: transparent;
	}

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
	.qti-hotspot-diagnostic {
		font-size: 0.875rem;
	}
	.qti-hotspot-image {
		display: block;
		width: 100%;
		height: 100%;
	}
	.qti-hotspot-image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: 6rem;
		padding: 1rem;
		text-align: center;
		color: var(--pie-qti-error-text, #b91c1c);
		border: 2px dashed var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		box-sizing: border-box;
	}
	.qti-hotspot-image-error p {
		margin: 0;
	}
	.qti-hotspot-correct-list {
		margin-inline-start: 0.5rem;
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
		width: 100%;
		height: 100%;
		/* halos, focus rings and grown hit areas may extend past the image edge */
		overflow: visible;
	}
	.qti-hotspot-sr-only {
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
