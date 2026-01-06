/**
 * @pie-qti/qti2-to-pie
 *
 * QTI 2.2 to PIE transformation plugin
 */

export { Qti22ToPiePlugin } from './plugin.js';
export type { AssessmentSection, AssessmentTestOptions, ItemReference, PieAssessment } from './transformers/assessment-test.js';
export { transformAssessmentTest } from './transformers/assessment-test.js';
export type { DragInTheBlankOptions } from './transformers/drag-in-the-blank.js';
export { transformDragInTheBlank } from './transformers/drag-in-the-blank.js';
export type { EbsrOptions } from './transformers/ebsr.js';
export { transformEbsr } from './transformers/ebsr.js';
export type { ExplicitConstructedResponseOptions } from './transformers/explicit-constructed-response.js';
export { transformExplicitConstructedResponse } from './transformers/explicit-constructed-response.js';
export type { ExtendedResponseOptions } from './transformers/extended-response.js';
export { transformExtendedResponse } from './transformers/extended-response.js';
export type { HotspotOptions } from './transformers/hotspot.js';
export { transformHotspot } from './transformers/hotspot.js';
export type { ImageClozeAssociationOptions } from './transformers/image-cloze-association.js';
export { transformImageClozeAssociation } from './transformers/image-cloze-association.js';
export type { InlineDropdownOptions } from './transformers/inline-dropdown.js';
export { transformInlineDropdown } from './transformers/inline-dropdown.js';
export type { MatchOptions } from './transformers/match.js';
export { transformMatch } from './transformers/match.js';
export type { MatchListOptions } from './transformers/match-list.js';
export { transformMatchList } from './transformers/match-list.js';
export type { MultipleChoiceOptions } from './transformers/multiple-choice.js';
export { transformMultipleChoice } from './transformers/multiple-choice.js';
export type { PassageOptions } from './transformers/passage.js';
export { transformPassage } from './transformers/passage.js';
export type { PlacementOrderingOptions } from './transformers/placement-ordering.js';
export { transformPlacementOrdering } from './transformers/placement-ordering.js';
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
// PIE extension utilities for lossless round-trip
export type { PieExtensionData, PieExtensionMetadata } from './utils/pie-extension.js';
export { extractDataAttributes, extractPieExtension, hasPieExtension, PIE_NAMESPACE, PIE_PREFIX } from './utils/pie-extension.js';
// QTI extension utilities for lossless round-trip
export type { QtiExtensionMetadata } from './utils/qti-extension-embedder.js';
export { embedQtiSourceInPie, extractQtiSourceFromPie, hasQtiSource, QTI_NAMESPACE, QTI_PREFIX } from './utils/qti-extension-embedder.js';
export type { ValidationError, ValidationResult as QtiValidationResult, ValidationWarning, ValidatorOptions } from './utils/qti-validator.js';
// Validation utilities
export { QtiValidator, validateQti } from './utils/qti-validator.js';
// Vendor helper utilities
export {
  applyBehavioralClasses,
  extractCssClasses,
  extractCustomAttributes,
  preserveVendorAttributes,
  preserveVendorClasses,
} from './utils/vendor-helpers.js';
