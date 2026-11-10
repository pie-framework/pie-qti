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
import ImageStage from '../../shared/components/ImageStage.svelte';
import { emitInteractionChange } from '../../shared/utils/eventHelpers.js';
	import { normalizeCssPixelLength } from '@pie-qti/item-player/security';
	import { formatList, joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import type { InteractionProps } from '../../shared/utils/interactionProps';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { exceedsLimit, limitMessage } from '../../shared/utils/capacity';
	import { isCompatibleMatchGroup, matchGroupBlockedIds } from '../../shared/utils/matchGroupUtils';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { createPickUpPlace } from '../../shared/components/pickUpPlace.svelte';
	import { choiceAccessibleName } from '../../shared/utils/choiceName';
	import { choicesShortOfMatchMin } from '../../shared/utils/minimumRequirement';
	import {
		getSourceForTarget,
		getTargetForSource,
		placeSourceOnTarget,
		removePairBySource,
	} from '../../shared/utils/pairHelpers';
import { hitStrokeWidth, imageAltText, shapeCenter } from '../../shared/utils/graphicRegions';

import '../../shared/styles/srOnly.js';
import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';

	type Props = InteractionProps<'graphicGapMatchInteraction', string | string[] | null, string[] | null>;

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

// The stage's pixel space: the image's authored width/height, else its natural size once
// loaded (resolved by the shared ImageStage; `refuse` mode). Hotspot coords are in that
// pixel space when the item declares no width/height.
let imageWidth = $state<number | null>(null);
let imageHeight = $state<number | null>(null);
let imageFailed = $state(false);
let awaitingNaturalSize = $state(false);
const hasImageDimensions = $derived(imageWidth !== null && imageHeight !== null);
const missingDimensions = $derived(!!parsedInteraction && !!imageData && !hasImageDimensions && !awaitingNaturalSize);

// Reflow (WCAG 1.4.10): the stage scales with its container up to the image's natural size.
const frameStyle = $derived(imageWidth ? `max-width: calc(${imageWidth}px + 4px);` : '');

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

function warnImageFailed(src: string) {
	console.warn(`[pie-qti-graphic-gap-match] The image failed to load: ${src}`);
}

let pairs = $state<string[]>([]);
let hoveredHotspotId = $state<string | null>(null);
/** The label "held" via the keyboard (two-phase pick-up/drop), and the label a pointer drag carries. */
const pickUp = createPickUpPlace();
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
	return exceedsLimit(candidatePairs.length, Number(parsedInteraction?.maxAssociations ?? 0));
}

/** Announce a refused placement: the author's data-max-selections-message wins. */
function announceAssociationLimit() {
	liveMessage = limitMessage(
		parsedInteraction?.maxSelectionsMessage,
		translate(
			i18n,
			'interactions.graphicGapMatch.associationLimitReached',
			'Association not possible: the limit of {max} is reached.',
			{ max: Number(parsedInteraction?.maxAssociations ?? 0) },
		),
	);
}

