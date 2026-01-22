/**
 * Simple in-memory session storage for the vendor example
 * In production, this would be replaced with a database or persistent storage
 */

import type { Session, QtiContent, TransformResult } from '../types/session';
import { randomUUID } from 'node:crypto';

class SessionStorage {
	private sessions = new Map<string, Session>();

	/**
	 * Create a new session
	 */
	createSession(vendor: string | null = null): Session {
		const id = randomUUID();
		const now = new Date().toISOString();

		const session: Session = {
			id,
			qti: null,
			transform: null,
			vendor,
			created: now,
			updated: now
		};

		this.sessions.set(id, session);
		return session;
	}

	/**
	 * Get a session by ID
	 */
	getSession(id: string): Session | null {
		return this.sessions.get(id) ?? null;
	}

	/**
	 * Get all sessions (for recent sessions list)
	 */
	getAllSessions(): Session[] {
		return Array.from(this.sessions.values())
			.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
	}

	/**
	 * Update session with QTI content
	 */
	setQtiContent(id: string, qti: QtiContent): Session | null {
		const session = this.sessions.get(id);
		if (!session) return null;

		session.qti = qti;
		session.updated = new Date().toISOString();
		return session;
	}

	/**
	 * Update session with transform result
	 */
	setTransformResult(id: string, result: TransformResult): Session | null {
		const session = this.sessions.get(id);
		if (!session) return null;

		session.transform = result;
		session.updated = new Date().toISOString();
		return session;
	}

	/**
	 * Delete a session
	 */
	deleteSession(id: string): boolean {
		return this.sessions.delete(id);
	}

	/**
	 * Clear all sessions (for testing)
	 */
	clearAll(): void {
		this.sessions.clear();
	}
}

// Singleton instance
export const sessionStorage = new SessionStorage();
