<svelte:options customElement="pie-qti-graphic-gap-match" />

<script lang="ts">
/**
 * Graphic Gap Match component for graphicGapMatchInteractionData
 * Drag labels onto specific areas of an image/diagram
 * Supports keyboard (two-phase pick-up/drop), mouse, and touch interactions
 */

import type { GraphicGapMatchInteractionData } from '@pie-qti/item-player';
	import { tick } from 'svelte';
	import { touchDrag } from '@pie-qti/qti-common';
import HotspotShape from '../../shared/components/HotspotShape.svelte';
import { emitInteractionChange } from '../../shared/utils/eventHelpers.js';
	import { normalizeCssPixelLength, normalizePixelDimension } from '@pie-qti/item-player/security';
	import { formatList, joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { isCompatibleMatchGroup } from '../../shared/utils/matchGroupUtils';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { choicesShortOfMatchMin } from '../../shared/utils/minimumRequirement';
import { hitStrokeWidth, imageAltText, observeWidth, shapeCenter } from '../hotspot/graphicRegions';

import '../../shared/styles/shared.css';
import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';

interface Props {
	interaction?: GraphicGapMatchInteractionData | string;
	response?: string | string[] | null;
	correctResponse?: string[] | null;
	disabled?: boolean;
	role?: string;
	i18n?: I18nProvider;
	onChange?: (value: string[]) => void;
}

let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

const uid = $props.id();

// Parse props that may be JSON strings (web component usage). Correct-answer mode is the
// scorer's view of an item that has a correct response (the shared shell's rule).
const shell = $derived(
		createInteractionShell<GraphicGapMatchInteractionData, string | string[], string[]>({
			interaction,
			response,
			correctResponse,
			role,
			listResponse: true,
		}),
);
const parsedInteraction = $derived(shell.interaction);
const parsedResponse = $derived(shell.response);
const parsedCorrectResponse = $derived(shell.correctResponse);
const isShowingCorrect = $derived(shell.isShowingCorrect);
const correctPairs = $derived(Array.isArray(parsedCorrectResponse) ? parsedCorrectResponse : []);
const choicesContainerWidth = $derived(
	normalizeCssPixelLength(parsedInteraction?.choicesContainerWidth),
);

const imageData = $derived(parsedInteraction?.imageData ?? null);
const imageSrc = $derived(imageData?.type === 'image' ? (imageData.src ?? '') : '');

// Raster images report their natural size once loaded; hotspot coords are in
// that pixel space when the item declares no width/height.
let loadedImage = $state<{ src: string; width: number; height: number } | null>(null);
let failedSrc = $state<string | null>(null);
const naturalSize = $derived(loadedImage && loadedImage.src === imageSrc ? loadedImage : null);
const imageFailed = $derived(!!imageSrc && failedSrc === imageSrc);

const authoredWidth = $derived(normalizePixelDimension(imageData?.width));
const authoredHeight = $derived(normalizePixelDimension(imageData?.height));
const hasAuthoredDimensions = $derived(!!authoredWidth && !!authoredHeight);
const imageWidth = $derived(hasAuthoredDimensions ? Number(authoredWidth) : (naturalSize?.width ?? null));
const imageHeight = $derived(hasAuthoredDimensions ? Number(authoredHeight) : (naturalSize?.height ?? null));
const hasImageDimensions = $derived(imageWidth !== null && imageHeight !== null);
const awaitingNaturalSize = $derived(!!imageSrc && !hasAuthoredDimensions && !naturalSize && !imageFailed);
const missingDimensions = $derived(!!parsedInteraction && !!imageData && !hasImageDimensions && !awaitingNaturalSize);

// Reflow (WCAG 1.4.10): the stage scales with its container up to the image's natural size.
const frameStyle = $derived(imageWidth ? `max-width: calc(${imageWidth}px + 4px);` : '');
const canvasStyle = $derived(imageWidth && imageHeight ? `aspect-ratio: ${imageWidth} / ${imageHeight};` : '');

let warnedMissingDimensions = false;
$effect(() => {
	if (missingDimensions && !warnedMissingDimensions) {
		warnedMissingDimensions = true;
		console.warn(
			'[pie-qti-graphic-gap-match] The image has no known width/height, so its hotspots cannot be placed. Add width and height to the image, or supply the asset dimensions.',
		);
	}
});

// Rendered width of the image, to size hit targets and hotspot labels in CSS px.
let renderedWidth = $state(0);
const renderScale = $derived(imageWidth && renderedWidth > 0 ? renderedWidth / imageWidth : 1);

const imageAlt = $derived(
	imageAltText(imageData, translate(i18n, 'interactions.graphicGapMatch.imageFallback', 'Image for this question')),
);
const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
const imageDescriptionId = $derived(`${uid}-image-description`);
const instructionsId = $derived(`${uid}-instructions`);

function handleImageLoad(event: Event) {
	const img = event.currentTarget as HTMLImageElement;
	if (img.naturalWidth > 0 && img.naturalHeight > 0) {
		loadedImage = { src: imageSrc, width: img.naturalWidth, height: img.naturalHeight };
	}
}

function handleImageError() {
	failedSrc = imageSrc;
	console.warn(`[pie-qti-graphic-gap-match] The image failed to load: ${imageSrc}`);
}

let pairs = $state<string[]>([]);
let draggedTextId = $state<string | null>(null);
let hoveredHotspotId = $state<string | null>(null);
/** Identifier of the label currently "held" via keyboard (two-phase pick-up/drop). */
let pickedUpLabel = $state<string | null>(null);
/** Text announced to screen readers via the aria-live region. */
let liveMessage = $state<string>('');

// Get reference to the root element for event dispatching (needed for Shadow DOM)
let rootElement: HTMLDivElement | undefined = $state();

// Track if we're updating from internal change (user drag) vs external (prop update)
let isInternalUpdate = false;

/** A palette label (gap text or gap image) by identifier. */
function findLabel(labelId: string): { identifier: string; matchGroup?: string[] } | undefined {
	if (!parsedInteraction) return undefined;
	return (
		parsedInteraction.gapTexts.find((g) => g.identifier === labelId) ??
		(parsedInteraction.gapImages ?? []).find((g) => g.identifier === labelId)
	);
}

/**
 * Whether `matchGroup` lets a label go on a hotspot: the label's `matchGroup` names the
 * hotspots it may be matched with and the hotspot's names the labels it accepts, read by
 * the same rule response validation applies, so the UI and validation agree.
 */
function canPlaceLabel(labelId: string, hotspotId: string): boolean {
	const label = findLabel(labelId);
	const hotspot = parsedInteraction?.hotspots.find((h) => h.identifier === hotspotId);
	return !!label && !!hotspot && isCompatibleMatchGroup(label, hotspot);
}

/**
 * Whether `pairs` would hold more associations than the interaction's `maxAssociations`
 * allows (QTI: 0 means no restriction). The per-label and per-hotspot `matchMax` need no
 * separate check here: the placement model holds one pair per label and one pair per
 * hotspot, so a placement never raises either side's count above 1.
 */
function exceedsMaxAssociations(candidatePairs: string[]): boolean {
	const max = Number(parsedInteraction?.maxAssociations ?? 0);
	return max > 0 && candidatePairs.length > max;
}

/** Announce a refused placement: the author's data-max-selections-message wins. */
function announceAssociationLimit() {
	liveMessage =
		parsedInteraction?.maxSelectionsMessage?.trim() ||
		translate(
			i18n,
			'interactions.graphicGapMatch.associationLimitReached',
			'Association not possible: the limit of {max} is reached.',
			{ max: Number(parsedInteraction?.maxAssociations ?? 0) },
		);
}

// Hotspots the label being placed may not go on, due to matchGroup: the dragged label during a
// drag (what a drop would place), else the held one.
const blockedHotspotIds = $derived.by(() => {
	const labelId = draggedTextId ?? pickedUpLabel;
	if (!labelId || !parsedInteraction) return new Set<string>();
	return new Set(
		parsedInteraction.hotspots.filter((h) => !canPlaceLabel(labelId, h.identifier)).map((h) => h.identifier),
	);
});

$effect(() => {
	// Sync with parent response changes (only if not an internal update)
	if (!isInternalUpdate) {
		const newPairs = Array.isArray(parsedResponse) ? [...parsedResponse] : [];
		pairs = newPairs;
	}
	isInternalUpdate = false; // Reset flag
});

// Get the hotspot matched to a gap text
function getMatchedHotspot(gapTextId: string): string | null {
	const pair = pairs.find((p) => p.startsWith(`${gapTextId} `));
	return pair ? pair.split(' ')[1] : null;
}

/**
 * Minimum requirement (each label's matchMin): the labels the response does not place
 * often enough yet — the same minimum response validation enforces — are named on the
 * question; the author's `data-min-selections-message` wins.
 */
const minHintId = `${uid}-min-hint`;
const shortLabels = $derived(
	parsedInteraction
		? choicesShortOfMatchMin([...parsedInteraction.gapTexts, ...(parsedInteraction.gapImages ?? [])], pairs)
		: [],
);
const minHint = $derived.by(() => {
	if (disabled || role !== 'candidate' || shortLabels.length === 0) return '';
	return (
		parsedInteraction?.minSelectionsMessage?.trim() ||
		translate(i18n, 'interactions.graphicGapMatch.minPlacementsHint', 'Still to place on the hotspots: {labels}.', {
			labels: formatList(i18n, shortLabels.map((label) => getLabelName(label.identifier))),
		})
	);
});

// Get the gap text matched to a hotspot
function getMatchedGapText(hotspotId: string): string | null {
	const pair = pairs.find((p) => p.endsWith(` ${hotspotId}`));
	return pair ? pair.split(' ')[0] : null;
}

// Get the correct gap text for a hotspot
function getCorrectGapText(hotspotId: string): string | null {
	const pair = correctPairs.find((p) => p.endsWith(` ${hotspotId}`));
	return pair ? pair.split(' ')[0] : null;
}

// Check if a hotspot has a correct answer
function isCorrectHotspot(hotspotId: string): boolean {
	return isShowingCorrect && getCorrectGapText(hotspotId) !== null;
}

function handleDragStart(gapTextId: string) {
	if (disabled) return;
	draggedTextId = gapTextId;
}

function handleDragEnd() {
	draggedTextId = null;
	hoveredHotspotId = null;
}

function handleHotspotDragOver(event: DragEvent, hotspotId: string) {
	if (disabled || !draggedTextId) return;
	// Not a drop target for this label (matchGroup): leave the default "no drop" feedback.
	if (blockedHotspotIds.has(hotspotId)) return;
	event.preventDefault();
	hoveredHotspotId = hotspotId;
}

function handleHotspotDragLeave() {
	hoveredHotspotId = null;
}

function handleHotspotDrop(event: DragEvent, hotspotId: string) {
	if (disabled || !draggedTextId || !parsedInteraction) return;
	event.preventDefault();

	// matchGroup: refuse a placement the hotspot does not accept.
	if (!canPlaceLabel(draggedTextId, hotspotId)) {
		draggedTextId = null;
		hoveredHotspotId = null;
		return;
	}

	// Remove any existing pair for this gapText
	let newPairs = pairs.filter((p) => !p.startsWith(`${draggedTextId} `));

	// Remove any existing pair for this hotspot
	newPairs = newPairs.filter((p) => !p.endsWith(` ${hotspotId}`));

	// Add new pair
	newPairs.push(`${draggedTextId} ${hotspotId}`);

	// maxAssociations: refuse a placement that would exceed the interaction's cap — the
	// same maxima response validation enforces, announced here so an over-limit response
	// never reaches the submit that would reject it.
	if (exceedsMaxAssociations(newPairs)) {
		announceAssociationLimit();
		draggedTextId = null;
		hoveredHotspotId = null;
		return;
	}

	isInternalUpdate = true; // Mark as internal update to prevent sync effect from overwriting
	pairs = newPairs;
	response = pairs;
	// Call onChange callback if provided (for Svelte component usage)
	emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: pairs, onChange });

	draggedTextId = null;
	hoveredHotspotId = null;
}

	async function clearMatch(labelId: string, event?: MouseEvent) {
		if (disabled || !parsedInteraction) return;
		const labelName = getLabelName(labelId);
		// The remove button shares its wrapper with the label button it clears; the
		// wrapper (and that label button) survive the removal.
		const wrapper = (event?.currentTarget as HTMLElement | null)?.parentElement ?? null;

		const newPairs = pairs.filter((p) => !p.startsWith(`${labelId} `));
		isInternalUpdate = true; // Mark as internal update
		pairs = newPairs;
		response = pairs;
		// Call onChange callback if provided (for Svelte component usage)
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: pairs, onChange });

		liveMessage = translate(i18n, 'interactions.graphicGapMatch.labelRemoved', '{label} removed from hotspot.', { label: labelName });

		// The remove button is gone, which would drop keyboard focus to the document.
		// Focus returns to the now-enabled label button beside it.
		await tick();
		wrapper?.querySelector<HTMLButtonElement>('button')?.focus();
	}

