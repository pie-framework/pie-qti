/**
 * Standard QTI gapMatchInteraction extractor
 *
 * Extracts data from gapMatchInteraction elements (drag words or images into gaps)
 */

import type { ElementExtractor, ExtractionUtils } from '../../extraction/types.js';
import type { DeliveredInteraction, GapMatchInteractionData, QTIElement } from '../../interactions/shared/types.js';
import { maybeShuffle } from '../../core/shuffle.js';
import { normalizeCssPixelLength, normalizePixelDimension } from '../../security/styleValues.js';
import { predatesQti22 } from '../shared/specDefaults.js';

const GAP_ELEMENT_PATTERN = /<(?:qti-gap|gap)(?=[\s/>])([^>]*)\/?>/gi;
const GAP_CLOSE_PATTERN = /<\/(?:qti-gap|gap)>/gi;
const GAP_TEXT_PATTERN = /<(?:qti-gap-text|gapText)\b[\s\S]*?<\/(?:qti-gap-text|gapText)>/gi;
const GAP_IMG_PATTERN = /<(?:qti-gap-img|gapImg)\b[\s\S]*?<\/(?:qti-gap-img|gapImg)>/gi;
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
		.replace(GAP_IMG_PATTERN, '')
		.replace(GAP_ELEMENT_PATTERN, (_match, attrs: string) => {
			const id = extractAttribute(attrs, 'identifier');
			return id ? `[GAP:${id}]` : '';
		})
		.replace(GAP_CLOSE_PATTERN, '')
		.trim();
}

/**
 * An image choice extracted from a gapImg (QTI 2.x) or qti-gap-img (QTI 3.0)
 * element. QTI 2.x wraps the image in an <object data="…" …>fallback alt</object>;
 * QTI 3.0 allows a plain <img src alt> as well.
 */
export interface GapMatchImage {
	identifier: string;
	src: string;
	alt: string;
	matchMax: number;
	matchMin?: number;
	matchGroup?: string[];
	classes?: string[];
	width?: number;
	height?: number;
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
	gapImages: GapMatchImage[];
	gaps: string[];
	/** QTI `maxAssociations`, with the per-version default for an absent attribute; 0 = no cap. */
	maxAssociations: number;
	/** QTI `minAssociations`, the associations a valid response makes; omitted when 0. */
	minAssociations?: number;
	/** Authored `matchGroup` tokens per gap identifier; present only when a gap authors one. */
	gapMatchGroups?: Record<string, string[]>;
	/** Gaps authored `required`, which a valid response must fill; present only when one is. */
	requiredGaps?: string[];
	shuffle: boolean;
	prompt: string | null;
	promptText: string;
}

/**
 * Compile-time proof that what this extractor delivers satisfies the canonical
 * `GapMatchInteractionData` contract: `gaps` are the plain identifiers the
 * pipeline delivers (an object shape here would silently disagree at runtime).
 */
const DELIVERED_MATCHES_CONTRACT: DeliveredInteraction<'gapMatchInteraction', GapMatchData> extends GapMatchInteractionData
	? true
	: false = true;
void DELIVERED_MATCHES_CONTRACT;

/**
 * Extracts one draggable image choice from gapImg/qti-gap-img content.
 */
