/**
 * Standard QTI gapMatchInteraction extractor
 *
 * Extracts data from gapMatchInteraction elements (drag words into gaps)
 */

import type { ElementExtractor } from '../types.js';

/**
 * Gap match data extracted from gapMatchInteraction elements
 */
export interface GapMatchData {
	gapTexts: Array<{
		identifier: string;
		text: string;
		matchMax: number;
		matchMin?: number;
		classes?: string[];
	}>;
	gaps: string[];
	shuffle: boolean;
	prompt: string | null;
	promptText: string;
}

/**
 * Standard QTI gap match interaction extractor
 * Handles gapMatchInteraction elements (drag words into gaps in text)
 */
export const standardGapMatchExtractor: ElementExtractor<GapMatchData> = {
	id: 'qti:gap-match-interaction',
	name: 'QTI Standard Gap Match Interaction',
	priority: 10,
	elementTypes: ['gapMatchInteraction'],
	description: 'Extracts standard QTI gapMatchInteraction (drag words into gaps)',

	canHandle(element, _context) {
		// All gapMatchInteraction elements are standard
		return element.rawTagName === 'gapMatchInteraction';
	},

	extract(element, context) {
		const { utils } = context;

		// Extract gapText children (draggable items)
		const gapTextElements = utils.getChildrenByTag(element, 'gapText');
		const gapTexts = gapTextElements.map((gapText) => {
			const classes = utils.getClasses(gapText);
			const matchMax = utils.getNumberAttribute(gapText, 'matchMax', 1);
			const matchMin = utils.getNumberAttribute(gapText, 'matchMin', 0);

			return {
				identifier: utils.getAttribute(gapText, 'identifier', ''),
				text: utils.getTextContent(gapText),
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				...(classes.length > 0 ? { classes } : {}),
			};
		});

		// Extract prompt (optional) and process gap placeholders.
		// NOTE: Many QTI items place `<gap>` elements in the interaction content (e.g. a `<p>`/`<blockquote>`)
		// rather than inside a `<prompt>` element. Support both patterns.
		const promptElements = utils.getChildrenByTag(element, 'prompt');
		let prompt: string | null = null;
		let promptText = '';
		const gaps: string[] = [];

		if (promptElements.length > 0) {
			const promptElement = promptElements[0];
			prompt = utils.getHtmlContent(promptElement);

			// Get the raw HTML content and extract gaps
			const promptHtml = promptElement.outerHTML || promptElement.toString();

			// Extract gap elements from prompt
			const gapElements = utils.getChildrenByTag(promptElement, 'gap');
			for (const gap of gapElements) {
				gaps.push(utils.getAttribute(gap, 'identifier', ''));
			}

			// Replace gap elements with placeholders in the text
			promptText = promptHtml
				.replace(/<prompt[^>]*>/, '')
				.replace(/<\/prompt>/, '')
				.replace(/<gap\s+identifier="([^"]+)"[^>]*>/g, '[GAP:$1]')
				.replace(/<gap\s+identifier='([^']+)'[^>]*>/g, '[GAP:$1]')
				.replace(/<\/gap>/g, '')
				.trim();
		} else {
			// No <prompt> element: derive promptText from the interaction content excluding <gapText> blocks.
			const interactionHtml = element.outerHTML || element.toString();

			// Extract gap identifiers from anywhere in the interaction body.
			const gapIdMatches = Array.from(
				interactionHtml.matchAll(/<gap\s+identifier=(?:"([^"]+)"|'([^']+)')[^>]*\/?>/g)
			);
			for (const m of gapIdMatches) {
				const id = (m[1] || m[2] || '').trim();
				if (id) gaps.push(id);
			}

			promptText = interactionHtml
				.replace(/<gapMatchInteraction[^>]*>/, '')
				.replace(/<\/gapMatchInteraction>/, '')
				// Remove draggable palette entries (gapText)
				.replace(/<gapText[\s\S]*?<\/gapText>/g, '')
				// Replace gap tags with placeholders
				.replace(/<gap\s+identifier="([^"]+)"[^>]*\/?>/g, '[GAP:$1]')
				.replace(/<gap\s+identifier='([^']+)'[^>]*\/?>/g, '[GAP:$1]')
				.replace(/<\/gap>/g, '')
				.trim();
		}

		// Extract attributes
		const shuffle = utils.getBooleanAttribute(element, 'shuffle');

		return {
			gapTexts,
			gaps,
			shuffle,
			prompt,
			promptText,
		};
	},

	validate(data) {
		const errors: string[] = [];

		// Validate gapTexts exist
		if (!data.gapTexts || data.gapTexts.length === 0) {
			errors.push('gapMatchInteraction must have at least one gapText');
		}

		// Validate gaps exist
		if (!data.gaps || data.gaps.length === 0) {
			errors.push('gapMatchInteraction must have at least one gap in the prompt');
		}

		// Validate gapText identifiers
		if (data.gapTexts) {
			const identifiers = new Set<string>();
			for (const gapText of data.gapTexts) {
				if (!gapText.identifier) {
					errors.push('All gapTexts must have an identifier');
				} else if (identifiers.has(gapText.identifier)) {
					errors.push(`Duplicate gapText identifier: ${gapText.identifier}`);
				} else {
					identifiers.add(gapText.identifier);
				}

				// Validate matchMax
				if (gapText.matchMax < 0) {
					errors.push(`matchMax must be non-negative for gapText ${gapText.identifier}`);
				}
			}
		}

		// Validate gap identifiers
		if (data.gaps) {
			const identifiers = new Set<string>();
			for (const gap of data.gaps) {
				if (!gap) {
					errors.push('All gaps must have an identifier');
				} else if (identifiers.has(gap)) {
					errors.push(`Duplicate gap identifier: ${gap}`);
				} else {
					identifiers.add(gap);
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
		};
	},
};
