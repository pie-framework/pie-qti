/**
 * Plugin System for QTI 2.2 Item Player
 *
 * Provides extensible plugin architecture for custom extractors
 * and interaction rendering.
 */

import type { ExtractionRegistry } from '../extraction/ExtractionRegistry.js';
import type { PlayerConfig, QTIRole } from '../types/index.js';
import type { ComponentRegistry } from './ComponentRegistry.js';
import type { Player } from './Player.js';

/**
 * QTI element type (from node-html-parser or browser DOM)
 */
export type QTIElement = any;

/**
 * QTI Plugin interface
 *
 * Plugins can register custom extractors and web components to handle vendor-specific QTI extensions.
 *
 * @example
 * ```typescript
 * const myPlugin: QTIPlugin = {
 *   name: '@vendor/my-qti-plugin',
 *   version: '1.0.0',
 *   description: 'Custom QTI extensions',
 *
 *   registerExtractors(registry: ExtractionRegistry) {
 *     // Register custom element extractors
 *     registry.register(myCustomExtractor);
 *   },
 *
 *   registerComponents(registry: ComponentRegistry) {
 *     // Register custom web components
 *     registry.register('choiceInteraction', {
 *       name: 'my-choice',
 *       priority: 100,
 *       canHandle: (data) => data.interactionClasses?.includes('my-custom'),
 *       tagName: 'my-custom-choice'
 *     });
 *   }
 * };
 * ```
 */
export interface QTIPlugin {
	/** Unique plugin identifier */
	name: string;

	/** Semantic version */
	version: string;

	/** Optional plugin description */
	description?: string;

	/** Dependencies on other plugins (by name) */
	dependencies?: string[];

	/** Lifecycle hooks */
	lifecycle?: PluginLifecycle;

	/** Register custom extractors with the extraction registry */
	registerExtractors?(registry: ExtractionRegistry): void;

	/** Register custom web components with the component registry */
	registerComponents?(registry: ComponentRegistry): void;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
	/** Called when plugin is registered */
	onRegister?(context: PluginContext): void | Promise<void>;

	/** Called before item rendering starts */
	onBeforeRender?(context: RenderContext): void | Promise<void>;

	/** Called after item rendering completes */
	onAfterRender?(context: RenderContext): void | Promise<void>;

	/** Called when plugin is unregistered */
	onUnregister?(): void | Promise<void>;
}

/**
 * Context provided to plugins during registration
 *
 * Note: Player reference is NOT available during registration to avoid circular dependencies.
 * Use RenderContext for lifecycle hooks that need Player access.
 */
export interface PluginContext {
	/** Extraction registry for custom extractors */
	extractionRegistry: ExtractionRegistry;

	/** Component registry for custom web components */
	componentRegistry: ComponentRegistry;

	/** Item document (if loaded) - can be browser Document or node-html-parser HTMLElement */
	dom?: QTIElement;

	/** Player configuration */
	config: PlayerConfig;
}

/**
 * Context provided during rendering lifecycle hooks
 * Extends PluginContext with Player instance access
 */
export interface RenderContext extends PluginContext {
	/** Player instance (available during render hooks) */
	player: Player;

	/**
	 * Rendering context (minimal and stable).
	 * Note: rendering is via web components; this config is primarily for lifecycle hooks.
	 */
	config: {
		role: QTIRole;
		options?: Record<string, any>;
	};
}