function extractGapImage(
	gapImg: QTIElement,
	utils: Pick<
		ExtractionUtils,
		'getClasses' | 'getNumberAttribute' | 'getAttribute' | 'getChildrenByTag' | 'getTextContent'
	>,
): GapMatchImage {
	const classes = utils.getClasses(gapImg);
	const matchMax = utils.getNumberAttribute(gapImg, 'matchMax', 1);
	const matchMin = utils.getNumberAttribute(gapImg, 'matchMin', 0);
	const matchGroupRaw = utils.getAttribute(gapImg, 'matchGroup', '');
	const matchGroup = matchGroupRaw.split(/\s+/).filter(Boolean);

	let src = '';
	let alt = '';
	let width: number | undefined;
	let height: number | undefined;

	// QTI 2.x: <gapImg><object data="…" width height>alt text</object></gapImg>
	const objectChildren = utils.getChildrenByTag(gapImg, 'object');
	if (objectChildren.length > 0) {
		const obj = objectChildren[0];
		src = utils.getAttribute(obj, 'data', '');
		alt = utils.getTextContent(obj);
		const w = normalizePixelDimension(utils.getAttribute(obj, 'width', ''));
		const h = normalizePixelDimension(utils.getAttribute(obj, 'height', ''));
		if (w) width = Number(w);
		if (h) height = Number(h);
	}

	// QTI 3.0: <qti-gap-img><img src="…" alt="…" /></qti-gap-img>
	const imgChildren = utils.getChildrenByTag(gapImg, 'img');
	if (imgChildren.length > 0 && !src) {
		const img = imgChildren[0];
		src = utils.getAttribute(img, 'src', '');
		alt = utils.getAttribute(img, 'alt', '');
		const w = normalizePixelDimension(utils.getAttribute(img, 'width', ''));
		const h = normalizePixelDimension(utils.getAttribute(img, 'height', ''));
		if (w) width = Number(w);
		if (h) height = Number(h);
	}

	return {
		identifier: utils.getAttribute(gapImg, 'identifier', ''),
		src,
		alt,
		matchMax,
		...(matchMin > 0 ? { matchMin } : {}),
		...(matchGroup.length > 0 ? { matchGroup } : {}),
		...(classes.length > 0 ? { classes } : {}),
		...(width !== undefined ? { width } : {}),
		...(height !== undefined ? { height } : {}),
	};
}

/**
 * Standard QTI gap match interaction extractor
 * Handles gapMatchInteraction elements (drag words or images into gaps in text)
 */
