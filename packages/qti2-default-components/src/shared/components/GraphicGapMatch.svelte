<script lang="ts">
/**
 * Graphic Gap Match component for graphicGapMatchInteraction
 * Drag labels onto specific areas of an image/diagram
 * Supports keyboard, mouse, and touch interactions
 */

import type { I18nProvider } from '@pie-qti/qti2-i18n';
import { createOrUpdatePair, getSourceForTarget, getTargetForSource, removePairBySource } from '../utils/pairHelpers.js';
import { touchDrag } from '../utils/touchDragHelper.js';
import '../styles/shared.css';

interface GapText {
	identifier: string;
	text: string;
	matchMax: number;
}

interface Hotspot {
	identifier: string;
	shape: 'circle' | 'rect' | 'poly';
	coords: string;
	matchMax: number;
}

interface Props {
	gapTexts: GapText[];
	hotspots: Hotspot[];
	pairs: string[]; // Array of "gapTextId hotspotId" pairs
	imageData: string; // SVG or image data
	imageWidth: string;
	imageHeight: string;
	disabled?: boolean;
	i18n?: I18nProvider;
	onPairsChange: (newPairs: string[]) => void;
}

const { gapTexts, hotspots, pairs, imageData, imageWidth, imageHeight, disabled = false, i18n, onPairsChange }: Props = $props();

// Reactive translations
const translations = $derived({
	keyboardInstructions: i18n?.t('interactions.graphicGapMatch.keyboardInstructions') ?? 'interactions.graphicGapMatch.keyboardInstructions',
	availableLabel: i18n?.t('interactions.graphicGapMatch.availableLabel') ?? 'interactions.graphicGapMatch.availableLabel',
	availableHeading: i18n?.t('interactions.graphicGapMatch.availableHeading') ?? 'interactions.graphicGapMatch.availableHeading',
	alreadyPlaced: i18n?.t('interactions.graphicGapMatch.alreadyPlaced') ?? 'interactions.graphicGapMatch.alreadyPlaced',
	selectedForPlacement: i18n?.t('interactions.graphicGapMatch.selectedForPlacement') ?? 'interactions.graphicGapMatch.selectedForPlacement',
	pressSpaceToSelect: i18n?.t('interactions.graphicGapMatch.pressSpaceToSelect') ?? 'interactions.graphicGapMatch.pressSpaceToSelect',
	pressSpaceToPlace: i18n?.t('interactions.graphicGapMatch.pressSpaceToPlace') ?? 'interactions.graphicGapMatch.pressSpaceToPlace',
	removeFromHotspot: (label: string) => i18n?.t('interactions.graphicGapMatch.removeFromHotspot', { label }) ?? `interactions.graphicGapMatch.removeFromHotspot (${label})`,
	hotspot: (number: number) => i18n?.t('interactions.graphicGapMatch.hotspot', { number }) ?? `interactions.graphicGapMatch.hotspot (${number})`,
	contains: (label: string) => i18n?.t('interactions.graphicGapMatch.contains', { label }) ?? `interactions.graphicGapMatch.contains (${label})`,
});

let draggedTextId = $state<string | null>(null);
let hoveredHotspotId = $state<string | null>(null);
let keyboardSelectedTextId = $state<string | null>(null); // Gap text selected via keyboard
let announceText = $state<string>(''); // For screen reader announcements

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
	if (disabled || !draggedTextId) return;
	event.preventDefault();

	const newPairs = createOrUpdatePair(pairs, draggedTextId, hotspotId);
	onPairsChange(newPairs);
	draggedTextId = null;
	hoveredHotspotId = null;
}

function clearMatch(gapTextId: string) {
	if (disabled) return;
	const gapTextObj = gapTexts.find((g) => g.identifier === gapTextId);
	const gapTextName = gapTextObj?.text || 'Label';

	const newPairs = removePairBySource(pairs, gapTextId);
	onPairsChange(newPairs);

	announceText = `${gapTextName} removed from hotspot`;
}

// Keyboard handlers for gap texts (labels)
function handleGapTextKeyDown(event: KeyboardEvent, gapTextId: string) {
	if (disabled) return;

	const gapTextObj = gapTexts.find((g) => g.identifier === gapTextId);
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
function handleHotspotKeyDown(event: KeyboardEvent, hotspotId: string) {
	if (disabled || !keyboardSelectedTextId) return;

	const hotspotIndex = hotspots.findIndex((h) => h.identifier === hotspotId);
	const gapTextObj = gapTexts.find((g) => g.identifier === keyboardSelectedTextId);
	const gapTextName = gapTextObj?.text || 'Label';

	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();

		// Create match
		const newPairs = createOrUpdatePair(pairs, keyboardSelectedTextId!, hotspotId);
		onPairsChange(newPairs);
		announceText = `${gapTextName} placed on hotspot ${hotspotIndex + 1}`;
		keyboardSelectedTextId = null;
	}
}

