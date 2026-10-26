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
import { htmlToString } from '@pie-qti/item-player/security';
import { touchDrag } from '@pie-qti/qti-common';
import { tick } from 'svelte';
import DragHandle from './DragHandle.svelte';
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
	onReorder,
}: Props = $props();

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

let draggedId = $state<string | null>(null);
let dragOverId = $state<string | null>(null);
let keyboardSelectedId = $state<string | null>(null); // Item picked up via keyboard
let announceText = $state<string>(''); // For screen reader announcements

// Mouse drag handlers
function handleDragStart(id: string) {
	if (disabled) return;
	draggedId = id;
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

	draggedId = null;
	dragOverId = null;
}

function handleDragEnd() {
	draggedId = null;
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

	// Escape: Cancel keyboard selection
	if (event.key === 'Escape' && keyboardSelectedId) {
		handleCancelSelection(event, itemName);
		return;
	}

	// Arrow keys: Move item or change focus
	if (keyboardSelectedId === id) {
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

	if (keyboardSelectedId === id) {
		// Drop item
		keyboardSelectedId = null;
		announceText = translate(i18n, 'interactions.order.itemDropped', '{item} dropped at position {position} of {total}', {
			item: itemName, position: currentIndex + 1, total: orderedIds.length,
		});
	} else {
		// Pick up item
		keyboardSelectedId = id;
		announceText = translate(
			i18n,
			'interactions.order.itemGrabbed',
			'{item} grabbed. Current position {position} of {total}. Use arrow keys to move, Space or Enter to drop.',
			{ item: itemName, position: currentIndex + 1, total: orderedIds.length },
		);
	}
}

function handleCancelSelection(event: KeyboardEvent, itemName: string) {
	event.preventDefault();
	announceText = translate(i18n, 'interactions.order.selectionCancelled', '{item} selection cancelled', { item: itemName });
	keyboardSelectedId = null;
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
	keyboardSelectedId = null;
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
	return toPlainText(item.text) || translate(i18n, 'interactions.order.itemFallback', 'Item');
}

function toPlainText(html: HtmlContent): string {
	if (typeof document !== 'undefined') {
		const template = document.createElement('template');
		// Passing the value through unchanged preserves TrustedHTML identity at
		// this parsing sink; the resulting text is used only for accessibility.
		template.innerHTML = html as any;
		return (template.content.textContent ?? '').replace(/\s+/g, ' ').trim();
	}
	return htmlToString(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{announceText}
</div>

<!-- Instructions for keyboard users -->
<div id="sortable-instructions" class="sr-only">
	{translate(
		i18n,
		'interactions.order.keyboardInstructions',
		'Press Space or Enter to grab an item. Use arrow keys to move the item. Press Space or Enter again to drop. Press Escape to cancel.',
	)}
</div>

<div
	role="list"
	aria-label={i18n?.t('interactions.order.listLabel') ?? 'Reorderable list of choices'}
	aria-describedby="sortable-instructions"
	data-orientation={orientation}
	part="list"
	class="qti-sortable-list space-y-2"
	class:flex={orientation === 'horizontal'}
	class:gap-2={orientation === 'horizontal'}
>
	{#each orderedIds as id, index (id)}
		{@const item = items.find((i) => i.id === id)}
		{#if item}
			{@const isGrabbed = keyboardSelectedId === id}
			{@const correctIndex = correctOrder.indexOf(id)}
			{@const isCorrect = correctIndex !== -1 && correctIndex === index}
			{@const label = itemLabel(item)}
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
					aria-label={joinSentences(
						translate(i18n, 'interactions.order.itemPosition', '{item}. Position {position} of {total}.', {
							item: label, position: index + 1, total: orderedIds.length,
						}),
						isGrabbed && translate(i18n, 'interactions.order.grabbed', 'Grabbed. Use arrow keys to move.'),
						isCorrect && translate(i18n, 'accessibility.correctPosition', 'Correct position.'),
					)}
					aria-grabbed={isGrabbed}
					data-grabbed={isGrabbed}
					data-correct={isCorrect}
					data-disabled={disabled}
					part="item"
					class="qti-sortable-item flex items-center gap-2 p-3 bg-base-200 rounded select-none transition-all w-full text-start"
					class:cursor-grab={!disabled && !isGrabbed}
					class:cursor-not-allowed={disabled}
					class:opacity-50={disabled || draggedId === id}
					class:ring-2={(dragOverId === id && draggedId !== id) || isGrabbed}
					class:ring-primary={(dragOverId === id && draggedId !== id) || isGrabbed}
					class:bg-primary={isGrabbed}
					class:bg-opacity-20={isGrabbed || isCorrect}
					class:bg-success={isCorrect}
					class:border-success={isCorrect}
				>
					{#if indexLabels !== 'none'}
						<span part="index" aria-hidden="true" data-text={formatIndex(index)} class="qti-sortable-index badge {isCorrect ? 'badge-success' : 'badge-neutral'}"></span>
					{/if}
					<DragHandle size={1} opacity={0.5} class="text-base-content" />
					<span part="text" class="qti-sortable-text qti-rich-content flex-1">{@html item.text}</span>
					{#if isCorrect}
						<span aria-hidden="true" data-text="{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}" class="badge badge-success badge-sm"></span>
					{/if}
				</button>
				{#if !disabled}
					<div class="qti-sortable-moves">
						<button type="button" class="qti-sortable-move" disabled={index === 0}
							aria-label="{i18n?.t('interactions.order.moveEarlier') ?? 'Move earlier'}: {label}"
							title={i18n?.t('interactions.order.moveEarlier') ?? 'Move earlier'}
							onclick={(event) => moveWithButton(event, id, -1)}>
							<span class="qti-sortable-glyph" aria-hidden="true">{orientation === 'horizontal' ? '←' : '↑'}</span>
						</button>
						<button type="button" class="qti-sortable-move" disabled={index === orderedIds.length - 1}
							aria-label="{i18n?.t('interactions.order.moveLater') ?? 'Move later'}: {label}"
							title={i18n?.t('interactions.order.moveLater') ?? 'Move later'}
							onclick={(event) => moveWithButton(event, id, 1)}>
							<span class="qti-sortable-glyph" aria-hidden="true">{orientation === 'horizontal' ? '→' : '↓'}</span>
						</button>
					</div>
				{/if}
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

	.qti-sortable-row { display: flex; gap: 0.5rem; align-items: center; min-width: 0; }
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
	.qti-sortable-move:focus-visible { outline: 2px solid var(--pie-qti-primary, #4338ca); outline-offset: 2px; }
	.qti-sortable-item {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
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
		outline: 2px solid var(--pie-qti-primary, oklch(45% 0.24 277));
		outline-offset: 2px;
	}
	.qti-sortable-item[data-grabbed='true'] {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 8%, transparent);
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
