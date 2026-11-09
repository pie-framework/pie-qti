/**
 * @pie-qti/default-components
 *
 * Default Svelte-based component implementations for the QTI player.
 * These components are packaged as web components that work with the
 * framework-agnostic @pie-qti/item-player core.
 */

import { DEFAULT_COMPONENT_TAGS_BY_TYPE } from '@pie-qti/item-player';

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

/**
 * The interaction components this package ships, by QTI interaction type: item-player's
 * default tags without `catalogPopup`, which is not an interaction and registers on its own.
 */
function defaultInteractionTags() {
	return Object.entries(DEFAULT_COMPONENT_TAGS_BY_TYPE).filter(([type]) => type !== 'catalogPopup');
}

export function getDefaultComponentTypes(): string[] {
	return defaultInteractionTags().map(([type]) => type);
}

/**
 * Register all default components with the ComponentRegistry.
 *
 * This function should be called once at application startup to make all default
 * block interaction components available to the player. Inline interactions are
 * rendered in-flow by @pie-qti/item-player.
 */
export function registerDefaultComponents(registry: DefaultComponentRegistry): void {
	for (const [type, { name, tagName }] of defaultInteractionTags()) {
		registry.register(type, { name, description: `Default Svelte-based component for ${type}`, tagName });
	}

	const { name, tagName } = DEFAULT_COMPONENT_TAGS_BY_TYPE.catalogPopup;
	registry.register('catalogPopup', { name, description: 'Default Svelte-based catalog popup dialog', tagName });
}
