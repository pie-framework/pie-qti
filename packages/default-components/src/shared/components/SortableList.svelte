<script lang="ts" module>
export type SortableIndexLabels = 'decimal' | 'lower-alpha' | 'upper-alpha' | 'none';
</script>

<script lang="ts">
/**
 * Sortable list component with keyboard, mouse, and touch support
 * Accessible via drag-and-drop, keyboard (Space/Enter to grab, arrow keys to move), or touch
 */

import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
import type { HtmlContent } from '@pie-qti/item-player';
import { touchDrag } from '@pie-qti/qti-common';
import { tick, type Snippet } from 'svelte';
import { accessibleTextFromHtml } from '../utils/accessibleText.js';
import DragHandle from './DragHandle.svelte';
import { createPickUpPlace } from './pickUpPlace.svelte';
import '../styles/shared.css';

interface Item {
	id: string;
	text: HtmlContent;
}

interface Props {
	items: Item[];
	orderedIds: string[];
	correctOrder?: string[];
	orientation?: 'vertical' | 'horizontal';
	/** Position badge style, from the interaction's `qti-labels-*` class; `none` hides the badge. */
	indexLabels?: SortableIndexLabels;
	/** Text after each position badge, from the interaction's `qti-labels-suffix-*` class. */
	indexSuffix?: string;
	disabled?: boolean;
	i18n?: I18nProvider;
	/**
	 * Rendered at the end of every row (e.g. an elimination toggle) so per-item
	 * controls align with their item at any row height, instead of drifting in a
	 * separate column sized against the row pitch.
	 */
	rowTrailing?: Snippet<[Item]>;
	/** Id(s) of more descriptions for the list, such as the interaction's unmet-minimum hint. */
	describedBy?: string;
	/** Id of an element that names the list, when the caller's context gives one. */
	labelledBy?: string;
	onReorder: (newOrder: string[]) => void;
}

const {
	items,
	orderedIds,
	correctOrder = [],
	orientation = 'vertical',
	indexLabels = 'decimal',
	indexSuffix = '',
	disabled = false,
	i18n,
	rowTrailing,
	describedBy,
	labelledBy,
	onReorder,
}: Props = $props();

// Unique id prefix so aria-labelledby/describedby survive several lists in one document.
const uid = $props.id();
const instructionsId = `${uid}-sortable-instructions`;

function formatIndex(index: number): string {
	if (indexLabels === 'decimal') return `${index + 1}${indexSuffix}`;
	let n = index + 1;
	let letters = '';
	while (n > 0) {
		n -= 1;
		letters = String.fromCharCode(97 + (n % 26)) + letters;
		n = Math.floor(n / 26);
	}
	return `${indexLabels === 'upper-alpha' ? letters.toUpperCase() : letters}${indexSuffix}`;
}

// The item picked up via keyboard (held), and the item a pointer drag carries.
const pickUp = createPickUpPlace();
let dragOverId = $state<string | null>(null);
let announceText = $state<string>(''); // For screen reader announcements

// Mouse drag handlers
function handleDragStart(id: string) {
	if (disabled) return;
	pickUp.startDrag(id);
}

function handleDragOver(event: DragEvent, id: string) {
	if (disabled) return;
	event.preventDefault();
	dragOverId = id;
}

function handleDragLeave() {
	dragOverId = null;
}

function handleDrop(event: DragEvent, dropId: string) {
	const draggedId = pickUp.dragged;
	if (disabled || !draggedId) return;
	event.preventDefault();

	if (draggedId !== dropId) {
		const oldIndex = orderedIds.indexOf(draggedId);
		const newIndex = orderedIds.indexOf(dropId);

		const newOrder = [...orderedIds];
		newOrder.splice(oldIndex, 1);
		newOrder.splice(newIndex, 0, draggedId);

		onReorder(newOrder);
	}

	pickUp.endDrag();
	dragOverId = null;
}

function handleDragEnd() {
	pickUp.endDrag();
	dragOverId = null;
}

