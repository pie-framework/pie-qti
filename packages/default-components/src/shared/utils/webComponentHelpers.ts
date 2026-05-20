/**
 * Helper utilities for web component prop handling
 */

/**
 * Parse a prop that may be a JSON string or an object
 * Used when components are used as web components and receive JSON strings
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

export interface InteractionShellProps<TInteraction, TResponse, TCorrectResponse = TResponse> {
	interaction?: TInteraction | string;
	response?: TResponse | string | null;
	correctResponse?: TCorrectResponse | string | null;
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
	const parsedResponse = parseJsonProp<TResponse>(response);
	const parsedCorrectResponse = parseJsonProp<TCorrectResponse>(correctResponse);

	return {
		interaction: parsedInteraction,
		response: parsedResponse,
		correctResponse: parsedCorrectResponse,
		isShowingCorrect: role === 'scorer' && parsedCorrectResponse !== undefined,
		responseId: parsedInteraction?.responseId,
	};
}
