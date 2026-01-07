/**
 * Reference Backend Adapter - localStorage Implementation
 *
 * This is a REFERENCE IMPLEMENTATION demonstrating the BackendAdapter contract.
 * It uses localStorage for persistence and performs scoring CLIENT-SIDE.
 *
 * ## Security Warning
 *
 * This implementation is INSECURE for production use because:
 * - Scoring is done client-side (can be manipulated)
 * - QTI XML with correct answers is stored in client
 * - No authentication or authorization checks
 *
 * ## Purpose
 *
 * This adapter serves as:
 * 1. Reference implementation showing the API contract
 * 2. Development/demo tool for offline testing
 * 3. Template for building secure backend adapters
 *
 * ## Production Use
 *
 * Replace this with a real backend adapter that:
 * - Stores QTI XML server-side
 * - Performs scoring server-side
 * - Validates all requests with authentication
 * - Filters sensitive data based on role
 */

import {
	buildExpression,
	DeclarationContext,
	type DeclarationMap,
	evalExpr,
	OperatorRegistry,
	parseXml,
	type QtiValue,
	qtiNull,
	qtiValue,
} from '@pie-qti/qti-processing';
import { Player } from '@pie-qti/qti2-item-player';
import { parse } from 'node-html-parser';
import type {
	BackendAdapter,
	FinalizeAssessmentRequest,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	QueryItemBankRequest,
	QueryItemBankResponse,
	SaveStateRequest,
	SaveStateResponse,
	ScoringResult,
	SecureAssessment,
	SecureItemRef,
	SessionId,
	SessionState,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
} from './api-contract.js';

/**
 * Storage key prefix for localStorage
 */
const STORAGE_PREFIX = 'qti_session_';

/**
 * Cache key for item bank queries
 */
const BANK_CACHE_PREFIX = 'qti_bank_cache_';

/**
 * Cache entry for item bank queries
 */
interface BankCacheEntry {
	items: SecureItemRef[];
	timestamp: number;
	ttl: number; // milliseconds
}

/**
 * Stored session data (includes full QTI XML - INSECURE)
 */
interface StoredSession {
	sessionId: SessionId;
	assessmentId: string;
	candidateId: string;
	/** Full assessment structure with QTI XML */
	assessment: SecureAssessment;
	/** Current state */
	state: SessionState;
	/** Created timestamp */
	createdAt: number;
	/** Finalized flag */
	finalized: boolean;
}

/**
 * Reference Backend Adapter using localStorage
 *
 * @example
 * ```typescript
 * const adapter = new ReferenceBackendAdapter();
 * const response = await adapter.initSession({
 *   assessmentId: 'test-001',
 *   candidateId: 'student-123'
 * });
 * ```
 */
export class ReferenceBackendAdapter implements BackendAdapter {
	private registeredAssessments: Map<string, SecureAssessment> = new Map();

	/**
	 * Register/override a client-provided assessment structure for a given assessmentId.
	 *
	 * This is useful for demos or web-components that supply assessment XML directly.
	 * Security: this remains a reference/demo adapter; production backends should not
	 * accept client-authored assessments.
	 */
	public registerAssessment(assessmentId: string, assessment: SecureAssessment) {
		this.registeredAssessments.set(assessmentId, assessment);
	}

	private getAssessment(assessmentId: string): SecureAssessment {
		return this.registeredAssessments.get(assessmentId) ?? this.createDemoAssessment(assessmentId);
	}

