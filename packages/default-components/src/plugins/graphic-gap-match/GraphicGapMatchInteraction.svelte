<svelte:options customElement="pie-qti-graphic-gap-match" />

<script lang="ts">
/**
 * Graphic Gap Match component for graphicGapMatchInteractionData
 * Drag labels onto specific areas of an image/diagram
 * Supports keyboard (two-phase pick-up/drop), mouse, and touch interactions
 */

import type { GraphicGapMatchInteractionData } from '@pie-qti/item-player';
import type { I18nProvider } from '@pie-qti/i18n';
import { touchDrag } from '@pie-qti/qti-common';
import { createQtiChangeEvent } from '../../shared/utils/eventHelpers.js';
import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

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

// Parse props that may be JSON strings (web component usage)
const parsedInteraction = $derived(parseJsonProp<GraphicGapMatchInteractionData>(interaction));
const parsedResponse = $derived(parseJsonProp<string | string[]>(response));
const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);
const correctPairs = $derived(Array.isArray(parsedCorrectResponse) ? parsedCorrectResponse : []);

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

// Labels (gapTexts + gapImages) unavailable due to matchGroup conflicts with already-placed labels
const unavailableLabels = $derived.by(() => {
	if (!parsedInteraction) return new Set<string>();
	type WithMatchGroup = { identifier: string; matchGroup?: string[] };
	const gapTexts = parsedInteraction.gapTexts as WithMatchGroup[];
	const gapImages = (parsedInteraction.gapImages ?? []) as WithMatchGroup[];
	const placedGroups = new Set<string>();
	for (const pair of pairs) {
		const labelId = pair.split(' ')[0];
		const label = [...gapTexts, ...gapImages].find((g) => g.identifier === labelId);
		label?.matchGroup?.forEach((g) => placedGroups.add(g));
	}
	return new Set(
		[...gapTexts, ...gapImages]
			.filter((label) => {
				const isPlaced = pairs.some((p) => p.startsWith(`${label.identifier} `));
				if (isPlaced) return false;
				return label.matchGroup?.some((g) => placedGroups.has(g)) ?? false;
			})
			.map((label) => label.identifier)
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
	event.preventDefault();
	hoveredHotspotId = hotspotId;
}

function handleHotspotDragLeave() {
	hoveredHotspotId = null;
}

function handleHotspotDrop(event: DragEvent, hotspotId: string) {
	if (disabled || !draggedTextId || !parsedInteraction) return;
	event.preventDefault();

	// Remove any existing pair for this gapText
	let newPairs = pairs.filter((p) => !p.startsWith(`${draggedTextId} `));

	// Remove any existing pair for this hotspot
	newPairs = newPairs.filter((p) => !p.endsWith(` ${hotspotId}`));

	// Add new pair
	newPairs.push(`${draggedTextId} ${hotspotId}`);

	isInternalUpdate = true; // Mark as internal update to prevent sync effect from overwriting
	pairs = newPairs;
	response = pairs;
	// Call onChange callback if provided (for Svelte component usage)
	onChange?.(pairs);
	// Dispatch custom event for web component usage - dispatch from rootElement to ensure it bubbles out of Shadow DOM
	const valueArray = Array.isArray(pairs) ? [...pairs] : [];
	if (rootElement) {
		rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction.responseId, valueArray));
	}

	draggedTextId = null;
	hoveredHotspotId = null;
}

function clearMatch(gapTextId: string) {
	if (disabled || !parsedInteraction) return;
	const gapTextObj = parsedInteraction.gapTexts.find((g) => g.identifier === gapTextId);
	const gapTextName = gapTextObj?.text || 'Label';

	const newPairs = pairs.filter((p) => !p.startsWith(`${gapTextId} `));
	isInternalUpdate = true; // Mark as internal update
	pairs = newPairs;
	response = pairs;
	// Call onChange callback if provided (for Svelte component usage)
	onChange?.(pairs);
	// Dispatch custom event for web component usage - dispatch from rootElement to ensure it bubbles out of Shadow DOM
	const valueArray = Array.isArray(pairs) ? [...pairs] : [];
	if (rootElement) {
		rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction.responseId, valueArray));
	}

	liveMessage = `${gapTextName} removed from hotspot`;
}

