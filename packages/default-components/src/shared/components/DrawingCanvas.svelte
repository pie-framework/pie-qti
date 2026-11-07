<script lang="ts">
	/**
	 * Drawing canvas component for drawingInteraction
	 *
	 * Simple freehand drawing on a canvas, emitting a serializable QTIFileResponse (PNG dataUrl).
	 */

	import type { QTIFileResponse } from '@pie-qti/item-player';
	import { translate, type I18nProvider } from '@pie-qti/i18n';

	type ImageData =
		| { type: 'svg'; content?: string; width: string; height: string; alt?: string; altDescription?: string; decorative?: boolean }
		| { type: 'image'; src?: string; width: string; height: string; alt?: string; altDescription?: string; decorative?: boolean };

	interface Props {
		responseId: string;
		label?: string;
		imageData?: ImageData | null;
		disabled?: boolean;
		value?: QTIFileResponse | null;
		i18n?: I18nProvider;
		onChange: (value: QTIFileResponse | null) => void;
		testIdCanvas?: string;
		testIdClear?: string;
		/** Stroke color (default: #111827) */
		strokeColor?: string;
		/** Line width in pixels (default: 3) */
		lineWidth?: number;
		/** Line cap style (default: round) */
		lineCap?: 'butt' | 'round' | 'square';
		/** Line join style (default: round) */
		lineJoin?: 'bevel' | 'round' | 'miter';
	}

	const {
		responseId,
		label,
		imageData = null,
		disabled = false,
		value = null,
		i18n,
		onChange,
		testIdCanvas,
		testIdClear,
		strokeColor = '#111827',
		lineWidth = 3,
		lineCap = 'round',
		lineJoin = 'round',
	}: Props = $props();

	function toNumber(v: string | undefined, fallback: number) {
		if (!v) return fallback;
		const n = Number(v);
		return Number.isFinite(n) ? n : fallback;
	}

	const canvasWidth = $derived(toNumber(imageData?.width, 600));
	const canvasHeight = $derived(toNumber(imageData?.height, 400));

	// The background image is ordinary content with its authored text alternative;
	// only an author-marked decorative image stays hidden from assistive tech.
	const backgroundAlt = $derived(
		imageData?.decorative ? '' : (imageData?.alt?.trim() || translate(i18n, 'interactions.drawing.imageFallback', 'Drawing background')),
	);
	const imageDescription = $derived(imageData?.decorative ? '' : (imageData?.altDescription ?? ''));
	const imageDescriptionId = $derived(`drawing-image-description-${responseId}`);
	const instructionsId = $derived(`drawing-instructions-${responseId}`);
	let failedSrc = $state<string | null>(null);
	const imageFailed = $derived(imageData?.type === 'image' && !!imageData.src && failedSrc === imageData.src);

	function handleImageError() {
		failedSrc = imageData?.type === 'image' ? (imageData.src ?? null) : null;
		console.warn(`[pie-qti-drawing] The background image failed to load: ${failedSrc ?? ''}`);
	}

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let ctx = $state<CanvasRenderingContext2D | null>(null);
	let isDrawing = $state(false);
	let lastX = $state(0);
	let lastY = $state(0);
	let announceText = $state('');

	// Translations (English fallbacks when mounted without a provider — never raw keys)
	const translations = $derived({
		clear: translate(i18n, 'interactions.drawing.clear', 'Clear drawing'),
		instructions: translate(i18n, 'interactions.drawing.instructions', 'Draw with your mouse or touch. Use the Clear button to reset.'),
		canvas: translate(i18n, 'interactions.drawing.canvas', 'Drawing canvas'),
		updated: translate(i18n, 'interactions.drawing.updated', 'Drawing updated.'),
		cleared: translate(i18n, 'interactions.drawing.cleared', 'Drawing cleared.'),
		generated: translate(i18n, 'interactions.drawing.generated', 'Generated:'),
	});

	function setupCanvas() {
		if (!canvasEl) return;
		const context = canvasEl.getContext('2d');
		if (!context) return;
		ctx = context;
		ctx.lineJoin = lineJoin;
		ctx.lineCap = lineCap;
		ctx.strokeStyle = strokeColor;
		ctx.lineWidth = lineWidth;
	}

	$effect(() => {
		setupCanvas();
	});

	function getCanvasPoint(e: PointerEvent) {
		if (!canvasEl) return { x: 0, y: 0 };
		const rect = canvasEl.getBoundingClientRect();
		// Get coordinates relative to canvas
		let x = e.clientX - rect.left;
		let y = e.clientY - rect.top;

		// Scale from display size to canvas internal size (stays exact when the
		// canvas is displayed responsively, WCAG 1.4.10)
		const scaleX = canvasWidth / rect.width;
		const scaleY = canvasHeight / rect.height;
		x = x * scaleX;
		y = y * scaleY;

		// Clamp to canvas bounds
		x = Math.max(0, Math.min(x, canvasWidth));
		y = Math.max(0, Math.min(y, canvasHeight));

		return { x, y };
	}

	function pointerDown(e: PointerEvent) {
		if (disabled || !ctx || !canvasEl) return;
		canvasEl.setPointerCapture(e.pointerId);
		isDrawing = true;
		const { x, y } = getCanvasPoint(e);
		lastX = x;
		lastY = y;
	}

	function pointerMove(e: PointerEvent) {
		if (disabled || !ctx || !isDrawing) return;
		const { x, y } = getCanvasPoint(e);
		ctx.beginPath();
		ctx.moveTo(lastX, lastY);
		ctx.lineTo(x, y);
		ctx.stroke();
		lastX = x;
		lastY = y;
	}

	function dataUrlSize(dataUrl: string): number {
		const comma = dataUrl.indexOf(',');
		if (comma === -1) return dataUrl.length;
		const b64 = dataUrl.slice(comma + 1);
		// base64 size estimate
		const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
		return Math.floor((b64.length * 3) / 4) - padding;
	}

	function commitValue() {
		if (!canvasEl || !ctx) return;
		const dataUrl = canvasEl.toDataURL('image/png');

		// Extract ImageData synchronously from canvas and include it in the response
		// This allows custom operators to analyze drawing content without async image loading
		let canvasImageData: globalThis.ImageData | undefined;
		try {
			canvasImageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
		} catch (e) {
			console.warn('[DrawingCanvas] Failed to extract image data:', e);
		}

		const size = dataUrlSize(dataUrl);
		const response: QTIFileResponse = {
			name: `drawing-${responseId}.png`,
			type: 'image/png',
			size,
			lastModified: Date.now(),
			dataUrl,
			// Include ImageData if available (for drawing analysis in custom operators)
			imageData: canvasImageData ? {
				data: canvasImageData.data,
				width: canvasImageData.width,
				height: canvasImageData.height,
			} : undefined,
		};
		onChange(response);
		announceText = translations.updated;
	}

	function pointerUp(e: PointerEvent) {
		if (disabled || !isDrawing) return;
		isDrawing = false;
		commitValue();
		try {
			canvasEl?.releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
	}

	function clear() {
		if (disabled || !ctx || !canvasEl) return;
		ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
		onChange(null);
		announceText = translations.cleared;
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between gap-4">
		{#if label}
			<div class="font-semibold">{label}</div>
		{/if}
		<button
			type="button"
			class="btn btn-sm qti-dc-clear"
			data-testid={testIdClear}
			onclick={clear}
			disabled={disabled}
		>
			{translations.clear}
		</button>
	</div>

	<div class="text-xs text-base-content/70" id={instructionsId}>
		{translations.instructions}
	</div>

	<!-- The canvas scales with its container up to its authored pixel size; drawing
	     coordinates are mapped from the displayed size, so strokes land where they
	     are drawn at any scale (WCAG 1.4.10). -->
	<div
		class="qti-dc-canvas-wrap"
		style="max-width: {canvasWidth}px; aspect-ratio: {canvasWidth} / {canvasHeight}; user-select: none;"
	>
		{#if imageData}
			{#if imageData.type === 'svg'}
				<div
					class="qti-dc-background qti-dc-background-svg"
					style="pointer-events: none;"
					role={imageData.decorative ? undefined : 'img'}
					aria-hidden={imageData.decorative ? 'true' : undefined}
					aria-label={imageData.decorative ? undefined : backgroundAlt}
					aria-describedby={imageDescription ? imageDescriptionId : undefined}
				>
					{@html imageData.content}
				</div>
			{:else if imageFailed}
				<div class="qti-dc-background qti-dc-background-error">
					<p>{translate(i18n, 'interactions.drawing.imageLoadError', 'The background image could not be loaded.')}</p>
					{#if imageData.alt && !imageData.decorative}
						<p>{imageData.alt}</p>
					{/if}
				</div>
			{:else if imageData.src}
				<img
					class="qti-dc-background qti-dc-background-img"
					src={imageData.src}
					alt={backgroundAlt}
					aria-describedby={imageDescription ? imageDescriptionId : undefined}
					style="pointer-events: none;"
					onerror={handleImageError}
				/>
			{/if}
			{#if imageDescription}
				<p id={imageDescriptionId} class="sr-only">{imageDescription}</p>
			{/if}
		{/if}

		<canvas
			bind:this={canvasEl}
			data-testid={testIdCanvas}
			width={canvasWidth}
			height={canvasHeight}
			class="qti-dc-canvas touch-none"
			aria-label={translations.canvas}
			aria-describedby={instructionsId}
			onpointerdown={pointerDown}
			onpointermove={pointerMove}
			onpointerup={pointerUp}
			onpointercancel={pointerUp}
			style="cursor: {disabled ? 'not-allowed' : 'crosshair'};"
		></canvas>
	</div>

	<div aria-live="polite" class="sr-only">{announceText}</div>

	{#if value}
		<div class="text-sm">
			<div><strong>{translations.generated}</strong> {value.name}</div>
			<div class="text-xs text-base-content/70">
				{i18n?.t('interactions.upload.fileSize', { size: value.size }) ?? `${value.size} bytes`}
			</div>
		</div>
	{/if}
</div>

<style>
	.qti-dc-clear {
		min-height: 24px;
		min-width: 24px;
	}
	.qti-dc-clear:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-dc-canvas-wrap {
		position: relative;
		width: 100%;
	}
	.qti-dc-background {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.qti-dc-background-img {
		object-fit: contain;
	}
	.qti-dc-background-svg :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.qti-dc-background-error {
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
	.qti-dc-background-error p {
		margin: 0;
	}
	/* The drawing surface sits exactly over the background and stretches with the wrapper.
	   The frame is an outline, not a border, so the canvas box maps 1:1 to drawing coordinates. */
	.qti-dc-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		touch-action: none;
		outline: 1px solid var(--pie-qti-border-strong, #767676);
		outline-offset: -1px;
		border-radius: 0.25rem;
	}
</style>
