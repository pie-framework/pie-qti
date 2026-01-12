<svelte:options customElement="pie-qti-position-object" />

<!--
	QTI 2.2 Position Object Interaction Component

	⚠️ IMPORTANT LIMITATIONS ⚠️

	This interaction type has severe limitations in the QTI 2.2 specification that make it
	impractical for most educational use cases. After extensive research, we found:

	1. NO real-world implementations beyond the official spec example
	2. NOT included in QTI 3.0 shared vocabulary/styling guide (likely deprecated)
	3. Major QTI platforms (TAO, Citolab) show no prominent support
	4. Only suitable for very narrow use cases

	THE CORE PROBLEM:
	- Response format is baseType="point" which only stores coordinates: ["158 168", "210 195"]
	- There is NO way to track WHICH object was placed WHERE
	- The spec only supports placing multiple copies of the SAME object (like airport icons)
	- It CANNOT support the obvious use case: "Place these labeled cities on the map"

	SPEC-COMPLIANT USAGE (Airport Example):
	- One draggable object (airport icon) that can be placed multiple times
	- Response is just an array of coordinates
	- Scoring uses areaMapping to check if ANY placement hits target zones
	- No object identity tracking needed

	NON-STANDARD EXTENSION (Current Implementation):
	- This component supports multiple positionObjectStage elements with identifiers
	- It tracks which stage (object) is at which position internally
	- BUT the QTI response format cannot preserve this information
	- On reload, objects are mapped to positions by array order (best effort)

	RECOMMENDATION:
	For labeled-object placement scenarios, use graphicGapMatchInteraction instead,
	which uses baseType="directedPair" to properly track object+location pairs.

	This implementation exists for QTI 2.2 compatibility but has limited practical utility.
-->

<script lang="ts">
	import type { PositionObjectInteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import DragHandle from '../../shared/components/DragHandle.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';

	interface Position {
		stageId: string;
		x: number;
		y: number;
	}

	interface Props {
		interaction?: PositionObjectInteractionData | string;
		response?: string[] | null; // QTI format: array of "x y" strings
		disabled?: boolean;
		i18n?: I18nProvider;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<PositionObjectInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Positions stored as {stageId, x, y}
	let positions = $state<Position[]>([]);
	let draggedStageId: string | null = $state(null);
	let draggedPositionIndex: number | null = $state(null);
	let imageContainer: HTMLDivElement | null = $state(null);

	const canInteract = $derived(!disabled);
	const canAddMore = $derived(
		!parsedInteraction || parsedInteraction.maxChoices === 0 || positions.length < parsedInteraction.maxChoices
	);

	// Calculate scale factor based on actual vs original image dimensions
	const scaleFactor = $derived.by(() => {
		if (!imageContainer || !parsedInteraction?.imageData?.width) return 1;
		const actualWidth = imageContainer.offsetWidth;
		const originalWidth = Number(parsedInteraction.imageData.width);
		return actualWidth / originalWidth;
	});

	$effect(() => {
		// Sync with parent response changes - convert QTI point format back to internal Position format
		// NOTE: This is best-effort reconstruction since QTI baseType="point" doesn't store object identity
		// We map points to stages by array order, which works for single-stage scenarios but may
		// produce incorrect results for multi-stage scenarios if objects were placed in different order
		if (!parsedResponse || parsedResponse.length === 0) {
			positions = [];
			return;
		}

		// Convert QTI point strings ("x y") back to Position objects with stageIds
		// Map each point to stages in order - assumes response array order matches stage order
		const newPositions: Position[] = [];
		const stages = parsedInteraction?.positionObjectStages || [];

		for (let i = 0; i < parsedResponse.length; i++) {
			const pointStr = parsedResponse[i];
			const parts = pointStr.trim().split(/\s+/);
			if (parts.length >= 2) {
				const x = parseFloat(parts[0]);
				const y = parseFloat(parts[1]);

				// Determine which stage this point belongs to
				// For simple cases with one stage, all points belong to that stage
				// For multiple stages, we need to map based on order and matchMax constraints
				let stageId = '';
				if (stages.length === 1) {
					// Single stage - all points belong to it
					stageId = stages[0].identifier;
				} else {
					// Multiple stages - distribute points based on stage order and matchMax
					let pointIndex = 0;
					for (const stage of stages) {
						if (pointIndex + stage.matchMax > i) {
							stageId = stage.identifier;
							break;
						}
						pointIndex += stage.matchMax;
					}
				}

				if (stageId && !isNaN(x) && !isNaN(y)) {
					newPositions.push({ stageId, x, y });
				}
			}
		}

		positions = newPositions;
	});

	function handleDragStart(event: DragEvent, stageId: string, existingIndex?: number) {
		if (!canInteract) return;
		draggedStageId = stageId;
		draggedPositionIndex = existingIndex ?? null;

		// Set drag image to be the object being dragged
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';

			// Create a custom drag image at full size
			const stage = getStageById(stageId);
			if (stage?.objectData) {
				const width = parseInt(stage.objectData.width || '50');
				const height = parseInt(stage.objectData.height || '50');

				// Create a temporary element for the drag image
				const dragImage = document.createElement('div');
				dragImage.style.position = 'absolute';
				dragImage.style.left = '-9999px';
				dragImage.style.width = `${width}px`;
				dragImage.style.height = `${height}px`;

				if (stage.objectData.type === 'svg' && stage.objectData.content) {
					dragImage.innerHTML = stage.objectData.content;
				} else if (stage.objectData.src) {
					const img = document.createElement('img');
					img.src = stage.objectData.src;
					img.style.width = '100%';
					img.style.height = '100%';
					dragImage.appendChild(img);
				}

				document.body.appendChild(dragImage);
				event.dataTransfer.setDragImage(dragImage, width / 2, height / 2);

				// Clean up after a short delay
				setTimeout(() => document.body.removeChild(dragImage), 0);
			}
		}
	}

	function handleDrop(event: DragEvent) {
		if (!canInteract || !draggedStageId || !imageContainer) return;

		event.preventDefault();

		// Get drop coordinates relative to the image container
		const rect = imageContainer.getBoundingClientRect();
		let x = event.clientX - rect.left;
		let y = event.clientY - rect.top;

		// Convert scaled coordinates back to original image coordinates
		x = x / scaleFactor;
		y = y / scaleFactor;

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

		// Convert positions to QTI point format (space-separated "x y" strings)
		// QTI baseType="point" expects array of strings like ["158 168", "250 200"]
		const responseValue = positions.map(pos => `${Math.round(pos.x)} ${Math.round(pos.y)}`);

		console.log('[PositionObject] Emitting response:', {
			responseId: parsedInteraction?.responseId,
			value: responseValue,
			positions: positions
		});

		response = responseValue;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(responseValue);
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, responseValue));
		}
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

		// Convert positions to QTI point format (space-separated "x y" strings)
		// QTI baseType="point" expects array of strings like ["158 168", "250 200"]
		const responseValue = positions.map(pos => `${Math.round(pos.x)} ${Math.round(pos.y)}`);

		response = responseValue;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(responseValue);
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, responseValue));
		}
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

