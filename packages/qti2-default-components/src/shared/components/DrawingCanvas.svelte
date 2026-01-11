<script lang="ts">
	/**
	 * Drawing canvas component for drawingInteraction
	 *
	 * Simple freehand drawing on a canvas, emitting a serializable QTIFileResponse (PNG dataUrl).
	 */

	import type { QTIFileResponse } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';

	type ImageData =
		| { type: 'svg'; content?: string; width: string; height: string }
		| { type: 'image'; src?: string; width: string; height: string };

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

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let ctx = $state<CanvasRenderingContext2D | null>(null);
	let isDrawing = $state(false);
	let lastX = $state(0);
	let lastY = $state(0);
	let announceText = $state('');

	function toNumber(v: string | undefined, fallback: number) {
		if (!v) return fallback;
		const n = Number(v);
		return Number.isFinite(n) ? n : fallback;
	}

	const canvasWidth = $derived(toNumber(imageData?.width, 600));
	const canvasHeight = $derived(toNumber(imageData?.height, 400));

	// Translations
	const translations = $derived({
		clear: i18n?.t('interactions.drawing.clear') ?? 'interactions.drawing.clear',
		instructions: i18n?.t('interactions.drawing.instructions') ?? 'interactions.drawing.instructions',
		canvas: i18n?.t('interactions.drawing.canvas') ?? 'interactions.drawing.canvas',
		updated: i18n?.t('interactions.drawing.updated') ?? 'interactions.drawing.updated',
		cleared: i18n?.t('interactions.drawing.cleared') ?? 'interactions.drawing.cleared',
		generated: i18n?.t('interactions.drawing.generated') ?? 'interactions.drawing.generated',
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

		// Scale from display size to canvas internal size
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
		if (!canvasEl) return;
		const dataUrl = canvasEl.toDataURL('image/png');
		const size = dataUrlSize(dataUrl);
		const response: QTIFileResponse = {
			name: `drawing-${responseId}.png`,
			type: 'image/png',
			size,
			lastModified: Date.now(),
			dataUrl,
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
			class="btn btn-sm"
			data-testid={testIdClear}
			onclick={clear}
			disabled={disabled}
		>
			{translations.clear}
		</button>
	</div>

	<div class="text-xs text-base-content/70" id={`drawing-instructions-${responseId}`}>
		{translations.instructions}
	</div>

	<div
		class="relative inline-block"
		style="width: {canvasWidth}px; height: {canvasHeight}px; user-select: none;"
	>
		{#if imageData}
			{#if imageData.type === 'svg'}
				<div class="absolute inset-0" style="pointer-events: none;" aria-hidden="true">
					{@html imageData.content}
				</div>
			{:else}
				<img
					class="absolute inset-0 w-full h-full object-contain"
					src={imageData.src}
					alt=""
					aria-hidden="true"
					style="pointer-events: none;"
				/>
			{/if}
		{/if}

		<canvas
			bind:this={canvasEl}
			data-testid={testIdCanvas}
			width={canvasWidth}
			height={canvasHeight}
			class="absolute inset-0 touch-none"
			aria-label={translations.canvas}
			aria-describedby={`drawing-instructions-${responseId}`}
			onpointerdown={pointerDown}
			onpointermove={pointerMove}
			onpointerup={pointerUp}
			onpointercancel={pointerUp}
			style="cursor: {disabled ? 'not-allowed' : 'crosshair'}; pointer-events: auto; border: 1px solid var(--color-base-300, #d1d5db); border-radius: 0.25rem;"
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


