/**
 * QTI 2.2 Item Player Components
 *
 * Top-level components for rendering complete QTI items and their orchestration.
 * These are player-specific UI components.
 *
 * Note: These exports are for use in Svelte projects.
 * For interaction implementations, use @pie-qti/qti2-default-components.
 */

// Top-level player component (recommended for most use cases)
export { default as ItemPlayer } from './ItemPlayer.svelte';

// Player UI components
export { default as ItemBody } from './ItemBody.svelte';
export { default as ModalFeedbackDisplay } from './ModalFeedbackDisplay.svelte';

// Utility actions (dependency-free)
export { typesetAction } from './actions/typesetAction';
