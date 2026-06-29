/**
 * Feedback text utilities for QTI items
 *
 * NOTE: The cleanFeedbackText function contains vendor-specific transforms
 * for content that uses semicolons after "Correct" and "Incorrect" labels.
 * This is common in some QTI authoring tools but not part of the QTI specification.
 *
 * To customize this behavior for your vendor's content, you can:
 * 1. Modify the patterns in this file
 * 2. Create a vendor-specific transform plugin (see VENDOR-TRANSFORM-PLUGIN-GUIDE.md)
 * 3. Pass custom transforms via the feedbackTransforms option
 */

/**
 * Text pattern replacement for feedback content
 */
export interface FeedbackTransform {
	/** Regular expression to match the pattern */
	pattern: RegExp;
	/** Replacement string (can use capture groups like $1, $2) */
	replacement: string;
}

/**
 * Default feedback text transforms
 * These are vendor-specific patterns commonly found in certain QTI authoring tools
 */
export const DEFAULT_FEEDBACK_TRANSFORMS: FeedbackTransform[] = [
	// Remove semicolons after "Incorrect" (with or without <strong> tags)
	{ pattern: /<strong>Incorrect;<\/strong>/gi, replacement: '<strong>Incorrect</strong> ' },
	{ pattern: /Incorrect;/gi, replacement: 'Incorrect ' },

	// Remove semicolons after "Correct" (with or without <strong> tags)
	{ pattern: /<strong>Correct;<\/strong>/gi, replacement: '<strong>Correct</strong> ' },
	{ pattern: /Correct;/gi, replacement: 'Correct ' },
];

/**
 * Clean up feedback text formatting using configurable transforms
 *
 * @param content - The feedback content HTML string
 * @param transforms - Optional custom transforms (defaults to DEFAULT_FEEDBACK_TRANSFORMS)
 * @returns Cleaned feedback content
 */
export function cleanFeedbackText(
	content: string,
	transforms: FeedbackTransform[] = DEFAULT_FEEDBACK_TRANSFORMS
): string {
	if (!content) return content;

	let result = content;
	for (const transform of transforms) {
		result = result.replace(transform.pattern, transform.replacement);
	}

	return result;
}

/**
 * Default outcome identifier for feedback display
 * This can be overridden if your QTI content uses a different identifier
 */
export const DEFAULT_FEEDBACK_OUTCOME_ID = 'FEEDBACK';

/**
 * Options for processing feedbackInline elements
 */
export interface ProcessFeedbackInlineOptions {
	/** Outcome values from response processing */
	outcomeValues: Record<string, any>;
	/** Whether to apply feedback text cleaning heuristics */
	applyHeuristics?: boolean;
	/** Whether to wrap feedback content with qti-feedback-inline span */
	wrapWithSpan?: boolean;
	/** Custom feedback transforms (defaults to DEFAULT_FEEDBACK_TRANSFORMS) */
	transforms?: FeedbackTransform[];
}

/**
 * Process feedbackInline elements in QTI content
 *
 * Conditionally shows/hides feedback based on outcome values and the showHide attribute.
 * Optionally applies text cleaning heuristics and wraps content with styling span.
 *
 * @param html - The HTML content containing feedbackInline elements
 * @param options - Processing options
 * @returns Modified HTML with processed feedbackInline elements
 *
 * @example
 * ```typescript
 * const html = processFeedbackInline(content, {
 *   outcomeValues: { FEEDBACK: 'choiceA' },
 *   applyHeuristics: true,
 *   wrapWithSpan: true
 * });
 * ```
 */
export function processFeedbackInline(
	html: string,
	options: ProcessFeedbackInlineOptions
): string {
	const { outcomeValues, applyHeuristics = false, wrapWithSpan = false, transforms } = options;

	if (!html) return html;

	return html.replace(
		/<feedbackInline\b([^>]*)>([\s\S]*?)<\/feedbackInline>/gi,
		(_match, attrs, content) => {
			const outcomeId = feedbackInlineAttr(attrs, 'outcomeIdentifier');
			const feedbackId = feedbackInlineAttr(attrs, 'identifier');
			const showHide = feedbackInlineAttr(attrs, 'showHide') ?? 'show';
			const outcomeValue = outcomeId ? outcomeValues[outcomeId] : undefined;

			// If outcome value is not set (undefined, null, empty string), hide feedback
			if (
				outcomeId === null ||
				feedbackId === null ||
				outcomeValue === undefined ||
				outcomeValue === null ||
				outcomeValue === ''
			) {
				return '';
			}

			// Determine if feedback should be shown based on showHide attribute
			const matchesFeedback = Array.isArray(outcomeValue)
				? outcomeValue.includes(feedbackId)
				: outcomeValue === feedbackId;
			const shouldShow =
				showHide.toLowerCase() === 'show' ? matchesFeedback : !matchesFeedback;

			if (!shouldShow) return '';

			// Apply text cleaning heuristics if enabled
			if (applyHeuristics) {
				content = cleanFeedbackText(content, transforms);
			}

			// Wrap with styling span if enabled
			if (wrapWithSpan) {
				return ` <span class="qti-feedback-inline">${content}</span>`;
			}

			return content;
		}
	);
}

function feedbackInlineAttr(attrs: string, name: string): string | null {
	const match =
		new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs) ??
		new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, 'i').exec(attrs);
	return match?.[1] ?? null;
}
