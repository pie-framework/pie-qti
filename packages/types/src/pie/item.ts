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
 * A standard or skill the content is aligned to: QTI 3 Curriculum Standards Metadata 1.1, one
 * entry per `labelledGUID`. `providerId` + `guid` is the key; GUIDs compare case-insensitively.
 * Mirrors `CurriculumStandard` in `@pie-players/pie-players-shared/types`.
 */
export interface CurriculumStandard {
  /** CSM `curriculumStandardsMetadata@providerId`: who issued `guid`, e.g. "AB", "CASE". */
  providerId: string;
  /** CSM `labelledGUID/GUID`, as the provider issued it. */
  guid: string;
  /** CSM `labelledGUID/caseItemURI`, for a CASE framework item. */
  caseItemURI?: string;
  /** CSM `labelledGUID/label`: a display code, never a key. */
  label?: string;
  /** LOM classification purpose. Absent means "educational objective". */
  purpose?: 'educational objective' | 'prerequisite' | (string & {});
  // PIE extensions; QTI 3 has no equivalent.
  /** The entry the alignment is reported under; at most one per `providerId`. */
  primary?: boolean;
  provenance?: 'authored' | 'derived' | 'imported';
  /** The alignment this one was derived from. */
  derivedFrom?: { providerId: string; guid: string };
}

/**
 * A cognitive-complexity classification: LOM classification purpose "skill level".
 * Mirrors `SkillLevel` in `@pie-players/pie-players-shared/types`.
 */
export interface SkillLevel {
  /** LOM `taxonPath/source`: "webb-dok", "blooms-revised", "blooms-original", or a host taxonomy. */
  source: string;
  /** LOM `taxon/id`: "1".."4" for webb-dok; "remember".."create" for blooms-revised. */
  id: string;
  /** Why the level was assigned. A PIE extension. */
  rationale?: string;
}

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

  /**
   * Standards and skills the content is aligned to. Absent means no data; `[]` means the writer
   * states that none applies.
   */
  curriculumStandards?: CurriculumStandard[];

  /** DOK and Bloom's classifications, on the same terms. */
  skillLevels?: SkillLevel[];

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

  /**
   * Standards and skills the content is aligned to. Absent means no data; `[]` means the writer
   * states that none applies.
   */
  curriculumStandards?: CurriculumStandard[];

  /** DOK and Bloom's classifications, on the same terms. */
  skillLevels?: SkillLevel[];
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
