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
import type {
	AssessmentSessionState,
	AssessmentScoringResult,
	BackendAdapter,
	FinalizeAssessmentRequest,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	OutcomeProcessingError,
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
	addScopeDurationDeclarations,
	applyVariableMappings,
	type DeliveredItem,
	deliveredItems,
	drawAssessment,
	evaluateTestCondition,
	qtiElementNameMapper,
	resolveItemSessionControl,
	shuffleArray,
	testOutcomeDeclarations,
	toCanonicalQtiName,
} from '../core/testStructure.js';
import { hasAnyResponse } from '../core/AssessmentSessionCoordinator.js';
import { parseAssessmentTestXml } from './qti-test-parser.js';
import {
	firstEligibleItem,
	getItemRefsInOrder,
	navigationDeclarations,
	nextItemIdentifier,
} from './test-navigation.js';
import {
	generateSessionId,
	findLatestSession,
	loadSession,
	saveSession,
	type StoredSession,
} from './session-store.js';
import { defaultItemTestState, type ItemTestState, scoreAssessmentItemForTest } from './assessment-item-scorer.js';

/**
 * Storage key prefix for localStorage
 */
const STORAGE_PREFIX = 'qti_session_';

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
	/** @see ./qti-test-parser.ts — the parser lives in its own module. */
	static parseAssessmentTestXml = parseAssessmentTestXml;
	/**
	 * The adapter persists drafts: sessions live in localStorage and `saveState` writes
	 * the candidate's snapshot into them, so shell autosave is ON by default.
	 */
	readonly canSaveState = true;
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
		return hasAnyResponse(responses);
	}

	/**
	 * Initialize a new assessment session
	 */
	async initSession(request: InitSessionRequest): Promise<InitSessionResponse> {
		// Check if resuming existing session
			if (request.resumeSessionId) {
				const stored = loadSession(request.resumeSessionId);
				if (stored) {
					// A finalized session has no resumable draft: restore terminal (the
					// stored final totals, no restoredState), so hosts show the
					// already-submitted view instead of delivery whose every submit fails.
					if (stored.finalized) {
						return {
							sessionId: stored.sessionId,
							assessment: stored.assessment,
							finalized: true,
							finalResults: this.storedFinalResults(stored),
							outcomes: this.currentOutcomes(stored).outcomes,
						};
					}
					return {
						sessionId: stored.sessionId,
						assessment: stored.assessment,
						restoredState: stored.state,
						outcomes: this.currentOutcomes(stored).outcomes,
					};
				}
			}

		// Create new session
		const sessionId = generateSessionId(request.assessmentId, request.candidateId);

		// In a real backend, you would:
		// 1. Fetch assessment from database
		// 2. Filter QTI XML based on role
		// 3. Remove responseProcessing for candidates
		//
		// For reference implementation, we'll use demo data. Selection and ordering are drawn once
		// here; the stored draw is what a resume returns.
		const assessment = drawAssessment(this.getAssessment(request.assessmentId), this.rng);
		const firstItemIdentifier =
			firstEligibleItem(assessment, deliveredItems(assessment), 0, undefined, testOutcomeDeclarations(assessment), this.rng) ?? '';

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

		saveSession(session);

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
		const session = loadSession(request.sessionId);
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
		// The candidate's own test clock (gates and pauses excluded) when the client
		// reports it; otherwise the session wall clock, which a production backend owns.
		const assessmentElapsedSeconds =
			request.timing?.assessmentElapsedMs !== undefined
				? request.timing.assessmentElapsedMs / 1000
				: (receivedAt - session.createdAt) / 1000;
		const assessmentAllowsLate = assessmentLimit?.allowLateSubmission ?? request.timing?.allowLateSubmission;
		// A `time-expired` submission is the terminal collection a hard limit triggers:
		// the window closed with the expiry, and the pending responses must be accepted.
		// A `proctor` collection is the administrative end of the test, accepted alike.
		const timeExpiredCollection =
			request.timing?.submissionReason === 'time-expired' || request.timing?.submissionReason === 'proctor';
		if (
			!timeExpiredCollection &&
			effectiveAssessmentLimitSeconds !== undefined &&
			assessmentAllowsLate !== true &&
			assessmentElapsedSeconds > effectiveAssessmentLimitSeconds
		) {
			return {
				success: false,
				error: 'Assessment time limit expired',
			};
		}

		const evidenceExpired =
			request.timing?.limitSeconds !== undefined &&
			request.timing.elapsedMs >= request.timing.limitSeconds * 1000;
		if (!timeExpiredCollection && evidenceExpired && request.timing?.allowLateSubmission !== true) {
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
		// A QTI endAttempt countAttempt=false submission (a hint request) runs response processing
		// without consuming an attempt, so the attempt limit does not apply to it.
		const countAttempt = request.countAttempt ?? true;
		if (countAttempt && control.maxAttempts > 0 && (previousItemSession?.attemptCount ?? 0) >= control.maxAttempts) {
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

		// Store responses and result. An uncounted submission (countAttempt=false) persists the
		// response but records no score, presented state, or attempt: response processing ran,
		// and the candidate continues on the item.
		session.state.itemResponses[request.itemIdentifier] = request.responses;
		if (countAttempt) {
			if (!session.state.itemScores) {
				session.state.itemScores = {};
			}
			session.state.itemScores[request.itemIdentifier] = result;
			if (testState) {
				session.itemTestStates = { ...(session.itemTestStates ?? {}), [request.itemIdentifier]: testState };
			} else if (session.itemTestStates) {
				delete session.itemTestStates[request.itemIdentifier];
			}
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
				attemptCount: (previousItemSession?.attemptCount ?? 0) + (countAttempt ? 1 : 0),
				isAnswered: this.hasAnyResponse(request.responses),
				isSubmitted: countAttempt ? true : (previousItemSession?.isSubmitted ?? false),
				lastSubmissionTime: countAttempt ? request.submittedAt : previousItemSession?.lastSubmissionTime,
			},
		};

		// Update timing
		if (request.timeSpent) {
			session.state.timing.itemTimes[request.itemIdentifier] = request.timeSpent;
		}

		// Add to visited items if not already there
		if (countAttempt && !session.state.visitedItems.includes(request.itemIdentifier)) {
			session.state.visitedItems.push(request.itemIdentifier);
		}

		saveSession(session);

		const { outcomes, error } = this.currentOutcomes(session);
		const currentVariables = testState?.variables ?? this.scoredItemVariables(result);
		const decls = navigationDeclarations(session, outcomes, {
			...applyVariableMappings(currentVariables, current.item.variableMappings),
			...(currentVariables.SCORE ? {} : { SCORE: qtiValue('float', 'single', result.score) }),
		});
		const nextId = nextItemIdentifier(session.assessment, delivered, index, decls, this.rng);

		return {
			success: true,
			result,
			nextItemIdentifier: nextId,
			updatedState: session.state,
			outcomes,
			...(error ? { outcomeProcessingError: error } : {}),
		};
	}

	/**
	 * Save session state (for auto-save)
	 */
	async saveState(request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse> {
		const session = loadSession(request.sessionId);
		if (!session) {
			return {
				success: false,
				savedAt: Date.now(),
			};
		}

		// Update state
		session.state = request.state;
		saveSession(session);

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
		const session = loadSession(request.sessionId);
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
		saveSession(session);

		// Compute total score
		const itemScores = session.state.itemScores || {};
		const fallbackTotal = Object.values(itemScores).reduce((sum, result) => sum + result.score, 0);
		const maxScore = Object.values(itemScores).reduce((sum, result) => sum + result.maxScore, 0);

		// Execute test-level outcome processing if available
		const run = this.runOutcomeProcessing(session);
		const outcomes = run.outcomes;
		const scoreOutcome = outcomes?.SCORE_TOTAL ?? outcomes?.SCORE;
		const totalScore = typeof scoreOutcome === 'number' ? scoreOutcome : fallbackTotal;

		return {
			success: true,
			totalScore,
			maxScore,
			itemScores,
			outcomes: outcomes ?? undefined,
			...(run.error ? { outcomeProcessingError: run.error } : {}),
			finalizedAt: Date.now(),
		};
	}

	/**
	 * Outcome values and any outcome-processing failure after the submissions so far; both
	 * undefined before the first submission.
	 */
	private currentOutcomes(
		session: StoredSession,
	): { outcomes?: TestOutcomeValues; error?: OutcomeProcessingError } {
		if (Object.keys(session.state.itemScores ?? {}).length === 0) return {};
		const run = this.runOutcomeProcessing(session);
		return { outcomes: run.outcomes ?? undefined, error: run.error };
	}

	/**
	 * The stored final totals of a finalized session, for the terminal init response:
	 * the same fallback totals `finalizeAssessment` reports (per-item scores included so
	 * a shell can render its completion summary).
	 */
	private storedFinalResults(session: StoredSession): NonNullable<InitSessionResponse['finalResults']> {
		const itemScores = session.state.itemScores ?? {};
		const results = Object.values(itemScores);
		return {
			totalScore: results.reduce((sum, result) => sum + result.score, 0),
			maxScore: results.reduce((sum, result) => sum + result.maxScore, 0),
			itemScores,
		};
	}

	/**
	 * Execute test-level outcome processing (T9/T1).
	 *
	 * Returns every declared outcome's value (null for NULL), or null when no
	 * outcomeProcessing is defined. A failure is reported as a typed
	 * `OutcomeProcessingError` (persisted on the session) — it never fails delivery and
	 * candidate responses always stay persisted, but it must surface to the host instead
	 * of SCORE/testFeedback silently never computing.
	 */
	private runOutcomeProcessing(
		session: StoredSession,
	): { outcomes: TestOutcomeValues | null; error?: OutcomeProcessingError } {
		const { assessment } = session;
		if (!assessment.outcomeProcessingXml) {
			return { outcomes: null };
		}

	try {
		const testItems = this.buildTestItems(session);
		const decls = addScopeDurationDeclarations(
			addItemVariableDeclarations(
				testOutcomeDeclarations(assessment),
				Object.fromEntries(testItems.map((item) => [item.identifier, item.variables])),
			),
			assessment,
			session.state.timing,
		);
			const ctx = new DeclarationContext(decls);
			const ops = new OperatorRegistry();

			// Parse and execute outcome processing
			const opEl = parseXml(assessment.outcomeProcessingXml).documentElement;
			if (!opEl) return { outcomes: null };

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
			if (session.outcomeProcessingError) {
				delete session.outcomeProcessingError;
				saveSession(session);
			}
			return { outcomes: result };
		} catch (err) {
			console.warn('[ReferenceBackendAdapter] outcomeProcessing failed:', err);
			const error: OutcomeProcessingError = {
				code: 'OUTCOME_PROCESSING_FAILED',
				message: err instanceof Error ? err.message : String(err),
			};
			session.outcomeProcessingError = error;
			saveSession(session);
			return { outcomes: null, error };
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
	 * The identifier of this adapter's most recent unfinalized session for an
	 * assessment and candidate, or null. Hosts pass it as `initSession.resumeSessionId`
	 * to resume the stored draft — the reference resume path after a refresh.
	 */
	latestSessionId(assessmentId: string, candidateId: string): SessionId | null {
		return findLatestSession(assessmentId, candidateId)?.sessionId ?? null;
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
	// =========================================================================
	// PRIVATE HELPERS
	// =========================================================================

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
	 * Test-level view of every delivered item. Items not yet submitted carry their declared defaults
	 * and count as not presented; sessions stored before item test states existed fall back to the
	 * submitted scores, leaving correctness to SCORE/MAXSCORE inference.
	 */
	private buildTestItems(session: StoredSession): TestItemState[] {
		const itemScores = session.state.itemScores ?? {};
		return getItemRefsInOrder(session.assessment).map(({ item, sectionIdentifiers }) => {
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
}
