/**
 * Type definitions for storage layer
 */

export interface Session {
  id: string;
  created: Date;
  status: SessionStatus;
  packages: PackageInfo[];
  analysis?: AnalysisResult;
  transformation?: TransformationResult;
}

export type SessionStatus =
  | 'uploading'
  | 'analyzing'
  | 'ready'
  | 'transforming'
  | 'complete'
  | 'error';

export interface PackageInfo {
  id: string;
  name: string;
  type: 'zip' | 'directory';
  size: number;
  path: string; // Relative to session dir
  originalName: string;
}

export interface AnalysisResult {
  sessionId: string;
  timestamp: Date;
  packages: PackageAnalysis[];
  totalItems: number;
  totalPassages: number;
  totalTests: number;
  allInteractionTypes: Record<string, number> | Map<string, number>;
  issues: string[];
}

export interface PackageAnalysis {
  packagePath: string;
  packageName: string;
  hasManifest: boolean;
  itemCount: number;
  passageCount: number;
  testCount: number;
  interactionTypes: Record<string, number>;
  passagePatterns: {
    inline: number;
    object: number;
    standalone: number;
    manifestDependency: number;
  };
  issues: string[];
  samples: {
    interactions: Record<string, string[]>;
    passages: string[];
    tests: string[];
  };
}

export interface ItemInfo {
  id: string;
  title?: string;
  filePath: string;
  interactions: string[];
  hasPassage: boolean;
  mediaRefs: string[];
}

export interface AssessmentInfo {
  id: string;
  title?: string;
  filePath: string;
  itemCount: number;
}

export interface PassageInfo {
  id: string;
  title?: string;
  filePath: string;
  type: 'inline' | 'standalone' | 'external';
}

export interface Issue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  context?: string;
  filePath?: string;
}

export interface ParsedManifest {
  identifier: string;
  title?: string;
  items: ManifestItem[];
  passages: ManifestPassage[];
  tests: ManifestTest[];
  resources: Map<string, ManifestResource>;
}

export interface ManifestItem {
  identifier: string;
  href: string;
  title?: string;
  dependencies: string[];
}

export interface ManifestPassage {
  identifier: string;
  href: string;
  title?: string;
}

export interface ManifestTest {
  identifier: string;
  href: string;
  title?: string;
}

export interface ManifestResource {
  identifier: string;
  type: string;
  href: string;
  dependencies: string[];
}

export interface TransformationResult {
  sessionId: string;
  status: 'success' | 'partial' | 'failed';
  startTime: Date;
  endTime: Date;
  duration: number;
  packages: PackageTransformResult[];
  summary: TransformationSummary;
}

export interface TransformationSummary {
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  totalAssessments: number;
  successfulAssessments: number;
  totalPassages: number;
  successfulPassages: number;
}

export interface PackageTransformResult {
  packageName: string;
  items: TransformedItem[];
  errors: TransformError[];
}

export interface TransformedItem {
  sourceId: string;
  sourcePath: string;
  outputPath: string;
  type: 'item' | 'assessment' | 'passage';
  success: boolean;
  error?: string;
  warnings: Warning[];
  metadata: TransformMetadata;
}

export interface TransformMetadata {
  interactions: string[];
  pieElements: string[];
}

export interface TransformError {
  file: string;
  error: string;
  packagePath: string;
}

export interface Warning {
  message: string;
  context?: string;
}

export interface ProgressEvent {
  type: 'analysis' | 'transformation';
  event: string;
  timestamp: number;
  data: unknown;
}

// Analysis progress events
export type AnalysisEvent =
  | { event: 'package_discovered'; data: { name: string; path: string } }
  | { event: 'manifest_found'; data: { hasManifest: boolean } }
  | { event: 'items_discovered'; data: { count: number } }
  | { event: 'interaction_found'; data: { type: string; itemId: string } }
  | { event: 'analysis_complete'; data: AnalysisResult };

// Transformation progress events
export type TransformationEvent =
  | { event: 'batch_start'; data: { totalPackages: number; totalItems: number } }
  | { event: 'package_start'; data: { packageName: string; index: number } }
  | { event: 'item_progress'; data: { itemId: string; status: 'transforming' | 'complete' | 'failed'; progress: number } }
  | { event: 'item_complete'; data: TransformedItem }
  | { event: 'package_complete'; data: PackageTransformResult }
  | { event: 'batch_complete'; data: TransformationResult }
  | { event: 'error'; data: { message: string; context?: unknown } };
