/**
 * Batch Transform Workflow
 *
 * Orchestrates batch transformation of multiple QTI items to PIE format
 */

import type { WorkflowDefinition, TransformFormat, TransformPlugin, TransformContext, StorageBackend } from '@pie-qti/transform-types';
import { TransformItemWorkflow, type TransformItemInput, type TransformItemOutput } from './transform-item-workflow.js';

export interface BatchTransformInput {
  /** List of items to transform */
  items: Array<{
    itemId: string;
    contentUri: string;
    outputUri?: string;
  }>;
  /** Source format (if known for all items) */
  sourceFormat?: TransformFormat;
  /** Target format */
  targetFormat: TransformFormat;
  /** Transform plugin to use */
  plugin: TransformPlugin;
  /** Transform context */
  context: TransformContext;
  /** Storage backend */
  storage: StorageBackend;
  /** Skip validation */
  skipValidation?: boolean;
  /** Maximum concurrent transformations */
  maxConcurrent?: number;
}

export interface BatchTransformOutput {
  /** Successfully transformed items */
  successful: Array<{
    itemId: string;
    result: TransformItemOutput;
  }>;
  /** Failed items */
  failed: Array<{
    itemId: string;
    error: string;
  }>;
  /** Batch metadata */
  metadata: {
    totalItems: number;
    successCount: number;
    failureCount: number;
    startTime: Date;
    endTime: Date;
    totalProcessingTime: number;
  };
}

/**
 * Workflow for batch transformation of multiple items
 *
 * This workflow executes TransformItemWorkflow for each item,
 * with controlled concurrency and error handling
 */
export const BatchTransformWorkflow: WorkflowDefinition<BatchTransformInput, BatchTransformOutput> = {
  type: 'batch-transform',
  version: '1.0',
  name: 'Batch Transform QTI Items to PIE',

  async execute(ctx, input) {
    const startTime = ctx.now();
    const maxConcurrent = input.maxConcurrent || 5;

    ctx.log('info', `Starting batch transformation of ${input.items.length} items (concurrency: ${maxConcurrent})`);

    const successful: Array<{ itemId: string; result: TransformItemOutput }> = [];
    const failed: Array<{ itemId: string; error: string }> = [];

    // Process items in chunks for controlled concurrency
    const chunks: Array<typeof input.items> = [];
    for (let i = 0; i < input.items.length; i += maxConcurrent) {
      chunks.push(input.items.slice(i, i + maxConcurrent));
    }

    let completedItems = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      ctx.log('debug', `Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} items)`);

      // Execute all items in chunk concurrently
      const chunkResults = await Promise.allSettled(
        chunk.map(async (item) => {
          const transformInput: TransformItemInput = {
            content: item.contentUri,
            itemId: item.itemId,
            sourceFormat: input.sourceFormat,
            targetFormat: input.targetFormat,
            plugin: input.plugin,
            context: input.context,
            storage: input.storage,
            outputUri: item.outputUri,
            skipValidation: input.skipValidation,
          };

          // Execute the transform item workflow as a child workflow
          // In InMemoryOrchestrator, this is just a direct call
          // In TemporalOrchestrator, this would be executeChildWorkflow
          return TransformItemWorkflow.execute(ctx, transformInput);
        })
      );

      // Process results
      for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        const item = chunk[i];

        if (result.status === 'fulfilled') {
          successful.push({
            itemId: item.itemId,
            result: result.value,
          });
          ctx.log('info', `Item ${item.itemId} transformed successfully`);
        } else {
          failed.push({
            itemId: item.itemId,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
          ctx.log('error', `Item ${item.itemId} transformation failed: ${result.reason}`);
        }

        completedItems++;

        // Report progress
        ctx.reportProgress({
          currentStep: `Processing item ${completedItems}/${input.items.length}`,
          completedSteps: completedItems,
          totalSteps: input.items.length,
          percentage: Math.floor((completedItems / input.items.length) * 100),
          message: `${completedItems}/${input.items.length} items processed (${successful.length} successful, ${failed.length} failed)`,
        });
      }
    }

    const endTime = ctx.now();
    const totalProcessingTime = endTime.getTime() - startTime.getTime();

    ctx.log('info', `Batch transformation complete: ${successful.length} successful, ${failed.length} failed in ${totalProcessingTime}ms`);

    return {
      successful,
      failed,
      metadata: {
        totalItems: input.items.length,
        successCount: successful.length,
        failureCount: failed.length,
        startTime,
        endTime,
        totalProcessingTime,
      },
    };
  },

  timeout: {
    workflowTimeout: 3600000, // 1 hour for batch processing
    activityTimeout: 300000, // 5 minutes per activity
  },
};
