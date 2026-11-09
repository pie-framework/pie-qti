/**
 * Helper utilities for web component prop handling
 */

/**
 * Parse a prop whose value is always an object (interaction data, a PNP profile): the object
 * itself, or its JSON text, which is how an HTML attribute carries it
 * (`<pie-qti-choice interaction='{"responseId":"R1",…}'>`). The string "null" stands for no
 * value; text that is not JSON is returned as given.
 *
 * Never use it for a response: a string response is a value, and reading it as JSON would turn
 * the answer "1.50" into 1.5 or "null" into no answer. Responses go through `responseProp`.
 */
export function parseJsonProp<T>(prop: T | string | null | undefined): T | undefined {
	if (prop === null || prop === undefined) return undefined;

	if (typeof prop === 'string') {
		// Handle "null" string
		if (prop === 'null') return undefined;

		// Try to parse as JSON
		try {
			return JSON.parse(prop) as T;
		} catch {
			// If it's not valid JSON, return the string as-is
			// This handles simple string identifiers
			return prop as unknown as T;
		}
	}

	return prop as T;
}

/**
 * A response-like prop (`response`, `correctResponse`) as the host set it. Hosts set responses as
 * JavaScript properties, and a response is never JSON text: a string is the candidate's text or a
 * choice identifier and stays exactly that ("1.50", "1e5", "true", "null", "[1]"). `null` means no
 * response.
 */
export function responseProp<T>(prop: T | null | undefined): T | undefined {
	return prop ?? undefined;
}

export interface InteractionShellProps<TInteraction, TResponse, TCorrectResponse = TResponse> {
	/** The interaction data, or its JSON text (an HTML attribute). */
	interaction?: TInteraction | string;
	/** The response itself, never JSON text. */
	response?: TResponse | null;
	/** The correct response itself, never JSON text. */
	correctResponse?: TCorrectResponse | null;
	role?: string;
}

export interface InteractionShell<TInteraction, TResponse, TCorrectResponse = TResponse> {
	interaction: TInteraction | undefined;
	response: TResponse | undefined;
	correctResponse: TCorrectResponse | undefined;
	isShowingCorrect: boolean;
	responseId: string | undefined;
}

export function createInteractionShell<
	TInteraction extends { responseId?: string },
	TResponse,
	TCorrectResponse = TResponse,
>({
	interaction,
	response,
	correctResponse,
	role = 'candidate',
}: InteractionShellProps<TInteraction, TResponse, TCorrectResponse>): InteractionShell<
	TInteraction,
	TResponse,
	TCorrectResponse
> {
	const parsedInteraction = parseJsonProp<TInteraction>(interaction);
	const parsedResponse = responseProp(response);
	const parsedCorrectResponse = responseProp(correctResponse);

	return {
		interaction: parsedInteraction,
		response: parsedResponse,
		correctResponse: parsedCorrectResponse,
		isShowingCorrect: role === 'scorer' && parsedCorrectResponse !== undefined,
		responseId: parsedInteraction?.responseId,
	};
}
