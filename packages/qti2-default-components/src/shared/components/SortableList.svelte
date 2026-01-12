<script lang="ts">
/**
 * Sortable list component with keyboard, mouse, and touch support
 * Accessible via drag-and-drop, keyboard (Space/Enter to grab, arrow keys to move), or touch
 */

import type { I18nProvider } from '@pie-qti/qti2-i18n';
import { touchDrag } from '../utils/touchDragHelper.js';
import DragHandle from './DragHandle.svelte';
import '../styles/shared.css';

interface Item {
	id: string;
	text: string;
}

interface Props {
	items: Item[];
	orderedIds: string[];
	orientation?: 'vertical' | 'horizontal';
	disabled?: boolean;
	i18n?: I18nProvider;
	onReorder: (newOrder: string[]) => void;
}

const {
	items,
	orderedIds,
	orientation = 'vertical',
	disabled = false,
	i18n,
	onReorder,
}: Props = $props();

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
	const itemName = item?.text || 'Item';

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
		announceText = `${itemName} dropped at position ${currentIndex + 1} of ${orderedIds.length}`;
	} else {
		// Pick up item
		keyboardSelectedId = id;
		announceText = `${itemName} grabbed. Current position ${currentIndex + 1} of ${orderedIds.length}. Use arrow keys to move, Space or Enter to drop.`;
	}
}

function handleCancelSelection(event: KeyboardEvent, itemName: string) {
	event.preventDefault();
	announceText = `${itemName} selection cancelled`;
	keyboardSelectedId = null;
}

function handleArrowKeyMovement(event: KeyboardEvent, itemName: string, currentIndex: number) {
	if (event.key === 'ArrowUp' && orientation === 'vertical' && currentIndex > 0) {
		event.preventDefault();
		moveItem(currentIndex, currentIndex - 1);
		announceText = `${itemName} moved to position ${currentIndex} of ${orderedIds.length}`;
	} else if (
		event.key === 'ArrowDown' &&
		orientation === 'vertical' &&
		currentIndex < orderedIds.length - 1
	) {
		event.preventDefault();
		moveItem(currentIndex, currentIndex + 1);
		announceText = `${itemName} moved to position ${currentIndex + 2} of ${orderedIds.length}`;
	} else if (event.key === 'ArrowLeft' && orientation === 'horizontal' && currentIndex > 0) {
		event.preventDefault();
		moveItem(currentIndex, currentIndex - 1);
		announceText = `${itemName} moved to position ${currentIndex} of ${orderedIds.length}`;
	} else if (
		event.key === 'ArrowRight' &&
		orientation === 'horizontal' &&
		currentIndex < orderedIds.length - 1
	) {
		event.preventDefault();
		moveItem(currentIndex, currentIndex + 1);
		announceText = `${itemName} moved to position ${currentIndex + 2} of ${orderedIds.length}`;
	}
}

function moveItem(fromIndex: number, toIndex: number) {
	const newOrder = [...orderedIds];
	const [movedItem] = newOrder.splice(fromIndex, 1);
	newOrder.splice(toIndex, 0, movedItem);
	onReorder(newOrder);
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{announceText}
</div>

<!-- Instructions for keyboard users -->
<div id="sortable-instructions" class="sr-only">
	Press Space or Enter to grab an item. Use arrow keys to move the item. Press Space or Enter again to drop. Press Escape to cancel.
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
			<div role="listitem">
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
					aria-label="{item.text}. Position {index + 1} of {orderedIds.length}{isGrabbed ? '. Grabbed. Use arrow keys to move.' : ''}"
					aria-grabbed={isGrabbed}
					data-grabbed={isGrabbed}
					data-disabled={disabled}
					part="item"
					class="qti-sortable-item flex items-center gap-2 p-3 bg-base-200 rounded select-none transition-all w-full text-left"
					class:cursor-grab={!disabled && !isGrabbed}
					class:cursor-not-allowed={disabled}
					class:opacity-50={disabled || draggedId === id}
					class:ring-2={(dragOverId === id && draggedId !== id) || isGrabbed}
					class:ring-primary={(dragOverId === id && draggedId !== id) || isGrabbed}
					class:bg-primary={isGrabbed}
					class:bg-opacity-20={isGrabbed}
				>
					<span part="index" class="qti-sortable-index badge badge-neutral">{index + 1}</span>
					<DragHandle size={1} opacity={0.5} class="text-base-content" />
					<span part="text" class="qti-sortable-text flex-1">{item.text}</span>
				</button>
			</div>
		{/if}
	{/each}
</div>

<style>
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

	.qti-sortable-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
		color: var(--color-base-content, oklch(21% 0 0));
		text-align: left;
		user-select: none;
		transition: background-color 120ms ease, border-color 120ms ease, outline-color 120ms ease,
			opacity 120ms ease;
	}
	.qti-sortable-item:focus-visible {
		outline: 2px solid var(--color-primary, oklch(45% 0.24 277));
		outline-offset: 2px;
	}
	.qti-sortable-item[data-grabbed='true'] {
		border-color: var(--color-primary, oklch(45% 0.24 277));
		background: color-mix(in oklch, var(--color-primary, oklch(45% 0.24 277)) 8%, transparent);
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
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-100, oklch(100% 0 0));
		color: var(--color-base-content, oklch(21% 0 0));
	}
	.qti-sortable-text {
		flex: 1 1 auto;
		min-width: 0;
	}
</style>
