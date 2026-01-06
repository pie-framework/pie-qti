/**
 * File-based storage for sessions and packages
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AnalysisResult, PackageInfo, Session, TransformationResult } from './types';
import { getZipExtractor } from './ZipExtractor';

export class FileStorage {
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    // Default to uploads/ in project root
    this.uploadsDir = uploadsDir || resolve(process.cwd(), 'uploads');
  }

  /**
   * Initialize storage directories
   */
  async initialize(): Promise<void> {
    await mkdir(join(this.uploadsDir, 'sessions'), { recursive: true });
  }

  /**
   * Generate a new session ID
   */
  generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }

  /**
   * Validate session ID format
   */
  private validateSessionId(sessionId: string): boolean {
    const pattern = /^[0-9]+-[a-z0-9]+$/;
    return pattern.test(sessionId);
  }

  /**
   * Get session directory path
   */
  private getSessionPath(sessionId: string): string {
    if (!this.validateSessionId(sessionId)) {
      throw new Error('Invalid session ID format');
    }

    const sessionPath = join(this.uploadsDir, 'sessions', sessionId);

    // Ensure path is within uploads directory (prevent traversal)
    const normalizedSessionPath = resolve(sessionPath);
    const normalizedUploadsDir = resolve(this.uploadsDir);

    if (!normalizedSessionPath.startsWith(normalizedUploadsDir)) {
      throw new Error('Invalid session path');
    }

    return sessionPath;
  }

  /**
   * Create a new session
   */
  async createSession(packages: PackageInfo[]): Promise<Session> {
    const sessionId = this.generateSessionId();
    const sessionPath = this.getSessionPath(sessionId);

    // Create session directories
    await mkdir(join(sessionPath, 'uploads'), { recursive: true });
    await mkdir(join(sessionPath, 'extracted'), { recursive: true });
    await mkdir(join(sessionPath, 'outputs'), { recursive: true });

    const session: Session = {
      id: sessionId,
      created: new Date(),
      status: 'uploading',
      packages,
    };

    // Save session metadata
    await this.saveSessionMetadata(sessionId, session);

    return session;
  }

  /**
   * Get session metadata
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const sessionPath = this.getSessionPath(sessionId);
    const metadataPath = join(sessionPath, 'metadata.json');

    if (!existsSync(metadataPath)) {
      return null;
    }

    try {
      const content = await readFile(metadataPath, 'utf-8');
      const session = JSON.parse(content);

      // Parse dates
      session.created = new Date(session.created);
      if (session.analysis?.timestamp) {
        session.analysis.timestamp = new Date(session.analysis.timestamp);
      }
      if (session.transformation) {
        session.transformation.startTime = new Date(session.transformation.startTime);
        session.transformation.endTime = new Date(session.transformation.endTime);
      }

      return session;
    } catch (error) {
      console.error(`Failed to read session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update session metadata
   */
  async saveSessionMetadata(sessionId: string, session: Session): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    const metadataPath = join(sessionPath, 'metadata.json');

    await writeFile(metadataPath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: Session['status']): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = status;
    await this.saveSessionMetadata(sessionId, session);
  }

  /**
   * Save analysis results
   */
  async saveAnalysis(sessionId: string, analysis: AnalysisResult): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    const analysisPath = join(sessionPath, 'analysis.json');

    await writeFile(analysisPath, JSON.stringify(analysis, null, 2), 'utf-8');

    // Update session metadata
    const session = await this.getSession(sessionId);
    if (session) {
      session.analysis = analysis;
      session.status = 'ready';
      await this.saveSessionMetadata(sessionId, session);
    }
  }

  /**
   * Get analysis results
   */
  async getAnalysis(sessionId: string): Promise<AnalysisResult | null> {
    const sessionPath = this.getSessionPath(sessionId);
    const analysisPath = join(sessionPath, 'analysis.json');

    if (!existsSync(analysisPath)) {
      return null;
    }

    try {
      const content = await readFile(analysisPath, 'utf-8');
      const analysis = JSON.parse(content);
      analysis.timestamp = new Date(analysis.timestamp);
      return analysis;
    } catch (error) {
      console.error(`Failed to read analysis for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Save transformation results
   */
  async saveTransformation(sessionId: string, result: TransformationResult): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    const reportPath = join(sessionPath, 'report.json');

    await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf-8');

    // Update session metadata
    const session = await this.getSession(sessionId);
    if (session) {
      session.transformation = result;
      session.status = 'complete';
      await this.saveSessionMetadata(sessionId, session);
    }
  }

  /**
   * Get transformation results
   */
  async getTransformation(sessionId: string): Promise<TransformationResult | null> {
    const sessionPath = this.getSessionPath(sessionId);
    const reportPath = join(sessionPath, 'report.json');

    if (!existsSync(reportPath)) {
      return null;
    }

    try {
      const content = await readFile(reportPath, 'utf-8');
      const result = JSON.parse(content);
      result.startTime = new Date(result.startTime);
      result.endTime = new Date(result.endTime);
      return result;
    } catch (error) {
      console.error(`Failed to read transformation for ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get path to uploads directory
   */
  getUploadsPath(sessionId: string): string {
    return join(this.getSessionPath(sessionId), 'uploads');
  }

  /**
   * Get path to extracted directory
   */
  getExtractedPath(sessionId: string): string {
    return join(this.getSessionPath(sessionId), 'extracted');
  }

  /**
   * Get path to outputs directory
   */
  getOutputsPath(sessionId: string): string {
    return join(this.getSessionPath(sessionId), 'outputs');
  }

  /**
   * Extract ZIP files for a session
   */
  async extractZipPackages(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const uploadsPath = this.getUploadsPath(sessionId);
    const extractedPath = this.getExtractedPath(sessionId);

    try {
      // Find all ZIP files in uploads directory
      const files = await readdir(uploadsPath);
      const zipFiles = files.filter((f) => f.toLowerCase().endsWith('.zip'));

      if (zipFiles.length === 0) {
        return { success: true }; // No ZIP files to extract
      }

      const extractor = getZipExtractor();

      // Extract each ZIP file
      for (const zipFile of zipFiles) {
        const zipPath = join(uploadsPath, zipFile);
        const targetDir = join(extractedPath, zipFile.replace(/\.zip$/i, ''));

        const result = await extractor.extractSimple(zipPath, targetDir);

        if (!result.success) {
          console.error(`Failed to extract ${zipFile}:`, result.error);
          return { success: false, error: `Failed to extract ${zipFile}: ${result.error}` };
        }

        console.log(`Extracted ${zipFile}: ${result.fileCount} files, ${result.totalSize} bytes`);
      }

      return { success: true };
    } catch (error) {
      console.error('ZIP extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
      };
    }
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Session[]> {
    const sessionsDir = join(this.uploadsDir, 'sessions');

    if (!existsSync(sessionsDir)) {
      return [];
    }

    try {
      const entries = await readdir(sessionsDir);
      const sessions: Session[] = [];

      for (const entry of entries) {
        const session = await this.getSession(entry);
        if (session) {
          sessions.push(session);
        }
      }

      // Sort by creation date (newest first)
      sessions.sort((a, b) => b.created.getTime() - a.created.getTime());

      return sessions;
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Delete a session and all its files
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);

    if (existsSync(sessionPath)) {
      await rm(sessionPath, { recursive: true, force: true });
    }
  }

  /**
   * Clean up old sessions (older than maxAge milliseconds)
   */
  async cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
    const sessions = await this.listSessions();
    const now = Date.now();
    let deleted = 0;

    for (const session of sessions) {
      const age = now - session.created.getTime();
      if (age > maxAge) {
        await this.deleteSession(session.id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Check if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      const metadataPath = join(sessionPath, 'metadata.json');
      return existsSync(metadataPath);
    } catch {
      return false;
    }
  }

  /**
   * Get session size in bytes
   */
  async getSessionSize(sessionId: string): Promise<number> {
    const sessionPath = this.getSessionPath(sessionId);
    return await this.getDirectorySize(sessionPath);
  }

  /**
   * Calculate directory size recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    if (!existsSync(dirPath)) {
      return 0;
    }

    let size = 0;
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        size += await this.getDirectorySize(fullPath);
      } else {
        const stats = await stat(fullPath);
        size += stats.size;
      }
    }

    return size;
  }
}

// Singleton instance
let storageInstance: FileStorage | null = null;

/**
 * Get or create the global storage instance
 */
export function getStorage(): FileStorage {
  if (!storageInstance) {
    storageInstance = new FileStorage();
    // Initialize on first access
    storageInstance.initialize().catch(console.error);
  }
  return storageInstance;
}
