/**
 * PIE to QTI 2.2 Plugin
 *
 * Transforms PIE assessment items to QTI 2.2 format with lossless round-trip support
 */

import type {PieItem, PieModel, 
  TransformContext,
  TransformInput,
  TransformOutput,
  TransformPlugin
} from '@pie-framework/transform-types';
import { generateManifest } from './generators/manifest-generator.js';
import {
  generatePassageFile,
  generatePassageFromStimulus,
  insertPassageObjectReference,
} from './generators/passage-generator.js';
import { defaultRegistry, GeneratorRegistry } from './generators/registry.js';
import type { PieToQtiGenerator } from './generators/types.js';
import type { ManifestInput } from './types/manifest.js';
import type { GeneratedPassageFile, PassageResolver, PassageStrategy } from './types/passages.js';
import { embedPieExtension } from './utils/index.js';
import { detectPassages } from './utils/passage-detection.js';
// Import to trigger auto-registration of built-in generators
import './generators/index.js';

/**
 * Plugin configuration options
 */
export interface PieToQti2PluginOptions {
  /**
   * Custom generator registry to use
   * If not provided, uses the default registry with built-in generators
   */
  registry?: GeneratorRegistry;

  /**
   * Passage resolution callback for external passage references
   *
   * When PIE items have a `passage` property with a string reference,
   * this resolver is called to load the passage content.
   *
   * @example
   * ```typescript
   * const plugin = new PieToQti2Plugin({
   *   passageResolver: async (passageId) => {
   *     const passage = await db.passages.findById(passageId);
   *     return {
   *       id: passage.id,
   *       title: passage.title,
   *       content: passage.htmlContent
   *     };
   *   }
   * });
   * ```
   */
  passageResolver?: PassageResolver;

  /**
   * Passage output strategy
   * - 'inline': Embed passages in item XML (default for Phase 1)
   * - 'external': Generate separate passage files (Phase 2)
   *
   * If not specified, strategy is auto-detected:
   * - Items with `passage` property → 'external'
   * - Items with passages in config.models[] → 'inline'
   */
  passageStrategy?: PassageStrategy;

  /**
   * Enable package generation (Phase 2)
   * When true, generates IMS Content Package with manifest
   */
  generatePackage?: boolean;
}

/**
 * PIE to QTI 2.2 transformation plugin
 */
export class PieToQti2Plugin implements TransformPlugin {
  readonly id = 'pie-to-qti2';
  readonly version = '1.0.0';
  readonly name = 'PIE to QTI 2.2';
  readonly sourceFormat = 'pie' as const;
  readonly targetFormat = 'qti22' as const;

  private registry: GeneratorRegistry;
  private passageResolver?: PassageResolver;
  private passageStrategy?: PassageStrategy;
  private generatePackage: boolean;

  /**
   * Create a new plugin instance
   *
   * @param options - Configuration options
   */
  constructor(options: PieToQti2PluginOptions = {}) {
    // Use provided registry or default
    this.registry = options.registry || defaultRegistry;
    this.passageResolver = options.passageResolver;
    this.passageStrategy = options.passageStrategy;
    this.generatePackage = options.generatePackage || false;
  }

  /**
   * Get the generator registry (for adding custom generators)
   */
  getRegistry(): GeneratorRegistry {
    return this.registry;
  }

  /**
   * Register a custom generator
   *
   * @param generator - The generator to register
   * @param priority - Priority for this generator (higher = preferred)
   * @param override - Whether to override existing generator for same type
   */
  registerGenerator(
    generator: PieToQtiGenerator,
    priority: number = 0,
    override: boolean = false
  ): void {
    this.registry.register({ generator, priority, override });
  }

  async canHandle(input: TransformInput): Promise<boolean> {
    // Check if input is PIE format
    if (typeof input.content === 'object') {
      const pieContent = input.content as any;
      // PIE items have config.models or models array
      // PIE assessments have sections array
      return !!(pieContent.config?.models || pieContent.models || pieContent.sections);
    }
    return false;
  }

