/**
 * QTI 2.2 to PIE Plugin
 *
 * Transforms QTI 2.2 assessment items to PIE format
 */

import type {
  ConversionTrace,
  QtiSourceProfile,
  SourceProfileExtractionResult,
  TransformContext,
  TransformInput,
  TransformOutput,
  TransformPlugin,
  TransformWarning,
  ValidationResult,
  VendorExtensionConfig,
} from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';
import { parse } from 'node-html-parser';
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
import { createStandardMetadataExtractor } from './extractors/standard-metadata-extractor.js';
import { extractCssClassesWithHooks } from './vendor-extension-runtime.js';
import {
  addTraceEvent,
  applyItemDecorators,
  createConversionTrace,
  detectItemProfiles,
  type ProfileRuntimeResult,
} from './source-profile-runtime.js';
import {
  createDefaultQtiToPieRegistry,
  type QtiToPieRegistry,
} from './registry/qti-to-pie-registry.js';

/**
 * Configuration options for the QtiToPiePlugin
 */
export interface QtiToPiePluginOptions {
  /**
   * Direct instance registration - vendor detectors to register
   */
  vendorDetectors?: VendorDetector[];

  /**
   * Direct instance registration - vendor transformers to register
   */
  vendorTransformers?: VendorTransformer[];

  /**
   * Direct instance registration - asset resolvers to register
   */
  assetResolvers?: AssetResolver[];

  /**
   * Direct instance registration - CSS class extractors to register
   */
  cssClassExtractors?: CssClassExtractor[];

  /**
   * Direct instance registration - metadata extractors to register
   */
  metadataExtractors?: MetadataExtractor[];

  /**
   * Source profiles are the preferred pre-1.0 extension model. They can detect
   * package/item features, emit traceable evidence, and contribute candidates
   * without taking over the generic QTI-to-PIE transform.
   */
  sourceProfiles?: QtiSourceProfile[];

  /**
   * Optional transform registry. Primarily useful for tests or hosts that need
   * to register alternate built-in handlers during pre-1.0 API development.
   */
  registry?: QtiToPieRegistry;

  /**
   * Config-based registration - vendor extensions configuration
   * Note: This is typically used by the config loader, not directly by users
   */
  vendorExtensions?: VendorExtensionConfig;
}

export class QtiToPiePlugin implements TransformPlugin {
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

  private sourceProfiles: QtiSourceProfile[] = [];

  private registry: QtiToPieRegistry;

  /**
   * Create a new QtiToPiePlugin instance
   *
   * @param options - Optional configuration for vendor extensions
   *
   * @example
   * // Create with no options (backward compatible)
   * const plugin = new QtiToPiePlugin();
   *
   * @example
   * // Create with direct instance registration
   * const plugin = new QtiToPiePlugin({
   *   vendorDetectors: [new MyVendorDetector()],
   *   vendorTransformers: [new MyVendorTransformer()],
   * });
   *
   * @example
   * // Create with config-based registration (used by config loader)
   * const plugin = new QtiToPiePlugin({
   *   vendorExtensions: {
   *     detectors: [{ module: '@acme/vendor-plugin', export: 'Detector' }],
   *   },
   * });
   */
  constructor(options: QtiToPiePluginOptions = {}) {
    this.registry = options.registry ?? createDefaultQtiToPieRegistry();

    // Register standard metadata extractor by default (can be overridden by vendors)
    this.registerMetadataExtractor(createStandardMetadataExtractor());

    // Register extensions provided directly as instances
    options.vendorDetectors?.forEach((detector) =>
      this.registerVendorDetector(detector)
    );
    options.vendorTransformers?.forEach((transformer) =>
      this.registerVendorTransformer(transformer)
    );
    options.assetResolvers?.forEach((resolver) =>
      this.registerAssetResolver(resolver)
    );
    options.cssClassExtractors?.forEach((extractor) =>
      this.registerCssClassExtractor(extractor)
    );
    options.metadataExtractors?.forEach((extractor) =>
      this.registerMetadataExtractor(extractor)
    );
    this.sourceProfiles = [...(options.sourceProfiles ?? [])];

    // Note: vendorExtensions config is handled by VendorExtensionRegistry
    // after plugin instantiation, not in the constructor
  }

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
    const qtiVersion = detectQtiVersion(qtiXml);
    const sourceFormat = qtiVersionToSourceFormat(qtiVersion);
    const warnings: TransformWarning[] = [];
    const itemId = this.extractItemId(qtiXml);
    const trace = createConversionTrace(`qti-to-pie-${itemId}-${startTime}`);
    addTraceEvent(trace, {
      kind: 'handler-selected',
      scope: 'item',
      itemId,
      message: 'Started QTI to PIE item transform.',
      data: { sourceFormat, qtiVersion },
    });

