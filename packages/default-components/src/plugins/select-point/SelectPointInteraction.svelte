<svelte:options customElement="pie-qti-select-point" />

<script lang="ts">
	import type { Point, SelectPointInteractionData } from '@pie-qti/item-player';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
		import { joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import Icon from '../../shared/components/Icon.svelte';
	import { ICON_INFO } from '../../shared/components/icons';
	import ImageStage from '../../shared/components/ImageStage.svelte';
	import { createKeyboardCrosshair } from '../../shared/components/keyboardCrosshair.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import { clientToImagePoint, imageAltText } from '../../shared/utils/graphicRegions';
	import { isLimited } from '../../shared/utils/capacity';

	interface Props {
		interaction?: SelectPointInteractionData | string;
		/**
		 * QTI point responses are typically represented as a single "x y" string (cardinality=single),
		 * or an array of "x y" strings (cardinality=multiple/ordered). Some UI layers may pass
		 * an array of {x,y} points for convenience. We accept all of these and normalize internally.
		 */
		response?: any;
		correctResponse?: any;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: any) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	const uid = $props.id();

	// Parse props that may be JSON strings (web component usage). Correct-answer mode is the
	// scorer's view of an item that has a correct response (the shared shell's rule).
	const shell = $derived(
		createInteractionShell<SelectPointInteractionData, any, any>({ interaction, response, correctResponse, role }),
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);
	// The stage's pixel space (shared ImageStage): the image's declared width/height,
	// else a raster image's natural size once loaded, else unknown — and QTI points
	// live in that space, so unknown means no placement is offered (a default would
	// score clicks in a guessed space).
	let imageWidth = $state<number | null>(null);
	let imageHeight = $state<number | null>(null);
	let imageFailed = $state(false);
	let awaitingNaturalSize = $state(false);
	const hasImageDimensions = $derived(imageWidth !== null && imageHeight !== null);
	const missingDimensions = $derived(!!parsedInteraction?.imageData && !hasImageDimensions && !awaitingNaturalSize);
	const showDiagnostics = $derived(role !== 'candidate');

	let warnedMissingDimensions = false;
	$effect(() => {
		if (missingDimensions && !warnedMissingDimensions) {
			warnedMissingDimensions = true;
			console.warn(
				'[pie-qti-select-point] The image has no known width/height, so points cannot be placed correctly. Add width and height to the image, or supply the asset dimensions.',
			);
		}
	});

	const imageData = $derived(parsedInteraction?.imageData ?? null);
	const imageAlt = $derived(
		imageAltText(imageData, translate(i18n, 'interactions.selectPoint.imageFallback', 'Image for this question')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`${uid}-image-description`);
	const instructionsId = $derived(`${uid}-instructions`);
	const pointsHeadingId = $derived(`${uid}-points-heading`);

	function warnImageFailed(src: string) {
		console.warn(`[pie-qti-select-point] The image failed to load: ${src}`);
	}

	let selectedPoints = $state<Point[]>([]);
	let rootElement: HTMLDivElement | null = $state(null);
	let surfaceElement: HTMLDivElement | null = $state(null);
	let pointsList: HTMLUListElement | null = $state(null);

	// Keyboard crosshair state (K-01): the shared crosshair's normalized position
	// and the live region that reports it.
	const crosshair = createKeyboardCrosshair();
	let liveRegionText = $state('');

	/**
	 * Parse response or correct-response points, in the QTI point form: "x y" strings.
	 */
	function parsePoints(value: any): Point[] {
		if (!value) return [];

		if (Array.isArray(value)) {
			return value
				.map((v) => {
					if (typeof v === 'string') {
						const parts = v.trim().split(/\s+/);
						if (parts.length === 2) {
							const x = Number(parts[0]);
							const y = Number(parts[1]);
							if (!Number.isNaN(x) && !Number.isNaN(y)) {
								return { x, y } satisfies Point;
							}
						}
					}
					return null;
				})
				.filter(Boolean) as Point[];
		} else if (typeof value === 'string' && value.trim()) {
			const parts = value.trim().split(/\s+/);
			if (parts.length === 2) {
				const x = Number(parts[0]);
				const y = Number(parts[1]);
				if (!Number.isNaN(x) && !Number.isNaN(y)) {
					return [{ x, y }];
				}
			}
		}
		return [];
	}

	const correctPoints = $derived(
		isShowingCorrect && parsedCorrectResponse !== null && parsedCorrectResponse !== undefined
			? parsePoints(parsedCorrectResponse)
			: []
	);

	$effect(() => {
		// Sync with parent response changes
		selectedPoints = parsePoints(parsedResponse);
	});

	// Only a positive maxChoices restricts; 0 and a non-numeric limit are no restriction.
	const canSelectMore = $derived(
		!parsedInteraction ||
		!isLimited(parsedInteraction.maxChoices) ||
		selectedPoints.length < parsedInteraction.maxChoices
	);

	const hasMetMinChoices = $derived(
		parsedInteraction && selectedPoints.length >= parsedInteraction.minChoices
	);

	function percent(value: number, total: number): number {
		return total > 0 ? Math.round((value / total) * 100) : 0;
	}

	function isCorrectPoint(point: Point): boolean {
		return isShowingCorrect && correctPoints.some((p) => Math.abs(p.x - point.x) < 1 && Math.abs(p.y - point.y) < 1);
	}

	/** Candidate-facing description of a point: its number and position as percentages of the image. */
	function pointDescription(point: Point, index: number): string {
		return translate(i18n, 'interactions.selectPoint.pointAtPercent', 'Point {index} at {x}%, {y}%', {
			index: index + 1,
			x: percent(point.x, imageWidth ?? 0),
			y: percent(point.y, imageHeight ?? 0),
		});
	}

	function commit(points: Point[]) {
		selectedPoints = points;
		// QTI canonical value representation for baseType="point" is "x y"
		const canonicalValue =
			parsedInteraction?.maxChoices === 1
				? (points[0] ? `${points[0].x} ${points[0].y}` : null)
				: points.map((p) => `${p.x} ${p.y}`);
		response = canonicalValue;
		emitInteractionChange({ target: rootElement ?? undefined, responseId: parsedInteraction?.responseId, value: canonicalValue, onChange });
	}

	function addPoint(point: Point) {
		if (disabled || !parsedInteraction?.imageData || !hasImageDimensions) return;
		if (!canSelectMore) {
			liveRegionText = translate(i18n, 'interactions.selectPoint.maxPointsReached', 'Maximum points reached. Remove a point to add a new one.');
			return;
		}
		const points = [...selectedPoints, point];
		commit(points);
		liveRegionText = translate(i18n, 'interactions.selectPoint.pointPlaced', 'Point {index} placed at {x}%, {y}%.', {
			index: points.length,
			x: percent(point.x, imageWidth ?? 0),
			y: percent(point.y, imageHeight ?? 0),
		});
	}

	/**
	 * Pointer placement: map the click from the rendered (scaled) image to the
	 * image's natural pixel space, which is what QTI scoring compares against.
	 */
	function handleSurfaceClick(event: MouseEvent) {
		if (disabled || !surfaceElement || !hasImageDimensions) return;
		const point = clientToImagePoint(
			event.clientX,
			event.clientY,
			surfaceElement.getBoundingClientRect(),
			imageWidth ?? 0,
			imageHeight ?? 0,
		);
		if (point) addPoint(point);
	}

	/**
	 * Remove a selected point; focus moves to the next remaining remove button,
	 * or back to the selection area when none remain.
	 */
	async function removePoint(index: number) {
		if (disabled) return;
		commit(selectedPoints.filter((_, i) => i !== index));
		liveRegionText = translate(i18n, 'interactions.selectPoint.pointRemoved', 'Point {index} removed.', { index: index + 1 });
		await tick();
		const buttons = pointsList?.querySelectorAll<HTMLButtonElement>('button') ?? [];
		const next = buttons[Math.min(index, buttons.length - 1)];
		(next ?? surfaceElement)?.focus();
	}

	function clearAllPoints() {
		if (disabled) return;
		commit([]);
		liveRegionText = translate(i18n, 'interactions.selectPoint.allPointsRemoved', 'All points removed.');
		surfaceElement?.focus();
	}

	/**
	 * Place a point at the current crosshair position (K-01).
	 * Converts normalized crosshair coords to natural pixel coords.
	 */
	function placePointAtCrosshair() {
		if (!hasImageDimensions) return;
		// select point rounds at placement: the emitted point is whole image pixels.
		addPoint({ x: Math.round(crosshair.x * (imageWidth ?? 0)), y: Math.round(crosshair.y * (imageHeight ?? 0)) });
	}

	/**
	 * Keyboard placement (K-01): arrow keys move the crosshair (Shift for fine
	 * steps); Enter or Space places a point.
	 */
	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return;

		switch (e.key) {
			case 'ArrowLeft':
			case 'ArrowRight':
			case 'ArrowUp':
			case 'ArrowDown': {
				e.preventDefault();
				crosshair.activate();
				if (!crosshair.move(e.key, e.shiftKey)) return;
				liveRegionText = translate(i18n, 'accessibility.positionPercent', 'Position: {x}%, {y}%.', {
					x: Math.round(crosshair.x * 100),
					y: Math.round(crosshair.y * 100),
				});
				break;
			}
			case 'Enter':
			case ' ':
				e.preventDefault();
				placePointAtCrosshair();
				break;
		}
	}

	function handleFocus() {
		crosshair.centre();
		// Show the crosshair for keyboard focus only; a pointer click places its point directly.
		let keyboardFocus = true;
		try {
			keyboardFocus = surfaceElement?.matches(':focus-visible') ?? true;
		} catch {
			keyboardFocus = true;
		}
		if (keyboardFocus) crosshair.activate();
		else crosshair.deactivate();
		liveRegionText = translate(i18n, 'accessibility.positionPercent', 'Position: {x}%, {y}%.', { x: 50, y: 50 });
	}

	function handleBlur() {
		crosshair.deactivate();
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} class="qti-select-point-interaction">
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-select-point-prompt qti-rich-content font-semibold mb-3">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		{#if missingDimensions && showDiagnostics}
			<div part="diagnostic" class="alert alert-error qti-sp-diagnostic" role="alert">
				{translate(
					i18n,
					'interactions.selectPoint.unknownImageDimensions',
					'This select-point interaction cannot be shown: the size of its image is unknown, so points cannot be placed correctly. Add width and height to the image, or supply the asset dimensions.',
				)}
			</div>
		{/if}

		<div class="qti-sp-body space-y-3">
			<!-- Visually-hidden live region: crosshair position, placement and removal -->
			<div class="qti-sp-sr-only" aria-live="polite" aria-atomic="true">{liveRegionText}</div>

			<p id={instructionsId} part="instructions" class="qti-sp-instructions">
				{translate(
					i18n,
					'interactions.selectPoint.keyboardInstructions',
					'Click the image to place a point. With a keyboard, focus the image, move the crosshair with the arrow keys (hold Shift for smaller steps) and press Enter or Space to place a point.',
				)}
			</p>

			{#if imageData}
				<ImageStage
					{imageData}
					alt={imageAlt}
					description={imageDescription}
					descriptionId={imageDescriptionId}
					containerClass="qti-sp-canvas"
					containerPart="stage"
					svgContentClass="qti-sp-image"
					imgClass="qti-sp-image"
					errorClass="qti-sp-image qti-sp-image-error"
					mediaPart="image"
					errorPart="image-error"
					loadErrorText={translate(i18n, 'interactions.selectPoint.imageLoadError', 'The image could not be loaded.')}
					onImageError={warnImageFailed}
					sizing="refuse"
					bind:width={imageWidth}
					bind:height={imageHeight}
					bind:failed={imageFailed}
					bind:awaiting={awaitingNaturalSize}
				>

					<!-- Markers mirror the accessible point list below; decorative here -->
					<div class="qti-sp-markers" aria-hidden="true">
						{#each selectedPoints as point, index}
							<span
								part="point"
								class="point-marker"
								class:point-marker-correct={isCorrectPoint(point)}
								style="left: {(point.x / (imageWidth ?? 1)) * 100}%; top: {(point.y / (imageHeight ?? 1)) * 100}%;"
							>
								<span class="point-number">{isCorrectPoint(point) ? '✓' : index + 1}</span>
							</span>
						{/each}
						{#if isShowingCorrect}
							{#each correctPoints as point}
								{#if !selectedPoints.some((p) => Math.abs(p.x - point.x) < 1 && Math.abs(p.y - point.y) < 1)}
									<span
										part="correct-point"
										class="point-marker point-marker-expected"
										style="left: {(point.x / (imageWidth ?? 1)) * 100}%; top: {(point.y / (imageHeight ?? 1)) * 100}%;"
									>
										<span class="point-number">✓</span>
									</span>
								{/if}
							{/each}
						{/if}
					</div>

					<!-- The input surface: pointer placement and the keyboard crosshair (K-01).
					     It contains no other controls (no nested interactive elements). Its
					     role is `application` so screen readers pass the arrow keys through;
					     Svelte's static check does not count that role as interactive. -->
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<div
						bind:this={surfaceElement}
						part="selection-area"
						class="qti-sp-surface"
						class:qti-sp-surface-disabled={disabled}
						role="application"
						tabindex={disabled ? -1 : 0}
						aria-label={translate(i18n, 'interactions.selectPoint.stageLabel', 'Point selection area')}
						aria-describedby={instructionsId}
						aria-disabled={disabled ? 'true' : undefined}
						onclick={handleSurfaceClick}
						onkeydown={handleKeydown}
						onfocus={handleFocus}
						onblur={handleBlur}
					>
						{#if crosshair.active && !disabled}
							{@const cx = crosshair.x * (imageWidth ?? 0)}
							{@const cy = crosshair.y * (imageHeight ?? 0)}
							<svg
								aria-hidden="true"
								class="crosshair-overlay"
								viewBox="0 0 {imageWidth} {imageHeight}"
								preserveAspectRatio="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<line x1="0" y1={cy} x2={imageWidth} y2={cy} class="crosshair-halo" />
								<line x1={cx} y1="0" x2={cx} y2={imageHeight} class="crosshair-halo" />
								<line x1="0" y1={cy} x2={imageWidth} y2={cy} class="crosshair-line" />
								<line x1={cx} y1="0" x2={cx} y2={imageHeight} class="crosshair-line" />
							</svg>
							<span class="crosshair-dot" style="left: {crosshair.x * 100}%; top: {crosshair.y * 100}%;"></span>
						{/if}
					</div>
				</ImageStage>
				{#if imageDescription}
					<p id={imageDescriptionId} class="qti-sp-sr-only">{imageDescription}</p>
				{/if}
			{:else}
				<div class="no-image-placeholder qti-sp-placeholder">
					<p>{i18n?.t('interactions.selectPoint.noImage') ?? 'No image provided'}</p>
				</div>
			{/if}

			<div class="qti-sp-status">
				<div>
					<span class="font-medium">{translate(i18n, 'interactions.selectPoint.pointsSelected', 'Points selected:')}</span>
					<span class="qti-sp-count">
						{parsedInteraction.maxChoices > 0 ? `${selectedPoints.length} / ${parsedInteraction.maxChoices}` : selectedPoints.length}
					</span>
					{#if parsedInteraction.minChoices > 0}
						<span class="qti-sp-min">
							{#if hasMetMinChoices}
								<span class="badge badge-success badge-sm">{translate(i18n, 'interactions.selectPoint.minimumMet', '✓ Minimum met')}</span>
							{:else}
								<span class="badge badge-warning badge-sm">
									{translate(i18n, 'interactions.selectPoint.selectAtLeast', 'Select at least {minChoices}', {
										minChoices: parsedInteraction.minChoices,
									})}
								</span>
							{/if}
						</span>
					{/if}
				</div>

				<!-- Same name as choice's, hottext's and hotspot's control with the same function (WCAG 3.2.4) -->
				{#if selectedPoints.length > 0}
					<button type="button" class="btn btn-sm btn-ghost qti-sp-button" onclick={clearAllPoints} {disabled}>
						{translate(i18n, 'interactions.choice.clearAnswer', 'Clear answer')}
					</button>
				{/if}
			</div>

			<!-- Placed points: an accessible list with a remove button for each -->
			{#if selectedPoints.length > 0}
				<p id={pointsHeadingId} class="qti-sp-points-heading">
					{translate(i18n, 'interactions.selectPoint.placedPoints', 'Placed points')}
				</p>
				<ul bind:this={pointsList} part="points" class="qti-sp-points" aria-labelledby={pointsHeadingId}>
					{#each selectedPoints as point, index}
						{@const correct = isCorrectPoint(point)}
						<li class="qti-sp-point" class:qti-sp-point-correct={correct}>
							<span>
								{joinSentences(
									translate(i18n, 'accessibility.sentence', '{text}.', { text: pointDescription(point, index) }),
									correct && translate(i18n, 'accessibility.correctAnswer', 'Correct answer.'),
								)}
							</span>
							<button
								type="button"
								part="remove-point"
								class="btn btn-sm qti-sp-button"
								onclick={() => removePoint(index)}
								{disabled}
							>
								{translate(i18n, 'interactions.selectPoint.removePoint', 'Remove point {index}', { index: index + 1 })}
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if isShowingCorrect && correctPoints.length > 0}
				<ul part="correct-points" class="qti-sp-points qti-sp-correct-points">
					{#each correctPoints as point}
						<li class="qti-sp-point">
							{translate(i18n, 'accessibility.correctAnswerIs', 'Correct answer: {answer}.', {
								answer: translate(i18n, 'interactions.selectPoint.percentPosition', '{x}%, {y}%', {
									x: percent(point.x, imageWidth ?? 0),
									y: percent(point.y, imageHeight ?? 0),
								}),
							})}
						</li>
					{/each}
				</ul>
			{/if}

			{#if !canSelectMore}
				<div class="alert alert-info">
					<Icon d={ICON_INFO} part="limit-icon" class="qti-icon stroke-current shrink-0 w-6 h-6" />
					<span>{translate(i18n, 'interactions.selectPoint.maxPointsReached', 'Maximum points reached. Remove a point to add a new one.')}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Minimal icon sizing so SVGs don't fall back to browser default size without Tailwind */
	.qti-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex: 0 0 auto;
	}

	.qti-sp-body {
		display: grid;
		gap: 0.75rem;
	}

	.qti-sp-instructions {
		margin: 0;
		font-size: 0.875rem;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	/* The canvas scales with its container up to the image's natural size (WCAG 1.4.10). */

	.qti-sp-markers {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	/* The input surface covers the image exactly; focus is shown around it. */
	.qti-sp-surface {
		position: absolute;
		inset: 0;
		cursor: crosshair;
		border-radius: 8px;
		touch-action: manipulation;
	}
	.qti-sp-surface-disabled {
		cursor: default;
	}
	.qti-sp-surface:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.point-marker {
		position: absolute;
		width: 28px;
		height: 28px;
		transform: translate(-50%, -50%);
		background-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		border: 3px solid #fff;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 0 2px var(--pie-qti-border-strong, #767676), 0 2px 8px rgba(0, 0, 0, 0.3);
		box-sizing: border-box;
	}

	.point-marker-correct,
	.point-marker-expected {
		background-color: var(--pie-qti-success-text, #15803d);
	}

	.point-marker-expected {
		border-style: dashed;
	}

	.point-number {
		color: #fff;
		font-weight: 700;
		font-size: 13px;
		line-height: 1;
	}

	.qti-sp-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		max-width: 500px;
		aspect-ratio: 5 / 3;
		border: 2px dashed var(--pie-qti-border-strong, #767676);
		border-radius: 8px;
		box-sizing: border-box;
	}
	.qti-sp-placeholder p {
		margin: 0;
	}

	.qti-sp-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.875rem;
	}
	.qti-sp-count,
	.qti-sp-min {
		margin-inline-start: 0.5rem;
	}

	.qti-sp-points-heading {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.qti-sp-points {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}
	.qti-sp-point {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}
	.qti-sp-point-correct {
		border-color: var(--pie-qti-success-text, #15803d);
		border-width: 2px;
	}
	.qti-sp-correct-points .qti-sp-point {
		color: var(--pie-qti-success-text, #15803d);
	}
	.qti-sp-button {
		min-height: 24px;
		min-width: 24px;
	}
	.qti-sp-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* K-01 keyboard crosshair overlay */
	.crosshair-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.crosshair-halo {
		stroke: #fff;
		stroke-width: 4px;
		vector-effect: non-scaling-stroke;
	}

	.crosshair-line {
		stroke: var(--pie-qti-focus, #4338ca);
		stroke-width: 2px;
		stroke-dasharray: 4px 3px;
		vector-effect: non-scaling-stroke;
	}

	.crosshair-dot {
		position: absolute;
		width: 12px;
		height: 12px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: var(--pie-qti-focus, #4338ca);
		border: 2px solid #fff;
		box-sizing: border-box;
		pointer-events: none;
	}

</style>
