/**
 * Transform App Extended Session Storage
 * Wraps the core SessionStorage with app-specific metadata handling
 */

import type { SessionStorage, StorageBackend } from '@pie-qti/transform-types';
import type {
	AnalysisResult,
	TransformationResult,
	AppSession,
} from './app-types.js';

/**
 * Extended session storage for transform app
 * Manages session metadata along with separate analysis and transformation files
 */
export class AppSessionStorage {
	constructor(
		private storage: StorageBackend,
		private sessionStorage: SessionStorage,
	) {}

	/**
	 * Generate a new session ID
	 */
	generateSessionId(): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 10);
		return `${timestamp}-${random}`;
	}

	/**
	 * Get session with analysis and transformation metadata
	 */
	async getSession(sessionId: string): Promise<AppSession | null> {
		const session = await this.sessionStorage.readSessionMetadata(sessionId);
		if (!session) {
			return null;
		}

		// Read analysis if exists
		const analysis = await this.getAnalysis(sessionId);

		// Read transformation if exists
		const transformation = await this.getTransformation(sessionId);

		return {
			...session,
			analysis,
			transformation,
		};
	}

	/**
	 * List all sessions with their metadata
	 */
	async listSessions(): Promise<AppSession[]> {
		const sessions = await this.sessionStorage.listSessions();

		// Load analysis and transformation metadata for each
		const appSessions = await Promise.all(
			sessions.map(async (session) => {
				const analysis = await this.getAnalysis(session.id);
				const transformation = await this.getTransformation(session.id);

				return {
					...session,
					analysis,
					transformation,
				};
			}),
		);

		return appSessions;
	}

	/**
	 * Get analysis results for a session
	 */
	async getAnalysis(sessionId: string): Promise<AnalysisResult | undefined> {
		try {
			const analysisPath = this.getAnalysisPath(sessionId);
			const exists = await this.storage.exists(analysisPath);
			if (!exists) {
				return undefined;
			}

			const content = await this.storage.readText(analysisPath);
			const analysis = JSON.parse(content);

			// Parse dates
			if (analysis.timestamp) {
				analysis.timestamp = new Date(analysis.timestamp);
			}

			return analysis;
		} catch (error) {
			console.error(`Failed to read analysis for session ${sessionId}:`, error);
			return undefined;
		}
	}

	/**
	 * Save analysis results for a session
	 */
	async saveAnalysis(
		sessionId: string,
		analysis: AnalysisResult,
	): Promise<void> {
		const analysisPath = this.getAnalysisPath(sessionId);
		const content = JSON.stringify(analysis, null, 2);
		await this.storage.writeText(analysisPath, content);

		// Update session status
		const session = await this.sessionStorage.readSessionMetadata(sessionId);
		if (session) {
			session.status = 'ready';
			session.lastAccessedAt = new Date().toISOString();
			await this.sessionStorage.writeSessionMetadata(sessionId, session);
		}
	}

	/**
	 * Get transformation results for a session
	 */
	async getTransformation(
		sessionId: string,
	): Promise<TransformationResult | undefined> {
		try {
			const transformPath = this.getTransformationPath(sessionId);
			const exists = await this.storage.exists(transformPath);
			if (!exists) {
				return undefined;
			}

			const content = await this.storage.readText(transformPath);
			const transformation = JSON.parse(content);

			// Parse dates
			if (transformation.startTime) {
				transformation.startTime = new Date(transformation.startTime);
			}
			if (transformation.endTime) {
				transformation.endTime = new Date(transformation.endTime);
			}

			return transformation;
		} catch (error) {
			console.error(
				`Failed to read transformation for session ${sessionId}:`,
				error,
			);
			return undefined;
		}
	}

	/**
	 * Save transformation results for a session
	 */
	async saveTransformation(
		sessionId: string,
		transformation: TransformationResult,
	): Promise<void> {
		const transformPath = this.getTransformationPath(sessionId);
		const content = JSON.stringify(transformation, null, 2);
		await this.storage.writeText(transformPath, content);

		// Update session status
		const session = await this.sessionStorage.readSessionMetadata(sessionId);
		if (session) {
			session.status = 'completed';
			session.lastAccessedAt = new Date().toISOString();
			await this.sessionStorage.writeSessionMetadata(sessionId, session);
		}
	}

	/**
	 * Delete a session and all its files
	 */
	async deleteSession(sessionId: string): Promise<void> {
		await this.sessionStorage.deleteSession(sessionId);
	}

	/**
	 * Get session size in bytes
	 */
	async getSessionSize(sessionId: string): Promise<number> {
		return await this.sessionStorage.getSessionSize(sessionId);
	}

	// Path helpers
	getSessionPath(sessionId: string): string {
		return this.sessionStorage.getSessionPath(sessionId);
	}

	getUploadsPath(sessionId: string): string {
		return this.sessionStorage.getUploadsPath(sessionId);
	}

	getExtractedPath(sessionId: string): string {
		return this.sessionStorage.getExtractedPath(sessionId);
	}

	getOutputsPath(sessionId: string): string {
		return this.sessionStorage.getOutputsPath(sessionId);
	}

	private getAnalysisPath(sessionId: string): string {
		return `${this.sessionStorage.getSessionPath(sessionId)}/analysis.json`;
	}

	private getTransformationPath(sessionId: string): string {
		return `${this.sessionStorage.getSessionPath(sessionId)}/transformation.json`;
	}

	/**
	 * Get the underlying storage backend
	 */
	getStorage(): StorageBackend {
		return this.storage;
	}

	/**
	 * Get the underlying session storage
	 */
	getSessionStorage(): SessionStorage {
		return this.sessionStorage;
	}
}