/**
 * Resolve a human-readable name for a label by identifier: a gap text's text,
 * a gap image's alternative text, else a localized generic name — never the
 * identifier, which can reveal the answer key.
 */
function getLabelName(labelId: string): string {
	if (!parsedInteraction) return labelFallback();
	const text = parsedInteraction.gapTexts.find((g) => g.identifier === labelId);
	if (text) return text.text;
	const img = (parsedInteraction.gapImages ?? []).find((g) => g.identifier === labelId);
	if (img) return img.alt?.trim() || labelFallback();
	return labelFallback();
}

function labelFallback(): string {
	return translate(i18n, 'interactions.graphicGapMatch.labelFallback', 'Label');
}

function cancelledMessage(): string {
	return translate(i18n, 'common.selectionCancelled', 'Selection cancelled');
}

/**
 * Accessible description of a palette label: whether it is already placed, then what a key
 * press does. The label's name stays its own name and aria-pressed carries the picked-up
 * state, so neither changes the name nor is said twice (WCAG 4.1.2).
 */
function paletteLabelHint(placed: boolean, held: boolean): string {
	return joinSentences(
		placed && translate(i18n, 'interactions.graphicGapMatch.alreadyPlacedSentence', 'Already placed on a hotspot.'),
		held
			? translate(i18n, 'interactions.graphicGapMatch.heldHint', 'Tab to a hotspot and press Enter to place it.')
			: translate(i18n, 'interactions.graphicGapMatch.pickUpHint', 'Press Space or Enter to pick up.'),
	);
}

