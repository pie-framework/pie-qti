/**
 * @pie-qti/qti2-default-components
 *
 * Default Svelte-based component implementations for the QTI 2.x player.
 * These components are packaged as web components that work with the
 * framework-agnostic @pie-qti/qti2-item-player core.
 */

import type { ComponentRegistry } from '@pie-qti/qti2-item-player';

// Export shared utilities and helpers
export * from './shared/index.js';

/**
 * Register all default components with the ComponentRegistry
 *
 * This function should be called once at application startup to make
 * all default interaction components available to the player.
 *
 * IMPORTANT: Before calling this function, you MUST import the plugin loader:
 * ```typescript
 * import '@pie-qti/qti2-default-components/plugins';
 * ```
 * This import triggers web component registration via Svelte's customElement option.
 *
 * @param registry - The ComponentRegistry instance from the Player
 *
 * @example
 * ```typescript
 * import { Player } from '@pie-qti/qti2-item-player';
 * import '@pie-qti/qti2-default-components/plugins'; // Load web components
 * import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
 *
 * const player = new Player(qtiXml);
 * registerDefaultComponents(player.getComponentRegistry());
 * ```
 */
export function registerDefaultComponents(registry: ComponentRegistry): void {
	// ChoiceInteraction - Radio buttons or checkboxes
	registry.register('choiceInteraction', {
		name: 'default-choice',
		priority: 0,
		description: 'Default Svelte-based choice interaction',
		canHandle: () => true,
		tagName: 'pie-qti-choice',
		// No componentClass needed - Svelte already registered it
	});

	// SliderInteraction - Range slider
	registry.register('sliderInteraction', {
		name: 'default-slider',
		priority: 0,
		description: 'Default Svelte-based slider interaction',
		canHandle: () => true,
		tagName: 'pie-qti-slider',
	});

	// OrderInteraction - Sortable list
	registry.register('orderInteraction', {
		name: 'default-order',
		priority: 0,
		description: 'Default Svelte-based order interaction',
		canHandle: () => true,
		tagName: 'pie-qti-order',
	});

	// MatchInteraction - Match source to target
	registry.register('matchInteraction', {
		name: 'default-match',
		priority: 0,
		description: 'Default Svelte-based match interaction',
		canHandle: () => true,
		tagName: 'pie-qti-match',
	});

	// AssociateInteraction - Create associations between choices
	registry.register('associateInteraction', {
		name: 'default-associate',
		priority: 0,
		description: 'Default Svelte-based associate interaction',
		canHandle: () => true,
		tagName: 'pie-qti-associate',
	});

	// GapMatchInteraction - Fill gaps with words
	registry.register('gapMatchInteraction', {
		name: 'default-gap-match',
		priority: 0,
		description: 'Default Svelte-based gap match interaction',
		canHandle: () => true,
		tagName: 'pie-qti-gap-match',
	});

	// HotspotInteraction - Click on image hotspots
	registry.register('hotspotInteraction', {
		name: 'default-hotspot',
		priority: 0,
		description: 'Default Svelte-based hotspot interaction',
		canHandle: () => true,
		tagName: 'pie-qti-hotspot',
	});

	// HottextInteraction - Select text within content
	registry.register('hottextInteraction', {
		name: 'default-hottext',
		priority: 0,
		description: 'Default Svelte-based hottext interaction',
		canHandle: () => true,
		tagName: 'pie-qti-hottext',
	});

	// MediaInteraction - Audio/video playback with tracking
	registry.register('mediaInteraction', {
		name: 'default-media',
		priority: 0,
		description: 'Default Svelte-based media interaction',
		canHandle: () => true,
		tagName: 'pie-qti-media',
	});

	// CustomInteraction - Fallback for custom interactions
	registry.register('customInteraction', {
		name: 'default-custom',
		priority: 0,
		description: 'Default Svelte-based custom interaction',
		canHandle: () => true,
		tagName: 'pie-qti-custom',
	});

	// EndAttemptInteraction - End attempt button
	registry.register('endAttemptInteraction', {
		name: 'default-end-attempt',
		priority: 0,
		description: 'Default Svelte-based end attempt interaction',
		canHandle: () => true,
		tagName: 'pie-qti-end-attempt',
	});

	// PositionObjectInteraction - Drag objects onto canvas
	registry.register('positionObjectInteraction', {
		name: 'default-position-object',
		priority: 0,
		description: 'Default Svelte-based position object interaction',
		canHandle: () => true,
		tagName: 'pie-qti-position-object',
	});

	// GraphicGapMatchInteraction - Drag labels onto image hotspots
	registry.register('graphicGapMatchInteraction', {
		name: 'default-graphic-gap-match',
		priority: 0,
		description: 'Default Svelte-based graphic gap match interaction',
		canHandle: () => true,
		tagName: 'pie-qti-graphic-gap-match',
	});

	// GraphicOrderInteraction - Order items with graphic reference
	registry.register('graphicOrderInteraction', {
		name: 'default-graphic-order',
		priority: 0,
		description: 'Default Svelte-based graphic order interaction',
		canHandle: () => true,
		tagName: 'pie-qti-graphic-order',
	});

	// GraphicAssociateInteraction - Create associations on image
	registry.register('graphicAssociateInteraction', {
		name: 'default-graphic-associate',
		priority: 0,
		description: 'Default Svelte-based graphic associate interaction',
		canHandle: () => true,
		tagName: 'pie-qti-graphic-associate',
	});

	// SelectPointInteraction - Select points on image
	registry.register('selectPointInteraction', {
		name: 'default-select-point',
		priority: 0,
		description: 'Default Svelte-based select point interaction',
		canHandle: () => true,
		tagName: 'pie-qti-select-point',
	});

	// ExtendedTextInteraction - Rich text editor
	registry.register('extendedTextInteraction', {
		name: 'default-extended-text',
		priority: 0,
		description: 'Default Svelte-based extended text interaction',
		canHandle: () => true,
		tagName: 'pie-qti-extended-text',
	});

	// Note: TextEntryInteraction and InlineChoiceInteraction are handled
	// by ItemRenderer as inline interactions, not as separate components

	// Note: UploadInteraction and DrawingInteraction use shared Svelte components
	// (FileUpload and DrawingCanvas) rather than web components.
	// All 21 QTI 2.2 interactions are fully functional.
	// Future: Consider converting upload/drawing to web components for consistency.
}
