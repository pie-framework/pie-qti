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

	RESPONSE POINT:
	- Each point is the position, in the stage image's natural pixel space, of the
	  object's reference point (QTI `centerPoint`: "the point on the image being
	  positioned that is to be treated as the centre as an offset from the top-left
	  corner of the image ... By default this is the centre of the image's bounding
	  rectangle"). Objects render with that point on their recorded point, and a
	  dragged object is held by it, so the recorded value is what the candidate sees.

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
	import type { PositionObjectInteractionData, PositionObjectStage } from '@pie-qti/item-player';
	import { touchDrag } from '@pie-qti/qti-common';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { normalizePixelDimension } from '@pie-qti/item-player/security';
	import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import DragHandle from '../../shared/components/DragHandle.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import { imageAltText } from '../hotspot/graphicRegions';

	interface Position {
		stageId: string;
		/** The object's centre point, in the stage image's natural pixel space. */
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

	const uid = $props.id();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<PositionObjectInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null && parsedCorrectResponse !== undefined);
	const imageWidth = $derived(
		Number(normalizePixelDimension(parsedInteraction?.imageData?.width, '800') ?? '800'),
	);
	const imageHeight = $derived(
		Number(normalizePixelDimension(parsedInteraction?.imageData?.height, '600') ?? '600'),
	);
	// The authored reference point (QTI centerPoint), in object image pixels from
	// its top-left; null means the QTI default, the object's centre.
	const centerPoint = $derived(validCenterPoint(parsedInteraction?.centerPoint));

	const imageData = $derived(parsedInteraction?.imageData ?? null);
	const imageAlt = $derived(
		imageAltText(imageData, translate(i18n, 'interactions.positionObject.imageFallback', 'Image for this question')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`${uid}-image-description`);
	let failedSrc = $state<string | null>(null);
	const imageFailed = $derived(!!imageData?.src && failedSrc === imageData.src);

	function handleImageError() {
		failedSrc = imageData?.src ?? null;
		console.warn(`[pie-qti-position-object] The stage image failed to load: ${imageData?.src ?? ''}`);
	}

	function objectDimension(value: unknown): number {
		return Number(normalizePixelDimension(value, '50') ?? '50');
	}

	/**
	 * Validate the reference point: hosts may hand the web component JSON, and
	 * anything but a finite point means the QTI default.
	 */
	function validCenterPoint(value: unknown): { x: number; y: number } | null {
		if (!value || typeof value !== 'object') return null;
		const { x, y } = value as { x?: unknown; y?: unknown };
		return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y) ? { x, y } : null;
	}

	/**
	 * Where an object's reference point sits within it, as fractions of its
	 * size: the authored centerPoint, else the centre of its bounding rectangle
	 * (the QTI default). A text-only object has no image space, so it uses its
	 * centre.
	 */
	function referenceFraction(stage: PositionObjectStage): { x: number; y: number } {
		if (!centerPoint || !stage.objectData) return { x: 0.5, y: 0.5 };
		return {
			x: centerPoint.x / objectDimension(stage.objectData.width),
			y: centerPoint.y / objectDimension(stage.objectData.height),
		};
	}

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Positions stored as {stageId, x, y}
	let positions = $state<Position[]>([]);
	let draggedStageId: string | null = $state(null);
	let draggedPositionIndex: number | null = $state(null);
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

	/** Map a QTI point string ("x y") to a stage, by response order (QTI points carry no object identity). */
	function parsePositions(value: unknown): Position[] {
		if (!Array.isArray(value) || value.length === 0) return [];
		const stages = parsedInteraction?.positionObjectStages || [];
		const parsed: Position[] = [];

		for (let i = 0; i < value.length; i++) {
			const pointStr = value[i];
			if (typeof pointStr !== 'string') continue;
			const parts = pointStr.trim().split(/\s+/);
			if (parts.length < 2) continue;
			const x = parseFloat(parts[0]);
			const y = parseFloat(parts[1]);

			// For simple cases with one stage, all points belong to that stage. For
			// multiple stages, distribute by stage order and matchMax.
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

			if (stageId && !Number.isNaN(x) && !Number.isNaN(y)) {
				parsed.push({ stageId, x, y });
			}
		}
		return parsed;
	}

	$effect(() => {
		// Sync with parent response changes (best-effort object identity, see parsePositions)
		positions = parsePositions(parsedResponse);
	});

	function getStageById(id: string) {
		return parsedInteraction?.positionObjectStages.find((s) => s.identifier === id);
	}

	/** The object's name: its authored text alternative, else a localized generic name. Never its identifier. */
	function stageName(stage: PositionObjectStage | undefined): string {
		if (!stage) return '';
		const index = parsedInteraction?.positionObjectStages.indexOf(stage) ?? -1;
		return (
			stage.label?.trim() ||
			translate(i18n, 'interactions.positionObject.objectFallback', 'Object {index}', { index: index + 1 })
		);
	}

	function getStageUsageCount(id: string): number {
		return positions.filter((p) => p.stageId === id).length;
	}

	function canDragStage(id: string): boolean {
		const stage = getStageById(id);
		if (!stage) return false;
		return getStageUsageCount(id) < stage.matchMax;
	}

	function emitPositions() {
		// QTI baseType="point" expects array of strings like ["158 168", "250 200"]
		const responseValue = positions.map((pos) => `${Math.round(pos.x)} ${Math.round(pos.y)}`);
		response = responseValue;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: responseValue, onChange });
	}

	/**
	 * Map a pointer position on the rendered (scaled) stage to the stage image's
	 * natural pixel space, clamped to the image.
	 */
	function stagePointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
		if (!imageContainer) return null;
		const rect = imageContainer.getBoundingClientRect();
		if (!(rect.width > 0) || !(rect.height > 0)) return null;
		return {
			x: Math.min(imageWidth, Math.max(0, ((clientX - rect.left) / rect.width) * imageWidth)),
			y: Math.min(imageHeight, Math.max(0, ((clientY - rect.top) / rect.height) * imageHeight)),
		};
	}

	/** Place a new instance of `stageId` with its reference point at (x, y). */
	function placeStageAt(stageId: string, x: number, y: number): boolean {
		const stage = getStageById(stageId);
		if (!stage) return false;
		if (getStageUsageCount(stageId) >= stage.matchMax) return false;
		if (!canAddMore) return false;
		positions = [...positions, { stageId, x, y }];
		emitPositions();
		return true;
	}

	function handleDragStart(event: DragEvent, stageId: string, existingIndex?: number) {
		if (!canInteract) return;
		draggedStageId = stageId;
		draggedPositionIndex = existingIndex ?? null;

		// Set drag image to be the object being dragged, at its rendered size, held by its reference point
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';

			const stage = getStageById(stageId);
			if (stage?.objectData) {
				const renderScale = imageContainer ? imageContainer.getBoundingClientRect().width / imageWidth || 1 : 1;
				const width = objectDimension(stage.objectData.width) * renderScale;
				const height = objectDimension(stage.objectData.height) * renderScale;

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
					img.alt = '';
					img.style.width = '100%';
					img.style.height = '100%';
					dragImage.appendChild(img);
				}

				document.body.appendChild(dragImage);
				// The pointer holds the reference point: where it is released is the
				// recorded point, and the object renders with that point there.
				const reference = referenceFraction(stage);
				event.dataTransfer.setDragImage(dragImage, width * reference.x, height * reference.y);

				// Clean up after a short delay
				setTimeout(() => dragImage.remove(), 0);
			}
		}
	}

	function handleDrop(event: DragEvent) {
		if (!canInteract || !draggedStageId) return;

		event.preventDefault();

		// The pointer marks the object's reference point (held under the pointer)
		const point = stagePointFromClient(event.clientX, event.clientY);
		if (point) {
			if (draggedPositionIndex !== null) {
				// Moving an existing object
				const movingIndex = draggedPositionIndex;
				positions = positions.map((pos, idx) => (idx === movingIndex ? { ...pos, ...point } : pos));
				emitPositions();
			} else {
				placeStageAt(draggedStageId, point.x, point.y);
			}
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

	function handleDragEnd() {
		draggedStageId = null;
		draggedPositionIndex = null;
	}

	function removePosition(index: number) {
		if (!canInteract) return;
		const removed = positions[index];
		positions = positions.filter((_, i) => i !== index);
		emitPositions();
		if (removed) {
			liveMessage = translate(i18n, 'interactions.positionObject.objectRemoved', '{object} removed.', {
				object: stageName(getStageById(removed.stageId)),
			});
		}
	}

	const correctPositions = $derived(isShowingCorrect ? parsePositions(parsedCorrectResponse) : []);

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

	/**
	 * Placement box of an object in percentages of the stage, so it scales with
	 * the stage. The box's top-left sits on the point, then shifts back by the
	 * reference point so that point (not the corner) lands on the recorded point.
	 */
	function objectBoxStyle(stage: PositionObjectStage, position: { x: number; y: number }, zIndex: number): string {
		const width = stage.objectData ? `${(objectDimension(stage.objectData.width) / imageWidth) * 100}%` : 'auto';
		const height = stage.objectData ? `${(objectDimension(stage.objectData.height) / imageHeight) * 100}%` : 'auto';
		const reference = referenceFraction(stage);
		return [
			`left: ${(position.x / imageWidth) * 100}%`,
			`top: ${(position.y / imageHeight) * 100}%`,
			`width: ${width}`,
			`height: ${height}`,
			`z-index: ${zIndex}`,
			`transform: translate(${-reference.x * 100 || 0}%, ${-reference.y * 100 || 0}%)`,
		].join('; ');
	}

	function percent(value: number, total: number): number {
		return total > 0 ? Math.round((value / total) * 100) : 0;
	}

	// ---------------------------------------------------------------------------
	// Keyboard and single-pointer placement (K-04): select in the palette, then
	// position on the canvas (arrow keys + Enter, or a click/tap) — no dragging needed.
	// ---------------------------------------------------------------------------

	/**
	 * Select a palette object for placement and move focus to the canvas.
	 */
	async function activateKeyboardPlacement(stageId: string) {
		if (!canInteract) return;
		const stage = getStageById(stageId);
		if (!stage || !canDragStage(stageId)) return;

		selectedStageId = stageId;
		crosshairActive = true;

		// Initialise crosshair to the stage's last placed position, or centre
		const existing = [...positions].reverse().find((p: Position) => p.stageId === stageId);
		if (existing) {
			crosshairX = Math.max(0, Math.min(1, existing.x / imageWidth));
			crosshairY = Math.max(0, Math.min(1, existing.y / imageHeight));
		} else {
			crosshairX = 0.5;
			crosshairY = 0.5;
		}

		liveMessage = translate(
			i18n,
			'interactions.positionObject.objectSelected',
			'{object} selected. Tab to the canvas, then use the arrow keys to position it. Press Enter to place it or Escape to cancel.',
			{ object: stageName(stage) },
		);

		// Move focus to the canvas so arrow keys work immediately
		await tick();
		imageContainer?.focus();
	}

	/**
	 * Handle keydown on a palette item.
	 */
	function handlePaletteKeydown(event: KeyboardEvent, stageId: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void activateKeyboardPlacement(stageId);
		}
	}

	function finishPlacement(stageId: string, x: number, y: number) {
		const stage = getStageById(stageId);
		if (!stage || !placeStageAt(stageId, x, y)) return;
		liveMessage = translate(i18n, 'interactions.positionObject.objectPlacedAt', '{object} placed at {x}%, {y}%.', {
			object: stageName(stage),
			x: percent(x, imageWidth),
			y: percent(y, imageHeight),
		});
		selectedStageId = null;
		crosshairActive = false;
	}

	/**
	 * Place the currently selected stage at the crosshair position.
	 */
	function placeAtCrosshair() {
		if (!selectedStageId || !parsedInteraction?.imageData) return;
		finishPlacement(selectedStageId, crosshairX * imageWidth, crosshairY * imageHeight);
	}

	/** Single-pointer alternative to dragging (WCAG 2.5.7): click/tap the canvas to place the selected object. */
	function handleCanvasClick(event: MouseEvent) {
		if (!canInteract || !selectedStageId) return;
		const point = stagePointFromClient(event.clientX, event.clientY);
		if (point) finishPlacement(selectedStageId, point.x, point.y);
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
				liveMessage = translate(i18n, 'interactions.positionObject.placementCancelled', 'Placement cancelled.');
				return;
			default:
				return;
		}

		// Announce updated position after arrow movement
		liveMessage = translate(i18n, 'accessibility.positionPercent', 'Position: {x}%, {y}%.', {
			x: Math.round(crosshairX * 100),
			y: Math.round(crosshairY * 100),
		});
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class="qti-position-object-interaction">
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-po-prompt qti-rich-content font-semibold mb-3">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div part="layout" class="qti-po-layout flex flex-col lg:flex-row gap-4 items-start">
			<!-- Canvas Area with Background Image -->
			<div part="canvas-area" class="qti-po-canvas-area flex-1 min-w-0">
				<div class="qti-po-frame" style="max-width: calc({imageWidth}px + 4px);">
					<!-- The canvas is the drop target and the keyboard/pointer placement surface.
					     While an object is being placed it is a focusable `application` (screen
					     readers pass the arrow keys through); otherwise it is a plain container,
					     so the stage image is read as ordinary content. Placed objects inside
					     are groups (with a remove button), not buttons. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						bind:this={imageContainer}
						part="canvas"
						class="qti-po-canvas {crosshairActive ? 'qti-po-canvas-active' : ''}"
						class:qti-po-canvas-placing={!!selectedStageId}
						style="aspect-ratio: {imageWidth} / {imageHeight};"
						ondrop={handleDrop}
						ondragover={handleDragOver}
						onkeydown={handleCanvasKeydown}
						onclick={handleCanvasClick}
						role={crosshairActive ? 'application' : undefined}
						tabindex={crosshairActive ? 0 : -1}
						aria-label={crosshairActive
							? translate(i18n, 'interactions.positionObject.canvasActiveLabel', 'Positioning canvas: use the arrow keys to move the crosshair, Enter to place, Escape to cancel')
							: undefined}
					>
						<!-- Background Image with its authored text alternative -->
						{#if imageData}
							{#if imageData.type === 'svg' && imageData.content}
								<div
									part="image"
									class="qti-po-image"
									role={imageData.decorative ? undefined : 'img'}
									aria-hidden={imageData.decorative ? 'true' : undefined}
									aria-label={imageData.decorative ? undefined : imageAlt}
									aria-describedby={imageDescription ? imageDescriptionId : undefined}
								>
									{@html imageData.content}
								</div>
							{:else if imageFailed}
								<div part="image-error" class="qti-po-image qti-po-image-error">
									<p>{translate(i18n, 'interactions.positionObject.imageLoadError', 'The image could not be loaded.')}</p>
									{#if imageData.alt && !imageData.decorative}
										<p>{imageData.alt}</p>
									{/if}
								</div>
							{:else if imageData.src}
								<img
									part="image"
									src={imageData.src}
									alt={imageAlt}
									aria-describedby={imageDescription ? imageDescriptionId : undefined}
									class="qti-po-image"
									onerror={handleImageError}
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
									class="qti-po-placed {isCorrect ? 'qti-po-placed-correct' : ''}"
									style={objectBoxStyle(stage, position, 10 + index)}
									draggable={canInteract}
									use:touchDrag
									ondragstart={(e) => handleDragStart(e, position.stageId, index)}
									ondragend={handleDragEnd}
									role="group"
									aria-label={joinSentences(
										translate(i18n, 'accessibility.sentence', '{text}.', {
											text: translate(i18n, 'interactions.positionObject.placedAtPercent', '{label} at {x}%, {y}%', {
												label: stageName(stage),
												x: percent(position.x, imageWidth),
												y: percent(position.y, imageHeight),
											}),
										}),
										isCorrect && translate(i18n, 'accessibility.correctPosition', 'Correct position.'),
									)}
								>
									{#if stage.objectData}
										{#if stage.objectData.type === 'svg' && stage.objectData.content}
											<div class="qti-po-object-image" aria-hidden="true">
												{@html stage.objectData.content}
											</div>
										{:else if stage.objectData.src}
											<img
												src={stage.objectData.src}
												alt=""
												class="qti-po-object-image"
											/>
										{/if}
									{:else}
										<!-- Text-only object -->
										<div
											class="qti-po-object-text px-3 py-2 rounded-lg shadow-lg font-medium {isCorrect ? 'bg-success text-white' : 'bg-primary text-primary-content'}"
										>
											{stageName(stage)}
										</div>
									{/if}

									{#if isCorrect}
										<span class="qti-po-correct-badge" aria-hidden="true">✓</span>
									{/if}

									{#if canInteract}
										<button
											type="button"
											part="remove"
											class="qti-po-remove btn btn-xs btn-circle btn-error"
											onclick={(e) => {
												e.stopPropagation();
												removePosition(index);
											}}
											aria-label={translate(i18n, 'interactions.positionObject.removeObject', 'Remove {object}', { object: stageName(stage) })}
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												part="remove-icon"
												class="qti-icon-xs h-3 w-3"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												aria-hidden="true"
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
										class="qti-po-placed qti-po-placed-correct qti-po-placed-ghost"
										style={objectBoxStyle(stage, correctPos, 5 + index)}
										role="img"
										aria-label={translate(i18n, 'interactions.positionObject.correctPositionAtPercent', 'Correct position for {label}: {x}%, {y}%', {
											label: stageName(stage),
											x: percent(correctPos.x, imageWidth),
											y: percent(correctPos.y, imageHeight),
										})}
									>
										{#if stage.objectData}
											{#if stage.objectData.type === 'svg' && stage.objectData.content}
												<div class="qti-po-object-image" aria-hidden="true">
													{@html stage.objectData.content}
												</div>
											{:else if stage.objectData.src}
												<img src={stage.objectData.src} alt="" class="qti-po-object-image" />
											{/if}
										{:else}
											<!-- Text-only object -->
											<div class="qti-po-object-text px-3 py-2 bg-success text-white rounded-lg shadow-lg font-medium">
												{stageName(stage)}
											</div>
										{/if}
										<span class="qti-po-correct-badge" aria-hidden="true">✓</span>
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
								<line x1="{crosshairX * 100}%" y1="0" x2="{crosshairX * 100}%" y2="100%" class="qti-po-crosshair-halo" />
								<line x1="0" y1="{crosshairY * 100}%" x2="100%" y2="{crosshairY * 100}%" class="qti-po-crosshair-halo" />
								<line x1="{crosshairX * 100}%" y1="0" x2="{crosshairX * 100}%" y2="100%" class="qti-po-crosshair-line" />
								<line x1="0" y1="{crosshairY * 100}%" x2="100%" y2="{crosshairY * 100}%" class="qti-po-crosshair-line" />
								<circle cx="{crosshairX * 100}%" cy="{crosshairY * 100}%" r="6" class="qti-po-crosshair-dot" />
							</svg>
						{/if}
					</div>
				</div>
				{#if imageDescription}
					<p id={imageDescriptionId} class="qti-po-sr-only">{imageDescription}</p>
				{/if}

				{#if parsedInteraction.minChoices > 0}
					<div class="text-xs text-base-content/60 mt-2">
						{translate(i18n, 'interactions.positionObject.minimumRequired', 'Minimum required: {minChoices}', {
							minChoices: parsedInteraction.minChoices,
						})}
						{#if parsedInteraction.maxChoices > 0}
							| {translate(i18n, 'interactions.positionObject.maximumAllowed', 'Maximum: {maxChoices}', {
								maxChoices: parsedInteraction.maxChoices,
							})}
						{/if}
					</div>
				{/if}
			</div>

			<!-- Object Palette -->
			<div part="palette" class="qti-po-palette w-full lg:w-auto lg:flex-1 lg:min-w-[18rem]">
				<div class="qti-po-card card bg-base-100 border border-base-300 h-full">
					<div class="qti-po-card-body card-body p-4">
						<h3 class="card-title text-sm">
							{parsedInteraction.maxChoices > 0
								? translate(i18n, 'interactions.positionObject.availableObjectsCount', 'Available Objects ({count}/{max})', {
										count: positions.length,
										max: parsedInteraction.maxChoices,
									})
								: translate(i18n, 'interactions.positionObject.availableObjectsTotal', 'Available Objects ({count})', {
										count: positions.length,
									})}
						</h3>

						<p class="text-xs text-base-content/60 mb-2">
							{translate(
								i18n,
								'interactions.positionObject.paletteInstructions',
								'Drag objects onto the canvas, or press Enter or Space on an object, then use the arrow keys to position it on the canvas.',
							)}
						</p>

						<div class="space-y-2">
							{#each parsedInteraction.positionObjectStages as stage}
								{@const usageCount = getStageUsageCount(stage.identifier)}
								{@const canDrag = canDragStage(stage.identifier)}
								{@const name = stageName(stage)}
								<div
									part="palette-item"
									class="qti-po-palette-item flex items-center gap-3 p-3 rounded-lg bg-base-200 border border-base-300 {canInteract && canDrag ? 'cursor-move hover:border-primary' : 'opacity-50 cursor-not-allowed'} {selectedStageId === stage.identifier ? 'qti-po-palette-item-selected' : ''}"
									draggable={canInteract && canDrag}
									use:touchDrag
									ondragstart={(e) => {
										if (canDrag) handleDragStart(e, stage.identifier);
									}}
									ondragend={handleDragEnd}
									onclick={() => void activateKeyboardPlacement(stage.identifier)}
									onkeydown={(e) => handlePaletteKeydown(e, stage.identifier)}
									role="button"
									tabindex={canInteract && canDrag ? 0 : -1}
									aria-disabled={!canInteract || !canDrag ? 'true' : undefined}
									aria-label={joinSentences(
										translate(i18n, 'accessibility.sentence', '{text}.', {
											text: translate(i18n, 'interactions.positionObject.objectUsage', '{label} ({usageCount}/{matchMax} used)', {
												label: name,
												usageCount,
												matchMax: stage.matchMax,
											}),
										}),
										selectedStageId === stage.identifier &&
											translate(i18n, 'interactions.graphicGapMatch.selectedHint', 'Selected for placement.'),
									)}
									aria-pressed={selectedStageId === stage.identifier}
								>
									<!-- Object Preview -->
									<div class="qti-po-preview flex-shrink-0" aria-hidden="true">
										{#if stage.objectData}
											{#if stage.objectData.type === 'svg' && stage.objectData.content}
												<div class="w-10 h-10 qti-po-preview-image" data-drag-preview>
													{@html stage.objectData.content}
												</div>
											{:else if stage.objectData.src}
												<img
													src={stage.objectData.src}
													alt=""
													class="w-10 h-10 object-contain qti-po-preview-image"
													data-drag-preview
												/>
											{/if}
										{:else}
											<div class="w-10 h-10 flex items-center justify-center qti-po-preview-image" data-drag-preview>
												<span class="text-2xl">📦</span>
											</div>
										{/if}
									</div>

									<!-- Label and Usage -->
									<div class="flex-1 min-w-0" aria-hidden="true">
										<div class="font-medium text-sm truncate">{name}</div>
										<div class="text-xs text-base-content/60">
											{translate(i18n, 'interactions.positionObject.used', '{usageCount}/{matchMax} used', {
												usageCount,
												matchMax: stage.matchMax,
											})}
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

	<!-- Visually-hidden live region for placement announcements (K-04) -->
	<div aria-live="polite" aria-atomic="true" class="qti-po-sr-only">{liveMessage}</div>
</div>

<style>
	/* Draggable objects: no text selection, and no touch scrolling/zooming that would steal the drag */
	:global(.qti-position-object-interaction [draggable='true']) {
		user-select: none;
		-webkit-user-drag: element;
		touch-action: none;
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
		min-width: min(280px, 100%);
	}
	/* The frame scales with its container up to the image's natural size (WCAG 1.4.10) */
	.qti-po-frame {
		width: 100%;
		box-sizing: border-box;
		border-radius: 0.75rem;
		border: 2px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}
	/* Borderless canvas: exactly the stage image's aspect ratio, so percentages map to image pixels */
	.qti-po-canvas {
		position: relative;
		width: 100%;
	}
	.qti-po-canvas-placing {
		cursor: crosshair;
	}
	.qti-po-canvas:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-po-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
	}
	.qti-po-image :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.qti-po-image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 1rem;
		box-sizing: border-box;
		text-align: center;
		color: var(--pie-qti-error-text, #b91c1c);
	}
	.qti-po-image-error p {
		margin: 0;
	}
	/* Critical: positioned items must be absolutely positioned even without Tailwind's `absolute` utility */
	.qti-po-placed {
		position: absolute;
		cursor: move;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.qti-po-object-image {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.qti-po-object-image :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.qti-po-object-text {
		white-space: nowrap;
	}

	.qti-po-placed-correct {
		outline: 3px solid var(--pie-qti-success-text, #15803d);
		outline-offset: 1px;
		border-radius: 4px;
	}

	.qti-po-placed-ghost {
		opacity: 0.75;
		outline-style: dashed;
		cursor: default;
		pointer-events: none;
	}
	.qti-po-correct-badge {
		position: absolute;
		inset-block-start: -0.5rem;
		inset-inline-end: -0.5rem;
		min-width: 1rem;
		height: 1rem;
		border-radius: 999px;
		background: var(--pie-qti-success-text, #15803d);
		color: #fff;
		font-size: 0.7rem;
		line-height: 1rem;
		text-align: center;
	}
	.qti-po-remove {
		position: absolute;
		inset-block-start: -0.75rem;
		inset-inline-end: -0.75rem;
		min-width: 24px;
		min-height: 24px;
		width: 24px;
		height: 24px;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		cursor: pointer;
	}
	.qti-po-remove:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-po-palette {
		flex: 1 1 0;
		min-width: min(18rem, 100%);
	}
	.qti-po-card {
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--pie-qti-base-100, oklch(100% 0 0));
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
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}
	.qti-po-palette-item:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-po-preview-image {
		width: 2.5rem;
		height: 2.5rem;
	}
	.qti-po-preview-image :global(svg) {
		width: 100%;
		height: 100%;
	}

	/* Selected palette item (K-04): thicker border and inset ring, not colour alone */
	.qti-po-palette-item-selected {
		border: 3px solid var(--pie-qti-primary, oklch(49.12% 0.3096 275.75));
		box-shadow: inset 0 0 0 2px var(--pie-qti-base-100, #fff);
		background: color-mix(in srgb, var(--pie-qti-primary, #4338ca) 15%, var(--pie-qti-base-100, #fff));
	}

	/* Canvas active state ring (K-04) */
	.qti-po-canvas-active {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
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
	.qti-po-crosshair-halo {
		stroke: #fff;
		stroke-width: 4;
	}
	.qti-po-crosshair-line {
		stroke: var(--pie-qti-focus, #4338ca);
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
	.qti-po-crosshair-dot {
		fill: var(--pie-qti-focus, #4338ca);
		stroke: #fff;
		stroke-width: 2;
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
