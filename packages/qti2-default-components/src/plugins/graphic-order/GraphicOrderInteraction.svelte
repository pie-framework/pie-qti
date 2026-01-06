<svelte:options customElement="pie-qti-graphic-order" />

<script lang="ts">
	import type { GraphicOrderInteractionData } from '@pie-qti/qti2-item-player';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: GraphicOrderInteractionData | string;
		response?: string[] | null;
		disabled?: boolean;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<GraphicOrderInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));

	let orderedIds = $state<string[]>([]);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);
	let draggedItemId: string | null = $state(null);
	let dragOverIndex: number | null = $state(null);

	// Track whether user has confirmed their order
	let hasConfirmed = $state(false);

	const canDrag = $derived(!disabled);

	// Track initial order to detect if user has made changes
	const initialOrder = $derived(parsedInteraction?.hotspotChoices.map((c) => c.identifier) || []);
	const hasReordered = $derived(
		orderedIds.length > 0 &&
		orderedIds.some((id, index) => id !== initialOrder[index])
	);

	// Show confirmation button when response is null or when not confirmed yet
	const needsConfirmation = $derived(
		!disabled &&
		(!parsedResponse || !hasConfirmed) &&
		orderedIds.length > 0
	);

	$effect(() => {
		// Sync with parent response changes
		orderedIds = parsedResponse ? [...parsedResponse] : parsedInteraction?.hotspotChoices.map((c) => c.identifier) || [];
	});

	// Reset confirmation state when response is externally cleared
	$effect(() => {
		if (parsedResponse === null || (Array.isArray(parsedResponse) && parsedResponse.length === 0)) {
			hasConfirmed = false;
		}
	});

	function handleDragStart(event: DragEvent, itemId: string) {
		if (!canDrag) return;
		draggedItemId = itemId;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', itemId);
		}
	}

	function handleDragOver(event: DragEvent, index: number) {
		if (!canDrag) return;
		event.preventDefault();
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(event: DragEvent, targetIndex: number) {
		if (!canDrag || !draggedItemId) return;
		event.preventDefault();

		const currentIndex = orderedIds.indexOf(draggedItemId);
		if (currentIndex === -1) return;

		// Reorder the items
		const newOrder = [...orderedIds];
		newOrder.splice(currentIndex, 1);
		newOrder.splice(targetIndex, 0, draggedItemId);

		orderedIds = newOrder;
		hasConfirmed = true; // Auto-confirm on drag
		response = orderedIds;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(orderedIds);
		// Dispatch custom event for web component usage
		const event2 = new CustomEvent('qti-change', {
			detail: {
				responseId: parsedInteraction?.responseId,
				value: orderedIds,
				timestamp: Date.now(),
			},
			bubbles: true,
			composed: true,
		});
		dispatchEvent(event2);

		draggedItemId = null;
		dragOverIndex = null;
	}

	function confirmOrder() {
		if (disabled || hasConfirmed) return;

		hasConfirmed = true;
		const currentOrder = orderedIds;
		response = currentOrder;

		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(currentOrder);
		// Dispatch custom event for web component usage
		const event2 = new CustomEvent('qti-change', {
			detail: {
				responseId: parsedInteraction?.responseId,
				value: currentOrder,
				timestamp: Date.now(),
			},
			bubbles: true,
			composed: true,
		});
		dispatchEvent(event2);
	}

	function handleDragEnd() {
		draggedItemId = null;
		dragOverIndex = null;
	}

	function getChoiceByIdentifier(identifier: string) {
		return parsedInteraction?.hotspotChoices.find((c) => c.identifier === identifier);
	}
</script>

<ShadowBaseStyles />

<div class="qti-graphic-order-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">No interaction data provided</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-go-prompt font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<div part="layout" class="qti-go-layout flex flex-col md:flex-row gap-4">
			<!-- Image Area -->
			<div part="image-area" class="qti-go-image-area flex-1">
				<div
					bind:this={imageContainer}
					part="stage"
					class="qti-go-stage relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
				>
					{#if parsedInteraction.imageData}
						{#if parsedInteraction.imageData.type === 'svg' && parsedInteraction.imageData.content}
							<div
								bind:this={imageElement}
								class="w-full h-auto"
								style="width: {parsedInteraction.imageData.width}px; height: {parsedInteraction.imageData.height}px;"
							>
								{@html parsedInteraction.imageData.content}
							</div>
						{:else if parsedInteraction.imageData.src}
							<img
								bind:this={imageElement}
								src={parsedInteraction.imageData.src}
								alt="Ordering diagram"
								class="w-full h-auto"
								style="width: {parsedInteraction.imageData.width}px; height: {parsedInteraction.imageData
									.height}px;"
							/>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Ordering Area -->
			<div part="panel" class="qti-go-panel w-full md:w-64">
				<div class="qti-go-card card bg-base-100 border border-base-300">
					<div class="qti-go-card-body card-body p-4">
						<h3 part="panel-title" class="qti-go-title card-title text-sm">Order (drag to reorder)</h3>
						<div part="list" class="qti-go-list space-y-2">
							{#each orderedIds as itemId, index (itemId)}
								{@const choice = getChoiceByIdentifier(itemId)}
								{@const isDragging = draggedItemId === itemId}
								{@const isDropTarget = dragOverIndex === index}
								<div
									draggable={canDrag}
									ondragstart={(e) => handleDragStart(e, itemId)}
									ondragover={(e) => handleDragOver(e, index)}
									ondragleave={handleDragLeave}
									ondrop={(e) => handleDrop(e, index)}
									ondragend={handleDragEnd}
									part="item"
									class="qti-go-item flex items-center gap-2 p-3 rounded-lg border-2 transition-all {isDragging
										? 'opacity-50 border-dashed'
										: ''} {isDropTarget
										? 'border-primary bg-primary/10'
										: 'border-base-300 bg-base-200'} {canDrag
										? 'cursor-move hover:border-primary'
										: 'cursor-not-allowed opacity-70'}"
									role="button"
									tabindex={canDrag ? 0 : -1}
									aria-label="Item {index + 1}: {choice?.label || itemId}"
								>
									<div class="flex-none">
										<div class="badge badge-primary badge-lg font-bold">
											{index + 1}
										</div>
									</div>
									<div class="flex-1 text-sm font-medium">
										{choice?.label || itemId}
									</div>
									{#if canDrag}
										<div class="flex-none text-base-content/50">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												part="handle-icon"
												class="qti-icon qti-go-handle h-5 w-5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M4 6h16M4 12h16M4 18h16"
												/>
											</svg>
										</div>
									{/if}
								</div>
							{/each}
						</div>

						<!-- Confirmation button for WCAG 2.2 SC 3.3.4 compliance -->
						<div part="confirm" class="qti-go-confirm mt-4 pt-3 border-t border-base-300">
							{#if needsConfirmation}
								<button
									type="button"
									class="btn btn-primary btn-sm w-full"
									onclick={confirmOrder}
									aria-label="Confirm this order as your answer"
								>
									{hasReordered ? 'Confirm Order' : 'Confirm Order (No Changes)'}
								</button>
								<p class="text-xs text-base-content/60 mt-2 text-center">
									Drag to reorder, or click to confirm
								</p>
							{:else if hasConfirmed}
								<div class="alert alert-success py-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										part="confirmed-icon"
										class="qti-icon qti-go-confirmed stroke-current shrink-0 w-5 h-5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										></path>
									</svg>
									<span class="text-sm">Order confirmed</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Ensure proper drag and drop visual feedback */
	:global(.qti-graphic-order-interaction [draggable='true']) {
		user-select: none;
		-webkit-user-drag: element;
	}

	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex: 0 0 auto;
	}

	/* Minimal layout so this works without Tailwind utilities */
	.qti-go-layout {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.qti-go-image-area {
		flex: 1 1 480px;
		min-width: 280px;
	}
	.qti-go-panel {
		flex: 0 0 16rem;
		min-width: 16rem;
	}
	.qti-go-stage {
		position: relative;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
	}
	.qti-go-card {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--color-base-100, oklch(100% 0 0));
	}
	.qti-go-card-body {
		padding: 1rem;
	}
	.qti-go-list {
		display: grid;
		gap: 0.5rem;
	}
	.qti-go-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
		transition: border-color 120ms ease, background-color 120ms ease, opacity 120ms ease;
	}
	.qti-go-confirm {
		border-top: 1px solid var(--color-base-300, oklch(95% 0 0));
		padding-top: 0.75rem;
		margin-top: 1rem;
	}
</style>
