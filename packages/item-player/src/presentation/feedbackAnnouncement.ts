/**
 * Screen-reader announcement of integrated feedback (WCAG 4.1.3 Status Messages).
 *
 * The presentation plan splices the feedbackInline and feedbackBlock that an attempt shows into
 * the item body HTML, with no marker left behind. They appear without moving focus and without
 * any other change assistive technology can detect. The item body therefore announces them
 * through one persistent polite live region. This module holds the pure rules behind that:
 * what the shown feedback says, which session transitions announce it, and how an identical
 * repeat still reaches a screen reader.
 */

import { isShownByIdentifier } from '@pie-qti/qti-common';
import type { ItemSessionTransition } from '../core/ItemSession.js';
import type { QTIRole } from '../types/index.js';

/** The integrated feedback an item body shows. */
export interface ShownFeedback {
	/** Whether any feedbackInline or feedbackBlock with content is shown. */
	readonly shown: boolean;
	/**
	 * Accessible text of the shown feedback in document order: visible text plus image `alt` text,
	 * markup removed and whitespace collapsed. Empty when nothing is shown, or when what is shown
	 * has no text, such as an image with no alt. A shown feedback with no text is announced as a
	 * localized "Feedback is shown." instead.
	 */
	readonly text: string;
}

const NOTHING_SHOWN: ShownFeedback = Object.freeze({ shown: false, text: '' });

export interface ExtractShownFeedbackOptions {
	/** Show no feedback whatever the outcomes, as a test-level `showFeedback="false"` requires. */
	readonly hideAll?: boolean;
	/** The authoring heuristics the plan applies to shown feedback (`cleanFeedbackText`). */
	readonly transform?: (html: string) => string;
}

const FEEDBACK_TAG =
	/<(\/?)(feedbackInline|qti-feedback-inline|feedbackBlock|qti-feedback-block)\b([^>]*?)(\/?)>/gi;

interface FeedbackElement {
	readonly attrs: string;
	readonly openStart: number;
	readonly openEnd: number;
	closeStart: number;
	closeEnd: number;
	readonly children: FeedbackElement[];
}

/**
 * The top-level feedback elements in `html`, each with the feedback nested inside it. Parsed as
 * `processFeedbackInline` in `@pie-qti/qti-common` parses them, so the announcement covers exactly
 * the elements the plan shows or drops. An unclosed element is left as written, as it is there.
 */
