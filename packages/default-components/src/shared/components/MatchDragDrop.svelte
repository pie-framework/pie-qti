<script lang="ts">
/**
 * Drag-and-drop matching component with keyboard, mouse, and touch support
 * Keyboard: Tab to navigate, Space/Enter to select source, Tab to targets, Space/Enter to match
 * Touch: Touch and drag source items to target drop zones
 */

import type { AssociableChoice } from '@pie-qti/item-player';
import { htmlToString } from '@pie-qti/item-player/security';
import type { I18nProvider } from '@pie-qti/i18n';
import { touchDrag } from '@pie-qti/qti-common';
import { tick } from 'svelte';
import { createOrUpdatePair, getSourceForTarget, getTargetsForSource, removePairBySource } from '../utils/pairHelpers.js';
import { isCompatibleMatchGroup } from '../utils/matchGroupUtils.js';
import DragHandle from './DragHandle.svelte';
import '../styles/shared.css';

interface Props {
	sourceSet: AssociableChoice[];
	targetSet: AssociableChoice[];
	pairs: string[]; // Array of "sourceId targetId" pairs
	maxAssociations?: number; // 0 = unlimited per QTI spec
	correctPairs?: string[]; // Array of correct "sourceId targetId" pairs
	disabled?: boolean;
	i18n?: I18nProvider;
	onPairsChange: (newPairs: string[]) => void;
}

const { sourceSet, targetSet, pairs, maxAssociations = 0, correctPairs = [], disabled = false, i18n, onPairsChange }: Props = $props();

// Targets incompatible with the active source due to matchGroup constraints
const blockedTargetIds = $derived.by(() => {
	const activeSourceId = draggedSourceId ?? selectedSourceId;
	if (!activeSourceId) return new Set<string>();
	const src = sourceSet.find((s) => s.identifier === activeSourceId);
	return new Set(
		targetSet
			.filter((t) => !isCompatibleMatchGroup(src?.matchGroup, t.matchGroup))
			.map((t) => t.identifier)
	);
});

let gridElement = $state<HTMLDivElement>();
let draggedSourceId = $state<string | null>(null);
let selectedSourceId = $state<string | null>(null); // Source selected by pointer or keyboard
let announceText = $state<string>(''); // For screen reader announcements

