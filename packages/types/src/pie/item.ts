/**
 * PIE Item Type Definitions
 *
 * Core types for PIE assessment items as pure TypeScript interfaces.
 */

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
   * Optional vendor-specific metadata
   * Plugins can add custom metadata fields here (e.g., searchMetaData for Renaissance)
   */
  metadata?: Record<string, any>;

  /**
   * Optional search metadata for item discovery/filtering
   * Used by Renaissance and other vendors for faceted search
   * Common fields: subject, gradeLevel, DOK, standard, tags, difficulty, etc.
   */
  searchMetaData?: Record<string, any>;

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
  searchMetaData?: Record<string, any>;
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
