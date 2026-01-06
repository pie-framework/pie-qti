<script lang="ts">
/**
 * Drag-and-drop matching component with keyboard, mouse, and touch support
 * Keyboard: Tab to navigate, Space/Enter to select source, Tab to targets, Space/Enter to match
 * Touch: Touch and drag source items to target drop zones
 */

import { touchDrag } from '../utils/touchDragHelper.js';

interface MatchItem {
	identifier: string;
	text: string;
}

interface Props {
	sourceSet: MatchItem[];
	targetSet: MatchItem[];
	pairs: string[]; // Array of "sourceId targetId" pairs
	disabled?: boolean;
	onPairsChange: (newPairs: string[]) => void;
}

const { sourceSet, targetSet, pairs, disabled = false, onPairsChange }: Props = $props();

let draggedSourceId = $state<string | null>(null);
let keyboardSelectedSourceId = $state<string | null>(null); // Source selected via keyboard
let announceText = $state<string>(''); // For screen reader announcements

// Get the target matched to a source
function getMatchedTarget(sourceId: string): string | null {
	const pair = pairs.find((p) => p.startsWith(`${sourceId} `));
	return pair ? pair.split(' ')[1] : null;
}

// Get the source matched to a target
function getMatchedSource(targetId: string): string | null {
	const pair = pairs.find((p) => p.endsWith(` ${targetId}`));
	return pair ? pair.split(' ')[0] : null;
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

	createMatch(draggedSourceId, targetId);
	draggedSourceId = null;
}

function handleDragEnd() {
	draggedSourceId = null;
}

// Keyboard handlers for source items
function handleSourceKeyDown(event: KeyboardEvent, sourceId: string) {
	if (disabled) return;

	const source = sourceSet.find((s) => s.identifier === sourceId);
	const sourceName = source?.text || 'Item';

	if (event.key === ' ' || event.key === 'Enter') {
		event.preventDefault();

		if (keyboardSelectedSourceId === sourceId) {
			// Deselect
			keyboardSelectedSourceId = null;
			announceText = `${sourceName} deselected`;
		} else {
			// Select this source for matching
			keyboardSelectedSourceId = sourceId;
			announceText = `${sourceName} selected. Navigate to a target and press Space or Enter to match.`;
		}
	} else if (event.key === 'Escape' && keyboardSelectedSourceId) {
		event.preventDefault();
		keyboardSelectedSourceId = null;
		announceText = `Selection cancelled`;
	}
}

// Keyboard handlers for target items
function handleTargetKeyDown(event: KeyboardEvent, targetId: string) {
	if (disabled) return;

	const target = targetSet.find((t) => t.identifier === targetId);
	const targetName = target?.text || 'Target';

	if ((event.key === ' ' || event.key === 'Enter') && keyboardSelectedSourceId) {
		event.preventDefault();

		const source = sourceSet.find((s) => s.identifier === keyboardSelectedSourceId);
		const sourceName = source?.text || 'Item';

		createMatch(keyboardSelectedSourceId, targetId);
		announceText = `${sourceName} matched with ${targetName}`;
		keyboardSelectedSourceId = null;
	}
}

// Create or update a match
function createMatch(sourceId: string, targetId: string) {
	// Remove any existing pair for this source
	let newPairs = pairs.filter((p) => !p.startsWith(`${sourceId} `));

	// Remove any existing pair for this target
	newPairs = newPairs.filter((p) => !p.endsWith(` ${targetId}`));

	// Add new pair
	newPairs.push(`${sourceId} ${targetId}`);

	onPairsChange(newPairs);
}

function clearMatch(sourceId: string) {
	if (disabled) return;
	const source = sourceSet.find((s) => s.identifier === sourceId);
	const sourceName = source?.text || 'Item';

	const newPairs = pairs.filter((p) => !p.startsWith(`${sourceId} `));
	onPairsChange(newPairs);

	announceText = `Match cleared for ${sourceName}`;
}
</script>

<!-- Screen reader announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{announceText}
</div>

<!-- Instructions for keyboard users -->
<div id="match-instructions" class="sr-only">
	Press Space or Enter to select a source item. Tab to navigate to targets. Press Space or Enter on a target to create a match. Press Escape to cancel selection.
