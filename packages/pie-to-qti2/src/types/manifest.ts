/**
 * IMS Content Package Manifest Types
 *
 * Types for generating imsmanifest.xml files according to IMS CP specification
 */

/**
 * IMS Content Package manifest structure
 */
export interface ImsManifest {
  /** Unique identifier for the manifest */
  identifier: string;

  /** Metadata about the package */
  metadata?: ManifestMetadata;

  /** Organizations (structural navigation) */
  organizations?: Organizations;

  /** Resources (files and dependencies) */
  resources: Resource[];

  /** Schema version */
  schemaVersion?: string;
}

/**
 * Manifest metadata
 */
export interface ManifestMetadata {
  /** Schema name (e.g., "IMS Content", "QTI") */
  schema?: string;

  /** Schema version */
  schemaVersion?: string;

  /** Custom metadata fields */
  [key: string]: any;
}

/**
 * Organizations structure (optional navigation)
 */
export interface Organizations {
  /** Default organization identifier */
  default?: string;

  /** List of organizations */
  organization?: Organization[];
}

/**
 * Organization (table of contents)
 */
export interface Organization {
  /** Organization identifier */
  identifier: string;

  /** Organization title */
  title?: string;

  /** Items in the organization */
  items: OrganizationItem[];
}

/**
 * Organization item (navigation node)
 */
export interface OrganizationItem {
  /** Item identifier */
  identifier: string;

  /** Item title */
  title: string;

  /** Reference to resource */
  identifierref?: string;

  /** Child items */
  items?: OrganizationItem[];
}

/**
 * Resource declaration
 */
export interface Resource {
  /** Resource identifier (must be unique within manifest) */
  identifier: string;

  /** Resource type (e.g., "imsqti_item_xmlv2p2", "imsqti_assessment_xmlv2p2") */
  type: string;

  /** Main file href */
  href: string;

  /** Resource metadata */
  metadata?: Record<string, any>;

  /** File entries */
  files?: ResourceFile[];

  /** Dependencies on other resources */
  dependencies?: ResourceDependency[];
}

/**
 * Resource file entry
 */
export interface ResourceFile {
  /** File path relative to package root */
  href: string;
}

/**
 * Resource dependency
 */
export interface ResourceDependency {
  /** Identifier of the resource this depends on */
  identifierref: string;
}

/**
 * Options for manifest generation
 */
export interface ManifestGenerationOptions {
  /** Package identifier (defaults to generated UUID) */
  packageId?: string;

  /** Package title */
  title?: string;

  /** Include organizations section (navigation structure) */
  includeOrganizations?: boolean;

  /** Schema version for manifest */
  schemaVersion?: string;

  /** Custom metadata to include */
  metadata?: Record<string, any>;

  /** Base path for resources (default: empty string) */
  basePath?: string;
}

/**
 * Manifest generation input
 */
export interface ManifestInput {
  /** Item resources */
  items: ItemResource[];

  /** Passage resources */
  passages?: PassageResource[];

  /** Assessment resources (QTI assessmentTest) */
  assessments?: AssessmentResource[];

  /** Generation options */
  options?: ManifestGenerationOptions;
}

/**
 * Item resource for manifest
 */
export interface ItemResource {
  /** Item identifier */
  id: string;

  /** File path */
  filePath: string;

  /** Resource type (defaults to "imsqti_item_xmlv2p2") */
  type?: string;

  /** Dependencies (passage IDs) */
  dependencies?: string[];

  /** Additional files (images, stylesheets, etc.) */
  files?: string[];

  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Passage resource for manifest
 */
export interface PassageResource {
  /** Passage identifier */
  id: string;

  /** File path */
  filePath: string;

  /** Resource type (defaults to "imsqti_item_xmlv2p2") */
  type?: string;

  /** Additional files */
  files?: string[];

  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Assessment resource for manifest (QTI assessmentTest)
 */
export interface AssessmentResource {
  /** Assessment identifier */
  id: string;

  /** File path */
  filePath: string;

  /** Resource type (defaults to "imsqti_assessment_xmlv2p2") */
  type?: string;

  /** Dependencies (item IDs referenced by the assessment) */
  dependencies?: string[];

  /** Additional files */
  files?: string[];

  /** Metadata */
  metadata?: Record<string, any>;
}