  async transform(input: TransformInput, context: TransformContext): Promise<TransformOutput> {
    const startTime = Date.now();
    const logger = context.logger;

    logger?.info('Starting PIE to QTI 2.2 transformation');

    const pieContent = input.content as any;

    // Check if this is an assessment (has sections) rather than an item
    if (pieContent.sections && Array.isArray(pieContent.sections)) {
      logger?.info('Detected PIE assessment - transforming to QTI assessmentTest');
      return this.transformAssessment(pieContent, startTime, logger);
    }

    const pieItem = pieContent as PieItem;

    // Check for embedded QTI source first for lossless round-trip
    if (hasQtiSource(pieItem)) {
      logger?.info('Detected embedded QTI source - using lossless reconstruction');
      return this.reconstructFromQtiSource(pieItem, startTime, logger);
    }

    // Extract ALL models (multi-model support)
    const models = pieItem.config?.models || (pieItem as any).models || [];
    if (models.length === 0) {
      throw new Error('PIE item has no models');
    }

    logger?.info(`Processing ${models.length} model(s) in PIE item`);

    // Detect passage configuration (Phase 2: external passage support)
    const passageDetection = detectPassages(pieItem);

    // Resolve external passages if needed
    const generatedPassageFiles: GeneratedPassageFile[] = [];
    if (passageDetection.externalPassage && typeof pieItem.passage === 'string') {
      // External passage reference requires resolution
      if (!this.passageResolver) {
        throw new Error(
          `Item "${pieItem.id}" has external passage reference "${pieItem.passage}" ` +
          `but no passageResolver was provided. Please configure passageResolver in plugin options.`
        );
      }

      logger?.info(`Resolving external passage: ${passageDetection.externalPassage.id}`);
      const resolvedPassage = await this.passageResolver(passageDetection.externalPassage.id);

      // Generate passage file
      const passageFile = generatePassageFile(resolvedPassage, {
        basePath: 'passages',
        metadata: resolvedPassage.metadata,
      });
      generatedPassageFiles.push(passageFile);

      logger?.info(`Generated external passage file: ${passageFile.filePath}`);
    } else if (passageDetection.externalPassage?.stimulus) {
      // Full passage object provided
      logger?.info('Using provided passage stimulus object');
      const passageFile = generatePassageFromStimulus(passageDetection.externalPassage.stimulus);
      generatedPassageFiles.push(passageFile);
    }

    // Determine passage strategy
    const effectiveStrategy = this.passageStrategy || passageDetection.recommendedStrategy;

    // Categorize models by type for multi-model support
    const passages = models.filter(m => m.element === '@pie-element/passage');
    const rubrics = models.filter(m =>
      m.element === '@pie-element/rubric' ||
      m.element === '@pie-element/complex-rubric'
    );
    const interactions = models.filter(m =>
      !passages.includes(m) && !rubrics.includes(m)
    );

    if (interactions.length === 0) {
      throw new Error('PIE item has no interaction models');
    }

    // For Phase 1: Process primary interaction (single-interaction support)
    // Phase 2 will support multiple interactions
    const primaryModel = interactions[0];
    const elementType = primaryModel.element || 'unknown';

    if (interactions.length > 1) {
      logger?.warn(
        `Item has ${interactions.length} interactions - only processing first one. ` +
        `Multiple interactions per item will be supported in a future release.`
      );
    }

    logger?.info(`Primary interaction type: ${elementType}`);

    // Find appropriate generator for primary interaction
    const generator = this.registry.findGenerator(primaryModel);

    if (!generator) {
      throw new Error(
        `No generator found for PIE element type: ${elementType}. ` +
        `Registered types: ${this.registry.getRegisteredTypes().join(', ')}`
      );
    }

    logger?.info(`Using generator: ${generator.name} v${generator.version}`);

    // Generate QTI using the generator with multi-model context
    const generatorContext = {
      pieItem,
      model: primaryModel,
      logger,
      // Multi-model context for generators to use
      allModels: models,
      passages,
      rubrics,
      interactions,
    };

    const result = await Promise.resolve(generator.generate(generatorContext));

    // Combine multi-model content into single QTI item
    let qtiXml = result.qti;

    // Handle passages based on strategy
    if (effectiveStrategy === 'external' && generatedPassageFiles.length > 0) {
      // Phase 2: External passages with object references
      logger?.info(`Using external passage strategy - ${generatedPassageFiles.length} passage file(s)`);
      for (const passageFile of generatedPassageFiles) {
        qtiXml = insertPassageObjectReference(qtiXml, passageFile.id, passageFile.filePath, logger);
      }
    } else if (passages.length > 0) {
      // Phase 1: Inline passages embedded in itemBody
      logger?.info(`Using inline passage strategy - ${passages.length} passage(s)`);
      qtiXml = this.inlinePassages(qtiXml, passages, logger);
    }

    // Add rubrics (future: will be added to QTI item)
    if (rubrics.length > 0) {
      logger?.info(`Note: ${rubrics.length} rubric(s) detected but not yet implemented`);
    }

    // Log warnings if any
    const allWarnings = result.metadata?.warnings || [];
    for (const warning of allWarnings) {
      logger?.warn(warning);
    }

    // Add searchMetaData to QTI (Phase 1: metadata preservation)
    qtiXml = this.addSearchMetadata(qtiXml, pieItem, logger);

    // Embed PIE sourceModel for lossless round-trip
    const qtiWithExtension = embedPieExtension(qtiXml, pieItem, {
      generator: {
        package: '@pie-qti/pie-to-qti2',
        version: this.version,
      },
      elementType,
      timestamp: new Date(),
    });

    const processingTime = Date.now() - startTime;

    // Build transform output
    const output: TransformOutput = {
      items: [{ content: qtiWithExtension, format: 'qti22' }],
      format: 'qti22',
      metadata: {
        sourceFormat: 'pie',
        targetFormat: 'qti22',
        pluginId: this.id,
        timestamp: new Date(),
        itemCount: 1,
        processingTime,
        generatorId: generator.id,
        generatorVersion: generator.version,
        warnings: allWarnings,
        modelCount: models.length,
        hasPassages: passages.length > 0 || generatedPassageFiles.length > 0,
        hasRubrics: rubrics.length > 0,
        passageStrategy: effectiveStrategy,
        externalPassageCount: generatedPassageFiles.length,
      } as any,
    };

    // Include passage files if generated (Phase 2)
    if (generatedPassageFiles.length > 0) {
      (output as any).passageFiles = generatedPassageFiles;
    }

    // Generate IMS Content Package manifest if requested (Phase 2)
    if (this.generatePackage && generatedPassageFiles.length > 0) {
      logger?.info('Generating IMS Content Package manifest');

      const manifestInput: ManifestInput = {
        items: [
          {
            id: pieItem.baseId || pieItem.id,
            filePath: `items/${pieItem.baseId || pieItem.id}.xml`,
            dependencies: generatedPassageFiles.map(pf => pf.id),
          },
        ],
        passages: generatedPassageFiles.map(pf => ({
          id: pf.id,
          filePath: pf.filePath,
        })),
        options: {
          packageId: `pkg-${pieItem.baseId || pieItem.id}`,
        },
      };

      const manifestXml = generateManifest(manifestInput);
      (output as any).manifest = manifestXml;
      logger?.info('IMS manifest generated successfully');
    }

    return output;
  }

