/**
 * The caller side of the shared ImageStage's sizing handshake, one instance per
 * graphic interaction: the stage's pixel space (the image's authored width/height,
 * else a raster image's natural size once loaded, else unknown), whether the
 * overlay may draw in that space, the once-only author warning when the space
 * never arrives, and the frame/scale derivations that keep CSS-px sizes steady
 * while the image scales with its container (WCAG 1.4.10).
 *
 * QTI coordinates live in the image's pixel space, so unknown means the
 * interaction refuses to place anything: a guessed space would silently
 * misplace hotspots, points and areaMapping.
 */

export interface StageImageOptions {
	/**
	 * Whether the interaction's coordinates need the image's pixel space right now.
	 * Caller-derived, since the interactions legitimately differ: most gate on their
	 * image data (an absent image needs no space), while the hotspot's image is
	 * mandatory — the regions are its whole interaction — so it gates on the parsed
	 * interaction alone.
	 */
	needsDimensions(): boolean;
	/** The author warning when the pixel space never arrives; each interaction names itself in it. */
	missingDimensionsWarning: string;
}

export interface StageImage {
	/** The stage's pixel space; bind these to ImageStage's `width`/`height`. */
	imageWidth: number | null;
	imageHeight: number | null;
	/** Whether the raster image failed to load; bind to ImageStage's `failed`. */
	imageFailed: boolean;
	/**
	 * True while a raster image without authored dimensions is still loading: the
	 * pixel space may still arrive, so the refusal holds until this settles. Bind to
	 * ImageStage's `awaiting`.
	 */
	awaitingNaturalSize: boolean;
	/** The stage container's rendered width (CSS px); bind to ImageStage's `renderedWidth` (with `reportWidth`). */
	renderedWidth: number;
	/** The overlay may draw: both pixel dimensions are known. */
	readonly hasImageDimensions: boolean;
	/** The interaction needs the pixel space, has none, and none is still coming. */
	readonly missingDimensions: boolean;
	/** Rendered CSS px per authored image px, for sizes that must not scale with the image; 1 while unknown. */
	readonly renderScale: number;
	/**
	 * Reflow (WCAG 1.4.10): the stage frame fills its container up to the image's
	 * natural size (plus the frame's 2px borders); empty while the size is unknown.
	 */
	readonly frameStyle: string;
	/**
	 * Tell the author once, on the console, when the pixel space never arrives.
	 * Call from a component effect so it re-runs as the state settles.
	 */
	warnOnceMissingDimensions(): void;
}

export function createStageImage(options: StageImageOptions): StageImage {
	let imageWidth = $state<number | null>(null);
	let imageHeight = $state<number | null>(null);
	let imageFailed = $state(false);
	let awaitingNaturalSize = $state(false);
	let renderedWidth = $state(0);

	const hasImageDimensions = $derived(imageWidth !== null && imageHeight !== null);
	const missingDimensions = $derived(options.needsDimensions() && !hasImageDimensions && !awaitingNaturalSize);
	const frameStyle = $derived(imageWidth ? `max-width: calc(${imageWidth}px + 4px);` : '');
	const renderScale = $derived(imageWidth && renderedWidth > 0 ? renderedWidth / imageWidth : 1);

	let warnedMissingDimensions = false;
	function warnOnceMissingDimensions(): void {
		if (missingDimensions && !warnedMissingDimensions) {
			warnedMissingDimensions = true;
			console.warn(options.missingDimensionsWarning);
		}
	}

	return {
		get imageWidth() {
			return imageWidth;
		},
		set imageWidth(value: number | null) {
			imageWidth = value;
		},
		get imageHeight() {
			return imageHeight;
		},
		set imageHeight(value: number | null) {
			imageHeight = value;
		},
		get imageFailed() {
			return imageFailed;
		},
		set imageFailed(value: boolean) {
			imageFailed = value;
		},
		get awaitingNaturalSize() {
			return awaitingNaturalSize;
		},
		set awaitingNaturalSize(value: boolean) {
			awaitingNaturalSize = value;
		},
		get renderedWidth() {
			return renderedWidth;
		},
		set renderedWidth(value: number) {
			renderedWidth = value;
		},
		get hasImageDimensions() {
			return hasImageDimensions;
		},
		get missingDimensions() {
			return missingDimensions;
		},
		get renderScale() {
			return renderScale;
		},
		get frameStyle() {
			return frameStyle;
		},
		warnOnceMissingDimensions,
	};
}