/**
 * Id of a palette label's hidden description, unique per interaction instance. Built from the
 * label's kind and position, never its identifier, which must not reach the DOM.
 */
function paletteHintId(kind: 'text' | 'image', index: number): string {
	return `${uid}-${kind}-label-hint-${index}`;
}

/**
 * Accessible name of a hotspot: its number and contents, then the drop hint while a label
 * is held, or that matchGroup keeps the held label off it.
 */
function hotspotAriaLabel(
	number: number,
	contains: string | undefined,
	correct: string | undefined,
	heldLabel: string | null,
	blocked: boolean,
): string {
	const state = contains
		? translate(i18n, 'interactions.graphicGapMatch.hotspotContains', 'Hotspot {number}. Contains {label}.', { number, label: contains })
		: correct
			? translate(i18n, 'interactions.graphicGapMatch.hotspotCorrectAnswer', 'Hotspot {number}. Correct answer: {label}.', { number, label: correct })
			: translate(i18n, 'interactions.graphicGapMatch.hotspotEmpty', 'Hotspot {number}. Empty.', { number });
	return joinSentences(
		state,
		blocked
			? translate(i18n, 'interactions.graphicGapMatch.unavailableSentence', 'Not available due to a match group restriction.')
			: heldLabel && translate(i18n, 'interactions.graphicGapMatch.placeHereHint', 'Press Enter to place {label} here.', { label: heldLabel }),
	);
}

