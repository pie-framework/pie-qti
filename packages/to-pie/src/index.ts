/**
 * @pie-qti/to-pie
 *
 * QTI 2.2 to PIE transformation plugin
 */

export {
	QtiItemTransformError,
	QtiSourceProfileTransformError,
	QtiToPiePlugin,
	QtiUnsupportedItemError,
} from './plugin.js';
export type { QtiToPiePluginOptions } from './plugin.js';
export { transformAnalyzedQtiPackageToPie, transformQtiPackageToPie } from './package-transformer.js';
export type {
  QtiAnalyzedPackageTransformInput,
  QtiPackageItemTransformResult,
  QtiPackageTransformInput,
  QtiPackageTransformResult,
} from './package-transformer.js';
export type {
  ExplodedQtiPackageItems,
  ExplodeQtiPackageItemsInput,
  QtiPackageItemSource,
  QtiPackagePassageSource,
} from './package-exploder.js';
export { explodeAnalyzedQtiPackageItems, explodeQtiPackageItems } from './package-exploder.js';
export type {
  ConvertedQtiPassage,
  ConvertedQtiPassageConfig,
  ConvertQtiPassageDocumentInput,
  ConvertQtiPassageResult,
} from './passage-converter.js';
export { convertQtiPassageDocument } from './passage-converter.js';
export {
  addTraceEvent,
  applyItemDecorators,
  createConversionTrace,
  detectItemProfiles,
  detectPackageProfiles,
  runItemHandlers,
} from './source-profile-runtime.js';
export type {
  ItemDecoratorPhase,
  ProfileRuntimeResult,
  RunItemHandlersInput,
} from './source-profile-runtime.js';
export {
  createDefaultQtiToPieRegistry,
  QtiToPieRegistry,
} from './registry/qti-to-pie-registry.js';
export type {
  BuiltInTransformContext,
  BuiltInTransformDelegate,
  BuiltInTransformKind,
  BuiltInTransformResult,
  QtiBuiltInTransformHandler,
} from './registry/qti-to-pie-registry.js';
export type {
  AssessmentSection,
  AssessmentTestOptions,
  ContextDeclaration,
  ItemReference,
  PieAssessment,
  RubricBlock,
  RubricBlockView,
  TestPart,
} from './transformers/assessment-test.js';
export { transformAssessmentTest } from './transformers/assessment-test.js';
export type { DragInTheBlankOptions } from './transformers/drag-in-the-blank.js';
export { transformDragInTheBlank } from './transformers/drag-in-the-blank.js';
export type { EbsrOptions } from './transformers/ebsr.js';
export { transformEbsr, transformEbsrInteractions } from './transformers/ebsr.js';
export type { ExplicitConstructedResponseOptions } from './transformers/explicit-constructed-response.js';
export {
  transformExplicitConstructedResponse,
  transformExplicitConstructedResponseInteractions,
} from './transformers/explicit-constructed-response.js';
export type { ExtendedResponseOptions } from './transformers/extended-response.js';
export { transformExtendedResponse } from './transformers/extended-response.js';
export type { HotspotOptions } from './transformers/hotspot.js';
export { transformHotspot } from './transformers/hotspot.js';
export type { ImageClozeAssociationOptions } from './transformers/image-cloze-association.js';
export { transformImageClozeAssociation } from './transformers/image-cloze-association.js';
export type { InlineDropdownOptions } from './transformers/inline-dropdown.js';
export {
  transformInlineDropdown,
  transformInlineDropdownInteractions,
} from './transformers/inline-dropdown.js';
export type { MatchOptions } from './transformers/match.js';
export { transformMatch } from './transformers/match.js';
export type { MatchListOptions } from './transformers/match-list.js';
export { transformMatchList } from './transformers/match-list.js';
export type { MultipleChoiceOptions } from './transformers/multiple-choice.js';
export {
  transformMultipleChoice,
  transformMultipleChoiceInteraction,
} from './transformers/multiple-choice.js';
export { transformNumberLine, transformNumberLineInteraction } from './transformers/number-line.js';
export type { PassageOptions } from './transformers/passage.js';
export { transformPassage } from './transformers/passage.js';
export type { PlacementOrderingOptions } from './transformers/placement-ordering.js';
export {
  transformPlacementOrdering,
  transformPlacementOrderingInteraction,
} from './transformers/placement-ordering.js';
export type { SelectPointTransformContext } from './transformers/select-point.js';
export {
  transformChartingSelectPoint,
  transformGraphingSelectPoint,
  transformNumberLineSelectPoint,
  unmappedSelectPointParams,
} from './transformers/select-point.js';
export type { SelectTextOptions } from './transformers/select-text.js';
export { transformSelectText } from './transformers/select-text.js';
// Vendor extension system for customization
export type {
  AssetResolver,
  CssClassExtractor,
  CustomAttributes,
  MetadataExtractor,
  ResolvedAsset,
  VendorClasses,
  VendorDetector,
  VendorExtensionHooks,
  VendorInfo,
  VendorTransformer,
} from './types/vendor-extensions.js';
// QTI and APIP accessibility catalogs, in the card shape PIE players resolve
export type {
  AccessibilityCatalog,
  ApipAccessElement,
  ApipContentLink,
  CatalogCard,
  CatalogCardPayload,
  CompanionMaterialsNode,
  MediaAssetRef,
  MediaFragmentRange,
  MediaKind,
  MediaSource,
  QtiAccessibility,
} from './utils/accessibility-catalogs.js';
export {
  prepareQtiAccessibility,
  readApipAccessElements,
  readQtiCatalogs,
  withQtiAccessibility,
} from './utils/accessibility-catalogs.js';
export type { TextRange } from './utils/accessibility-markup.js';
export type { QtiPackagePassage, QtiPassageItemLink } from './utils/passage-links.js';
export {
  PASSAGE_DEPENDENCY_UNREFERENCED,
  transformedItemSourceIdentifier,
} from './utils/passage-links.js';
// Standard metadata extractor (default implementation)
export { StandardMetadataExtractor, createStandardMetadataExtractor } from './extractors/standard-metadata-extractor.js';
// PIE extension utilities for lossless round-trip
export type { PieExtensionData, PieExtensionMetadata } from './utils/pie-extension.js';
export { extractDataAttributes, extractPieExtension, hasPieExtension, PIE_NAMESPACE, PIE_PREFIX } from './utils/pie-extension.js';
// PIE config element/markup naming, shared by the conversion and the preview
export {
  escapePieAttribute,
  isPieModelOfPackage,
  pieElementTagForModel,
  piePackageName,
  piePlaceholderMarkup,
} from './utils/pie-markup.js';
// QTI extension utilities for lossless round-trip
export type { QtiExtensionMetadata } from './utils/qti-extension-embedder.js';
export { embedQtiSourceInPie, extractQtiSourceFromPie, hasQtiSource, QTI_NAMESPACE, QTI_PREFIX } from './utils/qti-extension-embedder.js';
export type {
  QtiSchemaVersion,
  ValidationError,
  ValidationResult as QtiValidationResult,
  ValidationWarning,
  ValidatorOptions,
} from './utils/qti-validator.js';
// Validation utilities
export {
  detectQtiSchemaVersion,
  isAssessmentTestDocument,
  QtiValidator,
  qtiDocumentRootName,
  validateQti,
  validateQtiBatch,
} from './utils/qti-validator.js';
// QTI 3.0 normalization into the QTI 2.2 vocabulary the conversion reads
export type { UnsupportedQti3Construct } from './utils/qti3-normalize.js';
export {
  demoteMisplacedQti3Prompts,
  isQti3Document,
  normalizeQti3Lexically,
  normalizeQti3ToQti2,
  relocateQti3PromptIntoInteraction,
  unsupportedQti3Construct,
} from './utils/qti3-normalize.js';
// CDATA unwrapping for markup bound for PIE models
export { unwrapCdataSections } from './utils/cdata.js';
// Composite-item planning: groups an itemBody's interactions into transformable units
export type {
  PieElementConversion,
  PieItemCompositionPlan,
  PlannedQtiInteractionUnit,
  QtiInteractionUnitKind,
  QtiItemBodyPlan,
  QtiItemInteractionType,
} from './utils/qti-item-planner.js';
export {
  elementTagName,
  isQtiInteractionElement,
  planQtiItemBody,
  QTI_ITEM_INTERACTION_TYPES,
} from './utils/qti-item-planner.js';
// Markup serialization with interaction placeholders, used by composite and multi-blank items
export type { SerializeHtmlOptions } from './utils/markup-extraction.js';
export { elementIsOrContains, serializeChildrenWithReplacements } from './utils/markup-extraction.js';
// QTI <stylesheet> references carried into config.resources.stylesheets[]
export type { StylesheetResource } from './utils/stylesheet-extraction.js';
export { extractStylesheetResources, withStylesheetResources } from './utils/stylesheet-extraction.js';
// Renaissance selectPointInteraction vendor-class config (numberLine, chart, graph)
export type {
  SelectPointDescription,
  SelectPointParams,
  SelectPointVendorClass,
  TickInterval,
} from './utils/select-point-config.js';
export {
  describeSelectPointInteraction,
  parseTickInterval,
  readJsonCorrectResponses,
  readJsonParams,
  readSelectPointParams,
  SELECT_POINT_VENDOR_CLASSES,
  selectPointUnsupportedDetails,
} from './utils/select-point-config.js';
// Vendor helper utilities
export {
  applyBehavioralClasses,
  extractCssClasses,
  extractCustomAttributes,
  preserveVendorAttributes,
  preserveVendorClasses,
} from './utils/vendor-helpers.js';
export type {
  ExtractCssClassesWithHooksInput,
  ResolveAssetWithHooksInput,
  VendorCssClassExtraction,
} from './vendor-extension-runtime.js';
export {
  extractCssClassesWithHooks,
  resolveAssetWithHooks,
} from './vendor-extension-runtime.js';
