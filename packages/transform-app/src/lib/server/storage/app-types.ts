/**
 * Transform app specific type definitions
 * Extends core storage types with app-specific metadata
 */

import type { Session } from '@pie-qti/transform-types';

/**
 * Extended session with app-specific metadata
 */
export interface AppSession extends Session {
	analysis?: AnalysisResult;
	transformation?: TransformationResult;
}

/**
 * Analysis result stored in analysis.json
 */
export interface AnalysisResult {
	sessionId: string;
	timestamp: Date;
	packages: PackageAnalysis[];
	totalItems: number;
	totalPassages: number;
	totalTests: number;
	allInteractionTypes: Record<string, number>;
	issues: string[];
}

/**
 * Package analysis details
 */
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

/**
 * Transformation result stored in transformation.json
 */
export interface TransformationResult {
	sessionId: string;
	status: 'success' | 'partial' | 'failed';
	startTime: Date;
	endTime: Date;
	duration: number;
	packages: PackageTransformResult[];
	summary: TransformationSummary;
	// Flattened views for UI convenience
	items: Array<{
		identifier: string;
		title: string;
		pieConfig: unknown;
		warnings: unknown[];
	}>;
	assessments: Array<{
		identifier: string;
		title: string;
		pieConfig: unknown;
		warnings: unknown[];
	}>;
	errors: Array<{ identifier: string; error: string }>;
}

/**
 * Transformation summary
 */
export interface TransformationSummary {
	totalItems: number;
	successfulItems: number;
	failedItems: number;
	totalAssessments: number;
	successfulAssessments: number;
	totalPassages: number;
	successfulPassages: number;
}

/**
 * Package transformation result
 */
export interface PackageTransformResult {
	packageName: string;
	items: TransformedItem[];
	errors: TransformError[];
}

/**
 * Transformed item details
 */
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

/**
 * Transform metadata
 */
export interface TransformMetadata {
	interactions: string[];
	pieElements: string[];
}

/**
 * Transform error
 */
export interface TransformError {
	file: string;
	error: string;
	packagePath: string;
}

/**
 * Warning message
 */
export interface Warning {
	message: string;
	context?: string;
}

/**
 * Item information
 */
export interface ItemInfo {
	id: string;
	title?: string;
	filePath: string;
	interactions: string[];
	hasPassage: boolean;
	mediaRefs: string[];
}

/**
 * Assessment information
 */
export interface AssessmentInfo {
	id: string;
	title?: string;
	filePath: string;
	itemCount: number;
}

/**
 * Passage information
 */
export interface PassageInfo {
	id: string;
	title?: string;
	filePath: string;
	type: 'inline' | 'standalone' | 'external';
}