// Hotspots the label being placed may not go on, due to matchGroup: the dragged label during a
// drag (what a drop would place), else the held one.
const blockedHotspotIds = $derived.by(() => {
	const labelId = pickUp.active;
	if (!labelId || !parsedInteraction) return new Set<string>();
	const label = findLabel(labelId);
	// A label the palette does not have goes on no hotspot.
	if (!label) return new Set(parsedInteraction.hotspots.map((h) => h.identifier));
	return matchGroupBlockedIds(label, parsedInteraction.hotspots);
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
	return getTargetForSource(pairs, gapTextId);
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
	return getSourceForTarget(pairs, hotspotId);
}

// Get the correct gap text for a hotspot
function getCorrectGapText(hotspotId: string): string | null {
	return getSourceForTarget(correctPairs, hotspotId);
}

// Check if a hotspot has a correct answer
function isCorrectHotspot(hotspotId: string): boolean {
	return isShowingCorrect && getCorrectGapText(hotspotId) !== null;
}

function handleDragStart(gapTextId: string) {
	if (disabled) return;
	pickUp.startDrag(gapTextId);
}

function handleDragEnd() {
	pickUp.endDrag();
	hoveredHotspotId = null;
}

function handleHotspotDragOver(event: DragEvent, hotspotId: string) {
	if (disabled || !pickUp.dragged) return;
	// Not a drop target for this label (matchGroup): leave the default "no drop" feedback.
	if (blockedHotspotIds.has(hotspotId)) return;
	event.preventDefault();
	hoveredHotspotId = hotspotId;
}

function handleHotspotDragLeave() {
	hoveredHotspotId = null;
}

function handleHotspotDrop(event: DragEvent, hotspotId: string) {
	const draggedTextId = pickUp.dragged;
	if (disabled || !draggedTextId || !parsedInteraction) return;
	event.preventDefault();

	// matchGroup: refuse a placement the hotspot does not accept; placeLabel refuses (and
	// announces) one past maxAssociations.
	if (canPlaceLabel(draggedTextId, hotspotId)) placeLabel(draggedTextId, hotspotId);

	pickUp.endDrag();
	hoveredHotspotId = null;
}

/**
 * Place `labelId` on `hotspotId`: the hotspot's previous label is replaced, and a placed label
 * moves — the palette retires a placed label, so each label holds one hotspot whatever its
 * matchMax (capacity 1). A placement past maxAssociations is refused and announced — the same
 * maxima response validation enforces — so an over-limit response never reaches the submit
 * that would reject it. Returns whether the response changed.
 */
function placeLabel(labelId: string, hotspotId: string): boolean {
	const newPairs = placeSourceOnTarget(pairs, labelId, hotspotId, 1);
	if (exceedsMaxAssociations(newPairs)) {
		announceAssociationLimit();
		return false;
	}

	isInternalUpdate = true; // Mark as internal update to prevent sync effect from overwriting
	pairs = newPairs;
	response = pairs;
	// Call onChange callback if provided (for Svelte component usage)
	emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: pairs, onChange });
	return true;
}

	async function clearMatch(labelId: string, event?: MouseEvent) {
		if (disabled || !parsedInteraction) return;
		const labelName = getLabelName(labelId);
		// The remove button shares its wrapper with the label button it clears; the
		// wrapper (and that label button) survive the removal.
		const wrapper = (event?.currentTarget as HTMLElement | null)?.parentElement ?? null;

		const newPairs = removePairBySource(pairs, labelId);
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
 * Each palette label's 1-based position in the order the candidate sees:
 * gap texts first, then gap images, as the palette renders them.
 */
const labelPositions = $derived.by(() => {
	const positions = new Map<string, number>();
	if (!parsedInteraction) return positions;
	let position = 0;
	for (const label of [...parsedInteraction.gapTexts, ...(parsedInteraction.gapImages ?? [])]) {
		position += 1;
		positions.set(label.identifier, position);
	}
	return positions;
});

/**
 * Resolve a human-readable name for a label by identifier: a gap text's text,
 * a gap image's alternative text, else the localized ordinal of its palette
 * position ("Choice 3" — the same fallback the text gap-match interaction
 * uses) — never the identifier, which can reveal the answer key.
 */
function getLabelName(labelId: string): string {
	return choiceAccessibleName({
		i18n,
		label: labelContent(labelId),
		position: labelPositions.get(labelId) ?? 0,
	});
}

function labelContent(labelId: string): string {
	const text = parsedInteraction?.gapTexts.find((g) => g.identifier === labelId);
	if (text) return text.text;
	const img = (parsedInteraction?.gapImages ?? []).find((g) => g.identifier === labelId);
	// The image's alternative text names it; the gapImg's authored `objectLabel`
	// stands in when the image itself carries none (QTI objectLabel/object-label).
	return img?.alt || img?.objectLabel || '';
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
 * The name of a hotspot zone: its authored `hotspotLabel` when the author gave
 * one (QTI hotspotLabel / hotspot-label), else the localized ordinal ("Hotspot
 * 3"). Never the identifier, which can reveal the answer key.
 */
function hotspotZoneName(hotspot: { hotspotLabel?: string }, number: number): string {
	return (
		hotspot.hotspotLabel?.trim() ||
		translate(i18n, 'interactions.graphicGapMatch.hotspot', 'Hotspot {number}', { number })
	);
}

/**
 * Accessible name of a hotspot: its name and contents, then the drop hint while a label
 * is held, or that matchGroup keeps the held label off it. A zone the author named
 * (`hotspotLabel`) is announced by that name; an unnamed one keeps its ordinal.
 */
function hotspotAriaLabel(
	hotspot: { hotspotLabel?: string },
	number: number,
	contains: string | undefined,
	correct: string | undefined,
	heldLabel: string | null,
	blocked: boolean,
): string {
	// A named zone: its name as a sentence, then the localized state after it
	// (the shared sentence and correct-answer keys; `contains` is this
	// interaction's own state-only key).
	const authored = hotspot.hotspotLabel?.trim();
	const sentence = (text: string) => translate(i18n, 'accessibility.sentence', '{text}.', { text });
	const state = authored
		? contains
			? joinSentences(
					sentence(authored),
					sentence(translate(i18n, 'interactions.graphicGapMatch.contains', 'Contains: {label}', { label: contains })),
				)
			: correct
				? joinSentences(
						sentence(authored),
						translate(i18n, 'accessibility.correctAnswerIs', 'Correct answer: {answer}.', { answer: correct }),
					)
				: sentence(authored)
		: contains
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

	// A second press on the same label cancels the pick-up; another label switches to it.
	liveMessage = pickUp.toggle(labelId)
		? translate(i18n, 'interactions.graphicGapMatch.pickedUp', 'Picked up: {label}. Tab to a hotspot and press Enter to place it.', {
				label: getLabelName(labelId),
			})
		: cancelledMessage();
}

function handleLabelKeyDown(event: KeyboardEvent, labelId: string) {
	if (disabled) return;

	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();
		handleLabelActivate(labelId);
	} else if (event.key === 'Escape' && pickUp.held) {
		event.preventDefault();
		pickUp.release();
		liveMessage = cancelledMessage();
	}
}

// Phase-2 handler: drop the held label onto a hotspot.
function placePickedUpLabelOnHotspot(hotspotId: string) {
	if (disabled || !pickUp.held || !parsedInteraction) return;
	const hotspotIndex = parsedInteraction.hotspots.findIndex((h) => h.identifier === hotspotId);
	const hotspot = hotspotIndex >= 0 ? parsedInteraction.hotspots[hotspotIndex] : undefined;

	// A refused placement keeps the label held, so the candidate can place it elsewhere or cancel.
	const placed = pickUp.place(hotspotId, (labelId) => {
		// matchGroup: this hotspot does not accept the held label.
		if (!canPlaceLabel(labelId, hotspotId)) {
			liveMessage = translate(i18n, 'interactions.graphicGapMatch.unavailableSentence', 'Not available due to a match group restriction.');
			return false;
		}
		// maxAssociations: placeLabel refuses (and announces) a placement past the cap.
		return placeLabel(labelId, hotspotId);
	});
	if (placed === null) return;

	liveMessage = translate(i18n, 'interactions.graphicGapMatch.labelPlaced', '{label} placed on hotspot {hotspot}', {
		label: getLabelName(placed),
		// The message names the target "hotspot {n}"; a zone the author named
		// (hotspotLabel) is announced by that name instead of its number.
		hotspot: hotspot?.hotspotLabel?.trim() || hotspotIndex + 1,
	});
}

function handleHotspotKeyDown(event: KeyboardEvent, hotspotId: string) {
	if (disabled || !parsedInteraction) return;

	if (event.key === ' ' || event.key === 'Enter') {
		if (pickUp.held) {
			event.preventDefault();
			placePickedUpLabelOnHotspot(hotspotId);
		}
	}
}

// Global Escape on root element cancels any active pick-up
function handleRootKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && pickUp.held) {
		event.preventDefault();
		pickUp.release();
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
						{@const isDragged = pickUp.dragged === gapText.identifier}
						{@const isHeld = pickUp.isHeld(gapText.identifier)}

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
						{@const isDragged = pickUp.dragged === gapImage.identifier}
						{@const isHeld = pickUp.isHeld(gapImage.identifier)}
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
				<ImageStage
					{imageData}
					alt={imageAlt}
					description={imageDescription}
					descriptionId={imageDescriptionId}
					containerClass="qti-ggm-canvas"
					capContainerWidth={false}
					svgContentClass="qti-ggm-image"
					imgClass="qti-ggm-image"
					errorClass="qti-ggm-image qti-ggm-image-error"
					mediaPart="image"
					errorPart="image-error"
					loadErrorText={translate(i18n, 'interactions.graphicGapMatch.imageLoadError', 'The image could not be loaded.')}
					onImageError={warnImageFailed}
					sizing="refuse"
					bind:width={imageWidth}
					bind:height={imageHeight}
					bind:failed={imageFailed}
					bind:awaiting={awaitingNaturalSize}
					bind:renderedWidth
				>

					<!-- Overlay with hotspot drop zones, in the image's natural pixel space.
					     Only drawn when that space is known: any guess misplaces every hotspot. -->
					{#if hasImageDimensions}
					<svg
						part="overlay"
						class="qti-ggm-overlay"
						viewBox="0 0 {imageWidth} {imageHeight}"
						data-disabled={disabled ? '' : undefined}
					>
						<!-- Default-shape hotspots are the whole image (QTI 3.0 §8.29), so they lie
						     beneath every other hotspot: their layers and pointer target are painted
						     first, and a drop or click on another hotspot stays that hotspot's. -->
						{#each parsedInteraction.hotspots as hotspot (hotspot.identifier)}
							{#if hotspot.shape === 'default'}
								{@const matchedGapText = getMatchedGapText(hotspot.identifier)}
								{@const matchedLabelName = matchedGapText ? getLabelName(matchedGapText) : undefined}
								{@const correctGapText = getCorrectGapText(hotspot.identifier)}
								{@const correctLabelName = correctGapText ? getLabelName(correctGapText) : undefined}
								{@const isCorrect = isCorrectHotspot(hotspot.identifier)}
								{@const isBlocked = blockedHotspotIds.has(hotspot.identifier)}
								{@const hotspotReady = !!pickUp.held && !disabled && !isBlocked}
								{@const center = shapeCenter(hotspot.shape, hotspot.coords)}
								<g
									class="qti-ggm-zone qti-ggm-backdrop qti-graphic-region"
									data-filled={matchedGapText ? '' : undefined}
									data-correct={!matchedGapText && isCorrect ? '' : undefined}
									data-ready={hotspotReady ? '' : undefined}
									data-hovered={hoveredHotspotId === hotspot.identifier ? '' : undefined}
									data-blocked={isBlocked ? '' : undefined}
								>
									<HotspotShape shape={hotspot.shape} coords={hotspot.coords} interactive={false} presentation={{ class: 'qti-ggm-halo qti-graphic-halo' }} />
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
										interactive="pointer"
										presentation={{
											class: `qti-ggm-hotspot qti-ggm-pointer-target${hotspotReady ? ' qti-ggm-hotspot-ready' : ''}`,
											'data-filled': matchedGapText ? '' : undefined,
											style: `cursor: ${disabled || isBlocked ? 'not-allowed' : hotspotReady ? 'copy' : 'pointer'};`,
										}}
										ondragover={(e) => handleHotspotDragOver(e, hotspot.identifier)}
										ondragleave={handleHotspotDragLeave}
										ondrop={(e) => handleHotspotDrop(e, hotspot.identifier)}
										onclick={() => placePickedUpLabelOnHotspot(hotspot.identifier)}
									/>
								</g>
							{/if}
						{/each}

						{#each parsedInteraction.hotspots as hotspot, hotspotIndex (hotspot.identifier)}
							{@const matchedGapText = getMatchedGapText(hotspot.identifier)}
							{@const matchedLabelName = matchedGapText ? getLabelName(matchedGapText) : undefined}
							{@const isHovered = hoveredHotspotId === hotspot.identifier}
							{@const correctGapText = getCorrectGapText(hotspot.identifier)}
							{@const correctLabelName = correctGapText ? getLabelName(correctGapText) : undefined}
							{@const isCorrect = isCorrectHotspot(hotspot.identifier)}
							{@const isBlocked = blockedHotspotIds.has(hotspot.identifier)}
							{@const hotspotReady = !!pickUp.held && !disabled && !isBlocked}
							{@const pickedUpLabelName = pickUp.held ? getLabelName(pickUp.held) : ''}
							{@const center = shapeCenter(hotspot.shape, hotspot.coords)}

							<!-- One drop zone: light halo + state outline (visible on any image), the
							     placed label's text (not colour alone), then the interactive target on
							     top, grown to 24×24 CSS px when small. -->
							<g
								class="qti-ggm-zone qti-graphic-region"
								data-filled={matchedGapText ? '' : undefined}
								data-correct={!matchedGapText && isCorrect ? '' : undefined}
								data-ready={hotspotReady ? '' : undefined}
								data-hovered={isHovered ? '' : undefined}
								data-blocked={isBlocked ? '' : undefined}
							>
								<HotspotShape shape={hotspot.shape} coords={hotspot.coords} interactive={false} presentation={{ class: 'qti-ggm-halo qti-graphic-halo' }} />
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
										hotspot,
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
										style: `--qti-hit-stroke: ${hitStrokeWidth(hotspot.shape, hotspot.coords, renderScale)}px; cursor: ${disabled || isBlocked ? 'not-allowed' : hotspotReady ? 'copy' : 'pointer'};${hotspot.shape === 'default' ? ' pointer-events: none;' : ''}`,
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
				</ImageStage>
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
	/*
	 * Focus indicator: the shared offset ring in ImageStage's sheet — focus-within
	 * on the zone colours and widens its halo layer into a ring around the zone,
	 * distinct from the filled/ready outline (WCAG 2.4.7).
	 */

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
