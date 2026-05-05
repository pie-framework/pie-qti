/**
 * Transform Item Workflow
 *
 * Orchestrates the transformation of a single QTI item to PIE format
 */

import type { WorkflowDefinition, TransformFormat, TransformPlugin, TransformContext, StorageBackend } from '@pie-qti/transform-types';
import {
  DetectFormatActivity,
  DetectVendorActivity,
  ParseXmlActivity,
  ReadContentActivity,
  TransformQtiToPieActivity,
  ValidateQtiActivity,
  WriteContentActivity,
} from '../activities/index.js';

export interface TransformItemInput {
  /** Source content (XML string or URI to read from) */
  content: string;
  /** Item identifier */
  itemId: string;
  /** Source format (if known, otherwise will be detected) */
  sourceFormat?: TransformFormat;
  /** Target format */
  targetFormat: TransformFormat;
  /** Transform plugin to use */
  plugin: TransformPlugin;
  /** Transform context */
  context: TransformContext;
  /** Storage backend (if content is a URI) */
  storage?: StorageBackend;
  /** Output URI (if content should be written) */
  outputUri?: string;
  /** Skip validation */
  skipValidation?: boolean;
}

export interface TransformItemOutput {
  /** Transformed PIE configuration */
  pieConfig: unknown;
  /** Warnings from transformation */
  warnings: unknown[];
  /** Validation errors (if any) */
  errors: string[];
  /** Transformation metadata */
  metadata: {
    sourceFormat: TransformFormat;
    targetFormat: TransformFormat;
    itemId: string;
    timestamp: Date;
    processingTime: number;
    vendorDetected?: string;
  };
}

/**
 * Workflow for transforming a single QTI item to PIE
 *
 * Steps:
 * 1. Read content (if URI provided)
 * 2. Detect format (if not provided)
 * 3. Validate QTI (optional)
 * 4. Parse XML
 * 5. Detect vendor
 * 6. Transform QTI to PIE
 * 7. Write output (if outputUri provided)
 */
export const TransformItemWorkflow: WorkflowDefinition<TransformItemInput, TransformItemOutput> = {
  type: 'transform-item',
  version: '1.0',
  name: 'Transform QTI Item to PIE',

  async execute(ctx, input) {
    const startTime = ctx.now();
    ctx.log('info', `Starting transformation workflow for item: ${input.itemId}`);

    ctx.reportProgress({
      currentStep: 'initialization',
      completedSteps: 0,
      totalSteps: input.skipValidation ? 6 : 7,
      percentage: 0,
      message: 'Initializing transformation',
    });

    // Step 1: Read content if URI provided
    let xml = input.content;
    if (input.storage && input.content.startsWith('storage://')) {
      ctx.reportProgress({
        currentStep: 'read-content',
        completedSteps: 0,
        totalSteps: input.skipValidation ? 6 : 7,
        percentage: 0,
        message: 'Reading content from storage',
      });

      const readResult = await ctx.executeActivity(ReadContentActivity, {
        uri: input.content,
        storage: input.storage,
      });
      xml = readResult.content;
    }

    // Step 2: Detect format if not provided
    const sourceFormat = input.sourceFormat || (await ctx.executeActivity(DetectFormatActivity, {
      content: xml,
    })).format;

    ctx.log('info', `Source format: ${sourceFormat}`);

    // Step 3: Validate QTI (optional)
    const errors: string[] = [];
    if (!input.skipValidation && sourceFormat.startsWith('qti')) {
      ctx.reportProgress({
        currentStep: 'validate-qti',
        completedSteps: 1,
        totalSteps: 7,
        percentage: 14,
        message: 'Validating QTI content',
      });

      const validation = await ctx.executeActivity(ValidateQtiActivity, { xml });
      if (!validation.valid) {
        errors.push(...validation.errors);
        ctx.log('warn', `Validation found ${validation.errors.length} errors`);
      }
    }

    // Step 4: Parse XML
    ctx.reportProgress({
      currentStep: 'parse-xml',
      completedSteps: input.skipValidation ? 1 : 2,
      totalSteps: input.skipValidation ? 6 : 7,
      percentage: input.skipValidation ? 17 : 29,
      message: 'Parsing XML',
    });

    const { doc } = await ctx.executeActivity(ParseXmlActivity, { xml });

    // Step 5: Detect vendor
    ctx.reportProgress({
      currentStep: 'detect-vendor',
      completedSteps: input.skipValidation ? 2 : 3,
      totalSteps: input.skipValidation ? 6 : 7,
      percentage: input.skipValidation ? 33 : 43,
      message: 'Detecting vendor',
    });

    const { vendorInfo } = await ctx.executeActivity(DetectVendorActivity, { xml, doc });

    // Step 6: Transform QTI to PIE
    ctx.reportProgress({
      currentStep: 'transform',
      completedSteps: input.skipValidation ? 3 : 4,
      totalSteps: input.skipValidation ? 6 : 7,
      percentage: input.skipValidation ? 50 : 57,
      message: 'Transforming to PIE',
    });

    const { pieConfig, warnings } = await ctx.executeActivity(TransformQtiToPieActivity, {
      xml,
      itemId: input.itemId,
      sourceFormat,
      vendorInfo,
      plugin: input.plugin,
      context: input.context,
    });

    // Step 7: Write output (if outputUri provided)
    if (input.outputUri && input.storage) {
      ctx.reportProgress({
        currentStep: 'write-output',
        completedSteps: input.skipValidation ? 4 : 5,
        totalSteps: input.skipValidation ? 6 : 7,
        percentage: input.skipValidation ? 67 : 71,
        message: 'Writing output',
      });

      await ctx.executeActivity(WriteContentActivity, {
        uri: input.outputUri,
        content: JSON.stringify(pieConfig, null, 2),
        storage: input.storage,
      });
    }

    // Complete
    ctx.reportProgress({
      currentStep: 'complete',
      completedSteps: input.skipValidation ? 6 : 7,
      totalSteps: input.skipValidation ? 6 : 7,
      percentage: 100,
      message: 'Transformation complete',
    });

    const endTime = ctx.now();
    const processingTime = endTime.getTime() - startTime.getTime();

    ctx.log('info', `Transformation complete in ${processingTime}ms`);

    return {
      pieConfig,
      warnings,
      errors,
      metadata: {
        sourceFormat,
        targetFormat: input.targetFormat,
        itemId: input.itemId,
        timestamp: endTime,
        processingTime,
        vendorDetected: vendorInfo?.vendor,
      },
    };
  },

  timeout: {
    workflowTimeout: 300000, // 5 minutes
    activityTimeout: 120000, // 2 minutes
  },
};
