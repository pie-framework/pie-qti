/**
 * Shared helpers for the graphic interactions (hotspot, graphic associate,
 * graphic gap match, graphic order, select point, position object).
 *
 * QTI region `coords` and point responses live in the image's natural pixel
 * space. Renderers scale the image to its container (WCAG 1.4.10 Reflow), so
 * everything here works in natural image coordinates and converts to and from
 * rendered CSS pixels only at the edges (pointer input, target sizing).
 */

/** Minimum pointer target edge in CSS px: WCAG 2.2 SC 2.5.8 Target Size (Minimum), level AA. */
const MIN_TARGET_PX = 24;

export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Point {
	x: number;
	y: number;
}

/** Parse QTI `coords` ("a,b,c") into numbers; non-numeric parts become NaN. */
function parseCoords(coords: string): number[] {
	return coords.split(',').map((part) => Number(part.trim()));
}

/** Bounding box of a QTI shape (circle, ellipse, rect, poly) in image coordinates. */
export function shapeBounds(shape: string, coords: string): Bounds | null {
	const n = parseCoords(coords);
	if (n.some((value) => !Number.isFinite(value))) return null;
	switch (shape) {
		case 'circle': {
			const [cx, cy, r] = n;
			if (r === undefined) return null;
			return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
		}
		case 'ellipse': {
			const [cx, cy, rx, ry] = n;
			if (ry === undefined) return null;
			return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
		}
		case 'rect': {
			const [left, top, right, bottom] = n;
			if (bottom === undefined) return null;
			return { x: left, y: top, width: right - left, height: bottom - top };
		}
		case 'poly': {
			const xs = n.filter((_, i) => i % 2 === 0);
			const ys = n.filter((_, i) => i % 2 === 1);
			if (xs.length === 0 || ys.length === 0) return null;
			const x = Math.min(...xs);
			const y = Math.min(...ys);
			return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
		}
		default:
			return null;
	}
}

/** Centre of a QTI shape in image coordinates (polygon: vertex average). */
export function shapeCenter(shape: string, coords: string): Point {
	const n = parseCoords(coords);
	if (shape === 'circle' || shape === 'ellipse') return { x: n[0] || 0, y: n[1] || 0 };
	if (shape === 'poly') {
		const xs = n.filter((_, i) => i % 2 === 0);
		const ys = n.filter((_, i) => i % 2 === 1);
		if (xs.length === 0) return { x: 0, y: 0 };
		return {
			x: xs.reduce((a, b) => a + b, 0) / xs.length,
			y: ys.reduce((a, b) => a + b, 0) / ys.length,
		};
	}
	const bounds = shapeBounds(shape, coords);
	return bounds ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : { x: n[0] || 0, y: n[1] || 0 };
}

/**
 * Width (CSS px) of a transparent, non-scaling hit stroke that grows a shape's
 * pointer target to at least {@link MIN_TARGET_PX} at the rendered scale. The
 * stroke straddles the outline, so the target's smallest extent becomes
 * `rendered size + stroke`. Zero for shapes that are already large enough.
 * Scoring geometry is untouched: only the hit area grows.
 */
export function hitStrokeWidth(shape: string, coords: string, renderScale: number): number {
	const bounds = shapeBounds(shape, coords);
	if (!bounds) return 0;
	const smallest = Math.min(bounds.width, bounds.height) * (renderScale > 0 ? renderScale : 1);
	return Math.max(0, Math.ceil(MIN_TARGET_PX - smallest));
}

/**
 * Map a pointer position (client px) on the rendered image to natural image
 * coordinates, so responses stay in the image's own pixel space at any scale.
 */
export function clientToImagePoint(
	clientX: number,
	clientY: number,
	rect: { left: number; top: number; width: number; height: number },
	naturalWidth: number,
	naturalHeight: number,
): Point | null {
	if (!(rect.width > 0) || !(rect.height > 0)) return null;
	const x = ((clientX - rect.left) / rect.width) * naturalWidth;
	const y = ((clientY - rect.top) / rect.height) * naturalHeight;
	return {
		x: Math.min(naturalWidth, Math.max(0, Math.round(x))),
		y: Math.min(naturalHeight, Math.max(0, Math.round(y))),
	};
}

export interface ImageTextAlternative {
	alt?: string;
	altDescription?: string;
	decorative?: boolean;
}

/**
 * The `alt` to render for an authored graphic-interaction image: empty only when
 * the author explicitly marked it decorative, else the authored text, else the
 * localized generic `fallback` (never an identifier or interaction-type name).
 */
export function imageAltText(image: ImageTextAlternative | null | undefined, fallback: string): string {
	if (image?.decorative) return '';
	return image?.alt?.trim() || fallback;
}

/**
 * Escape plain text for a renderer that takes HTML (e.g. SortableList item text).
 * Extracted hotspot labels are decoded plain text, not sanitized HTML.
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Svelte action reporting an element's rendered width (CSS px) now and on
 * resize. Environments without ResizeObserver report once.
 */
export function observeWidth(node: HTMLElement, onWidth: (width: number) => void) {
	let callback = onWidth;
	callback(node.getBoundingClientRect().width);
	const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
	const observer = RO
		? new RO((entries) => {
				for (const entry of entries) callback(entry.contentRect.width);
			})
		: null;
	observer?.observe(node);
	return {
		update(next: (width: number) => void) {
			callback = next;
		},
		destroy() {
			observer?.disconnect();
		},
	};
}
