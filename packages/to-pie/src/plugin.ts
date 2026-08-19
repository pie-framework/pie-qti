/**
 * QTI 2.2 to PIE Plugin
 *
 * Transforms QTI 2.2 assessment items to PIE format
 */

import type {
  ConversionTrace,
  PieItem,
  PieModel,
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
import { serializeChildrenWithReplacements } from './utils/markup-extraction.js';
import { extractSearchMetadata } from './utils/metadata-extraction.js';
import { makePieItemPlayerReady } from './utils/player-config.js';
import { extractPieExtension, hasPieExtension } from './utils/pie-extension.js';
import { embedQtiSourceInPie } from './utils/qti-extension-embedder.js';
import {
  isQtiInteractionElement,
  type PlannedQtiInteractionUnit,
  planQtiItemBody,
  type QtiItemBodyPlan,
} from './utils/qti-item-planner.js';
import { isAssessmentTestDocument, validateQti } from './utils/qti-validator.js';
import { withStylesheetResources } from './utils/stylesheet-extraction.js';
import { createStandardMetadataExtractor } from './extractors/standard-metadata-extractor.js';
import { extractCssClassesWithHooks } from './vendor-extension-runtime.js';
import {
  addTraceEvent,
  applyItemDecorators,
  createConversionTrace,
  detectItemProfiles,
  runItemHandlers,
  type ProfileRuntimeResult,
} from './source-profile-runtime.js';
import {
  type BuiltInTransformContext,
  type BuiltInTransformResult,
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

/**
 * Base for failures that are scoped to a single item. The package transformer records these
 * against the offending item and carries on with the rest of the package; any other error
 * aborts the whole package transform.
 */
export class QtiItemTransformError extends Error {
  readonly sourceDiagnostics: SourceProfileExtractionResult['diagnostics'];
  readonly conversionTrace: ConversionTrace;

  constructor(message: string, options: {
    sourceDiagnostics: SourceProfileExtractionResult['diagnostics'];
    conversionTrace: ConversionTrace;
  }) {
    super(message);
    this.name = 'QtiItemTransformError';
    this.sourceDiagnostics = options.sourceDiagnostics;
    this.conversionTrace = options.conversionTrace;
  }
}

export class QtiSourceProfileTransformError extends QtiItemTransformError {
  constructor(message: string, options: {
    sourceDiagnostics: SourceProfileExtractionResult['diagnostics'];
    conversionTrace: ConversionTrace;
  }) {
    super(message, options);
    this.name = 'QtiSourceProfileTransformError';
  }
}

/** The item is well-formed QTI this transform cannot represent in PIE. */
export class QtiUnsupportedItemError extends QtiItemTransformError {
  constructor(message: string, options: {
    sourceDiagnostics: SourceProfileExtractionResult['diagnostics'];
    conversionTrace: ConversionTrace;
  }) {
    super(message, options);
    this.name = 'QtiUnsupportedItemError';
  }
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
    const itemId = this.extractItemId(qtiXml, input.metadata?.resourceId as string | undefined);
    const trace = createConversionTrace(`qti-to-pie-${itemId}`);
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
    // QTI 3.0 items use kebab element names throughout, and every transformer on this path reads
    // QTI 2.x camelCase children. The 3.0 root is therefore recognised only so the item can be
    // rejected by version rather than reported as an unknown interaction type.
    const qti3ItemElement = assessmentItem
      ? undefined
      : doc.getElementsByTagName('qti-assessment-item')[0];
    const itemElement = assessmentItem ?? qti3ItemElement;
    const interactionAnalysis = itemElement ? analyzeAssessmentItemInteractions(itemElement) : null;
    const itemBody = assessmentItem?.getElementsByTagName('itemBody')[0];
    const itemBodyPlan = itemBody ? planQtiItemBody(itemBody) : undefined;
    const itemContext = {
      itemId,
      resourceId: (input.metadata?.resourceId as string | undefined) ?? itemId,
      sourcePath: input.metadata?.sourcePath as string | undefined,
      xml: qtiXml,
      qtiVersion,
      interactionTypes: interactionAnalysis?.standardTypes ?? [],
      responseProcessingXml: assessmentItem ? directChildXml(assessmentItem, 'responseProcessing') : undefined,
      qtiItemBodyPlan: itemBodyPlan,
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

    // Vendor transformers receive the raw XML and may support QTI 3.0 themselves, so the version
    // rejection lands after vendor detection and before built-in handler selection.
    const itemFailure: ItemFailureContext = {
      itemId,
      trace,
      sourceDiagnostics: profileRuntime.extraction.diagnostics,
      sourcePath: itemContext.sourcePath,
    };

    if (qti3ItemElement) {
      throw createUnsupportedQti3ItemError(interactionAnalysis, itemFailure);
    }

    // Detect item type and use appropriate transformer
    const interactionType = this.detectInteractionType(qtiXml, interactionAnalysis);

    // Extract baseId for round-trip compatibility
    const baseId = this.extractBaseId(assessmentItem);

    logger?.debug(`Processing item: ${itemId} (type: ${interactionType})${baseId ? ` [baseId: ${baseId}]` : ''}`);

    const builtInContext: BuiltInTransformContext = {
      interactionType,
      qtiXml,
      itemId,
      assessmentItem,
      itemBodyPlan,
      sourcePath: itemContext.sourcePath,
      baseId,
      logger,
    };

    const runGenericTransform = async (): Promise<TransformOutput> => {
      if (interactionAnalysis) {
        warnings.push(...createInteractionShapeWarnings(interactionAnalysis, itemId));
      }

      if (assessmentItem) {
        warnings.push(...createProcessingWarnings(assessmentItem, itemId));
      }

      let pieItem;
      const useCompositeBuiltIns =
        interactionType !== 'ebsr' && shouldUseCompositeBuiltIns(interactionAnalysis, itemBodyPlan);

      try {
      const transformResult: BuiltInTransformResult = useCompositeBuiltIns
        ? {
            kind: 'pie-item',
            content: await this.transformCompositeBuiltIns(
              interactionAnalysis?.standardTypes ?? [],
              builtInContext,
              itemFailure
            ),
          }
        : await this.transformWithSingleBuiltIn({
            interactionAnalysis,
            interactionType,
            builtInContext,
            logger,
            trace,
            failure: itemFailure,
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
      if (useCompositeBuiltIns) {
        warnings.push({
          itemId,
          code: 'QTI_COMPOSITE_ITEM_COMPOSED',
          message: `Composed ${(interactionAnalysis?.standardTypes ?? []).join(', ')} into one PIE item.`,
        });
        addTraceEvent(trace, {
          kind: 'handler-selected',
          scope: 'item',
          itemId,
          message: 'Selected generic composite QTI transform handler.',
          data: { interactionTypes: interactionAnalysis?.standardTypes ?? [] },
        });
      }
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

      const playerReadyPieItem = withStylesheetResources(makePieItemPlayerReady(pieItem), qtiXml);

      // Embed original QTI XML for lossless round-trip
      const pieItemWithSource = embedQtiSourceInPie(playerReadyPieItem, qtiXml, {
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
    };

    const handlerRuntime = await runItemHandlers({
      profiles: this.sourceProfiles,
      runtime: profileRuntime,
      context: itemContext,
      delegate: {
        continue: runGenericTransform,
        transformWithBuiltIn: async (handlerId, overrides) =>
          this.registry
            .createDelegate(builtInContext)
            .transformWithBuiltIn(handlerId, overrides as any),
      },
      trace,
    });
    if (handlerRuntime.diagnostics.length > 0) {
      profileRuntime.extraction.diagnostics = [
        ...(profileRuntime.extraction.diagnostics ?? []),
        ...handlerRuntime.diagnostics,
      ];
      warnings.push(
        ...handlerRuntime.diagnostics
          .filter(diagnostic => diagnostic.severity !== 'info')
          .map(sourceDiagnosticToWarning)
      );
    }

    if (handlerRuntime.output) {
      return withTraceMetadata(handlerRuntime.output, trace, profileRuntime, warnings);
    }

    if (!handlerRuntime.allowGenericFallback) {
      const blockingDiagnostic = handlerRuntime.diagnostics.find(
        diagnostic => diagnostic.severity === 'error'
      );
      throw new QtiSourceProfileTransformError(
        blockingDiagnostic?.message ??
        `Generic QTI fallback is disabled for source-profile matched item ${itemId}.`,
        {
          sourceDiagnostics: profileRuntime.extraction.diagnostics,
          conversionTrace: trace,
        }
      );
    }

    return runGenericTransform();
  }

  /**
   * Transform a single, non-composite interaction through the registry.
   */
  private async transformWithSingleBuiltIn(input: {
    interactionAnalysis: InteractionAnalysis | null;
    interactionType: string;
    builtInContext: BuiltInTransformContext;
    logger?: TransformContext['logger'];
    trace: ConversionTrace;
    failure: ItemFailureContext;
  }): Promise<BuiltInTransformResult> {
    if (input.interactionAnalysis) {
      validateInteractionShape(input.interactionAnalysis, input.failure);
    }
    const builtInHandler = this.registry.getHandlerForInteraction(input.interactionType);
    if (!builtInHandler) {
      input.logger?.warn(`Unsupported interaction type: ${input.interactionType} for item ${input.failure.itemId}`);
      throw unsupportedItemError(
        `Unsupported interaction type: ${input.interactionType}`,
        'QTI_INTERACTION_TYPE_UNSUPPORTED',
        input.failure
      );
    }
    addTraceEvent(input.trace, {
      kind: 'handler-selected',
      scope: 'item',
      itemId: input.failure.itemId,
      handlerId: builtInHandler.id,
      message: `Selected built-in QTI transform handler ${builtInHandler.id}.`,
    });
    return builtInHandler.transform(input.builtInContext);
  }

  /**
   * Compose a multi-interaction item's units into one PIE item.
   *
   * Each unit is transformed independently through its own registry handler, then merged:
   * `elements` specs are de-duplicated across parts, model ids and element references are
   * rewritten to avoid collisions, and the item's own markup gets each unit's leading
   * interaction replaced by a placeholder tag referencing the merged model — everything else
   * (prose, prompts) stays untouched. `validateCompositeUnitCompatibility` runs first so an
   * unsupported combination fails closed before any part is transformed.
   */
  private async transformCompositeBuiltIns(
    interactionTypes: string[],
    context: BuiltInTransformContext,
    failure: ItemFailureContext
  ): Promise<PieItem> {
    const plan = context.itemBodyPlan;
    const itemBody = context.assessmentItem?.getElementsByTagName('itemBody')[0];
    if (!plan || !itemBody) {
      throw unsupportedItemError(
        `Composite QTI item ${failure.itemId} cannot be planned without itemBody.`,
        'QTI_COMPOSITE_ITEM_UNSUPPORTED',
        failure
      );
    }
    validateCompositeUnitCompatibility(failure, plan.units, interactionTypes);

    const elements: Record<string, string> = {};
    const models: PieModel[] = [];
    const usedModelIds = new Set<string>();
    const replacements = new Map<HTMLElement, string>();
    const ownedInteractionNodes = new Set(plan.interactions);
    let firstPart: PieItem | null = null;

    for (const unit of plan.units) {
      const interactionType = unit.interactionType;
      const builtInHandler = this.registry.getHandlerForInteraction(interactionType);
      if (!builtInHandler) {
        throw unsupportedItemError(
          `Unsupported interaction type: ${interactionType}`,
          'QTI_INTERACTION_TYPE_UNSUPPORTED',
          failure
        );
      }
      const result = await builtInHandler.transform({
        ...context,
        interactionType,
        interactionUnit: unit,
      });
      if (result.kind !== 'pie-item') {
        throw unsupportedItemError(
          `Composite QTI item ${failure.itemId} cannot include ${interactionType}.`,
          'QTI_COMPOSITE_ITEM_UNSUPPORTED',
          failure
        );
      }
      const part = result.content as PieItem;
      firstPart ??= part;
      const elementKeyMap = mergeElementSpecs(part.config.elements, elements);
      const firstModel = part.config.models[0];
      if (!firstModel) {
        throw unsupportedItemError(
          `Composite QTI item ${failure.itemId} produced an empty ${interactionType} part.`,
          'QTI_COMPOSITE_ITEM_UNSUPPORTED',
          failure
        );
      }

      const normalizedPartModels: PieModel[] = [];
      for (const model of part.config.models) {
        const nextModel = normalizeCompositeModel(
          { ...model },
          unit,
          part.config.elements,
          elementKeyMap,
          usedModelIds
        );
        models.push(nextModel);
        normalizedPartModels.push(nextModel);
      }

      const placeholderModel = selectPrimaryPlaceholderModel(
        normalizedPartModels,
        builtInHandler.pieElements ?? [],
        elements
      );
      const placeholder = placeholderForModel(placeholderModel, elements);
      replacements.set(unit.interactions[0]!, placeholder);
      for (const extraInteraction of unit.interactions.slice(1)) {
        replacements.set(extraInteraction, '');
      }
    }

    if (!firstPart) {
      throw unsupportedItemError(
        `Composite QTI item ${failure.itemId} did not produce any PIE parts.`,
        'QTI_COMPOSITE_ITEM_UNSUPPORTED',
        failure
      );
    }

    return {
      ...firstPart,
      id: failure.itemId,
      config: {
        ...firstPart.config,
        models,
        elements,
        markup: serializeChildrenWithReplacements(itemBody, {
          replacements,
          omit: (element) =>
            isQtiInteractionElement(element) && !ownedInteractionNodes.has(element),
        }),
      },
      metadata: {
        ...(firstPart.metadata ?? {}),
        compositeSource: {
          partCount: models.length,
          interactionTypes,
        },
      },
    };
  }

  /**
   * Detect the type of QTI interaction
   */
  private detectInteractionType(qtiXml: string, analysis?: InteractionAnalysis | null): string {
    // Root-anchored, covering the QTI 3.0 spelling too — a plain substring search also fires
    // on an item whose prompt or rubric merely quotes assessmentTest markup, silently routing
    // it to the assessment handler, which returns a `PieAssessment` in place of the item with
    // no warning.
    if (isAssessmentTestDocument(qtiXml)) {
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

    // Fallback for XML with no parseable <assessmentItem>: recognise the first interaction
    // element by shape, so an unsupported interaction is named rather than reported as unknown.
    // Deliberately QTI 2.x-only — every transformer on this path reads camelCase elements, so a
    // QTI 3.0 item must stay 'unknown' and fail loudly rather than transform into an empty model.
    const match = qtiXml.match(/<([a-zA-Z][A-Za-z0-9]*Interaction)[\s/>]/);
    if (match?.[1]) {
      return match[1];
    }

    return 'unknown';
  }

  /**
   * Check if QTI XML is EBSR (Evidence-Based Selected Response).
   *
   * Exactly two `choiceInteraction`s is necessary but not sufficient: an ordinary two-part
   * composite item (two unrelated multiple-choice questions) has the same shape. Requiring
   * textual evidence — an "EBSR"/"evidence-based" mention, or a Part A/Part B pairing, on the
   * item's identifier, title, or either interaction's responseIdentifier — avoids treating
   * every two-choiceInteraction item as EBSR by coincidence of count alone.
   */
  private isEbsr(qtiXml: string): boolean {
    const matches = qtiXml.match(/<choiceInteraction/g);
    if (matches?.length !== 2) {
      return false;
    }

    const doc = parse(qtiXml, {
      lowerCaseTagName: false,
      comment: false,
    });
    const assessmentItem = doc.querySelector('assessmentItem') || doc.getElementsByTagName('assessmentItem')[0];
    const choiceInteractions = assessmentItem?.getElementsByTagName('choiceInteraction') ?? [];
    const itemEvidence = [
      assessmentItem?.getAttribute('identifier'),
      assessmentItem?.getAttribute('title'),
      ...Array.from(choiceInteractions).map((interaction) =>
        interaction.getAttribute('responseIdentifier')
      ),
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase();

    return (
      /\bebsr\b/.test(itemEvidence) ||
      itemEvidence.includes('evidence-based') ||
      (/\bpart[_\s-]?a\b/.test(itemEvidence) && /\bpart[_\s-]?b\b/.test(itemEvidence))
    );
  }

  /**
   * Derive the item's id, in descending order of durability:
   *
   *   1. the assessment item's own `identifier`
   *   2. the manifest resource id
   *   3. a hash of the item content
   *
   * **The identifier lookup is scoped to the root element's opening tag**, not searched for
   * anywhere in the document. An unanchored `identifier=["']([^"']+)["']` search matches the
   * first identifier *anywhere*, and because `[^"']+` requires at least one character it skips
   * an **empty** `identifier=""` on the item and silently picks up whatever comes next — in
   * real partner packages a `responseDeclaration`, so every item in a 150-item package came out
   * with the id `RESPONSE`. That is a worse failure than no id at all: distinct items collapse
   * onto one QTI Source Identity, and an id-based import merges them.
   *
   * The manifest resource id is preferred over a content hash because it survives editing. A
   * hash changes whenever the item changes, so using it as the primary fallback would make
   * every edited item look like a brand-new item rather than an update.
   */
  private extractItemId(qtiXml: string, resourceId?: string): string {
    const rootTag = /<\s*(?:[\w.-]+:)?(?:assessmentItem|qti-assessment-item)\b[^>]*>/i.exec(
      qtiXml
    )?.[0];
    const declared = rootTag
      ? /\bidentifier\s*=\s*["']([^"']*)["']/i.exec(rootTag)?.[1]?.trim()
      : undefined;
    if (declared) {
      return declared;
    }
    const fromManifest = resourceId?.trim();
    if (fromManifest) {
      return fromManifest;
    }
    return `item-${shortHash(qtiXml)}`;
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

interface CustomInteractionEvidence {
  responseIdentifier?: string;
  customInteractionIdentifierType?: string;
  moduleRefs: string[];
}

interface CustomOperatorEvidence {
  className?: string;
}

interface InteractionAnalysis {
  itemBodyPresent: boolean;
  /** Distinct response-bearing interaction names, normalized to QTI 2.x camelCase. */
  standardTypes: string[];
  /** Interaction names present that control attempt flow rather than carrying a response. */
  attemptControlTypes: string[];
  customInteractionCount: number;
  customInteractions: CustomInteractionEvidence[];
  /** Interaction names found nested inside a `feedbackBlock` — conditionally rendered, not convertible. */
  feedbackInteractionTypes: string[];
  customOperators: CustomOperatorEvidence[];
}

interface QtiProcessingMetadata {
  responseDeclarationsXml?: string[];
  outcomeDeclarationsXml?: string[];
  responseProcessingXml?: string;
}

/**
 * Interactions are recognised by element shape, not by an allow-list: any `*Interaction`
 * (QTI 2.x) or `qti-*-interaction` (QTI 3.0) element counts. An allow-list under-counts
 * composites for every interaction it omits, which is precisely the silent reduction the
 * composite guard exists to prevent.
 */
const QTI_INTERACTION_NAME = /^[a-zA-Z][A-Za-z0-9]*Interaction$/;

/** Custom and portable-custom interactions route to vendor transformers; they are never reduced. */
const CUSTOM_INTERACTION_NAMES = new Set(['customInteraction', 'portableCustomInteraction']);

/**
 * endAttemptInteraction controls attempt flow rather than carrying a scored response, and has
 * no PIE equivalent. It is reported as a dropped interaction instead of failing the item.
 */
const ATTEMPT_CONTROL_INTERACTION_NAMES = new Set(['endAttemptInteraction']);

/** Normalize a QTI 3.0 kebab element name to its QTI 2.x camelCase equivalent. */
function toCamelElementName(tagName: string): string {
  if (!tagName.startsWith('qti-')) return tagName;
  return tagName
    .slice(4)
    .split('-')
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function collectInteractionNames(node: HTMLElement, found: string[]): void {
  for (const child of node.childNodes) {
    const element = child as HTMLElement;
    if (!element.rawTagName) continue;
    const name = toCamelElementName(element.rawTagName);
    if (QTI_INTERACTION_NAME.test(name)) found.push(name);
    collectInteractionNames(element, found);
  }
}

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
  const itemBody =
    assessmentItem.getElementsByTagName('itemBody')[0] ||
    assessmentItem.getElementsByTagName('qti-item-body')[0];
  if (!itemBody) {
    return {
      itemBodyPresent: false,
      standardTypes: [],
      attemptControlTypes: [],
      customInteractionCount: 0,
      customInteractions: [],
      feedbackInteractionTypes: [],
      customOperators: [],
    };
  }

  const found: string[] = [];
  collectInteractionNames(itemBody, found);

  const standardTypes: string[] = [];
  const attemptControlTypes: string[] = [];
  let customInteractionCount = 0;

  // Repeats of one type are counted once: multi-blank items (several textEntryInteraction or
  // inlineChoiceInteraction elements) are a supported shape whose transformer consumes every
  // occurrence, so they are not a reduction.
  for (const name of found) {
    if (CUSTOM_INTERACTION_NAMES.has(name)) {
      customInteractionCount += 1;
      continue;
    }
    if (ATTEMPT_CONTROL_INTERACTION_NAMES.has(name)) {
      if (!attemptControlTypes.includes(name)) attemptControlTypes.push(name);
      continue;
    }
    if (!standardTypes.includes(name)) standardTypes.push(name);
  }

  const customInteractions = elementsByLocalName(itemBody, 'customInteraction').map(
    customInteractionEvidence
  );
  const feedbackInteractionTypes = interactionTypesInsideFeedbackBlocks(itemBody);
  const customOperators = elementsByLocalName(assessmentItem, 'customOperator').map(
    customOperatorEvidence
  );

  return {
    itemBodyPresent: true,
    standardTypes,
    attemptControlTypes,
    customInteractionCount,
    customInteractions,
    feedbackInteractionTypes,
    customOperators,
  };
}

/** Every element under `root` whose local name (namespace prefix stripped) matches, at any depth. */
function elementsByLocalName(root: HTMLElement, localName: string): HTMLElement[] {
  const normalizedLocalName = localName.toLowerCase();
  const matches: HTMLElement[] = [];
  const visit = (node: HTMLElement) => {
    for (const child of node.childNodes) {
      const element = child as HTMLElement;
      if (!element.tagName && !element.rawTagName) {
        continue;
      }
      if (elementLocalName(element) === normalizedLocalName) {
        matches.push(element);
      }
      visit(element);
    }
  };

  visit(root);
  return matches;
}

/**
 * Interaction names found nested inside a `feedbackBlock`, by shape (reusing
 * `collectInteractionNames`) rather than an allow-list, scoped to each feedback block's own
 * subtree. QTI feedback visibility is outcome-driven and conditionally rendered, so an
 * interaction living inside one is not real, always-present item content — walking the whole
 * itemBody without this distinction would let it be counted as, and potentially selected as,
 * the item's actual interaction.
 */
function interactionTypesInsideFeedbackBlocks(itemBody: HTMLElement): string[] {
  const interactionTypes: string[] = [];
  for (const feedbackBlock of elementsByLocalName(itemBody, 'feedbackBlock')) {
    collectInteractionNames(feedbackBlock, interactionTypes);
  }
  return interactionTypes;
}

function elementLocalName(element: HTMLElement): string {
  const tagName = element.rawTagName || element.tagName || '';
  return (tagName.split(':').pop() || tagName).toLowerCase();
}

function customInteractionEvidence(customInteraction: HTMLElement): CustomInteractionEvidence {
  const nestedPortable =
    customInteraction.getElementsByTagName('portableCustomInteraction')[0] ??
    customInteraction.getElementsByTagName('pci:portableCustomInteraction')[0];
  const moduleRefs = [
    customInteraction.getAttribute('data-module-ref'),
    ...Array.from(customInteraction.getElementsByTagName('script')).map((script) =>
      script.getAttribute('src')
    ),
  ].filter((value): value is string => Boolean(value));
  return {
    responseIdentifier: customInteraction.getAttribute('responseIdentifier'),
    customInteractionIdentifierType:
      customInteraction.getAttribute('customInteractionIdentifierType') ??
      nestedPortable?.getAttribute('customInteractionIdentifierType'),
    moduleRefs: [...new Set(moduleRefs)],
  };
}

function customOperatorEvidence(customOperator: HTMLElement): CustomOperatorEvidence {
  return {
    className: customOperator.getAttribute('class'),
  };
}

function formatCustomInteractionEvidence(
  interactions: CustomInteractionEvidence[],
  sourcePath?: string
): string {
  const [first] = interactions;
  if (!first) {
    return sourcePath ? ` (sourcePath: ${sourcePath})` : '';
  }
  const parts = [
    sourcePath ? `sourcePath: ${sourcePath}` : undefined,
    first.responseIdentifier ? `responseIdentifier: ${first.responseIdentifier}` : undefined,
    first.customInteractionIdentifierType
      ? `customInteractionIdentifierType: ${first.customInteractionIdentifierType}`
      : undefined,
    first.moduleRefs.length > 0 ? `moduleRefs: ${first.moduleRefs.join(', ')}` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join('; ')})` : '';
}

function formatCustomOperatorEvidence(
  operators: CustomOperatorEvidence[],
  sourcePath?: string
): string {
  const [first] = operators;
  if (!first) {
    return sourcePath ? ` (sourcePath: ${sourcePath})` : '';
  }
  const parts = [
    sourcePath ? `sourcePath: ${sourcePath}` : undefined,
    first.className ? `class: ${first.className}` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join('; ')})` : '';
}

/** What an item-scoped failure needs to report itself to the package transformer. */
interface ItemFailureContext {
  itemId: string;
  trace: ConversionTrace;
  sourceDiagnostics: SourceProfileExtractionResult['diagnostics'];
  sourcePath?: string;
}

function unsupportedItemError(
  message: string,
  code: string,
  failure: ItemFailureContext
): QtiUnsupportedItemError {
  return new QtiUnsupportedItemError(message, {
    sourceDiagnostics: [
      ...(failure.sourceDiagnostics ?? []),
      {
        code,
        severity: 'error',
        message,
        scope: 'item',
        itemId: failure.itemId,
      },
    ],
    conversionTrace: failure.trace,
  });
}

function validateInteractionShape(analysis: InteractionAnalysis, failure: ItemFailureContext): void {
  if (!analysis.itemBodyPresent) {
    throw unsupportedItemError(
      `QTI item ${failure.itemId} is missing itemBody.`,
      'QTI_ITEM_BODY_MISSING',
      failure
    );
  }

  if (analysis.customInteractionCount > 0) {
    const standardPart = analysis.standardTypes.length > 0
      ? ` with standard interaction(s): ${analysis.standardTypes.join(', ')}`
      : '';
    const evidence = formatCustomInteractionEvidence(analysis.customInteractions, failure.sourcePath);
    throw unsupportedItemError(
      `Unsupported customInteraction${standardPart} in item ${failure.itemId}${evidence}. ` +
      'Use a vendor transformer for proprietary interactions instead of reducing the item to a generic PIE model.',
      'QTI_CUSTOM_INTERACTION_UNSUPPORTED',
      failure
    );
  }

  if (analysis.feedbackInteractionTypes.length > 0) {
    throw unsupportedItemError(
      `Unsupported interaction inside feedbackBlock in item ${failure.itemId}: ${[
        ...new Set(analysis.feedbackInteractionTypes),
      ].join(', ')}. ` +
      'QTI feedback visibility is outcome-driven; use a source-profile or vendor transform to preserve feedback wiring.',
      'QTI_FEEDBACK_INTERACTION_UNSUPPORTED',
      failure
    );
  }

  if (analysis.customOperators.length > 0) {
    const evidence = formatCustomOperatorEvidence(analysis.customOperators, failure.sourcePath);
    throw unsupportedItemError(
      `Unsupported customOperator in item ${failure.itemId}${evidence}. ` +
      'Use a vendor transformer for proprietary response processing instead of generic PIE conversion.',
      'QTI_CUSTOM_OPERATOR_UNSUPPORTED',
      failure
    );
  }

  if (analysis.standardTypes.length === 0) {
    throw unsupportedItemError(
      `QTI item ${failure.itemId} has no QTI interaction in itemBody.`,
      'QTI_NO_INTERACTION_FOUND',
      failure
    );
  }

  if (analysis.standardTypes.length > 1) {
    throw unsupportedItemError(
      `Unsupported composite QTI item ${failure.itemId}: ${analysis.standardTypes.join(', ')}. ` +
      'Generic QTI to PIE conversion does not silently reduce multi-interaction items to the first interaction.',
      'QTI_COMPOSITE_ITEM_UNSUPPORTED',
      failure
    );
  }
}

/** Only these interaction types may participate in a generic composite item today. */
const SCOPED_REPEATABLE_COMPOSITE_INTERACTIONS = new Set<string>([
  'choiceInteraction',
  'orderInteraction',
  'sliderInteraction',
  // textEntryInteraction/inlineChoiceInteraction handlers bound their own
  // markup extraction to the local span between neighboring units (see
  // `plannedInteractionUnitBoundaries` in qti-to-pie-registry.ts), so
  // repeated or multi-blank groups of these no longer risk duplicating a
  // sibling unit's prose the way an unbounded extraction would.
  'textEntryInteraction',
  'inlineChoiceInteraction',
  // match/hotspot/gapMatch/graphicGapMatch/extendedText are always
  // 'block'-kind units (never merged into a multi-interaction group, unlike
  // textEntry/inlineChoice), and their scoped adapters extract everything
  // from the interaction's own node plus a boundary-limited prompt — so
  // repeats carry the same, already-accepted per-unit boundary as
  // choice/order/slider.
  'matchInteraction',
  'hotspotInteraction',
  'gapMatchInteraction',
  'graphicGapMatchInteraction',
  'extendedTextInteraction',
]);

const SCOPED_COMPOSITE_INTERACTIONS = new Set<string>([
  ...SCOPED_REPEATABLE_COMPOSITE_INTERACTIONS,
  'textEntryInteraction',
  'inlineChoiceInteraction',
]);

function isSupportedCompositeInteractionShape(
  analysis: InteractionAnalysis | null
): analysis is InteractionAnalysis {
  return Boolean(
    analysis &&
      analysis.customInteractionCount === 0 &&
      analysis.customOperators.length === 0 &&
      analysis.standardTypes.length > 1
  );
}

function shouldUseCompositeBuiltIns(
  analysis: InteractionAnalysis | null,
  itemBodyPlan: QtiItemBodyPlan | undefined
): boolean {
  if (
    analysis &&
    (analysis.customInteractionCount > 0 ||
      analysis.customOperators.length > 0 ||
      analysis.feedbackInteractionTypes.length > 0)
  ) {
    return false;
  }
  if (isSupportedCompositeInteractionShape(analysis)) {
    return true;
  }
  return Boolean(itemBodyPlan && itemBodyPlan.units.length > 1);
}

function validateCompositeUnitCompatibility(
  failure: ItemFailureContext,
  units: PlannedQtiInteractionUnit[],
  interactionTypes: string[]
): void {
  const plannedTypes = new Set<string>(units.map((unit) => unit.interactionType));
  const unsupportedTypes = interactionTypes.filter(
    (interactionType) => !plannedTypes.has(interactionType)
  );
  if (unsupportedTypes.length > 0) {
    throw unsupportedItemError(
      `Unsupported composite QTI item ${failure.itemId}: ${unsupportedTypes.join(', ')}. ` +
        'Generic QTI to PIE conversion does not silently reduce multi-interaction items to supported siblings.',
      'QTI_COMPOSITE_ITEM_UNSUPPORTED',
      failure
    );
  }

  if (units.length < 2) {
    return;
  }
  const unitCounts = new Map<string, number>();
  for (const unit of units) {
    unitCounts.set(unit.interactionType, (unitCounts.get(unit.interactionType) ?? 0) + 1);
  }
  for (const [interactionType, count] of unitCounts) {
    if (count > 1 && !SCOPED_REPEATABLE_COMPOSITE_INTERACTIONS.has(interactionType)) {
      throw unsupportedItemError(
        `Unsupported composite QTI item ${failure.itemId}: repeated ${interactionType} units are not supported by the scoped generic converter.`,
        'QTI_COMPOSITE_ITEM_UNSUPPORTED',
        failure
      );
    }
  }
  for (const unit of units) {
    if (!SCOPED_COMPOSITE_INTERACTIONS.has(unit.interactionType)) {
      throw unsupportedItemError(
        `Unsupported composite QTI item ${failure.itemId}: ${unit.interactionType} units are not supported by the scoped generic converter.`,
        'QTI_COMPOSITE_ITEM_UNSUPPORTED',
        failure
      );
    }
  }
  for (const unit of units) {
    if (unit.kind === 'paired') {
      throw unsupportedItemError(
        `Unsupported composite QTI item ${failure.itemId}: EBSR paired groups cannot be mixed with other interactions.`,
        'QTI_COMPOSITE_ITEM_UNSUPPORTED',
        failure
      );
    }
  }
}

function mergeElementSpecs(
  source: Record<string, string>,
  target: Record<string, string>
): Map<string, string> {
  const elementKeyMap = new Map<string, string>();
  for (const [elementKey, packageSpec] of Object.entries(source)) {
    const mergedKey = uniqueKey(elementKey, target, packageSpec);
    target[mergedKey] = packageSpec;
    elementKeyMap.set(elementKey, mergedKey);
  }
  return elementKeyMap;
}

function normalizeCompositeModel(
  model: PieModel,
  unit: PlannedQtiInteractionUnit,
  sourceElements: Record<string, string>,
  elementKeyMap: Map<string, string>,
  usedModelIds: Set<string>
): PieModel {
  if (typeof model.element === 'string') {
    const sourceElementKey = elementTagForModel(model.element, sourceElements);
    if (sourceElementKey && elementKeyMap.has(sourceElementKey)) {
      model.element = elementKeyMap.get(sourceElementKey);
    }
  }

  if (typeof model.id === 'string') {
    model.id = uniqueModelId(model.id, usedModelIds);
  }

  if (unit.kind === 'inline' && unit.interactions.length === 1 && 'markup' in model) {
    (model as Record<string, unknown>).markup = '{{0}}';
  }

  if (
    !hasDirectInteractionPrompt(unit) &&
    typeof (model as Record<string, unknown>).prompt === 'string'
  ) {
    (model as Record<string, unknown>).prompt = '';
  }

  return model;
}

function selectPrimaryPlaceholderModel(
  models: PieModel[],
  pieElements: readonly string[],
  elements: Record<string, string>
): PieModel | undefined {
  const primaryPackageNames = new Set(pieElements.map(packageName));
  return (
    models.find((model) => {
      const modelElement = typeof model.element === 'string' ? model.element : null;
      if (!modelElement) {
        return false;
      }
      return primaryPackageNames.has(
        packageName(elementPackageSpecForModel(modelElement, elements))
      );
    }) ?? models[0]
  );
}

function hasDirectInteractionPrompt(unit: PlannedQtiInteractionUnit): boolean {
  return unit.interactions.some((interaction) =>
    interaction.childNodes.some((child) => {
      const element = child as HTMLElement;
      return element.tagName?.toLowerCase() === 'prompt';
    })
  );
}

function elementPackageSpecForModel(
  modelElement: string,
  elements: Record<string, string>
): string {
  return Object.hasOwn(elements, modelElement) ? elements[modelElement]! : modelElement;
}

function placeholderForModel(
  model: PieModel | undefined,
  elements: Record<string, string>
): string {
  const element = typeof model?.element === 'string' ? model.element : null;
  const id = typeof model?.id === 'string' ? model.id : null;
  if (!element || !id) {
    throw new Error('Composite QTI item produced a PIE model without element or id.');
  }
  const elementTag = Object.hasOwn(elements, element)
    ? element
    : elementTagForModel(element, elements);
  if (!elementTag) {
    throw new Error(`Composite QTI item produced a PIE model with unknown element ${element}.`);
  }
  return `<${elementTag} id="${escapeAttribute(id)}"></${elementTag}>`;
}

function elementTagForModel(modelElement: string, elements: Record<string, string>): string | null {
  if (Object.hasOwn(elements, modelElement)) {
    return modelElement;
  }
  const modelPackageName = packageName(modelElement);
  return (
    Object.entries(elements).find(
      ([, packageSpec]) => packageName(packageSpec) === modelPackageName
    )?.[0] ?? null
  );
}

function packageName(packageSpec: string) {
  if (!packageSpec.startsWith('@')) {
    const versionAt = packageSpec.indexOf('@');
    return versionAt > 0 ? packageSpec.slice(0, versionAt) : packageSpec;
  }

  const scopeSeparatorAt = packageSpec.indexOf('/');
  const versionAt = packageSpec.indexOf('@', scopeSeparatorAt + 1);
  return versionAt > 0 ? packageSpec.slice(0, versionAt) : packageSpec;
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function uniqueKey(key: string, target: Record<string, string>, packageSpec: string): string {
  if (!Object.hasOwn(target, key) || target[key] === packageSpec) {
    return key;
  }
  let index = 2;
  let next = `${key}-${index}`;
  while (Object.hasOwn(target, next)) {
    index += 1;
    next = `${key}-${index}`;
  }
  return next;
}

function uniqueModelId(modelId: string, used: Set<string>): string {
  if (!used.has(modelId)) {
    used.add(modelId);
    return modelId;
  }
  let index = 2;
  let next = `${modelId}-${index}`;
  while (used.has(next)) {
    index += 1;
    next = `${modelId}-${index}`;
  }
  used.add(next);
  return next;
}

function createUnsupportedQti3ItemError(
  analysis: InteractionAnalysis | null,
  failure: ItemFailureContext
): QtiUnsupportedItemError {
  const detected = [
    ...(analysis?.standardTypes ?? []),
    ...(analysis?.attemptControlTypes ?? []),
    ...(analysis?.customInteractionCount ? ['customInteraction'] : []),
  ];
  const detectedPart = detected.length > 0 ? ` Detected interaction(s): ${detected.join(', ')}.` : '';

  return unsupportedItemError(
    `Unsupported QTI 3.0 item ${failure.itemId}: this transform ingests QTI 2.1/2.2 item elements only.` +
    `${detectedPart} Convert the item to QTI 2.2 before transforming.`,
    'QTI_VERSION_UNSUPPORTED',
    failure
  );
}

function createInteractionShapeWarnings(
  analysis: InteractionAnalysis,
  itemId: string
): TransformWarning[] {
  if (analysis.attemptControlTypes.length === 0) return [];

  return [
    {
      itemId,
      code: 'QTI_INTERACTION_DROPPED',
      message:
        `${analysis.attemptControlTypes.join(', ')} has no PIE equivalent and was dropped from item ${itemId}; ` +
        'attempt-control behaviour is not represented in the converted item.',
    },
  ];
}

/**
 * `map_response`/`map_response_point` is boilerplate on some partners' exports: a template URI
 * stamped on every item regardless of whether the item actually declares a `<mapping>` to score
 * against. Gate on the mapping actually existing so the warning means "a mapping was found and
 * its per-key weights were collapsed to a single answer set", not "this template string
 * appeared" — otherwise the one case worth a reviewer's attention drowns in cases where there is
 * nothing to verify.
 */
export function createProcessingWarnings(assessmentItem: HTMLElement, itemId: string): TransformWarning[] {
  const warnings: TransformWarning[] = [];
  const responseProcessing = assessmentItem.getElementsByTagName('responseProcessing')[0];
  const hasMapping = assessmentItem.getElementsByTagName('mapping').length > 0;

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
    } else if (/map_response/i.test(template) && hasMapping) {
      warnings.push({
        itemId,
        code: 'QTI_MAP_RESPONSE_TEMPLATE',
        message:
          'QTI map_response scoring was detected. Verify the resulting PIE model preserves intended partial-credit behavior.',
      });
    }
  }

  if (hasMapping) {
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
  profileRuntime: ProfileRuntimeResult,
  warnings?: TransformWarning[]
): TransformOutput {
  return {
    ...output,
    items: output.items.map(item =>
      item.format === 'pie' && isPieItem(item.content)
        ? { ...item, content: makePieItemPlayerReady(item.content) }
        : item
    ),
    metadata: {
      ...output.metadata,
      ...metadataFromProfileRuntime(profileRuntime),
      conversionTrace: finalizeTrace(trace, profileRuntime),
    } as any,
    warnings: mergeWarnings(output.warnings, warnings),
  };
}

function isPieItem(value: unknown): value is PieItem {
  return typeof value === 'object' && value !== null && 'config' in value;
}

function metadataFromProfileRuntime(
  profileRuntime: ProfileRuntimeResult
): Pick<TransformOutput['metadata'], 'sourceProfiles'> & {
  sourceDiagnostics?: SourceProfileExtractionResult['diagnostics'];
  standardCandidates?: SourceProfileExtractionResult['standardCandidates'];
  rubricCandidates?: SourceProfileExtractionResult['rubricCandidates'];
  sidecars?: SourceProfileExtractionResult['sidecars'];
} {
  return {
    ...(profileRuntime.matches.length > 0 && { sourceProfiles: profileRuntime.matches }),
    ...(profileRuntime.extraction.diagnostics?.length && {
      sourceDiagnostics: profileRuntime.extraction.diagnostics,
    }),
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
    ...(profileRuntime.extraction.diagnostics?.length && {
      diagnostics: profileRuntime.extraction.diagnostics,
    }),
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

function sourceDiagnosticToWarning(
  diagnostic: NonNullable<SourceProfileExtractionResult['diagnostics']>[number]
): TransformWarning {
  return {
    itemId: diagnostic.itemId,
    code: diagnostic.code,
    message: diagnostic.message,
  };
}

function shortHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function mergeWarnings(
  outputWarnings: TransformWarning[] | undefined,
  accumulatedWarnings: TransformWarning[] | undefined
): TransformWarning[] | undefined {
  const merged = [...(outputWarnings ?? []), ...(accumulatedWarnings ?? [])];
  return merged.length > 0 ? merged : undefined;
}
