<script lang="ts">
	/**
	 * The shared image stage of the graphic interactions (hotspot, graphic order,
	 * graphic associate, graphic gap match, select point, position object and the
	 * drawing canvas): the positioned container that holds the stage image — an
	 * inline SVG or a raster `<img>`, or a localized load-failure panel — and
	 * resolves the pixel space every overlay is drawn in.
	 *
	 * Sizing (`width`/`height`, bound):
	 * - `'refuse'`: authored width/height, else the raster image's natural size
	 *   once loaded, else null — the caller refuses to draw an overlay whose
	 *   viewBox would be a guess (QTI coords live in image pixel space).
	 * - `'fallback-strict'`: per axis, a positive authored value, else the
	 *   fallback. (The drawing canvas uses `'fallback-loose'`, which accepts any
	 *   finite authored number, because its canvas pixel size is the response's
	 *   resolution and a blank canvas is a valid answer.)
	 *
	 * The container, image and error classes stay the caller's (each interaction
	 * styles its own stage); this component owns the media markup, the
	 * load/error tracking, the sizing style and — via `reportWidth` — the
	 * rendered width the caller needs to size hit targets and badges in CSS px.
	 * Overlays and controls are the caller's `{@render children()}` inside the
	 * container.
	 */
	import type { Snippet } from 'svelte';
	import { observeWidth } from '../utils/graphicRegions';

	/** The stage image as the graphic interactions deliver it. */
	interface StageImage {
		type: 'image' | 'svg';
		src?: string;
		content?: string;
		width?: string | number;
		height?: string | number;
		alt?: string;
		altDescription?: string;
		decorative?: boolean;
	}

	interface Props {
		imageData: StageImage | null | undefined;
		/** The image's text alternative, already resolved by the caller. */
		alt: string;
		/** Longer description; referenced from the image by `descriptionId`. */
		description?: string;
		descriptionId?: string;
		/** Class of the positioned container (the caller styles it). */
		containerClass?: string;
		/** Part name of the container, when the caller exposes one. */
		containerPart?: string;
		/**
		 * Extra attributes spread onto the container — event handlers, `role`,
		 * `tabindex`, `aria-label` — for interactions whose stage is itself the
		 * input surface (position object's placement canvas).
		 */
		containerProps?: Record<string, unknown>;
		/** Extra inline style placed before the sizing style. */
		containerStyle?: string;
		/**
		 * Whether the sizing style caps the container at the stage's width
		 * (`max-width`). False when the cap lives on a caller-owned frame around
		 * the container and only the aspect ratio belongs here.
		 */
		capContainerWidth?: boolean;
		/** Classes of the inline-SVG content layer and the raster `<img>`. */
		svgContentClass?: string;
		imgClass?: string;
		/** Classes of the failed-load panel. */
		errorClass?: string;
		/** Part names of the media and the error panel (omit for none). */
		mediaPart?: string;
		errorPart?: string;
		/** Inline style for the media layers (e.g. `pointer-events: none`). */
		mediaInlineStyle?: string;
		/** Localized message shown when the image fails to load. */
		loadErrorText: string;
		/** Called with the failed `src`, after `failed` flips (caller warns). */
		onImageError?: (src: string) => void;
		/** How the stage's pixel space is resolved; see above. */
		sizing: 'refuse' | 'fallback-strict' | 'fallback-loose';
		/** Fallback size for the `fallback-*` modes. */
		fallbackWidth?: number;
		fallbackHeight?: number;
		/** Report the container's rendered width (CSS px) via `renderedWidth`. */
		reportWidth?: boolean;
		/** The stage's pixel space, or null when unknown (see `sizing`). */
		width?: number | null;
		height?: number | null;
		/** True when the raster image failed to load. */
		failed?: boolean;
		/**
		 * True while a raster image without authored dimensions is still loading
		 * (`refuse` mode): the pixel space may still arrive, so the caller holds
		 * its refusal until this is false.
		 */
		awaiting?: boolean;
		/** The container's rendered width (CSS px), when `reportWidth`. */
		renderedWidth?: number;
		/** The container element, for callers that focus or measure it. */
		container?: HTMLElement | null;
		/** Overlays and controls, rendered inside the container after the image. */
		children?: Snippet;
	}

	let {
		imageData,
		alt,
		description = '',
		descriptionId,
		containerClass,
		containerPart,
		containerProps = {},
		containerStyle = '',
		capContainerWidth = true,
		svgContentClass,
		imgClass,
		errorClass,
		mediaPart,
		errorPart,
		mediaInlineStyle,
		loadErrorText,
		onImageError,
		sizing,
		fallbackWidth,
		fallbackHeight,
		reportWidth = false,
		width = $bindable<number | null>(null),
		height = $bindable<number | null>(null),
		failed = $bindable(false),
		awaiting = $bindable(false),
		renderedWidth = $bindable(0),
		container = $bindable<HTMLElement | null>(null),
		children,
	}: Props = $props();

	const isSvg = $derived(imageData?.type === 'svg' && !!imageData.content);
	const src = $derived(imageData?.type === 'image' ? (imageData.src ?? '') : '');

	/** A positive finite number, as the authored pixel dimensions must be. */
	function positiveNumber(value: unknown): number | null {
		const n = value ? Number(value) : Number.NaN;
		return Number.isFinite(n) && n > 0 ? n : null;
	}

	/** Any finite number, as the drawing canvas' pixel size may be zero. */
	function finiteNumber(value: unknown): number | null {
		if (value === undefined || value === null || value === '') return null;
		const n = Number(value);
		return Number.isFinite(n) ? n : null;
	}

	// Raster images report their natural size once loaded; that is the pixel
	// space QTI coords are authored in when the item declares no width/height.
	let loaded = $state<{ src: string; width: number; height: number } | null>(null);
	let failedSrc = $state<string | null>(null);

	const naturalSize = $derived(loaded && loaded.src === src ? loaded : null);
	const imageFailed = $derived(!!src && failedSrc === src);
	const authoredWidth = $derived(positiveNumber(imageData?.width));
	const authoredHeight = $derived(positiveNumber(imageData?.height));

	const stageWidth = $derived.by<number | null>(() => {
		if (sizing === 'refuse') {
			if (authoredWidth !== null && authoredHeight !== null) return authoredWidth;
			return naturalSize?.width ?? null;
		}
		if (sizing === 'fallback-loose') {
			return finiteNumber(imageData?.width) ?? fallbackWidth ?? null;
		}
		// Fallback-strict mirrors today's components: a positive authored value, else
		// the fallback. The natural size is not consulted here — the graphic
		// interactions that adopt the declared→natural→refuse rule switch to
		// 'refuse' mode; this mode exists to keep their current answer while they do.
		return authoredWidth ?? fallbackWidth ?? null;
	});
	const stageHeight = $derived.by<number | null>(() => {
		if (sizing === 'refuse') {
			if (authoredWidth !== null && authoredHeight !== null) return authoredHeight;
			return naturalSize?.height ?? null;
		}
		if (sizing === 'fallback-loose') {
			return finiteNumber(imageData?.height) ?? fallbackHeight ?? null;
		}
		return authoredHeight ?? fallbackHeight ?? null;
	});

	// Refuse mode: while a raster image without authored dimensions is still
	// loading, the space may still arrive; only a failed load (or none pending)
	// makes the refusal final.
	const awaitingNatural = $derived(
		sizing === 'refuse' &&
			!!src &&
			(authoredWidth === null || authoredHeight === null) &&
			!naturalSize &&
			!imageFailed,
	);

	$effect(() => {
		width = stageWidth;
		height = stageHeight;
		failed = imageFailed;
		awaiting = awaitingNatural;
	});

	// Fill available width up to the stage's pixel size, keeping its aspect
	// ratio (WCAG 1.4.10 Reflow).
	const sizingStyle = $derived.by(() => {
		const parts: string[] = [];
		if (containerStyle) parts.push(containerStyle.replace(/;\s*$/, ';'));
		if (capContainerWidth && stageWidth !== null) parts.push(`max-width: ${stageWidth}px;`);
		if (stageWidth !== null && stageHeight !== null) parts.push(`aspect-ratio: ${stageWidth} / ${stageHeight};`);
		return parts.join(' ');
	});

	function handleImageLoad(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		if (img.naturalWidth > 0 && img.naturalHeight > 0) {
			loaded = { src, width: img.naturalWidth, height: img.naturalHeight };
		}
	}

	function handleImageError() {
		failedSrc = src;
		onImageError?.(src);
	}

	function reportRenderedWidth(w: number) {
		if (reportWidth) renderedWidth = w;
	}