  /**
   * Transform PIE assessment to QTI assessmentTest
   */
  private transformAssessment(assessment: any, startTime: number, logger: any): TransformOutput {
    logger?.info('Transforming PIE assessment to QTI assessmentTest');

    // Dynamically import and use AssessmentGenerator
    const { createAssessmentGenerator } = require('./generators/assessment.js');
    const generator = createAssessmentGenerator();

    if (!generator.canHandle(assessment)) {
      throw new Error('AssessmentGenerator cannot handle this assessment structure');
    }

    const context = {
      pieItem: assessment,
      model: assessment,
      logger,
      allModels: [],
      passages: [],
      rubrics: [],
    };

    const result = generator.generate(context);
    const processingTime = Date.now() - startTime;

    // Build output object
    const output: TransformOutput = {
      items: [
        {
          content: result.qti,
          format: 'qti22' as const,
        },
      ],
      format: 'qti22',
      metadata: {
        sourceFormat: 'pie',
        targetFormat: 'qti22',
        pluginId: this.id,
        timestamp: new Date(),
        itemCount: 1,
        processingTime,
        generatorId: generator.id,
        generatorVersion: generator.version,
        warnings: result.warnings || [],
      } as any,
    };

    // Generate IMS Content Package manifest if requested
    if (this.generatePackage && assessment.sections && Array.isArray(assessment.sections)) {
      logger?.info('Generating IMS Content Package manifest for assessment');

      // Extract item references from all sections
      const allItemRefs: Array<{ id: string; dependencies?: string[] }> = [];
      const allPassageIds = new Set<string>();

      const extractItemsFromSection = (section: any) => {
        // Process direct item references
        if (section.itemRefs && Array.isArray(section.itemRefs)) {
          for (const itemRef of section.itemRefs) {
            // Extract passage dependencies if present
            const dependencies: string[] = [];
            if (itemRef.passageDependencies && Array.isArray(itemRef.passageDependencies)) {
              dependencies.push(...itemRef.passageDependencies);
              itemRef.passageDependencies.forEach((pid: string) => allPassageIds.add(pid));
            }

            allItemRefs.push({
              id: itemRef.identifier,
              dependencies: dependencies.length > 0 ? dependencies : undefined,
            });
          }
        }

        // Recursively process subsections
        if (section.subsections && Array.isArray(section.subsections)) {
          section.subsections.forEach(extractItemsFromSection);
        }
      };

      assessment.sections.forEach(extractItemsFromSection);

      const assessmentId = assessment.id || assessment.identifier || 'assessment';

      const manifestInput: ManifestInput = {
        items: allItemRefs.map(ref => ({
          id: ref.id,
          filePath: `items/${ref.id}.xml`,
          dependencies: ref.dependencies,
        })),
        passages: Array.from(allPassageIds).map(pid => ({
          id: pid,
          filePath: `passages/${pid}.xml`,
        })),
        assessments: [
          {
            id: assessmentId,
            filePath: `assessments/${assessmentId}.xml`,
            dependencies: allItemRefs.map(ref => ref.id),
          },
        ],
        options: {
          packageId: `pkg-${assessmentId}`,
          metadata: {
            title: assessment.title || assessmentId,
            description: assessment.description,
          },
        },
      };

      const manifestXml = generateManifest(manifestInput);
      (output as any).manifest = manifestXml;
      logger?.info('IMS manifest generated successfully for assessment package');
    }

    return output;
  }

