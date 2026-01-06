/**
 * Session lifecycle management
 */

import { type FileStorage, getStorage } from './FileStorage';
import type { PackageInfo, Session } from './types';

export class SessionManager {
  private storage: FileStorage;

  constructor(storage?: FileStorage) {
    this.storage = storage || getStorage();
  }

  /**
   * Create a new session with uploaded packages
   */
  async createSession(packages: PackageInfo[]): Promise<Session> {
    return await this.storage.createSession(packages);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return await this.storage.getSession(sessionId);
  }

  /**
   * Check if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    return await this.storage.sessionExists(sessionId);
  }

  /**
   * Update session status
   */
  async updateStatus(sessionId: string, status: Session['status']): Promise<void> {
    await this.storage.updateSessionStatus(sessionId, status);
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Session[]> {
    return await this.storage.listSessions();
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.storage.deleteSession(sessionId);
  }

  /**
   * Get session size
   */
  async getSessionSize(sessionId: string): Promise<number> {
    return await this.storage.getSessionSize(sessionId);
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    return await this.storage.cleanupOldSessions(maxAgeMs);
  }

  /**
   * Get session paths
   */
  getSessionPaths(sessionId: string) {
    return {
      uploads: this.storage.getUploadsPath(sessionId),
      extracted: this.storage.getExtractedPath(sessionId),
      outputs: this.storage.getOutputsPath(sessionId),
    };
  }

  /**
   * Save transformation results
   */
  async saveTransformation(sessionId: string, result: any): Promise<void> {
    await this.storage.saveTransformation(sessionId, result);
  }

  /**
   * Get transformation results
   */
  async getTransformation(sessionId: string): Promise<any | null> {
    return await this.storage.getTransformation(sessionId);
  }
}

// Singleton instance
let managerInstance: SessionManager | null = null;

/**
 * Get or create the global session manager
 */
export function getSessionManager(): SessionManager {
  if (!managerInstance) {
    managerInstance = new SessionManager();
  }
  return managerInstance;
}
