/**
 * Keyboard model shared by the custom radio groups (single-select hottext and hotspot), the
 * WAI-ARIA APG radio group pattern as native radios behave.
 */

/**
 * The move an arrow key makes through a radio group, in document order: 1 forward, -1 back,
 * 0 for any other key. Up/Down are fixed; Left/Right follow the inline direction of `element`,
 * as native radios do, so under RTL ArrowLeft moves forward. Arrows held with Alt, Ctrl or
 * Meta stay with the browser and assistive technology (Alt+Left is Back): no move.
 */
export function radioArrowStep(event: KeyboardEvent, element: Element): number {
	if (event.altKey || event.ctrlKey || event.metaKey) return 0;
	if (event.key === 'ArrowDown') return 1;
	if (event.key === 'ArrowUp') return -1;
	if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return 0;
	const rtl = getComputedStyle(element).direction === 'rtl';
	return (event.key === 'ArrowRight') !== rtl ? 1 : -1;
}

/** The index `step` places away from `index` in a group of `count`, wrapping at both ends. */
export function wrapIndex(index: number, step: number, count: number): number {
	return (((index + step) % count) + count) % count;
}
