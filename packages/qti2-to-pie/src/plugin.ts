/**
 * QTI 2.2 to PIE Plugin
 *
 * Transforms QTI 2.2 assessment items to PIE format
 */

import type {
  TransformContext,
  TransformInput,
  TransformOutput,
  TransformPlugin,
  ValidationResult,
} from '@pie-qti/transform-types';
import { parse } from 'node-html-parser';
import { transformAssessmentTest } from './transformers/assessment-test.js';
import { transformAssociateToCategorize } from './transformers/associate-to-categorize.js';
import { transformDragInTheBlank } from './transformers/drag-in-the-blank.js';
import { transformEbsr } from './transformers/ebsr.js';
import { transformExplicitConstructedResponse } from './transformers/explicit-constructed-response.js';
import { transformExtendedResponse } from './transformers/extended-response.js';
import { transformHotspot } from './transformers/hotspot.js';
import { transformImageClozeAssociation } from './transformers/image-cloze-association.js';
import { transformInlineDropdown } from './transformers/inline-dropdown.js';
import { transformMatch } from './transformers/match.js';
import { transformMatchList } from './transformers/match-list.js';
import { transformMultipleChoice } from './transformers/multiple-choice.js';
import { transformPassage } from './transformers/passage.js';
import { transformPlacementOrdering } from './transformers/placement-ordering.js';
import { transformSelectText } from './transformers/select-text.js';
import type {
  AssetResolver,
  CssClassExtractor,
  MetadataExtractor,
  VendorDetector,
  VendorExtensionHooks,
  VendorInfo,
  VendorTransformer,
} from './types/vendor-extensions.js';
import { extractSearchMetadata } from './utils/metadata-extraction.js';
import { extractPieExtension, hasPieExtension } from './utils/pie-extension.js';
import { embedQtiSourceInPie } from './utils/qti-extension-embedder.js';
import { validateQti } from './utils/qti-validator.js';

export class Qti22ToPiePlugin implements TransformPlugin {
  readonly id = 'qti22-to-pie';
  readonly version = '1.0.0';
  readonly name = 'QTI 2.2 to PIE';
  readonly sourceFormat = 'qti22' as const;
  readonly targetFormat = 'pie' as const;

  /**
   * Registered vendor extensions for customization
   */
  private vendorExtensions: VendorExtensionHooks = {
    detectors: [],
    transformers: [],
    assetResolvers: [],
    cssClassExtractors: [],
    metadataExtractors: [],
  };

  async canHandle(input: TransformInput): Promise<boolean> {
    if (typeof input.content !== 'string') {
      return false;
    }

    const content = input.content.trim();

    // Check for QTI 2.2 XML signatures
    return (
      (content.includes('assessmentItem') ||
       content.includes('assessmentPassage') ||
       content.includes('assessmentStimulus')) &&
      (content.includes('imsqti_v2p2') ||
       content.includes('http://www.imsglobal.org/xsd/imsqti_v2p2') ||
       // Also accept without namespace for flexibility
       content.includes('<assessmentItem') ||
       content.includes('<assessmentPassage') ||
       content.includes('<assessmentStimulus'))
    );
  }

  /**
   * Register a vendor detector
   * Detectors identify vendor-specific QTI content patterns
   */
  registerVendorDetector(detector: VendorDetector): void {
    this.vendorExtensions.detectors.push(detector);
  }

  /**
   * Register a vendor transformer
   * Transformers provide custom transformation logic for vendor QTI
   */
  registerVendorTransformer(transformer: VendorTransformer): void {
    this.vendorExtensions.transformers.push(transformer);
  }

  /**
   * Register an asset resolver
   * Resolvers load external assets referenced in QTI content
   */
  registerAssetResolver(resolver: AssetResolver): void {
    this.vendorExtensions.assetResolvers.push(resolver);
  }

  /**
   * Register a CSS class extractor
   * Extractors parse and categorize vendor-specific CSS classes
   */
  registerCssClassExtractor(extractor: CssClassExtractor): void {
    this.vendorExtensions.cssClassExtractors.push(extractor);
  }

  /**
   * Register a metadata extractor
   * Extractors parse vendor-specific metadata from QTI content
   */
  registerMetadataExtractor(extractor: MetadataExtractor): void {
    this.vendorExtensions.metadataExtractors.push(extractor);
  }

