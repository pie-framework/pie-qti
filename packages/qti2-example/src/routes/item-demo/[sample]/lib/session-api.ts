import type { SessionData } from './types';

export async function saveSessionToServer(
	sessionId: string | null,
	data: SessionData
): Promise<string> {
	const response = await fetch('/api/session', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			sessionId,
			data,
		}),
	});

	const result = await response.json();

	if (!response.ok) {
		throw new Error(result.error || 'Failed to save session');
	}

	return result.sessionId;
}

export async function loadSessionFromServer(sessionId: string): Promise<SessionData> {
	const response = await fetch(`/api/session?id=${encodeURIComponent(sessionId)}`);
	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || 'Failed to load session');
	}

	return data.data;
}