// Phase-1 handler: pick up or put down a label from the palette.
function handleLabelActivate(labelId: string) {
	if (disabled || getMatchedHotspot(labelId)) return;

	if (pickedUpLabel === labelId) {
		// Second press on the same label cancels the pick-up
		pickedUpLabel = null;
		liveMessage = cancelledMessage();
	} else {
		pickedUpLabel = labelId;
		const name = getLabelName(labelId);
		liveMessage = translate(i18n, 'interactions.graphicGapMatch.pickedUp', 'Picked up: {label}. Tab to a hotspot and press Enter to place it.', { label: name });
	}
}

function handleLabelKeyDown(event: KeyboardEvent, labelId: string) {
	if (disabled) return;

	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();
		handleLabelActivate(labelId);
	} else if (event.key === 'Escape' && pickedUpLabel) {
		event.preventDefault();
		pickedUpLabel = null;
		liveMessage = cancelledMessage();
	}
}

// Phase-2 handler: drop the held label onto a hotspot.
function placePickedUpLabelOnHotspot(hotspotId: string) {
	if (disabled || !pickedUpLabel || !parsedInteraction) return;

	// matchGroup: this hotspot does not accept the held label; it stays held.
	if (!canPlaceLabel(pickedUpLabel, hotspotId)) {
		liveMessage = translate(i18n, 'interactions.graphicGapMatch.unavailableSentence', 'Not available due to a match group restriction.');
		return;
	}

	const hotspotIndex = parsedInteraction.hotspots.findIndex((h) => h.identifier === hotspotId);
	const labelName = getLabelName(pickedUpLabel);

	// Create match
	let newPairs = pairs.filter((p) => !p.startsWith(`${pickedUpLabel} `));
	newPairs = newPairs.filter((p) => !p.endsWith(` ${hotspotId}`));
	newPairs.push(`${pickedUpLabel} ${hotspotId}`);

	// maxAssociations: refuse a placement that would exceed the interaction's cap; the
	// label stays held so the candidate can place it elsewhere or cancel.
	if (exceedsMaxAssociations(newPairs)) {
		announceAssociationLimit();
		return;
	}

	isInternalUpdate = true; // Mark as internal update
	pairs = newPairs;
	response = pairs;
	// Call onChange callback if provided (for Svelte component usage)
	emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: pairs, onChange });

	liveMessage = translate(i18n, 'interactions.graphicGapMatch.labelPlaced', '{label} placed on hotspot {hotspot}', { label: labelName, hotspot: hotspotIndex + 1 });
	pickedUpLabel = null;
}

function handleHotspotKeyDown(event: KeyboardEvent, hotspotId: string) {
	if (disabled || !parsedInteraction) return;

	if (event.key === ' ' || event.key === 'Enter') {
		if (pickedUpLabel) {
			event.preventDefault();
			placePickedUpLabelOnHotspot(hotspotId);
		}
	}
}

// Global Escape on root element cancels any active pick-up
function handleRootKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && pickedUpLabel) {
		event.preventDefault();
		pickedUpLabel = null;
		liveMessage = cancelledMessage();
	}
}

</script>

