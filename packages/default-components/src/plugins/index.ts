/**
 * QTI Interaction Plugins
 *
 * Imports all interaction plugins to trigger web component registration.
 * Each plugin directory contains a Svelte component that compiles to a
 * custom element (web component).
 *
 * These imports have side effects: they register the custom elements
 * with the browser's customElements registry.
 */

// Import all Svelte custom element components to trigger registration
import './choice/ChoiceInteraction.svelte';
import './slider/SliderInteraction.svelte';
import './order/OrderInteraction.svelte';
import './match/MatchInteraction.svelte';
import './associate/AssociateInteraction.svelte';
import './gap-match/GapMatchInteraction.svelte';
import './hotspot/HotspotInteraction.svelte';
import './hottext/HottextInteraction.svelte';
import './media/MediaInteraction.svelte';
import './custom/CustomInteraction.svelte';
import './end-attempt/EndAttemptInteraction.svelte';
import './position-object/PositionObjectInteraction.svelte';
import './graphic-gap-match/GraphicGapMatchInteraction.svelte';
import './graphic-order/GraphicOrderInteraction.svelte';
import './graphic-associate/GraphicAssociateInteraction.svelte';
import './select-point/SelectPointInteraction.svelte';
import './extended-text/ExtendedTextInteraction.svelte';
import './upload/UploadInteraction.svelte';
import './drawing/DrawingInteraction.svelte';
