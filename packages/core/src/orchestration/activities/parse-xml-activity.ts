/**
 * Parse XML Activity
 *
 * Parses QTI XML content into a DOM structure
 */

import type { Activity } from '@pie-qti/transform-types';
import { parse, HTMLElement } from 'node-html-parser';

export interface ParseXmlInput {
  xml: string;
}

export interface ParseXmlOutput {
  doc: HTMLElement;
}

/**
 * Activity that parses XML content
 */
export const ParseXmlActivity: Activity<ParseXmlInput, ParseXmlOutput> = {
  type: 'parse-xml',
  name: 'Parse XML',

  async execute(context, input) {
    context.log('debug', 'Parsing XML content', { xmlLength: input.xml.length });

    try {
      const doc = parse(input.xml, {
        lowerCaseTagName: false,
        comment: false,
      });

      context.log('debug', 'XML parsed successfully');
      return { doc };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      context.log('error', 'Failed to parse XML', { error: errorMsg });
      throw new Error(`XML parsing failed: ${errorMsg}`);
    }
  },

  timeout: 30000, // 30 seconds
  retryPolicy: {
    maxAttempts: 1, // XML parsing shouldn't be retried
    initialInterval: 1000,
    maxInterval: 1000,
    backoffCoefficient: 1,
  },
};
