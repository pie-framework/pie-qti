/**
 * @pie-qti/default-components
 *
 * Default Svelte-based component implementations for the QTI player.
 * These components are packaged as web components that work with the
 * framework-agnostic @pie-qti/item-player core.
 */

// Export shared utilities and helpers
export * from './shared/index.js';

interface DefaultComponentRegistration {
	name: string;
	description: string;
	tagName: string;
}

interface DefaultComponentRegistry {
	register(type: string, component: DefaultComponentRegistration): void;
}

const DEFAULT_COMPONENTS_BY_TYPE = {
	choiceInteraction: {
		name: 'default-choice',
		description: 'Default Svelte-based choice interaction',
		tagName: 'pie-qti-choice',
	},
	sliderInteraction: {
		name: 'default-slider',
		description: 'Default Svelte-based slider interaction',
		tagName: 'pie-qti-slider',
	},
	orderInteraction: {
		name: 'default-order',
		description: 'Default Svelte-based order interaction',
		tagName: 'pie-qti-order',
	},
	matchInteraction: {
		name: 'default-match',
		description: 'Default Svelte-based match interaction',
		tagName: 'pie-qti-match',
	},
	associateInteraction: {
		name: 'default-associate',
		description: 'Default Svelte-based associate interaction',
		tagName: 'pie-qti-associate',
	},
	gapMatchInteraction: {
		name: 'default-gap-match',
		description: 'Default Svelte-based gap match interaction',
		tagName: 'pie-qti-gap-match',
	},
	hotspotInteraction: {
		name: 'default-hotspot',
		description: 'Default Svelte-based hotspot interaction',
		tagName: 'pie-qti-hotspot',
	},
	hottextInteraction: {
		name: 'default-hottext',
		description: 'Default Svelte-based hottext interaction',
		tagName: 'pie-qti-hottext',
	},
	mediaInteraction: {
		name: 'default-media',
		description: 'Default Svelte-based media interaction',
		tagName: 'pie-qti-media',
	},
	customInteraction: {
		name: 'default-custom',
		description: 'Default Svelte-based custom interaction',
		tagName: 'pie-qti-custom',
	},
	endAttemptInteraction: {
		name: 'default-end-attempt',
		description: 'Default Svelte-based end attempt interaction',
		tagName: 'pie-qti-end-attempt',
	},
	positionObjectInteraction: {
		name: 'default-position-object',
		description: 'Default Svelte-based position object interaction',
		tagName: 'pie-qti-position-object',
	},
	graphicGapMatchInteraction: {
		name: 'default-graphic-gap-match',
		description: 'Default Svelte-based graphic gap match interaction',
		tagName: 'pie-qti-graphic-gap-match',
	},
	graphicOrderInteraction: {
		name: 'default-graphic-order',
		description: 'Default Svelte-based graphic order interaction',
		tagName: 'pie-qti-graphic-order',
	},
	graphicAssociateInteraction: {
		name: 'default-graphic-associate',
		description: 'Default Svelte-based graphic associate interaction',
		tagName: 'pie-qti-graphic-associate',
	},
	selectPointInteraction: {
		name: 'default-select-point',
		description: 'Default Svelte-based select point interaction',
		tagName: 'pie-qti-select-point',
	},
	extendedTextInteraction: {
		name: 'default-extended-text',
		description: 'Default Svelte-based extended text interaction',
		tagName: 'pie-qti-extended-text',
	},
	uploadInteraction: {
		name: 'default-upload',
		description: 'Default Svelte-based upload interaction',
		tagName: 'pie-qti-upload',
	},
	drawingInteraction: {
		name: 'default-drawing',
		description: 'Default Svelte-based drawing interaction',
		tagName: 'pie-qti-drawing',
	},
} satisfies Record<string, DefaultComponentRegistration>;

export function getDefaultComponentTypes(): string[] {
	return Object.keys(DEFAULT_COMPONENTS_BY_TYPE);
}

/**
 * Register all default components with the ComponentRegistry.
 *
 * This function should be called once at application startup to make all default
 * block interaction components available to the player. Inline interactions are
 * rendered in-flow by @pie-qti/item-player.
 */
export function registerDefaultComponents(registry: DefaultComponentRegistry): void {
	for (const [type, component] of Object.entries(DEFAULT_COMPONENTS_BY_TYPE)) {
		registry.register(type, component);
	}

	registry.register('catalogPopup', {
		name: 'default-catalog-popup',
		description: 'Default Svelte-based catalog popup dialog',
		tagName: 'pie-qti-catalog-popup',
	});
}