  /**
   * Add inline passages to QTI itemBody
   */
  private inlinePassages(qtiXml: string, passages: PieModel[], logger: any): string {
    // Parse QTI to insert passages before interactions
    const itemBodyMatch = qtiXml.match(/(<itemBody>)([\s\S]*?)(<\/itemBody>)/);
    if (!itemBodyMatch) {
      logger?.warn('Could not find itemBody in QTI XML - skipping passage insertion');
      return qtiXml;
    }

    const [, openTag, bodyContent, closeTag] = itemBodyMatch;

    // Generate passage HTML
    const passagesHtml = passages
      .map(passage => {
        const passageId = passage.id || 'passage';
        const passageData = passage.passages || [];

        // Extract passage content
        let content = '';
        if (passageData.length > 0) {
          const firstPassage = passageData[0];
          if (firstPassage.title) {
            content += `<h2>${escapeXml(firstPassage.title)}</h2>\n    `;
          }
          if (firstPassage.text) {
            content += firstPassage.text; // Already HTML
          }
        }

        return `<div class="stimulus" data-pie-passage-id="${escapeXml(passageId)}">\n    ${content}\n  </div>`;
      })
      .join('\n  ');

    // Insert passages at the start of itemBody
    const newBodyContent = `${passagesHtml}\n  ${bodyContent.trim()}`;
    return qtiXml.replace(
      /(<itemBody>)[\s\S]*?(<\/itemBody>)/,
      `${openTag}\n    ${newBodyContent}\n  ${closeTag}`
    );
  }