<div bind:this={rootElement} part="root" class="qti-position-object-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-po-prompt font-semibold mb-3">{@html parsedInteraction.prompt}</p>
		{/if}

		<div part="layout" class="qti-po-layout flex flex-col lg:flex-row gap-4 items-start">
			<!-- Canvas Area with Background Image -->
			<div part="canvas-area" class="qti-po-canvas-area flex-1 min-w-0">
				<div
					bind:this={imageContainer}
					part="canvas"
					class="qti-po-canvas relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200"
					style="width: 100%; aspect-ratio: {parsedInteraction.imageData?.width || 800} / {parsedInteraction.imageData?.height || 600}; box-sizing: border-box;"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				role="region"
				aria-label={i18n?.t('interactions.positionObject.canvasLabel') ?? 'Positioning canvas'}
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
							alt={i18n?.t('interactions.positionObject.backgroundAlt') ?? 'Positioning background'}
							class="pointer-events-none"
							style="display: block; width: 100%; height: 100%; object-fit: contain;"
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
							style="left: {position.x * scaleFactor}px; top: {position.y * scaleFactor}px; z-index: {10 + index}; transform-origin: top left;"
							draggable={canInteract}
							ondragstart={(e) => handleDragStart(e, position.stageId, index)}
							role="button"
							tabindex={canInteract ? 0 : -1}
							aria-label="Positioned {stage.label} at ({position.x}, {position.y})"
						>
							{#if stage.objectData}
								{#if stage.objectData.type === 'svg' && stage.objectData.content}
									<div
										style="width: {(parseInt(stage.objectData.width || '50')) * scaleFactor}px; height: {(parseInt(stage.objectData.height || '50')) * scaleFactor}px;"
									>
										{@html stage.objectData.content}
									</div>
								{:else if stage.objectData.src}
									<img
										src={stage.objectData.src}
										alt={stage.label}
										style="width: {(parseInt(stage.objectData.width || '50')) * scaleFactor}px; height: {(parseInt(stage.objectData.height || '50')) * scaleFactor}px;"
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
		<div part="palette" class="qti-po-palette w-full lg:w-auto lg:flex-1 lg:min-w-[18rem]">
			<div class="qti-po-card card bg-base-100 border border-base-300 h-full">
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
											<div class="w-10 h-10" data-drag-preview>
												{@html stage.objectData.content}
											</div>
										{:else if stage.objectData.src}
											<img
												src={stage.objectData.src}
												alt={stage.label}
												class="w-10 h-10 object-contain qti-po-preview-image"
												data-drag-preview
											/>
										{/if}
									{:else}
										<div class="w-10 h-10 flex items-center justify-center" data-drag-preview>
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
									<DragHandle size={1.25} opacity={0.4} />
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
		align-items: flex-start;
	}
	.qti-po-canvas-area {
		flex: 1 1 0;
		min-width: 280px;
	}
	.qti-po-canvas {
		position: relative;
		border-radius: 0.75rem;
		overflow: hidden;
		border: 2px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
		width: 100%;
	}
	/* Critical: positioned items must be absolutely positioned even without Tailwind's `absolute` utility */
	.qti-po-placed {
		position: absolute;
	}
	.qti-po-palette {
		flex: 1 1 0;
		min-width: 18rem;
	}
	.qti-po-card {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--color-base-100, oklch(100% 0 0));
		height: 100%;
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
