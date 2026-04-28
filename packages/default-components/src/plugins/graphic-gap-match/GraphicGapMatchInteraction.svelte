<svelte:options customElement="pie-qti-graphic-gap-match" />

<script lang="ts">
/**
 * Graphic Gap Match component for graphicGapMatchInteractionData
 * Drag labels onto specific areas of an image/diagram
 * Supports keyboard, mouse, and touch interactions
 */

import type { GraphicGapMatchInteractionData } from '@pie-qti/item-player';
import type { I18nProvider } from '@pie-qti/i18n';
import { createQtiChangeEvent } from '../../shared/utils/eventHelpers.js';
import { touchDrag } from '../../shared/utils/touchDragHelper.js';
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
let keyboardSelectedTextId = $state<string | null>(null); // Gap text selected via keyboard
let announceText = $state<string>(''); // For screen reader announcements

// Get reference to the root element for event dispatching (needed for Shadow DOM)
let rootElement: HTMLDivElement | undefined = $state();

// Track if we're updating from internal change (user drag) vs external (prop update)
let isInternalUpdate = false;

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

// Get the correct hotspot for a gap text
function getCorrectHotspot(gapTextId: string): string | null {
	const pair = correctPairs.find((p) => p.startsWith(`${gapTextId} `));
	return pair ? pair.split(' ')[1] : null;
}

// Get the correct gap text for a hotspot
function getCorrectGapText(hotspotId: string): string | null {
	const pair = correctPairs.find((p) => p.endsWith(` ${hotspotId}`));
	return pair ? pair.split(' ')[0] : null;
}

// Check if a gap text has a correct answer
function isCorrectGapText(gapTextId: string): boolean {
	return isShowingCorrect && getCorrectHotspot(gapTextId) !== null;
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

	announceText = `${gapTextName} removed from hotspot`;
}

// Keyboard handlers for gap texts (labels)
function handleGapTextClick(gapTextId: string) {
	if (disabled || !parsedInteraction) return;

	const gapTextObj = parsedInteraction.gapTexts.find((g) => g.identifier === gapTextId);
	const gapTextName = gapTextObj?.text || 'Label';

	if (keyboardSelectedTextId === gapTextId) {
		// Deselect
		keyboardSelectedTextId = null;
		announceText = `${gapTextName} deselected`;
	} else {
		// Select this gap text for placement
		keyboardSelectedTextId = gapTextId;
		announceText = `${gapTextName} selected. Navigate to a hotspot and press Space or Enter to place.`;
	}
}

function handleGapTextKeyDown(event: KeyboardEvent, gapTextId: string) {
	if (disabled || !parsedInteraction) return;

	const gapTextObj = parsedInteraction.gapTexts.find((g) => g.identifier === gapTextId);
	const gapTextName = gapTextObj?.text || 'Label';

	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();

		if (keyboardSelectedTextId === gapTextId) {
			// Deselect
			keyboardSelectedTextId = null;
			announceText = `${gapTextName} deselected`;
		} else {
			// Select this gap text for placement
			keyboardSelectedTextId = gapTextId;
			announceText = `${gapTextName} selected. Navigate to a hotspot and press Space or Enter to place.`;
		}
	} else if (event.key === 'Escape' && keyboardSelectedTextId) {
		event.preventDefault();
		keyboardSelectedTextId = null;
		announceText = `Selection cancelled`;
	}
}

// Keyboard handlers for hotspots
function placeSelectedLabelOnHotspot(hotspotId: string) {
	if (disabled || !keyboardSelectedTextId || !parsedInteraction) return;

	const hotspotIndex = parsedInteraction.hotspots.findIndex((h) => h.identifier === hotspotId);
	const gapTextObj = parsedInteraction.gapTexts.find((g) => g.identifier === keyboardSelectedTextId);
	const gapTextName = gapTextObj?.text || 'Label';

	// Create match
	let newPairs = pairs.filter((p) => !p.startsWith(`${keyboardSelectedTextId} `));
	newPairs = newPairs.filter((p) => !p.endsWith(` ${hotspotId}`));
	newPairs.push(`${keyboardSelectedTextId} ${hotspotId}`);

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

	announceText = `${gapTextName} placed on hotspot ${hotspotIndex + 1}`;
	keyboardSelectedTextId = null;
}

function handleHotspotKeyDown(event: KeyboardEvent, hotspotId: string) {
	if (disabled || !keyboardSelectedTextId || !parsedInteraction) return;

	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();
		placeSelectedLabelOnHotspot(hotspotId);
	}
}

