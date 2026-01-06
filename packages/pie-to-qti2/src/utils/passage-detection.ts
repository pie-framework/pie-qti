/**
 * Passage Detection Utilities
 *
 * Detect and categorize passages in PIE items
 */

import type { PieItem, PieModel, PiePassageStimulus } from '@pie-qti/transform-types';
import type { PassageReference, PassageStrategy } from '../types/passages.js';

/**
 * Passage detection result
 */
export interface PassageDetectionResult {
  /** Has any passages? */
  hasPassages: boolean;
  /** Inline passages from config.models[] */
  inlinePassages: PieModel[];
  /** External passage reference from passage property */
  externalPassage?: {
    id: string;
    stimulus?: PiePassageStimulus;
  };
  /** Recommended strategy */
  recommendedStrategy: PassageStrategy;
}

/**
 * Detect passages in a PIE item
 *
 * Checks both:
 * 1. config.models[] for inline @pie-element/passage models
 * 2. passage property for external references
 */
export function detectPassages(pieItem: PieItem): PassageDetectionResult {
  const models = pieItem.config?.models || [];

  // Find inline passage models
  const inlinePassages = models.filter(
    (m) => m.element === '@pie-element/passage'
  );

  // Check for external passage reference
  let externalPassage: { id: string; stimulus?: PiePassageStimulus } | undefined;

  if (pieItem.passage) {
    if (typeof pieItem.passage === 'string') {
      // String reference: passage ID only
      externalPassage = { id: pieItem.passage };
    } else {
      // Full PiePassageStimulus object
      externalPassage = {
        id: pieItem.passage.id || pieItem.passage.externalId || 'passage',
        stimulus: pieItem.passage,
      };
    }
  }

  const hasPassages = inlinePassages.length > 0 || !!externalPassage;

  // Determine recommended strategy
  const recommendedStrategy: PassageStrategy = externalPassage ? 'external' : 'inline';

  return {
    hasPassages,
    inlinePassages,
    externalPassage,
    recommendedStrategy,
  };
}

/**
 * Extract passage IDs from a PIE item
 *
 * Returns all passage IDs (inline and external) for deduplication purposes
 */
export function extractPassageIds(pieItem: PieItem): string[] {
  const detection = detectPassages(pieItem);
  const ids: string[] = [];

  // Add inline passage IDs
  for (const model of detection.inlinePassages) {
    if (model.id) {
      ids.push(model.id);
    }
  }

  // Add external passage ID
  if (detection.externalPassage) {
    ids.push(detection.externalPassage.id);
  }

  return ids;
}

/**
 * Check if PIE item needs external passage resolution
 *
 * Returns true if item has passage property that requires resolver
 */
export function needsPassageResolution(pieItem: PieItem): boolean {
  const detection = detectPassages(pieItem);
  return !!detection.externalPassage && typeof pieItem.passage === 'string';
}

/**
 * Validate passage configuration
 *
 * Ensures PIE item has valid passage setup
 */
export function validatePassageConfiguration(pieItem: PieItem): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const detection = detectPassages(pieItem);

  // Check for conflicting configurations
  if (detection.inlinePassages.length > 0 && detection.externalPassage) {
    errors.push(
      'Item has both inline passages (in config.models[]) and external passage reference (passage property). ' +
      'Use either inline OR external, not both.'
    );
  }

  // Check for invalid inline passages
  for (const model of detection.inlinePassages) {
    if (!model.passages || model.passages.length === 0) {
      errors.push(`Inline passage model "${model.id}" has no passages array or is empty`);
    }
  }

  // Check for external passage with no resolver available
  // (This will be checked at runtime when resolver is needed)

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract passage references from QTI XML
 *
 * Used by qti2-to-pie to detect passage dependencies
 */
export function extractPassageReferencesFromQti(qtiXml: string): PassageReference[] {
  const references: PassageReference[] = [];

  // Look for <object> tags with passage references
  const objectRegex = /<object[^>]+data="([^"]+)"[^>]*>/g;
  let match;
  while ((match = objectRegex.exec(qtiXml)) !== null) {
    const href = match[1];
    // Extract passage ID from href (e.g., "passages/passage-abc.xml" → "passage-abc")
    const idMatch = href.match(/passages\/([^/.]+)/);
    if (idMatch) {
      references.push({
        id: idMatch[1],
        type: 'object',
        href,
      });
    }
  }

  // Look for inline stimulus with data-pie-passage-id
  const stimulusRegex = /<div[^>]+class="stimulus"[^>]+data-pie-passage-id="([^"]+)"/g;
  while ((match = stimulusRegex.exec(qtiXml)) !== null) {
    references.push({
      id: match[1],
      type: 'inline',
    });
  }

  return references;
}
