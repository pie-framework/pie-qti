<script lang="ts">
	/**
	 * Drawing canvas component for drawingInteraction
	 *
	 * Simple freehand drawing on a canvas, emitting a serializable QTIFileResponse (PNG dataUrl).
	 */

	import type { QTIFileResponse } from '../types/index.js';

	type ImageData =
		| { type: 'svg'; content?: string; width: string; height: string }
		| { type: 'image'; src?: string; width: string; height: string };

	interface Props {
		responseId: string;
		label?: string;
		imageData?: ImageData | null;
		disabled?: boolean;
		value?: QTIFileResponse | null;
		onChange: (value: QTIFileResponse | null) => void;
		testIdCanvas?: string;
		testIdClear?: string;
	}

	const {
		responseId,
		label = 'Draw your response',
		imageData = null,
		disabled = false,
		value = null,
		onChange,
		testIdCanvas,
		testIdClear,
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

	function setupCanvas() {
		if (!canvasEl) return;
		const context = canvasEl.getContext('2d');
		if (!context) return;
		ctx = context;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';
		ctx.strokeStyle = '#111827';
		ctx.lineWidth = 3;
	}

	$effect(() => {
		setupCanvas();
	});

	function getCanvasPoint(e: PointerEvent) {
		if (!canvasEl) return { x: 0, y: 0 };
		const rect = canvasEl.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
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
		announceText = 'Drawing updated.';
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
		announceText = 'Drawing cleared.';
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between gap-4">
		<div class="font-semibold">{label}</div>
		<button
			type="button"
			class="btn btn-sm"
			data-testid={testIdClear}
			onclick={clear}
			disabled={disabled}
		>
			Clear
		</button>
	</div>

	<div class="text-xs text-base-content/70" id={`drawing-instructions-${responseId}`}>
		Draw with your mouse or touch. Use the Clear button to reset.
	</div>

	<div
		class="relative inline-block border border-base-300 rounded overflow-hidden bg-base-100"
		style="width: {canvasWidth}px; height: {canvasHeight}px;"
	>
		{#if imageData}
			{#if imageData.type === 'svg'}
				<div class="absolute inset-0" aria-hidden="true">
					{@html imageData.content}
				</div>
			{:else}
				<img
					class="absolute inset-0 w-full h-full object-contain"
					src={imageData.src}
					alt=""
					aria-hidden="true"
				/>
			{/if}
		{/if}

		<canvas
			bind:this={canvasEl}
			data-testid={testIdCanvas}
			width={canvasWidth}
			height={canvasHeight}
			class="absolute inset-0 touch-none"
			aria-label="Drawing canvas"
			aria-describedby={`drawing-instructions-${responseId}`}
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
			<div><strong>Generated:</strong> {value.name}</div>
			<div class="text-xs text-base-content/70">{value.size} bytes</div>
		</div>
	{/if}
</div>