  async transform(input: TransformInput, context: TransformContext): Promise<TransformOutput> {
    const startTime = Date.now();
    const logger = context.logger;

    logger?.info('Starting QTI 2.2 to PIE transformation');

    const qtiXml = typeof input.content === 'string' ? input.content : JSON.stringify(input.content);

    // Check for PIE extension first for lossless round-trip
    if (hasPieExtension(qtiXml)) {
      logger?.info('Detected PIE extension - using lossless extraction');
      return this.extractFromPieExtension(qtiXml, startTime, logger);
    }

    // Parse XML once for all detection and transformation
    const doc = parse(qtiXml, {
      lowerCaseTagName: false,
      comment: false,
    });

    // Check for vendor-specific QTI and use vendor transformer if available
    const vendorInfo = this.detectVendor(qtiXml, doc);
    if (vendorInfo) {
      logger?.info(`Detected vendor: ${vendorInfo.vendor} (confidence: ${vendorInfo.confidence})`);

      // Try to find a vendor transformer that can handle this content
      const vendorTransformer = this.vendorExtensions.transformers.find(
        t => t.vendor === vendorInfo.vendor && t.canHandle(qtiXml, vendorInfo, doc)
      );

      if (vendorTransformer) {
        logger?.info(`Using vendor transformer for: ${vendorInfo.vendor}`);
        try {
          return await vendorTransformer.transform(qtiXml, vendorInfo, context, doc);
        } catch (error) {
          logger?.warn(
            `Vendor transformer failed for ${vendorInfo.vendor}: ${(error as Error).message}. ` +
            'Falling back to standard transformation.'
          );
          // Fall through to standard transformation
        }
      }
    }

    // Detect item type and use appropriate transformer
    const interactionType = this.detectInteractionType(qtiXml);
    const itemId = this.extractItemId(qtiXml);

    // Get assessmentItem element (already parsed above)
    const assessmentItem = doc.querySelector('assessmentItem') || doc.getElementsByTagName('assessmentItem')[0];

    // Extract baseId for round-trip compatibility
    const baseId = this.extractBaseId(assessmentItem);

    logger?.debug(`Processing item: ${itemId} (type: ${interactionType})${baseId ? ` [baseId: ${baseId}]` : ''}`);

    let pieItem;

    try {
      switch (interactionType) {
        case 'choiceInteraction':
          if (!assessmentItem) throw new Error('No assessmentItem found');
          pieItem = await transformMultipleChoice(assessmentItem, itemId, { baseId });
          break;

        case 'extendedTextInteraction':
          if (!assessmentItem) throw new Error('No assessmentItem found');
          pieItem = await transformExtendedResponse(assessmentItem, itemId, { baseId });
          break;

        case 'orderInteraction':
          pieItem = transformPlacementOrdering(qtiXml, itemId);
          break;

        case 'matchInteraction':
          // Check if it's a match-list or match (pairs)
          if (this.isMatchList(qtiXml)) {
            pieItem = transformMatchList(qtiXml, itemId);
          } else {
            pieItem = transformMatch(qtiXml, itemId);
          }
          break;

        case 'textEntryInteraction':
          pieItem = transformExplicitConstructedResponse(qtiXml, itemId);
          break;

        case 'selectPointInteraction':
        case 'hottextInteraction':
          pieItem = transformSelectText(qtiXml, itemId);
          break;

        case 'inlineChoiceInteraction':
          pieItem = transformInlineDropdown(qtiXml, itemId);
          break;

        case 'gapMatchInteraction':
          pieItem = transformDragInTheBlank(qtiXml, itemId);
          break;

        case 'ebsr':
          pieItem = transformEbsr(qtiXml, itemId);
          break;

        case 'hotspotInteraction':
          pieItem = transformHotspot(qtiXml, itemId);
          break;

        case 'graphicGapMatchInteraction':
          pieItem = transformImageClozeAssociation(qtiXml, itemId);
          break;

        case 'passage':
          pieItem = transformPassage(qtiXml, itemId);
          break;

        case 'associateInteraction':
          logger?.warn(
            `Transforming associateInteraction to categorize (experimental). ` +
            `Original any-to-any pairing semantics may not be fully preserved. ` +
            `Item: ${itemId}`
          );
          pieItem = transformAssociateToCategorize(qtiXml, itemId);
          break;

        case 'assessmentTest': {
          logger?.info(`Transforming assessmentTest: ${itemId}`);
          const assessment = transformAssessmentTest(qtiXml, itemId, {
            includeTimeLimits: true,
            includeBranchRules: true,
            includeItemControls: true,
          });

          const processingTimeTest = Date.now() - startTime;
          logger?.info(`Assessment transformation complete in ${processingTimeTest}ms`);

          return {
            items: [{ content: assessment, format: 'pie' as const }], // Return assessment wrapped
            format: 'pie',
            metadata: {
              sourceFormat: 'qti22',
              targetFormat: 'pie',
              pluginId: this.id,
              timestamp: new Date(),
              itemCount: assessment.sections.reduce((sum, s) => sum + s.itemRefs.length, 0),
              processingTime: processingTimeTest,
            },
          };
        }

        default:
          logger?.warn(`Unsupported interaction type: ${interactionType} for item ${itemId}`);
          throw new Error(`Unsupported interaction type: ${interactionType}`);
      }

      const processingTime = Date.now() - startTime;
      logger?.info(`Transformation complete in ${processingTime}ms (type: ${interactionType})`);

      // Extract searchMetaData from QTI
      const extractedSearchMetadata = extractSearchMetadata(doc);
      if (Object.keys(extractedSearchMetadata).length > 0) {
        logger?.info(`Extracted searchMetaData with ${Object.keys(extractedSearchMetadata).length} fields`);
        // Add to top-level searchMetaData property
        pieItem.searchMetaData = {
          ...extractedSearchMetadata,
          // Preserve any transformer-generated metadata
          ...(pieItem.metadata?.searchMetaData || {}),
        };
      }

      // Embed original QTI XML for lossless round-trip
      const pieItemWithSource = embedQtiSourceInPie(pieItem, qtiXml, {
        generator: {
          package: '@pie-qti/qti2-to-pie',
          version: this.version,
        },
        timestamp: new Date(),
        qtiVersion: '2.2',
      });

      return {
        items: [{ content: pieItemWithSource, format: 'pie' as const }],
        format: 'pie',
        metadata: {
          sourceFormat: 'qti22',
          targetFormat: 'pie',
          pluginId: this.id,
          timestamp: new Date(),
          itemCount: 1,
          processingTime,
        },
      };
    } catch (error) {
      logger?.error(`Transformation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Detect the type of QTI interaction
   */
  private detectInteractionType(qtiXml: string): string {
    // Check for assessmentTest (test definition)
    if (qtiXml.includes('<assessmentTest')) {
      return 'assessmentTest';
    }

    // Check for passage/stimulus ONLY as standalone top-level elements
    // NOTE: <stimulus> within itemBody is inline content, not a standalone passage
    if (qtiXml.includes('<assessmentPassage') || qtiXml.includes('<assessmentStimulus')) {
      return 'passage';
    }

    // Check for EBSR pattern (two choiceInteractions with specific structure)
    if (this.isEbsr(qtiXml)) {
      return 'ebsr';
    }

    // Check for specific interactions
    const interactions = [
      'choiceInteraction',
      'extendedTextInteraction',
      'orderInteraction',
      'matchInteraction',
      'textEntryInteraction',
      'selectPointInteraction',
      'hottextInteraction',
      'inlineChoiceInteraction',
      'gapMatchInteraction',
      'hotspotInteraction',
      'graphicGapMatchInteraction',
      'associateInteraction',
    ];

    for (const interaction of interactions) {
      if (qtiXml.includes(`<${interaction}`)) {
        return interaction;
      }
    }

    return 'unknown';
  }

  /**
   * Check if QTI XML is EBSR (Evidence-Based Selected Response)
   */
  private isEbsr(qtiXml: string): boolean {
    // EBSR has two choiceInteraction elements
    const matches = qtiXml.match(/<choiceInteraction/g);
    return matches ? matches.length === 2 : false;
  }

  /**
   * Check if matchInteraction is a match-list (has two simpleMatchSet)
   */
  private isMatchList(qtiXml: string): boolean {
    const matches = qtiXml.match(/<simpleMatchSet/g);
    return matches ? matches.length >= 2 : false;
  }

  /**
   * Extract item ID from QTI XML
   */
  private extractItemId(qtiXml: string): string {
    // Try to extract identifier attribute
    const match = qtiXml.match(/identifier=["']([^"']+)["']/);
    return match ? match[1] : `item-${Date.now()}`;
  }

  /**
   * Extract baseId from QTI metadata
   *
   * Looks for baseId/externalId in qti-metadata section
   * Supports round-trip compatibility with pie-to-qti2
   */
  private extractBaseId(itemElement: any): string | undefined {
    if (!itemElement) return undefined;

    // Look for qti-metadata section
    const qtiMetadata = itemElement.querySelector?.('qti-metadata') ||
                       itemElement.getElementsByTagName?.('qti-metadata')?.[0];

    if (!qtiMetadata) return undefined;

    // Look for metadata fields
    const metadataFields = qtiMetadata.getElementsByTagName('qti-metadata-field');

    for (const field of Array.from(metadataFields)) {
      const name = (field as any).getAttribute('name');
      const value = (field as any).getAttribute('value');

      // Check for externalId (pie-to-qti2 convention)
      if (name === 'externalId' && value) {
        // Verify this came from PIE by checking sourceSystemId
        const sourceField = Array.from(metadataFields).find(
          (f: any) => f.getAttribute('name') === 'sourceSystemId'
        );

        if ((sourceField as any)?.getAttribute('value') === 'pie') {
          return value;
        }
      }

      // Check for explicit baseId field
      if (name === 'baseId' && value) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Validate QTI XML against official XSD schemas (optional)
   */
  async validate(output: TransformOutput): Promise<ValidationResult> {
    // Basic validation - check that items were transformed
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output.items || output.items.length === 0) {
      errors.push('No items were transformed');
    }

    // Check for transformation warnings/errors
    if (output.warnings && output.warnings.length > 0) {
      warnings.push(...output.warnings.map(w => w.message));
    }

    if (output.errors && output.errors.length > 0) {
      errors.push(...output.errors.map(e => e.message));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate QTI XML input (before transformation)
   */
  async validateInput(xml: string): Promise<ValidationResult> {
    const result = await validateQti(xml);

    // Convert to TransformPlugin ValidationResult format
    return {
      valid: result.valid,
      errors: result.errors.map(e => e.message),
      warnings: result.warnings.map(w => w.message),
    };
  }

  /**
   * Extract PIE item from QTI XML with PIE extension for lossless round-trip
   */
  private extractFromPieExtension(
    qtiXml: string,
    startTime: number,
    logger?: any
  ): TransformOutput {
    const extensionData = extractPieExtension(qtiXml);

    if (!extensionData.hasExtension || !extensionData.sourceModel) {
      throw new Error('PIE extension detected but failed to extract source model');
    }

    const processingTime = Date.now() - startTime;
    logger?.info(`Lossless extraction complete in ${processingTime}ms`);

    // Determine if this is an assessment or single item
    const isAssessment = extensionData.sourceModel.sections !== undefined;

    return {
      items: [{ content: extensionData.sourceModel, format: 'pie' as const }],
      format: 'pie',
      metadata: {
        sourceFormat: 'qti22' as const,
        targetFormat: 'pie' as const,
        pluginId: this.id,
        timestamp: new Date(),
        itemCount: isAssessment
          ? extensionData.sourceModel.sections.reduce((sum: number, s: any) => sum + s.itemRefs.length, 0)
          : 1,
        processingTime,
        losslessRoundTrip: true,
        ...(extensionData.metadata && {
          pieExtension: extensionData.metadata,
        }),
      } as any, // Extended metadata with custom properties
    };
  }

  /**
   * Detect vendor-specific QTI using registered vendor detectors
   * Returns the vendor with highest confidence score
   */
  private detectVendor(qtiXml: string, parsedDoc: any): VendorInfo | null {
    if (this.vendorExtensions.detectors.length === 0) {
      return null;
    }

    let bestMatch: VendorInfo | null = null;
    let highestConfidence = 0;

    for (const detector of this.vendorExtensions.detectors) {
      try {
        const vendorInfo = detector.detect(qtiXml, parsedDoc);
        if (vendorInfo && vendorInfo.confidence > highestConfidence) {
          highestConfidence = vendorInfo.confidence;
          bestMatch = vendorInfo;
        }
      } catch (error) {
        console.warn(`Vendor detector ${detector.name} failed:`, error);
      }
    }

    // Only return if confidence is reasonably high
    return bestMatch && bestMatch.confidence >= 0.6 ? bestMatch : null;
  }

  /**
   * Get registered asset resolvers for vendor packages to use
   */
  getAssetResolvers(): AssetResolver[] {
    return [...this.vendorExtensions.assetResolvers];
  }

  /**
   * Get registered CSS class extractors for vendor packages to use
   */
  getCssClassExtractors(): CssClassExtractor[] {
    return [...this.vendorExtensions.cssClassExtractors];
  }

  /**
   * Get registered metadata extractors for vendor packages to use
   */
  getMetadataExtractors(): MetadataExtractor[] {
    return [...this.vendorExtensions.metadataExtractors];
  }
}
