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
	buildOutcomeProcessingAst,
	DeclarationContext,
	type DeclarationMap,
	execProgram,
	OperatorRegistry,
	parseXml,
	serializeXml,
	type QtiValue,
	qtiValue,
	type TestItemState,
} from '@pie-qti/qti-processing';
import {
	createResolvedItemDeliveryContext,
	extractAssessmentStimulusRefs,
	extractProcessingIncludeRefs,
	extractQtiStylesheets,
	parseAssessmentStimulusXml,
	resolveCheckedPackagePath,
	resolveCheckedPackagePathFromFile,
} from '@pie-qti/ims-cp-core';
import { parse } from 'node-html-parser';
import type {
	AssessmentSessionState,
	AssessmentScoringResult,
	BackendAdapter,
	FinalizeAssessmentRequest,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	QueryItemBankRequest,
	QueryItemBankResponse,
	SaveAssessmentStateRequest,
	SaveAssessmentStateResponse,
	SecureAssessment,
	SecureBranchRule,
	SecureItemRef,
	SecureItemSessionControl,
	SecureSection,
	SecureTestPart,
	SessionId,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
	TestFeedbackItem,
	TestOutcomeValue,
	TestOutcomeValues,
} from './api-contract.js';
import {
	addItemVariableDeclarations,
	applyVariableMappings,
	type DeliveredItem,
	deliveredItems,
	drawAssessment,
	evaluateTestCondition,
	qtiElementNameMapper,
	resolveItemSessionControl,
	testOutcomeDeclarations,
	toCanonicalQtiName,
} from '../core/testStructure.js';
import { defaultItemTestState, type ItemTestState, scoreAssessmentItemForTest } from './assessment-item-scorer.js';

/**
 * Storage key prefix for localStorage
 */
const STORAGE_PREFIX = 'qti_session_';

/**
 * Cache key for item bank queries
 */
const BANK_CACHE_PREFIX = 'qti_bank_cache_';

class AssessmentSectionReferenceLimitError extends Error {}

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
	state: AssessmentSessionState;
	/** Created timestamp */
	createdAt: number;
	/** Finalized flag */
	finalized: boolean;
	/** Per-item variables and flags from the latest submission, read by test-level outcome processing. */
	itemTestStates?: Record<string, ItemTestState>;
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
export interface ReferenceBackendAdapterOptions {
	/** RNG for the session-start draw of selection and ordering. Defaults to Math.random. */
	rng?: () => number;
}

export class ReferenceBackendAdapter implements BackendAdapter {
	private registeredAssessments: Map<string, SecureAssessment> = new Map();
	private readonly rng: () => number;

	constructor(options: ReferenceBackendAdapterOptions = {}) {
		this.rng = options.rng ?? Math.random;
	}

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

