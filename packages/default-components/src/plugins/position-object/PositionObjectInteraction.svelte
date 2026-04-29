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
	import type { PositionObjectInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
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
		correctResponse?: string[] | null; // QTI format: array of "x y" strings
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<PositionObjectInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null && parsedCorrectResponse !== undefined);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Positions stored as {stageId, x, y}
	let positions = $state<Position[]>([]);
	let draggedStageId: string | null = $state(null);
	let draggedPositionIndex: number | null = $state(null);
	// imageContainer / imageContainer are the same element — one binding covers both roles
	let imageContainer: HTMLDivElement | null = $state(null);

	// Keyboard accessibility state (K-04)
	let selectedStageId: string | null = $state(null); // stage currently being keyboard-positioned
	let crosshairX = $state(0.5); // normalized [0,1] x position on background image
	let crosshairY = $state(0.5); // normalized [0,1] y position on background image
	let crosshairActive = $state(false); // whether the crosshair is visible/active
	let liveMessage = $state(''); // message for aria-live region

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
			if (typeof pointStr !== 'string') continue;
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

	/**
	 * Parse correct response points (same format as user response)
	 */
	function parseCorrectPositions(value: string[] | null | undefined): Position[] {
		if (!value || !Array.isArray(value) || value.length === 0) return [];
		if (!parsedInteraction) return [];

		const stages = parsedInteraction.positionObjectStages || [];
		const correctPositions: Position[] = [];

		for (let i = 0; i < value.length; i++) {
			const pointStr = value[i];
			if (typeof pointStr !== 'string') continue;
			const parts = pointStr.trim().split(/\s+/);
			if (parts.length >= 2) {
				const x = parseFloat(parts[0]);
				const y = parseFloat(parts[1]);

				// Determine which stage this point belongs to (same logic as user response)
				let stageId = '';
				if (stages.length === 1) {
					stageId = stages[0].identifier;
				} else {
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
					correctPositions.push({ stageId, x, y });
				}
			}
		}

		return correctPositions;
	}

	const correctPositions = $derived(
		isShowingCorrect ? parseCorrectPositions(parsedCorrectResponse) : []
	);

	/**
	 * Check if a user position matches a correct position (within tolerance)
	 */
	function isPositionCorrect(pos: Position): boolean {
		if (!isShowingCorrect) return false;
		return correctPositions.some(
			(correct) =>
				correct.stageId === pos.stageId &&
				Math.abs(correct.x - pos.x) < 5 &&
				Math.abs(correct.y - pos.y) < 5
		);
	}

	/**
	 * Check if a correct position is already placed by the user
	 */
	function isCorrectPositionPlaced(correctPos: Position): boolean {
		return positions.some(
			(pos) =>
				pos.stageId === correctPos.stageId &&
				Math.abs(pos.x - correctPos.x) < 5 &&
				Math.abs(pos.y - correctPos.y) < 5
		);
	}

	// ---------------------------------------------------------------------------
	// Keyboard accessibility (K-04) — two-phase: palette select → canvas place
	// ---------------------------------------------------------------------------

	/**
	 * Activate keyboard placement mode for a palette stage.
	 * Phase 1: user presses Enter/Space on a palette item.
	 */
	function activateKeyboardPlacement(stageId: string) {
		if (!canInteract) return;
		const stage = getStageById(stageId);
		if (!stage || !canDragStage(stageId)) return;

		selectedStageId = stageId;
		crosshairActive = true;

		// Initialise crosshair to the stage's last placed position, or centre
		const existing = [...positions].reverse().find((p: Position) => p.stageId === stageId);
		if (existing && parsedInteraction?.imageData) {
			const imgW = Number(parsedInteraction.imageData.width) || 1;
			const imgH = Number(parsedInteraction.imageData.height) || 1;
			crosshairX = Math.max(0, Math.min(1, existing.x / imgW));
			crosshairY = Math.max(0, Math.min(1, existing.y / imgH));
		} else {
			crosshairX = 0.5;
			crosshairY = 0.5;
		}

		liveMessage = `${stage.label} selected. Tab to canvas, then use arrow keys to position. Press Enter to place, Escape to cancel.`;

		// Move focus to the canvas so arrow keys work immediately
		requestAnimationFrame(() => imageContainer?.focus());
	}

	/**
	 * Handle keydown on a palette item.
	 */
	function handlePaletteKeydown(event: KeyboardEvent, stageId: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			activateKeyboardPlacement(stageId);
		}
	}

	/**
	 * Place the currently selected stage at the crosshair position.
	 */
	function placeAtCrosshair() {
		if (!selectedStageId || !parsedInteraction?.imageData) return;

		const imgW = Number(parsedInteraction.imageData.width) || 800;
		const imgH = Number(parsedInteraction.imageData.height) || 600;

		let x = crosshairX * imgW;
		let y = crosshairY * imgH;

		// Apply centerPoint adjustment (same logic as mouse drop)
		if (parsedInteraction.centerPoint) {
			const stage = getStageById(selectedStageId);
			if (stage?.objectData) {
				x -= parseInt(stage.objectData.width || '50') / 2;
				y -= parseInt(stage.objectData.height || '50') / 2;
			}
		}

		const stage = getStageById(selectedStageId);
		if (!stage) return;

		// Check stage capacity
		const usageCount = getStageUsageCount(selectedStageId);
		if (usageCount >= stage.matchMax) return;
		if (!canAddMore) return;

		positions = [...positions, { stageId: selectedStageId, x, y }];

		const responseValue = positions.map((pos) => `${Math.round(pos.x)} ${Math.round(pos.y)}`);
		response = responseValue;
		onChange?.(responseValue);
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, responseValue));
		}

		const pct = (v: number) => Math.round(v * 100);
		liveMessage = `${stage.label} placed at ${pct(crosshairX)}%, ${pct(crosshairY)}%.`;

		selectedStageId = null;
		crosshairActive = false;
	}

	/**
	 * Handle keydown on the canvas when in keyboard placement mode.
	 */
	function handleCanvasKeydown(event: KeyboardEvent) {
		if (!crosshairActive || !selectedStageId) return;

		const step = event.shiftKey ? 0.01 : 0.05;

		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				crosshairX = Math.max(0, crosshairX - step);
				break;
			case 'ArrowRight':
				event.preventDefault();
				crosshairX = Math.min(1, crosshairX + step);
				break;
			case 'ArrowUp':
				event.preventDefault();
				crosshairY = Math.max(0, crosshairY - step);
				break;
			case 'ArrowDown':
				event.preventDefault();
				crosshairY = Math.min(1, crosshairY + step);
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				placeAtCrosshair();
				return;
			case 'Escape':
				event.preventDefault();
				selectedStageId = null;
				crosshairActive = false;
				liveMessage = 'Placement cancelled.';
				return;
			default:
				return;
		}

		// Announce updated position after arrow movement
		const pct = (v: number) => Math.round(v * 100);
		liveMessage = `Position: ${pct(crosshairX)}%, ${pct(crosshairY)}%.`;
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
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					bind:this={imageContainer}
					part="canvas"
					class="qti-po-canvas relative border-2 border-base-300 rounded-lg overflow-hidden bg-base-200 {crosshairActive ? 'qti-po-canvas-active' : ''}"
					style="width: 100%; aspect-ratio: {parsedInteraction.imageData?.width || 800} / {parsedInteraction.imageData?.height || 600}; box-sizing: border-box;"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				onkeydown={handleCanvasKeydown}
				role="application"
				tabindex={crosshairActive ? 0 : -1}
				aria-label={crosshairActive
					? (i18n?.t('interactions.positionObject.canvasActiveLabel') ?? `Positioning canvas – use arrow keys to move crosshair, Enter to place, Escape to cancel`)
					: (i18n?.t('interactions.positionObject.canvasLabel') ?? 'Positioning canvas')}
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
					{@const isCorrect = isPositionCorrect(position)}
					{#if stage}
						<div
							part="placed"
							class="qti-po-placed absolute cursor-move {isCorrect ? 'qti-po-placed-correct' : ''}"
							style="left: {position.x * scaleFactor}px; top: {position.y * scaleFactor}px; z-index: {10 + index}; transform-origin: top left;"
							draggable={canInteract}
							ondragstart={(e) => handleDragStart(e, position.stageId, index)}
							role="button"
							tabindex={canInteract ? 0 : -1}
							aria-label="Positioned {stage.label} at ({position.x}, {position.y}){isCorrect ? '. Correct position' : ''}"
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
									class="px-3 py-2 rounded-lg shadow-lg font-medium {isCorrect ? 'bg-success text-white' : 'bg-primary text-primary-content'}"
								>
									{stage.label}
								</div>
							{/if}

							{#if isCorrect}
								<span class="badge badge-success badge-xs absolute -top-1 -right-1">✓</span>
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

				<!-- Render correct positions that haven't been placed by the user -->
				{#if isShowingCorrect && correctPositions.length > 0}
					{#each correctPositions as correctPos, index}
						{@const stage = getStageById(correctPos.stageId)}
						{@const isPlaced = isCorrectPositionPlaced(correctPos)}
						{#if stage && !isPlaced}
							<div
								part="correct-placed"
								class="qti-po-placed qti-po-placed-correct qti-po-placed-ghost absolute pointer-events-none"
								style="left: {correctPos.x * scaleFactor}px; top: {correctPos.y * scaleFactor}px; z-index: {5 + index}; transform-origin: top left;"
								aria-label="Correct position for {stage.label} at ({correctPos.x}, {correctPos.y})"
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
										class="px-3 py-2 bg-success text-white rounded-lg shadow-lg font-medium opacity-60"
									>
										{stage.label}
									</div>
								{/if}
								<span class="badge badge-success badge-xs absolute -top-1 -right-1">✓</span>
							</div>
						{/if}
					{/each}
				{/if}

				<!-- Keyboard crosshair overlay (K-04) -->
				{#if crosshairActive}
					<svg
						class="qti-po-crosshair-overlay"
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
					>
						<!-- vertical line -->
						<line
							x1="{crosshairX * 100}%"
							y1="0"
							x2="{crosshairX * 100}%"
							y2="100%"
							class="qti-po-crosshair-line"
						/>
						<!-- horizontal line -->
						<line
							x1="0"
							y1="{crosshairY * 100}%"
							x2="100%"
							y2="{crosshairY * 100}%"
							class="qti-po-crosshair-line"
						/>
						<!-- centre dot -->
						<circle
							cx="{crosshairX * 100}%"
							cy="{crosshairY * 100}%"
							r="6"
							class="qti-po-crosshair-dot"
						/>
					</svg>
				{/if}
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

					<p class="text-xs text-base-content/60 mb-2">Drag objects onto the canvas, or press Enter/Space on an object then use arrow keys to position it on the canvas.</p>

					<div class="space-y-2">
						{#each parsedInteraction.positionObjectStages as stage}
							{@const usageCount = getStageUsageCount(stage.identifier)}
							{@const canDrag = canDragStage(stage.identifier)}
							<div
								part="palette-item"
								class="qti-po-palette-item flex items-center gap-3 p-3 rounded-lg bg-base-200 border border-base-300 {canInteract && canDrag ? 'cursor-move hover:border-primary' : 'opacity-50 cursor-not-allowed'} {selectedStageId === stage.identifier ? 'qti-po-palette-item-selected' : ''}"
								draggable={canInteract && canDrag}
								ondragstart={(e) => {
									if (canDrag) handleDragStart(e, stage.identifier);
								}}
								onkeydown={(e) => handlePaletteKeydown(e, stage.identifier)}
								role="button"
								tabindex={canInteract && canDrag ? 0 : -1}
								aria-label="{stage.label} ({usageCount}/{stage.matchMax} used){selectedStageId === stage.identifier ? '. Selected for placement' : ''}"
								aria-pressed={selectedStageId === stage.identifier}
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

	<!-- Visually-hidden live region for keyboard placement announcements (K-04) -->
	<div aria-live="polite" aria-atomic="true" class="qti-po-sr-only">{liveMessage}</div>
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

	.qti-po-placed-correct {
		border: 3px solid var(--color-success, oklch(76% 0.177 163.223));
		border-radius: 4px;
		box-shadow: 0 0 0 2px var(--color-success, oklch(76% 0.177 163.223)) inset;
	}

	.qti-po-placed-ghost {
		opacity: 0.6;
		border: 3px dashed var(--color-success, oklch(76% 0.177 163.223));
		border-radius: 4px;
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

	/* Selected palette item (K-04) */
	.qti-po-palette-item-selected {
		border-color: var(--color-primary, oklch(49.12% 0.3096 275.75));
		background: var(--color-primary, oklch(49.12% 0.3096 275.75));
		color: var(--color-primary-content, oklch(89.824% 0.06192 275.75));
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary, oklch(49.12% 0.3096 275.75)) 40%, transparent);
	}

	/* Canvas active state ring (K-04) */
	.qti-po-canvas-active {
		outline: 3px solid var(--color-primary, oklch(49.12% 0.3096 275.75));
		outline-offset: 2px;
	}
	.qti-po-canvas-active:focus {
		outline: 3px solid var(--color-primary, oklch(49.12% 0.3096 275.75));
		outline-offset: 2px;
	}

	/* Crosshair SVG overlay (K-04) */
	.qti-po-crosshair-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 100;
	}
	.qti-po-crosshair-line {
		stroke: var(--color-primary, oklch(49.12% 0.3096 275.75));
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
		opacity: 0.85;
	}
	.qti-po-crosshair-dot {
		fill: var(--color-primary, oklch(49.12% 0.3096 275.75));
		stroke: white;
		stroke-width: 2;
		opacity: 0.95;
	}

	/* Visually hidden live region (K-04) */
	.qti-po-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