	/**
	 * Initialize a new assessment session
	 */
	async initSession(request: InitSessionRequest): Promise<InitSessionResponse> {
		// Check if resuming existing session
		if (request.resumeSessionId) {
			const stored = this.loadSession(request.resumeSessionId);
			if (stored) {
				return {
					sessionId: stored.sessionId,
					assessment: stored.assessment,
					restoredState: stored.state,
				};
			}
		}

		// Create new session
		const sessionId = this.generateSessionId(request.assessmentId, request.candidateId);

		// In a real backend, you would:
		// 1. Fetch assessment from database
		// 2. Filter QTI XML based on role
		// 3. Remove responseProcessing for candidates
		//
		// For reference implementation, we'll use demo data
		const assessment = this.getAssessment(request.assessmentId);

		const state: SessionState = {
			currentItemIdentifier: assessment.testParts[0].sections[0].items[0].identifier,
			visitedItems: [],
			itemResponses: {},
			itemScores: {},
			timing: {
				startedAt: Date.now(),
				itemTimes: {},
				totalTime: 0,
			},
		};

		const session: StoredSession = {
			sessionId,
			assessmentId: request.assessmentId,
			candidateId: request.candidateId,
			assessment,
			state,
			createdAt: Date.now(),
			finalized: false,
		};

		this.saveSession(session);

		return {
			sessionId,
			assessment,
		};
	}

	/**
	 * Submit responses and get scoring result
	 */
	async submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
		const session = this.loadSession(request.sessionId);
		if (!session) {
			return {
				success: false,
				error: 'Session not found',
			};
		}

		if (session.finalized) {
			return {
				success: false,
				error: 'Session already finalized',
			};
		}

		// Find the item XML
		const itemXml = this.findItemXml(session.assessment, request.itemIdentifier);
		if (!itemXml) {
			return {
				success: false,
				error: 'Item not found',
			};
		}

		// **SECURITY WARNING**: Client-side scoring is INSECURE
		// In production, this MUST be done server-side
		const result = this.scoreItem(itemXml, request.responses);

		// Store responses and result
		session.state.itemResponses[request.itemIdentifier] = request.responses;
		if (!session.state.itemScores) {
			session.state.itemScores = {};
		}
		session.state.itemScores[request.itemIdentifier] = result;

		// Update timing
		if (request.timeSpent) {
			session.state.timing.itemTimes[request.itemIdentifier] = request.timeSpent;
		}

		// Add to visited items if not already there
		if (!session.state.visitedItems.includes(request.itemIdentifier)) {
			session.state.visitedItems.push(request.itemIdentifier);
		}

		this.saveSession(session);

		const order = this.getItemOrder(session.assessment);
		const idx = order.indexOf(request.itemIdentifier);
		let nextItemIdentifier = idx >= 0 ? order[idx + 1] : undefined;

		// Demo branching using qti-processing (backend-authoritative). If SCORE > 0, go to item2.
		if (request.itemIdentifier === 'item1') {
			const condXml = `<gt><variable identifier="SCORE" /><baseValue baseType="float">0</baseValue></gt>`;
			if (this.evaluateConditionXml(condXml, { SCORE: result.score })) {
				nextItemIdentifier = 'item2';
			} else {
				nextItemIdentifier = undefined;
			}
		}

