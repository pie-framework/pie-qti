/**
 * Session Storage Tests
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FilesystemBackend } from '../src/backends/filesystem-backend';
import { SessionStorageImpl } from '../src/session-storage';
import type { Session } from '@pie-qti/transform-types';

describe('SessionStorageImpl', () => {
	let tempDir: string;
	let backend: FilesystemBackend;
	let sessionStorage: SessionStorageImpl;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), 'session-storage-test-'),
		);
		backend = new FilesystemBackend({ rootDir: tempDir });
		await backend.initialize();
		sessionStorage = new SessionStorageImpl(backend);
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test('should generate correct session paths', () => {
		const sessionId = 'session-123';

		expect(sessionStorage.getSessionPath(sessionId)).toBe(
			'sessions/session-123',
		);
		expect(sessionStorage.getUploadsPath(sessionId)).toBe(
			'sessions/session-123/uploads',
		);
		expect(sessionStorage.getExtractedPath(sessionId)).toBe(
			'sessions/session-123/extracted',
		);
		expect(sessionStorage.getOutputsPath(sessionId)).toBe(
			'sessions/session-123/outputs',
		);
	});

	test('should generate correct paths with custom base path', () => {
		const customSessionStorage = new SessionStorageImpl(backend, {
			basePath: 'my-sessions',
		});
		const sessionId = 'session-123';

		expect(customSessionStorage.getSessionPath(sessionId)).toBe(
			'my-sessions/session-123',
		);
		expect(customSessionStorage.getUploadsPath(sessionId)).toBe(
			'my-sessions/session-123/uploads',
		);
	});

	test('should write and read session metadata', async () => {
		const sessionId = 'session-123';
		const session: Session = {
			id: sessionId,
			createdAt: new Date().toISOString(),
			status: 'analyzing',
			extractedFiles: [],
		};

		await sessionStorage.writeSessionMetadata(sessionId, session);
		const read = await sessionStorage.readSessionMetadata(sessionId);

		expect(read).toEqual(session);
	});

	test('should return null for non-existent session', async () => {
		const session = await sessionStorage.readSessionMetadata('nonexistent');
		expect(session).toBeNull();
	});

	test('should delete session', async () => {
		const sessionId = 'session-123';
		const session: Session = {
			id: sessionId,
			createdAt: new Date().toISOString(),
			status: 'complete',
			extractedFiles: [],
		};

		// Create session with some files
		await sessionStorage.writeSessionMetadata(sessionId, session);
		await backend.writeText(
			`${sessionStorage.getUploadsPath(sessionId)}/file.txt`,
			'content',
		);

		expect(await sessionStorage.readSessionMetadata(sessionId)).not.toBeNull();

		// Delete session
		await sessionStorage.deleteSession(sessionId);

		expect(await sessionStorage.readSessionMetadata(sessionId)).toBeNull();
		expect(
			await backend.exists(sessionStorage.getSessionPath(sessionId)),
		).toBe(false);
	});

	test('should list sessions', async () => {
		const session1: Session = {
			id: 'session-1',
			createdAt: new Date().toISOString(),
			status: 'complete',
			extractedFiles: [],
		};

		const session2: Session = {
			id: 'session-2',
			createdAt: new Date().toISOString(),
			status: 'analyzing',
			extractedFiles: [],
		};

		await sessionStorage.writeSessionMetadata('session-1', session1);
		await sessionStorage.writeSessionMetadata('session-2', session2);

		const sessions = await sessionStorage.listSessions();

		expect(sessions).toHaveLength(2);
		expect(sessions.map((s) => s.id)).toContain('session-1');
		expect(sessions.map((s) => s.id)).toContain('session-2');
	});

	test('should return empty array when no sessions exist', async () => {
		const sessions = await sessionStorage.listSessions();
		expect(sessions).toEqual([]);
	});

	test('should calculate session size', async () => {
		const sessionId = 'session-123';
		const session: Session = {
			id: sessionId,
			createdAt: new Date().toISOString(),
			status: 'complete',
			extractedFiles: [],
		};

		await sessionStorage.writeSessionMetadata(sessionId, session);
		await backend.writeText(
			`${sessionStorage.getUploadsPath(sessionId)}/file1.txt`,
			'Hello',
		);
		await backend.writeText(
			`${sessionStorage.getOutputsPath(sessionId)}/file2.txt`,
			'World',
		);

		const size = await sessionStorage.getSessionSize(sessionId);

		// Size should include metadata JSON + file1 (5 bytes) + file2 (5 bytes)
		expect(size).toBeGreaterThan(10);
	});

	test('should get underlying backend', () => {
		const underlyingBackend = sessionStorage.getBackend();
		expect(underlyingBackend).toBe(backend);
	});
});
