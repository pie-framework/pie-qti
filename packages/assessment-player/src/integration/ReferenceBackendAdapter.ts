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
	buildOutcomeProcessingAst,
	DeclarationContext,
	type DeclarationMap,
	evalExpr,
	execProgram,
	OperatorRegistry,
	parseXml,
	serializeXml,
	type QtiValue,
	qtiNull,
	qtiValue,
} from '@pie-qti/qti-processing';
import {
	createResolvedItemDeliveryContext,
	extractAssessmentStimulusRefs,
	resolveRelativePath as resolveQtiRelativePath,
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
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	SessionId,
	SubmitResponsesRequest,
	SubmitResponsesResponse,
} from './api-contract.js';
import { scoreAssessmentItem } from './assessment-item-scorer.js';

/**
 * Storage key prefix for localStorage
 */
const STORAGE_PREFIX = 'qti_session_';

/**
 * Cache key for item bank queries
 */
const BANK_CACHE_PREFIX = 'qti_bank_cache_';

function toCanonicalQtiName(name: string | null | undefined): string {
	const withoutPrefix = (name ?? '').replace(/^qti-/, '');
	return withoutPrefix.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

const qtiElementNameMapper = {
	version: 'qti2x-or-qti3',
	toCanonical: (elementName: string) => toCanonicalQtiName(elementName).toLowerCase(),
	toNative: (canonicalName: string) => canonicalName,
	isValidElementName: () => true,
};

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

		const state: AssessmentSessionState = {
			currentItemIdentifier: assessment.testParts[0].sections[0].assessmentItemRefs[0].identifier,
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
		const result = scoreAssessmentItem({ itemXml, responses: request.responses, itemSession: request.itemSession });

		// Store responses and result
		session.state.itemResponses[request.itemIdentifier] = request.responses;
		if (!session.state.itemScores) {
			session.state.itemScores = {};
		}
		session.state.itemScores[request.itemIdentifier] = result;
		if (request.itemSession) {
			session.state.itemSessions = {
				...(session.state.itemSessions ?? {}),
				[request.itemIdentifier]: request.itemSession,
			};
		}
		const previousItemSession = session.state.itemSessionStates?.[request.itemIdentifier];
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

		const order = this.getItemOrder(session.assessment);
		const idx = order.indexOf(request.itemIdentifier);
		let nextItemIdentifier: string | undefined = idx >= 0 ? order[idx + 1] : undefined;

		// QTI branchRule evaluation (backend-authoritative).
		// Evaluate each rule in order; the first matching rule determines the next item.
		// Special targets EXIT_TEST / EXIT_TESTPART / EXIT_SECTION are returned as-is for
		// the client to interpret.
		const itemRef = this.findItemRef(session.assessment, request.itemIdentifier);
		if (itemRef?.branchRule && itemRef.branchRule.length > 0) {
			const outcomeVars: Record<string, unknown> = {
				...result.outcomeValues,
				SCORE: result.score,
			};
			nextItemIdentifier = undefined; // reset — branch rules take full control
			for (const rule of itemRef.branchRule) {
				const matches = rule.conditionXml
					? this.evaluateConditionXml(rule.conditionXml, outcomeVars)
					: true; // unconditional branch
				if (matches) {
					nextItemIdentifier = rule.target;
					break;
				}
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
		const outcomes = this.runOutcomeProcessing(session.assessment, itemScores);
		const totalScore = outcomes !== null ? (outcomes['SCORE_TOTAL'] ?? outcomes['SCORE'] ?? fallbackTotal) as number : fallbackTotal;

		return {
			success: true,
			totalScore,
			maxScore,
			itemScores,
			finalizedAt: Date.now(),
		};
	}

	/**
	 * Execute test-level outcome processing (T9/T1).
	 * Returns a map of outcome variable values, or null if no outcomeProcessing is defined.
	 */
	private runOutcomeProcessing(
		assessment: SecureAssessment,
		itemScores: Record<string, AssessmentScoringResult>
	): Record<string, unknown> | null {
		if (!assessment.outcomeProcessingXml) {
			return null;
		}

		try {
			// Build declaration map from outcomeDeclarations
			const decls: DeclarationMap = {};
			for (const d of assessment.outcomeDeclarations || []) {
				const baseType = d.baseType as any;
				const cardinality = d.cardinality as any;
				let defaultQtiValue: QtiValue;
				if (d.defaultValue !== undefined) {
					defaultQtiValue = qtiValue(baseType, cardinality, d.defaultValue);
				} else if (baseType === 'float' || baseType === 'integer') {
					defaultQtiValue = qtiValue(baseType, 'single', 0);
				} else {
					defaultQtiValue = qtiNull();
				}
				decls[d.identifier] = {
					identifier: d.identifier,
					baseType,
					cardinality,
					defaultValue: defaultQtiValue,
					value: { ...defaultQtiValue },
				};
			}

			const ctx = new DeclarationContext(decls);
			const ops = new OperatorRegistry();

			// Build test items array for testVariables expression
			const testItems = Object.entries(itemScores).map(([id, scoring]) => ({
				identifier: id,
				variables: {
					SCORE: qtiValue('float', 'single', scoring.score),
					// Add any other outcome values from the scoring result
					...Object.fromEntries(
						Object.entries(scoring.outcomeValues || {}).map(([k, v]) => [
							k,
							typeof v === 'number'
								? qtiValue('float', 'single', v)
								: qtiValue('string', 'single', String(v)),
						])
					),
				},
			}));

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
					rng: Math.random,
					test: { items: testItems },
				},
				program
			);

			// Extract outcome values
			const result: Record<string, unknown> = {};
			for (const d of assessment.outcomeDeclarations || []) {
				const v = ctx.getValue(d.identifier);
				if (v.kind === 'value') {
					result[d.identifier] = v.value;
				}
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

	private findItemXml(assessment: SecureAssessment, itemIdentifier: string): string | null {
		for (const part of assessment.testParts) {
			for (const section of part.sections) {
				for (const item of section.assessmentItemRefs) {
					if (item.identifier === itemIdentifier) {
						return item.itemXml;
					}
				}
			}
		}
		return null;
	}

	private findItemRef(assessment: SecureAssessment, itemIdentifier: string): SecureItemRef | null {
		for (const part of assessment.testParts) {
			for (const section of part.sections) {
				for (const item of section.assessmentItemRefs) {
					if (item.identifier === itemIdentifier) {
						return item;
					}
				}
			}
		}
		return null;
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
		} = {}
	): Promise<SecureAssessment> {
		const { role = 'candidate', itemXmlMap = {}, fileResolver, baseUrl } = options;
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
		const parseItemSessionControl = (
			el: Element
		): SecureSection['itemSessionControl'] | undefined => {
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

		const resolveAgainstBase = (href: string | undefined): string | undefined => {
			if (!href) return undefined;
			return baseUrl ? resolveQtiRelativePath(baseUrl, href) : href;
		};

		const loadText = async (href: string | undefined): Promise<string | undefined> => {
			if (!href) return undefined;
			const candidates = [href, resolveAgainstBase(href)].filter((value, index, all): value is string =>
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
			if (!itemHref || extractAssessmentStimulusRefs(itemXml).length === 0) {
				return undefined;
			}
			const stimulusXmlByPath: Record<string, string> = {};
			for (const ref of extractAssessmentStimulusRefs(itemXml)) {
				const stimulusPath = resolveQtiRelativePath(itemHref, ref.href);
				const stimulusXml = await loadText(stimulusPath);
				if (stimulusXml) {
					stimulusXmlByPath[stimulusPath] = stimulusXml;
				}
			}
			return createResolvedItemDeliveryContext({
				itemXml,
				itemHref,
				readText: (path) => stimulusXmlByPath[path] ?? itemXmlMap[path],
			});
		};

		// Parse a single assessmentSection element
		const parseSection = async (sectionEl: Element): Promise<SecureSection> => {
			const identifier = getAttr(sectionEl, 'identifier') ?? 'section';
			const title = getAttr(sectionEl, 'title');
			const visibleRaw = getAttr(sectionEl, 'visible');
			const visible = visibleRaw === undefined ? true : visibleRaw !== 'false';

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

			// assessmentItemRefs
			const itemRefEls = childrenByTag(sectionEl, 'assessmentItemRef');
			const assessmentItemRefs: SecureItemRef[] = [];
			for (const ref of itemRefEls) {
				const itemId = getAttr(ref, 'identifier') ?? 'item';
				const href = getAttr(ref, 'href');
				const itemHref = resolveAgainstBase(href) ?? href;
				// Look up pre-loaded XML by identifier or href
				const resolvedXml = itemXmlMap[itemId] ?? (href ? itemXmlMap[href] : undefined) ?? (itemHref ? itemXmlMap[itemHref] : undefined) ?? (await loadText(href)) ?? '';
				const requiredRaw = getAttr(ref, 'required');
				const required = requiredRaw === undefined ? undefined : requiredRaw !== 'false';
				assessmentItemRefs.push({
					identifier: itemId,
					itemXml: resolvedXml,
					role,
					required,
					timeLimits: parseTimeLimits(ref),
					deliveryContext: await buildDeliveryContext(resolvedXml, itemHref),
				});
			}

			return {
				identifier,
				title,
				visible,
				assessmentItemRefs,
				rubricBlocks,
				itemSessionControl,
				timeLimits,
			};
		};

		// Resolve assessmentSectionRef: load and parse referenced section file
		const resolveSectionRef = async (sectionRefEl: Element): Promise<SecureSection | null> => {
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
				const sectionXml = await fileResolver(href);
				const secDoc = parseXml(sectionXml);
				const secRoot = secDoc.documentElement;
				if (!secRoot || toCanonicalQtiName(secRoot.localName) !== 'assessmentSection') {
					console.warn(
						`[ReferenceBackendAdapter] assessmentSectionRef href="${href}": root element is not <assessmentSection>, skipping`
					);
					return null;
				}
				return parseSection(secRoot);
			} catch (err) {
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

		// Parse testPart-level itemSessionControl
		const parseTestPartItemSessionControl = (
			testPartEl: Element
		): SecureTestPart['itemSessionControl'] | undefined => {
			const isc = childrenByTag(testPartEl, 'itemSessionControl')[0];
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

		// Extract assessment-level timeLimits.
		const timeLimits = parseTimeLimits(root);

		// Parse testParts
		const testPartEls = childrenByTag(root, 'testPart');
		const firstTestPart = testPartEls[0];

		// Navigation/submission mode from first testPart (QTI 2.2 spec)
		const navigationMode = (getAttr(firstTestPart ?? root, 'navigationMode') ?? 'nonlinear') as
			| 'linear'
			| 'nonlinear';
		const submissionMode = (getAttr(firstTestPart ?? root, 'submissionMode') ?? 'simultaneous') as
			| 'individual'
			| 'simultaneous';

		const testParts: SecureTestPart[] = [];
		for (const tp of testPartEls) {
			const tpIdentifier = getAttr(tp, 'identifier') ?? 'part-1';
			const tpItemSessionControl = parseTestPartItemSessionControl(tp);
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
				sections,
				rubricBlocks: tpRubricBlocks,
				itemSessionControl: tpItemSessionControl,
				timeLimits: tpTimeLimits,
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
			baseUrl,
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
				for (const item of section.assessmentItemRefs || []) {
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
