/**
 * Session Storage
 * Session-aware storage wrapper for managing transform sessions
 */

import type {
	SessionStorage,
	StorageBackend,
	Session,
} from '@pie-qti/transform-types';

export interface SessionStorageOptions {
	/**
	 * Base path for session storage
	 * @default 'sessions'
	 */
	basePath?: string;
}

/**
 * Session storage implementation
 * Manages session-scoped file operations
 */
export class SessionStorageImpl implements SessionStorage {
	private storage: StorageBackend;
	private basePath: string;

	constructor(storage: StorageBackend, options: SessionStorageOptions = {}) {
		this.storage = storage;
		this.basePath = options.basePath || 'sessions';
	}

	getSessionPath(sessionId: string): string {
		return `${this.basePath}/${sessionId}`;
	}

	getUploadsPath(sessionId: string): string {
		return `${this.getSessionPath(sessionId)}/uploads`;
	}

	getExtractedPath(sessionId: string): string {
		return `${this.getSessionPath(sessionId)}/extracted`;
	}

	getOutputsPath(sessionId: string): string {
		return `${this.getSessionPath(sessionId)}/outputs`;
	}

	private getMetadataPath(sessionId: string): string {
		return `${this.getSessionPath(sessionId)}/session.json`;
	}

	async readSessionMetadata(sessionId: string): Promise<Session | null> {
		try {
			const metadataPath = this.getMetadataPath(sessionId);
			const exists = await this.storage.exists(metadataPath);
			if (!exists) {
				return null;
			}

			const content = await this.storage.readText(metadataPath);
			return JSON.parse(content) as Session;
		} catch {
			return null;
		}
	}

	async writeSessionMetadata(
		sessionId: string,
		session: Session,
	): Promise<void> {
		const metadataPath = this.getMetadataPath(sessionId);
		const content = JSON.stringify(session, null, 2);
		await this.storage.writeText(metadataPath, content);
	}

	async deleteSession(sessionId: string): Promise<void> {
		const sessionPath = this.getSessionPath(sessionId);
		await this.storage.delete(sessionPath);
	}

	async listSessions(): Promise<Session[]> {
		try {
			// List all directories in base path
			const entries = await this.storage.listFiles(this.basePath);

			// Read metadata for each session
			const sessions = await Promise.all(
				entries.map((sessionId) => this.readSessionMetadata(sessionId)),
			);

			// Filter out null results (sessions without metadata)
			return sessions.filter((s): s is Session => s !== null);
		} catch {
			return [];
		}
	}

	async getSessionSize(sessionId: string): Promise<number> {
		const sessionPath = this.getSessionPath(sessionId);
		return this.storage.getDirectorySize(sessionPath);
	}

	/**
	 * Get underlying storage backend
	 */
	getBackend(): StorageBackend {
		return this.storage;
	}
}