</div>

<div
	class="qti-match-grid grid grid-cols-2 gap-6"
	role="region"
	aria-describedby="match-instructions"
>
	<!-- Source Set (Left Column) -->
	<div class="qti-match-col space-y-2" role="group" aria-label="Source items to match">
		<h3 class="qti-match-heading font-semibold text-sm text-base-content/70 mb-3">
			Drag from here:
		</h3>
		{#each sourceSet as source (source.identifier)}
			{@const matchedTarget = getMatchedTarget(source.identifier)}
			{@const targetItem = matchedTarget ? targetSet.find((t) => t.identifier === matchedTarget) : null}
			{@const isSelected = keyboardSelectedSourceId === source.identifier}

			<div class="qti-match-source-wrapper relative">
				<!-- svelte-ignore event_directive_deprecated -->
				<button
					type="button"
					draggable={!disabled && !matchedTarget}
					use:touchDrag
					on:dragstart={() => handleDragStart(source.identifier)}
					on:dragend={handleDragEnd}
					on:keydown={(e) => handleSourceKeyDown(e, source.identifier)}
					disabled={disabled}
					aria-label="{source.text}{matchedTarget && targetItem ? '. Matched with ' + targetItem.text : ''}{isSelected ? '. Selected for matching' : ''}"
					aria-pressed={isSelected}
					data-matched={!!matchedTarget}
					data-selected={isSelected}
					data-dragging={draggedSourceId === source.identifier}
					class="qti-match-source p-3 rounded-lg border-2 transition-all w-full"
					class:bg-base-200={!matchedTarget && !isSelected}
					class:bg-success={matchedTarget}
					class:bg-primary={isSelected}
					class:bg-opacity-20={matchedTarget || isSelected}
					class:border-base-300={!matchedTarget && !isSelected}
					class:border-success={matchedTarget}
					class:border-primary={isSelected}
					class:ring-2={isSelected}
					class:ring-primary={isSelected}
					class:cursor-grab={!disabled && !matchedTarget && !isSelected}
					class:cursor-not-allowed={disabled}
					class:opacity-50={disabled || draggedSourceId === source.identifier}
				>
					<div class="qti-match-source-content flex items-center justify-between gap-2">
						<div class="qti-match-source-text flex-1">
							<div class="qti-match-source-title font-medium">{source.text}</div>
							{#if matchedTarget && targetItem}
								<div class="qti-match-source-sub text-sm text-success mt-1">→ {targetItem.text}</div>
							{/if}
						</div>
						{#if !disabled && !matchedTarget}
							<svg
								class="qti-match-handle w-5 h-5 text-base-content/30"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
							</svg>
						{/if}
					</div>
				</button>
				{#if matchedTarget && !disabled}
					<!-- svelte-ignore event_directive_deprecated -->
					<button
						type="button"
						class="qti-match-clear btn btn-xs btn-ghost absolute top-2 right-2"
						on:click={() => clearMatch(source.identifier)}
						aria-label="Clear match for {source.text}"
					>
						✕
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Target Set (Right Column) - Drop Zones -->
	<div class="qti-match-col space-y-2" role="group" aria-label="Target items for matching">
		<h3 class="qti-match-heading font-semibold text-sm text-base-content/70 mb-3">
			Drop here:
		</h3>
		{#each targetSet as target (target.identifier)}
			{@const matchedSource = getMatchedSource(target.identifier)}
			{@const sourceItem = matchedSource ? sourceSet.find((s) => s.identifier === matchedSource) : null}
			{@const isHighlight = (draggedSourceId && !matchedSource) || (keyboardSelectedSourceId && !matchedSource)}

			<!-- svelte-ignore event_directive_deprecated -->
			<button
				type="button"
				on:dragover={handleDragOver}
				on:drop={(e) => handleDrop(e, target.identifier)}
				on:keydown={(e) => handleTargetKeyDown(e, target.identifier)}
				disabled={disabled || !keyboardSelectedSourceId}
				aria-label="{target.text}{matchedSource && sourceItem ? '. Matched with ' + sourceItem.text : '. Available for matching'}"
				data-matched={!!matchedSource}
				data-highlight={isHighlight}
				class="qti-match-target p-3 rounded-lg border-2 border-dashed min-h-[60px] transition-all"
				class:bg-base-100={!matchedSource}
				class:bg-primary={matchedSource}
				class:bg-opacity-10={matchedSource}
				class:border-base-300={!matchedSource}
				class:border-primary={matchedSource}
				class:border-accent={draggedSourceId && !matchedSource || (keyboardSelectedSourceId && !matchedSource)}
				class:bg-accent={draggedSourceId && !matchedSource || (keyboardSelectedSourceId && !matchedSource)}
				class:bg-opacity-5={draggedSourceId && !matchedSource || (keyboardSelectedSourceId && !matchedSource)}
			>
				<div class="qti-match-target-content flex flex-col gap-1">
					<div class="qti-match-target-title font-medium text-base-content/70">{target.text}</div>
					{#if matchedSource && sourceItem}
						<div class="qti-match-target-sub text-sm text-primary font-medium">← {sourceItem.text}</div>
					{:else if !disabled}
						<div class="qti-match-target-hint text-xs text-base-content/70 italic">
							{keyboardSelectedSourceId ? 'Press Space or Enter to match' : 'Drop item here'}
						</div>
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
		color: hsl(var(--bc, 0 0% 10%) / 0.7);
	}

	.qti-match-source-wrapper {
		position: relative;
	}
	.qti-match-source {
		display: block;
		width: 100%;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 2px solid hsl(var(--b3, 0 0% 85%));
		background: hsl(var(--b2, 0 0% 95%));
		color: hsl(var(--bc, 0 0% 10%));
		text-align: left;
		user-select: none;
		transition: background-color 120ms ease, border-color 120ms ease, outline-color 120ms ease,
			opacity 120ms ease;
	}
	.qti-match-source:focus-visible {
		outline: 2px solid hsl(var(--p, 240 100% 50%));
		outline-offset: 2px;
	}
	.qti-match-source[data-selected='true'] {
		border-color: hsl(var(--p, 240 100% 50%));
		background: hsl(var(--p, 240 100% 50%) / 0.08);
	}
	.qti-match-source[data-matched='true'] {
		border-color: hsl(var(--su, 140 60% 40%));
		background: hsl(var(--su, 140 60% 40%) / 0.08);
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
		color: hsl(var(--su, 140 60% 40%));
	}
	/* Make the drag-handle SVG sane even without Tailwind's `w-5 h-5` utilities */
	.qti-match-handle {
		width: 1.25rem;
		height: 1.25rem;
		flex: 0 0 auto;
		opacity: 0.35;
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
		background: hsl(var(--b3, 0 0% 85%) / 0.35);
	}

	.qti-match-target {
		width: 100%;
		padding: 0.75rem;
		border-radius: 0.5rem;
		border: 2px dashed hsl(var(--b3, 0 0% 85%));
		background: hsl(var(--b1, 0 0% 100%));
		color: hsl(var(--bc, 0 0% 10%));
		text-align: left;
		min-height: 60px;
		transition: background-color 120ms ease, border-color 120ms ease, outline-color 120ms ease,
			opacity 120ms ease;
	}
	.qti-match-target:focus-visible {
		outline: 2px solid hsl(var(--p, 240 100% 50%));
		outline-offset: 2px;
	}
	.qti-match-target[data-matched='true'] {
		border-color: hsl(var(--p, 240 100% 50%));
		background: hsl(var(--p, 240 100% 50%) / 0.06);
	}
	.qti-match-target[data-highlight='true'] {
		border-color: hsl(var(--a, 50 100% 50%));
		background: hsl(var(--a, 50 100% 50%) / 0.06);
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
		color: hsl(var(--bc, 0 0% 10%) / 0.7);
	}
	.qti-match-target-sub {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--p, 240 100% 50%));
	}
	.qti-match-target-hint {
		font-size: 0.75rem;
		font-style: italic;
		color: hsl(var(--bc, 0 0% 10%) / 0.7);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
