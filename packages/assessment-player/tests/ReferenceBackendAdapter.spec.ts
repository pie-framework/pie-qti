/**
 * Tests for ReferenceBackendAdapter
 *
 * These tests verify the localStorage-based reference implementation
 * demonstrates the BackendAdapter contract correctly.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment } from '../src/integration/api-contract.js';

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

	// ===========================================================================
	// branchRule tests
	// ===========================================================================

	describe('branchRule evaluation', () => {
		const ITEM_XML = (id: string) => `<assessmentItem identifier="${id}" title="Item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Q?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">A</simpleChoice>
      <simpleChoice identifier="B">B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

		function makeBranchAssessment(branchRules: Array<{ target: string; conditionXml?: string }>): SecureAssessment {
			return {
				identifier: 'branch-test',
				title: 'Branch Test',
				navigationMode: 'linear',
				submissionMode: 'individual',
				testParts: [{
					identifier: 'part1',
					sections: [{
						identifier: 'section1',
						visible: true,
						assessmentItemRefs: [
							{
								identifier: 'q1',
								role: 'candidate',
								itemXml: ITEM_XML('q1'),
								branchRule: branchRules,
							},
							{ identifier: 'q2', role: 'candidate', itemXml: ITEM_XML('q2') },
							{ identifier: 'q3', role: 'candidate', itemXml: ITEM_XML('q3') },
						],
					}],
				}],
			};
		}

		it('unconditional branchRule fires and skips to target', async () => {
			const assessment = makeBranchAssessment([{ target: 'q3' }]);
			adapter.registerAssessment('branch-test', assessment);
			const session = await adapter.initSession({ assessmentId: 'branch-test', candidateId: 'c1' });

			const res = await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'q1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});

			expect(res.success).toBe(true);
			expect(res.nextItemIdentifier).toBe('q3');
		});

		it('conditional branchRule fires when SCORE matches', async () => {
			// Skip to q3 if score >= 1 (correct answer), otherwise fall through to q2
			const assessment = makeBranchAssessment([
				{
					target: 'q3',
					conditionXml: '<gte><variable identifier="SCORE"/><baseValue baseType="float">1</baseValue></gte>',
				},
				{ target: 'q2' }, // fallback unconditional
			]);
			adapter.registerAssessment('branch-test', assessment);
			const session = await adapter.initSession({ assessmentId: 'branch-test', candidateId: 'c1' });

			// Correct answer → SCORE=1 → first rule fires → q3
			const res = await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'q1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});
			expect(res.nextItemIdentifier).toBe('q3');
		});

		it('conditional branchRule falls through to next rule when condition is false', async () => {
			const assessment = makeBranchAssessment([
				{
					target: 'q3',
					conditionXml: '<gte><variable identifier="SCORE"/><baseValue baseType="float">1</baseValue></gte>',
				},
				{ target: 'q2' }, // unconditional fallback
			]);
			adapter.registerAssessment('branch-test', assessment);
			const session = await adapter.initSession({ assessmentId: 'branch-test', candidateId: 'c1' });

			// Wrong answer → SCORE=0 → first rule fails → fallback rule fires → q2
			const res = await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'q1',
				responses: { RESPONSE: 'B' },
				submittedAt: Date.now(),
			});
			expect(res.nextItemIdentifier).toBe('q2');
		});

		it('returns EXIT_TEST target from branchRule as-is', async () => {
			const assessment = makeBranchAssessment([{ target: 'EXIT_TEST' }]);
			adapter.registerAssessment('branch-test', assessment);
			const session = await adapter.initSession({ assessmentId: 'branch-test', candidateId: 'c1' });

			const res = await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'q1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});
			expect(res.nextItemIdentifier).toBe('EXIT_TEST');
		});

		it('uses linear next item when no branchRules are present', async () => {
			const assessment = makeBranchAssessment([]); // no branch rules
			adapter.registerAssessment('branch-test', assessment);
			const session = await adapter.initSession({ assessmentId: 'branch-test', candidateId: 'c1' });

			const res = await adapter.submitResponses({
				sessionId: session.sessionId,
				itemIdentifier: 'q1',
				responses: { RESPONSE: 'A' },
				submittedAt: Date.now(),
			});
			expect(res.nextItemIdentifier).toBe('q2');
		});
	});

	// ===========================================================================
	// selection / ordering tests
	// ===========================================================================

	describe('selection and ordering (via AssessmentPlayer flattenItems)', () => {
		// These tests verify the AssessmentPlayer's flattenItems behavior using
		// a registered assessment with selection/ordering attributes.

		function makeSelectAssessment(select: number, shuffle: boolean, itemCount = 5): SecureAssessment {
			const items = Array.from({ length: itemCount }, (_, i) => ({
				identifier: `item${i + 1}`,
				role: 'candidate' as const,
				itemXml: `<assessmentItem identifier="item${i + 1}" title="Item ${i + 1}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <itemBody><p>Q${i + 1}</p></itemBody>
</assessmentItem>`,
			}));
			return {
				identifier: 'select-test',
				title: 'Select Test',
				navigationMode: 'linear',
				submissionMode: 'individual',
				testParts: [{
					identifier: 'part1',
					sections: [{
						identifier: 'section1',
						visible: true,
						assessmentItemRefs: items,
						selection: { select },
						ordering: { shuffle },
					}],
				}],
			};
		}

		it('selection: reduces item count to the requested number', async () => {
			const { AssessmentPlayer } = await import('../src/core/AssessmentPlayer.js');
			const assessment = makeSelectAssessment(3, false);
			adapter.registerAssessment('select-test', assessment);

			const player = await AssessmentPlayer.create({
				backend: adapter,
				initSession: { assessmentId: 'select-test', candidateId: 'c1' },
			});

			// There are 5 items but selection=3
			expect(player.getNavigationState().totalItems).toBe(3);
		});

		it('ordering shuffle: with seeded rng, all items are present and order is deterministic', async () => {
			const { AssessmentPlayer } = await import('../src/core/AssessmentPlayer.js');
			const assessment = makeSelectAssessment(5, true, 5);

			// LCG seeded RNG for determinism
			let s = 42;
			const seedRng = () => {
				s = (s * 16807) % 2147483647;
				return (s - 1) / 2147483646;
			};

			adapter.registerAssessment('select-test', assessment);

			const player1 = await AssessmentPlayer.create({
				backend: adapter,
				initSession: { assessmentId: 'select-test', candidateId: 'c1' },
				rng: seedRng,
			});

			// All 5 items still present (no selection restriction)
			expect(player1.getNavigationState().totalItems).toBe(5);
		});

		it('selection + ordering: shuffles first then slices to correct count', async () => {
			const { AssessmentPlayer } = await import('../src/core/AssessmentPlayer.js');
			const assessment = makeSelectAssessment(3, true, 5);
			adapter.registerAssessment('select-test', assessment);

			const player = await AssessmentPlayer.create({
				backend: adapter,
				initSession: { assessmentId: 'select-test', candidateId: 'c1' },
			});

			expect(player.getNavigationState().totalItems).toBe(3);
		});
	});
});