<ShadowBaseStyles />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={rootElement} {...interactionAria(parsedInteraction)} class={['qti-graphic-gap-match-interaction', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')} onkeydown={handleRootKeyDown}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-ggm-prompt qti-rich-content font-semibold mb-3">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<!-- Visually-hidden live region for screen reader announcements -->
		<div aria-live="polite" aria-atomic="true" class="sr-only">
			{liveMessage}
		</div>

		<p>{i18n?.t('interactions.graphicGapMatch.pointerInstructions') ?? 'Select a label, then select a hotspot on the image. You can also drag and drop.'}</p>

		<!-- Instructions for keyboard users -->
		<div id={instructionsId} class="sr-only">
			{translate(
				i18n,
				'interactions.graphicGapMatch.pickUpInstructions',
				'Press Space or Enter to pick up a label. Tab to a hotspot on the image and press Enter to place it. Press Escape to cancel.',
			)}
		</div>

		{#if missingDimensions && role !== 'candidate'}
			<div part="diagnostic" class="alert alert-error" role="alert">
				{translate(
					i18n,
					'interactions.graphicGapMatch.unknownImageDimensions',
					'The hotspots cannot be shown: the size of the image is unknown. Add width and height to the image.',
				)}
			</div>
		{/if}

		<div
			part="region"
			class="qti-ggm-region space-y-4"
			role="region"
			aria-describedby={instructionsId}
		>
			<!-- Draggable gap texts (labels) - Hide when showing correct answers -->
			{#if !isShowingCorrect}
				<div
					part="labels"
					class="qti-ggm-labels flex flex-wrap gap-2 p-4 bg-base-200 rounded-lg border-2 border-base-300"
					style={choicesContainerWidth ? `width: ${choicesContainerWidth}` : undefined}
					role="group"
					aria-label={i18n?.t('interactions.graphicGapMatch.availableLabel') ?? 'Available labels to place'}
					aria-describedby={minHint ? minHintId : undefined}
				>
					<div class="qti-ggm-labels-title w-full text-sm text-base-content/70 font-semibold mb-2">
						{i18n?.t('interactions.graphicGapMatch.availableHeading') ?? 'Available Labels:'}
					</div>
					{#each parsedInteraction.gapTexts as gapText, textIndex (gapText.identifier)}
						{@const matchedHotspot = getMatchedHotspot(gapText.identifier)}
						{@const isDragged = draggedTextId === gapText.identifier}
						{@const isHeld = pickedUpLabel === gapText.identifier}

						<div class="inline-flex items-center gap-1">
							<button
								type="button"
								draggable={!disabled && !matchedHotspot}
								use:touchDrag
								ondragstart={() => handleDragStart(gapText.identifier)}
								ondragend={handleDragEnd}
								onclick={() => handleLabelActivate(gapText.identifier)}
								onkeydown={(e) => handleLabelKeyDown(e, gapText.identifier)}
								disabled={disabled || !!matchedHotspot}
								aria-pressed={isHeld}
								aria-label={gapText.text}
								aria-describedby={paletteHintId('text', textIndex)}
								class="btn btn-md font-medium transition-all"
								class:btn-primary={!matchedHotspot && !isHeld}
								class:qti-ggm-label-held={isHeld}
								class:btn-success={matchedHotspot}
								class:cursor-grab={!disabled && !matchedHotspot && !isHeld}
								class:cursor-not-allowed={disabled}
								class:opacity-70={disabled || isDragged}
								class:contrast-125={matchedHotspot}
								class:saturate-150={matchedHotspot}
							>
								{gapText.text}
							</button>
							<span id={paletteHintId('text', textIndex)} hidden>{paletteLabelHint(!!matchedHotspot, isHeld)}</span>
							{#if matchedHotspot && !disabled}
								<button
									type="button"
									part="label-remove"
									class="btn btn-sm btn-circle btn-error"
									onclick={(e) => clearMatch(gapText.identifier, e)}
									aria-label={translate(i18n, 'interactions.graphicGapMatch.removeFromHotspot', 'Remove {label} from hotspot', { label: gapText.text })}
									title={i18n?.t('interactions.graphicGapMatch.removeLabel') ?? 'Remove label'}
								>
									✕
								</button>
							{/if}
						</div>
					{/each}

					{#each (parsedInteraction.gapImages ?? []) as gapImage, imageIndex (gapImage.identifier)}
						{@const matchedHotspot = getMatchedHotspot(gapImage.identifier)}
						{@const isDragged = draggedTextId === gapImage.identifier}
						{@const isHeld = pickedUpLabel === gapImage.identifier}
						{@const gapImageName = getLabelName(gapImage.identifier)}

						<div class="inline-flex items-center gap-1">
							<button
								type="button"
								draggable={!disabled && !matchedHotspot}
								use:touchDrag
								ondragstart={() => handleDragStart(gapImage.identifier)}
								ondragend={handleDragEnd}
								onclick={() => handleLabelActivate(gapImage.identifier)}
								onkeydown={(e) => handleLabelKeyDown(e, gapImage.identifier)}
								disabled={disabled || !!matchedHotspot}
								aria-pressed={isHeld}
								aria-label={gapImageName}
								aria-describedby={paletteHintId('image', imageIndex)}
								class="btn btn-md p-1 transition-all"
								class:btn-primary={!matchedHotspot && !isHeld}
								class:qti-ggm-label-held={isHeld}
								class:btn-success={matchedHotspot}
								class:cursor-grab={!disabled && !matchedHotspot && !isHeld}
								class:cursor-not-allowed={disabled}
								class:opacity-70={disabled || isDragged}
							>
								<img
									src={gapImage.src}
									alt={gapImageName}
									style={gapImage.width ? `width: ${gapImage.width}px; max-width: 100%;` : ''}
								/>
							</button>
							<span id={paletteHintId('image', imageIndex)} hidden>{paletteLabelHint(!!matchedHotspot, isHeld)}</span>
							{#if matchedHotspot && !disabled}
								<button
									type="button"
									part="label-remove"
									class="btn btn-sm btn-circle btn-error"
									onclick={(e) => clearMatch(gapImage.identifier, e)}
									aria-label={translate(i18n, 'interactions.graphicGapMatch.removeFromHotspot', 'Remove {label} from hotspot', {
										label: gapImageName,
									})}
									title={i18n?.t('interactions.graphicGapMatch.removeLabel') ?? 'Remove label'}
								>
									✕
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Image/diagram with hotspot drop zones -->
			<div part="stage" class="qti-ggm-stage" style={frameStyle}>
				<div class="qti-ggm-canvas" style={canvasStyle} use:observeWidth={(width) => (renderedWidth = width)}>
					<!-- SVG image or raster image, with the author's text alternative -->
					{#if imageData?.type === 'svg' && imageData.content}
						<div
							part="image"
							class="qti-ggm-image"
							role={imageData.decorative ? undefined : 'img'}
							aria-hidden={imageData.decorative ? 'true' : undefined}
							aria-label={imageData.decorative ? undefined : imageAlt}
							aria-describedby={imageDescription ? imageDescriptionId : undefined}
						>
							{@html imageData.content}
						</div>
					{:else if imageData && imageFailed}
						<div part="image-error" class="qti-ggm-image qti-ggm-image-error">
							<p>{translate(i18n, 'interactions.graphicGapMatch.imageLoadError', 'The image could not be loaded.')}</p>
							{#if imageData.alt && !imageData.decorative}
								<p>{imageData.alt}</p>
							{/if}
						</div>
					{:else if imageData?.src}
						<img
							part="image"
							class="qti-ggm-image"
							src={imageData.src}
							alt={imageAlt}
							aria-describedby={imageDescription ? imageDescriptionId : undefined}
							onload={handleImageLoad}
							onerror={handleImageError}
						/>
					{/if}

					<!-- Overlay with hotspot drop zones, in the image's natural pixel space.
					     Only drawn when that space is known: any guess misplaces every hotspot. -->
					{#if hasImageDimensions}
					<svg
						part="overlay"
						class="qti-ggm-overlay"
						viewBox="0 0 {imageWidth} {imageHeight}"
						data-disabled={disabled ? '' : undefined}
					>
						{#each parsedInteraction.hotspots as hotspot, hotspotIndex (hotspot.identifier)}
							{@const matchedGapText = getMatchedGapText(hotspot.identifier)}
							{@const matchedLabelName = matchedGapText ? getLabelName(matchedGapText) : undefined}
							{@const isHovered = hoveredHotspotId === hotspot.identifier}
							{@const correctGapText = getCorrectGapText(hotspot.identifier)}
							{@const correctLabelName = correctGapText ? getLabelName(correctGapText) : undefined}
							{@const isCorrect = isCorrectHotspot(hotspot.identifier)}
							{@const isBlocked = blockedHotspotIds.has(hotspot.identifier)}
							{@const hotspotReady = !!pickedUpLabel && !disabled && !isBlocked}
							{@const pickedUpLabelName = pickedUpLabel ? getLabelName(pickedUpLabel) : ''}
							{@const center = shapeCenter(hotspot.shape, hotspot.coords)}

							<!-- One drop zone: light halo + state outline (visible on any image), the
							     placed label's text (not colour alone), then the interactive target on
							     top, grown to 24×24 CSS px when small. -->
							<g
								class="qti-ggm-zone"
								data-filled={matchedGapText ? '' : undefined}
								data-correct={!matchedGapText && isCorrect ? '' : undefined}
								data-ready={hotspotReady ? '' : undefined}
								data-hovered={isHovered ? '' : undefined}
								data-blocked={isBlocked ? '' : undefined}
							>
								<HotspotShape shape={hotspot.shape} coords={hotspot.coords} interactive={false} presentation={{ class: 'qti-ggm-halo' }} />
								<HotspotShape shape={hotspot.shape} coords={hotspot.coords} interactive={false} presentation={{ class: 'qti-ggm-outline' }} />

								{#if matchedLabelName || (isCorrect && correctLabelName)}
									<text
										x={center.x}
										y={center.y}
										text-anchor="middle"
										dominant-baseline="middle"
										class="qti-ggm-zone-text"
										style="font-size: {14 / renderScale}px;"
										aria-hidden="true"
									>
										{matchedLabelName ?? correctLabelName}
									</text>
								{/if}

								<HotspotShape
									shape={hotspot.shape}
									coords={hotspot.coords}
									label={hotspotAriaLabel(
										hotspotIndex + 1,
										matchedLabelName,
										// Only the correct-answer view names the key; outside it the name must not.
										isCorrect ? correctLabelName : undefined,
										hotspotReady ? pickedUpLabelName : null,
										isBlocked,
									)}
									{disabled}
									presentation={{
										class: `qti-ggm-hotspot${hotspotReady ? ' qti-ggm-hotspot-ready' : ''}`,
										'data-filled': matchedGapText ? '' : undefined,
										'aria-disabled': isBlocked ? 'true' : undefined,
										style: `--qti-hit-stroke: ${hitStrokeWidth(hotspot.shape, hotspot.coords, renderScale)}px; cursor: ${disabled || isBlocked ? 'not-allowed' : hotspotReady ? 'copy' : 'pointer'};`,
									}}
									ondragover={(e) => handleHotspotDragOver(e, hotspot.identifier)}
									ondragleave={handleHotspotDragLeave}
									ondrop={(e) => handleHotspotDrop(e, hotspot.identifier)}
									onclick={() => placePickedUpLabelOnHotspot(hotspot.identifier)}
									onkeydown={(e) => handleHotspotKeyDown(e, hotspot.identifier)}
								/>
							</g>
						{/each}
					</svg>
					{/if}
				</div>
			</div>
			{#if imageDescription}
				<p id={imageDescriptionId} class="sr-only">{imageDescription}</p>
			{/if}
		</div>
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(pairs)} />
	{/if}
</div>

<style>
	[draggable='true'] {
		touch-action: none;
	}

	/* Minimal layout so this works without Tailwind utilities */
	.qti-graphic-gap-match-interaction {
		display: grid;
		gap: 0.75rem;
		--qti-ggm-halo: #fff;
		--qti-ggm-outline: var(--pie-qti-border-strong, #767676);
		--qti-ggm-filled: var(--pie-qti-success-text, #15803d);
		--qti-ggm-ready: var(--pie-qti-info-text, #1d4ed8);
	}
	.qti-ggm-prompt {
		margin: 0 0 0.75rem;
	}
	/* qti-choices-top|bottom|left|right: the labels' side of the image; top by default */
	.qti-ggm-region {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
	}
	.qti-graphic-gap-match-interaction.qti-choices-bottom .qti-ggm-region { flex-direction: column-reverse; }
	.qti-graphic-gap-match-interaction.qti-choices-left .qti-ggm-region { flex-direction: row; }
	.qti-graphic-gap-match-interaction.qti-choices-right .qti-ggm-region { flex-direction: row-reverse; }
	.qti-graphic-gap-match-interaction:is(.qti-choices-top, .qti-choices-bottom, :not([class*='qti-choices-'])) .qti-ggm-labels {
		align-self: stretch;
	}
	.qti-graphic-gap-match-interaction:is(.qti-choices-left, .qti-choices-right) .qti-ggm-labels {
		flex: 0 0 auto;
		max-width: 40%;
		align-content: flex-start;
	}

	/* qti-selections-light / qti-selections-dark: outline pairs for dark or light images */
	.qti-graphic-gap-match-interaction.qti-selections-light {
		--qti-ggm-halo: #000;
		--qti-ggm-outline: #fff;
	}
	.qti-graphic-gap-match-interaction.qti-selections-dark {
		--qti-ggm-halo: #fff;
		--qti-ggm-outline: #000;
	}

	.qti-ggm-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}
	.qti-ggm-labels-title {
		width: 100%;
		margin: 0 0 0.5rem;
		font-weight: 600;
	}
	/* The stage frame fills the available width up to the image's natural size (WCAG 1.4.10) */
	.qti-ggm-stage {
		position: relative;
		width: 100%;
		box-sizing: border-box;
		border-radius: 0.75rem;
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
	}
	/* Borderless canvas at the image's aspect ratio: overlay viewBox and image align at any scale */
	.qti-ggm-canvas {
		position: relative;
		width: 100%;
	}
	.qti-ggm-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.qti-ggm-image :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.qti-ggm-image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: 6rem;
		padding: 1rem;
		box-sizing: border-box;
		text-align: center;
		color: var(--pie-qti-error-text, #b91c1c);
	}
	.qti-ggm-image-error p {
		margin: 0;
	}
	.qti-ggm-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
		/* halos, focus rings and grown hit areas may extend past the image edge */
		overflow: visible;
	}

	.qti-ggm-overlay :global(.qti-ggm-halo),
	.qti-ggm-overlay :global(.qti-ggm-outline),
	.qti-ggm-overlay :global(.qti-ggm-zone-text) {
		pointer-events: none;
	}
	.qti-ggm-overlay :global(.qti-ggm-halo) {
		fill: none;
		stroke: var(--qti-ggm-halo);
		stroke-width: 5px;
		vector-effect: non-scaling-stroke;
	}
	.qti-ggm-overlay :global(.qti-ggm-outline) {
		fill: transparent;
		stroke: var(--qti-ggm-outline);
		stroke-width: 2px;
		stroke-dasharray: 4px 4px;
		vector-effect: non-scaling-stroke;
	}
	/* Ready to receive a held label: thicker, dashed, pulsing outline */
	.qti-ggm-overlay :global(.qti-ggm-zone[data-ready] .qti-ggm-outline),
	.qti-ggm-overlay :global(.qti-ggm-zone[data-hovered] .qti-ggm-outline) {
		stroke: var(--qti-ggm-ready);
		stroke-width: 3px;
		stroke-dasharray: 6px 3px;
		fill: color-mix(in srgb, var(--qti-ggm-ready) 15%, transparent);
	}
	/* Filled: solid outline and the placed label's text on the zone (not colour alone) */
	.qti-ggm-overlay :global(.qti-ggm-zone[data-filled] .qti-ggm-outline) {
		stroke: var(--qti-ggm-filled);
		stroke-width: 3px;
		stroke-dasharray: none;
		fill: color-mix(in srgb, var(--qti-ggm-filled) 20%, transparent);
	}
	.qti-ggm-overlay :global(.qti-ggm-zone[data-correct] .qti-ggm-outline) {
		stroke: var(--qti-ggm-filled);
		stroke-width: 3px;
		stroke-dasharray: 8px 3px;
	}
	/* matchGroup keeps the label being placed off this zone: dimmed, like other blocked targets */
	.qti-ggm-overlay :global(.qti-ggm-zone[data-blocked] :is(.qti-ggm-halo, .qti-ggm-outline)) {
		stroke-opacity: 0.4;
		fill-opacity: 0.4;
	}
	.qti-ggm-overlay :global(.qti-ggm-zone-text) {
		font-weight: 700;
		fill: var(--pie-qti-success-text, #15803d);
		paint-order: stroke;
		stroke: #fff;
		stroke-width: 3px;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	/*
	 * The interactive drop zone: invisible but painted (its interior takes the
	 * pointer and drops), with a transparent non-scaling stroke that grows small
	 * zones to 24×24 CSS px (WCAG 2.5.8) without changing the authored geometry.
	 */
	.qti-ggm-overlay :global(.qti-ggm-hotspot) {
		fill: rgba(0, 0, 0, 0);
		stroke: rgba(0, 0, 0, 0);
		stroke-width: var(--qti-hit-stroke, 0px);
		vector-effect: non-scaling-stroke;
		pointer-events: auto;
		outline: none;
	}
	/* Focus indicator drawn on the zone outline (WCAG 2.4.7), haloed for any background */
	.qti-ggm-overlay :global(.qti-ggm-hotspot:focus-visible) {
		stroke: var(--pie-qti-focus, #4338ca);
		stroke-width: 3px;
	}
	.qti-ggm-overlay :global(.qti-ggm-zone:focus-within .qti-ggm-halo) {
		stroke-width: 9px;
	}

	/* qti-unselected-hidden: empty drop zones show only while focused; they stay operable */
	.qti-graphic-gap-match-interaction.qti-unselected-hidden :global(.qti-ggm-zone:not([data-filled]):not(:focus-within) :is(.qti-ggm-halo, .qti-ggm-outline)) {
		fill-opacity: 0;
		stroke-opacity: 0;
		animation: none;
	}

	/* Label button in "held" (picked-up) state */
	:global(.qti-ggm-label-held) {
		outline: 3px solid var(--pie-qti-accent, oklch(65% 0.2 320));
		outline-offset: 2px;
		background-color: var(--pie-qti-accent, oklch(65% 0.2 320)) !important;
		color: var(--pie-qti-accent-content, #fff) !important;
		box-shadow: 0 0 0 4px oklch(65% 0.2 320 / 0.25);
	}

	/* Drop zones in "ready to receive" state — pulsing outline */
	.qti-ggm-overlay :global(.qti-ggm-zone[data-ready] .qti-ggm-outline) {
		animation: ggm-hotspot-pulse 1.2s ease-in-out infinite;
	}

	@keyframes ggm-hotspot-pulse {
		0%, 100% { stroke-opacity: 1; }
		50% { stroke-opacity: 0.4; }
	}

	@media (prefers-reduced-motion: reduce) {
		.qti-ggm-overlay :global(.qti-ggm-zone[data-ready] .qti-ggm-outline) {
			animation: none;
		}
	}
</style>