// Parse coords based on shape
function parseCoords(hotspot: Hotspot): { x: number; y: number; width: number; height: number } {
	const coords = hotspot.coords.split(',').map(Number);
	if (hotspot.shape === 'circle') {
		const [cx, cy, r] = coords;
		return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
	} else if (hotspot.shape === 'rect') {
		const [x, y, width, height] = coords;
		return { x, y, width, height };
	}
	// For poly, use bounding box (simplified)
	return { x: coords[0], y: coords[1], width: 40, height: 40 };
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{announceText}
</div>

<!-- Instructions for keyboard users -->
<div id="graphic-gap-match-instructions" class="sr-only">
	Press Space or Enter to select a label. Tab to navigate to hotspots on the image. Press Space or Enter on a hotspot to place the label. Press Escape to cancel selection.
</div>

<div class="space-y-4" role="region" aria-describedby="graphic-gap-match-instructions">
	<!-- Draggable gap texts (labels) -->
	<div class="flex flex-wrap gap-2 p-4 bg-base-200 rounded-lg border-2 border-base-300" role="group" aria-label="Available labels to place">
		<div class="w-full text-sm text-base-content/70 font-semibold mb-2">Available Labels:</div>
		{#each gapTexts as gapText (gapText.identifier)}
			{@const matchedHotspot = getTargetForSource(pairs, gapText.identifier)}
			{@const isDragged = draggedTextId === gapText.identifier}
			{@const isSelected = keyboardSelectedTextId === gapText.identifier}

			<div class="inline-flex items-center gap-1">
				<button
					type="button"
					draggable={!disabled && !matchedHotspot}
					use:touchDrag
					ondragstart={() => handleDragStart(gapText.identifier)}
					ondragend={handleDragEnd}
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
						class="btn btn-sm btn-circle btn-error"
						onclick={() => clearMatch(gapText.identifier)}
						aria-label="Remove {gapText.text} from hotspot"
						title="Remove label"
					>
						✕
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Image/diagram with hotspot drop zones -->
	<div class="relative inline-block border-2 border-base-300 rounded-lg" style="width: {imageWidth}px; height: {imageHeight}px;">
		<!-- SVG image -->
		{@html imageData}

		<!-- Overlay with hotspot drop zones -->
		<svg
			class="absolute top-0 left-0 w-full h-full pointer-events-none"
			style="pointer-events: none; top: 0; left: 0;"
			viewBox="0 0 {imageWidth} {imageHeight}"
		>
			{#each hotspots as hotspot (hotspot.identifier)}
				{@const coords = parseCoords(hotspot)}
				{@const matchedGapText = getSourceForTarget(pairs, hotspot.identifier)}
				{@const gapTextObj = matchedGapText ? gapTexts.find((g) => g.identifier === matchedGapText) : null}
				{@const isHovered = hoveredHotspotId === hotspot.identifier}

				<g>
					<!-- Hotspot drop zone -->
					{#if hotspot.shape === 'circle'}
						{@const [cx, cy, r] = hotspot.coords.split(',').map(Number)}
						{@const hotspotIndex = hotspots.findIndex((h) => h.identifier === hotspot.identifier)}
						<circle
							role="button"
							tabindex={disabled || !keyboardSelectedTextId ? -1 : 0}
							aria-label="Hotspot {hotspotIndex + 1}{matchedGapText && gapTextObj ? '. Contains ' + gapTextObj.text : '. Available'}{keyboardSelectedTextId ? '. Press Space or Enter to place label' : ''}"
							cx={cx}
							cy={cy}
							r={r}
							fill={matchedGapText ? '#10b981' : isHovered ? '#3b82f6' : 'transparent'}
							fill-opacity={matchedGapText ? '0.3' : isHovered ? '0.2' : '0'}
							stroke={matchedGapText ? '#10b981' : isHovered ? '#3b82f6' : '#6b7280'}
							stroke-width="2"
							stroke-dasharray={matchedGapText ? '' : '4,4'}
							class="transition-all"
							style="pointer-events: auto; cursor: {disabled ? 'not-allowed' : 'pointer'};"
							ondragover={(e) => handleHotspotDragOver(e, hotspot.identifier)}
							ondragleave={handleHotspotDragLeave}
							ondrop={(e) => handleHotspotDrop(e, hotspot.identifier)}
							onkeydown={(e) => handleHotspotKeyDown(e, hotspot.identifier)}
						/>
					{:else if hotspot.shape === 'rect'}
						{@const [x, y, width, height] = hotspot.coords.split(',').map(Number)}
						{@const hotspotIndex = hotspots.findIndex((h) => h.identifier === hotspot.identifier)}
						<rect
							role="button"
							tabindex={disabled || !keyboardSelectedTextId ? -1 : 0}
							aria-label="Hotspot {hotspotIndex + 1}{matchedGapText && gapTextObj ? '. Contains ' + gapTextObj.text : '. Available'}{keyboardSelectedTextId ? '. Press Space or Enter to place label' : ''}"
							x={x}
							y={y}
							width={width}
							height={height}
							fill={matchedGapText ? '#10b981' : isHovered ? '#3b82f6' : 'transparent'}
							fill-opacity={matchedGapText ? '0.3' : isHovered ? '0.2' : '0'}
							stroke={matchedGapText ? '#10b981' : isHovered ? '#3b82f6' : '#6b7280'}
							stroke-width="2"
							stroke-dasharray={matchedGapText ? '' : '4,4'}
							class="transition-all"
							style="pointer-events: auto; cursor: {disabled ? 'not-allowed' : 'pointer'};"
							ondragover={(e) => handleHotspotDragOver(e, hotspot.identifier)}
							ondragleave={handleHotspotDragLeave}
							ondrop={(e) => handleHotspotDrop(e, hotspot.identifier)}
							onkeydown={(e) => handleHotspotKeyDown(e, hotspot.identifier)}
						/>
					{/if}

					<!-- Label text on hotspot if matched -->
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
					{/if}
				</g>
			{/each}
		</svg>
	</div>
</div>

<style>
	[draggable='true'] {
		touch-action: none;
	}

	/* Ensure SVG fills its container */
	svg {
		width: 100%;
		height: 100%;
		display: block;
	}

</style>
