/**
 * Standard QTI gapMatchInteraction extractor
 *
 * Extracts data from gapMatchInteraction elements (drag words into gaps)
 */

import type { ElementExtractor } from '../../extraction/types.js';

const GAP_ELEMENT_PATTERN = /<(?:qti-gap|gap)(?=[\s/>])([^>]*)\/?>/gi;
const GAP_CLOSE_PATTERN = /<\/(?:qti-gap|gap)>/gi;
const GAP_TEXT_PATTERN = /<(?:qti-gap-text|gapText)\b[\s\S]*?<\/(?:qti-gap-text|gapText)>/gi;
const GAP_MATCH_OPEN_PATTERN = /<(?:qti-gap-match-interaction|gapMatchInteraction)\b[^>]*>/i;
const GAP_MATCH_CLOSE_PATTERN = /<\/(?:qti-gap-match-interaction|gapMatchInteraction)>/i;
const PROMPT_PATTERN = /<(?:qti-prompt|prompt)\b[\s\S]*?<\/(?:qti-prompt|prompt)>/gi;

function extractAttribute(attrs: string, name: string): string {
	const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
	return (match?.[1] ?? match?.[2] ?? '').trim();
}

function promptTextFromInteractionBody(interactionHtml: string): string {
	return interactionHtml
		.replace(GAP_MATCH_OPEN_PATTERN, '')
		.replace(GAP_MATCH_CLOSE_PATTERN, '')
		.replace(PROMPT_PATTERN, '')
		.replace(GAP_TEXT_PATTERN, '')
		.replace(GAP_ELEMENT_PATTERN, (_match, attrs: string) => {
			const id = extractAttribute(attrs, 'identifier');
			return id ? `[GAP:${id}]` : '';
		})
		.replace(GAP_CLOSE_PATTERN, '')
		.trim();
}

/**
 * Gap match data extracted from gapMatchInteraction elements
 */
export interface GapMatchData {
	gapTexts: Array<{
		identifier: string;
		text: string;
		matchMax: number;
		matchMin?: number;
		matchGroup?: string[];
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
			const matchGroupRaw = utils.getAttribute(gapText, 'matchGroup', '');
			const matchGroup = matchGroupRaw.split(/\s+/).filter(Boolean);

			return {
				identifier: utils.getAttribute(gapText, 'identifier', ''),
				text: utils.getTextContent(gapText),
				matchMax,
				...(matchMin > 0 ? { matchMin } : {}),
				...(matchGroup.length > 0 ? { matchGroup } : {}),
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

			// Extract gap elements from prompt children
			const gapElements = utils.getChildrenByTag(promptElement, 'gap');
			for (const gap of gapElements) {
				gaps.push(utils.getAttribute(gap, 'identifier', ''));
			}

			// Replace gap elements with placeholders in the text
			// Derive renderable content only from the already-sanitized prompt. Using
			// outerHTML here would reintroduce event handlers and unsafe URLs that
			// getHtmlContent deliberately removed.
			promptText = prompt
				.replace(GAP_ELEMENT_PATTERN, (_match, attrs: string) => {
					const id = extractAttribute(attrs, 'identifier');
					return id ? `[GAP:${id}]` : '';
				})
				.replace(GAP_CLOSE_PATTERN, '')
				.trim();
		}

		// If gaps were not found inside a <prompt>, search the full interaction body.
		// This handles items where <gap> elements appear in <p>/<blockquote> siblings of <prompt>.
		if (gaps.length === 0) {
			// Keep the fallback on the same sanitization boundary as prompt content.
			const interactionHtml = utils.getHtmlContent(element);
			const gapIdMatches = Array.from(interactionHtml.matchAll(GAP_ELEMENT_PATTERN));
			for (const m of gapIdMatches) {
				const id = extractAttribute(m[1] ?? '', 'identifier');
				if (id) gaps.push(id);
			}

			if (gaps.length > 0 && (!promptText || !promptText.includes('[GAP:'))) {
				// Build promptText from the interaction body when gaps are authored outside the prompt.
				promptText = promptTextFromInteractionBody(interactionHtml);
			}
		}

		// Extract attributes
		const shuffle = utils.getBooleanAttribute(element, 'shuffle');
		const interactionClasses = utils.getClasses(element);
		const choicesContainerWidth = utils.getAttribute(element, 'data-choices-container-width', '') || null;
		const maxSelectionsMessage = utils.getAttribute(element, 'data-max-selections-message', '') || null;
		const minSelectionsMessage = utils.getAttribute(element, 'data-min-selections-message', '') || null;

		return {
			gapTexts,
			gaps,
			shuffle,
			prompt,
			promptText,
			...(interactionClasses.length > 0 ? { interactionClasses } : {}),
			...(choicesContainerWidth ? { choicesContainerWidth } : {}),
			...(maxSelectionsMessage ? { maxSelectionsMessage } : {}),
			...(minSelectionsMessage ? { minSelectionsMessage } : {}),
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