</script>

<div bind:this={container} part={containerPart} class={containerClass} style={sizingStyle} {...containerProps} use:observeWidth={reportRenderedWidth}>
	{#if imageData}
		{#if isSvg}
			<div
				part={mediaPart}
				class={svgContentClass}
				style={mediaInlineStyle}
				role={imageData.decorative ? undefined : 'img'}
				aria-hidden={imageData.decorative ? 'true' : undefined}
				aria-label={imageData.decorative ? undefined : alt}
				aria-describedby={description ? descriptionId : undefined}
			>
				{@html imageData.content}
			</div>
		{:else if imageFailed}
			<div part={errorPart} class={errorClass} style={mediaInlineStyle}>
				<p>{loadErrorText}</p>
				{#if imageData.alt && !imageData.decorative}
					<p>{imageData.alt}</p>
				{/if}
			</div>
		{:else if src}
			<img
				part={mediaPart}
				class={imgClass}
				style={mediaInlineStyle}
				{src}
				{alt}
				aria-describedby={description ? descriptionId : undefined}
				onload={handleImageLoad}
				onerror={handleImageError}
			/>
		{/if}
	{/if}
	{@render children?.()}
</div>

<style>
	/*
	 * The shared image stage's own layout styles. Each rule is keyed on the
	 * class a caller passes (containerClass, svgContentClass/imgClass,
	 * errorClass), so this one style sheet — injected wherever a graphic stage
	 * renders, shadow or light DOM — carries the stage layout of all seven
	 * graphic interactions. The overlays and controls the callers render inside
	 * the stage stay styled by the callers.
	 */

	/* The stage container: the positioned box the image and overlays align in. */
	.qti-hotspot-media,
	.qti-go-media,
	.qti-ga-canvas,
	.qti-ggm-canvas,
	.qti-sp-canvas,
	.qti-po-canvas,
	.qti-dc-canvas-wrap {
		position: relative;
		width: 100%;
	}
	/* select-point's stage frame doubles as the selection canvas' outline. */
	.qti-sp-canvas {
		box-sizing: border-box;
		outline: 2px solid color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 20%, transparent);
		border-radius: 8px;
	}

	/* The stage image fills the container, which owns the aspect ratio. */
	.qti-hotspot-image,
	.qti-go-image,
	.qti-ga-image,
	.qti-ggm-image,
	.qti-sp-image,
	.qti-po-image {
		display: block;
		width: 100%;
		height: 100%;
	}
	.qti-go-image,
	.qti-ga-image,
	.qti-sp-image,
	.qti-po-image {
		object-fit: contain;
	}
	.qti-po-image {
		pointer-events: none;
	}
	/* Inline SVG injected via {@html} is not scoped; size it inside the stage. */
	.qti-hotspot-image :global(svg),
	.qti-go-image :global(svg),
	.qti-ga-image :global(svg),
	.qti-ggm-image :global(svg),
	.qti-sp-image :global(svg),
	.qti-po-image :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	/* The drawing canvas' background layers sit under the canvas element. */
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

	/* The failed-load panel: a bordered message box instead of a broken image. */
	.qti-hotspot-image-error,
	.qti-go-image-error,
	.qti-ga-image-error,
	.qti-ggm-image-error,
	.qti-sp-image-error,
	.qti-po-image-error,
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
	.qti-hotspot-image-error,
	.qti-ggm-image-error {
		min-height: 6rem;
	}
	/* hotspot styles the failed load like its other authoring alerts. */
	.qti-hotspot-image-error {
		border: 2px dashed var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
	}
	.qti-hotspot-image-error p,
	.qti-go-image-error p,
	.qti-ga-image-error p,
	.qti-ggm-image-error p,
	.qti-sp-image-error p,
	.qti-po-image-error p,
	.qti-dc-background-error p {
		margin: 0;
	}

	/*
	 * Focus on a graphic region (WCAG 2.4.7): one rule for every graphic
	 * interaction, because a region that is both selected and focused otherwise
	 * shows two nearly identical thick outlines. The indicator is an offset
	 * outer ring — a focus-coloured ring around the region, drawn by widening
	 * its halo layer for the SVG-shape regions, or an offset outline for the
	 * HTML-button controls — so focus reads by geometry, not colour alone, and
	 * keeps at least 3:1 against adjacent colours from the theme's focus token.
	 * The doubled region class out-specifics the callers' selected-state halo
	 * widths, so the ring wins on a selected region too.
	 */
	.qti-graphic-region.qti-graphic-region:focus-within .qti-graphic-halo {
		stroke: var(--pie-qti-focus, #4338ca);
		stroke-width: 12px;
	}
	.qti-graphic-control:focus-visible {
		outline: 3px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
</style>
