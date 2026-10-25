<script lang="ts">
/**
 * Graphic Gap Match component for graphicGapMatchInteraction
 * Drag labels onto specific areas of an image/diagram
 * Supports keyboard, mouse, and touch interactions
 */

import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
import type { GraphicGapMatchInteractionData } from '@pie-qti/item-player';
import { touchDrag } from '@pie-qti/qti-common';
import { createOrUpdatePair, getSourceForTarget, getTargetForSource, removePairBySource } from '../utils/pairHelpers.js';
import '../styles/shared.css';

interface GapText {
	identifier: string;
	text: string;
	matchMax: number;
}

type Hotspot = GraphicGapMatchInteractionData['hotspots'][number];

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

function labelFallback(): string {
	return translate(i18n, 'interactions.graphicGapMatch.labelFallback', 'Label');
}

/** Accessible name of a hotspot: its number and contents, then the drop hint while a label is selected. */
function hotspotAriaLabel(number: number, contains: string | undefined, labelSelected: boolean): string {
	return joinSentences(
		contains
			? translate(i18n, 'interactions.graphicGapMatch.hotspotContains', 'Hotspot {number}. Contains {label}.', { number, label: contains })
			: translate(i18n, 'interactions.graphicGapMatch.hotspotAvailable', 'Hotspot {number}. Available.', { number }),
		labelSelected && translate(i18n, 'interactions.graphicGapMatch.placeLabelHint', 'Press Space or Enter to place the label.'),
	);
}

let draggedTextId = $state<string | null>(null);
let hoveredHotspotId = $state<string | null>(null);
let selectedTextId = $state<string | null>(null); // Gap text selected via keyboard
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
	const gapTextName = gapTextObj?.text || labelFallback();

	const newPairs = removePairBySource(pairs, gapTextId);
	onPairsChange(newPairs);

	announceText = translate(i18n, 'interactions.graphicGapMatch.labelRemoved', '{label} removed from hotspot.', { label: gapTextName });
}

function selectLabel(gapTextId: string) {
	if (disabled || getTargetForSource(pairs, gapTextId)) return;
	selectedTextId = selectedTextId === gapTextId ? null : gapTextId;
	const item = gapTexts.find((label) => label.identifier === gapTextId)?.text ?? labelFallback();
	announceText = selectedTextId
		? (i18n?.t('interactions.match.selected', { item }) ?? `${item} selected`)
		: (i18n?.t('common.selectionCancelled') ?? 'Selection cancelled');
}

function cancelSelection(event: KeyboardEvent) {
	if (event.key !== 'Escape') return;
	selectedTextId = null;
	announceText = i18n?.t('common.selectionCancelled') ?? 'Selection cancelled';
}

function selectHotspot(hotspotId: string) {
	if (disabled || !selectedTextId) return;
	const label = gapTexts.find((entry) => entry.identifier === selectedTextId)?.text ?? labelFallback();
	onPairsChange(createOrUpdatePair(pairs, selectedTextId, hotspotId));
	announceText = translate(i18n, 'interactions.graphicGapMatch.labelPlaced', '{label} placed on hotspot {hotspot}', {
		label,
		hotspot: hotspots.findIndex((entry) => entry.identifier === hotspotId) + 1,
	});
	selectedTextId = null;
}

// SVG buttons need explicit keyboard activation; native label buttons do not.
function handleHotspotKeyDown(event: KeyboardEvent, hotspotId: string) {
	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();
		selectHotspot(hotspotId);
	} else cancelSelection(event);
}

// Parse coords based on shape
function parseCoords(hotspot: Hotspot): { x: number; y: number; width: number; height: number } {
	const coords = hotspot.coords.split(',').map(Number);
	if (hotspot.shape === 'circle') {
		const [cx, cy, r] = coords;
		return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
	} else if (hotspot.shape === 'rect') {
		const [x, y, right, bottom] = coords;
		return { x, y, width: right - x, height: bottom - y };
	}
	// For poly, use bounding box (simplified)
	return { x: coords[0], y: coords[1], width: 40, height: 40 };
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{announceText}
</div>

<p>{i18n?.t('interactions.graphicGapMatch.pointerInstructions') ?? 'Select a label, then select a hotspot on the image. You can also drag and drop.'}</p>

<!-- Instructions for keyboard users -->
<div id="graphic-gap-match-instructions" class="sr-only">
	{translate(
		i18n,
		'interactions.graphicGapMatch.keyboardInstructions',
		'Press Space or Enter to select a label. Tab to navigate to hotspots on the image. Press Space or Enter on a hotspot to place the label. Press Escape to cancel selection.',
	)}
</div>

<div class="space-y-4" role="region" aria-describedby="graphic-gap-match-instructions">
	<!-- Draggable gap texts (labels) -->
	<div class="flex flex-wrap gap-2 p-4 bg-base-200 rounded-lg border-2 border-base-300" role="group" aria-label={i18n?.t('interactions.graphicGapMatch.availableLabel') ?? 'Available labels to place'}>
		<div class="w-full text-sm text-base-content/70 font-semibold mb-2">{i18n?.t('interactions.graphicGapMatch.availableHeading') ?? 'Available Labels:'}</div>
		{#each gapTexts as gapText (gapText.identifier)}
			{@const matchedHotspot = getTargetForSource(pairs, gapText.identifier)}
			{@const isDragged = draggedTextId === gapText.identifier}
			{@const isSelected = selectedTextId === gapText.identifier}

			<div class="inline-flex items-center gap-1">
				<button
					type="button"
					draggable={!disabled && !matchedHotspot}
					use:touchDrag
					ondragstart={() => handleDragStart(gapText.identifier)}
					ondragend={handleDragEnd}
					onclick={() => selectLabel(gapText.identifier)}
					onkeydown={cancelSelection}
					disabled={disabled || !!matchedHotspot}
					aria-pressed={isSelected}
					aria-label={joinSentences(
						translate(i18n, 'accessibility.sentence', '{text}.', { text: gapText.text }),
						!!matchedHotspot && translate(i18n, 'interactions.graphicGapMatch.alreadyPlacedSentence', 'Already placed on a hotspot.'),
						isSelected
							? translate(i18n, 'interactions.graphicGapMatch.selectedHint', 'Selected for placement.')
							: translate(i18n, 'interactions.graphicGapMatch.selectHint', 'Press Space to select.'),
					)}
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
						aria-label={translate(i18n, 'interactions.graphicGapMatch.removeFromHotspot', 'Remove {label} from hotspot', { label: gapText.text })}
						title={i18n?.t('interactions.graphicGapMatch.removeLabel') ?? 'Remove label'}
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
							tabindex={disabled || !selectedTextId ? -1 : 0}
							aria-label={hotspotAriaLabel(hotspotIndex + 1, matchedGapText ? gapTextObj?.text : undefined, !!selectedTextId)}
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
							onclick={() => selectHotspot(hotspot.identifier)}
							onkeydown={(e) => handleHotspotKeyDown(e, hotspot.identifier)}
						/>
					{:else if hotspot.shape === 'rect'}
						{@const [x, y, right, bottom] = hotspot.coords.split(',').map(Number)}
						{@const width = right - x}
						{@const height = bottom - y}
						{@const hotspotIndex = hotspots.findIndex((h) => h.identifier === hotspot.identifier)}
						<rect
							role="button"
							tabindex={disabled || !selectedTextId ? -1 : 0}
							aria-label={hotspotAriaLabel(hotspotIndex + 1, matchedGapText ? gapTextObj?.text : undefined, !!selectedTextId)}
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
							onclick={() => selectHotspot(hotspot.identifier)}
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
