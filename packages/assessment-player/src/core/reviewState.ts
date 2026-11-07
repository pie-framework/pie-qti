/**
 * Candidate review state: per-item answered status, flag-for-review state, and the
 * review-screen views the shell renders.
 *
 * One place decides what "answered" means so the review screen, the item palette, the
 * section menu and the submit confirmation always agree: a response counts when it is
 * non-null and non-empty (per interaction for composite items, giving
 * answered / partially answered / unanswered).
 */

import { parseXml } from '@pie-qti/qti-processing';

/** Candidate-facing answer state of one delivered item. */
export type ItemAnswerStatus = 'answered' | 'partiallyAnswered' | 'unanswered';

/** True when a candidate response value carries learner input. */
export function isAnsweredValue(value: unknown): boolean {
	if (value == null) return false;
	if (typeof value === 'string') return value.trim().length > 0;
	if (Array.isArray(value)) return value.some((entry) => isAnsweredValue(entry));
	if (typeof value === 'object') {
		return Object.values(value as Record<string, unknown>).some((entry) => isAnsweredValue(entry));
	}
	return true;
}

/**
 * Answer state of one item from its responses and its declared interaction response
 * identifiers. A single-interaction item is answered or unanswered; a composite item
 * (several interactions) can also be partially answered.
 */
export function itemAnswerStatus(
	responses: Record<string, unknown>,
	responseIdentifiers: readonly string[],
): ItemAnswerStatus {
	const ids = responseIdentifiers.length > 0 ? responseIdentifiers : Object.keys(responses);
	if (ids.length === 0) return 'unanswered';
	let answeredCount = 0;
	for (const id of ids) {
		if (isAnsweredValue(responses[id])) answeredCount += 1;
	}
	if (answeredCount === 0) return 'unanswered';
	if (ids.length > 1 && answeredCount < ids.length) return 'partiallyAnswered';
	return 'answered';
}

/**
 * Response identifiers the item's interactions bind to (`responseIdentifier` in QTI 2.x,
 * `response-identifier` in QTI 3.0), in document order, de-duplicated. Non-interaction
 * response declarations (for example template or state variables) are not included.
 */
export function interactionResponseIdentifiers(itemXml: string): string[] {
	const doc = parseXml(itemXml);
	const seen = new Set<string>();
	const ids: string[] = [];
	// Array.from: xmldom's lists are array-like, not iterable.
	for (const element of Array.from(doc.getElementsByTagName('*'))) {
		for (const attribute of ['responseIdentifier', 'response-identifier']) {
			const value = element.getAttribute?.(attribute);
			if (value && !seen.has(value)) {
				seen.add(value);
				ids.push(value);
			}
		}
	}
	return ids;
}

const ITEM_ROOT_TITLE =
	/<(?:[\w-]+:)?(?:qti-assessment-item|assessmentItem)\b[^>]*?\btitle\s*=\s*(?:"([^"]*)"|'([^']*)')/;

/** The item root's `title` attribute, if any (used by the review screen). */
export function itemTitleFromXml(itemXml: string): string | undefined {
	const match = ITEM_ROOT_TITLE.exec(itemXml);
	const title = (match?.[1] ?? match?.[2] ?? '').trim();
	return title || undefined;
}

/** One delivered item as the review screen and submit confirmation list it. */
export interface ReviewItemView {
	identifier: string;
	/** Flat delivery index — the argument to `AssessmentPlayer.navigateTo()`. */
	index: number;
	/** 1-based question number across the delivered test. */
	number: number;
	/** Presented (candidate-visible) section; `null` when no enclosing section is visible. */
	sectionId: string | null;
	/** Item title from the item XML root, if any. */
	title?: string;
	/** Answered / partially answered / unanswered. */
	status: ItemAnswerStatus;
	/** Whether the candidate flagged this item for review. */
	flagged: boolean;
	/** Whether the candidate has been presented this item. */
	visited: boolean;
	/**
	 * Whether jumping to this item is legal right now (navigationMode, test-part locks,
	 * time locks and review policy). Illegal targets render status-only.
	 */
	jumpAllowed: boolean;
	/** True for the item currently on screen. */
	isCurrent: boolean;
}

/**
 * What the candidate's next forward step would do, so the shell can warn before an
 * irreversible move: QTI test parts are delivered in sequence and, once left, cannot be
 * re-entered — in linear parts nothing can be revisited at all.
 */
export interface ForwardTransitionInfo {
	/** Flat index of the next reachable item; `null` when no item follows. */
	nextIndex: number | null;
	/** True when the forward step leaves the current test part (parts cannot be re-entered). */
	leavesTestPart: boolean;
}
