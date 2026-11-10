/**
 * Review views: the facts the review screen, section menu and submit confirmation
 * share, assembled from per-item facts the orchestrator resolves.
 *
 * Moved out of `AssessmentPlayer.ts` verbatim (pure code motion): the item-XML
 * derived review info cache, the review-list row shape and the completion-summary
 * assembly. "Answered" itself is decided once in `reviewState.itemAnswerStatus`;
 * jump legality comes from `navigationPolicy`. None of this takes the lock.
 */

import type { FlatItem } from './deliveryStructure.js';
import {
	interactionResponseIdentifiers,
	itemTitleFromXml,
	type ItemAnswerStatus,
	type ReviewItemView,
} from './reviewState.js';
import type { AssessmentResults, ResultsSummary } from '../types/index.js';

/** Item XML–derived review facts (interaction response ids, item title) per item identifier. */
export class ReviewInfoCache {
	readonly #cache = new Map<string, { responseIds: string[]; title?: string }>();
	readonly #items: readonly FlatItem[];

	constructor(items: readonly FlatItem[]) {
		this.#items = items;
	}

	for(itemIdentifier: string): { responseIds: string[]; title?: string } {
		const cached = this.#cache.get(itemIdentifier);
		if (cached) return cached;
		const flat = this.#items.find((item) => item.identifier === itemIdentifier);
		const info = flat
			? {
					responseIds: interactionResponseIdentifiers(flat.item.itemXml),
					title: itemTitleFromXml(flat.item.itemXml),
				}
			: { responseIds: [] };
		this.#cache.set(itemIdentifier, info);
		return info;
	}

	clear(): void {
		this.#cache.clear();
	}
}

/** One delivered item as the review screen lists it: status, flag, visited, jump legality. */
export function reviewItemRow(
	item: FlatItem,
	facts: {
		title?: string;
		status: ItemAnswerStatus;
		flagged: boolean;
		visited: boolean;
		jumpAllowed: boolean;
		isCurrent: boolean;
	},
): ReviewItemView {
	return {
		identifier: item.identifier,
		index: item.index,
		number: item.index + 1,
		sectionId: item.presentedSection?.identifier ?? null,
		title: facts.title,
		status: facts.status,
		flagged: facts.flagged,
		visited: facts.visited,
		jumpAllowed: facts.jumpAllowed,
		isCurrent: facts.isCurrent,
	};
}

/**
 * Candidate-facing results for a shell's opt-in completion summary: per delivered
 * item the answered status and — when the backend returned one — its score, plus the
 * finalized totals. Null until the assessment has been finalized; high-stakes hosts
 * simply never render it (the shell's `showResultsSummary` stays off by default).
 */
export function resultsSummaryOf(options: {
	items: readonly FlatItem[];
	results: AssessmentResults;
	titleOf: (itemIdentifier: string) => string | undefined;
	statusOf: (itemIdentifier: string) => ItemAnswerStatus;
}): ResultsSummary | null {
	const { items, results, titleOf, statusOf } = options;
	const scoreByItem = new Map(results.itemResults.map((result) => [result.itemIdentifier, result]));
	return {
		totalScore: results.totalScore,
		maxScore: results.maxScore,
		items: items.map((item) => {
			const result = scoreByItem.get(item.identifier);
			return {
				identifier: item.identifier,
				number: item.index + 1,
				title: titleOf(item.identifier),
				status: statusOf(item.identifier),
				...(result ? { score: result.score, maxScore: result.maxScore } : {}),
			};
		}),
	};
}
