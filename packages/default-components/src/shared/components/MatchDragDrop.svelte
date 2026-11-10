<script lang="ts">
/**
 * Drag-and-drop matching component with keyboard, mouse, and touch support
 * Keyboard: Tab to navigate, Space/Enter to select source, Tab to targets, Space/Enter to match
 * Touch: Touch and drag source items to target drop zones
 */

import type { AssociableChoice } from '@pie-qti/item-player';
import { formatList, joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
import { touchDrag } from '@pie-qti/qti-common';
import { tick } from 'svelte';
import { accessibleTextFromHtml } from '../utils/accessibleText.js';
import { exceedsLimit, isAtLimit } from '../utils/capacity.js';
import { choiceAccessibleName } from '../utils/choiceName.js';
import { createOrUpdatePair, getSourceForTarget, getTargetsForSource, removePairBySource } from '../utils/pairHelpers.js';
import { isCompatibleMatchGroup, matchGroupBlockedIds } from '../utils/matchGroupUtils.js';
import DragHandle from './DragHandle.svelte';
import { createPickUpPlace } from './pickUpPlace.svelte';
import '../styles/shared.css';

interface Props {
	sourceSet: AssociableChoice[];
	targetSet: AssociableChoice[];
	pairs: string[]; // Array of "sourceId targetId" pairs
	maxAssociations?: number; // 0 = unlimited per QTI spec
	correctPairs?: string[]; // Array of correct "sourceId targetId" pairs
	disabled?: boolean;
	i18n?: I18nProvider;
	/** PNP structured labels: name each column by its visible heading instead of a hidden label (G-13). */
	structuredLabels?: boolean;
	/** Id(s) of more descriptions for the matching region, such as the unmet-minimum hint. */
	describedBy?: string;
	onPairsChange: (newPairs: string[]) => void;
}

const { sourceSet, targetSet, pairs, maxAssociations = 0, correctPairs = [], disabled = false, i18n, structuredLabels = false, describedBy, onPairsChange }: Props = $props();

// The source selected by pointer or keyboard (held), and the source a pointer drag carries.
const pickUp = createPickUpPlace();

// Targets incompatible with the active source due to matchGroup constraints
const blockedTargetIds = $derived.by(() => {
	const activeSourceId = pickUp.active;
	if (!activeSourceId) return new Set<string>();
	return matchGroupBlockedIds(
		sourceSet.find((s) => s.identifier === activeSourceId),
		targetSet,
	);
});

let gridElement = $state<HTMLDivElement>();
let announceText = $state<string>(''); // For screen reader announcements

// Unique id prefix so aria-labelledby/describedby survive several interactions in one document.
const uid = $props.id();
const instructionsId = `${uid}-match-instructions`;
const sourceHeadingId = `${uid}-source-heading`;
const targetHeadingId = `${uid}-target-heading`;

// 1-based position of each choice in its column as presented to the candidate (after
// shuffle): the localized-ordinal name of a choice whose content carries no text.
const choicePositions = $derived.by(() => {
	const positions = new Map<object, number>();
	sourceSet.forEach((choice, index) => positions.set(choice, index + 1));
	targetSet.forEach((choice, index) => positions.set(choice, index + 1));
	return positions;
});

/** Whether the choice's content carries readable text (text, image alt, MathML alttext). */
function hasAuthoredLabel(choice: AssociableChoice | null | undefined): boolean {
	return !!choice && accessibleTextFromHtml(choice.text) !== '';
}

function choiceLabel(choice: AssociableChoice | null | undefined): string {
	if (!choice) return '';
	// The authored label (image alt, MathML alttext participate); a content-less
	// choice is named by a localized ordinal of its presented position — never the
	// identifier, which is meaningless and potentially answer-leaking to candidates.
	return choiceAccessibleName({
		i18n,
		label: accessibleTextFromHtml(choice.text),
		position: choicePositions.get(choice) ?? 0,
	});
}

// Mouse drag handlers
function handleDragStart(sourceId: string) {
	if (disabled) return;
	pickUp.startDrag(sourceId);
}

function handleDragOver(event: DragEvent) {
	if (disabled) return;
	event.preventDefault();
}

function handleDrop(event: DragEvent, targetId: string) {
	const draggedSourceId = pickUp.dragged;
	if (disabled || !draggedSourceId) return;
	event.preventDefault();

	if (blockedTargetIds.has(targetId)) {
		pickUp.endDrag();
		return;
	}


	createMatch(draggedSourceId, targetId);
	pickUp.endDrag();
}

function handleDragEnd() {
	pickUp.endDrag();
}

// Native button activation serves mouse, touch, and Enter/Space equally.
function selectSource(sourceId: string) {
	if (disabled) return;
	pickUp.toggle(sourceId);
	const item = choiceLabel(sourceSet.find((source) => source.identifier === sourceId));
	announceText = pickUp.held
		? (i18n?.t('interactions.match.selected', { item }) ?? `${item} selected`)
		: (i18n?.t('interactions.match.deselected', { item }) ?? `${item} deselected`);
}

// Escape cancels a held/selected source and returns focus to it: after the
// selection clears, the targets disable again and would otherwise swallow focus.
function cancelSelection(event: KeyboardEvent) {
	const sourceId = pickUp.held;
	if (event.key !== 'Escape' || !sourceId) return;
	event.preventDefault();
	const item = choiceLabel(sourceSet.find((source) => source.identifier === sourceId));
	pickUp.release();
	announceText = translate(i18n, 'interactions.match.selectionCancelledItem', 'Selection of {item} cancelled.', { item });
	void tick().then(() => {
		const source = Array.from(gridElement?.querySelectorAll<HTMLButtonElement>('[data-source-id]') ?? [])
			.find((button) => button.dataset.sourceId === sourceId);
		if (source?.isConnected) source.focus();
	});
}

async function selectTarget(targetId: string) {
	if (disabled || !pickUp.held) return;
	// A refused match keeps the source selected; a match puts it down.
	const sourceId = pickUp.place(targetId, createMatch);
	if (sourceId === null) return;
	await tick();
	// The target becomes disabled after placement. Return focus to the source
	// instead of dropping keyboard users back to the document body.
	const source = Array.from(gridElement?.querySelectorAll<HTMLButtonElement>('[data-source-id]') ?? [])
		.find((button) => button.dataset.sourceId === sourceId);
	if (source?.isConnected) source.focus();
}

/**
 * Announce a refusal. Repeating the same refused attempt would leave the live text
 * unchanged, which assistive technology does not announce, so a repeat toggles a
 * trailing zero-width space (silent to screen readers) to make it a change.
 */
function announceRefusal(message: string) {
	announceText = announceText === message ? `${message}\u200b` : message;
}

// Enforce the same capacity and compatibility rules for every input method.
function createMatch(sourceId: string, targetId: string): boolean {
	if (disabled) return false;
	const source = sourceSet.find((choice) => choice.identifier === sourceId);
	const target = targetSet.find((choice) => choice.identifier === targetId);
	if (!source || !target || !isCompatibleMatchGroup(source, target)) return false;
	const newPairs = createOrUpdatePair(pairs, sourceId, targetId);
	const sourceCount = getTargetsForSource(newPairs, sourceId).length;
	const matchMax = source.matchMax ?? 1;
	// The two caps are refused separately and named (WCAG 3.3.1): the interaction's
	// maxAssociations names the limit, the source's own matchMax names the choice.
	if (exceedsLimit(newPairs.length, maxAssociations)) {
		announceRefusal(translate(i18n, 'interactions.match.associationLimitReached', 'Association not possible: the limit of {max} is reached.', { max: maxAssociations }));
		return false;
	}
	if (exceedsLimit(sourceCount, matchMax)) {
		announceRefusal(
			translate(i18n, 'interactions.match.sourceLimitReached', 'Not possible: {label} cannot be in more associations.', {
				label: choiceLabel(source),
			}),
		);
		return false;
	}
	onPairsChange(newPairs);
	announceText = translate(i18n, 'interactions.match.pairCreated', '{source} matched with {target}.', {
		source: choiceLabel(source),
		target: choiceLabel(target),
	});
	return true;
}

async function clearMatch(sourceId: string) {
	if (disabled) return;
	const source = sourceSet.find((s) => s.identifier === sourceId);
	const sourceName = choiceLabel(source);

	const newPairs = removePairBySource(pairs, sourceId);
	onPairsChange(newPairs);

	announceText = translate(i18n, 'interactions.match.matchCleared', 'Match cleared for {item}', { item: sourceName });

	// The clear button is removed with the match, which would drop keyboard focus to
	// the document. Focus returns to the now-enabled source button instead.
	await tick();
	const sourceButton = Array.from(gridElement?.querySelectorAll<HTMLButtonElement>('[data-source-id]') ?? []).find(
		(button) => button.dataset.sourceId === sourceId,
	);
	if (sourceButton?.isConnected) sourceButton.focus();
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{announceText}
</div>

<p class="qti-match-pointer-instructions">{i18n?.t('interactions.match.pointerInstructions') ?? 'Select a source item, then select its target. You can also drag and drop.'}</p>

<!-- Instructions for keyboard users -->
<div id={instructionsId} class="sr-only">
	{translate(i18n, 'interactions.match.keyboardInstructions', 'Press Space or Enter to select a source item. Tab to navigate to targets. Press Space or Enter on a target to create a match. Press Escape to cancel selection.')}
</div>

<div
	bind:this={gridElement}
	class="qti-match-grid grid grid-cols-2 gap-6"
	part="grid"
	role="region"
	aria-describedby={describedBy ? `${instructionsId} ${describedBy}` : instructionsId}
>
	<!-- Source Set (Left Column) -->
	<div
		part="source-column"
		class="qti-match-col space-y-2"
		role="group"
		aria-labelledby={structuredLabels ? sourceHeadingId : undefined}
		aria-label={structuredLabels ? undefined : (i18n?.t('interactions.match.sourceItemsLabel') ?? 'Source items to match')}
	>
		<h3 id={sourceHeadingId} part="source-heading" class="qti-match-heading font-semibold text-sm text-base-content/70 mb-3">
			{i18n?.t('interactions.match.sourceItemsLabel') ?? 'Source items to match'}
		</h3>
		{#each sourceSet as source (source.identifier)}
			{@const sourceLabel = choiceLabel(source)}
			{@const sourceHasLabel = hasAuthoredLabel(source)}
			{@const matchedTargets = getTargetsForSource(pairs, source.identifier)}
			{@const targetItems = matchedTargets.map((tid) => targetSet.find((t) => t.identifier === tid)).filter(Boolean)}
			{@const isSelected = pickUp.isHeld(source.identifier)}
			{@const correctTargets = getTargetsForSource(correctPairs, source.identifier)}
			{@const isCorrect = correctTargets.length > 0}
			{@const canDragMore = !isAtLimit(matchedTargets.length, source.matchMax ?? 1)}
			{@const sourceTextId = `${uid}-source-${source.identifier}-text`}
			{@const sourceStateId = `${uid}-source-${source.identifier}-state`}

			<div class="qti-match-source-wrapper relative">
				<!-- A source with no readable content (an image without alt) is named by its
				     ordinal, never left nameless. -->
				<button
					type="button"
					draggable={!disabled && canDragMore}
					use:touchDrag
					ondragstart={() => handleDragStart(source.identifier)}
					ondragend={handleDragEnd}
					onclick={() => selectSource(source.identifier)}
					onkeydown={cancelSelection}
					disabled={disabled}
					aria-labelledby={sourceHasLabel ? sourceTextId : undefined}
					aria-label={sourceHasLabel ? undefined : sourceLabel}
					aria-describedby={sourceStateId}
					aria-pressed={isSelected}
					data-matched={matchedTargets.length > 0}
					data-selected={isSelected}
					data-correct={isCorrect}
					data-dragging={pickUp.dragged === source.identifier}
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
					class:opacity-50={disabled || pickUp.dragged === source.identifier}
				>
					<div class="qti-match-source-content flex items-center justify-between gap-2">
						<div class="qti-match-source-text flex-1">
							<!-- The name source: image alt and MathML participate in name computation here. -->
							<div id={sourceTextId} class="qti-match-source-title qti-rich-inline-content font-medium">{@html source.text}</div>
							{#if targetItems.length > 0}
								<div aria-hidden="true" data-text="→ {targetItems.map((target) => choiceLabel(target)).join(', ')}" class="qti-match-source-sub text-sm mt-1"></div>
							{:else if isCorrect && correctTargets.length > 0}
								{@const correctTargetItems = correctTargets.map((tid) => targetSet.find((t) => t.identifier === tid)).filter(Boolean)}
								{#if correctTargetItems.length > 0}
									<div aria-hidden="true" data-text="→ {correctTargetItems.map((target) => choiceLabel(target)).join(', ')}" class="qti-match-source-sub text-sm mt-1"></div>
								{/if}
							{/if}
							{#if isCorrect && matchedTargets.length === 0}
								<span aria-hidden="true" data-text="{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}" class="badge badge-success badge-sm ms-2"></span>
							{/if}
						</div>
						{#if !disabled && canDragMore}
							<DragHandle size={1.25} opacity={0.3} class="text-base-content" />
						{/if}
					</div>
				</button>
				<span id={sourceStateId} class="sr-only">
					{joinSentences(
						targetItems.length > 0 &&
							translate(i18n, 'interactions.match.matchedWithSentence', 'Matched with {targets}.', {
								targets: formatList(i18n, targetItems.map((target) => choiceLabel(target))),
							}),
						isSelected && translate(i18n, 'interactions.match.selectedForMatchingSentence', 'Selected for matching.'),
						isCorrect && translate(i18n, 'accessibility.correctAnswer', 'Correct answer.'),
					)}
				</span>
				{#if matchedTargets.length > 0 && !disabled}
					<button
						type="button"
						part="source-clear"
						class="qti-match-clear btn btn-xs btn-ghost absolute top-2 end-2"
						onclick={() => clearMatch(source.identifier)}
						aria-label={translate(i18n, 'interactions.match.clearMatch', 'Clear match for {source}', { source: sourceLabel })}
					>
						✕
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Target Set (Right Column) - Drop Zones -->
	<div
		part="target-column"
		class="qti-match-col space-y-2"
		role="group"
		aria-labelledby={structuredLabels ? targetHeadingId : undefined}
		aria-label={structuredLabels ? undefined : (i18n?.t('interactions.match.targetItemsLabel') ?? 'Target items for matching')}
	>
		<h3 id={targetHeadingId} part="target-heading" class="qti-match-heading font-semibold text-sm text-base-content/70 mb-3">
			{i18n?.t('interactions.match.targetItemsLabel') ?? 'Target items for matching'}
		</h3>
		{#each targetSet as target (target.identifier)}
			{@const targetHasLabel = hasAuthoredLabel(target)}
			{@const matchedSource = getSourceForTarget(pairs, target.identifier)}
			{@const sourceItem = matchedSource ? sourceSet.find((s) => s.identifier === matchedSource) : null}
			{@const isHighlight = (pickUp.dragged && !matchedSource) || (pickUp.held && !matchedSource)}
			{@const correctSource = getSourceForTarget(correctPairs, target.identifier)}
			{@const isCorrect = correctSource !== null}
			{@const isBlocked = blockedTargetIds.has(target.identifier)}
			{@const targetTextId = `${uid}-target-${target.identifier}-text`}
			{@const targetStateId = `${uid}-target-${target.identifier}-state`}

			<!-- A target with no readable content (an image without alt) is named by its
			     ordinal, never left nameless. -->
			<button
				type="button"
				ondragover={handleDragOver}
				ondrop={(e) => handleDrop(e, target.identifier)}
				onclick={() => selectTarget(target.identifier)}
				onkeydown={cancelSelection}
				disabled={disabled || (!pickUp.held && !pickUp.dragged)}
				aria-disabled={isBlocked ? 'true' : undefined}
				aria-labelledby={targetHasLabel ? targetTextId : undefined}
				aria-label={targetHasLabel ? undefined : choiceLabel(target)}
				aria-describedby={targetStateId}
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
				class:border-accent={pickUp.dragged && !matchedSource || (pickUp.held && !matchedSource)}
				class:bg-accent={pickUp.dragged && !matchedSource || (pickUp.held && !matchedSource)}
				class:bg-opacity-5={pickUp.dragged && !matchedSource || (pickUp.held && !matchedSource)}
				class:opacity-40={isBlocked}
				class:cursor-not-allowed={isBlocked}
			>
				<div class="qti-match-target-content flex flex-col gap-1">
					<!-- The name source: image alt and MathML participate in name computation here. -->
					<div id={targetTextId} class="qti-match-target-title qti-rich-inline-content font-medium text-base-content/70">{@html target.text}</div>
					{#if matchedSource && sourceItem}
						<div aria-hidden="true" data-text="← {choiceLabel(sourceItem)}" class="qti-match-target-sub text-sm text-primary font-medium"></div>
					{:else if isCorrect && correctSource}
						{@const correctSourceItem = sourceSet.find((s) => s.identifier === correctSource)}
						{#if correctSourceItem}
							<div aria-hidden="true" data-text="← {choiceLabel(correctSourceItem)}" class="qti-match-target-sub text-sm text-success font-medium"></div>
						{/if}
					{:else if !disabled}
						<div
							aria-hidden="true"
							data-text={pickUp.held
								? (i18n?.t('interactions.match.selectTarget') ?? 'Select to match')
								: (i18n?.t('interactions.match.dropTarget') ?? 'Drop item here')}
							class="qti-match-target-hint text-xs text-base-content/70 italic"
						></div>
					{/if}
					{#if isCorrect && !matchedSource}
						<span aria-hidden="true" data-text="{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}" class="badge badge-success badge-sm mt-1"></span>
					{/if}
				</div>
				<span id={targetStateId} class="sr-only">
					{joinSentences(
						matchedSource && sourceItem
							? translate(i18n, 'interactions.match.matchedWithSentence', 'Matched with {targets}.', { targets: choiceLabel(sourceItem) })
							: translate(i18n, 'interactions.match.availableForMatchingSentence', 'Available for matching.'),
						isCorrect && translate(i18n, 'accessibility.correctAnswer', 'Correct answer.'),
						isBlocked && translate(i18n, 'interactions.match.notCompatibleSentence', 'Not compatible with the selected source.'),
					)}
				</span>
			</button>
		{/each}
	</div>
</div>

<style>
	/* Redundant with the button's aria-label; generated so the visible text stays out of the DOM's label-in-name comparison. */
	[data-text]::before {
		content: attr(data-text);
	}

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
		text-align: start;
		user-select: none;
		transition: background-color 120ms ease, border-color 120ms ease, outline-color 120ms ease,
			opacity 120ms ease;
	}
	.qti-match-source:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
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

	/* K-12 target size (WCAG 2.5.8 minimum 24px; primary controls aim at 44px). */
	.qti-match-clear {
		position: absolute;
		top: 0.5rem;
		inset-inline-end: 0.5rem;
		width: 2.75rem;
		height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.375rem;
		border: 1px solid transparent;
		background: transparent;
		color: inherit;
		font-size: 1rem;
		cursor: pointer;
	}
	.qti-match-clear:hover {
		background: color-mix(in oklch, var(--pie-qti-base-300, oklch(95% 0 0)) 35%, transparent);
	}
	.qti-match-clear:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.qti-match-target {
		width: 100%;
		padding: 0.75rem;
		border-radius: 0.5rem;
		/* 1.4.11: an empty drop zone's boundary is a control boundary and needs 3:1,
		   which base-300 cannot provide on the page background. */
		border: 2px dashed var(--pie-qti-border-strong, #767676);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		text-align: start;
		min-height: 60px;
		transition: background-color 120ms ease, border-color 120ms ease, outline-color 120ms ease,
			opacity 120ms ease;
	}
	.qti-match-target:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
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