// Keyboard handlers
function handleKeyDown(event: KeyboardEvent, id: string) {
	if (disabled) return;

	const currentIndex = orderedIds.indexOf(id);
	const item = items.find((i) => i.id === id);
	const itemName = item ? itemLabel(item) : translate(i18n, 'interactions.order.itemFallback', 'Item');

	// Space or Enter: Pick up or drop item
	if (event.key === ' ' || event.key === 'Enter') {
		handlePickupOrDrop(event, id, itemName, currentIndex);
		return;
	}

	// Escape: Cancel keyboard selection. The announcement names the grabbed item —
	// focus may sit on another item (a Tab while the grab continues) — so the held
	// item's name is resolved here, not the focused item's.
	if (event.key === 'Escape' && pickUp.held) {
		const grabbed = items.find((entry) => entry.id === pickUp.held);
		handleCancelSelection(
			event,
			grabbed ? itemLabel(grabbed) : translate(i18n, 'interactions.order.itemFallback', 'Item'),
		);
		return;
	}

	// Arrow keys: Move item or change focus
	if (pickUp.isHeld(id)) {
		handleArrowKeyMovement(event, itemName, currentIndex);
	}
}

function handlePickupOrDrop(
	event: KeyboardEvent,
	id: string,
	itemName: string,
	currentIndex: number
) {
	event.preventDefault();

	announceText = pickUp.toggle(id)
		? // Picked up
			translate(
				i18n,
				'interactions.order.itemGrabbed',
				'{item} grabbed. Current position {position} of {total}. Use arrow keys to move, Space or Enter to drop.',
				{ item: itemName, position: currentIndex + 1, total: orderedIds.length },
			)
		: // Dropped
			translate(i18n, 'interactions.order.itemDropped', '{item} dropped at position {position} of {total}', {
				item: itemName, position: currentIndex + 1, total: orderedIds.length,
			});
}

function handleCancelSelection(event: KeyboardEvent, itemName: string) {
	event.preventDefault();
	announceText = translate(i18n, 'interactions.order.selectionCancelled', '{item} selection cancelled', { item: itemName });
	pickUp.release();
}

function announceMoved(itemName: string, position: number): string {
	return translate(i18n, 'interactions.order.itemMoved', '{item} moved to position {position} of {total}', {
		item: itemName, position, total: orderedIds.length,
	});
}

function handleArrowKeyMovement(event: KeyboardEvent, itemName: string, currentIndex: number) {
	const focusedItem = event.currentTarget as HTMLButtonElement;
	// Horizontal lists run in the inline direction, so the earlier key mirrors under RTL.
	const rtl = getComputedStyle(focusedItem).direction === 'rtl';
	const earlierKey = rtl ? 'ArrowRight' : 'ArrowLeft';
	const laterKey = rtl ? 'ArrowLeft' : 'ArrowRight';
	if (event.key === 'ArrowUp' && orientation === 'vertical' && currentIndex > 0) {
		event.preventDefault();
		moveItem(currentIndex, currentIndex - 1);
		announceText = announceMoved(itemName, currentIndex);
	} else if (
		event.key === 'ArrowDown' &&
		orientation === 'vertical' &&
		currentIndex < orderedIds.length - 1
	) {
		event.preventDefault();
		moveItem(currentIndex, currentIndex + 1);
		announceText = announceMoved(itemName, currentIndex + 2);
	} else if (event.key === earlierKey && orientation === 'horizontal' && currentIndex > 0) {
		event.preventDefault();
		moveItem(currentIndex, currentIndex - 1);
		announceText = announceMoved(itemName, currentIndex);
	} else if (
		event.key === laterKey &&
		orientation === 'horizontal' &&
		currentIndex < orderedIds.length - 1
	) {
		event.preventDefault();
		moveItem(currentIndex, currentIndex + 1);
		announceText = announceMoved(itemName, currentIndex + 2);
	}
	if (event.defaultPrevented) {
		// Moving a keyed DOM node can blur it even when its component survives.
		// Restore focus after Svelte has applied the new order.
		void tick().then(() => {
			if (focusedItem.isConnected) focusedItem.focus();
		});
	}
}

function moveItem(fromIndex: number, toIndex: number) {
	const newOrder = [...orderedIds];
	const [movedItem] = newOrder.splice(fromIndex, 1);
	newOrder.splice(toIndex, 0, movedItem);
	onReorder(newOrder);
}

