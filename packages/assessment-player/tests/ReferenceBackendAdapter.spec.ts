/**
 * Tests for ReferenceBackendAdapter
 *
 * These tests verify the localStorage-based reference implementation
 * demonstrates the BackendAdapter contract correctly.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

// Mock DOM environment for web components
if (typeof globalThis.HTMLElement === 'undefined') {
	(globalThis as any).HTMLElement = class HTMLElement {
		attributes: Record<string, string> = {};
		children: any[] = [];

		setAttribute(name: string, value: string) {
			this.attributes[name] = value;
		}

		getAttribute(name: string) {
			return this.attributes[name];
		}

		addEventListener() {}
		removeEventListener() {}
		dispatchEvent() { return true; }
	};
}

// Mock localStorage for Node.js environment
class LocalStorageMock {
	private store: Map<string, string> = new Map();

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}

// Set up global localStorage mock
if (typeof globalThis.localStorage === 'undefined') {
	(globalThis as any).localStorage = new LocalStorageMock();
}

describe('ReferenceBackendAdapter', () => {
	let adapter: ReferenceBackendAdapter;

	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();
		adapter = new ReferenceBackendAdapter();
	});

	describe('initSession', () => {
		it('should create a new session', async () => {
			const response = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			expect(response.sessionId).toBeDefined();
			expect(response.sessionId).toContain('test-001');
			expect(response.sessionId).toContain('student-123');
			expect(response.assessment).toBeDefined();
			expect(response.assessment.identifier).toBe('test-001');
		});

		it('should return assessment structure', async () => {
			const response = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			expect(response.assessment.testParts).toBeDefined();
			expect(response.assessment.testParts.length).toBeGreaterThan(0);
			expect(response.assessment.testParts[0].sections).toBeDefined();
		});

		it('should resume existing session', async () => {
			// Create initial session
			const initial = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			// Resume session
			const resumed = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
				resumeSessionId: initial.sessionId,
			});

			expect(resumed.sessionId).toBe(initial.sessionId);
			expect(resumed.restoredState).toBeDefined();
		});
	});

	describe('submitResponses', () => {
		it('should score responses client-side', async () => {
			const session = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			const response = await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'item1',
				responses: { RESPONSE: 'A' }, // Correct answer from demo
				submittedAt: Date.now(),
			});

			expect(response.success).toBe(true);
			expect(response.result).toBeDefined();
			expect(response.result?.itemIdentifier).toBe('item1');
			expect(response.result?.score).toBeGreaterThan(0);
		});

		it('should score incorrect responses', async () => {
			const session = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			const response = await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'item1',
				responses: { RESPONSE: 'B' }, // Wrong answer
				submittedAt: Date.now(),
			});

			expect(response.success).toBe(true);
			expect(response.result).toBeDefined();
			expect(response.result?.score).toBe(0);
		});

		it('should fail for invalid session', async () => {
			const response = await adapter.submitResponses({
				sessionId: 'invalid-session-id',
				itemIdentifier: 'item1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});

			expect(response.success).toBe(false);
			expect(response.error).toBe('Session not found');
		});

		it('should store visited items', async () => {
			const session = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'item1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});

			// Resume and check state
			const resumed = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
				resumeSessionId: session.sessionId,
			});

			expect(resumed.restoredState?.visitedItems).toContain('item1');
		});
	});

	describe('saveState', () => {
		it('should save session state', async () => {
			const session = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			const response = await adapter.saveState({
				sessionId: session.sessionId,
				state: {
					currentItemIdentifier: 'item1',
					visitedItems: ['item1'],
					itemResponses: { item1: { RESPONSE: 'A' } },
					timing: {
						startedAt: Date.now(),
						itemTimes: { item1: 5000 },
						totalTime: 5000,
					},
				},
			});

			expect(response.success).toBe(true);
			expect(response.savedAt).toBeDefined();
		});

		it('should fail for invalid session', async () => {
			const response = await adapter.saveState({
				sessionId: 'invalid-session-id',
				state: {
					currentItemIdentifier: 'item1',
					visitedItems: [],
					itemResponses: {},
					timing: {
						startedAt: Date.now(),
						itemTimes: {},
						totalTime: 0,
					},
				},
			});

			expect(response.success).toBe(false);
		});
	});

	describe('finalizeAssessment', () => {
		it('should compute total score', async () => {
			const session = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			// Submit correct response
			await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'item1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});

			// Finalize
			const response = await adapter.finalizeAssessment({
				sessionId: session.sessionId,
			});

			expect(response.success).toBe(true);
			expect(response.totalScore).toBeGreaterThan(0);
			expect(response.maxScore).toBeGreaterThan(0);
			expect(response.itemScores.item1).toBeDefined();
			expect(response.finalizedAt).toBeDefined();
		});

		it('should prevent duplicate finalization', async () => {
			const session = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'item1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});

			// First finalization
			await adapter.finalizeAssessment({
				sessionId: session.sessionId,
			});

			// Attempt second submission after finalization
			const response = await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'item1',
				responses: { RESPONSE: 'B' },
				submittedAt: Date.now(),
			});

			expect(response.success).toBe(false);
			expect(response.error).toBe('Session already finalized');
		});
	});

	describe('resumeSession', () => {
		it('should resume session with restored state', async () => {
			const session = await adapter.initSession({
				assessmentId: 'test-001',
				candidateId: 'student-123',
			});

			await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'item1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});

			// Resume using resumeSession method
			const resumed = await adapter.resumeSession?.(session.sessionId);

			expect(resumed).toBeDefined();
			expect(resumed?.sessionId).toBe(session.sessionId);
			expect(resumed?.restoredState?.visitedItems).toContain('item1');
			expect(resumed?.restoredState?.itemResponses.item1).toBeDefined();
		});
	});
});
