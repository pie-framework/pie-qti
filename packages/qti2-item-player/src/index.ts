/**
 * @pie-qti/qti2-item-player
 * Modern QTI 2.2 player - Framework-agnostic with web components
 */


// Export web component registry for pluggable UI components
export {
	type ComponentConfig,
	type ComponentPlugin,
	ComponentRegistry,
	createComponentRegistry,
} from './core/ComponentRegistry.js';
export * from './core/constants.js';
export * from './core/declarations.js';
// Export ItemRenderer for framework-agnostic rendering
export {
	createItemRenderer,
	ItemRenderer,
	type ItemRendererConfig,
} from './core/ItemRenderer.js';
export { Player } from './core/Player.js';
// Plugin system (new extraction-based plugins)
export {
	type PluginContext,
	type PluginLifecycle,
	type QTIPlugin,
	type RenderContext,
} from './core/Plugin.js';
export { PluginManager } from './core/PluginManager.js';
// Export extraction system (PUBLIC API)
export type {
	ElementExtractor,
	ExtractionContext,
	ExtractionResult,
	ExtractionUtils,
	ValidationResult,
	VariableDeclaration,
} from './extraction/index.js';
export {
	createExtractionContext,
	createExtractionRegistry,
	createExtractionUtils,
	ExtractionError,
	ExtractionRegistry,
	isErrorResult,
	isSuccessResult,
} from './extraction/index.js';
// NOTE:
// The player’s primary rendering contract is via web components (`ComponentRegistry` + `ItemRenderer`).
// If you need non-web-component rendering, build it externally against the public extraction APIs.
// Export all types including adaptive item types
export * from './types/index.js';
// Export utilities
export {
	globalPerformanceMonitor,
	type PerformanceEntry,
	PerformanceMonitor,
	type PerformanceMonitorConfig,
	type PerformanceReport,
} from './utils/PerformanceMonitor.js';

export { isResponseEmpty } from './utils/responseUtils.js';

/**
 * NOTE (SSR safety):
 * Web component base classes depend on DOM globals like `HTMLElement` and must not be
 * re-exported from the main entrypoint, otherwise server-side imports of `{ Player }`
 * will crash under SSR/Node.
 *
 * Import web-components from the subpath entry instead:
 * - `@pie-qti/qti2-item-player/web-components`
 */
