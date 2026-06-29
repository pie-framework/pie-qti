/**
 * Transform QTI to PIE Activity
 *
 * Core transformation activity that converts QTI content to PIE format
 */

import type { Activity, TransformPlugin, TransformInput, TransformContext, TransformFormat, TransformMetadata } from '@pie-qti/transform-types';
import type { VendorInfo } from './detect-vendor-activity.js';

export interface TransformQtiToPieInput {
  xml: string;
  itemId: string;
  sourceFormat: TransformFormat;
  vendorInfo: VendorInfo | null;
  plugin: TransformPlugin;
  context: TransformContext;
}

export interface TransformQtiToPieOutput {
  pieConfig: unknown;
  warnings: unknown[];
  metadata: TransformMetadata;
}

/**
 * Activity that performs the core QTI to PIE transformation
 */
export const TransformQtiToPieActivity: Activity<TransformQtiToPieInput, TransformQtiToPieOutput> = {
  type: 'transform-qti-to-pie',
  name: 'Transform QTI to PIE',

  async execute(context, input) {
    context.log('info', `Transforming item: ${input.itemId}`);

    // Send heartbeat for long-running transformations
    const heartbeatInterval = setInterval(() => {
      context.heartbeat({ itemId: input.itemId });
    }, 5000);

    try {
      const transformInput: TransformInput = {
        content: input.xml,
        format: input.sourceFormat,
      };

      const result = await input.plugin.transform(transformInput, input.context);

      context.log('info', `Transformation complete: ${result.items.length} items produced`);

      return {
        pieConfig: result.items.length === 1 ? result.items[0] : result.items,
        warnings: result.warnings || [],
        metadata: result.metadata,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      context.log('error', `Transformation failed: ${errorMsg}`);
      throw error;
    } finally {
      clearInterval(heartbeatInterval);
    }
  },

  timeout: 120000, // 2 minutes
  retryPolicy: {
    maxAttempts: 3,
    initialInterval: 2000,
    maxInterval: 30000,
    backoffCoefficient: 2,
    nonRetryableErrors: ['ValidationError', 'ParseError'],
  },
};