    // Check for PIE extension first for lossless round-trip
    if (hasPieExtension(qtiXml)) {
      logger?.info('Detected PIE extension - using lossless extraction');
      addTraceEvent(trace, {
        kind: 'handler-selected',
        scope: 'item',
        itemId,
        message: 'Detected embedded PIE extension; using lossless extraction.',
      });
      return this.extractFromPieExtension(qtiXml, startTime, logger, sourceFormat, trace, qtiVersion);
    }

    // Parse XML once for all detection and transformation
    const doc = parse(qtiXml, {
      lowerCaseTagName: false,
      comment: false,
    });

    const assessmentItem = doc.querySelector('assessmentItem') || doc.getElementsByTagName('assessmentItem')[0];
    const interactionAnalysis = assessmentItem ? analyzeAssessmentItemInteractions(assessmentItem) : null;
    const itemContext = {
      itemId,
      resourceId: (input.metadata?.resourceId as string | undefined) ?? itemId,
      sourcePath: input.metadata?.sourcePath as string | undefined,
      xml: qtiXml,
      qtiVersion,
      interactionTypes: interactionAnalysis?.standardTypes ?? [],
      responseProcessingXml: assessmentItem ? directChildXml(assessmentItem, 'responseProcessing') : undefined,
      package: input.metadata?.packageContext as any,
      metadata: input.metadata,
    };
    const profileRuntime = detectItemProfiles(
      this.sourceProfiles,
      itemContext,
      trace
    );
    warnings.push(...(profileRuntime.extraction.warnings ?? []));

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
          addTraceEvent(trace, {
            kind: 'handler-selected',
            scope: 'item',
            itemId,
            handlerId: `legacy-vendor-transformer:${vendorTransformer.vendor}`,
            message: `Using legacy vendor transformer for ${vendorTransformer.vendor}.`,
          });
          const output = await vendorTransformer.transform(qtiXml, vendorInfo, context, doc);
          return withTraceMetadata(output, trace, profileRuntime);
        } catch (error) {
          logger?.warn(
            `Vendor transformer failed for ${vendorInfo.vendor}: ${(error as Error).message}. ` +
            'Falling back to standard transformation.'
          );
          addTraceEvent(trace, {
            kind: 'fallback',
            scope: 'item',
            itemId,
            handlerId: `legacy-vendor-transformer:${vendorTransformer.vendor}`,
            message: `Legacy vendor transformer failed and generic fallback will be attempted: ${(error as Error).message}`,
          });
          // Fall through to standard transformation
        }
      }
    }

    // Detect item type and use appropriate transformer
    const interactionType = this.detectInteractionType(qtiXml, interactionAnalysis);

    if (interactionAnalysis) {
      validateInteractionShape(interactionAnalysis, itemId);
    }

    if (assessmentItem) {
      warnings.push(...createProcessingWarnings(assessmentItem, itemId));
    }

    // Extract baseId for round-trip compatibility
    const baseId = this.extractBaseId(assessmentItem);

    logger?.debug(`Processing item: ${itemId} (type: ${interactionType})${baseId ? ` [baseId: ${baseId}]` : ''}`);

    let pieItem;

    try {
      const builtInHandler = this.registry.getHandlerForInteraction(interactionType);
      if (!builtInHandler) {
        logger?.warn(`Unsupported interaction type: ${interactionType} for item ${itemId}`);
        throw new Error(`Unsupported interaction type: ${interactionType}`);
      }
      addTraceEvent(trace, {
        kind: 'handler-selected',
        scope: 'item',
        itemId,
        handlerId: builtInHandler.id,
        message: `Selected built-in QTI transform handler ${builtInHandler.id}.`,
      });
      const transformResult = await builtInHandler.transform({
        interactionType,
        qtiXml,
        itemId,
        assessmentItem,
        baseId,
        logger,
      });

      if (transformResult.kind === 'assessment') {
        const processingTimeTest = Date.now() - startTime;
        logger?.info(`Assessment transformation complete in ${processingTimeTest}ms`);
        return {
          items: [{ content: transformResult.content, format: 'pie' as const }], // Return assessment wrapped
          format: 'pie',
          metadata: {
            sourceFormat,
            targetFormat: 'pie',
            pluginId: this.id,
            timestamp: new Date(),
            itemCount: transformResult.itemCount ?? 0,
            processingTime: processingTimeTest,
            qtiVersion,
            ...metadataFromProfileRuntime(profileRuntime),
            conversionTrace: finalizeTrace(trace, profileRuntime),
          } as any,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }
      pieItem = transformResult.content;
      await applyItemDecorators(this.sourceProfiles, profileRuntime, itemContext, pieItem, 'afterModel', trace);

      const processingTime = Date.now() - startTime;
      logger?.info(`Transformation complete in ${processingTime}ms (type: ${interactionType})`);

      if (assessmentItem) {
        const processingMetadata = collectQtiProcessingMetadata(assessmentItem);
        if (processingMetadata) {
          pieItem.metadata = {
            ...(pieItem.metadata || {}),
            qtiProcessing: processingMetadata,
          };
        }
      }

      // Extract metadata using registered metadata extractors
      // Priority: vendor-specific extractor > standard extractor
      const metadataExtractor = this.vendorExtensions.metadataExtractors.find(
        extractor => extractor.vendor === vendorInfo?.vendor
      ) || this.vendorExtensions.metadataExtractors.find(
        extractor => extractor.vendor === 'standard'
      );

      if (metadataExtractor) {
        const extractedMetadata = metadataExtractor.extract(qtiXml, doc, vendorInfo || { vendor: 'standard', confidence: 1.0 });
        logger?.info(`Extracted metadata using ${metadataExtractor.vendor} extractor`);

        // Apply extracted searchMetadata
        if (extractedMetadata.searchMetadata && Object.keys(extractedMetadata.searchMetadata).length > 0) {
          logger?.info(`Extracted searchMetaData with ${Object.keys(extractedMetadata.searchMetadata).length} fields`);
          pieItem.searchMetaData = {
            ...extractedMetadata.searchMetadata,
            // Preserve any transformer-generated metadata
            ...(pieItem.metadata?.searchMetaData || {}),
          };
        }
      } else {
        // Fallback to old method if no extractor available
        const extractedSearchMetadata = extractSearchMetadata(doc);
        if (Object.keys(extractedSearchMetadata).length > 0) {
          logger?.info(`Extracted searchMetaData with ${Object.keys(extractedSearchMetadata).length} fields (legacy method)`);
          pieItem.searchMetaData = {
            ...extractedSearchMetadata,
            ...(pieItem.metadata?.searchMetaData || {}),
          };
        }
      }

      const cssClassExtractions = extractCssClassesWithHooks({
        extractors: this.vendorExtensions.cssClassExtractors,
        root: doc,
        vendorInfo,
      });

      if (cssClassExtractions.length > 0) {
        logger?.info(`Extracted vendor CSS classes from ${cssClassExtractions.length} element(s)`);
        pieItem.metadata = {
          ...(pieItem.metadata || {}),
          vendorExtensions: {
            ...(pieItem.metadata?.vendorExtensions || {}),
            cssClasses: cssClassExtractions,
          },
        };
      }

      await applyItemDecorators(this.sourceProfiles, profileRuntime, itemContext, pieItem, 'beforeFinalize', trace);

      // Embed original QTI XML for lossless round-trip
      const pieItemWithSource = embedQtiSourceInPie(pieItem, qtiXml, {
        generator: {
          package: '@pie-qti/to-pie',
          version: this.version,
        },
        timestamp: new Date(),
        qtiVersion,
      });
      await applyItemDecorators(this.sourceProfiles, profileRuntime, itemContext, pieItemWithSource, 'afterFinalize', trace);

      return {
        items: [{ content: pieItemWithSource, format: 'pie' as const }],
        format: 'pie',
        metadata: {
          sourceFormat,
          targetFormat: 'pie',
          pluginId: this.id,
          timestamp: new Date(),
          itemCount: 1,
          processingTime,
          qtiVersion,
          ...metadataFromProfileRuntime(profileRuntime),
          conversionTrace: finalizeTrace(trace, profileRuntime),
        } as any,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      logger?.error(`Transformation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Detect the type of QTI interaction
   */
  private detectInteractionType(qtiXml: string, analysis?: InteractionAnalysis | null): string {
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

    if (analysis?.standardTypes.length) {
      return analysis.standardTypes[0]!;
    }

    if (analysis?.customInteractionCount) {
      return 'customInteraction';
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
    logger?: any,
    sourceFormat = 'qti22',
    trace?: ConversionTrace,
    qtiVersion?: string
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
        sourceFormat,
        targetFormat: 'pie' as const,
        pluginId: this.id,
        timestamp: new Date(),
        itemCount: isAssessment
          ? extensionData.sourceModel.sections.reduce((sum: number, s: any) => sum + s.itemRefs.length, 0)
          : 1,
        processingTime,
        losslessRoundTrip: true,
        ...(qtiVersion && { qtiVersion }),
        ...(trace && { conversionTrace: trace }),
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

type QtiVersion = '2.1' | '2.2' | '3.0' | 'unknown';

interface InteractionAnalysis {
  standardTypes: string[];
  customInteractionCount: number;
}

interface QtiProcessingMetadata {
  responseDeclarationsXml?: string[];
  outcomeDeclarationsXml?: string[];
  responseProcessingXml?: string;
}

const STANDARD_ITEM_INTERACTIONS = [
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
] as const;

function detectQtiVersion(qtiXml: string): QtiVersion {
  if (qtiXml.includes('imsqtiasi_v3p0') || qtiXml.includes('imsqti_v3p0')) return '3.0';
  if (qtiXml.includes('imsqti_v2p2')) return '2.2';
  if (qtiXml.includes('imsqti_v2p1')) return '2.1';
  return 'unknown';
}

function qtiVersionToSourceFormat(version: QtiVersion): string {
  switch (version) {
    case '2.1':
      return 'qti21';
    case '2.2':
      return 'qti22';
    case '3.0':
      return 'qti30';
    default:
      return 'qti';
  }
}

function analyzeAssessmentItemInteractions(assessmentItem: HTMLElement): InteractionAnalysis {
  const itemBody = assessmentItem.getElementsByTagName('itemBody')[0];
  if (!itemBody) {
    return { standardTypes: [], customInteractionCount: 0 };
  }

  const standardTypes = STANDARD_ITEM_INTERACTIONS.filter(
    interactionType => itemBody.getElementsByTagName(interactionType).length > 0
  );

  return {
    standardTypes,
    customInteractionCount: itemBody.getElementsByTagName('customInteraction').length,
  };
}

function validateInteractionShape(analysis: InteractionAnalysis, itemId: string): void {
  if (analysis.customInteractionCount > 0) {
    const standardPart = analysis.standardTypes.length > 0
      ? ` with standard interaction(s): ${analysis.standardTypes.join(', ')}`
      : '';
    throw new Error(
      `Unsupported customInteraction${standardPart} in item ${itemId}. ` +
      'Use a vendor transformer for proprietary interactions instead of reducing the item to a generic PIE model.'
    );
  }

  if (analysis.standardTypes.length > 1) {
    if (
      analysis.standardTypes.length === 2 &&
      analysis.standardTypes.includes('choiceInteraction') &&
      analysis.standardTypes.every(type => type === 'choiceInteraction')
    ) {
      return;
    }

    throw new Error(
      `Unsupported composite QTI item ${itemId}: ${analysis.standardTypes.join(', ')}. ` +
      'Generic QTI to PIE conversion does not silently reduce multi-interaction items to the first interaction.'
    );
  }
}

function createProcessingWarnings(assessmentItem: HTMLElement, itemId: string): TransformWarning[] {
  const warnings: TransformWarning[] = [];
  const responseProcessing = assessmentItem.getElementsByTagName('responseProcessing')[0];

  if (responseProcessing) {
    const template = responseProcessing.getAttribute('template') || '';
    const hasInlineRules = responseProcessing.childNodes.some(
      child => Boolean((child as any).rawTagName)
    );

    if (hasInlineRules) {
      warnings.push({
        itemId,
        code: 'QTI_RESPONSE_PROCESSING_PRESERVED',
        message:
          'Inline QTI responseProcessing was preserved in metadata, but generic PIE scoring may not fully represent the rule tree.',
      });
    } else if (/map_response/i.test(template)) {
      warnings.push({
        itemId,
        code: 'QTI_MAP_RESPONSE_TEMPLATE',
        message:
          'QTI map_response scoring was detected. Verify the resulting PIE model preserves intended partial-credit behavior.',
      });
    }
  }

  if (assessmentItem.getElementsByTagName('mapping').length > 0) {
    warnings.push({
      itemId,
      code: 'QTI_MAPPING_DECLARATION',
      message:
        'QTI responseDeclaration mapping was detected. Verify the resulting PIE model preserves intended partial-credit behavior.',
    });
  }

  return warnings;
}

function collectQtiProcessingMetadata(assessmentItem: HTMLElement): QtiProcessingMetadata | null {
  const responseDeclarationsXml = directChildrenXml(assessmentItem, 'responseDeclaration');
  const outcomeDeclarationsXml = directChildrenXml(assessmentItem, 'outcomeDeclaration');
  const responseProcessingXml = directChildXml(assessmentItem, 'responseProcessing');

  if (
    responseDeclarationsXml.length === 0 &&
    outcomeDeclarationsXml.length === 0 &&
    !responseProcessingXml
  ) {
    return null;
  }

  return {
    ...(responseDeclarationsXml.length > 0 && { responseDeclarationsXml }),
    ...(outcomeDeclarationsXml.length > 0 && { outcomeDeclarationsXml }),
    ...(responseProcessingXml && { responseProcessingXml }),
  };
}

function directChildrenXml(parent: HTMLElement, tagName: string): string[] {
  return Array.from(parent.getElementsByTagName(tagName))
    .filter(element => element.parentNode === parent)
    .map(element => element.toString());
}

function directChildXml(parent: HTMLElement, tagName: string): string | undefined {
  return directChildrenXml(parent, tagName)[0];
}

function withTraceMetadata(
  output: TransformOutput,
  trace: ConversionTrace,
  profileRuntime: ProfileRuntimeResult
): TransformOutput {
  return {
    ...output,
    metadata: {
      ...output.metadata,
      ...metadataFromProfileRuntime(profileRuntime),
      conversionTrace: finalizeTrace(trace, profileRuntime),
    } as any,
  };
}

function metadataFromProfileRuntime(
  profileRuntime: ProfileRuntimeResult
): Pick<TransformOutput['metadata'], 'sourceProfiles'> & {
  standardCandidates?: SourceProfileExtractionResult['standardCandidates'];
  rubricCandidates?: SourceProfileExtractionResult['rubricCandidates'];
  sidecars?: SourceProfileExtractionResult['sidecars'];
} {
  return {
    ...(profileRuntime.matches.length > 0 && { sourceProfiles: profileRuntime.matches }),
    ...(profileRuntime.extraction.standardCandidates?.length && {
      standardCandidates: profileRuntime.extraction.standardCandidates,
    }),
    ...(profileRuntime.extraction.rubricCandidates?.length && {
      rubricCandidates: profileRuntime.extraction.rubricCandidates,
    }),
    ...(profileRuntime.extraction.sidecars?.length && {
      sidecars: profileRuntime.extraction.sidecars,
    }),
  };
}

function finalizeTrace(
  trace: ConversionTrace,
  profileRuntime: ProfileRuntimeResult
): ConversionTrace {
  return {
    ...trace,
    ...(profileRuntime.matches.length > 0 && { profiles: profileRuntime.matches }),
    ...(profileRuntime.extraction.standardCandidates?.length && {
      standardCandidates: profileRuntime.extraction.standardCandidates,
    }),
    ...(profileRuntime.extraction.rubricCandidates?.length && {
      rubricCandidates: profileRuntime.extraction.rubricCandidates,
    }),
    ...(profileRuntime.extraction.sidecars?.length && {
      sidecars: profileRuntime.extraction.sidecars,
    }),
  };
}
