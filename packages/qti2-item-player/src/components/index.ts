/**
 * QTI 2.2 Item Player Components
 *
 * Top-level components for rendering complete QTI items and their orchestration.
 * Also exports individual interaction components for advanced use cases.
 *
 * Note: These exports are for use in Svelte projects.
 * Import from '@pie-qti/qti2-item-player/components' in your Svelte app.
 */

export { default as AssociateInteraction } from './AssociateInteraction.svelte';
// Utility actions (dependency-free)
export { typesetAction } from './actions/typesetAction';
// Individual interaction components (for advanced customization)
export { default as ChoiceInteraction } from './ChoiceInteraction.svelte';
export { default as CustomInteraction } from './CustomInteraction.svelte';
export { default as CustomInteractionFallback } from './CustomInteractionFallback.svelte';
export { default as DrawingCanvas } from './DrawingCanvas.svelte';
export { default as EndAttemptInteraction } from './EndAttemptInteraction.svelte';
export { default as FileUpload } from './FileUpload.svelte';
export { default as GapMatchInteraction } from './GapMatchInteraction.svelte';
export { default as GraphicAssociateInteraction } from './GraphicAssociateInteraction.svelte';
export { default as GraphicGapMatch } from './GraphicGapMatch.svelte';
export { default as GraphicGapMatchAdapter } from './GraphicGapMatchAdapter.svelte';
export { default as GraphicOrderInteraction } from './GraphicOrderInteraction.svelte';
export { default as HotspotInteraction } from './HotspotInteraction.svelte';
export { default as HottextInteraction } from './HottextInteraction.svelte';
export { default as InlineInteractionRenderer } from './InlineInteractionRenderer.svelte';
export { default as ItemBody } from './ItemBody.svelte';
// Top-level player components (recommended for most use cases)
export { default as ItemPlayer } from './ItemPlayer.svelte';
export { default as MatchDragDrop } from './MatchDragDrop.svelte';
export { default as MatchInteraction } from './MatchInteraction.svelte';
export { default as MathContent } from './MathContent.svelte';
export { default as MediaInteraction } from './MediaInteraction.svelte';
export { default as ModalFeedbackDisplay } from './ModalFeedbackDisplay.svelte';
export { default as OrderInteraction } from './OrderInteraction.svelte';
export { default as PositionObjectInteraction } from './PositionObjectInteraction.svelte';
export { default as RichTextEditor } from './RichTextEditor.svelte';
export { default as SelectPointInteraction } from './SelectPointInteraction.svelte';
export { default as SliderInteraction } from './SliderInteraction.svelte';
export { default as SortableList } from './SortableList.svelte';
