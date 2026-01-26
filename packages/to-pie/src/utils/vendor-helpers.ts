/**
 * Vendor Helper Utilities
 *
 * Generic utilities for working with vendor-specific QTI content.
 * These are framework-level utilities that vendor packages can use.
 */

import type { HTMLElement } from 'node-html-parser';
import type { CustomAttributes, VendorClasses } from '../types/vendor-extensions.js';

/**
 * Extract and categorize CSS classes from an element
 *
 * This is a generic implementation that provides basic categorization.
 * Vendor packages should register their own CssClassExtractor for
 * vendor-specific categorization logic.
 *
 * @param element - HTML element to extract classes from
 * @returns Categorized CSS classes
 */
export function extractCssClasses(element: HTMLElement): VendorClasses {
  const classes = element.getAttribute('class')?.split(/\s+/).filter(Boolean) || [];

  const vendorClasses: VendorClasses = {
    behavioral: [],
    styling: [],
    semantic: [],
    unknown: [],
  };

  for (const cls of classes) {
    // Generic heuristics for categorization
    // Vendor packages should provide their own logic via CssClassExtractor

    // Common behavioral patterns
    if (
      cls.includes('disabled') ||
      cls.includes('readonly') ||
      cls.includes('required') ||
      cls.includes('hidden') ||
      cls.includes('labels-') ||
      cls.includes('input-') ||
      cls.includes('choice-')
    ) {
      vendorClasses.behavioral.push(cls);
    }
    // Common styling patterns
    else if (
      cls.includes('color') ||
      cls.includes('size') ||
      cls.includes('align') ||
      cls.includes('font') ||
      cls.includes('bg-') ||
      cls.includes('text-') ||
      cls.includes('border')
    ) {
      vendorClasses.styling.push(cls);
    }
    // Common semantic patterns
    else if (
      cls.includes('question') ||
      cls.includes('answer') ||
      cls.includes('prompt') ||
      cls.includes('stimulus') ||
      cls.includes('feedback')
    ) {
      vendorClasses.semantic.push(cls);
    }
    // Unknown - vendor-specific logic needed
    else {
      vendorClasses.unknown.push(cls);
    }
  }

  return vendorClasses;
}

/**
 * Extract custom attributes from an element
 *
 * Extracts standard, vendor-specific, and data-* attributes separately
 * for easier processing by vendor transformers.
 *
 * @param element - HTML element to extract attributes from
 * @param vendorPrefix - Optional vendor prefix to identify vendor attributes (e.g., 'amplify-', 'mcgraw-')
 * @returns Categorized custom attributes
 */
export function extractCustomAttributes(
  element: HTMLElement,
  vendorPrefix?: string
): CustomAttributes {
  const attrs = element.attributes || {};

  const customAttributes: CustomAttributes = {
    standard: {},
    vendor: {},
    data: {},
  };

  // Standard QTI attributes that should be preserved
  const standardQtiAttributes = new Set([
    'identifier',
    'responseIdentifier',
    'cardinality',
    'baseType',
    'shuffle',
    'maxChoices',
    'minChoices',
    'orientation',
    'expectedLength',
    'patternMask',
    'placeholderText',
    'class',
    'id',
    'lang',
    'label',
    'title',
    'style',
  ]);

  for (const [key, value] of Object.entries(attrs)) {
    // Skip xmlns and other namespace attributes
    if (key.startsWith('xmlns')) {
      continue;
    }

    // Data attributes
    if (key.startsWith('data-')) {
      const dataKey = key.replace('data-', '');
      // Try to parse as JSON for boolean/number values
      try {
        customAttributes.data[dataKey] = JSON.parse(value);
      } catch {
        customAttributes.data[dataKey] = value;
      }
    }
    // Vendor-specific attributes
    else if (vendorPrefix && key.startsWith(vendorPrefix)) {
      const vendorKey = key.replace(vendorPrefix, '');
      try {
        customAttributes.vendor[vendorKey] = JSON.parse(value);
      } catch {
        customAttributes.vendor[vendorKey] = value;
      }
    }
    // Standard QTI attributes
    else if (standardQtiAttributes.has(key)) {
      customAttributes.standard[key] = value;
    }
    // Unknown attributes - treat as vendor-specific
    else {
      customAttributes.vendor[key] = value;
    }
  }

  return customAttributes;
}

/**
 * Preserve vendor CSS classes in PIE model
 *
 * Stores vendor classes in PIE model for round-trip preservation
 *
 * @param pieModel - PIE model to add classes to
 * @param vendorClasses - Categorized vendor classes
 */
export function preserveVendorClasses(
  pieModel: any,
  vendorClasses: VendorClasses
): void {
  // Only preserve if there are classes to preserve
  const hasClasses =
    vendorClasses.behavioral.length > 0 ||
    vendorClasses.styling.length > 0 ||
    vendorClasses.semantic.length > 0 ||
    vendorClasses.unknown.length > 0;

  if (!hasClasses) {
    return;
  }

  // Store in PIE model metadata
  if (!pieModel.metadata) {
    pieModel.metadata = {};
  }

  pieModel.metadata.vendorClasses = vendorClasses;
}

/**
 * Preserve vendor attributes in PIE model
 *
 * Stores vendor attributes in PIE model for round-trip preservation
 *
 * @param pieModel - PIE model to add attributes to
 * @param customAttributes - Categorized custom attributes
 */
export function preserveVendorAttributes(
  pieModel: any,
  customAttributes: CustomAttributes
): void {
  // Only preserve if there are vendor/data attributes
  const hasVendorData =
    Object.keys(customAttributes.vendor).length > 0 ||
    Object.keys(customAttributes.data).length > 0;

  if (!hasVendorData) {
    return;
  }

  // Store in PIE model metadata
  if (!pieModel.metadata) {
    pieModel.metadata = {};
  }

  if (Object.keys(customAttributes.vendor).length > 0) {
    pieModel.metadata.vendorAttributes = customAttributes.vendor;
  }

  if (Object.keys(customAttributes.data).length > 0) {
    pieModel.metadata.dataAttributes = customAttributes.data;
  }
}

/**
 * Apply behavioral CSS classes to PIE model configuration
 *
 * Attempts to map behavioral CSS classes to PIE configuration options.
 * This is a generic implementation - vendor packages should provide
 * their own mapping logic.
 *
 * @param pieModel - PIE model to configure
 * @param behavioralClasses - Behavioral CSS classes
 */
export function applyBehavioralClasses(
  pieModel: any,
  behavioralClasses: string[]
): void {
  if (behavioralClasses.length === 0) {
    return;
  }

  // Generic mappings - vendor packages should override
  for (const cls of behavioralClasses) {
    // Labels display
    if (cls.includes('labels-none')) {
      pieModel.choiceMode = 'radio'; // Hide labels
    } else if (cls.includes('labels-letters')) {
      pieModel.choiceMode = 'radio'; // Letter labels
    }

    // Input size
    if (cls.includes('input-small')) {
      pieModel.inputSize = 'small';
    } else if (cls.includes('input-medium')) {
      pieModel.inputSize = 'medium';
    } else if (cls.includes('input-large')) {
      pieModel.inputSize = 'large';
    }

    // Shuffle
    if (cls.includes('shuffle')) {
      pieModel.shuffle = true;
    }

    // Orientation
    if (cls.includes('vertical')) {
      pieModel.choicesPosition = 'below';
    } else if (cls.includes('horizontal')) {
      pieModel.choicesPosition = 'right';
    }
  }
}
