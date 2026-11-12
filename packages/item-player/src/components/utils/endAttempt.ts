import type { ItemSessionTransition } from '../../core/ItemSession.js';
import type { ItemPresentationFlowNode } from '../../presentation/itemPresentationPlan.js';

export interface EndAttemptRequest {
	/** The interaction's `countAttempt`: false (a hint request) ends the attempt without counting it. */
	readonly countAttempt: boolean;
}

/**
 * Whether `transition` is a candidate activating an `endAttemptInteraction`: a `setResponse`
 * that turns its boolean response true. In QTI that ends the attempt — response processing runs,
 * and with `countAttempt="false"` the attempt is not counted, which is how hint buttons work —
 * so the player submits with that `countAttempt`.
 *
 * Bulk `setResponses` (a host restoring or controlling responses) never ends an attempt, and a
 * response that was already true does not end it again.
 */
export function endAttemptRequest(
	transition: ItemSessionTransition,
	flow: () => readonly ItemPresentationFlowNode[]
): EndAttemptRequest | null {
	const { command, previous, current } = transition;
	if (command.action !== 'setResponse') return null;
	const responseId = command.responseIdentifier;
	if (current.responses[responseId] !== true || previous.responses[responseId] === true) return null;
	for (const node of flow()) {
		if (node.kind !== 'interaction') continue;
		const { interaction } = node.mount;
		if (interaction.type !== 'endAttemptInteraction' || interaction.responseId !== responseId) continue;
		const countAttempt = (interaction as { countAttempt?: unknown }).countAttempt;
		return { countAttempt: countAttempt !== false };
	}
	return null;
}
