<svelte:options customElement="pie-qti-position-object" />

<script lang="ts">
	import type { PositionObjectInteractionData } from '@pie-qti/qti2-item-player';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Position {
		stageId: string;
		x: number;
		y: number;
	}

	interface Props {
		interaction?: PositionObjectInteractionData | string;
		response?: Position[] | null;
		disabled?: boolean;
		onChange?: (value: Position[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<PositionObjectInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<Position[]>(response));

	// Positions stored as {stageId, x, y}
	let positions = $state<Position[]>([]);
	let draggedStageId: string | null = $state(null);
	let draggedPositionIndex: number | null = $state(null);
	let imageContainer: HTMLDivElement | null = $state(null);

	const canInteract = $derived(!disabled);
	const canAddMore = $derived(
		!parsedInteraction || parsedInteraction.maxChoices === 0 || positions.length < parsedInteraction.maxChoices
	);

	$effect(() => {
		// Sync with parent response changes
		positions = parsedResponse ? [...parsedResponse] : [];
	});

	function handleDragStart(event: DragEvent, stageId: string, existingIndex?: number) {
		if (!canInteract) return;
		draggedStageId = stageId;
		draggedPositionIndex = existingIndex ?? null;

		// Set drag image to be the object being dragged
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDrop(event: DragEvent) {
		if (!canInteract || !draggedStageId || !imageContainer) return;

		event.preventDefault();

		// Get drop coordinates relative to the image container
		const rect = imageContainer.getBoundingClientRect();
		let x = event.clientX - rect.left;
		let y = event.clientY - rect.top;

		// If centerPoint is true, adjust coordinates to be at the center
		if (parsedInteraction?.centerPoint) {
			const stage = parsedInteraction.positionObjectStages.find((s) => s.identifier === draggedStageId);
			if (stage?.objectData) {
				const width = parseInt(stage.objectData.width || '50');
				const height = parseInt(stage.objectData.height || '50');
				x -= width / 2;
				y -= height / 2;
			}
		}

		// Check if we're moving an existing position or creating a new one
		if (draggedPositionIndex !== null) {
			// Moving existing position
			positions = positions.map((pos, idx) =>
				idx === draggedPositionIndex ? { ...pos, x, y } : pos
			);
		} else {
			// Creating new position
			if (!parsedInteraction) return;
			const stage = parsedInteraction.positionObjectStages.find((s) => s.identifier === draggedStageId);
			if (!stage) return;

			// Check how many times this stage has been used
			const usageCount = positions.filter((p) => p.stageId === draggedStageId).length;
			if (usageCount >= stage.matchMax) return;

			// Check if we can add more positions
			if (!canAddMore) return;

			positions = [...positions, { stageId: draggedStageId, x, y }];
		}

		response = positions;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(positions);
		// Dispatch custom event for web component usage
		const event2 = new CustomEvent('qti-change', {
			detail: {
				responseId: parsedInteraction?.responseId,
				value: positions,
				timestamp: Date.now(),
			},
			bubbles: true,
			composed: true,
		});
		dispatchEvent(event2);
		draggedStageId = null;
		draggedPositionIndex = null;
	}

	function handleDragOver(event: DragEvent) {
		if (!canInteract) return;
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function removePosition(index: number) {
		if (!canInteract) return;
		positions = positions.filter((_, i) => i !== index);
		response = positions;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(positions);
		// Dispatch custom event for web component usage
		const event = new CustomEvent('qti-change', {
			detail: {
				responseId: parsedInteraction?.responseId,
				value: positions,
				timestamp: Date.now(),
			},
			bubbles: true,
			composed: true,
		});
		dispatchEvent(event);
	}

	function getStageById(id: string) {
		return parsedInteraction?.positionObjectStages.find((s) => s.identifier === id);
	}

	function getStageUsageCount(id: string): number {
		return positions.filter((p) => p.stageId === id).length;
	}

	function canDragStage(id: string): boolean {
		const stage = getStageById(id);
		if (!stage) return false;
		return getStageUsageCount(id) < stage.matchMax;
	}
</script>

<ShadowBaseStyles />

<div class="qti-position-object-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">No interaction data provided</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-po-prompt font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<div part="layout" class="qti-po-layout flex flex-col lg:flex-row gap-4">
			<!-- Canvas Area with Background Image -->
			<div part="canvas-area" class="qti-po-canvas-area flex-1">
				<div
					bind:this={imageContainer}
					part="canvas"
					class="qti-po-canvas relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
					style="width: {parsedInteraction.imageData?.width}px; height: {parsedInteraction.imageData?.height}px;"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				role="region"
				aria-label="Positioning canvas"
			>
				<!-- Background Image -->
				{#if parsedInteraction.imageData}
					{#if parsedInteraction.imageData.type === 'svg' && parsedInteraction.imageData.content}
						<div class="w-full h-full pointer-events-none">
							{@html parsedInteraction.imageData.content}
						</div>
					{:else if parsedInteraction.imageData.src}
						<img
							src={parsedInteraction.imageData.src}
							alt="Positioning background"
							class="w-full h-full object-contain pointer-events-none"
						/>
					{/if}
				{/if}

				<!-- Positioned Objects -->
				{#each positions as position, index}
					{@const stage = getStageById(position.stageId)}
					{#if stage}
						<div
							part="placed"
							class="qti-po-placed absolute cursor-move"
							style="left: {position.x}px; top: {position.y}px; z-index: {10 + index};"
							draggable={canInteract}
							ondragstart={(e) => handleDragStart(e, position.stageId, index)}
							role="button"
							tabindex={canInteract ? 0 : -1}
							aria-label="Positioned {stage.label} at ({position.x}, {position.y})"
						>
							{#if stage.objectData}
								{#if stage.objectData.type === 'svg' && stage.objectData.content}
									<div
										style="width: {stage.objectData.width || '50'}px; height: {stage.objectData
											.height || '50'}px;"
									>
										{@html stage.objectData.content}
									</div>
								{:else if stage.objectData.src}
									<img
										src={stage.objectData.src}
										alt={stage.label}
										style="width: {stage.objectData.width || '50'}px; height: {stage.objectData
											.height || '50'}px;"
										class="pointer-events-none"
									/>
								{/if}
							{:else}
								<!-- Text-only object -->
								<div
									class="px-3 py-2 bg-primary text-primary-content rounded-lg shadow-lg font-medium"
								>
									{stage.label}
								</div>
							{/if}

							{#if canInteract}
								<button
									part="remove"
									class="absolute -top-2 -right-2 btn btn-xs btn-circle btn-error opacity-80 hover:opacity-100"
									onclick={(e) => {
										e.stopPropagation();
										removePosition(index);
									}}
									aria-label="Remove {stage.label}"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										part="remove-icon"
										class="qti-icon-xs h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							{/if}
						</div>
					{/if}
				{/each}
			</div>

			{#if parsedInteraction.minChoices > 0}
				<div class="text-xs text-base-content/60 mt-2">
					Minimum required: {parsedInteraction.minChoices} {#if parsedInteraction.maxChoices > 0}
						| Maximum: {parsedInteraction.maxChoices}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Object Palette -->
		<div part="palette" class="qti-po-palette w-full lg:w-80">
			<div class="qti-po-card card bg-base-100 border border-base-300">
				<div class="qti-po-card-body card-body p-4">
					<h3 class="card-title text-sm">
						Available Objects ({positions.length}{#if parsedInteraction.maxChoices > 0}/{parsedInteraction.maxChoices}{/if})
					</h3>

					<p class="text-xs text-base-content/60 mb-2">Drag objects onto the canvas to position them.</p>

					<div class="space-y-2">
						{#each parsedInteraction.positionObjectStages as stage}
							{@const usageCount = getStageUsageCount(stage.identifier)}
							{@const canDrag = canDragStage(stage.identifier)}
							<div
								part="palette-item"
								class="qti-po-palette-item flex items-center gap-3 p-3 rounded-lg bg-base-200 border border-base-300 {canInteract &&
								canDrag
									? 'cursor-move hover:border-primary'
									: 'opacity-50 cursor-not-allowed'}"
								draggable={canInteract && canDrag}
								ondragstart={(e) => {
									if (canDrag) handleDragStart(e, stage.identifier);
								}}
								role="button"
								tabindex={canInteract && canDrag ? 0 : -1}
								aria-label="{stage.label} ({usageCount}/{stage.matchMax} used)"
							>
								<!-- Object Preview -->
								<div class="qti-po-preview flex-shrink-0">
									{#if stage.objectData}
										{#if stage.objectData.type === 'svg' && stage.objectData.content}
											<div class="w-10 h-10">
												{@html stage.objectData.content}
											</div>
										{:else if stage.objectData.src}
											<img
												src={stage.objectData.src}
												alt={stage.label}
												class="w-10 h-10 object-contain"
											/>
										{/if}
									{:else}
										<div class="w-10 h-10 flex items-center justify-center">
											<span class="text-2xl">📦</span>
										</div>
									{/if}
								</div>

								<!-- Label and Usage -->
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm truncate">{stage.label}</div>
									<div class="text-xs text-base-content/60">
										{usageCount}/{stage.matchMax} used
									</div>
								</div>

								<!-- Drag Indicator -->
								{#if canInteract && canDrag}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										part="drag-icon"
										class="qti-icon qti-po-drag-icon h-5 w-5 text-base-content/40"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 9l4-4 4 4m0 6l-4 4-4-4"
										/>
									</svg>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
		</div>
	{/if}
</div>

<style>
	/* Ensure proper draggable areas */
	:global(.qti-position-object-interaction [draggable='true']) {
		user-select: none;
		-webkit-user-drag: element;
	}

	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex: 0 0 auto;
	}
	.qti-icon-xs {
		width: 0.75rem;
		height: 0.75rem;
		flex: 0 0 auto;
	}

	/* Minimal layout so this works without Tailwind utilities */
	.qti-po-layout {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.qti-po-canvas-area {
		flex: 1 1 520px;
		min-width: 280px;
	}
	.qti-po-canvas {
		position: relative;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
	}
	/* Critical: positioned items must be absolutely positioned even without Tailwind's `absolute` utility */
	.qti-po-placed {
		position: absolute;
	}
	.qti-po-palette {
		flex: 0 0 20rem;
		min-width: 18rem;
	}
	.qti-po-card {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--color-base-100, oklch(100% 0 0));
	}
	.qti-po-card-body {
		padding: 1rem;
	}
	.qti-po-palette-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
	}
</style>
