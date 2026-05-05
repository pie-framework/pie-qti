/**
 * @pie-qti/item-player
 * Modern QTI player (2.2/3.0) - Framework-agnostic with web components
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
// Export drawing utilities
export * from './utils/drawingUtils.js';
// Export ItemRenderer for framework-agnostic rendering
export {
	createItemRenderer,
	ItemRenderer,
	type ItemRendererConfig,
} from './core/ItemRenderer.js';
export { Player } from './core/Player.js';
export { getRoleCapabilities, type RoleCapabilities } from './core/rolePolicy.js';
// Plugin system (new extraction-based plugins)
export {
	type PluginContext,
	type PluginLifecycle,
	type QTIPlugin,
	type RenderContext,
} from './core/Plugin.js';
export { PluginManager } from './core/PluginManager.js';
// Export extraction system (PUBLIC API)
export * from './interactions/index.js';
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

// PNP profile (QTI 3.0 §6.2)
export type { PnpProfile } from './pnp/types.js';
export { applyPnpToRoot } from './pnp/applyPnp.js';
export { parsePnpXml } from './pnp/parsePnpXml.js';

// Catalog (QTI 3.0 §6.3)
export type { CatalogIndex, CatalogCard, CatalogEntry } from './catalog/types.js';
export { extractCatalog, extractCatalogFromItemXml, mergeCatalogs } from './catalog/catalogExtractor.js';
export { getCatalogEntry } from './catalog/catalogLookup.js';

// PCI — Portable Custom Interaction (QTI 3.0 §6.1)
export type { PciModule, PciBoundTo, ExtractedPci } from './pci/types.js';
export { PciLoadError } from './pci/types.js';
export { PciHost } from './pci/PciHost.js';

// Re-export QTI heuristics from @pie-qti/ims-cp-core for convenience
// (heuristics are now in the shared ingestion layer)
export {
	normalizeHeuristicsConfig,
	applyFeedbackTextHeuristics,
	shouldUseLenientImagePaths,
	shouldAutoPopulateFeedbackOutcome,
	DEFAULT_HEURISTICS_CONFIG,
	STRICT_QTI_CONFIG,
	FEEDBACK_TEXT_TRANSFORMS,
	type QtiHeuristicsConfig,
	type TextTransform,
} from '@pie-qti/ims-cp-core';

/**
 * NOTE (SSR safety):
 * Web component base classes depend on DOM globals like `HTMLElement` and must not be
 * re-exported from the main entrypoint, otherwise server-side imports of `{ Player }`
 * will crash under SSR/Node.
 *
 * Import web-components from the subpath entry instead:
 * - `@pie-qti/item-player/web-components`
 */
