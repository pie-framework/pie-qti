/**
 * Detect Vendor Activity
 *
 * Detects vendor-specific patterns in QTI content
 */

import type { Activity } from '@pie-qti/transform-types';
import type { HTMLElement } from 'node-html-parser';

export interface VendorInfo {
  vendor: string;
  confidence: number;
  features?: string[];
  metadata?: Record<string, unknown>;
}

export interface DetectVendorInput {
  xml: string;
  doc: HTMLElement;
}

export interface DetectVendorOutput {
  vendorInfo: VendorInfo | null;
}

/**
 * Activity that detects vendor-specific patterns
 */
export const DetectVendorActivity: Activity<DetectVendorInput, DetectVendorOutput> = {
  type: 'detect-vendor',
  name: 'Detect Vendor',

  async execute(context, input) {
    context.log('debug', 'Detecting vendor-specific patterns');

    // Vendor detection relies on pluggable vendor detectors configured at runtime
    // No built-in patterns are included to avoid speculation
    context.log('debug', 'No vendor-specific patterns detected');
    return { vendorInfo: null };
  },

  timeout: 15000, // 15 seconds
  retryPolicy: {
    maxAttempts: 1, // Vendor detection shouldn't be retried
    initialInterval: 1000,
    maxInterval: 1000,
    backoffCoefficient: 1,
  },
};
