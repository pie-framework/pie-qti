/**
 * localStorage session store for the reference backend adapter.
 *
 * Sessions store the full assessment (with QTI XML and correct answers) client-side —
 * INSECURE by design; this is a reference implementation, not a production backend.
 */

import type {
	AssessmentSessionState,
	OutcomeProcessingError,
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
	/**
	 * Per-item variables and flags from each item's latest counted submission, read by
	 * test-level outcome processing. Absent until the session's first counted submission.
	 */
	itemTestStates?: Record<string, ItemTestState>;
	/**
	 * Set when test-level outcome processing failed: candidate responses stay persisted,
	 * but SCORE/testFeedback outcomes could not be computed and the error must surface
	 * to the host instead of failing silently.
	 */
	outcomeProcessingError?: OutcomeProcessingError;
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

/**
 * The most recent stored session for an assessment and candidate, or null. Unfinalized
 * sessions only by default: a finalized test has nothing left to resume. This is the
 * reference loader behind `ReferenceBackendAdapter.latestSessionId()`, which demos and
 * tests use to resume a draft after a refresh.
 */
export function findLatestSession(
	assessmentId: string,
	candidateId: string,
	options: { includeFinalized?: boolean } = {},
): StoredSession | null {
	let latest: StoredSession | null = null;
	try {
		for (let index = 0; index < localStorage.length; index++) {
			const key = localStorage.key(index);
			if (!key?.startsWith(STORAGE_PREFIX)) continue;
			const session = loadSession(key.slice(STORAGE_PREFIX.length));
			if (!session) continue;
			if (session.assessmentId !== assessmentId || session.candidateId !== candidateId) continue;
			if (session.finalized && !options.includeFinalized) continue;
			if (!latest || session.createdAt > latest.createdAt) latest = session;
		}
	} catch {
		return null;
	}
	return latest;
}
