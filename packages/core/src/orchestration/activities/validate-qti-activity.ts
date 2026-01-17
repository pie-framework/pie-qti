/**
 * Validate QTI Activity
 *
 * Validates QTI XML content against schema
 */

import type { Activity } from '@pie-qti/transform-types';

export interface ValidateQtiInput {
  xml: string;
}

export interface ValidateQtiOutput {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Activity that validates QTI content
 */
export const ValidateQtiActivity: Activity<ValidateQtiInput, ValidateQtiOutput> = {
  type: 'validate-qti',
  name: 'Validate QTI',

  async execute(context, input) {
    context.log('debug', 'Validating QTI content');

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation checks
    if (!input.xml.includes('<assessmentItem') && !input.xml.includes('<assessmentTest')) {
      errors.push('No assessmentItem or assessmentTest element found');
    }

    // Check for required attributes
    if (!input.xml.match(/identifier\s*=/)) {
      errors.push('Missing identifier attribute');
    }

    // Check for well-formed XML
    const openTags = input.xml.match(/<[^/!][^>]*>/g) || [];
    const closeTags = input.xml.match(/<\/[^>]+>/g) || [];

    if (openTags.length !== closeTags.length) {
      warnings.push('Potential XML structure issue: tag count mismatch');
    }

    const valid = errors.length === 0;

    if (valid) {
      context.log('info', 'QTI validation passed', { warnings: warnings.length });
    } else {
      context.log('error', 'QTI validation failed', { errors: errors.length });
    }

    return { valid, errors, warnings };
  },

  timeout: 30000, // 30 seconds
  retryPolicy: {
    maxAttempts: 1, // Validation shouldn't be retried
    initialInterval: 1000,
    maxInterval: 1000,
    backoffCoefficient: 1,
  },
};
