/**
 * Path data of the stroke icons the interactions share, rendered through
 * `Icon.svelte`. Each icon is a 24×24 stroke drawing with round caps and
 * joins; the interaction chooses the part name and classes, so what renders
 * at each call site stays exactly what it rendered with its inline copy.
 */

/** A completed action: a tick. */
export const ICON_CHECK = 'M5 13l4 4L19 7';

/** A remove action: a cross. */
export const ICON_CLOSE = 'M6 18L18 6M6 6l12 12';

/** An informational state: a circled i. */
export const ICON_INFO = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
