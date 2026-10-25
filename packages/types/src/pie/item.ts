/**
 * PIE Item Type Definitions
 *
 * Core types for PIE assessment items as pure TypeScript interfaces.
 */

/** A JSON value */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Host-owned key/value pairs on PIE content. Keys are opaque and case-sensitive; PIE defines none,
 * and a PIE round trip through QTI keeps every key, value type and array order.
 */
export type ContentExtensions = Record<string, JsonValue>;

/**
 * PIE Item - root structure for an assessment item
 */
export interface PieItem {
  /** Original item ID from source system */
  id: string;

  /** Base/stable identifier for QTI (preferred for QTI identifier attribute) */
  baseId?: string;

  /** Unique UUID for this item */
  uuid: string;

  /** Item configuration including models and elements */
  config: PieItemConfig;

  /**
   * Optional transform metadata
   * Plugins can add custom metadata fields here
   */
  metadata?: Record<string, any>;

  /** Host-owned key/value pairs that PIE carries and never interprets */
  extensions?: ContentExtensions;

  /** Collection IDs this item belongs to */
  collectionIds?: string[];

  /** Related content (passages, stimuli) */
  relatedContent?: PieRelatedContent;

  /**
   * Optional passage reference (string ID or full object)
   * Used for items with external passage dependencies
   */
  passage?: string | PiePassageStimulus;
}

/**
 * PIE Item Configuration
 */
export interface PieItemConfig {
  /** Configuration ID (usually same as item UUID) */
  id: string;

  /** Array of models (item model, rubric model, etc.) */
  models: PieModel[];

  /** Element versions used in this item */
  elements: Record<string, string>;

  /** Markup containing the PIE custom element tags referenced by the models. */
  markup?: string;

  /** Optional resources (vendor-specific) */
  resources?: any;
}

/**
 * Base model interface
 * Allows additional properties for different element types
 */
export interface PieModel {
  /** Model ID */
  id: string;

  /** Element type (e.g., '@pie-element/multiple-choice') */
  element?: string;

  /** Allow additional properties for different PIE elements */
  [key: string]: any;
}

/**
 * Related content (passages, stimuli)
 */
export interface PieRelatedContent {
  stimulus?: PiePassageStimulus;
}

/**
 * Passage/Stimulus
 */
export interface PiePassageStimulus {
  id: string;
  /** Base/stable identifier for QTI (preferred for QTI identifier attribute) */
  baseId?: string;
  /** External system identifier */
  externalId?: string;
  config: PiePassageConfig;
  /** Host-owned key/value pairs that PIE carries and never interprets */
  extensions?: ContentExtensions;
}

/**
 * Passage configuration
 */
export interface PiePassageConfig {
  id: string;
  models: PiePassageModel[];
}

/**
 * Passage model
 */
export interface PiePassageModel {
  id: string;
  passages: PiePassage[];
}

/**
 * Individual passage
 */
export interface PiePassage {
  title?: string;
  text?: string;
}