/**
 * Resolve a human-readable name for a label by identifier.
 * Checks gapTexts first, then gapImages.
 */
function getLabelName(labelId: string): string {
	if (!parsedInteraction) return 'Label';
	const text = parsedInteraction.gapTexts.find((g) => g.identifier === labelId);
	if (text) return text.text;
	const img = parsedInteraction.gapImages.find((g) => g.identifier === labelId);
	if (img) return img.alt || img.identifier;
	return 'Label';
}

// Phase-1 handler: pick up or put down a label from the palette.
function handleLabelActivate(labelId: string) {
	if (disabled) return;

	if (pickedUpLabel === labelId) {
		// Second press on the same label cancels the pick-up
		pickedUpLabel = null;
		liveMessage = 'Cancelled.';
	} else {
		pickedUpLabel = labelId;
		const name = getLabelName(labelId);
		liveMessage = `Picked up: ${name}. Tab to a hotspot and press Enter to place it.`;
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
		liveMessage = 'Cancelled.';
	}
}

// Phase-2 handler: drop the held label onto a hotspot.
function placePickedUpLabelOnHotspot(hotspotId: string) {
	if (disabled || !pickedUpLabel || !parsedInteraction) return;

	const hotspotIndex = parsedInteraction.hotspots.findIndex((h) => h.identifier === hotspotId);
	const labelName = getLabelName(pickedUpLabel);

	// Create match
	let newPairs = pairs.filter((p) => !p.startsWith(`${pickedUpLabel} `));
	newPairs = newPairs.filter((p) => !p.endsWith(` ${hotspotId}`));
	newPairs.push(`${pickedUpLabel} ${hotspotId}`);

	isInternalUpdate = true; // Mark as internal update
	pairs = newPairs;
	response = pairs;
	// Call onChange callback if provided (for Svelte component usage)
	onChange?.(pairs);
	// Dispatch custom event for web component usage - dispatch from rootElement to ensure it bubbles out of Shadow DOM
	const valueArray = Array.isArray(pairs) ? [...pairs] : [];
	if (rootElement) {
		rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction.responseId, valueArray));
	}

	liveMessage = `Placed ${labelName} on hotspot ${hotspotIndex + 1}.`;
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
		liveMessage = 'Cancelled.';
	}
}

</script>

