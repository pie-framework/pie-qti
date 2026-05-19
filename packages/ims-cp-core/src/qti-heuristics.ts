/**
 * QTI Content Heuristics
 *
 * This module contains heuristics for handling non-standard QTI content commonly
 * found in real-world QTI packages from various authoring tools.
 *
 * ⚠️  IMPORTANT: These are NOT part of the QTI specification. They are pragmatic
 * workarounds for content that doesn't strictly follow QTI standards but is
 * commonly encountered in production.
 *
 * All heuristics:
 * - Are OPTIONAL and can be disabled
 * - Log when they are applied (in debug mode)
 * - Will NEVER hide real QTI errors
 * - Will NEVER break valid QTI content
 *
 * @see https://www.imsglobal.org/question/ for QTI specifications
 */

import type { Logger } from '@pie-qti/logger';

/**
 * Configuration for QTI content heuristics
 */
export interface QtiHeuristicsConfig {
	/**
	 * Enable all heuristics (default: true)
	 * Set to false for strict QTI-only processing
	 */
	enabled?: boolean;

	/**
	 * Apply feedback text formatting fixes
	 * Some authoring tools add semicolons after "Correct" and "Incorrect" labels
	 * (default: true when enabled)
	 */
	feedbackTextFormatting?: boolean;

	/**
	 * Apply lenient image path resolution
	 * Try multiple path resolution strategies for images that don't follow
	 * strict relative path conventions (default: true when enabled)
	 */
	lenientImagePaths?: boolean;

	/**
	 * Auto-populate FEEDBACK outcome for simple choice interactions
	 * Some templates only set SCORE but not FEEDBACK, even though feedbackInline
	 * elements reference the FEEDBACK outcome (default: true when enabled)
	 */
	autoPopulateFeedbackOutcome?: boolean;
}

/**
 * Default heuristics configuration
 * Enables common heuristics by default for better real-world compatibility
 */
export const DEFAULT_HEURISTICS_CONFIG: Required<QtiHeuristicsConfig> = {
	enabled: true,
	feedbackTextFormatting: true,
	lenientImagePaths: true,
	autoPopulateFeedbackOutcome: true,
};

/**
 * Strict QTI configuration - disables all heuristics
 */
export const STRICT_QTI_CONFIG: Required<QtiHeuristicsConfig> = {
	enabled: false,
	feedbackTextFormatting: false,
	lenientImagePaths: false,
	autoPopulateFeedbackOutcome: false,
};

/**
 * Merge user config with defaults
 */
export function normalizeHeuristicsConfig(
	config?: QtiHeuristicsConfig
): Required<QtiHeuristicsConfig> {
	if (config?.enabled === false) {
		return STRICT_QTI_CONFIG;
	}

	return {
		enabled: config?.enabled ?? DEFAULT_HEURISTICS_CONFIG.enabled,
		feedbackTextFormatting:
			config?.feedbackTextFormatting ?? DEFAULT_HEURISTICS_CONFIG.feedbackTextFormatting,
		lenientImagePaths:
			config?.lenientImagePaths ?? DEFAULT_HEURISTICS_CONFIG.lenientImagePaths,
		autoPopulateFeedbackOutcome:
			config?.autoPopulateFeedbackOutcome ??
			DEFAULT_HEURISTICS_CONFIG.autoPopulateFeedbackOutcome,
	};
}

/**
 * Text replacement pattern for vendor-specific formatting
 */
export interface TextTransform {
	/** Regular expression to match */
	pattern: RegExp;
	/** Replacement string */
	replacement: string;
	/** Description of what this fixes */
	description: string;
	/** Which vendor/authoring tool produces this pattern (if known) */
	vendor?: string;
}

/**
 * Vendor-specific feedback text transforms
 *
 * These fix formatting issues in feedback text from certain authoring tools:
 * - Some tools add semicolons after "Correct" and "Incorrect" labels
 * - This is not required by QTI and looks awkward in display
 */
export const FEEDBACK_TEXT_TRANSFORMS: TextTransform[] = [
	{
		pattern: /<strong>Incorrect;<\/strong>/gi,
		replacement: '<strong>Incorrect</strong> ',
		description: 'Remove semicolon after "Incorrect" in strong tags',
		vendor: 'Various authoring tools',
	},
	{
		pattern: /Incorrect;/gi,
		replacement: 'Incorrect ',
		description: 'Remove semicolon after "Incorrect"',
		vendor: 'Various authoring tools',
	},
	{
		pattern: /<strong>Correct;<\/strong>/gi,
		replacement: '<strong>Correct</strong> ',
		description: 'Remove semicolon after "Correct" in strong tags',
		vendor: 'Various authoring tools',
	},
	{
		pattern: /Correct;/gi,
		replacement: 'Correct ',
		description: 'Remove semicolon after "Correct"',
		vendor: 'Various authoring tools',
	},
];

/**
 * Apply feedback text formatting heuristics
 *
 * @param content - HTML content to transform
 * @param config - Heuristics configuration
 * @param logger - Optional logger for debug output
 * @returns Transformed content
 */
export function applyFeedbackTextHeuristics(
	content: string,
	config: Required<QtiHeuristicsConfig>,
	logger?: Logger
): string {
	if (!config.enabled || !config.feedbackTextFormatting || !content) {
		return content;
	}

	let result = content;
	let appliedCount = 0;

	for (const transform of FEEDBACK_TEXT_TRANSFORMS) {
		const before = result;
		result = result.replace(transform.pattern, transform.replacement);

		if (result !== before) {
			appliedCount++;
			logger?.debug(
				`[QTI Heuristic] Applied feedback text transform: ${transform.description}`,
				{ vendor: transform.vendor }
			);
		}
	}

	if (appliedCount > 0) {
		logger?.debug(
			`[QTI Heuristic] Applied ${appliedCount} feedback text formatting fix(es). ` +
				`This content uses non-standard formatting common in certain authoring tools.`
		);
	}

	return result;
}

/**
 * Check if lenient image path resolution should be used
 *
 * @param config - Heuristics configuration
 * @param logger - Optional logger
 * @returns True if lenient resolution is enabled
 */
export function shouldUseLenientImagePaths(
	config: Required<QtiHeuristicsConfig>,
	logger?: Logger
): boolean {
	const enabled = config.enabled && config.lenientImagePaths;

	if (enabled) {
		logger?.debug(
			'[QTI Heuristic] Using lenient image path resolution. ' +
				'Will try multiple path strategies for images that do not follow strict relative path conventions.'
		);
	}

	return enabled;
}

/**
 * Check if auto-populating FEEDBACK outcome should be used
 *
 * @param config - Heuristics configuration
 * @param logger - Optional logger
 * @returns True if auto-population is enabled
 */
export function shouldAutoPopulateFeedbackOutcome(
	config: Required<QtiHeuristicsConfig>,
	logger?: Logger
): boolean {
	const enabled = config.enabled && config.autoPopulateFeedbackOutcome;

	if (enabled) {
		logger?.debug(
			'[QTI Heuristic] Will auto-populate FEEDBACK outcome if missing. ' +
				'Some QTI templates use feedbackInline but only set SCORE outcome.'
		);
	}

	return enabled;
}