export const standardGapMatchExtractor: ElementExtractor<GapMatchData> = {
	id: 'qti:gap-match-interaction',
	name: 'QTI Standard Gap Match Interaction',
	priority: 10,
	elementTypes: ['gapMatchInteraction'],
	description: 'Extracts standard QTI gapMatchInteraction (drag words or images into gaps)',

	canHandle(element, context) {
		// All gapMatchInteraction elements are standard
		return context.utils.matchesTag(element, 'gapMatchInteraction');
	},

	extract(element, context) {
		const { utils } = context;

		// Extract gapText children (draggable text items)
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

		// Extract gapImg children (draggable image items; QTI 2.x gapImg / QTI 3.0 qti-gap-img)
		const gapImgElements = utils.getChildrenByTag(element, 'gapImg');
		const gapImages = gapImgElements.map((gapImg) => extractGapImage(gapImg, utils));

		// Extract attributes
		const shuffle = utils.getBooleanAttribute(element, 'shuffle');
		// Absent maxAssociations: "1" in QTI 2.2 (Table 5.38.3) and QTI 3.0 (Table 5.57.3),
		// 0 = no restriction. QTI 2.2 added the attribute, so QTI 2.1 content sets no
		// interaction cap. An explicit value is honoured in every version as leniency.
		const maxAssociations = utils.getNumberAttribute(element, 'maxAssociations', predatesQti22(context) ? 0 : 1);
		// minAssociations (QTI 2.2; QTI 3.0 §5.57.2): "the minimum number of associations that the
		// candidate is required to make to form a valid response"; 0 requires none.
		const minAssociations = utils.getNumberAttribute(element, 'minAssociations', 0);

		// Shuffle the combined choice pool so words and images interleave, then
		// restore the split view the renderer consumes.
		if (gapTexts.length > 0 || gapImages.length > 0) {
			const combined: Array<
				{ type: 'text'; choice: (typeof gapTexts)[number] } | { type: 'image'; choice: GapMatchImage }
			> = [...gapTexts.map((choice) => ({ type: 'text' as const, choice })), ...gapImages.map((choice) => ({ type: 'image' as const, choice }))];
			const shuffled = maybeShuffle(combined, shuffle, context.shuffleRng);
			gapTexts.length = 0;
			gapImages.length = 0;
			for (const entry of shuffled) {
				if (entry.type === 'text') gapTexts.push(entry.choice);
				else gapImages.push(entry.choice);
			}
		}

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

		// Each gap's authored matchGroup (QTI 2.2/3.0: the identifiers of the choices that may be
		// matched with it), read from the parsed source wherever the gap sits, with
		// version-aware attribute names (matchGroup / match-group). A gap authored `required`
		// "must be filled by the candidate in order to form a valid response" (QTI 2.1 gap;
		// QTI 3.0 §5.55.5).
		const gapMatchGroups: Record<string, string[]> = {};
		const requiredGaps: string[] = [];
		const visitGaps = (node: QTIElement): void => {
			for (const child of node.childNodes ?? []) {
				const candidate = child as QTIElement;
				if (!candidate.rawTagName) continue;
				if (utils.matchesTag(candidate, 'gap')) {
					const identifier = utils.getAttribute(candidate, 'identifier', '');
					const tokens = utils.getAttribute(candidate, 'matchGroup', '').split(/\s+/).filter(Boolean);
					if (identifier && tokens.length > 0) gapMatchGroups[identifier] = tokens;
					if (identifier && utils.getBooleanAttribute(candidate, 'required', false)) requiredGaps.push(identifier);
				}
				visitGaps(candidate);
			}
		};
		visitGaps(element);

		// Extract interaction-level classes and attributes
		const interactionClasses = utils.getClasses(element);
		const choicesContainerWidth = normalizeCssPixelLength(
			utils.getAttribute(element, 'data-choices-container-width', ''),
		);
		const maxSelectionsMessage = utils.getAttribute(element, 'data-max-selections-message', '') || null;
		const minSelectionsMessage = utils.getAttribute(element, 'data-min-selections-message', '') || null;

		return {
			gapTexts,
			gapImages,
			gaps,
			maxAssociations,
			...(minAssociations > 0 ? { minAssociations } : {}),
			...(Object.keys(gapMatchGroups).length > 0 ? { gapMatchGroups } : {}),
			...(requiredGaps.length > 0 ? { requiredGaps } : {}),
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

		// Validate draggable choices exist (gapText or gapImg — QTI 2.1/2.2/3.0 allow both)
		if ((!data.gapTexts || data.gapTexts.length === 0) && (!data.gapImages || data.gapImages.length === 0)) {
			errors.push('gapMatchInteraction must have at least one gapText or gapImg');
		}

		// Validate gaps exist
		if (!data.gaps || data.gaps.length === 0) {
			errors.push('gapMatchInteraction must have at least one gap in the prompt');
		}

		// Identifiers of gapText and gapImg choices share one response-identifier space:
		// a collision would make "wordId gapId" response pairs ambiguous.
		const choiceIdentifiers = new Set<string>();
		const validateChoiceIdentifier = (identifier: string, kind: string): void => {
			if (!identifier) {
				errors.push(`All ${kind} choices must have an identifier`);
			} else if (choiceIdentifiers.has(identifier)) {
				errors.push(`Duplicate choice identifier: ${identifier}`);
			} else {
				choiceIdentifiers.add(identifier);
			}
		};

		// Validate gapText identifiers
		if (data.gapTexts) {
			for (const gapText of data.gapTexts) {
				validateChoiceIdentifier(gapText.identifier, 'gapText');

				// Validate matchMax
				if (gapText.matchMax < 0) {
					errors.push(`matchMax must be non-negative for gapText ${gapText.identifier}`);
				}
			}
		}

		// Validate gapImg identifiers and image sources
		if (data.gapImages) {
			for (const gapImage of data.gapImages) {
				validateChoiceIdentifier(gapImage.identifier, 'gapImg');

				if (gapImage.matchMax < 0) {
					errors.push(`matchMax must be non-negative for gapImg ${gapImage.identifier}`);
				}
				if (!gapImage.src) {
					errors.push(`gapImg ${gapImage.identifier} must reference an image source`);
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
