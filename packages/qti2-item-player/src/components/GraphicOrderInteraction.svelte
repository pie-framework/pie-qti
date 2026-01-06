<script lang="ts">
	import type { GraphicOrderInteractionData } from '../types/interactions';

	interface Props {
		interaction: GraphicOrderInteractionData;
		response: string[] | null;
		disabled?: boolean;
		onChange: (value: string[]) => void;
	}

	let { interaction, response, disabled = false, onChange }: Props = $props();

	let orderedIds = $state<string[]>([]);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);
	let draggedItemId: string | null = $state(null);
	let dragOverIndex: number | null = $state(null);

	const canDrag = $derived(!disabled);

	$effect(() => {
		// Sync with parent response changes
		orderedIds = response ? [...response] : interaction.hotspotChoices.map((c) => c.identifier);
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
		onChange(orderedIds);

		draggedItemId = null;
		dragOverIndex = null;
	}

	function handleDragEnd() {
		draggedItemId = null;
		dragOverIndex = null;
	}

	function getChoiceByIdentifier(identifier: string) {
		return interaction.hotspotChoices.find((c) => c.identifier === identifier);
	}
</script>

<div class="qti-graphic-order-interaction">
	{#if interaction.prompt}
		<p class="font-semibold mb-3">{interaction.prompt}</p>
	{/if}

	<div class="flex flex-col md:flex-row gap-4">
		<!-- Image Area -->
		<div class="flex-1">
			<div
				bind:this={imageContainer}
				class="relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
			>
				{#if interaction.imageData}
					{#if interaction.imageData.type === 'svg' && interaction.imageData.content}
						<div
							bind:this={imageElement}
							class="w-full h-auto"
							style="width: {interaction.imageData.width}px; height: {interaction.imageData.height}px;"
						>
							{@html interaction.imageData.content}
						</div>
					{:else if interaction.imageData.src}
						<img
							bind:this={imageElement}
							src={interaction.imageData.src}
							alt="Ordering diagram"
							class="w-full h-auto"
							style="width: {interaction.imageData.width}px; height: {interaction.imageData
								.height}px;"
						/>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Ordering Area -->
		<div class="w-full md:w-64">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<h3 class="card-title text-sm">Order (drag to reorder)</h3>
					<div class="space-y-2">
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
								class="flex items-center gap-2 p-3 rounded-lg border-2 transition-all {isDragging
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
											class="h-5 w-5"
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
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Ensure proper drag and drop visual feedback */
	:global(.qti-graphic-order-interaction [draggable='true']) {
		user-select: none;
		-webkit-user-drag: element;
	}
</style>