function feedbackElements(html: string): FeedbackElement[] {
	const roots: FeedbackElement[] = [];
	const open: FeedbackElement[] = [];
	const add = (element: FeedbackElement) => (open[open.length - 1]?.children ?? roots).push(element);
	for (const match of html.matchAll(FEEDBACK_TAG)) {
		const [tag, closing, , attrs = '', selfClosing] = match;
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
	return roots;
}

/** An attribute in either QTI spelling, e.g. `outcomeIdentifier` or `outcome-identifier`. */
function attribute(attrs: string, name: string): string | null {
	const kebab = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
	for (const spelling of kebab === name ? [name] : [name, kebab]) {
		const match = new RegExp(`(?:^|\\s)${spelling}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
		if (match) return match[1] ?? match[2] ?? '';
	}
	return null;
}

function isShown(element: FeedbackElement, outcomeValues: Readonly<Record<string, unknown>>): boolean {
	const outcomeId = attribute(element.attrs, 'outcomeIdentifier');
	const feedbackId = attribute(element.attrs, 'identifier');
	if (outcomeId === null || feedbackId === null) return false;
	return isShownByIdentifier(outcomeValues[outcomeId], feedbackId, attribute(element.attrs, 'showHide'));
}

/** A shown element's content as the plan renders it: nested feedback resolved, hidden feedback dropped. */
function shownContent(html: string, element: FeedbackElement, outcomeValues: Readonly<Record<string, unknown>>): string {
	let out = '';
	let position = element.openEnd;
	for (const child of element.children) {
		out += html.slice(position, child.openStart);
		position = child.closeEnd;
		if (isShown(child, outcomeValues)) out += shownContent(html, child, outcomeValues);
	}
	return out + html.slice(position, element.closeStart);
}

/** Phrasing elements: their text runs on with the text around them ("<strong>sum</strong>." reads "sum."). */
const PHRASING_ELEMENTS = new Set([
	'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'font', 'i', 'ins', 'kbd',
	'label', 'mark', 'q', 'rb', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup',
	'time', 'u', 'var', 'wbr',
]);

const NAMED_CHARACTERS: Readonly<Record<string, string>> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00a0',
};

function decodeCharacterReferences(text: string): string {
	return text.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (reference, body: string) => {
		if (body[0] !== '#') return NAMED_CHARACTERS[body.toLowerCase()] ?? reference;
		const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : reference;
	});
}

/** HTML as a screen reader reads it: images by their alt text, inert content skipped, whitespace collapsed. */
function accessibleText(html: string): string {
	const text = html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
		.replace(/<img\b[^>]*>/gi, (tag) => ` ${attribute(tag.slice(4, -1), 'alt') ?? ''} `)
		.replace(/<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g, (_tag, name: string) => (PHRASING_ELEMENTS.has(name.toLowerCase()) ? '' : ' '))
		.replace(/<[^>]*>/g, ' ');
	// Character references are decoded last, so an encoded `&lt;` is never mistaken for markup.
	return decodeCharacterReferences(text).replace(/\s+/g, ' ').trim();
}

/** Content that renders something: any text or element, comments aside. */
function rendersSomething(html: string): boolean {
	return /\S/.test(html.replace(/<!--[\s\S]*?-->/g, ''));
}

/**
 * The feedback that `outcomeValues` show in an item body, read as text in document order.
 *
 * Runs on the body HTML *before* the plan splices the feedback in, while every element still
 * carries its `outcomeIdentifier` and `identifier`. Visibility follows the shared rule
 * (`isShownByIdentifier`, including `showHide="hide"` and container membership). Nested feedback
 * resolves inside shown feedback, and hidden feedback contributes nothing, not even what is
 * nested inside it. Separate feedback elements are joined with a space.
 */
export function extractShownFeedback(
	bodyHtml: string,
	outcomeValues: Readonly<Record<string, unknown>>,
	options: ExtractShownFeedbackOptions = {},
): ShownFeedback {
	if (!bodyHtml || options.hideAll) return NOTHING_SHOWN;
	const texts: string[] = [];
	let shown = false;
	for (const root of feedbackElements(bodyHtml)) {
		if (!isShown(root, outcomeValues)) continue;
		const content = shownContent(bodyHtml, root, outcomeValues);
		if (!rendersSomething(content)) continue;
		shown = true;
		const text = accessibleText(options.transform ? options.transform(content) : content);
		if (text) texts.push(text);
	}
	return shown ? { shown, text: texts.join(' ') } : NOTHING_SHOWN;
}

/**
 * Whether a session transition is the candidate's own attempt ending: a submit or end-attempt,
 * which covers every attempt of an adaptive item, including an uncounted `countAttempt="false"`
 * one. Feedback is the result of the attempt, so only an attempt announces it. Initial render and
 * restore dispatch nothing. Review and scorer renders dispatch no attempt, because a scorer is
 * excluded by role and an ended session refuses attempt commands. All of them therefore stay
 * silent, however often they re-render.
 */
export function isCandidateAttemptFeedback(transition: Pick<ItemSessionTransition, 'command'>, role: QTIRole): boolean {
	const { action } = transition.command;
	return role === 'candidate' && (action === 'endAttempt' || action === 'submitAttempt');
}

/**
 * The live-region text for `message`, given the text it holds now. Repeating identical text would
 * leave the region unchanged, and assistive technology does not announce an unchanged region. A
 * repeat therefore toggles a trailing zero-width space, which a screen reader does not read but
 * which still changes the region. The interaction components use the same toggle for refusals.
 */
export function nextFeedbackAnnouncement(previous: string | null | undefined, message: string): string {
	return previous === message ? `${message}\u200b` : message;
}
