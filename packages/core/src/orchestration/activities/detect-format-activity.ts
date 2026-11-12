/**
 * Detect Format Activity
 *
 * Detects the format of content (QTI 2.2, PIE, etc.)
 */

import { detectQtiVersion } from '@pie-qti/qti-common/version-detection';
import type { Activity, TransformFormat } from '@pie-qti/transform-types';

export interface DetectFormatInput {
  content: string | object;
}

export interface DetectFormatOutput {
  format: TransformFormat;
  confidence: number;
}

/**
 * Activity that detects content format
 */
export const DetectFormatActivity: Activity<DetectFormatInput, DetectFormatOutput> = {
  type: 'detect-format',
  name: 'Detect Format',

  async execute(context, input) {
    context.log('debug', 'Detecting content format');

    const content = typeof input.content === 'string' ? input.content : JSON.stringify(input.content);

    // Check for PIE format (JSON-based) first: the narrowest signal.
    if (typeof input.content === 'object' || content.trim().startsWith('{')) {
      try {
        const obj = typeof input.content === 'object' ? input.content : JSON.parse(content);
        if (
          obj &&
          typeof obj === 'object' &&
          'id' in obj &&
          'element' in obj
        ) {
          context.log('info', 'Detected PIE format');
          return { format: 'pie', confidence: 0.9 };
        }
      } catch {
        // Not valid JSON, continue
      }
    }

    // QTI version detection is delegated to the canonical detector in qti-common, which checks
    // the namespace before element names. A QTI 3.0 item also contains camelCase
    // `<assessmentItem` markup vocabulary, so an element-name sniff alone misreads it as QTI 2.2.
    const version = detectQtiVersion(content);
    if (version === '3.0') {
      context.log('info', 'Detected QTI 3.0 format');
      return { format: 'qti30', confidence: 0.9 };
    }
    if (version === '2.0' || version === '2.1' || version === '2.2') {
      context.log('info', 'Detected QTI 2.x format');
      return { format: 'qti22', confidence: 0.9 };
    }

    throw new Error('Unable to detect content format');
  },

  timeout: 10000, // 10 seconds
  retryPolicy: {
    maxAttempts: 1, // Format detection shouldn't be retried
    initialInterval: 1000,
    maxInterval: 1000,
    backoffCoefficient: 1,
  },
};