function choiceLabel(choice: AssociableChoice | null | undefined, fallback = 'Item'): string {
	if (!choice) return fallback;
	if (typeof document !== 'undefined') {
		const template = document.createElement('template');
		template.innerHTML = choice.text as any;
		return (template.content.textContent ?? '').replace(/\s+/g, ' ').trim() || fallback;
	}
	return htmlToString(choice.text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}

// Mouse drag handlers
function handleDragStart(sourceId: string) {
	if (disabled) return;
	draggedSourceId = sourceId;
}

function handleDragOver(event: DragEvent) {
	if (disabled) return;
	event.preventDefault();
}

function handleDrop(event: DragEvent, targetId: string) {
	if (disabled || !draggedSourceId) return;
	event.preventDefault();

	if (blockedTargetIds.has(targetId)) {
		draggedSourceId = null;
		return;
	}


	createMatch(draggedSourceId, targetId);
	draggedSourceId = null;
}

function handleDragEnd() {
	draggedSourceId = null;
}

// Native button activation serves mouse, touch, and Enter/Space equally.
function selectSource(sourceId: string) {
	if (disabled) return;
	selectedSourceId = selectedSourceId === sourceId ? null : sourceId;
	const item = choiceLabel(sourceSet.find((source) => source.identifier === sourceId));
	announceText = selectedSourceId
		? (i18n?.t('interactions.match.selected', { item }) ?? `${item} selected`)
		: (i18n?.t('interactions.match.deselected', { item }) ?? `${item} deselected`);
}

function cancelSelection(event: KeyboardEvent) {
	if (event.key !== 'Escape') return;
	selectedSourceId = null;
	announceText = i18n?.t('common.selectionCancelled') ?? 'Selection cancelled';
}

async function selectTarget(targetId: string) {
	if (disabled || !selectedSourceId) return;
	const sourceId = selectedSourceId;
	if (!createMatch(sourceId, targetId)) return;
	selectedSourceId = null;
	await tick();
	// The target becomes disabled after placement. Return focus to the source
	// instead of dropping keyboard users back to the document body.
	const source = Array.from(gridElement?.querySelectorAll<HTMLButtonElement>('[data-source-id]') ?? [])
		.find((button) => button.dataset.sourceId === sourceId);
	if (source?.isConnected) source.focus();
}

// Enforce the same capacity and compatibility rules for every input method.
function createMatch(sourceId: string, targetId: string): boolean {
	if (disabled) return false;
	const source = sourceSet.find((choice) => choice.identifier === sourceId);
	const target = targetSet.find((choice) => choice.identifier === targetId);
	if (!source || !target || !isCompatibleMatchGroup(source.matchGroup, target.matchGroup)) return false;
	const newPairs = createOrUpdatePair(pairs, sourceId, targetId);
	const sourceCount = getTargetsForSource(newPairs, sourceId).length;
	if ((maxAssociations > 0 && newPairs.length > maxAssociations) ||
		((source.matchMax ?? 1) > 0 && sourceCount > (source.matchMax ?? 1))) {
		announceText = 'Maximum associations reached. Remove a pair to add a new one.';
		return false;
	}
	onPairsChange(newPairs);
	announceText = `${choiceLabel(source)}: ${choiceLabel(target)}`;
	return true;
}

function clearMatch(sourceId: string) {
	if (disabled) return;
	const source = sourceSet.find((s) => s.identifier === sourceId);
	const sourceName = choiceLabel(source);

	const newPairs = removePairBySource(pairs, sourceId);
	onPairsChange(newPairs);

	announceText = `Match cleared for ${sourceName}`;
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{announceText}
</div>

<p class="qti-match-pointer-instructions">{i18n?.t('interactions.match.pointerInstructions') ?? 'Select a source item, then select its target. You can also drag and drop.'}</p>

<!-- Instructions for keyboard users -->
<div id="match-instructions" class="sr-only">
	Press Space or Enter to select a source item. Tab to navigate to targets. Press Space or Enter on a target to create a match. Press Escape to cancel selection.
</div>

<div
	bind:this={gridElement}
	class="qti-match-grid grid grid-cols-2 gap-6"
	part="grid"
	role="region"
	aria-describedby="match-instructions"
>
	<!-- Source Set (Left Column) -->
	<div part="source-column" class="qti-match-col space-y-2" role="group" aria-label={i18n?.t('interactions.match.sourceItemsLabel') ?? 'Source items to match'}>
		<h3 part="source-heading" class="qti-match-heading font-semibold text-sm text-base-content/70 mb-3">
			{i18n?.t('interactions.match.sourceItemsLabel') ?? 'Source items to match'}
		</h3>
		{#each sourceSet as source (source.identifier)}
			{@const sourceLabel = choiceLabel(source)}
			{@const matchedTargets = getTargetsForSource(pairs, source.identifier)}
			{@const targetItems = matchedTargets.map((tid) => targetSet.find((t) => t.identifier === tid)).filter(Boolean)}
			{@const isSelected = selectedSourceId === source.identifier}
			{@const correctTargets = getTargetsForSource(correctPairs, source.identifier)}
			{@const isCorrect = correctTargets.length > 0}
			{@const canDragMore = source.matchMax === 0 || matchedTargets.length < (source.matchMax ?? 1)}

			<div class="qti-match-source-wrapper relative">
				<button
					type="button"
					draggable={!disabled && canDragMore}
					use:touchDrag
					ondragstart={() => handleDragStart(source.identifier)}
					ondragend={handleDragEnd}
					onclick={() => selectSource(source.identifier)}
					onkeydown={cancelSelection}
					disabled={disabled}
					aria-label="{sourceLabel}{targetItems.length ? '. Matched with ' + targetItems.map((target) => choiceLabel(target, 'Target')).join(', ') : ''}{isSelected ? '. Selected for matching' : ''}{isCorrect ? '. Correct answer' : ''}"
					aria-pressed={isSelected}
					data-matched={matchedTargets.length > 0}
					data-selected={isSelected}
					data-correct={isCorrect}
					data-dragging={draggedSourceId === source.identifier}
					part="source-item"
					data-source-id={source.identifier}
					class="qti-match-source p-3 rounded-lg border-2 transition-all w-full"
					class:bg-base-200={matchedTargets.length === 0 && !isSelected && !isCorrect}
					class:bg-success={matchedTargets.length > 0 || isCorrect}
					class:bg-primary={isSelected}
					class:bg-opacity-20={matchedTargets.length > 0 || isSelected || isCorrect}
					class:border-base-300={matchedTargets.length === 0 && !isSelected && !isCorrect}
					class:border-success={matchedTargets.length > 0 || isCorrect}
					class:border-primary={isSelected}
					class:ring-2={isSelected}
					class:ring-primary={isSelected}
					class:cursor-grab={!disabled && canDragMore && !isSelected}
					class:cursor-not-allowed={disabled}
					class:opacity-50={disabled || draggedSourceId === source.identifier}
				>
					<div class="qti-match-source-content flex items-center justify-between gap-2">
						<div class="qti-match-source-text flex-1">
							<div class="qti-match-source-title qti-rich-inline-content font-medium">{@html source.text}</div>
							{#if targetItems.length > 0}
								<div class="qti-match-source-sub text-sm mt-1">→ {targetItems.map((target) => choiceLabel(target, 'Target')).join(', ')}</div>
							{:else if isCorrect && correctTargets.length > 0}
								{@const correctTargetItems = correctTargets.map((tid) => targetSet.find((t) => t.identifier === tid)).filter(Boolean)}
								{#if correctTargetItems.length > 0}
									<div class="qti-match-source-sub text-sm mt-1">→ {correctTargetItems.map((target) => choiceLabel(target, 'Target')).join(', ')}</div>
								{/if}
							{/if}
							{#if isCorrect && matchedTargets.length === 0}
								<span class="badge badge-success badge-sm ml-2">{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}</span>
							{/if}
						</div>
						{#if !disabled && canDragMore}
							<DragHandle size={1.25} opacity={0.3} class="text-base-content" />
						{/if}
					</div>
				</button>
				{#if matchedTargets.length > 0 && !disabled}
					<button
						type="button"
						part="source-clear"
						class="qti-match-clear btn btn-xs btn-ghost absolute top-2 right-2"
						onclick={() => clearMatch(source.identifier)}
						aria-label="Clear match for {sourceLabel}"
					>
						✕
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Target Set (Right Column) - Drop Zones -->
	<div part="target-column" class="qti-match-col space-y-2" role="group" aria-label={i18n?.t('interactions.match.targetItemsLabel') ?? 'Target items for matching'}>
		<h3 part="target-heading" class="qti-match-heading font-semibold text-sm text-base-content/70 mb-3">
			{i18n?.t('interactions.match.targetItemsLabel') ?? 'Target items for matching'}
		</h3>
		{#each targetSet as target (target.identifier)}
			{@const targetLabel = choiceLabel(target, 'Target')}
			{@const matchedSource = getSourceForTarget(pairs, target.identifier)}
			{@const sourceItem = matchedSource ? sourceSet.find((s) => s.identifier === matchedSource) : null}
			{@const isHighlight = (draggedSourceId && !matchedSource) || (selectedSourceId && !matchedSource)}
			{@const correctSource = getSourceForTarget(correctPairs, target.identifier)}
			{@const isCorrect = correctSource !== null}
			{@const isBlocked = blockedTargetIds.has(target.identifier)}

			<button
				type="button"
				ondragover={handleDragOver}
				ondrop={(e) => handleDrop(e, target.identifier)}
				onclick={() => selectTarget(target.identifier)}
				onkeydown={cancelSelection}
				disabled={disabled || (!selectedSourceId && !draggedSourceId)}
				aria-disabled={isBlocked ? 'true' : undefined}
				aria-label="{targetLabel}{matchedSource && sourceItem ? '. Matched with ' + choiceLabel(sourceItem) : '. Available for matching'}{isCorrect ? '. Correct answer' : ''}{isBlocked ? '. Not compatible with selected source' : ''}"
				data-matched={!!matchedSource}
				data-highlight={isHighlight}
				data-correct={isCorrect}
				part="target"
				class="qti-match-target p-3 rounded-lg border-2 border-dashed min-h-[60px] transition-all"
				class:bg-base-100={!matchedSource && !isCorrect}
				class:bg-primary={matchedSource}
				class:bg-success={isCorrect && !matchedSource}
				class:bg-opacity-10={matchedSource}
				class:bg-opacity-20={isCorrect && !matchedSource}
				class:border-base-300={!matchedSource && !isCorrect}
				class:border-primary={matchedSource}
				class:border-success={isCorrect && !matchedSource}
				class:border-accent={draggedSourceId && !matchedSource || (selectedSourceId && !matchedSource)}
				class:bg-accent={draggedSourceId && !matchedSource || (selectedSourceId && !matchedSource)}
				class:bg-opacity-5={draggedSourceId && !matchedSource || (selectedSourceId && !matchedSource)}
				class:opacity-40={isBlocked}
				class:cursor-not-allowed={isBlocked}
			>
				<div class="qti-match-target-content flex flex-col gap-1">
					<div class="qti-match-target-title qti-rich-inline-content font-medium text-base-content/70">{@html target.text}</div>
					{#if matchedSource && sourceItem}
						<div class="qti-match-target-sub text-sm text-primary font-medium">← {choiceLabel(sourceItem)}</div>
					{:else if isCorrect && correctSource}
						{@const correctSourceItem = sourceSet.find((s) => s.identifier === correctSource)}
						{#if correctSourceItem}
							<div class="qti-match-target-sub text-sm text-success font-medium">← {choiceLabel(correctSourceItem)}</div>
						{/if}
					{:else if !disabled}
						<div class="qti-match-target-hint text-xs text-base-content/70 italic">
							{selectedSourceId
								? (i18n?.t('interactions.match.selectTarget') ?? 'Select to match')
								: (i18n?.t('interactions.match.dropTarget') ?? 'Drop item here')}
						</div>
					{/if}
					{#if isCorrect && !matchedSource}
						<span class="badge badge-success badge-sm mt-1">{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}</span>
					{/if}
				</div>
			</button>
		{/each}
	</div>
</div>

<style>
	[draggable="true"] {
		touch-action: none;
	}

	/* Minimal, self-contained layout so the component doesn't break when Tailwind utilities aren't present */
	.qti-match-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}
	@media (max-width: 640px) {
		.qti-match-grid {
			grid-template-columns: 1fr;
		}
	}
	.qti-match-col {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
	.qti-match-heading {
		margin: 0 0 0.75rem;
		font-weight: 600;
		font-size: 0.875rem;
		color: color-mix(
			in oklch,
			var(--pie-qti-base-content, oklch(21% 0 0)) 70%,
			transparent
		);
	}

	.qti-match-source-wrapper {
		position: relative;
	}
	.qti-match-source {
		display: block;
		width: 100%;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		text-align: left;
		user-select: none;
		transition: background-color 120ms ease, border-color 120ms ease, outline-color 120ms ease,
			opacity 120ms ease;
	}
	.qti-match-source:focus-visible {
		outline: 2px solid var(--pie-qti-primary, oklch(45% 0.24 277));
		outline-offset: 2px;
	}
	.qti-match-source[data-selected='true'] {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 8%, transparent);
	}
	.qti-match-source[data-matched='true'],
	.qti-match-source[data-correct='true'] {
		border-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 8%, transparent);
	}
	.qti-match-source[data-dragging='true'] {
		opacity: 0.55;
	}

	.qti-match-source-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.qti-match-source-text {
		flex: 1 1 auto;
		min-width: 0;
	}
	.qti-match-source-title {
		font-weight: 600;
	}
	.qti-match-source-sub {
		margin-top: 0.25rem;
		font-size: 0.875rem;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.qti-match-clear {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 1.5rem;
		height: 1.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.375rem;
		border: 1px solid transparent;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.qti-match-clear:hover {
		background: color-mix(in oklch, var(--pie-qti-base-300, oklch(95% 0 0)) 35%, transparent);
	}

	.qti-match-target {
		width: 100%;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 2px dashed var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		text-align: left;
		min-height: 60px;
		transition: background-color 120ms ease, border-color 120ms ease, outline-color 120ms ease,
			opacity 120ms ease;
	}
	.qti-match-target:focus-visible {
		outline: 2px solid var(--pie-qti-primary, oklch(45% 0.24 277));
		outline-offset: 2px;
	}
	.qti-match-target[data-matched='true'] {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 6%, transparent);
	}
	.qti-match-target[data-correct='true'] {
		border-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 8%, transparent);
	}
	.qti-match-target[data-highlight='true'] {
		border-color: var(--pie-qti-accent, oklch(77% 0.152 181.912));
		background: color-mix(in oklch, var(--pie-qti-accent, oklch(77% 0.152 181.912)) 6%, transparent);
	}
	.qti-match-target:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.qti-match-target-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.qti-match-target-title {
		font-weight: 600;
		color: color-mix(
			in oklch,
			var(--pie-qti-base-content, oklch(21% 0 0)) 70%,
			transparent
		);
	}
	.qti-match-target-sub {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--pie-qti-primary, oklch(45% 0.24 277));
	}
	.qti-match-target-hint {
		font-size: 0.75rem;
		font-style: italic;
		color: color-mix(
			in oklch,
			var(--pie-qti-base-content, oklch(21% 0 0)) 70%,
			transparent
		);
	}
</style>
