<svelte:options customElement="pie-qti-select-point" />

<script lang="ts">
	import type { Point, SelectPointInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

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

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<SelectPointInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<any>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<any>(correctResponse));
	const isShowingCorrect = $derived(
		role === 'scorer' && parsedCorrectResponse !== null && parsedCorrectResponse !== undefined
	);

	let selectedPoints = $state<Point[]>([]);
	let rootElement: HTMLDivElement | null = $state(null);
	let imageContainer: HTMLDivElement | null = $state(null);
	let imageElement: HTMLElement | null = $state(null);

	// Keyboard crosshair state (K-01)
	let crosshairActive = $state(false);
	let crosshairX = $state(0.5); // normalized 0-1
	let crosshairY = $state(0.5); // normalized 0-1
	let liveRegionText = $state('');

	/**
	 * Parse correct response points (same format as user response)
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
							if (!isNaN(x) && !isNaN(y)) {
								return { x, y } satisfies Point;
							}
						}
						return null;
					}
					if (v && typeof v === 'object' && v.x !== undefined && v.y !== undefined) {
						const x = Number(v.x);
						const y = Number(v.y);
						if (!isNaN(x) && !isNaN(y)) {
							return { x, y } satisfies Point;
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
				if (!isNaN(x) && !isNaN(y)) {
					return [{ x, y }];
				}
			}
		} else if (value && typeof value === 'object' && value.x !== undefined && value.y !== undefined) {
			const x = Number(value.x);
			const y = Number(value.y);
			if (!isNaN(x) && !isNaN(y)) {
				return [{ x, y }];
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
		const r = parsedResponse;
		if (Array.isArray(r)) {
			// Array can be [{x,y}, ...] or ["x y", ...]
			selectedPoints = r
				.map((v) => {
					if (typeof v === 'string') {
						const parts = v.trim().split(/\s+/);
						if (parts.length === 2) return { x: Number(parts[0]), y: Number(parts[1]) } satisfies Point;
						return null;
					}
					if (v && typeof v === 'object' && v.x !== undefined && v.y !== undefined) {
						return { x: Number(v.x), y: Number(v.y) } satisfies Point;
					}
					return null;
				})
				.filter(Boolean) as Point[];
		} else if (typeof r === 'string') {
			const parts = r.trim().split(/\s+/);
			selectedPoints =
				parts.length === 2
					? [{ x: Number(parts[0]), y: Number(parts[1]) }]
					: [];
		} else if (r && typeof r === 'object' && r.x !== undefined && r.y !== undefined) {
			selectedPoints = [{ x: Number(r.x), y: Number(r.y) }];
		} else {
			selectedPoints = [];
		}
	});

	/**
	 * Check if selection limit has been reached
	 */
	// maxChoices=0 means unlimited per QTI spec
	const canSelectMore = $derived(
		!parsedInteraction ||
		parsedInteraction.maxChoices === 0 ||
		selectedPoints.length < parsedInteraction.maxChoices
	);

	/**
	 * Check if minimum selection requirement has been met
	 */
	const hasMetMinChoices = $derived(
		parsedInteraction && selectedPoints.length >= parsedInteraction.minChoices
	);

	/**
	 * Handle click on image to select a point
	 */
	function handleImageClick(event: MouseEvent) {
		if (disabled || !canSelectMore || !imageElement || !parsedInteraction?.imageData) return;

		const rect = imageElement.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const clickY = event.clientY - rect.top;

		// Convert to absolute coordinates matching the SVG/image coordinate system
		// The image is displayed at rect.width x rect.height but has intrinsic dimensions
		const intrinsicWidth = parseInt(parsedInteraction.imageData.width) || rect.width;
		const intrinsicHeight = parseInt(parsedInteraction.imageData.height) || rect.height;

		const x = Math.round((clickX / rect.width) * intrinsicWidth);
		const y = Math.round((clickY / rect.height) * intrinsicHeight);

		selectedPoints = [...selectedPoints, { x, y }];

		// QTI canonical value representation for baseType="point" is "x y"
		const canonicalValue =
			parsedInteraction.maxChoices === 1
				? (selectedPoints[0] ? `${selectedPoints[0].x} ${selectedPoints[0].y}` : null)
				: selectedPoints.map((p) => `${p.x} ${p.y}`);
		// Normalize outward response shape to canonical QTI form (even if inbound was legacy/object form).
		response = canonicalValue;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(canonicalValue);
		// Dispatch event for web component usage - event will bubble up to the host element
		rootElement?.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, canonicalValue));
	}

	/**
	 * Remove a selected point
	 */
	function removePoint(index: number) {
		if (disabled) return;
		selectedPoints = selectedPoints.filter((_, i) => i !== index);
		const canonicalValue =
			parsedInteraction?.maxChoices === 1
				? (selectedPoints[0] ? `${selectedPoints[0].x} ${selectedPoints[0].y}` : null)
				: selectedPoints.map((p) => `${p.x} ${p.y}`);
		response = canonicalValue;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(canonicalValue);
		rootElement?.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, canonicalValue));
	}

	/**
	 * Clear all selected points
	 */
	function clearAllPoints() {
		if (disabled) return;
		selectedPoints = [];
		const canonicalValue =
			parsedInteraction?.maxChoices === 1
				? null
				: [];
		response = canonicalValue;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(canonicalValue);
		rootElement?.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, canonicalValue));
	}

	/**
	 * Initialize image element reference
	 */
	$effect(() => {
		if (imageContainer) {
			const img = imageContainer.querySelector('img, svg, object');
			if (img) {
				imageElement = img as HTMLElement;
			}
		}
	});

	/**
	 * Place a point at the current crosshair position (K-01).
	 * Converts normalized crosshair coords to intrinsic pixel coords.
	 */
	function placePointAtCrosshair() {
		if (!canSelectMore || !parsedInteraction?.imageData) return;

		const intrinsicWidth = parseInt(parsedInteraction.imageData.width) || 500;
		const intrinsicHeight = parseInt(parsedInteraction.imageData.height) || 300;

		const x = Math.round(crosshairX * intrinsicWidth);
		const y = Math.round(crosshairY * intrinsicHeight);

		selectedPoints = [...selectedPoints, { x, y }];

		const canonicalValue =
			parsedInteraction.maxChoices === 1
				? (selectedPoints[0] ? `${selectedPoints[0].x} ${selectedPoints[0].y}` : null)
				: selectedPoints.map((p) => `${p.x} ${p.y}`);
		response = canonicalValue;
		onChange?.(canonicalValue);
		rootElement?.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, canonicalValue));
	}

	/**
	 * Handle keyboard events on the image container (K-01).
	 * Arrow keys move the crosshair; Enter/Space place a point.
	 */
	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return;

		const LARGE_STEP = 0.05; // 5% per arrow key press
		const SMALL_STEP = 0.01; // 1% with Shift for fine control

		switch (e.key) {
			case 'ArrowLeft':
			case 'ArrowRight':
			case 'ArrowUp':
			case 'ArrowDown': {
				e.preventDefault();
				const step = e.shiftKey ? SMALL_STEP : LARGE_STEP;
				if (e.key === 'ArrowLeft')  crosshairX = Math.max(0, crosshairX - step);
				if (e.key === 'ArrowRight') crosshairX = Math.min(1, crosshairX + step);
				if (e.key === 'ArrowUp')    crosshairY = Math.max(0, crosshairY - step);
				if (e.key === 'ArrowDown')  crosshairY = Math.min(1, crosshairY + step);

				const xPct = Math.round(crosshairX * 100);
				const yPct = Math.round(crosshairY * 100);
				liveRegionText = `Position: ${xPct}%, ${yPct}%`;
				break;
			}
			case 'Enter':
			case ' ':
				e.preventDefault();
				if (canSelectMore) {
					placePointAtCrosshair();
				}
				break;
		}
	}

	function handleFocus() {
		crosshairActive = true;
		crosshairX = 0.5;
		crosshairY = 0.5;
		liveRegionText = 'Position: 50%, 50%';
	}

	function handleBlur() {
		crosshairActive = false;
		liveRegionText = '';
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} class="qti-select-point-interaction">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-select-point-prompt qti-rich-content font-semibold mb-3">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div class="space-y-3">

	<!-- Visually-hidden live region announces crosshair position to screen readers -->
	<span
		aria-live="polite"
		aria-atomic="true"
		style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;"
	>{liveRegionText}</span>

	<div
		bind:this={imageContainer}
		class="image-container relative inline-block"
		style={disabled ? 'cursor: default;' : 'cursor: crosshair;'}
		role="button"
		tabindex={disabled ? -1 : 0}
		aria-label={i18n?.t('interactions.selectPoint.instructionAria') ?? 'Click or use arrow keys to position crosshair, then press Enter or Space to select a point on the image'}
		onclick={handleImageClick}
		onkeydown={handleKeydown}
		onfocus={handleFocus}
		onblur={handleBlur}
	>
		{#if parsedInteraction.imageData}
			{#if parsedInteraction.imageData.type === 'svg'}
				<div
					style="width: {parsedInteraction.imageData.width}px; height: {parsedInteraction.imageData.height}px; position: relative;"
				>
					{@html parsedInteraction.imageData.content}
				</div>
			{:else if parsedInteraction.imageData.src}
				<img
					src={parsedInteraction.imageData.src}
					alt={i18n?.t('interactions.selectPoint.canvas') ?? 'Selection canvas'}
					style="width: {parsedInteraction.imageData.width}px; height: {parsedInteraction.imageData.height}px; position: relative; z-index: 1;"
					class="block"
				/>
			{/if}

			<!-- Render selected points as markers -->
			{#each selectedPoints as point, index}
				{@const intrinsicWidth = parseInt(parsedInteraction.imageData?.width || '500')}
				{@const intrinsicHeight = parseInt(parsedInteraction.imageData?.height || '300')}
				{@const xPercent = (point.x / intrinsicWidth) * 100}
				{@const yPercent = (point.y / intrinsicHeight) * 100}
				{@const isCorrect = isShowingCorrect && correctPoints.some((p) => Math.abs(p.x - point.x) < 1 && Math.abs(p.y - point.y) < 1)}
				<button
					type="button"
					class="point-marker"
					class:point-marker-correct={isCorrect}
					style="left: {xPercent}%; top: {yPercent}%; z-index: 100;"
					onclick={(e) => {
						e.stopPropagation();
						removePoint(index);
					}}
					aria-label="Remove point {index + 1} at coordinates {point.x}, {point.y}{isCorrect ? '. Correct answer' : ''}"
					title="Click to remove this point ({point.x}, {point.y}){isCorrect ? ' - Correct' : ''}"
					{disabled}
				>
					<span class="point-number">{isCorrect ? '✓' : index + 1}</span>
				</button>
			{/each}

			<!-- Render correct points as markers (when in scorer mode and not already selected) -->
			{#if isShowingCorrect && correctPoints.length > 0}
				{#each correctPoints as point, index}
					{@const intrinsicWidth = parseInt(parsedInteraction.imageData?.width || '500')}
					{@const intrinsicHeight = parseInt(parsedInteraction.imageData?.height || '300')}
					{@const xPercent = (point.x / intrinsicWidth) * 100}
					{@const yPercent = (point.y / intrinsicHeight) * 100}
					{@const isAlreadySelected = selectedPoints.some((p) => Math.abs(p.x - point.x) < 1 && Math.abs(p.y - point.y) < 1)}
					<div
						part="correct-point"
						class="point-marker point-marker-correct"
						style="left: {xPercent}%; top: {yPercent}%; pointer-events: none; z-index: 200;"
						aria-label="Correct answer point at coordinates {point.x}, {point.y}"
						title="Correct answer: ({point.x}, {point.y})"
					>
						<span class="point-number">✓</span>
					</div>
				{/each}
			{/if}
		{:else}
			<div
				class="no-image-placeholder bg-base-200 flex items-center justify-center"
				style="width: 500px; height: 300px;"
			>
				<p class="text-base-content/50">{i18n?.t('interactions.selectPoint.noImage') ?? 'No image provided'}</p>
			</div>
		{/if}

		<!-- Keyboard crosshair overlay (K-01) — visible only when container has focus -->
		{#if crosshairActive && !disabled && parsedInteraction?.imageData}
			{@const imgW = parseInt(parsedInteraction.imageData.width) || 500}
			{@const imgH = parseInt(parsedInteraction.imageData.height) || 300}
			{@const cx = crosshairX * imgW}
			{@const cy = crosshairY * imgH}
			<svg
				aria-hidden="true"
				class="crosshair-overlay"
				style="width: {imgW}px; height: {imgH}px;"
				viewBox="0 0 {imgW} {imgH}"
				xmlns="http://www.w3.org/2000/svg"
			>
				<!-- Horizontal line -->
				<line x1="0" y1={cy} x2={imgW} y2={cy} class="crosshair-line" />
				<!-- Vertical line -->
				<line x1={cx} y1="0" x2={cx} y2={imgH} class="crosshair-line" />
				<!-- Centre dot -->
				<circle cx={cx} cy={cy} r="5" class="crosshair-dot" />
			</svg>
		{/if}
	</div>

	<div class="flex items-center justify-between text-sm text-base-content/70">
		<div>
			<span class="font-medium">Points selected:</span>
			<span class="ml-2">{selectedPoints.length} / {parsedInteraction.maxChoices}</span>
			{#if parsedInteraction.minChoices > 0}
				<span class="ml-2">
					{#if hasMetMinChoices}
						<span class="badge badge-success badge-sm">✓ Minimum met</span>
					{:else}
						<span class="badge badge-warning badge-sm">
							Select at least {parsedInteraction.minChoices}
						</span>
					{/if}
				</span>
			{/if}
		</div>

		{#if selectedPoints.length > 0}
			<button type="button" class="btn btn-sm btn-ghost" onclick={clearAllPoints} {disabled}>
				Clear All
			</button>
		{/if}
	</div>

	{#if !canSelectMore}
		<div class="alert alert-info">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
					part="limit-icon"
					class="qti-icon stroke-current shrink-0 w-6 h-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<span>Maximum points reached. Remove a point to add a new one.</span>
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

	.image-container {
		position: relative;
		display: inline-block;
		border: 2px solid color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 20%, transparent);
		border-radius: 8px;
		overflow: hidden;
	}

	.point-marker {
		position: absolute;
		width: 32px;
		height: 32px;
		transform: translate(-50%, -50%);
		background-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		border: 3px solid var(--pie-qti-primary-content, oklch(98% 0.01 277));
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.point-marker:hover {
		background-color: var(--pie-qti-error, oklch(71% 0.194 13.428));
		transform: translate(-50%, -50%) scale(1.1);
	}

	.point-marker:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.point-marker-correct {
		background-color: var(--pie-qti-success, oklch(76% 0.177 163.223)) !important;
		border-color: var(--pie-qti-success-content, oklch(98% 0.01 163.223)) !important;
		border-width: 4px !important;
		cursor: default;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 4px var(--pie-qti-success, oklch(76% 0.177 163.223)) !important;
		width: 50px !important;
		height: 50px !important;
		z-index: 200 !important;
		position: absolute !important;
		opacity: 1 !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
	}

	.point-marker-correct .point-number {
		font-size: 28px !important;
		font-weight: 900 !important;
		color: var(--pie-qti-success-content, oklch(98% 0.01 163.223)) !important;
		line-height: 1 !important;
		display: block !important;
	}

	.point-marker-correct:hover {
		background-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
		transform: translate(-50%, -50%);
	}

	.point-number {
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
		font-weight: 700;
		font-size: 14px;
	}

	.no-image-placeholder {
		border: 2px dashed color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 20%, transparent);
		border-radius: 8px;
	}

	/* K-01 keyboard crosshair overlay */
	.crosshair-overlay {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		z-index: 150;
	}

	.crosshair-line {
		stroke: #2563eb;
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
		opacity: 0.85;
	}

	.crosshair-dot {
		fill: #2563eb;
		opacity: 0.9;
	}
</style>
