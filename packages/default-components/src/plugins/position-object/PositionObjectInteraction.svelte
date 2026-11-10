<svelte:options customElement="pie-qti-position-object" />

<!--
	QTI Position Object Interaction Component (QTI 2.x positionObjectInteraction, QTI 3.0
	qti-position-object-interaction)

	⚠️ IMPORTANT LIMITATIONS ⚠️

	This interaction type has severe limitations in the QTI specification that make it
	impractical for most educational use cases. After extensive research, we found:

	1. NO real-world implementations beyond the official spec example
	2. Defined in QTI 3.0 (qti-position-object-interaction inside qti-position-object-stage),
	   but absent from the QTI 3.0 shared vocabulary/styling guide
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

	This implementation covers the interaction as QTI 2.x and 3.0 define it, but has limited
	practical utility.
-->

<script lang="ts">
	import type { PositionObjectInteractionData, PositionObjectStage } from '@pie-qti/item-player';
	import { touchDrag } from '@pie-qti/qti-common';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { normalizePixelDimension } from '@pie-qti/item-player/security';
	import { joinSentences, translate, translatePlural, type I18nProvider } from '@pie-qti/i18n';
	import type { InteractionProps } from '../../shared/utils/interactionProps';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import Icon from '../../shared/components/Icon.svelte';
	import { ICON_CLOSE } from '../../shared/components/icons';
	import ImageStage from '../../shared/components/ImageStage.svelte';
	import { createKeyboardCrosshair } from '../../shared/components/keyboardCrosshair.svelte';
	import DragHandle from '../../shared/components/DragHandle.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { isAtLimit } from '../../shared/utils/capacity';
	import { choiceAccessibleName } from '../../shared/utils/choiceName';
	import { createAnnouncer } from '../../shared/utils/announcer.svelte';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import { clientToImagePoint, imageAltText } from '../../shared/utils/graphicRegions';

	interface Position {
		stageId: string;
		/** The object's centre point, in the stage image's natural pixel space. */
		x: number;
		y: number;
	}

	// The response and correct response are arrays of "x y" strings in natural image pixels.
	type Props = InteractionProps<'positionObjectInteraction'>;

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	const uid = $props.id();

	// Parse props that may be JSON strings (web component usage). Correct-answer mode is the
	// scorer's view of an item that has a correct response (the shared shell's rule).
	const shell = $derived(
		createInteractionShell<PositionObjectInteractionData, string[], string[]>({
			interaction,
			response,
			correctResponse,
			role,
			listResponse: true,
		}),
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);
	// The stage's pixel space (shared ImageStage): the stage image's declared
	// width/height, else a raster image's natural size once loaded, else unknown —
	// QTI points live in that space, so unknown means nothing is placed (a default
	// would score placements in a guessed space).
	let imageWidth = $state<number | null>(null);
	let imageHeight = $state<number | null>(null);
	let imageFailed = $state(false);
	let awaitingNaturalSize = $state(false);
	// The authored reference point (QTI centerPoint), in object image pixels from
	// its top-left; null means the QTI default, the object's centre.
	const centerPoint = $derived(validCenterPoint(parsedInteraction?.centerPoint));

	const imageData = $derived(parsedInteraction?.imageData ?? null);
	const hasImageDimensions = $derived(imageWidth !== null && imageHeight !== null);
	const missingDimensions = $derived(!!imageData && !hasImageDimensions && !awaitingNaturalSize);
	const showDiagnostics = $derived(role !== 'candidate');

	let warnedMissingDimensions = false;
	$effect(() => {
		if (missingDimensions && !warnedMissingDimensions) {
			warnedMissingDimensions = true;
			console.warn(
				'[pie-qti-position-object] The stage image has no known width/height, so objects cannot be placed correctly. Add width and height to the image, or supply the asset dimensions.',
			);
		}
	});
	const imageAlt = $derived(
		imageAltText(imageData, translate(i18n, 'interactions.positionObject.imageFallback', 'Image for this question')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`${uid}-image-description`);
	function warnImageFailed(src: string) {
		console.warn(`[pie-qti-position-object] The stage image failed to load: ${src}`);
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
	let imageContainer: HTMLElement | null = $state(null);

	// Keyboard accessibility state (K-04): the object being keyboard-positioned, the
	// shared crosshair's normalized position on the background image, and the live
	// region that reports selection, movement, placement and refusals.
	let selectedStageId: string | null = $state(null);
	const crosshair = createKeyboardCrosshair();
	const liveAnnouncer = createAnnouncer();

	const canInteract = $derived(!disabled);
	// The interaction's maxChoices: 0 means unlimited, as does anything but a positive number.
	const canAddMore = $derived(!parsedInteraction || !isAtLimit(positions.length, parsedInteraction.maxChoices));

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
			// multiple stages, distribute by stage order and matchMax (0 = unlimited:
			// such a stage takes every remaining point).
			let stageId = '';
			if (stages.length === 1) {
				stageId = stages[0].identifier;
			} else {
				let pointIndex = 0;
				for (const stage of stages) {
					const capacity = stage.matchMax > 0 ? stage.matchMax : Number.POSITIVE_INFINITY;
					if (pointIndex + capacity > i) {
						stageId = stage.identifier;
						break;
					}
					pointIndex += capacity;
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
		return choiceAccessibleName({
			i18n,
			label: stage.label,
			position: index + 1,
			// The interaction's own noun for an unnamed object ("Object 3").
			fallback: { key: 'interactions.positionObject.objectFallback', text: 'Object {index}' },
		});
	}

	function getStageUsageCount(id: string): number {
		return positions.filter((p) => p.stageId === id).length;
	}

	/**
	 * An object's own placement limit. The extractor carries the interaction's
	 * maxChoices into it, and QTI reads maxChoices="0" as "no limit", so 0 means
	 * unlimited here too — otherwise an unlimited item could never be answered.
	 */
	function isStageAtLimit(stage: PositionObjectStage): boolean {
		return isAtLimit(getStageUsageCount(stage.identifier), stage.matchMax);
	}

	function canDragStage(id: string): boolean {
		const stage = getStageById(id);
		if (!stage) return false;
		return !isStageAtLimit(stage);
	}

	function emitPositions() {
		// QTI baseType="point" expects array of strings like ["158 168", "250 200"]
		const responseValue = positions.map((pos) => `${Math.round(pos.x)} ${Math.round(pos.y)}`);
		response = responseValue;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: responseValue, onChange });
	}

	/**
	 * Map a pointer position on the rendered (scaled) stage to the stage image's
	 * natural pixel space, clamped to the image. Unrounded: the emission step
	 * rounds (see emitPositions).
	 */
	function stagePointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
		if (!imageContainer || !hasImageDimensions) return null;
		return clientToImagePoint(clientX, clientY, imageContainer.getBoundingClientRect(), imageWidth ?? 0, imageHeight ?? 0, {
			round: false,
		});
	}

	/** Place a new instance of `stageId` with its reference point at (x, y). */
	function placeStageAt(stageId: string, x: number, y: number): boolean {
		const stage = getStageById(stageId);
		if (!stage || !hasImageDimensions) return false;
		if (isStageAtLimit(stage)) return false;
		if (!canAddMore) return false;
		positions = [...positions, { stageId, x, y }];
		emitPositions();
		return true;
	}

	/**
	 * A refused placement is announced, never silent (WCAG 3.3.1/4.1.3): naming the
	 * interaction's maxChoices when that cap is what refused it, else the object
	 * whose own limit is used up. Pressing Enter again on the same refusal would leave
	 * the live text unchanged, which assistive technology does not announce, so a
	 * repeat toggles a trailing zero-width space (silent to screen readers).
	 */
	function announcePlacementRefused(stage: PositionObjectStage) {
		const maxChoices = parsedInteraction?.maxChoices ?? 0;
		const message =
			isAtLimit(positions.length, maxChoices)
				? translatePlural(
						i18n,
						'interactions.positionObject.maxChoicesReached',
						{ one: 'The maximum of {max} placement is reached.', other: 'The maximum of {max} placements is reached.' },
						maxChoices,
						{ max: maxChoices },
					)
				: translate(i18n, 'interactions.positionObject.objectLimitReached', 'Not possible: {object} cannot be placed again.', {
						object: stageName(stage),
					});
		liveAnnouncer.announce(message);
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
				const renderScale = imageContainer ? imageContainer.getBoundingClientRect().width / (imageWidth ?? 1) || 1 : 1;
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
			} else if (!placeStageAt(draggedStageId, point.x, point.y)) {
				const stage = getStageById(draggedStageId);
				if (stage) announcePlacementRefused(stage);
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

	async function removePosition(index: number) {
		if (!canInteract) return;
		const removed = positions[index];
		positions = positions.filter((_, i) => i !== index);
		emitPositions();
		if (removed) {
			liveAnnouncer.set(
				translate(i18n, 'interactions.positionObject.objectRemoved', '{object} removed.', {
					object: stageName(getStageById(removed.stageId)),
				}),
			);
		}
		// The removed object's button is gone, which would drop keyboard focus to the
		// document. The canvas is the interaction's persistent surface (tabindex="-1"),
		// so focus lands there instead.
		await tick();
		imageContainer?.focus();
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
		const width = stage.objectData ? `${(objectDimension(stage.objectData.width) / (imageWidth ?? 1)) * 100}%` : 'auto';
		const height = stage.objectData ? `${(objectDimension(stage.objectData.height) / (imageHeight ?? 1)) * 100}%` : 'auto';
		const reference = referenceFraction(stage);
		return [
			`left: ${(position.x / (imageWidth ?? 1)) * 100}%`,
			`top: ${(position.y / (imageHeight ?? 1)) * 100}%`,
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
		if (!canInteract || !hasImageDimensions) return;
		const stage = getStageById(stageId);
		if (!stage || !canDragStage(stageId)) return;

		selectedStageId = stageId;
		crosshair.activate();

		// Initialise crosshair to the stage's last placed position, or centre
		const existing = [...positions].reverse().find((p: Position) => p.stageId === stageId);
		if (existing) {
			crosshair.jumpTo(existing.x / (imageWidth ?? 1), existing.y / (imageHeight ?? 1));
		} else {
			crosshair.centre();
		}

		liveAnnouncer.set(
			translate(
				i18n,
				'interactions.positionObject.objectSelected',
				'{object} selected. Tab to the canvas, then use the arrow keys to position it. Press Enter to place it or Escape to cancel.',
				{ object: stageName(stage) },
			),
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
		if (!stage) return;
		if (!placeStageAt(stageId, x, y)) {
			// Refused at a cap: say so. The object stays selected and the crosshair active,
			// so the candidate can still cancel with Escape or move on; nothing is placed.
			announcePlacementRefused(stage);
			return;
		}
		liveAnnouncer.set(
			translate(i18n, 'interactions.positionObject.objectPlacedAt', '{object} placed at {x}%, {y}%.', {
				object: stageName(stage),
				x: percent(x, imageWidth ?? 0),
				y: percent(y, imageHeight ?? 0),
			}),
		);
		selectedStageId = null;
		crosshair.deactivate();
	}

	/**
	 * Place the currently selected stage at the crosshair position.
	 */
	function placeAtCrosshair() {
		if (!selectedStageId || !parsedInteraction?.imageData) return;
		// Unrounded here: the emission step rounds (see emitPositions).
		finishPlacement(selectedStageId, crosshair.x * (imageWidth ?? 0), crosshair.y * (imageHeight ?? 0));
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
		if (!crosshair.active || !selectedStageId) return;

		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowRight':
			case 'ArrowUp':
			case 'ArrowDown':
				event.preventDefault();
				if (!crosshair.move(event.key, event.shiftKey)) return;
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				placeAtCrosshair();
				return;
			case 'Escape':
				event.preventDefault();
				selectedStageId = null;
				crosshair.deactivate();
				liveAnnouncer.set(translate(i18n, 'interactions.positionObject.placementCancelled', 'Placement cancelled.'));
				return;
			default:
				return;
		}

		// Announce updated position after arrow movement
		liveAnnouncer.set(
			translate(i18n, 'accessibility.positionPercent', 'Position: {x}%, {y}%.', {
				x: Math.round(crosshair.x * 100),
				y: Math.round(crosshair.y * 100),
			}),
		);
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

		{#if missingDimensions && showDiagnostics}
			<div part="diagnostic" class="alert alert-error qti-po-diagnostic" role="alert">
				{translate(
					i18n,
					'interactions.positionObject.unknownImageDimensions',
					'Objects cannot be placed: the size of the stage image is unknown. Add width and height to the image, or supply the asset dimensions.',
				)}
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
					<!-- The canvas is the drop target and the keyboard/pointer placement surface.
					     While an object is being placed it is a focusable `application` (screen
					     readers pass the arrow keys through); otherwise it is a plain container,
					     so the stage image is read as ordinary content. Placed objects inside
					     are groups (with a remove button), not buttons. The ImageStage container
					     carries the canvas' interactive attributes (containerProps). -->
					<ImageStage
						{imageData}
						alt={imageAlt}
						description={imageDescription}
						descriptionId={imageDescriptionId}
						containerClass="qti-po-canvas {crosshair.active ? 'qti-po-canvas-active' : ''} {selectedStageId ? 'qti-po-canvas-placing' : ''}"
						containerPart="canvas"
						capContainerWidth={false}
						containerProps={{
							ondrop: handleDrop,
							ondragover: handleDragOver,
							onkeydown: handleCanvasKeydown,
							onclick: handleCanvasClick,
							role: crosshair.active ? 'application' : undefined,
							tabindex: crosshair.active ? 0 : -1,
							'aria-label': crosshair.active
								? translate(i18n, 'interactions.positionObject.canvasActiveLabel', 'Positioning canvas: use the arrow keys to move the crosshair, Enter to place, Escape to cancel')
								: undefined,
						}}
						svgContentClass="qti-po-image"
						imgClass="qti-po-image"
						errorClass="qti-po-image qti-po-image-error"
						mediaPart="image"
						errorPart="image-error"
						loadErrorText={translate(i18n, 'interactions.positionObject.imageLoadError', 'The image could not be loaded.')}
						onImageError={warnImageFailed}
						sizing="refuse"
						bind:width={imageWidth}
						bind:height={imageHeight}
						bind:failed={imageFailed}
						bind:awaiting={awaitingNaturalSize}
						bind:container={imageContainer}
					>

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
												x: percent(position.x, imageWidth ?? 0),
												y: percent(position.y, imageHeight ?? 0),
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
											<Icon d={ICON_CLOSE} part="remove-icon" class="qti-icon-xs h-3 w-3" stroke="currentColor" />
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
											x: percent(correctPos.x, imageWidth ?? 0),
											y: percent(correctPos.y, imageHeight ?? 0),
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
						{#if crosshair.active}
							<svg
								class="qti-po-crosshair-overlay"
								aria-hidden="true"
								xmlns="http://www.w3.org/2000/svg"
							>
								<line x1="{crosshair.x * 100}%" y1="0" x2="{crosshair.x * 100}%" y2="100%" class="qti-po-crosshair-halo" />
								<line x1="0" y1="{crosshair.y * 100}%" x2="100%" y2="{crosshair.y * 100}%" class="qti-po-crosshair-halo" />
								<line x1="{crosshair.x * 100}%" y1="0" x2="{crosshair.x * 100}%" y2="100%" class="qti-po-crosshair-line" />
								<line x1="0" y1="{crosshair.y * 100}%" x2="100%" y2="{crosshair.y * 100}%" class="qti-po-crosshair-line" />
								<circle cx="{crosshair.x * 100}%" cy="{crosshair.y * 100}%" r="6" class="qti-po-crosshair-dot" />
							</svg>
						{/if}
					</ImageStage>
				</div>
				{#if imageDescription}
					<p id={imageDescriptionId} class="qti-po-sr-only">{imageDescription}</p>
				{/if}

				{#if parsedInteraction.minChoices > 0 || parsedInteraction.maxChoices > 0}
					<!-- The limits are stated up front (WCAG 3.3.2): the maximum is named even when
					     the item declares no minimum, so the cap is known before the first refusal. -->
					<div class="text-xs text-base-content/60 mt-2">
						{#if parsedInteraction.minChoices > 0}
							{translate(i18n, 'interactions.positionObject.minimumRequired', 'Minimum required: {minChoices}', {
								minChoices: parsedInteraction.minChoices,
							})}
						{/if}
						{#if parsedInteraction.maxChoices > 0}
							{#if parsedInteraction.minChoices > 0}|{/if}
							{translate(i18n, 'interactions.positionObject.maximumAllowed', 'Maximum: {maxChoices}', {
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
											text:
												stage.matchMax > 0
													? translate(i18n, 'interactions.positionObject.objectUsage', '{label} ({usageCount}/{matchMax} used)', {
															label: name,
															usageCount,
															matchMax: stage.matchMax,
														})
													: translate(i18n, 'interactions.positionObject.objectUsageUnlimited', '{label} ({usageCount} used, unlimited)', {
															label: name,
															usageCount,
														}),
										}),
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
											{stage.matchMax > 0
												? translate(i18n, 'interactions.positionObject.used', '{usageCount}/{matchMax} used', {
														usageCount,
														matchMax: stage.matchMax,
													})
												: translate(i18n, 'interactions.positionObject.usedUnlimited', '{usageCount} used, unlimited', { usageCount })}
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
	<div aria-live="polite" aria-atomic="true" class="qti-po-sr-only">{liveAnnouncer.message}</div>
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
	.qti-po-canvas-placing {
		cursor: crosshair;
	}
	.qti-po-canvas:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
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

</style>
