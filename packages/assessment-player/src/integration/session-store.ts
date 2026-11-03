/**
 * localStorage session store for the reference backend adapter.
 *
 * Sessions store the full assessment (with QTI XML and correct answers) client-side —
 * INSECURE by design; this is a reference implementation, not a production backend.
 */

import type {
	AssessmentSessionState,
	SecureAssessment,
	SessionId,
} from './api-contract.js';
import type { ItemTestState } from './assessment-item-scorer.js';

/**
 * Storage key prefix for localStorage
 */
const STORAGE_PREFIX = 'qti_session_';

/**
 * Stored session data (includes full QTI XML - INSECURE)
 */
export interface StoredSession {
	sessionId: SessionId;
	assessmentId: string;
	candidateId: string;
	/** Full assessment structure with QTI XML */
	assessment: SecureAssessment;
	/** Current state */
	state: AssessmentSessionState;
	/** Created timestamp */
	createdAt: number;
	/** Finalized flag */
	finalized: boolean;
	/** Per-item variables and flags from the latest submission, read by test-level outcome processing. */
	itemTestStates?: Record<string, ItemTestState>;
}

export function generateSessionId(assessmentId: string, candidateId: string): SessionId {
	return `${assessmentId}:${candidateId}:${Date.now()}`;
}

export function loadSession(sessionId: SessionId): StoredSession | null {
	try {
		const key = STORAGE_PREFIX + sessionId;
		const data = localStorage.getItem(key);
		if (!data) return null;
		return JSON.parse(data) as StoredSession;
	} catch {
		return null;
	}
}

export function saveSession(session: StoredSession): void {
	try {
		const key = STORAGE_PREFIX + session.sessionId;
		localStorage.setItem(key, JSON.stringify(session));
	} catch (error) {
		console.error('Failed to save session to localStorage:', error);
	}
}
