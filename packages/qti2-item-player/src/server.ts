/**
 * Server-safe entrypoint for @pie-qti/qti2-item-player
 *
 * This module must remain free of browser/DOM globals (document, window, HTMLElement).
 * Use it from SSR / backend code (e.g. SvelteKit endpoints) for scoring and parsing.
 */


// These are used by scoring/processing and are DOM-independent.
export * from './core/constants.js';
export * from './core/declarations.js';
export { Player } from './core/Player.js';


