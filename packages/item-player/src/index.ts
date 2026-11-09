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
	DEFAULT_COMPONENT_TAGS_BY_TYPE,
} from './core/ComponentRegistry.js';
// Export drawing utilities
export * from './utils/drawingUtils.js';
export {
	createAssessmentItemDefinition,
	type AssessmentItemDefinition,
	type AssessmentItemDefinitionConfig,
	type AssessmentItemDefinitionPlugin,
} from './core/AssessmentItemDefinition.js';
export {
	QtiComplianceError,
	type QtiItemDiagnostic,
	type QtiItemDiagnosticCode,
	type QtiItemDiagnosticSeverity,
} from './core/compliance.js';
export { UnsupportedResponseProcessingTemplateError } from './core/responseProcessingTemplates.js';
export {
	type ItemPresentationView,
	type ItemSession,
	type ItemSessionCommand,
	type ItemSessionEventCommand,
	type ItemSessionListener,
	type ItemSessionPresentationPolicy,
	type ItemSessionTransition,
	type ItemSessionView,
	type OpenItemSessionOptions,
} from './core/ItemSession.js';
export type {
	FinalItemBodyHtml,
	InlineInteractionPosition,
	ItemInteractionMount,
	ItemPresentation,
	ItemPresentationFlowNode,
} from './presentation/itemPresentationPlan.js';
export type { ShownFeedback } from './presentation/feedbackAnnouncement.js';
/** The attribute on the empty slot that marks an interaction's authored position in the body. */
export { INTERACTION_SLOT_ATTRIBUTE } from './presentation/itemPresentationPlan.js';
export { getRoleCapabilities, type RoleCapabilities } from './core/rolePolicy.js';
// The pure matchGroup pairing rule shared by response validation and the renderers,
// so the delivered UI can never allow a pair validation rejects nor block one it accepts.
export { isMatchGroupCompatible, type MatchGroupChoice } from './core/matchGroups.js';
// The pure order-subset rule (minChoices/maxChoices) shared by response validation and the
// order renderers, for the same reason (QTI 2.2 ASI §5.73, §5.42).
export {
	orderChoiceLimits,
	type OrderChoiceLimits,
	type OrderSubsetInteraction,
} from './interactions/order/limits.js';
// Render-facing interaction contracts. Standard extractors remain implementation details.
export type * from './interactions/shared/types.js';
export {
	createExtendedTextNumericRecord,
	createExtendedTextResponse,
	createExtendedTextStringResponse,
	extendedTextResponseToStrings,
	type ExtendedTextNumericRecord,
	type ExtendedTextRecordField,
} from './interactions/extended-text/response.js';
export type {
	ElementExtractor,
	ExtractionContext,
	ExtractionDispatchResult,
	ExtractionResult,
	ExtractionUtils,
	InteractionDeliveryField,
	InteractionDeliveryPathSegment,
	InteractionDeliverySchema,
	ValidationResult,
	ExtractionVariableDeclaration,
} from './extraction/index.js';
export {
	createExtractionContext,
	createExtractionRegistry,
	createExtractionUtils,
	ExtractionError,
	ExtractionRegistry,
	htmlField,
	urlField,
} from './extraction/index.js';
// NOTE:
// The player’s primary rendering contract is via web components and the Svelte component entrypoint.
// If you need non-web-component rendering, build it externally against the public extraction APIs.
// Export all types including adaptive item types
export * from './types/index.js';
// PNP profile (AfA PNP 3.0, QTI 3's per-candidate profile)
export type { PnpProfile, PnpTextAppearance, PnpToolSupports } from './pnp/types.js';
export {
	applyPnpToRoot,
	applyPnpToSurface,
	clearPnpSurface,
	isWithinPnpSurface,
	PNP_SURFACE_ATTRIBUTE,
} from './pnp/applyPnp.js';
export type { AfaPnpRecord } from './pnp/parsePnpXml.js';
export { AFA_PNP_NAMESPACE, parseAfaPnpXml, parsePnpXml, pnpProfileFromAfa } from './pnp/parsePnpXml.js';

// Catalog (QTI 3.0 §6.3)
export type { CatalogIndex, CatalogCard, CatalogEntry } from './catalog/types.js';
export { extractCatalog, extractCatalogFromItemXml, mergeCatalogs } from './catalog/catalogExtractor.js';
export { getCatalogEntry } from './catalog/catalogLookup.js';
export type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';

// PCI — Portable Custom Interaction (QTI 3.0 §6.1)
export type {
	ExtractedPci,
	PciConfiguration,
	PciCustomInteractionContext,
	PciHostController,
	PciHostOptions,
	PciInteractionStatus,
	PciModuleEntry,
	PciModulePathKind,
	PciModuleResolutionContext,
	PciModuleResolver,
	PciRegistryObservation,
	PciResponseDeclarationInfo,
	QtiCustomInteractionRegistration,
	QtiPciConfiguration,
	QtiPciInstance,
} from './pci/types.js';
export { PciLoadError, PciModuleResolverRequiredError } from './pci/types.js';
export { PciHost } from './pci/PciHost.js';
export {
	createAllowlistPciModuleResolver,
	PciModuleNotAllowedError,
} from './pci/allowlistResolver.js';
export type { AllowlistPciResolverOptions } from './pci/allowlistResolver.js';
export { installPciRegistry, getSharedPciRegistry, PCI_REGISTRY_GLOBAL } from './pci/registry.js';
export { createAmdLoader } from './pci/amdLoader.js';
export type { AmdLoader, AmdLoaderOptions } from './pci/amdLoader.js';
export {
	DEFAULT_RESOLUTION_CONFIG_PATHS,
	emptyResolutionConfig,
	parseModuleResolutionConfig,
} from './pci/resolutionConfig.js';
export type { PciResolutionConfig, PciResolutionShim } from './pci/resolutionConfig.js';
export { toQtiVariableJson, fromQtiVariableJson } from './pci/qtiVariableJson.js';
export type { QtiRecordField } from './pci/qtiVariableJson.js';

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
 * re-exported from the main entrypoint. Item ownership flows through
 * AssessmentItemDefinition and ItemSession in every deployment.
 *
 * Import web-components from the subpath entry instead:
 * - `@pie-qti/item-player/web-components`
 */