<ShadowBaseStyles />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={rootElement} class={['qti-graphic-gap-match-interaction', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')} onkeydown={handleRootKeyDown}>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-ggm-prompt font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<!-- Visually-hidden live region for screen reader announcements -->
		<div aria-live="polite" aria-atomic="true" class="sr-only">
			{liveMessage}
		</div>

		<!-- Instructions for keyboard users -->
		<div id="graphic-gap-match-instructions" class="sr-only">
			Press Space or Enter to pick up a label. Tab to a hotspot on the image and press Enter to place it. Press Escape to cancel.
		</div>

		<div
			part="region"
			class="qti-ggm-region space-y-4"
			role="region"
			aria-describedby="graphic-gap-match-instructions"
		>
			<!-- Draggable gap texts (labels) - Hide when showing correct answers -->
			{#if !isShowingCorrect}
				<div
					part="labels"
					class="qti-ggm-labels flex flex-wrap gap-2 p-4 bg-base-200 rounded-lg border-2 border-base-300"
					style={parsedInteraction.choicesContainerWidth ? `width: ${parsedInteraction.choicesContainerWidth}` : undefined}
					role="group"
					aria-label={i18n?.t('interactions.graphicGapMatch.availableLabel') ?? 'Available labels to place'}
				>
					<div class="qti-ggm-labels-title w-full text-sm text-base-content/70 font-semibold mb-2">
						{i18n?.t('interactions.graphicGapMatch.availableHeading') ?? 'Available Labels:'}
					</div>
					{#each parsedInteraction.gapTexts as gapText (gapText.identifier)}
						{@const matchedHotspot = getMatchedHotspot(gapText.identifier)}
						{@const isDragged = draggedTextId === gapText.identifier}
						{@const isHeld = pickedUpLabel === gapText.identifier}
						{@const isUnavailable = unavailableLabels.has(gapText.identifier)}

						<div class="inline-flex items-center gap-1">
							<button
								type="button"
								draggable={!disabled && !matchedHotspot && !isUnavailable}
								use:touchDrag
								ondragstart={() => handleDragStart(gapText.identifier)}
								ondragend={handleDragEnd}
								onclick={() => handleLabelActivate(gapText.identifier)}
								onkeydown={(e) => handleLabelKeyDown(e, gapText.identifier)}
								disabled={disabled || !!matchedHotspot}
								aria-disabled={isUnavailable ? 'true' : undefined}
								aria-pressed={isHeld}
								aria-label="{gapText.text}{matchedHotspot ? '. Already placed on hotspot' : isUnavailable ? '. Not available due to match group restriction' : ''}{isHeld ? '. Picked up. Tab to a hotspot and press Enter to place.' : '. Press Space or Enter to pick up'}"
								class="btn btn-md font-medium transition-all"
								class:btn-primary={!matchedHotspot && !isHeld}
								class:qti-ggm-label-held={isHeld}
								class:btn-success={matchedHotspot}
								class:cursor-grab={!disabled && !matchedHotspot && !isHeld && !isUnavailable}
								class:cursor-not-allowed={disabled || isUnavailable}
								class:opacity-40={isUnavailable}
								class:opacity-70={!isUnavailable && (disabled || isDragged)}
								class:contrast-125={matchedHotspot}
								class:saturate-150={matchedHotspot}
							>
								{gapText.text}
							</button>
							{#if matchedHotspot && !disabled}
								<button
									type="button"
									part="label-remove"
									class="btn btn-sm btn-circle btn-error"
									onclick={() => clearMatch(gapText.identifier)}
									aria-label="Remove {gapText.text} from hotspot"
									title={i18n?.t('interactions.graphicGapMatch.removeLabel') ?? 'Remove label'}
								>
									✕
								</button>
							{/if}
						</div>
					{/each}

					{#each (parsedInteraction.gapImages ?? []) as gapImage (gapImage.identifier)}
						{@const matchedHotspot = getMatchedHotspot(gapImage.identifier)}
						{@const isDragged = draggedTextId === gapImage.identifier}
						{@const isHeld = pickedUpLabel === gapImage.identifier}
						{@const isUnavailable = unavailableLabels.has(gapImage.identifier)}

						<div class="inline-flex items-center gap-1">
							<button
								type="button"
								draggable={!disabled && !matchedHotspot && !isUnavailable}
								use:touchDrag
								ondragstart={() => handleDragStart(gapImage.identifier)}
								ondragend={handleDragEnd}
								onclick={() => handleLabelActivate(gapImage.identifier)}
								onkeydown={(e) => handleLabelKeyDown(e, gapImage.identifier)}
								disabled={disabled || !!matchedHotspot}
								aria-disabled={isUnavailable ? 'true' : undefined}
								aria-pressed={isHeld}
								aria-label="{gapImage.alt || gapImage.identifier}{matchedHotspot ? '. Already placed on hotspot' : isUnavailable ? '. Not available due to match group restriction' : ''}{isHeld ? '. Picked up. Tab to a hotspot and press Enter to place.' : '. Press Space or Enter to pick up'}"
								class="btn btn-md p-1 transition-all"
								class:btn-primary={!matchedHotspot && !isHeld}
								class:qti-ggm-label-held={isHeld}
								class:btn-success={matchedHotspot}
								class:cursor-grab={!disabled && !matchedHotspot && !isHeld && !isUnavailable}
								class:cursor-not-allowed={disabled || isUnavailable}
								class:opacity-40={isUnavailable}
								class:opacity-70={!isUnavailable && (disabled || isDragged)}
							>
								<img
									src={gapImage.src}
									alt={gapImage.alt || gapImage.identifier}
									style={gapImage.width ? `width: ${gapImage.width}px;` : ''}
								/>
							</button>
							{#if matchedHotspot && !disabled}
								<button
									type="button"
									part="label-remove"
									class="btn btn-sm btn-circle btn-error"
									onclick={() => clearMatch(gapImage.identifier)}
									aria-label="Remove {gapImage.alt || gapImage.identifier} from hotspot"
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
			<div
				part="stage"
				class="qti-ggm-stage relative inline-block border-2 border-base-300 rounded-lg"
				style="position: relative; display: inline-block; width: {parsedInteraction.imageData?.width}px; height: {parsedInteraction.imageData?.height}px;"
			>
				<!-- SVG image or raster image -->
				{#if parsedInteraction.imageData?.content}
					{@html parsedInteraction.imageData.content}
				{:else if parsedInteraction.imageData?.src}
					<img
						src={parsedInteraction.imageData.src}
						alt={i18n?.t('interactions.graphicGapMatch.imageAlt') ?? 'Graphic gap match image'}
						style="width: 100%; height: 100%; display: block; position: absolute; top: 0; left: 0;"
					/>
				{/if}

				<!-- Overlay with hotspot drop zones -->
				<svg
					part="overlay"
					class="qti-ggm-overlay absolute top-0 left-0 w-full h-full pointer-events-none"
					style="position: absolute; width: 100%; height: 100%; pointer-events: none; top: 0; left: 0;"
					viewBox="0 0 {parsedInteraction.imageData?.width} {parsedInteraction.imageData?.height}"
				>
					{#each parsedInteraction.hotspots as hotspot (hotspot.identifier)}
						{@const matchedGapText = getMatchedGapText(hotspot.identifier)}
						{@const gapTextObj = matchedGapText ? parsedInteraction.gapTexts.find((g) => g.identifier === matchedGapText) : null}
						{@const isHovered = hoveredHotspotId === hotspot.identifier}
						{@const correctGapText = getCorrectGapText(hotspot.identifier)}
						{@const correctGapTextObj = correctGapText ? parsedInteraction.gapTexts.find((g) => g.identifier === correctGapText) : null}
						{@const isCorrect = isCorrectHotspot(hotspot.identifier)}
						{@const hotspotReady = !!pickedUpLabel && !disabled}
						{@const pickedUpLabelName = pickedUpLabel ? getLabelName(pickedUpLabel) : ''}

						<g>
							<!-- Hotspot drop zone -->
							{#if hotspot.shape === 'circle'}
								{@const [cx, cy, r] = hotspot.coords.split(',').map(Number)}
								{@const hotspotIndex = parsedInteraction.hotspots.findIndex((h) => h.identifier === hotspot.identifier)}
								<circle
									role="button"
									tabindex={disabled ? -1 : 0}
									aria-label="Hotspot {hotspotIndex + 1}{matchedGapText && gapTextObj ? '. Contains ' + gapTextObj.text : correctGapTextObj ? '. Correct answer: ' + correctGapTextObj.text : '. Empty'}{hotspotReady ? '. Press Enter to place ' + pickedUpLabelName + ' here' : ''}"
									cx={cx}
									cy={cy}
									r={r}
									fill={matchedGapText ? '#10b981' : isCorrect ? '#10b981' : hotspotReady ? '#3b82f6' : isHovered ? '#3b82f6' : 'transparent'}
									fill-opacity={matchedGapText ? '0.3' : isCorrect ? '0.2' : hotspotReady ? '0.15' : isHovered ? '0.2' : '0'}
									stroke={matchedGapText ? '#10b981' : isCorrect ? '#10b981' : hotspotReady ? '#3b82f6' : isHovered ? '#3b82f6' : '#6b7280'}
									stroke-width={hotspotReady ? '3' : '2'}
									stroke-dasharray={matchedGapText || isCorrect ? '' : hotspotReady ? '6,3' : '4,4'}
									class="transition-all{hotspotReady ? ' qti-ggm-hotspot-ready' : ''}"
									style="pointer-events: auto; cursor: {disabled ? 'not-allowed' : hotspotReady ? 'copy' : 'pointer'};"
									ondragover={(e) => handleHotspotDragOver(e, hotspot.identifier)}
									ondragleave={handleHotspotDragLeave}
									ondrop={(e) => handleHotspotDrop(e, hotspot.identifier)}
									onclick={() => placePickedUpLabelOnHotspot(hotspot.identifier)}
									onkeydown={(e) => handleHotspotKeyDown(e, hotspot.identifier)}
								/>
							{:else if hotspot.shape === 'rect'}
								{@const [x, y, right, bottom] = hotspot.coords.split(',').map(Number)}
								{@const width = right - x}
								{@const height = bottom - y}
								{@const hotspotIndex = parsedInteraction.hotspots.findIndex((h) => h.identifier === hotspot.identifier)}
								<rect
									role="button"
									tabindex={disabled ? -1 : 0}
									aria-label="Hotspot {hotspotIndex + 1}{matchedGapText && gapTextObj ? '. Contains ' + gapTextObj.text : correctGapTextObj ? '. Correct answer: ' + correctGapTextObj.text : '. Empty'}{hotspotReady ? '. Press Enter to place ' + pickedUpLabelName + ' here' : ''}"
									x={x}
									y={y}
									width={width}
									height={height}
									fill={matchedGapText ? '#10b981' : isCorrect ? '#10b981' : hotspotReady ? '#3b82f6' : isHovered ? '#3b82f6' : 'transparent'}
									fill-opacity={matchedGapText ? '0.3' : isCorrect ? '0.2' : hotspotReady ? '0.15' : isHovered ? '0.2' : '0'}
									stroke={matchedGapText ? '#10b981' : isCorrect ? '#10b981' : hotspotReady ? '#3b82f6' : isHovered ? '#3b82f6' : '#6b7280'}
									stroke-width={hotspotReady ? '3' : '2'}
									stroke-dasharray={matchedGapText || isCorrect ? '' : hotspotReady ? '6,3' : '4,4'}
									class="transition-all{hotspotReady ? ' qti-ggm-hotspot-ready' : ''}"
									style="pointer-events: auto; cursor: {disabled ? 'not-allowed' : hotspotReady ? 'copy' : 'pointer'};"
									ondragover={(e) => handleHotspotDragOver(e, hotspot.identifier)}
									ondragleave={handleHotspotDragLeave}
									ondrop={(e) => handleHotspotDrop(e, hotspot.identifier)}
									onclick={() => placePickedUpLabelOnHotspot(hotspot.identifier)}
									onkeydown={(e) => handleHotspotKeyDown(e, hotspot.identifier)}
								/>
							{/if}

							<!-- Label text on hotspot if matched or correct -->
							{#if matchedGapText && gapTextObj}
								{@const [cx, cy] = hotspot.coords.split(',').map(Number)}
								<text
									x={cx}
									y={cy}
									text-anchor="middle"
									dominant-baseline="middle"
									class="font-bold pointer-events-none"
									fill="#059669"
									font-size="14"
								>
									{gapTextObj.text}
								</text>
							{:else if isCorrect && correctGapTextObj}
								{@const [cx, cy] = hotspot.coords.split(',').map(Number)}
								<text
									x={cx}
									y={cy}
									text-anchor="middle"
									dominant-baseline="middle"
									class="font-bold pointer-events-none"
									fill="#10b981"
									font-size="14"
								>
									{correctGapTextObj.text}
								</text>
							{/if}
						</g>
					{/each}
				</svg>
			</div>
		</div>
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
	}
	.qti-ggm-prompt {
		margin: 0 0 0.75rem;
	}
	.qti-ggm-region {
		display: grid;
		gap: 1rem;
	}
	.qti-ggm-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
	}
	.qti-ggm-labels-title {
		width: 100%;
		margin: 0 0 0.5rem;
		font-weight: 600;
	}
	.qti-ggm-stage {
		position: relative;
		display: inline-block;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
	}
	.qti-ggm-overlay {
		position: absolute;
		inset: 0;
	}

	/* Ensure SVG fills its container */
	svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	/* Label button in "held" (picked-up) state */
	:global(.qti-ggm-label-held) {
		outline: 3px solid var(--color-accent, oklch(65% 0.2 320));
		outline-offset: 2px;
		background-color: var(--color-accent, oklch(65% 0.2 320)) !important;
		color: var(--color-accent-content, #fff) !important;
		box-shadow: 0 0 0 4px oklch(65% 0.2 320 / 0.25);
	}

	/* SVG hotspot shape in "ready to receive drop" state — pulsing outline */
	:global(.qti-ggm-hotspot-ready) {
		animation: ggm-hotspot-pulse 1.2s ease-in-out infinite;
	}

	@keyframes ggm-hotspot-pulse {
		0%, 100% { stroke-opacity: 1; }
		50% { stroke-opacity: 0.4; }
	}
</style>
