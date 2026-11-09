<svelte:options customElement="pie-qti-hotspot" />

<script lang="ts">
	import type { HotspotChoice, HotspotInteractionData } from '@pie-qti/item-player';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { formatList, joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import { radioArrowStep, wrapIndex } from '../../shared/utils/radioGroup';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import HotspotShape from '../../shared/components/HotspotShape.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { minimumHint } from '../../shared/utils/minimumRequirement';
	import { hitStrokeWidth, imageAltText, observeWidth, regionMarkerPoint, type Point } from './graphicRegions';

	interface Props {
		interaction?: HotspotInteractionData | string;
		/** The chosen region's identifier (single selection), or the chosen regions' identifiers (multiple). */
		response?: string | string[] | null;
		correctResponse?: string | string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		/**
		 * Called with the chosen region's identifier (single selection) or the chosen regions'
		 * identifiers (multiple selection); null (single) or [] (multiple) when the answer is cleared.
		 */
		onChange?: (value: string | string[] | null) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	const uid = $props.id();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<HotspotInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string | string[]>(response));
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

	/**
	 * The selected regions' identifiers, in selection order. The response is one identifier in
	 * single selection and a list in multiple selection; a single selection bound to a
	 * multiple-cardinality response comes back as a one-element list. Identifiers that name no
	 * region, and repeats, are dropped.
	 */
	const selectedIds = $derived.by(() => {
		const raw = Array.isArray(parsedResponse) ? parsedResponse : typeof parsedResponse === 'string' ? [parsedResponse] : [];
		const known = new Set(choices.map((choice) => choice.identifier));
		return [...new Set(raw.filter((id) => typeof id === 'string' && known.has(id)))];
	});

	function isSelected(identifier: string): boolean {
		return selectedIds.includes(identifier);
	}

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

	/**
	 * Where a region's check marker sits, in image coordinates: the centre of its shape, or for a
	 * default-shape region — the whole image — 14 CSS px in from the top-left corner.
	 */
	function markerPoint(choice: HotspotChoice): Point {
		return regionMarkerPoint(choice.shape, choice.coords, renderScale, 14);
	}

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

	// The visible summary names every selected region (never its identifier).
	const selectedRegionNames = $derived(selectedIds.map((id) => regionNameById(id)).filter(Boolean));
	// Scorer view: correct regions by name; an id that matches no region is dropped, never shown raw.
	const correctRegionNames = $derived(correctIds.map((id) => regionNameById(id)).filter(Boolean));

	// Minimum requirement (minChoices): stated while fewer regions are selected, the same minimum
	// response validation enforces; the author's message wins. Each region is described by it,
	// so it is heard on the region that has focus. Only while the candidate can still answer.
	const minHintId = `${uid}-min-hint`;
	const selectionCount = $derived(selectedIds.length);
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

	// Single cardinality (maxChoices=1) is a radio group, as single-select hottext and
	// choiceInteraction's radios: one checked region, which another one replaces and which
	// activating it again never unchecks; "Clear answer" retracts it. Any other maxChoices
	// (QTI 3.0 §5.68.2: above 1, or 0 for no restriction, binds a multiple-cardinality
	// response) keeps aria-pressed toggle buttons, each its own Tab stop: the response is the
	// list of selected regions.
	const isSingle = $derived(parsedInteraction?.maxChoices === 1);

	// Selection limit (maxChoices; 0 is no restriction). Multiple selection refuses a selection
	// past it. The message is the author's data-max-selections-message ("rendered upon violation
	// of the max-choices constraint", QTI 3.0 §5.68.4), else the localized default choice and
	// hottext show. It is stated at the cap, by the same rule as theirs: an authored message for
	// any cardinality, the default only where a selection can be refused. A refusal announces it.
	const maxChoices = $derived(parsedInteraction?.maxChoices ?? 0);
	const atLimit = $derived(!isSingle && maxChoices > 0 && selectedIds.length >= maxChoices);
	const maxMessage = $derived(
		parsedInteraction?.maxSelectionsMessage ||
			translate(i18n, 'interactions.hotspot.maxChoicesReached', 'You can select up to {max}. Deselect one to choose another.', {
				max: maxChoices,
			})
	);
	const showMaxMessage = $derived(
		maxChoices > 0 && selectedIds.length >= maxChoices && (!!parsedInteraction?.maxSelectionsMessage || maxChoices > 1)
	);

	// Polite status messages (a refused selection) for the always-rendered live region.
	let statusAnnouncement = $state('');

	/**
	 * Put `message` in the live region. Announcing the same message again would leave the text
	 * unchanged, which assistive technology does not announce, so a repeat toggles a trailing
	 * zero-width space (silent to screen readers) to make it a change.
	 */
	function announce(message: string) {
		statusAnnouncement = statusAnnouncement === message ? `${message}\u200b` : message;
	}

	// The radio group is named by the prompt, else by a generic localized label.
	const promptId = `${uid}-prompt`;
	const hasPrompt = $derived(!!parsedInteraction?.prompt);
	const radioGroupAria = $derived.by(() => {
		if (!isSingle) return {};
		if (hasPrompt) return { role: 'radiogroup', 'aria-labelledby': promptId };
		return { role: 'radiogroup', 'aria-label': translate(i18n, 'interactions.hotspot.ariaLabel', 'Hotspot interaction') };
	});

	// Roving tabindex (single selection): the radio group is one Tab stop — the checked region,
	// else the first — and the arrow keys move within it.
	const tabStopIdentifier = $derived(
		isSingle
			? (choices.find((choice) => isSelected(choice.identifier))?.identifier ?? choices[0]?.identifier)
			: undefined
	);

	let overlayElement: SVGSVGElement | undefined = $state();

	/** The interactive region targets, in hotspotChoice order. */
	function regionElements(): SVGElement[] {
		return overlayElement ? Array.from(overlayElement.querySelectorAll<SVGElement>('.qti-hotspot-shape')) : [];
	}

	/** Record the response and emit it. */
	function commit(value: string | string[] | null) {
		response = value;
		// Call onChange callback if provided (for Svelte component usage)
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value, onChange });
	}

	/**
	 * Activate a region: click or tap, Enter or Space, or an arrow key in the radio group.
	 * Single selection checks it; activating the checked region again keeps it and emits
	 * nothing. Multiple selection toggles it: a selected region is deselected, an unselected
	 * one is added unless the selection is at maxChoices, where the refusal is announced.
	 */
	function activate(identifier: string) {
		if (disabled || !parsedInteraction) return;
		if (isSingle) {
			if (isSelected(identifier)) return;
			commit(identifier);
			return;
		}
		if (isSelected(identifier)) {
			commit(selectedIds.filter((id) => id !== identifier));
			return;
		}
		if (atLimit) {
			// Refused at the cap: nothing changes, so nothing is emitted
			announce(maxMessage);
			return;
		}
		commit([...selectedIds, identifier]);
	}

	/**
	 * Keyboard model. Enter and Space activate the focused region in either mode. In the radio
	 * group (single selection) the arrow keys move focus to the next or previous region, in
	 * hotspotChoice order and wrapping at the ends, and check it (WAI-ARIA APG radio group);
	 * Tab leaves the group from its one Tab stop. Toggle buttons leave the arrow keys alone.
	 */
	function handleKeyDown(event: KeyboardEvent, index: number) {
		if (disabled) return;
		const choice = choices[index];
		if (!choice) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			activate(choice.identifier);
			return;
		}
		if (!isSingle) return;
		const regions = regionElements();
		const current = regions[index];
		if (!current) return;
		const step = radioArrowStep(event, current);
		if (step === 0) return;
		event.preventDefault();
		const nextIndex = wrapIndex(index, step, choices.length);
		const next = choices[nextIndex];
		if (!next) return;
		regions[nextIndex]?.focus();
		activate(next.identifier);
	}

	// Clear answer: the visible way to retract the whole answer, with the same name and rule as
	// choiceInteraction's control (WCAG 3.2.4): offered only while there is an answer to retract
	// and the interaction is enabled.
	const canClearAnswer = $derived(selectedIds.length > 0 && !disabled);

	/**
	 * Retract the answer: null in single selection — the clear signal the player listens for —
	 * and the empty list in multiple selection, as hottext does. The control removes itself with
	 * the answer, which would drop keyboard focus to the document; focus moves to the first
	 * region instead — the radio group's Tab stop once nothing is checked — as
	 * choiceInteraction focuses its first radio.
	 */
	async function clearAnswer() {
		if (disabled || !parsedInteraction) return;
		commit(isSingle ? null : []);
		await tick();
		regionElements()[0]?.focus();
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} class={['qti-hotspot-interaction space-y-3', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')}>
	<InteractionDescription interaction={parsedInteraction} />
	<!-- Polite announcements (a refused selection). Always rendered, before any conditional
	     content, so the region exists before its text changes. -->
	<div aria-live="polite" aria-atomic="true" class="qti-hotspot-live-region">{statusAnnouncement}</div>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div id={promptId} part="prompt" class="qti-hotspot-prompt qti-rich-content font-semibold">
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
				     viewBox must match the pixel space the coords were authored in.
				     Single selection: the overlay is a radio group of role="radio" regions
				     (roving tabindex, arrow keys). Multiple: aria-pressed toggle buttons. -->
				{#if hasImageDimensions}
				<svg
					bind:this={overlayElement}
					part="overlay"
					class="qti-hotspot-overlay"
					viewBox="0 0 {imageWidth} {imageHeight}"
					xmlns="http://www.w3.org/2000/svg"
					data-disabled={disabled ? '' : undefined}
					{...radioGroupAria}
				>
					<!-- A region's visible layers: light halo + dark outline (visible on any image), and a
					     check marker for selected/correct (not colour alone). -->
					{#snippet regionVisuals(choice: HotspotChoice, selected: boolean, correct: boolean)}
						<HotspotShape shape={choice.shape} coords={choice.coords} interactive={false} presentation={{ class: 'qti-hotspot-halo' }} />
						<HotspotShape shape={choice.shape} coords={choice.coords} interactive={false} presentation={{ class: 'qti-hotspot-outline' }} />
						{#if selected || correct}
							{@const at = markerPoint(choice)}
							<g
								class="qti-hotspot-marker"
								aria-hidden="true"
								transform="translate({at.x} {at.y}) scale({1 / renderScale})"
							>
								<circle r="10" />
								<path d="M-4.5 0.5 L-1.5 3.5 L4.5 -3" />
							</g>
						{/if}
					{/snippet}

					<!-- Default-shape regions are the whole image (QTI 3.0 §8.29), so they lie beneath
					     every other region: their layers and pointer target are painted first, and a
					     click on another region stays that region's. Their control keeps its place in
					     hotspotChoice order below — for the keyboard and its name — and takes no
					     pointer input. -->
					{#each choices as choice}
						{#if choice.shape === 'default'}
							{@const regionSelected = isSelected(choice.identifier)}
							{@const isCorrectChoice = isCorrect(choice.identifier)}
							<g
								class="qti-hotspot-backdrop"
								data-selected={regionSelected ? '' : undefined}
								data-correct={isCorrectChoice ? '' : undefined}
							>
								{@render regionVisuals(choice, regionSelected, isCorrectChoice)}
								<HotspotShape
									shape={choice.shape}
									coords={choice.coords}
									interactive="pointer"
									presentation={{ class: 'qti-hotspot-pointer-target' }}
									onclick={() => activate(choice.identifier)}
								/>
							</g>
						{/if}
					{/each}

					{#each choices as choice, index}
						{@const regionSelected = isSelected(choice.identifier)}
						{@const isCorrectChoice = isCorrect(choice.identifier)}
						{@const isDefaultShape = choice.shape === 'default'}
						<!-- One region: its visible layers, then the invisible interactive target on
						     top, grown to 24×24 CSS px when small. -->
						<g
							class="qti-hotspot-region"
							data-selected={regionSelected ? '' : undefined}
							data-correct={isCorrectChoice ? '' : undefined}
						>
							{#if !isDefaultShape}
								{@render regionVisuals(choice, regionSelected, isCorrectChoice)}
							{/if}
							<HotspotShape
								shape={choice.shape}
								coords={choice.coords}
								label={regionAriaLabel(regionName(choice, index), isCorrectChoice)}
								{disabled}
								role={isSingle ? 'radio' : 'button'}
								pressed={regionSelected}
								checked={regionSelected}
								tabStop={!isSingle || choice.identifier === tabStopIdentifier}
								presentation={{
									class: isDefaultShape ? 'qti-hotspot-shape qti-hotspot-shape-default' : 'qti-hotspot-shape',
									style: `--qti-hit-stroke: ${hitStrokeWidth(choice.shape, choice.coords, renderScale)}px;${isDefaultShape ? ' pointer-events: none;' : ''}`,
									'data-selected': regionSelected ? '' : undefined,
									'aria-describedby': minHint ? minHintId : undefined,
									// A disabled region says so, as a disabled native control does
									'aria-disabled': disabled ? 'true' : undefined,
								}}
								onclick={() => activate(choice.identifier)}
								onkeydown={(event) => handleKeyDown(event, index)}
							/>
						</g>
					{/each}
				</svg>
				{/if}
			</div>
		</div>

		{#if selectedRegionNames.length > 0 || correctRegionNames.length > 0}
			<div part="selected" class="alert alert-info">
				{#if selectedRegionNames.length > 0}
					<span>{translate(i18n, 'interactions.hotspot.selectedRegion', 'Selected: {region}', { region: formatList(i18n, selectedRegionNames) })}</span>
				{/if}
				{#if correctRegionNames.length > 0}
					<span class="qti-hotspot-correct-list">{translate(i18n, 'interactions.hotspot.correctList', 'Correct: {ids}', { ids: formatList(i18n, correctRegionNames) })}</span>
				{/if}
			</div>
		{/if}
		<!-- Same name and rule as choiceInteraction's "Clear answer" (WCAG 3.2.4) -->
		{#if canClearAnswer}
			<button type="button" part="clear" class="qti-clear-btn" onclick={clearAnswer}>
				{translate(i18n, 'interactions.choice.clearAnswer', 'Clear answer')}
			</button>
		{/if}
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(selectedIds)} />
		{#if showMaxMessage}
			<p class="qti-selection-message" role="alert">{maxMessage}</p>
		{/if}
	{/if}
</div>

<style>
	.qti-selection-message {
		font-size: 0.875rem;
		color: var(--pie-qti-warning-text, #92400e);
		margin-block-start: 0.25rem;
	}

	/* Clear answer (single selection): same look as choiceInteraction's, a 44 px touch target */
	.qti-clear-btn {
		justify-self: start;
		min-height: 2.75rem;
		padding: 0.375rem 1rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.qti-clear-btn:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
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
	/* A default-shape region (the whole image) is drawn in a backdrop group beneath the other
	   regions; it takes the same states as a region. */
	/* Pointer hover affordance */
	.qti-hotspot-overlay:not([data-disabled]) :global(:is(.qti-hotspot-region, .qti-hotspot-backdrop):hover .qti-hotspot-outline) {
		fill: color-mix(in srgb, var(--qti-hotspot-selected) 12%, transparent);
	}
	/* Selected: thicker outline, tint and a check marker — never colour alone (WCAG 1.4.1) */
	.qti-hotspot-overlay :global(:is(.qti-hotspot-region, .qti-hotspot-backdrop)[data-selected] .qti-hotspot-outline) {
		stroke: var(--qti-hotspot-selected);
		stroke-width: 4px;
		fill: color-mix(in srgb, var(--qti-hotspot-selected) 25%, transparent);
	}
	.qti-hotspot-overlay :global(:is(.qti-hotspot-region, .qti-hotspot-backdrop)[data-selected] .qti-hotspot-halo) {
		stroke-width: 8px;
	}
	/* Correct answer (scorer view): dashed outline and a check marker */
	.qti-hotspot-overlay :global(:is(.qti-hotspot-region, .qti-hotspot-backdrop)[data-correct]:not([data-selected]) .qti-hotspot-outline) {
		stroke: var(--qti-hotspot-correct);
		stroke-width: 3px;
		stroke-dasharray: 6px 3px;
	}
	.qti-hotspot-overlay :global(.qti-hotspot-marker circle) {
		fill: var(--qti-hotspot-selected);
		stroke: #fff;
		stroke-width: 2px;
	}
	.qti-hotspot-overlay :global(:is(.qti-hotspot-region, .qti-hotspot-backdrop)[data-correct]:not([data-selected]) .qti-hotspot-marker circle) {
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
	/* A default-shape region's pointer target, beneath every other region (its control takes
	   no pointer input): invisible, but painted so the image around the other regions takes
	   the pointer. */
	.qti-hotspot-overlay :global(.qti-hotspot-pointer-target) {
		fill: rgba(0, 0, 0, 0);
		stroke: none;
		cursor: pointer;
	}
	.qti-hotspot-overlay[data-disabled] :global(:is(.qti-hotspot-shape, .qti-hotspot-pointer-target)) {
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
	/* A default-shape region's halo is in its backdrop, beneath the other regions */
	.qti-hotspot-overlay:has(:global(.qti-hotspot-shape-default:focus-visible)) :global(.qti-hotspot-backdrop .qti-hotspot-halo) {
		stroke-width: 9px;
	}

	/* qti-unselected-hidden: unselected regions show only while focused; they stay operable */
	.qti-unselected-hidden .qti-hotspot-overlay :global(.qti-hotspot-region:not([data-selected]):not(:focus-within) :is(.qti-hotspot-halo, .qti-hotspot-outline)),
	.qti-unselected-hidden .qti-hotspot-overlay :global(.qti-hotspot-backdrop:not([data-selected]) :is(.qti-hotspot-halo, .qti-hotspot-outline)) {
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
	.qti-hotspot-sr-only,
	.qti-hotspot-live-region {
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