// Parse coords based on shape
function parseCoords(hotspot: { identifier: string; shape: string; coords: string; matchMax: number }): { x: number; y: number; width: number; height: number } {
	const coords = hotspot.coords.split(',').map(Number);
	const shape = hotspot.shape as 'circle' | 'rect' | 'poly';
	if (shape === 'circle') {
		const [cx, cy, r] = coords;
		return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
	} else if (shape === 'rect') {
		const [x, y, width, height] = coords;
		return { x, y, width, height };
	}
	// For poly, use bounding box (simplified)
	return { x: coords[0], y: coords[1], width: 40, height: 40 };
}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} class="qti-graphic-gap-match-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-ggm-prompt font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<!-- Screen reader announcements -->
		<div aria-live="polite" aria-atomic="true" class="sr-only">
			{announceText}
		</div>

		<!-- Instructions for keyboard users -->
		<div id="graphic-gap-match-instructions" class="sr-only">
			Press Space or Enter to select a label. Tab to navigate to hotspots on the image. Press Space or Enter on a hotspot to place the label. Press Escape to cancel selection.
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
					role="group"
					aria-label={i18n?.t('interactions.graphicGapMatch.availableLabel') ?? 'Available labels to place'}
				>
					<div class="qti-ggm-labels-title w-full text-sm text-base-content/70 font-semibold mb-2">
						{i18n?.t('interactions.graphicGapMatch.availableHeading') ?? 'Available Labels:'}
					</div>
					{#each parsedInteraction.gapTexts as gapText (gapText.identifier)}
						{@const matchedHotspot = getMatchedHotspot(gapText.identifier)}
						{@const isDragged = draggedTextId === gapText.identifier}
						{@const isSelected = keyboardSelectedTextId === gapText.identifier}

						<div class="inline-flex items-center gap-1">
							<button
								type="button"
								draggable={!disabled && !matchedHotspot}
								use:touchDrag
								ondragstart={() => handleDragStart(gapText.identifier)}
								ondragend={handleDragEnd}
								onclick={() => handleGapTextClick(gapText.identifier)}
								onkeydown={(e) => handleGapTextKeyDown(e, gapText.identifier)}
								disabled={disabled || !!matchedHotspot}
								aria-pressed={isSelected}
								aria-label="{gapText.text}{matchedHotspot ? '. Already placed on hotspot' : ''}{isSelected ? '. Selected for placement' : '. Press Space to select'}"
								class="btn btn-md font-medium transition-all"
								class:btn-primary={!matchedHotspot && !isSelected}
								class:btn-accent={isSelected}
								class:btn-success={matchedHotspot}
								class:cursor-grab={!disabled && !matchedHotspot && !isSelected}
								class:cursor-not-allowed={disabled}
								class:opacity-70={disabled || isDragged}
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
						{@const isSelected = keyboardSelectedTextId === gapImage.identifier}

						<div class="inline-flex items-center gap-1">
							<button
								type="button"
								draggable={!disabled && !matchedHotspot}
								use:touchDrag
								ondragstart={() => handleDragStart(gapImage.identifier)}
								ondragend={handleDragEnd}
								onclick={() => handleGapTextClick(gapImage.identifier)}
								onkeydown={(e) => handleGapTextKeyDown(e, gapImage.identifier)}
								disabled={disabled || !!matchedHotspot}
								aria-pressed={isSelected}
								aria-label="{gapImage.alt || gapImage.identifier}{matchedHotspot ? '. Already placed on hotspot' : ''}{isSelected ? '. Selected for placement' : '. Press Space to select'}"
								class="btn btn-md p-1 transition-all"
								class:btn-primary={!matchedHotspot && !isSelected}
								class:btn-accent={isSelected}
								class:btn-success={matchedHotspot}
								class:cursor-grab={!disabled && !matchedHotspot && !isSelected}
								class:cursor-not-allowed={disabled}
								class:opacity-70={disabled || isDragged}
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
				<!-- SVG image -->
				{#if parsedInteraction.imageData?.content}
					{@html parsedInteraction.imageData.content}
				{/if}

				<!-- Overlay with hotspot drop zones -->
				<svg
					part="overlay"
					class="qti-ggm-overlay absolute top-0 left-0 w-full h-full pointer-events-none"
					style="position: absolute; width: 100%; height: 100%; pointer-events: none; top: 0; left: 0;"
					viewBox="0 0 {parsedInteraction.imageData?.width} {parsedInteraction.imageData?.height}"
				>
					{#each parsedInteraction.hotspots as hotspot (hotspot.identifier)}
						{@const coords = parseCoords(hotspot)}
						{@const matchedGapText = getMatchedGapText(hotspot.identifier)}
						{@const gapTextObj = matchedGapText ? parsedInteraction.gapTexts.find((g) => g.identifier === matchedGapText) : null}
						{@const isHovered = hoveredHotspotId === hotspot.identifier}
						{@const correctGapText = getCorrectGapText(hotspot.identifier)}
						{@const correctGapTextObj = correctGapText ? parsedInteraction.gapTexts.find((g) => g.identifier === correctGapText) : null}
						{@const isCorrect = isCorrectHotspot(hotspot.identifier)}

						<g>
							<!-- Hotspot drop zone -->
							{#if hotspot.shape === 'circle'}
								{@const [cx, cy, r] = hotspot.coords.split(',').map(Number)}
								{@const hotspotIndex = parsedInteraction.hotspots.findIndex((h) => h.identifier === hotspot.identifier)}
								<circle
									role="button"
									tabindex={disabled || !keyboardSelectedTextId ? -1 : 0}
									aria-label="Hotspot {hotspotIndex + 1}{matchedGapText && gapTextObj ? '. Contains ' + gapTextObj.text : correctGapTextObj ? '. Correct answer: ' + correctGapTextObj.text : '. Available'}{keyboardSelectedTextId ? '. Press Space or Enter to place label' : ''}"
									cx={cx}
									cy={cy}
									r={r}
									fill={matchedGapText ? '#10b981' : isCorrect ? '#10b981' : isHovered ? '#3b82f6' : 'transparent'}
									fill-opacity={matchedGapText ? '0.3' : isCorrect ? '0.2' : isHovered ? '0.2' : '0'}
									stroke={matchedGapText ? '#10b981' : isCorrect ? '#10b981' : isHovered ? '#3b82f6' : '#6b7280'}
									stroke-width="2"
									stroke-dasharray={matchedGapText || isCorrect ? '' : '4,4'}
									class="transition-all"
									style="pointer-events: auto; cursor: {disabled ? 'not-allowed' : 'pointer'};"
									ondragover={(e) => handleHotspotDragOver(e, hotspot.identifier)}
									ondragleave={handleHotspotDragLeave}
									ondrop={(e) => handleHotspotDrop(e, hotspot.identifier)}
									onclick={() => placeSelectedLabelOnHotspot(hotspot.identifier)}
									onkeydown={(e) => handleHotspotKeyDown(e, hotspot.identifier)}
								/>
							{:else if hotspot.shape === 'rect'}
								{@const [x, y, width, height] = hotspot.coords.split(',').map(Number)}
								{@const hotspotIndex = parsedInteraction.hotspots.findIndex((h) => h.identifier === hotspot.identifier)}
								<rect
									role="button"
									tabindex={disabled || !keyboardSelectedTextId ? -1 : 0}
									aria-label="Hotspot {hotspotIndex + 1}{matchedGapText && gapTextObj ? '. Contains ' + gapTextObj.text : correctGapTextObj ? '. Correct answer: ' + correctGapTextObj.text : '. Available'}{keyboardSelectedTextId ? '. Press Space or Enter to place label' : ''}"
									x={x}
									y={y}
									width={width}
									height={height}
									fill={matchedGapText ? '#10b981' : isCorrect ? '#10b981' : isHovered ? '#3b82f6' : 'transparent'}
									fill-opacity={matchedGapText ? '0.3' : isCorrect ? '0.2' : isHovered ? '0.2' : '0'}
									stroke={matchedGapText ? '#10b981' : isCorrect ? '#10b981' : isHovered ? '#3b82f6' : '#6b7280'}
									stroke-width="2"
									stroke-dasharray={matchedGapText || isCorrect ? '' : '4,4'}
									class="transition-all"
									style="pointer-events: auto; cursor: {disabled ? 'not-allowed' : 'pointer'};"
									ondragover={(e) => handleHotspotDragOver(e, hotspot.identifier)}
									ondragleave={handleHotspotDragLeave}
									ondrop={(e) => handleHotspotDrop(e, hotspot.identifier)}
									onclick={() => placeSelectedLabelOnHotspot(hotspot.identifier)}
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

</style>
