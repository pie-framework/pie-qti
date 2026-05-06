import { Player, type SerializedItemSessionState } from '@pie-qti/item-player';
import type { AssessmentScoringResult, ResponseValue } from './api-contract.js';

export interface AssessmentItemScoringInput {
	itemXml: string;
	responses: Record<string, ResponseValue>;
	itemSession?: SerializedItemSessionState;
}

export function getAssessmentItemIdentifier(itemXml: string): string {
	const identifierMatch = itemXml.match(/assessmentItem[^>]+identifier=["']([^"']+)["']/);
	return identifierMatch?.[1] || 'unknown';
}

/**
 * Runs QTI ResponseProcessing for one AssessmentItem and normalizes the result
 * to the BackendAdapter scoring shape used by AssessmentPlayer.
 */
export function scoreAssessmentItem({
	itemXml,
	responses,
	itemSession,
}: AssessmentItemScoringInput): AssessmentScoringResult {
	const itemIdentifier = getAssessmentItemIdentifier(itemXml);

	try {
		// Use a scorer-grade view of the item for accurate scoring.
		// NOTE: This reference scorer is intentionally insecure and runs client-side.
		// In production, scoring must happen server-side with secured item content.
		const player = new Player({
			itemXml,
			role: 'scorer',
		});

		if (itemSession) {
			player.restoreItemSession(itemSession);
		}
		player.setResponses(responses);
		const result = itemSession ? (player.scoreAttempt().scoring ?? player.processResponses()) : player.processResponses();

		return {
			itemIdentifier,
			score: result.score,
			maxScore: result.maxScore,
			completed: result.completed,
			outcomeValues: result.outcomeValues,
		};
	} catch (error) {
		console.error('Scoring error:', error);
		return {
			itemIdentifier,
			score: 0,
			maxScore: 1,
			completed: false,
			outcomeValues: {},
		};
	}
}
