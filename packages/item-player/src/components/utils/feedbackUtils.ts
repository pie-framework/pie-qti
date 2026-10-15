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

import { isShownByIdentifier } from '@pie-qti/qti-common';

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
 * Shows or hides each `feedbackInline` (`qti-feedback-inline` in QTI 3) by the shared visibility
 * rule: its `identifier` against the outcome value, by membership for a container, inverted by
 * `showHide="hide"`. Nested feedback resolves inside shown feedback; hidden feedback drops with
 * everything inside it. Markup outside feedback elements is left as it is.
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
	if (!html) return html;
	const feedback = feedbackElements(html);
	if (feedback.length === 0) return html;

	const { outcomeValues, applyHeuristics = false, wrapWithSpan = false, transforms } = options;
	const render = (start: number, end: number, elements: readonly FeedbackElement[]): string => {
		let out = '';
		let position = start;
		for (const element of elements) {
			out += html.slice(position, element.openStart);
			position = element.closeEnd;
			const outcomeId = feedbackInlineAttr(element.attrs, 'outcomeIdentifier');
			const feedbackId = feedbackInlineAttr(element.attrs, 'identifier');
			if (outcomeId === null || feedbackId === null) continue;
			const showHide = feedbackInlineAttr(element.attrs, 'showHide');
			if (!isShownByIdentifier(outcomeValues[outcomeId], feedbackId, showHide)) continue;

			let content = render(element.openEnd, element.closeStart, element.children);
			if (applyHeuristics) content = cleanFeedbackText(content, transforms);
			out += wrapWithSpan ? ` <span class="qti-feedback-inline">${content}</span>` : content;
		}
		return out + html.slice(position, end);
	};
	return render(0, html.length, feedback);
}

const FEEDBACK_TAG = /<(\/?)(?:feedbackInline|qti-feedback-inline)\b([^>]*?)(\/?)>/gi;

interface FeedbackElement {
	readonly attrs: string;
	readonly openStart: number;
	readonly openEnd: number;
	closeStart: number;
	closeEnd: number;
	readonly children: FeedbackElement[];
}

/** The top-level feedback elements in `html`, each with the feedback nested inside it. */
function feedbackElements(html: string): FeedbackElement[] {
	const roots: FeedbackElement[] = [];
	const open: FeedbackElement[] = [];
	const add = (element: FeedbackElement) => (open[open.length - 1]?.children ?? roots).push(element);
	for (const match of html.matchAll(FEEDBACK_TAG)) {
		const [tag, closing, attrs = '', selfClosing] = match;
		const start = match.index;
		const end = start + tag.length;
		if (closing) {
			const element = open.pop();
			if (!element) continue;
			element.closeStart = start;
			element.closeEnd = end;
			add(element);
		} else {
			const element: FeedbackElement = { attrs, openStart: start, openEnd: end, closeStart: end, closeEnd: end, children: [] };
			if (selfClosing) add(element);
			else open.push(element);
		}
	}
	// An unclosed element is left as written, with any feedback inside it.
	return roots;
}

/** An attribute in either QTI spelling, e.g. `outcomeIdentifier` or `outcome-identifier`. */
function feedbackInlineAttr(attrs: string, name: string): string | null {
	const kebab = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
	for (const spelling of kebab === name ? [name] : [name, kebab]) {
		const match = new RegExp(`(?:^|\\s)${spelling}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
		if (match) return match[1] ?? match[2] ?? '';
	}
	return null;
}
