<script lang="ts">
	import type { PositionObjectInteractionData } from '../types/interactions';

	interface Position {
		stageId: string;
		x: number;
		y: number;
	}

	interface Props {
		interaction: PositionObjectInteractionData;
		response: Position[] | null;
		disabled?: boolean;
		onChange: (value: Position[]) => void;
	}

	let { interaction, response, disabled = false, onChange }: Props = $props();

	// Positions stored as {stageId, x, y}
	let positions = $state<Position[]>([]);
	let draggedStageId: string | null = $state(null);
	let draggedPositionIndex: number | null = $state(null);
	let imageContainer: HTMLDivElement | null = $state(null);

	const canInteract = $derived(!disabled);
	const canAddMore = $derived(
		interaction.maxChoices === 0 || positions.length < interaction.maxChoices
	);

	$effect(() => {
		// Sync with parent response changes
		positions = response ? [...response] : [];
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
		if (interaction.centerPoint) {
			const stage = interaction.positionObjectStages.find((s) => s.identifier === draggedStageId);
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
			const stage = interaction.positionObjectStages.find((s) => s.identifier === draggedStageId);
			if (!stage) return;

			// Check how many times this stage has been used
			const usageCount = positions.filter((p) => p.stageId === draggedStageId).length;
			if (usageCount >= stage.matchMax) return;

			// Check if we can add more positions
			if (!canAddMore) return;

			positions = [...positions, { stageId: draggedStageId, x, y }];
		}

		onChange(positions);
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
		onChange(positions);
	}

	function getStageById(id: string) {
		return interaction.positionObjectStages.find((s) => s.identifier === id);
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

<div class="qti-position-object-interaction">
	{#if interaction.prompt}
		<p class="font-semibold mb-3">{interaction.prompt}</p>
	{/if}

	<div class="flex flex-col lg:flex-row gap-4">
		<!-- Canvas Area with Background Image -->
		<div class="flex-1">
			<div
				bind:this={imageContainer}
				class="relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
				style="width: {interaction.imageData?.width}px; height: {interaction.imageData?.height}px;"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				role="region"
				aria-label="Positioning canvas"
			>
				<!-- Background Image -->
				{#if interaction.imageData}
					{#if interaction.imageData.type === 'svg' && interaction.imageData.content}
						<div class="w-full h-full pointer-events-none">
							{@html interaction.imageData.content}
						</div>
					{:else if interaction.imageData.src}
						<img
							src={interaction.imageData.src}
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
							class="absolute cursor-move"
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
									class="absolute -top-2 -right-2 btn btn-xs btn-circle btn-error opacity-80 hover:opacity-100"
									onclick={(e) => {
										e.stopPropagation();
										removePosition(index);
									}}
									aria-label="Remove {stage.label}"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-3 w-3"
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

			{#if interaction.minChoices > 0}
				<div class="text-xs text-base-content/60 mt-2">
					Minimum required: {interaction.minChoices} {#if interaction.maxChoices > 0}
						| Maximum: {interaction.maxChoices}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Object Palette -->
		<div class="w-full lg:w-80">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body p-4">
					<h3 class="card-title text-sm">
						Available Objects ({positions.length}{#if interaction.maxChoices > 0}/{interaction.maxChoices}{/if})
					</h3>

					<p class="text-xs text-base-content/60 mb-2">Drag objects onto the canvas to position them.</p>

					<div class="space-y-2">
						{#each interaction.positionObjectStages as stage}
							{@const usageCount = getStageUsageCount(stage.identifier)}
							{@const canDrag = canDragStage(stage.identifier)}
							<div
								class="flex items-center gap-3 p-3 rounded-lg bg-base-200 border border-base-300 {canInteract &&
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
								<div class="flex-shrink-0">
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
										class="h-5 w-5 text-base-content/40"
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
</div>

<style>
	/* Ensure proper draggable areas */
	:global(.qti-position-object-interaction [draggable='true']) {
		user-select: none;
		-webkit-user-drag: element;
	}
</style>