		return {
			success: true,
			result,
			nextItemIdentifier,
			updatedState: session.state,
		};
	}

	/**
	 * Save session state (for auto-save)
	 */
	async saveState(request: SaveStateRequest): Promise<SaveStateResponse> {
		const session = this.loadSession(request.sessionId);
		if (!session) {
			return {
				success: false,
				savedAt: Date.now(),
			};
		}

		// Update state
		session.state = request.state;
		this.saveSession(session);

		return {
			success: true,
			savedAt: Date.now(),
		};
	}

	/**
	 * Finalize assessment and compute final scores
	 */
	async finalizeAssessment(
		request: FinalizeAssessmentRequest
	): Promise<FinalizeAssessmentResponse> {
		const session = this.loadSession(request.sessionId);
		if (!session) {
			return {
				success: false,
				totalScore: 0,
				maxScore: 0,
				itemScores: {},
				finalizedAt: Date.now(),
			};
		}

		// Mark as finalized
		session.finalized = true;
		this.saveSession(session);

		// Compute total score
		const itemScores = session.state.itemScores || {};
		const totalScore = Object.values(itemScores).reduce((sum, result) => sum + result.score, 0);
		const maxScore = Object.values(itemScores).reduce((sum, result) => sum + result.maxScore, 0);

		return {
			success: true,
			totalScore,
			maxScore,
			itemScores,
			finalizedAt: Date.now(),
		};
	}

	/**
	 * Resume existing session (alias for initSession with resumeSessionId)
	 */
	async resumeSession(sessionId: SessionId): Promise<InitSessionResponse> {
		return this.initSession({
			assessmentId: '',
			candidateId: '',
			resumeSessionId: sessionId,
		});
	}

	/**
	 * Query item bank for random item selection
	 *
	 * This reference implementation:
	 * - Caches bank queries to avoid repeated calls
	 * - Implements retry logic with exponential backoff
	 * - Returns demo items (in production, fetch from real item bank)
	 *
	 * @param request - Item bank query request
	 * @returns Selected items from bank
	 */
	async queryItemBank(request: QueryItemBankRequest): Promise<QueryItemBankResponse> {
		const { sessionId, bankId, count, withReplacement, filters } = request;

		// Validate session exists
		const session = this.loadSession(sessionId);
		if (!session) {
			throw new Error(`Session not found: ${sessionId}`);
		}

		// Check cache first
		const cacheKey = this.getBankCacheKey(sessionId, bankId, count, withReplacement, filters);
		const cached = this.loadBankCache(cacheKey);
		if (cached) {
			return {
				items: cached.items,
				selectedAt: cached.timestamp,
			};
		}

		// Simulate network call with retry logic
		const items = await this.fetchItemsFromBank(bankId, count, withReplacement, filters);

		// Cache the result (5 minute TTL)
		this.saveBankCache(cacheKey, {
			items,
			timestamp: Date.now(),
			ttl: 5 * 60 * 1000, // 5 minutes
		});

		return {
			items,
			selectedAt: Date.now(),
		};
	}

	// =========================================================================
	// PRIVATE HELPERS
	// =========================================================================

	private generateSessionId(assessmentId: string, candidateId: string): SessionId {
		return `${assessmentId}:${candidateId}:${Date.now()}`;
	}

	private loadSession(sessionId: SessionId): StoredSession | null {
		try {
			const key = STORAGE_PREFIX + sessionId;
			const data = localStorage.getItem(key);
			if (!data) return null;
			return JSON.parse(data) as StoredSession;
		} catch {
			return null;
		}
	}

	private saveSession(session: StoredSession): void {
		try {
			const key = STORAGE_PREFIX + session.sessionId;
			localStorage.setItem(key, JSON.stringify(session));
		} catch (error) {
			console.error('Failed to save session to localStorage:', error);
		}
	}

	private findItemXml(assessment: SecureAssessment, itemIdentifier: string): string | null {
		for (const part of assessment.testParts) {
			for (const section of part.sections) {
				for (const item of section.items) {
					if (item.identifier === itemIdentifier) {
						return item.itemXml;
					}
				}
			}
		}
		return null;
	}

	/**
	 * Score an item using the Player
	 *
	 * **SECURITY WARNING**: This is done CLIENT-SIDE for demo purposes only.
	 * Production implementations MUST perform scoring SERVER-SIDE.
	 */
	private scoreItem(itemXml: string, responses: Record<string, any>): ScoringResult {
		try {
			// Extract identifier from XML using regex (more reliable than DOM parsing)
			const identifierMatch = itemXml.match(/assessmentItem[^>]+identifier=["']([^"']+)["']/);
			const itemIdentifier = identifierMatch?.[1] || 'unknown';

			// Use a scorer-grade view of the item for accurate scoring.
			// NOTE: This reference adapter is intentionally insecure and runs client-side.
			// In production, scoring must happen server-side with secured item content.
			const player = new Player({
				itemXml,
				role: 'scorer',
			});

			// Set responses using setResponses (plural)
			player.setResponses(responses);

			// Process and score
			const result = player.processResponses();

			return {
				itemIdentifier,
				score: result.score,
				maxScore: result.maxScore,
				completed: result.completed,
				outcomeValues: result.outcomeValues,
			};
		} catch (error) {
			console.error('Scoring error:', error);
			return {
				itemIdentifier: 'unknown',
				score: 0,
				maxScore: 1,
				completed: false,
				outcomeValues: {},
			};
		}
	}

	/**
	 * Create demo assessment for testing
	 *
	 * In production, this would fetch from database
	 */
	private createDemoAssessment(assessmentId: string): SecureAssessment {
		// This is a minimal demo assessment
		// In production, load from database and filter based on role
		return {
			identifier: assessmentId,
			title: 'Demo Assessment',
			navigationMode: 'nonlinear',
			submissionMode: 'simultaneous',
			testParts: [
				{
					identifier: 'part1',
					rubrics: [],
					itemSessionControl: {
						maxAttempts: 1,
						showFeedback: true,
						allowReview: true,
						showSolution: false,
						allowComment: false,
						allowSkipping: true,
						validateResponses: true,
					},
					sections: [
						{
							identifier: 'section1',
							title: 'Section 1',
							visible: true,
							items: [
								{
									identifier: 'item1',
									role: 'candidate',
									// In production, load from database
									// For candidates, responseProcessing should be removed server-side
									itemXml: `<assessmentItem identifier="item1" title="Sample Item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>What is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">4</simpleChoice>
      <simpleChoice identifier="B">3</simpleChoice>
      <simpleChoice identifier="C">5</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE" />
          <correct identifier="RESPONSE" />
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
								},
								{
									identifier: 'item2',
									role: 'candidate',
									itemXml: `<assessmentItem identifier="item2" title="Follow-up Item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>A</value>
    </correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>Demo follow-up item</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">ok</simpleChoice>
      <simpleChoice identifier="B">no</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE" />
          <correct identifier="RESPONSE" />
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
								},
							],
						},
					],
				},
			],
		};
	}

	private evaluateConditionXml(conditionXml: string, vars: Record<string, unknown>): boolean {
		// conditionXml is an operator element like <gt>...</gt> (not wrapped in <expression>).
		const doc = parseXml(conditionXml);
		const root = doc.documentElement;
		if (!root) return false;

		const decls: DeclarationMap = {};
		for (const [k, raw] of Object.entries(vars)) {
			let v: QtiValue = qtiNull();
			if (typeof raw === 'number') v = qtiValue('float', 'single', raw);
			else if (typeof raw === 'boolean') v = qtiValue('boolean', 'single', raw);
			else if (typeof raw === 'string') v = qtiValue('string', 'single', raw);
			decls[k] = {
				identifier: k,
				baseType: v.kind === 'value' ? v.baseType : 'string',
				cardinality: 'single',
				defaultValue: qtiNull(),
				value: v,
			};
		}

		const ctx = new DeclarationContext(decls);
		const ops = new OperatorRegistry();
		const expr = buildExpression(root, { scope: 'test' });
		const out = evalExpr({ ctx, ops, rng: Math.random }, expr);
		return out.kind === 'value' && out.baseType === 'boolean' ? Boolean(out.value) : false;
	}

	private getItemOrder(assessment: SecureAssessment): string[] {
		const out: string[] = [];
		for (const part of assessment.testParts || []) {
			for (const section of part.sections || []) {
				for (const item of section.items || []) {
					out.push(item.identifier);
				}
			}
		}
		return out;
	}

	// =========================================================================
	// ITEM BANK HELPERS
	// =========================================================================

	/**
	 * Generate cache key for item bank query
	 */
	private getBankCacheKey(
		sessionId: SessionId,
		bankId: string,
		count: number,
		withReplacement?: boolean,
		filters?: Record<string, unknown>
	): string {
		const filterKey = filters ? JSON.stringify(filters) : '';
		return `${BANK_CACHE_PREFIX}${sessionId}:${bankId}:${count}:${withReplacement}:${filterKey}`;
	}

	/**
	 * Load item bank cache from localStorage
	 */
	private loadBankCache(cacheKey: string): BankCacheEntry | null {
		try {
			const data = localStorage.getItem(cacheKey);
			if (!data) return null;

			const entry = JSON.parse(data) as BankCacheEntry;

			// Check if cache is expired
			const now = Date.now();
			if (now - entry.timestamp > entry.ttl) {
				// Clean up expired cache
				localStorage.removeItem(cacheKey);
				return null;
			}

			return entry;
		} catch {
			return null;
		}
	}

	/**
	 * Save item bank cache to localStorage
	 */
	private saveBankCache(cacheKey: string, entry: BankCacheEntry): void {
		try {
			localStorage.setItem(cacheKey, JSON.stringify(entry));
		} catch (error) {
			console.error('Failed to save bank cache to localStorage:', error);
		}
	}

	/**
	 * Fetch items from item bank with retry logic
	 *
	 * **DEMO IMPLEMENTATION**: Returns hardcoded items
	 * In production, this would make HTTP request to item bank service
	 */
	private async fetchItemsFromBank(
		bankId: string,
		count: number,
		withReplacement?: boolean,
		filters?: Record<string, unknown>,
		retryCount = 0
	): Promise<SecureItemRef[]> {
		const maxRetries = 3;
		const baseDelay = 1000; // 1 second

		try {
			// Simulate network call delay
			await this.delay(100);

			// **DEMO**: Return hardcoded items
			// In production, replace with:
			// const response = await fetch(`/api/item-banks/${bankId}`, {
			//   method: 'POST',
			//   headers: { 'Content-Type': 'application/json' },
			//   body: JSON.stringify({ count, withReplacement, filters })
			// });
			// return response.json();

			const demoItems: SecureItemRef[] = [
				{
					identifier: `bank-${bankId}-item1`,
					role: 'candidate',
					itemXml: `<assessmentItem identifier="bank-${bankId}-item1" title="Bank Item 1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>Sample question from bank ${bankId}</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">Option A</simpleChoice>
      <simpleChoice identifier="B">Option B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE" />
          <correct identifier="RESPONSE" />
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
				},
				{
					identifier: `bank-${bankId}-item2`,
					role: 'candidate',
					itemXml: `<assessmentItem identifier="bank-${bankId}-item2" title="Bank Item 2" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>Another question from bank ${bankId}</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">Option A</simpleChoice>
      <simpleChoice identifier="B">Option B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE" />
          <correct identifier="RESPONSE" />
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
				},
				{
					identifier: `bank-${bankId}-item3`,
					role: 'candidate',
					itemXml: `<assessmentItem identifier="bank-${bankId}-item3" title="Bank Item 3" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>A</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>Third question from bank ${bankId}</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">Option A</simpleChoice>
      <simpleChoice identifier="B">Option B</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE" />
          <correct identifier="RESPONSE" />
        </match>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0</baseValue>
        </setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`,
				},
			];

			// Apply filtering if specified (demo implementation)
			let filteredItems = [...demoItems];
			if (filters?.difficulty) {
				// In production, server would filter by metadata
				console.log(`Filtering by difficulty: ${filters.difficulty}`);
			}

			// Select requested number of items
			if (withReplacement) {
				// Allow duplicates
				const selected: SecureItemRef[] = [];
				for (let i = 0; i < count; i++) {
					const randomIndex = Math.floor(Math.random() * filteredItems.length);
					selected.push(filteredItems[randomIndex]);
				}
				return selected;
			} else {
				// No duplicates - shuffle and take first N
				const shuffled = [...filteredItems].sort(() => Math.random() - 0.5);
				return shuffled.slice(0, Math.min(count, shuffled.length));
			}
		} catch (error) {
			// Implement exponential backoff retry
			if (retryCount < maxRetries) {
				const delay = baseDelay * Math.pow(2, retryCount);
				console.warn(
					`Item bank query failed (attempt ${retryCount + 1}/${maxRetries + 1}). ` +
					`Retrying in ${delay}ms...`,
					error
				);
				await this.delay(delay);
				return this.fetchItemsFromBank(bankId, count, withReplacement, filters, retryCount + 1);
			}

			// All retries exhausted
			throw new Error(
				`Failed to load items from bank "${bankId}" after ${maxRetries + 1} attempts: ${error}`
			);
		}
	}

	/**
	 * Delay helper for async operations
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