	private hasAnyResponse(responses: Record<string, unknown>): boolean {
		for (const value of Object.values(responses)) {
			if (value == null) continue;
			if (Array.isArray(value)) {
				if (value.length > 0) return true;
				continue;
			}
			if (typeof value === 'string') {
				if (value.trim().length > 0) return true;
				continue;
			}
			return true;
		}
		return false;
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
					outcomes: this.currentOutcomes(stored),
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
		// For reference implementation, we'll use demo data. Selection and ordering are drawn once
		// here; the stored draw is what a resume returns.
		const assessment = drawAssessment(this.getAssessment(request.assessmentId), this.rng);
		const firstItemIdentifier =
			this.firstEligibleItem(assessment, deliveredItems(assessment), 0, undefined, testOutcomeDeclarations(assessment)) ?? '';

		const state: AssessmentSessionState = {
			currentItemIdentifier: firstItemIdentifier,
			visitedItems: [],
			itemResponses: {},
			itemScores: {},
			itemSessions: {},
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
			currentItemIdentifier: firstItemIdentifier || undefined,
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

		const receivedAt = Date.now();
		const assessmentLimit = session.assessment.timeLimits;
		const effectiveAssessmentLimitSeconds =
			request.timing?.scope === 'assessment' && request.timing.limitSeconds !== undefined
				? request.timing.limitSeconds
				: assessmentLimit?.maxTime;
		const assessmentAllowsLate = assessmentLimit?.allowLateSubmission ?? request.timing?.allowLateSubmission;
		if (
			effectiveAssessmentLimitSeconds !== undefined &&
			assessmentAllowsLate !== true &&
			receivedAt - session.createdAt > effectiveAssessmentLimitSeconds * 1000
		) {
			return {
				success: false,
				error: 'Assessment time limit expired',
			};
		}

		const evidenceExpired =
			request.timing?.limitSeconds !== undefined &&
			request.timing.elapsedMs >= request.timing.limitSeconds * 1000;
		if (evidenceExpired && request.timing?.allowLateSubmission !== true) {
			return {
				success: false,
				error: 'Time limit expired',
			};
		}

		const delivered = deliveredItems(session.assessment);
		const index = delivered.findIndex((d) => d.item.identifier === request.itemIdentifier);
		const current = delivered[index];
		if (!current) {
			return {
				success: false,
				error: 'Item not found',
			};
		}
		const itemXml = current.item.itemXml;
		const control = resolveItemSessionControl(current.testPart, current.sections, current.item);
		const previousItemSession = session.state.itemSessionStates?.[request.itemIdentifier];
		if (control.maxAttempts > 0 && (previousItemSession?.attemptCount ?? 0) >= control.maxAttempts) {
			return {
				success: false,
				error: 'Maximum attempts reached',
			};
		}
		if (request.comment !== undefined && !control.allowComment) {
			return {
				success: false,
				error: 'Comments are not allowed for this item',
			};
		}

		// **SECURITY WARNING**: Client-side scoring is INSECURE
		// In production, this MUST be done server-side
		const { result, testState } = scoreAssessmentItemForTest({
			itemXml,
			responses: request.responses,
			itemSession: request.itemSession,
		});

		// Store responses and result
		session.state.itemResponses[request.itemIdentifier] = request.responses;
		if (!session.state.itemScores) {
			session.state.itemScores = {};
		}
		session.state.itemScores[request.itemIdentifier] = result;
		if (testState) {
			session.itemTestStates = { ...(session.itemTestStates ?? {}), [request.itemIdentifier]: testState };
		} else if (session.itemTestStates) {
			delete session.itemTestStates[request.itemIdentifier];
		}
		if (request.itemSession) {
			session.state.itemSessions = {
				...(session.state.itemSessions ?? {}),
				[request.itemIdentifier]: request.itemSession,
			};
		}
		if (request.comment !== undefined) {
			session.state.itemComments = { ...(session.state.itemComments ?? {}), [request.itemIdentifier]: request.comment };
		}
		session.state.itemSessionStates = {
			...(session.state.itemSessionStates ?? {}),
			[request.itemIdentifier]: {
				itemIdentifier: request.itemIdentifier,
				attemptCount: (previousItemSession?.attemptCount ?? 0) + 1,
				isAnswered: this.hasAnyResponse(request.responses),
				isSubmitted: true,
				lastSubmissionTime: request.submittedAt,
			},
		};

		// Update timing
		if (request.timeSpent) {
			session.state.timing.itemTimes[request.itemIdentifier] = request.timeSpent;
		}

		// Add to visited items if not already there
		if (!session.state.visitedItems.includes(request.itemIdentifier)) {
			session.state.visitedItems.push(request.itemIdentifier);
		}

		this.saveSession(session);

		const outcomes = this.currentOutcomes(session);
		const currentVariables = testState?.variables ?? this.scoredItemVariables(result);
		const decls = this.navigationDeclarations(session, outcomes, {
			...applyVariableMappings(currentVariables, current.item.variableMappings),
			...(currentVariables.SCORE ? {} : { SCORE: qtiValue('float', 'single', result.score) }),
		});
		const nextItemIdentifier = this.nextItemIdentifier(session.assessment, delivered, index, decls);

		return {
			success: true,
			result,
			nextItemIdentifier,
			updatedState: session.state,
			outcomes,
		};
	}

	/**
	 * Save session state (for auto-save)
	 */
	async saveState(request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse> {
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
		const fallbackTotal = Object.values(itemScores).reduce((sum, result) => sum + result.score, 0);
		const maxScore = Object.values(itemScores).reduce((sum, result) => sum + result.maxScore, 0);

		// Execute test-level outcome processing if available
		const outcomes = this.runOutcomeProcessing(session);
		const scoreOutcome = outcomes?.SCORE_TOTAL ?? outcomes?.SCORE;
		const totalScore = typeof scoreOutcome === 'number' ? scoreOutcome : fallbackTotal;

		return {
			success: true,
			totalScore,
			maxScore,
			itemScores,
			outcomes: outcomes ?? undefined,
			finalizedAt: Date.now(),
		};
	}

	/** Outcome values after the submissions so far; undefined before the first submission. */
	private currentOutcomes(session: StoredSession): TestOutcomeValues | undefined {
		if (Object.keys(session.state.itemScores ?? {}).length === 0) return undefined;
		return this.runOutcomeProcessing(session) ?? undefined;
	}

	/**
	 * Execute test-level outcome processing (T9/T1).
	 * Returns every declared outcome's value (null for NULL), or null if no outcomeProcessing is
	 * defined.
	 */
	private runOutcomeProcessing(session: StoredSession): TestOutcomeValues | null {
		const { assessment } = session;
		if (!assessment.outcomeProcessingXml) {
			return null;
		}

		try {
			const testItems = this.buildTestItems(session);
			const decls = addItemVariableDeclarations(
				testOutcomeDeclarations(assessment),
				Object.fromEntries(testItems.map((item) => [item.identifier, item.variables])),
			);
			const ctx = new DeclarationContext(decls);
			const ops = new OperatorRegistry();

			// Parse and execute outcome processing
			const opEl = parseXml(assessment.outcomeProcessingXml).documentElement;
			if (!opEl) return null;

			const program = buildOutcomeProcessingAst(opEl, {
				scope: 'test',
				elementNameMapper: qtiElementNameMapper,
			});
			execProgram(
				{
					ctx,
					ops,
					rng: this.rng,
					test: { items: testItems },
				},
				program
			);

			const result: TestOutcomeValues = {};
			for (const d of assessment.outcomeDeclarations || []) {
				const v = ctx.getValue(d.identifier);
				result[d.identifier] = v.kind === 'value' ? (v.value as TestOutcomeValue) : null;
			}
			return result;
		} catch (err) {
			console.warn('[ReferenceBackendAdapter] outcomeProcessing failed:', err);
			return null;
		}
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
					rubricBlocks: [],
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
							assessmentItemRefs: [
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

	// =========================================================================
	// STATIC: QTI TEST XML PARSER
	// =========================================================================

	/**
	 * Parse a QTI assessmentTest XML string into a SecureAssessment structure.
	 *
	 * Handles:
	 * - S1: section-level itemSessionControl
	 * - S9: assessmentSectionRef href resolution (requires fileResolver)
	 * - T9/T1: outcomeDeclarations + outcomeProcessing extraction
	 *
	 * @param testXml - Raw QTI assessmentTest XML string
	 * @param options.role - Role to assign to items (default: 'candidate')
	 * @param options.itemXmlMap - Map of item identifier -> itemXml for pre-loaded items
	 * @param options.fileResolver - Async function to load external files by relative href
	 * @param options.baseUrl - Base URL for resolving relative hrefs
	 */
	static async parseAssessmentTestXml(
		testXml: string,
		options: {
			role?: SecureItemRef['role'];
			itemXmlMap?: Record<string, string>;
			fileResolver?: (href: string) => Promise<string>;
			baseUrl?: string;
			sectionReferenceLimits?: {
				/** Maximum total inline and external assessmentSection nesting. Defaults to 32. */
				maxDepth?: number;
			};
		} = {}
	): Promise<SecureAssessment> {
		const { role = 'candidate', itemXmlMap = {}, fileResolver, baseUrl } = options;
		const maxSectionDepth = options.sectionReferenceLimits?.maxDepth ?? 32;
		if (!Number.isInteger(maxSectionDepth) || maxSectionDepth < 1) {
			throw new Error('sectionReferenceLimits.maxDepth must be a positive integer');
		}
		const doc = parseXml(testXml);
		const root = doc.documentElement;
		if (!root) throw new Error('Empty assessmentTest XML');

		const getAttr = (el: Element, name: string): string | undefined => {
			const direct = el.getAttribute(name);
			if (direct !== null && direct !== '') return direct;
			const mapped = el.getAttribute(name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
			return mapped === null || mapped === '' ? undefined : mapped;
		};

		const childElements = (el: Element): Element[] =>
			Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

		const childrenByTag = (el: Element, tag: string): Element[] =>
			childElements(el).filter((c) => toCanonicalQtiName(c.localName) === tag);

		// Parse itemSessionControl element
		const parseItemSessionControl = (el: Element): SecureItemSessionControl | undefined => {
			const isc = childrenByTag(el, 'itemSessionControl')[0];
			if (!isc) return undefined;
			const boolAttr = (name: string): boolean | undefined => {
				const v = getAttr(isc, name);
				return v === undefined ? undefined : v !== 'false';
			};
			const intAttr = (name: string): number | undefined => {
				const v = getAttr(isc, name);
				return v === undefined ? undefined : parseInt(v, 10);
			};
			return {
				maxAttempts: intAttr('maxAttempts'),
				showFeedback: boolAttr('showFeedback') ?? boolAttr('show-feedback'),
				allowReview: boolAttr('allowReview') ?? boolAttr('allow-review'),
				showSolution: boolAttr('showSolution') ?? boolAttr('show-solution'),
				allowComment: boolAttr('allowComment') ?? boolAttr('allow-comment'),
				allowSkipping: boolAttr('allowSkipping') ?? boolAttr('allow-skipping'),
				validateResponses: boolAttr('validateResponses') ?? boolAttr('validate-responses'),
			};
		};

		const parseTimeLimits = (el: Element): SecureAssessment['timeLimits'] | undefined => {
			const limitsEl = childrenByTag(el, 'timeLimit')[0] ?? childrenByTag(el, 'timeLimits')[0];
			if (!limitsEl) return undefined;
			const numberAttr = (name: string): number | undefined => {
				const value = getAttr(limitsEl, name);
				if (value === undefined) return undefined;
				const parsed = Number(value);
				return Number.isFinite(parsed) ? parsed : undefined;
			};
			const boolAttr = (name: string): boolean | undefined => {
				const value = getAttr(limitsEl, name);
				return value === undefined ? undefined : value === 'true';
			};
			return {
				minTime: numberAttr('minTime'),
				maxTime: numberAttr('maxTime'),
				allowLateSubmission: boolAttr('allowLateSubmission'),
			};
		};

		const parseConditionExpressions = (el: Element, tag: string): string[] | undefined => {
			const expressions = childrenByTag(el, tag)
				.map((condition) => childElements(condition)[0])
				.filter((expression): expression is Element => Boolean(expression))
				.map((expression) => serializeXml(expression));
			return expressions.length > 0 ? expressions : undefined;
		};

		const parseBranchRules = (el: Element): SecureBranchRule[] | undefined => {
			const rules = childrenByTag(el, 'branchRule').flatMap((rule) => {
				const target = getAttr(rule, 'target');
				if (!target) return [];
				const expression = childElements(rule)[0];
				return [{ target, conditionXml: expression ? serializeXml(expression) : undefined }];
			});
			return rules.length > 0 ? rules : undefined;
		};

		const parseSelection = (el: Element): SecureSection['selection'] => {
			const selection = childrenByTag(el, 'selection')[0];
			if (!selection) return undefined;
			const select = Number.parseInt(getAttr(selection, 'select') ?? '', 10);
			if (!Number.isInteger(select) || select < 0) return undefined;
			const withReplacementRaw = getAttr(selection, 'withReplacement');
			return {
				select,
				withReplacement: withReplacementRaw === undefined ? undefined : withReplacementRaw === 'true',
			};
		};

		const parseOrdering = (el: Element): SecureSection['ordering'] => {
			const ordering = childrenByTag(el, 'ordering')[0];
			if (!ordering) return undefined;
			return { shuffle: getAttr(ordering, 'shuffle') === 'true' };
		};

		const resolveCheckedHref = (
			href: string | undefined,
			sourceHref?: string,
		): string | undefined => {
			if (!href) return undefined;
			if (sourceHref) {
				return resolveCheckedPackagePathFromFile(sourceHref, href) ?? undefined;
			}
			return baseUrl
				? resolveCheckedPackagePathFromFile(baseUrl, href) ?? undefined
				: resolveCheckedPackagePath(undefined, href) ?? undefined;
		};

		const loadText = async (
			href: string | undefined,
			sourceHref?: string,
		): Promise<string | undefined> => {
			if (!href) return undefined;
			const candidates = [href, resolveCheckedHref(href, sourceHref)].filter((value, index, all): value is string =>
				Boolean(value) && all.indexOf(value) === index
			);
			for (const candidate of candidates) {
				if (itemXmlMap[candidate] !== undefined) {
					return itemXmlMap[candidate];
				}
			}
			if (!fileResolver) return undefined;
			for (const candidate of candidates) {
				try {
					return await fileResolver(candidate);
				} catch {
					// Try the next candidate before giving up.
				}
			}
			return undefined;
		};

		const buildDeliveryContext = async (
			itemXml: string,
			itemHref: string | undefined
		): Promise<SecureItemRef['deliveryContext'] | undefined> => {
			if (!itemHref) {
				return undefined;
			}
			const stimulusXmlByPath: Record<string, string> = {};
			const packageTextByPath: Record<string, string> = {};
			const preloadText = async (baseHref: string, href: string): Promise<void> => {
				const resolvedPath = resolveCheckedPackagePathFromFile(baseHref, href);
				if (!resolvedPath) return;
				const text = await loadText(resolvedPath);
				if (text !== undefined) {
					packageTextByPath[resolvedPath] = text;
				}
			};
			for (const stylesheet of extractQtiStylesheets(itemXml)) {
				await preloadText(itemHref, stylesheet.href);
			}
			for (const ref of extractAssessmentStimulusRefs(itemXml)) {
				const stimulusPath = resolveCheckedPackagePathFromFile(itemHref, ref.href);
				if (!stimulusPath) continue;
				const stimulusXml = await loadText(stimulusPath);
				if (stimulusXml) {
					stimulusXmlByPath[stimulusPath] = stimulusXml;
					for (const stylesheet of parseAssessmentStimulusXml(stimulusXml).stylesheets) {
						await preloadText(stimulusPath, stylesheet.href);
					}
				}
			}
			// Preload external processing fragments so the item session's synchronous
			// resolver stays package-contained. Nested includes resolve relative to the
			// fragment that references them; the processing engine still validates
			// namespace, mode, depth, and cycles at build time.
			const processingFragments: Record<string, string> = {};
			const collectProcessingFragments = async (
				sourceXml: string,
				sourceHref: string,
				seen: Set<string>,
			): Promise<void> => {
				for (const includeHref of extractProcessingIncludeRefs(sourceXml)) {
					const fragmentPath = resolveCheckedPackagePathFromFile(sourceHref, includeHref);
					if (!fragmentPath || seen.has(fragmentPath)) continue;
					seen.add(fragmentPath);
					const fragmentXml = await loadText(fragmentPath);
					if (fragmentXml === undefined) continue;
					processingFragments[fragmentPath] = fragmentXml;
					await collectProcessingFragments(fragmentXml, fragmentPath, seen);
				}
			};
			const fragmentSeen = new Set<string>();
			await collectProcessingFragments(itemXml, itemHref, fragmentSeen);
			return createResolvedItemDeliveryContext({
				itemXml,
				itemHref,
				readText: (path) => packageTextByPath[path] ?? stimulusXmlByPath[path] ?? itemXmlMap[path],
				...(Object.keys(processingFragments).length > 0 ? { processingFragments } : {}),
			});
		};

		let resolveSectionRef: (
			sectionRefEl: Element,
			sourceHref?: string,
			ancestorHrefs?: readonly string[],
			depth?: number,
		) => Promise<SecureSection | null>;

		const parseItemRef = async (ref: Element, sourceHref?: string): Promise<SecureItemRef> => {
			const itemId = getAttr(ref, 'identifier') ?? 'item';
			const href = getAttr(ref, 'href');
			const itemHref = resolveCheckedHref(href, sourceHref);
			const resolvedXml = href && !itemHref
				? ''
				: itemXmlMap[itemId] ??
					(href ? itemXmlMap[href] : undefined) ??
					(itemHref ? itemXmlMap[itemHref] : undefined) ??
					(await loadText(itemHref)) ??
					'';
			const requiredRaw = getAttr(ref, 'required');
			const fixedRaw = getAttr(ref, 'fixed');
			const categories = (getAttr(ref, 'category') ?? '').split(/\s+/).filter(Boolean);
			const weights = childrenByTag(ref, 'weight').flatMap((weight) => {
				const identifier = getAttr(weight, 'identifier');
				const value = Number(getAttr(weight, 'value'));
				return identifier && Number.isFinite(value) ? [{ identifier, value }] : [];
			});
			const variableMappings = childrenByTag(ref, 'variableMapping').flatMap((mapping) => {
				const sourceIdentifier = getAttr(mapping, 'sourceIdentifier');
				const targetIdentifier = getAttr(mapping, 'targetIdentifier');
				return sourceIdentifier && targetIdentifier ? [{ sourceIdentifier, targetIdentifier }] : [];
			});
			const templateDefaults = childrenByTag(ref, 'templateDefault').flatMap((templateDefault) => {
				const templateIdentifier = getAttr(templateDefault, 'templateIdentifier');
				const expression = childElements(templateDefault)[0];
				return templateIdentifier && expression
					? [{ templateIdentifier, expressionXml: serializeXml(expression) }]
					: [];
			});
			return {
				identifier: itemId,
				itemXml: resolvedXml,
				role,
				required: requiredRaw === undefined ? undefined : requiredRaw !== 'false',
				fixed: fixedRaw === undefined ? undefined : fixedRaw !== 'false',
				timeLimits: parseTimeLimits(ref),
				deliveryContext: await buildDeliveryContext(resolvedXml, itemHref),
				branchRule: parseBranchRules(ref),
				preConditions: parseConditionExpressions(ref, 'preCondition'),
				weights: weights.length > 0 ? weights : undefined,
				categories: categories.length > 0 ? categories : undefined,
				itemSessionControl: parseItemSessionControl(ref),
				variableMappings: variableMappings.length > 0 ? variableMappings : undefined,
				templateDefaults: templateDefaults.length > 0 ? templateDefaults : undefined,
			};
		};

		// Parse a single assessmentSection element without flattening nested sections.
		const parseSection = async (
			sectionEl: Element,
			sourceHref?: string,
			ancestorHrefs: readonly string[] = [],
			depth = 1,
		): Promise<SecureSection> => {
			const identifier = getAttr(sectionEl, 'identifier') ?? 'section';
			if (depth > maxSectionDepth) {
				throw new AssessmentSectionReferenceLimitError(
					`assessmentSection nesting exceeds maxDepth (${maxSectionDepth}) at "${identifier}"`,
				);
			}
			const title = getAttr(sectionEl, 'title');
			const visibleRaw = getAttr(sectionEl, 'visible');
			const visible = visibleRaw === undefined ? true : visibleRaw !== 'false';
			const requiredRaw = getAttr(sectionEl, 'required');
			const fixedRaw = getAttr(sectionEl, 'fixed');
			const keepTogetherRaw = getAttr(sectionEl, 'keepTogether');

			const itemSessionControl = parseItemSessionControl(sectionEl);
			const timeLimits = parseTimeLimits(sectionEl);

			// rubricBlocks
			const rubricBlockEls = childrenByTag(sectionEl, 'rubricBlock');
			const rubricBlocks = rubricBlockEls.length > 0
				? rubricBlockEls.map((b, idx) => ({
					identifier: getAttr(b, 'identifier') ?? `${identifier}-rubric-${idx + 1}`,
					view: (getAttr(b, 'view') ?? 'candidate').split(/\s+/).filter(Boolean) as any[],
					use: getAttr(b, 'use'),
					content: serializeXml(b),
				}))
				: undefined;

			const assessmentItemRefs: SecureItemRef[] = [];
			const sections: SecureSection[] = [];
			const children: NonNullable<SecureSection['children']> = [];
			for (const child of childElements(sectionEl)) {
				const name = toCanonicalQtiName(child.localName);
				if (name === 'assessmentItemRef') {
					const item = await parseItemRef(child, sourceHref);
					assessmentItemRefs.push(item);
					children.push({ type: 'item', item });
				} else if (name === 'assessmentSection') {
					const section = await parseSection(child, sourceHref, ancestorHrefs, depth + 1);
					sections.push(section);
					children.push({ type: 'section', section });
				} else if (name === 'assessmentSectionRef') {
					const section = await resolveSectionRef(child, sourceHref, ancestorHrefs, depth + 1);
					if (section) {
						sections.push(section);
						children.push({ type: 'section', section });
					}
				}
			}

			return {
				identifier,
				title,
				visible,
				required: requiredRaw === undefined ? undefined : requiredRaw !== 'false',
				fixed: fixedRaw === undefined ? undefined : fixedRaw !== 'false',
				assessmentItemRefs,
				sections: sections.length > 0 ? sections : undefined,
				children: children.length > 0 ? children : undefined,
				rubricBlocks,
				itemSessionControl,
				timeLimits,
				selection: parseSelection(sectionEl),
				ordering: parseOrdering(sectionEl),
				preConditions: parseConditionExpressions(sectionEl, 'preCondition'),
				branchRule: parseBranchRules(sectionEl),
				keepTogether: keepTogetherRaw === undefined ? undefined : keepTogetherRaw !== 'false',
			};
		};

		// Resolve assessmentSectionRef: load and parse referenced section file
		resolveSectionRef = async (
			sectionRefEl: Element,
			sourceHref?: string,
			ancestorHrefs: readonly string[] = [],
			depth = 1,
		): Promise<SecureSection | null> => {
			const href = getAttr(sectionRefEl, 'href');
			if (!href) {
				console.warn('[ReferenceBackendAdapter] assessmentSectionRef missing href, skipping');
				return null;
			}

			if (!fileResolver) {
				console.warn(
					`[ReferenceBackendAdapter] assessmentSectionRef href="${href}" found but no fileResolver provided, skipping`
				);
				return null;
			}

			try {
				const resolvedHref = resolveCheckedHref(href, sourceHref);
				if (!resolvedHref) {
					console.warn(`[ReferenceBackendAdapter] assessmentSectionRef href="${href}" is unsafe, skipping`);
					return null;
				}
				if (ancestorHrefs.includes(resolvedHref)) {
					throw new AssessmentSectionReferenceLimitError(
						`Cyclic assessmentSectionRef detected: ${[...ancestorHrefs, resolvedHref].join(' -> ')}`,
					);
				}
				if (depth > maxSectionDepth) {
					throw new AssessmentSectionReferenceLimitError(
						`assessmentSectionRef nesting exceeds maxDepth (${maxSectionDepth}) at "${resolvedHref}"`,
					);
				}
				const sectionXml = await fileResolver(resolvedHref);
				const secDoc = parseXml(sectionXml);
				const secRoot = secDoc.documentElement;
				if (!secRoot || toCanonicalQtiName(secRoot.localName) !== 'assessmentSection') {
					console.warn(
						`[ReferenceBackendAdapter] assessmentSectionRef href="${href}": root element is not <assessmentSection>, skipping`
					);
					return null;
				}
				return parseSection(secRoot, resolvedHref, [...ancestorHrefs, resolvedHref], depth);
			} catch (err) {
				if (err instanceof AssessmentSectionReferenceLimitError) throw err;
				console.warn(
					`[ReferenceBackendAdapter] Failed to load assessmentSectionRef href="${href}":`,
					err
				);
				return null;
			}
		};

		// Parse testPart children (sections + sectionRefs)
		const parseSectionsForTestPart = async (testPartEl: Element): Promise<SecureSection[]> => {
			const sections: SecureSection[] = [];
			for (const child of childElements(testPartEl)) {
				if (toCanonicalQtiName(child.localName) === 'assessmentSection') {
					sections.push(await parseSection(child));
				} else if (toCanonicalQtiName(child.localName) === 'assessmentSectionRef') {
					const resolved = await resolveSectionRef(child);
					if (resolved) sections.push(resolved);
				}
			}
			return sections;
		};

		// Extract outcomeDeclarations
		const outcomeDeclarations = childrenByTag(root, 'outcomeDeclaration').map((d) => {
			const identifier = getAttr(d, 'identifier') ?? 'OUTCOME';
			const baseType = getAttr(d, 'baseType') ?? 'float';
			const cardinality = getAttr(d, 'cardinality') ?? 'single';
			// Parse defaultValue if present
			const defaultValueEl = childrenByTag(d, 'defaultValue')[0];
			let defaultValue: unknown = undefined;
			if (defaultValueEl) {
				const valueEl = childrenByTag(defaultValueEl, 'value')[0];
				if (valueEl) {
					const text = valueEl.textContent?.trim() ?? '0';
					if (baseType === 'float' || baseType === 'integer') {
						defaultValue = Number(text);
					} else {
						defaultValue = text;
					}
				}
			}
			return { identifier, baseType, cardinality, defaultValue };
		});

		// Extract outcomeProcessing XML
		const outcomeProcessingEl = childrenByTag(root, 'outcomeProcessing')[0];
		const outcomeProcessingXml = outcomeProcessingEl
			? serializeXml(outcomeProcessingEl)
			: undefined;
		// QTI 3 wraps testFeedback content in qti-content-body.
		const parseTestFeedback = (parent: Element): TestFeedbackItem[] | undefined => {
			const items = childrenByTag(parent, 'testFeedback').flatMap((feedback, index) => {
				const outcomeIdentifier = getAttr(feedback, 'outcomeIdentifier');
				if (!outcomeIdentifier) return [];
				const body = childrenByTag(feedback, 'contentBody')[0] ?? feedback;
				const content = Array.from(body.childNodes).map((node) => serializeXml(node)).join('');
				return [{
					identifier: getAttr(feedback, 'identifier') ?? `test-feedback-${index + 1}`,
					outcomeIdentifier,
					showHide: (getAttr(feedback, 'showHide') ?? 'show') as 'show' | 'hide',
					access: (getAttr(feedback, 'access') ?? 'atEnd') as 'atEnd' | 'during',
					content,
				}];
			});
			return items.length > 0 ? items : undefined;
		};
		const testFeedback = parseTestFeedback(root);

		// Extract assessment-level timeLimits.
		const timeLimits = parseTimeLimits(root);

		// Parse testParts
		const testPartEls = childrenByTag(root, 'testPart');
		const firstTestPart = testPartEls[0];

		// Retain top-level compatibility fields while preserving the authoritative
		// mode on every testPart below.
		const navigationMode = (getAttr(firstTestPart ?? root, 'navigationMode') ?? 'nonlinear') as
			| 'linear'
			| 'nonlinear';
		const submissionMode = (getAttr(firstTestPart ?? root, 'submissionMode') ?? 'simultaneous') as
			| 'individual'
			| 'simultaneous';

		const testParts: SecureTestPart[] = [];
		for (const tp of testPartEls) {
			const tpIdentifier = getAttr(tp, 'identifier') ?? 'part-1';
			const tpNavigationMode = (getAttr(tp, 'navigationMode') ?? 'nonlinear') as 'linear' | 'nonlinear';
			const tpSubmissionMode = (getAttr(tp, 'submissionMode') ?? 'simultaneous') as
				| 'individual'
				| 'simultaneous';
			const tpItemSessionControl = parseItemSessionControl(tp);
			const tpTimeLimits = parseTimeLimits(tp);
			const tpRubricBlockEls = childrenByTag(tp, 'rubricBlock');
			const tpRubricBlocks = tpRubricBlockEls.length > 0
				? tpRubricBlockEls.map((b, idx) => ({
					identifier: getAttr(b, 'identifier') ?? `${tpIdentifier}-rubric-${idx + 1}`,
					view: (getAttr(b, 'view') ?? 'candidate').split(/\s+/).filter(Boolean) as any[],
					use: getAttr(b, 'use'),
					content: serializeXml(b),
				}))
				: undefined;

			const sections = await parseSectionsForTestPart(tp);
			testParts.push({
				identifier: tpIdentifier,
				navigationMode: tpNavigationMode,
				submissionMode: tpSubmissionMode,
				sections,
				rubricBlocks: tpRubricBlocks,
				testFeedback: parseTestFeedback(tp),
				itemSessionControl: tpItemSessionControl,
				timeLimits: tpTimeLimits,
				preConditions: parseConditionExpressions(tp, 'preCondition'),
				branchRule: parseBranchRules(tp),
			});
		}

		// If no testParts, try top-level sections
		if (testParts.length === 0) {
			const topSections: SecureSection[] = [];
			for (const child of childElements(root)) {
				if (toCanonicalQtiName(child.localName) === 'assessmentSection') {
					topSections.push(await parseSection(child));
				} else if (toCanonicalQtiName(child.localName) === 'assessmentSectionRef') {
					const resolved = await resolveSectionRef(child);
					if (resolved) topSections.push(resolved);
				}
			}
			if (topSections.length > 0) {
				testParts.push({
					identifier: 'part-1',
					navigationMode,
					submissionMode,
					sections: topSections,
				});
			}
		}

		return {
			identifier: getAttr(root, 'identifier') ?? 'assessment',
			title: getAttr(root, 'title') ?? 'Assessment',
			navigationMode,
			submissionMode,
			testParts,
			timeLimits,
			outcomeDeclarations: outcomeDeclarations.length > 0 ? outcomeDeclarations : undefined,
			outcomeProcessingXml,
			testFeedback,
			baseUrl,
		};
	}

	/**
	 * Context for branch rules and preconditions: test outcomes, every submitted item's variables as
	 * `itemIdentifier.VARIABLE`, and `current` unprefixed where the test declares no such outcome.
	 */
	private navigationDeclarations(
		session: StoredSession,
		outcomes: TestOutcomeValues | undefined,
		current: Record<string, QtiValue> = {},
	): DeclarationMap {
		const itemVariables: Record<string, Record<string, QtiValue>> = {};
		for (const { item } of deliveredItems(session.assessment)) {
			const variables = session.itemTestStates?.[item.identifier]?.variables;
			if (variables) itemVariables[item.identifier] = applyVariableMappings(variables, item.variableMappings);
		}
		return addItemVariableDeclarations(testOutcomeDeclarations(session.assessment, outcomes), itemVariables, current);
	}

	/**
	 * Next item after `delivered[index]`. Branch rules come first: the item's, then each enclosing
	 * section's it ends (inner to outer), then the test part's when it ends that too. Item and
	 * section rules apply in linear navigation only. With no matching rule, navigation falls through
	 * to the following item. Preconditions then skip forward from the target. EXIT_TEST means the
	 * remaining items are all skipped; undefined means the current item was the last.
	 */
	private nextItemIdentifier(
		assessment: SecureAssessment,
		delivered: DeliveredItem[],
		index: number,
		decls: DeclarationMap,
	): string | undefined {
		const start = this.branchTarget(assessment, delivered, index, decls) ?? index + 1;
		const next = this.firstEligibleItem(assessment, delivered, start, delivered[index], decls);
		return next ?? (index + 1 < delivered.length ? 'EXIT_TEST' : undefined);
	}

	private branchTarget(
		assessment: SecureAssessment,
		delivered: DeliveredItem[],
		index: number,
		decls: DeclarationMap,
	): number | undefined {
		const current = delivered[index]!;
		const following = delivered[index + 1];
		const linear = this.isLinear(assessment, current.testPart);
		const holders: Array<{ rules?: SecureBranchRule[]; exitSection?: SecureSection }> = [];
		if (linear) {
			holders.push({ rules: current.item.branchRule, exitSection: current.sections[current.sections.length - 1] });
			for (let level = current.sections.length - 1; level >= 0; level--) {
				const section = current.sections[level]!;
				if (following?.sections.includes(section)) break;
				holders.push({ rules: section.branchRule, exitSection: current.sections[level - 1] });
			}
		}
		if (following?.testPart !== current.testPart) holders.push({ rules: current.testPart.branchRule });

		for (const { rules, exitSection } of holders) {
			for (const rule of rules ?? []) {
				if (rule.conditionXml && !evaluateTestCondition(rule.conditionXml, decls, this.rng)) continue;
				const target = this.resolveBranchTarget(rule.target, delivered, index, exitSection);
				if (target !== undefined) return target;
			}
		}
		return undefined;
	}

	/** Index a branch target resolves to, forward of `index`; delivered.length ends the test. */
	private resolveBranchTarget(
		target: string,
		delivered: DeliveredItem[],
		index: number,
		exitSection: SecureSection | undefined,
	): number | undefined {
		const current = delivered[index]!;
		const firstAfter = (match: (d: DeliveredItem) => boolean): number | undefined => {
			for (let j = index + 1; j < delivered.length; j++) if (match(delivered[j]!)) return j;
			return undefined;
		};
		switch (target) {
			case 'EXIT_TEST':
				return delivered.length;
			case 'EXIT_TESTPART':
				return firstAfter((d) => d.testPart !== current.testPart) ?? delivered.length;
			case 'EXIT_SECTION':
				if (!exitSection) return undefined;
				return firstAfter((d) => !d.sections.includes(exitSection)) ?? delivered.length;
			default:
				return (
					firstAfter((d) => d.item.identifier === target) ??
					firstAfter((d) => d.sections.some((section) => section.identifier === target)) ??
					firstAfter((d) => d.testPart.identifier === target)
				);
		}
	}

	/**
	 * First item from `start` whose preconditions hold. A test part's are checked on entering it in
	 * any navigation mode; a newly entered section's (outermost first) and the item's only in linear
	 * navigation. A failing part or section skips everything inside it.
	 */
	private firstEligibleItem(
		assessment: SecureAssessment,
		delivered: DeliveredItem[],
		start: number,
		from: DeliveredItem | undefined,
		decls: DeclarationMap,
	): string | undefined {
		const holds = (conditions: string[] | undefined): boolean =>
			(conditions ?? []).every((condition) => evaluateTestCondition(condition, decls, this.rng));
		const skipPast = (j: number, inside: (d: DeliveredItem) => boolean): number => {
			let next = j + 1;
			while (next < delivered.length && inside(delivered[next]!)) next++;
			return next;
		};
		let j = start;
		candidates: while (j < delivered.length) {
			const candidate = delivered[j]!;
			const previous = j === start ? from : delivered[j - 1];
			if (candidate.testPart !== previous?.testPart && !holds(candidate.testPart.preConditions)) {
				j = skipPast(j, (d) => d.testPart === candidate.testPart);
				continue;
			}
			if (this.isLinear(assessment, candidate.testPart)) {
				for (const section of candidate.sections) {
					if (previous?.sections.includes(section) || holds(section.preConditions)) continue;
					j = skipPast(j, (d) => d.sections.includes(section));
					continue candidates;
				}
				if (!holds(candidate.item.preConditions)) {
					j++;
					continue;
				}
			}
			return candidate.item.identifier;
		}
		return undefined;
	}

	private isLinear(assessment: SecureAssessment, testPart: SecureTestPart): boolean {
		return (testPart.navigationMode ?? assessment.navigationMode) === 'linear';
	}

	/** Delivered item refs in order, each with the identifiers of the sections containing it (outermost first). */
	private getItemRefsInOrder(
		assessment: SecureAssessment
	): Array<{ item: SecureItemRef; sectionIdentifiers: string[] }> {
		return deliveredItems(assessment).map(({ item, sections }) => ({
			item,
			sectionIdentifiers: sections.map((section) => section.identifier),
		}));
	}

	/**
	 * Test-level view of every delivered item. Items not yet submitted carry their declared defaults
	 * and count as not presented; sessions stored before item test states existed fall back to the
	 * submitted scores, leaving correctness to SCORE/MAXSCORE inference.
	 */
	private buildTestItems(session: StoredSession): TestItemState[] {
		const itemScores = session.state.itemScores ?? {};
		return this.getItemRefsInOrder(session.assessment).map(({ item, sectionIdentifiers }) => {
			const scoring = itemScores[item.identifier];
			const presented = scoring !== undefined;
			const stored = presented ? session.itemTestStates?.[item.identifier] : undefined;
			const itemState = presented ? stored : defaultItemTestState(item.itemXml);
			const variables: Record<string, QtiValue> = {
				...(itemState?.variables ?? (scoring ? this.scoredItemVariables(scoring) : {})),
			};
			if (scoring && !variables.SCORE) variables.SCORE = qtiValue('float', 'single', scoring.score);
			Object.assign(variables, applyVariableMappings(variables, item.variableMappings));
			const legacy = presented && !stored;
			return {
				identifier: item.identifier,
				sectionIdentifiers,
				categories: item.categories,
				weights: item.weights ? Object.fromEntries(item.weights.map((w) => [w.identifier, w.value])) : undefined,
				variables,
				outcomeBounds: (itemState ?? defaultItemTestState(item.itemXml))?.outcomeBounds,
				presented,
				responded: legacy
					? this.hasAnyResponse(session.state.itemResponses[item.identifier] ?? {})
					: presented && itemState?.responded === true,
				...(legacy
					? {}
					: { correct: presented && itemState?.correct === true, incorrect: presented && itemState?.correct === false }),
				selected: true,
			};
		});
	}

	/** Variables recoverable from a scoring result alone: numbers as float, everything else as string. */
	private scoredItemVariables(scoring: AssessmentScoringResult): Record<string, QtiValue> {
		return Object.fromEntries(
			Object.entries(scoring.outcomeValues || {}).map(([k, v]) => [
				k,
				typeof v === 'number' ? qtiValue('float', 'single', v) : qtiValue('string', 'single', String(v)),
			])
		);
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
				const shuffled = shuffleArray(filteredItems, Math.random);
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

/**
 * Fisher-Yates shuffle using a provided RNG (returns a new array).
 *
 * Mirrors the helper of the same name in `core/AssessmentPlayer.ts`. Replaces a
 * `sort(() => Math.random() - 0.5)` comparator, which is not a uniform shuffle: the
 * comparator is inconsistent, so the result depends on the sort algorithm and leaves
 * elements biased toward their original positions.
 */
function shuffleArray<T>(arr: T[], rng: () => number): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