  /**
   * Add searchMetaData and baseId to QTI XML
   */
  private addSearchMetadata(qtiXml: string, pieItem: PieItem, logger: any): string {
    const searchMetaData = pieItem.searchMetaData || (pieItem.metadata as any)?.searchMetaData;
    const hasSearchMetaData = searchMetaData && Object.keys(searchMetaData).length > 0;
    const hasBaseId = !!pieItem.baseId;

    if (!hasSearchMetaData && !hasBaseId) {
      return qtiXml; // No metadata to add
    }

    logger?.info('Adding metadata to QTI item');

    // Generate qti-metadata-field elements
    const metadataFields: string[] = [];

    // Add baseId for round-trip compatibility
    if (hasBaseId && pieItem.baseId) {
      logger?.info(`Preserving baseId for round-trip: ${pieItem.baseId}`);
      // Add sourceSystemId to identify this as PIE-originated
      metadataFields.push(`<qti-metadata-field name="sourceSystemId" value="pie"/>`);
      // Add externalId (used by qti2-to-pie to restore baseId)
      metadataFields.push(`<qti-metadata-field name="externalId" value="${escapeXml(pieItem.baseId)}"/>`);
    }

    // Add searchMetaData fields
    if (hasSearchMetaData) {
      const searchMetaDataFields = Object.entries(searchMetaData)
        .map(([key, value]) => {
          let valueStr: string;
          let dataType: string | undefined;

          if (Array.isArray(value)) {
            valueStr = value.join(',');
            dataType = 'array';
          } else if (typeof value === 'number') {
            valueStr = String(value);
            dataType = 'number';
          } else {
            valueStr = String(value);
          }

          const dataTypeAttr = dataType ? ` data-type="${dataType}"` : '';
          return `<qti-metadata-field name="${escapeXml(key)}" value="${escapeXml(valueStr)}"${dataTypeAttr}/>`;
        });
      metadataFields.push(...searchMetaDataFields);
    }

    const metadataSection = `<qti-metadata>\n    ${metadataFields.join('\n    ')}\n  </qti-metadata>`;

    // Insert metadata section after assessmentItem opening tag but before itemBody
    const insertAfter = qtiXml.indexOf('<assessmentItem');
    const insertAt = qtiXml.indexOf('>', insertAfter) + 1;

    if (insertAt <= 0) {
      logger?.warn('Could not find assessmentItem tag - skipping metadata insertion');
      return qtiXml;
    }

    return (
      qtiXml.slice(0, insertAt) +
      '\n  ' +
      metadataSection +
      qtiXml.slice(insertAt)
    );
  }

  /**
   * Reconstruct from embedded QTI source (lossless round-trip)
   */
  private reconstructFromQtiSource(
    pieItem: PieItem,
    startTime: number,
    logger: any
  ): TransformOutput {
    const qtiXml = extractQtiSourceFromPie(pieItem);

    if (!qtiXml) {
      throw new Error('hasQtiSource returned true but extractQtiSourceFromPie returned null');
    }

    logger?.info('Successfully reconstructed QTI from embedded source');

    const processingTime = Date.now() - startTime;

    return {
      items: [{ content: qtiXml, format: 'qti22' }],
      format: 'qti22',
      metadata: {
        sourceFormat: 'pie',
        targetFormat: 'qti22',
        pluginId: this.id,
        timestamp: new Date(),
        itemCount: 1,
        processingTime,
        losslessReconstruction: true,
      } as any,
    };
  }
}

/**
 * Extract original QTI XML from PIE item metadata
 */
function extractQtiSourceFromPie(pieItem: PieItem): string | null {
  return pieItem.metadata?.qtiSource?.xml || null;
}

/**
 * Check if PIE item has embedded QTI source
 */
function hasQtiSource(pieItem: PieItem): boolean {
  return !!(pieItem.metadata?.qtiSource?.xml);
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