async function moveWithButton(event: MouseEvent, id: string, offset: number) {
	const index = orderedIds.indexOf(id);
	if (disabled || index < 0 || index + offset < 0 || index + offset >= orderedIds.length) return;
	const button = event.currentTarget as HTMLButtonElement;
	const row = button.closest('[role="listitem"]');
	const item = items.find((entry) => entry.id === orderedIds[index]);
	pickUp.release();
	moveItem(index, index + offset);
	announceText = announceMoved(
		item ? itemLabel(item) : translate(i18n, 'interactions.order.itemFallback', 'Item'),
		index + offset + 1,
	);
	await tick();
	// Keep repeated moves keyboard accessible; at a boundary focus the item.
	if (button.isConnected && !button.disabled) button.focus();
	else row?.querySelector<HTMLButtonElement>('[part="item"]')?.focus();
}

function itemLabel(item: Item): string {
	// Image alt and MathML alttext participate, unlike raw textContent.
	return accessibleTextFromHtml(item.text) || translate(i18n, 'interactions.order.itemFallback', 'Item');
}

/** Position/state sentences for the row's aria-describedby target. */
function itemState(index: number, isGrabbed: boolean, isCorrect: boolean): string {
	return joinSentences(
		translate(i18n, 'interactions.order.position', 'Position {current} of {total}', {
			current: index + 1,
			total: orderedIds.length,
		}),
		isGrabbed && translate(i18n, 'interactions.order.grabbed', 'Grabbed. Use arrow keys to move.'),
		isCorrect && translate(i18n, 'accessibility.correctPosition', 'Correct position.'),
	);
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{announceText}
</div>

<!-- Instructions for keyboard users -->
<div id={instructionsId} class="sr-only">
	{translate(
		i18n,
		'interactions.order.keyboardInstructions',
		'Press Space or Enter to grab an item. Use arrow keys to move the item. Press Space or Enter again to drop. Press Escape to cancel.',
	)}
</div>

<div
	role="list"
	aria-label={labelledBy ? undefined : (i18n?.t('interactions.order.listLabel') ?? 'Reorderable list of choices')}
	aria-labelledby={labelledBy}
	aria-describedby={describedBy ? `${instructionsId} ${describedBy}` : instructionsId}
	data-orientation={orientation}
	part="list"
	class="qti-sortable-list space-y-2"
	class:flex={orientation === 'horizontal'}
	class:gap-2={orientation === 'horizontal'}
>
	{#each orderedIds as id, index (id)}
		{@const item = items.find((i) => i.id === id)}
		{#if item}
			{@const isGrabbed = pickUp.isHeld(id)}
			{@const correctIndex = correctOrder.indexOf(id)}
			{@const isCorrect = correctIndex !== -1 && correctIndex === index}
			{@const label = itemLabel(item)}
			{@const textId = `${uid}-item-${id}-text`}
			{@const stateId = `${uid}-item-${id}-state`}
			<div role="listitem" class="qti-sortable-row">
				<button
					type="button"
					draggable={!disabled}
					use:touchDrag
					ondragstart={() => handleDragStart(id)}
					ondragover={(e) => handleDragOver(e, id)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, id)}
					ondragend={handleDragEnd}
					onkeydown={(e) => handleKeyDown(e, id)}
					disabled={disabled}
					aria-labelledby={textId}
					aria-describedby={stateId}
					data-grabbed={isGrabbed}
					data-correct={isCorrect}
					data-disabled={disabled}
					part="item"
					class="qti-sortable-item flex items-center gap-2 p-3 bg-base-200 rounded select-none transition-all text-start"
					class:cursor-grab={!disabled && !isGrabbed}
					class:cursor-not-allowed={disabled}
					class:opacity-50={disabled || pickUp.dragged === id}
					class:ring-2={(dragOverId === id && pickUp.dragged !== id) || isGrabbed}
					class:ring-primary={(dragOverId === id && pickUp.dragged !== id) || isGrabbed}
					class:bg-primary={isGrabbed}
					class:bg-opacity-20={isGrabbed || isCorrect}
					class:bg-success={isCorrect}
					class:border-success={isCorrect}
				>
					{#if indexLabels !== 'none'}
						<span part="index" aria-hidden="true" data-text={formatIndex(index)} class="qti-sortable-index badge {isCorrect ? 'badge-success' : 'badge-neutral'}"></span>
					{/if}
					<DragHandle size={1} opacity={0.5} class="text-base-content" />
					<!-- The name source: image alt and MathML participate in name computation here. -->
					<span id={textId} part="text" class="qti-sortable-text qti-rich-content flex-1">{@html item.text}</span>
					{#if isCorrect}
						<span aria-hidden="true" data-text="{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}" class="badge badge-success badge-sm"></span>
					{/if}
				</button>
				{#if !disabled}
					<div class="qti-sortable-moves">
						<button type="button" class="qti-sortable-move" disabled={index === 0}
							aria-label={translate(i18n, 'interactions.order.moveEarlierItem', 'Move {item} earlier', { item: label })}
							title={translate(i18n, 'interactions.order.moveEarlierItem', 'Move {item} earlier', { item: label })}
							onclick={(event) => moveWithButton(event, id, -1)}>
							<span class="qti-sortable-glyph" aria-hidden="true">{orientation === 'horizontal' ? '←' : '↑'}</span>
						</button>
						<button type="button" class="qti-sortable-move" disabled={index === orderedIds.length - 1}
							aria-label={translate(i18n, 'interactions.order.moveLaterItem', 'Move {item} later', { item: label })}
							title={translate(i18n, 'interactions.order.moveLaterItem', 'Move {item} later', { item: label })}
							onclick={(event) => moveWithButton(event, id, 1)}>
							<span class="qti-sortable-glyph" aria-hidden="true">{orientation === 'horizontal' ? '→' : '↓'}</span>
						</button>
					</div>
				{/if}
				{#if rowTrailing}
					{@render rowTrailing(item)}
				{/if}
				<span id={stateId} class="sr-only">{itemState(index, isGrabbed, isCorrect)}</span>
			</div>
		{/if}
	{/each}
</div>

<style>
	/* Redundant with the button's aria-label; generated so the visible text stays out of the DOM's label-in-name comparison. */
	[data-text]::before {
		content: attr(data-text);
	}

	/* Minimal, self-contained layout so the component doesn't break when Tailwind utilities aren't present */
	.qti-sortable-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.qti-sortable-list[data-orientation='horizontal'] {
		flex-direction: row;
		flex-wrap: wrap;
	}

	/*
	 * Reflow (WCAG 1.4.10): on a narrow screen the row's move controls wrap under
	 * the item instead of squeezing the item (and its label) into a clipped sliver;
	 * wide screens keep them on the item's line.
	 */
	.qti-sortable-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; min-width: 0; }
	.qti-sortable-moves { display: flex; flex: 0 0 auto; gap: 0.25rem; }
	.qti-sortable-list[data-orientation='horizontal'] .qti-sortable-glyph:dir(rtl) {
		display: inline-block;
		transform: scaleX(-1);
	}
	.qti-sortable-move {
		min-width: 44px; min-height: 44px; border-radius: 0.375rem;
		border: 1px solid var(--pie-qti-base-content, #333);
		background: var(--pie-qti-base-100, white); color: var(--pie-qti-base-content, #333);
		font-size: 1.25rem; cursor: pointer;
	}
	.qti-sortable-move:disabled { opacity: 0.4; cursor: default; }
	.qti-sortable-move:focus-visible { outline: 2px solid var(--pie-qti-focus, #4338ca); outline-offset: 2px; }
	.qti-sortable-item {
		/* Grows to the row on wide screens; below 12rem of available width the row
		   wraps and the item takes the full line, its label wrapping too. */
		flex: 1 1 12rem;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		text-align: start;
		user-select: none;
		transition: background-color 120ms ease, border-color 120ms ease, outline-color 120ms ease,
			opacity 120ms ease;
	}
	.qti-sortable-item:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-sortable-item[data-grabbed='true'] {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 8%, transparent);
	}
	/*
	 * Forced colors drop the tint and the ring (a box-shadow), which leaves the picked-up item
	 * looking like every other. It keeps a system-colour cue that is not colour alone: a heavier
	 * Highlight border, whose extra width the padding gives back so nothing shifts. The focus
	 * outline stays as it is.
	 */
	@media (forced-colors: active) {
		.qti-sortable-item[data-grabbed='true'] {
			border: 3px solid Highlight;
			padding: calc(0.75rem - 2px);
		}
	}
	.qti-sortable-item[data-correct='true'] {
		border-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
		background: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 8%, transparent);
	}
	.qti-sortable-item[data-disabled='true'] {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.qti-sortable-index {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.75rem;
		height: 1.25rem;
		padding: 0 0.4rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}
	.qti-sortable-text {
		flex: 1 1 auto;
		min-width: 0;
	}
</style>
