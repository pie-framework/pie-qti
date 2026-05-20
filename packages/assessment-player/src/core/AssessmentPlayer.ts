/**
 * AssessmentPlayer (backend-authoritative)
 *
 * Client responsibilities:
 * - Render items using @pie-qti/item-player
 * - Collect candidate responses
 * - Submit responses to BackendAdapter
 * - Apply backend navigation decisions + session state
 */

import type { QTIRole, PnpProfile, SerializedItemSessionState } from '@pie-qti/item-player';
import { Player } from '@pie-qti/item-player';
import type {
	AssessmentRubricBlock,
	AssessmentSessionState,
	AssessmentScoringResult,
	BackendAdapter,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	SecureAssessment,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	SessionId,
} from '../integration/api-contract.js';
import type {
	AssessmentResults,
	ItemResult,
	NavigationState,
	TimeLimits,
} from '../types/index.js';
import { AssessmentSessionCoordinator } from './AssessmentSessionCoordinator.js';
import { NavigationManager } from './NavigationManager.js';
import { TimeManager } from './TimeManager.js';

export interface BackendAssessmentPlayerConfig {
	backend: BackendAdapter;
	initSession: InitSessionRequest;
	role?: QTIRole;
	/** Optional RNG for deterministic shuffling in selection/ordering. Defaults to Math.random. */
	rng?: () => number;
	/**
	 * Optional hint for item renderers that support multiple extended text editors.
	 * (Plumbed through the shell; the item player remains authoritative for behavior.)
	 */
	extendedTextEditor?: string;
	/**
	 * Optional i18n provider for internationalization.
	 * If provided, this will be shared across all item players in the assessment.
	 */
	i18nProvider?: any; // Will be I18nProvider from @pie-qti/i18n
	/**
	 * Security configuration for URL policy and content restrictions.
	 * If provided, this will be passed to all item players in the assessment.
	 */
	security?: any; // Will be PlayerSecurityConfig from @pie-qti/item-player
	/**
	 * Demo/reference-only escape hatch. When false (default), rich item-session
	 * variables stay client-local and are not submitted because template variables
	 * can contain answer keys. Production backends should own this state server-side.
	 */
	sendItemSessionToBackend?: boolean;
	// UI options
	showSections?: boolean;
	allowSectionNavigation?: boolean;
	showProgress?: boolean;
	// Time management
	timeWarningThreshold?: number;
	/**
	 * QTI 3.0 §6.2 Personal Needs and Preferences profile.
	 * Extended time (pnp.content.extendedTime) is applied to assessment timeLimits.
	 * The full profile is passed down to each item player for component-level features
	 * (color scheme, elimination tool).
	 */
	pnp?: PnpProfile;
	// Callbacks
	onItemChange?: (itemIndex: number, totalItems: number) => void;
	onSectionChange?: (sectionIndex: number, totalSections: number) => void;
	onResponseChange?: (responses: Record<string, unknown>) => void;
	onComplete?: () => void;
}

type FlatItem = {
	identifier: string;
	item: SecureItemRef;
	section: SecureSection;
	testPart: SecureTestPart;
	index: number;
	sectionIndex: number;
};

type CurrentItemView = {
	identifier: string;
	title?: string;
	required?: boolean;
	itemXml: string;
	deliveryContext?: SecureItemRef['deliveryContext'];
};

export interface EffectiveItemTimeLimits {
	timeLimits?: TimeLimits;
	source?: 'item' | 'section' | 'testPart' | 'assessment';
}

type ItemSessionCapablePlayer = Player & {
	suspendAttempt(): { sessionState: SerializedItemSessionState; duration: number };
	endAttempt(options?: { countAttempt?: boolean; validateResponses?: boolean }): {
		sessionState: SerializedItemSessionState;
		duration: number;
		validation?: { valid: boolean; issues: Array<{ message: string }> };
	};
	restoreItemSession(state: SerializedItemSessionState): void;
};

export class AssessmentPlayer {
	public static async create(config: BackendAssessmentPlayerConfig): Promise<AssessmentPlayer> {
		const init = await config.backend.initSession(config.initSession);
		return new AssessmentPlayer(config, init);
	}

	private backend: BackendAdapter;
	private sessionId: SessionId;
	private assessment: SecureAssessment;
	private i18nProvider: any; // I18nProvider from @pie-qti/i18n

	private navigationManager: NavigationManager;
	private sessionCoordinator!: AssessmentSessionCoordinator;
	private timeManager: TimeManager | null = null;

	private items: FlatItem[] = [];
	private currentItemIndex = -1;
	private currentItemPlayer: Player | null = null;
	private visibleFeedback: Array<{ identifier: string; content: string; access: string }> = [];

	// Event listeners
	private itemChangeListeners = new Set<(index: number, total: number) => void>();
	private sectionChangeListeners = new Set<(index: number, total: number) => void>();
	private responseChangeListeners = new Set<(responses: Record<string, unknown>) => void>();
	private completeListeners = new Set<() => void>();
	private timeWarningListeners = new Set<(remainingSeconds: number) => void>();
	private timeExpiredListeners = new Set<() => void>();
	private timeTickListeners = new Set<(remainingSeconds: number, elapsedSeconds: number) => void>();

	private constructor(private config: BackendAssessmentPlayerConfig, init: InitSessionResponse) {
		this.backend = config.backend;
		this.sessionId = init.sessionId;
		this.assessment = init.assessment;
		this.i18nProvider = config.i18nProvider ?? this.createDefaultI18nProvider();
		const initialState =
			init.restoredState ??
			({
				currentItemIdentifier: '',
				visitedItems: [],
				itemResponses: {},
				itemScores: {},
				itemSessions: {},
				timing: { startedAt: Date.now(), itemTimes: {}, totalTime: 0 },
			} as AssessmentSessionState);

		this.items = this.flattenItems(this.assessment);

		const navigationMode = this.assessment.navigationMode || 'nonlinear';
		this.navigationManager = new NavigationManager(navigationMode, this.items.length);

		// Item session control is a UI hint; backend remains authoritative.
		// Start with testPart-level defaults; section-level overrides are applied per item in navigateTo().
		const itemSessionControl = this.assessment.testParts?.[0]?.itemSessionControl;
		this.sessionCoordinator = new AssessmentSessionCoordinator({
			state: initialState,
			itemIdentifiers: this.items.map((q) => q.identifier),
			itemSessionControl,
		});

		this.timeManager = new TimeManager({
			assessmentTimeLimits: this.assessment.timeLimits,
			warningThreshold: config.timeWarningThreshold || 60,
			extendedTime: config.pnp?.content?.extendedTime,
			onWarning: (remainingSeconds) => this.notifyTimeWarning(remainingSeconds),
			onExpired: () => this.notifyTimeExpired(),
			onTick: (remainingSeconds, elapsedSeconds) => this.notifyTimeTick(remainingSeconds, elapsedSeconds),
		});

		// Restore to backend-provided current item if present
		const startId = this.state.currentItemIdentifier;
		const idx = startId ? this.items.findIndex((q) => q.identifier === startId) : -1;
		if (idx >= 0) {
			this.navigateTo(idx, { restoring: true }).catch(() => {});
		} else if (this.items.length > 0) {
			this.navigateTo(0, { restoring: true }).catch(() => {});
		}
	}

	private get state(): AssessmentSessionState {
		return this.sessionCoordinator.state;
	}

	private set state(state: AssessmentSessionState) {
		this.sessionCoordinator.restoreState(state);
	}

	/**
	 * Compute effective itemSessionControl for a given item using three-level fallback:
	 * section-level (highest priority) → testPart-level → defaults.
	 * Section-level values override testPart-level when present.
	 */
	private getEffectiveItemSessionControl(flat: FlatItem): SecureSection['itemSessionControl'] {
		const testPartControl = flat.testPart.itemSessionControl;
		const sectionControl = flat.section.itemSessionControl;

		if (!sectionControl) return testPartControl;
		if (!testPartControl) return sectionControl;

		return {
			maxAttempts: sectionControl.maxAttempts ?? testPartControl.maxAttempts,
			showFeedback: sectionControl.showFeedback ?? testPartControl.showFeedback,
			allowReview: sectionControl.allowReview ?? testPartControl.allowReview,
			showSolution: sectionControl.showSolution ?? testPartControl.showSolution,
			allowComment: sectionControl.allowComment ?? testPartControl.allowComment,
			allowSkipping: sectionControl.allowSkipping ?? testPartControl.allowSkipping,
			validateResponses: sectionControl.validateResponses ?? testPartControl.validateResponses,
		};
	}

	private getEffectiveItemTimeLimits(flat: FlatItem): EffectiveItemTimeLimits {
		const scopes: Array<{ source: EffectiveItemTimeLimits['source']; limits?: TimeLimits }> = [
			{ source: 'assessment', limits: this.assessment.timeLimits },
			{ source: 'testPart', limits: flat.testPart.timeLimits },
			{ source: 'section', limits: flat.section.timeLimits },
			{ source: 'item', limits: flat.item.timeLimits },
		];
		let source: EffectiveItemTimeLimits['source'];
		let minTime: number | undefined;
		let maxTime: number | undefined;
		let allowLateSubmission: boolean | undefined;
		for (const scope of scopes) {
			if (!scope.limits) continue;
			if (scope.limits.minTime !== undefined) {
				minTime = minTime === undefined ? scope.limits.minTime : Math.max(minTime, scope.limits.minTime);
			}
			if (scope.limits.maxTime !== undefined) {
				const extended = this.config.pnp?.content?.extendedTime;
				const scopedMaxTime = extended?.active
					? extended.multiplier === Infinity
						? undefined
						: scope.limits.maxTime * extended.multiplier
					: scope.limits.maxTime;
				if (scopedMaxTime !== undefined && (maxTime === undefined || scopedMaxTime < maxTime)) {
					maxTime = scopedMaxTime;
					source = scope.source;
					allowLateSubmission = scope.limits.allowLateSubmission;
				}
			} else if (scope.limits.allowLateSubmission !== undefined && maxTime === undefined) {
				allowLateSubmission = scope.limits.allowLateSubmission;
				source = scope.source;
			}
		}

		if (maxTime === undefined && minTime === undefined && allowLateSubmission === undefined) {
			return {};
		}
		return { source, timeLimits: { minTime, maxTime, allowLateSubmission } };
	}

	public getCurrentEffectiveTimeLimits(): EffectiveItemTimeLimits {
		const q = this.items[this.currentItemIndex];
		return q ? this.getEffectiveItemTimeLimits(q) : {};
	}

	private getSubmitTimingEvidence(q: FlatItem, elapsedMs: number): import('../integration/api-contract.js').SubmitTimingEvidence | undefined {
		const effective = this.getEffectiveItemTimeLimits(q);
		const limitSeconds = effective.timeLimits?.maxTime;
		if (!effective.source || limitSeconds === undefined) return undefined;
		if (effective.source !== 'item' && effective.source !== 'assessment') {
			return undefined;
		}
		const scopedElapsedMs = effective.source === 'assessment'
			? (this.timeManager?.getElapsedSeconds() ?? 0) * 1000
			: elapsedMs;
		return {
			scope: effective.source,
			elapsedMs: scopedElapsedMs,
			limitSeconds,
			expired: scopedElapsedMs >= limitSeconds * 1000,
			allowLateSubmission: effective.timeLimits?.allowLateSubmission,
		};
	}

	private flattenItems(assessment: SecureAssessment): FlatItem[] {
		const out: FlatItem[] = [];
		const testParts = assessment.testParts || [];
		let idx = 0;
		let secIdx = 0;
		const rng = this.config.rng ?? Math.random;

		for (const tp of testParts) {
			for (const section of tp.sections || []) {
				let refs = [...(section.assessmentItemRefs || [])];

				// QTI ordering: shuffle items within the section when requested.
				// The server may have already shuffled; if not (e.g. reference adapter), do it client-side.
				if (section.ordering?.shuffle) {
					refs = shuffleArray(refs, rng);
				}

				// QTI selection: take only `select` items from the (possibly shuffled) list.
				if (section.selection && section.selection.select > 0 && section.selection.select < refs.length) {
					refs = refs.slice(0, section.selection.select);
				}

				for (const item of refs) {
					out.push({
						identifier: item.identifier,
						item,
						section,
						testPart: tp,
						index: idx++,
						sectionIndex: secIdx,
					});
				}
				secIdx++;
			}
		}
		return out;
	}

	// ---------------------------------------------------------------------------
	// Public API used by components
	// ---------------------------------------------------------------------------

	public getAllSections(): Array<{ id: string; title?: string; visible: boolean; index: number }> {
		const out: Array<{ id: string; title?: string; visible: boolean; index: number }> = [];
		let idx = 0;
		for (const tp of this.assessment.testParts || []) {
			for (const s of tp.sections || []) {
				out.push({ id: s.identifier, title: s.title, visible: s.visible, index: idx++ });
			}
		}
		return out;
	}

	public getNavigationState(): NavigationState {
		const total = this.items.length;
		const canPrevious = this.canPrevious();
		const canNext = this.canNext();
		const q = this.items[this.currentItemIndex];
		const totalSections = this.getAllSections().length;
		return {
			currentIndex: this.currentItemIndex,
			totalItems: total,
			canNext,
			canPrevious,
			isLoading: false,
			currentSection: q
				? { id: q.section.identifier, title: q.section.title, index: q.sectionIndex }
				: undefined,
			totalSections,
		};
	}

	public getCurrentItem(): CurrentItemView | null {
		const q = this.items[this.currentItemIndex];
		if (!q) return null;
		return {
			identifier: q.item.identifier,
			title: q.section.title,
			required: q.item.required,
			itemXml: q.item.itemXml,
			deliveryContext: q.item.deliveryContext,
		};
	}

	public getCurrentRubricBlocks(): AssessmentRubricBlock[] {
		const q = this.items[this.currentItemIndex];
		if (!q) return [];
		return q.section.rubricBlocks || q.testPart.rubricBlocks || [];
	}

	public getVisibleFeedback(): Array<{ identifier: string; content: string; access: string }> {
		return this.visibleFeedback;
	}

	public updateResponse(responseId: string, value: unknown): void {
		this.sessionCoordinator.updateActiveResponse(responseId, value);
		this.notifyResponseChange();
	}

	/**
	 * Update a response for a specific item.
	 * Useful when response events are observed outside the current-item renderer and we
	 * want to be explicit about which item receives the response (some assessments reuse
	 * the same responseIdentifier like "RESPONSE" across items).
	 */
	public updateResponseForItem(itemIdentifier: string, responseId: string, value: unknown): void {
		const next = this.sessionCoordinator.updateResponseForItem(itemIdentifier, responseId, value);

		// If this is the active item, keep the live response state + UI hints in sync.
		const active = this.items[this.currentItemIndex];
		if (active?.identifier === itemIdentifier) {
			this.currentItemPlayer?.setResponses(next as any);
			this.notifyResponseChange();
		}
	}

	/**
	 * Get current unsaved responses for the active item.
	 * (Useful for host integrations / web components.)
	 */
	public getResponses(): Record<string, unknown> {
		return this.sessionCoordinator.getActiveResponses();
	}

	public saveCurrentItemSession(): SerializedItemSessionState | null {
		const q = this.items[this.currentItemIndex];
		if (!q || !this.currentItemPlayer) return null;
		const responses = this.sessionCoordinator.getActiveResponses();
		this.currentItemPlayer.setResponses(responses as any);
		const result = (this.currentItemPlayer as ItemSessionCapablePlayer).suspendAttempt();
		this.sessionCoordinator.saveItemSession(q.identifier, responses, result.sessionState, result.duration);
		return result.sessionState;
	}

	private endItemSessionForSubmit(
		q: FlatItem,
		responses: Record<string, unknown>,
		itemSession?: SerializedItemSessionState
	): SerializedItemSessionState {
		const player = new Player({
			itemXml: q.item.itemXml,
			role: q.item.role,
			i18nProvider: this.i18nProvider,
			pnp: this.config.pnp,
			security: this.config.security,
			deliveryContext: q.item.deliveryContext,
		}) as ItemSessionCapablePlayer;
		if (itemSession) {
			player.restoreItemSession(itemSession);
		}
		player.setResponses(responses as any);
		return player.endAttempt().sessionState;
	}

	/**
	 * Get the current session state snapshot (client-side view).
	 * Note: backend remains authoritative; this is intended for simple save/resume.
	 */
	public getState(options: { includeItemSessions?: boolean } = {}): AssessmentSessionState {
		return this.sessionCoordinator.snapshot(options);
	}

	/**
	 * Restore a previously saved session state.
	 */
	public async restoreState(state: AssessmentSessionState): Promise<void> {
		this.state = state;

		// Restore visited state for UI navigation hints.
		const visitedIdx = (state.visitedItems || [])
			.map((id) => this.items.findIndex((q) => q.identifier === id))
			.filter((i) => i >= 0);
		this.navigationManager.restoreState(visitedIdx);

		const currentId = state.currentItemIdentifier;
		const idx = currentId ? this.items.findIndex((q) => q.identifier === currentId) : -1;
		if (idx >= 0) {
			await this.navigateTo(idx, { restoring: true });
		} else if (this.items.length > 0) {
			await this.navigateTo(0, { restoring: true });
		}
	}

	public async navigateTo(index: number, options: { restoring?: boolean } = {}): Promise<void> {
		if (index < 0 || index >= this.items.length) throw new Error(`Invalid item index: ${index}`);

		// Enforce navigation rules (UI hints, still backend-authoritative for real deployments).
		if (!options.restoring && this.currentItemIndex >= 0 && !this.navigationManager.canNavigateTo(index, this.currentItemIndex)) {
			if (this.navigationManager.getMode() === 'linear' && index > this.currentItemIndex + 1) {
				throw new Error('In linear navigation mode, you can only move to the next question.');
			}
			throw new Error('Navigation is not allowed.');
		}
		const target = this.items[index];
		if (!options.restoring && target && !this.sessionCoordinator.canReview(target.identifier)) {
			throw new Error('You cannot go back to previous questions in this assessment.');
		}

		const currentItem = this.items[this.currentItemIndex];
		const currentSessionStatus = currentItem ? this.state.itemSessions?.[currentItem.identifier]?.lifecycleStatus : undefined;
		if (
			!options.restoring &&
			this.currentItemIndex >= 0 &&
			this.currentItemIndex !== index &&
			currentSessionStatus !== 'closed'
		) {
			this.saveCurrentItemSession();
		}
		if (currentItem && this.currentItemIndex !== index) {
			this.timeManager?.endItem(currentItem.identifier);
		}

		this.currentItemIndex = index;
		const q = this.items[index]!;
		this.state.currentItemIdentifier = q.identifier;
		this.timeManager?.startSection(q.section.identifier);
		this.timeManager?.startItem(q.identifier);

		// Apply three-level itemSessionControl fallback for this item's section (S1).
		const effectiveControl = this.getEffectiveItemSessionControl(q);
		if (effectiveControl) {
			this.sessionCoordinator.updateItemSessionControl(effectiveControl);
		}

		// Restore responses
		const responses = this.sessionCoordinator.activateItem(q.identifier);

		// Create item player
		this.currentItemPlayer?.destroy();
		this.currentItemPlayer = new Player({
			itemXml: q.item.itemXml,
			role: q.item.role,
			i18nProvider: this.i18nProvider,
			pnp: this.config.pnp,
			security: this.config.security,
			deliveryContext: q.item.deliveryContext,
		});
		const restoredItemSession = this.state.itemSessions?.[q.identifier];
		if (restoredItemSession) {
			(this.currentItemPlayer as ItemSessionCapablePlayer).restoreItemSession(restoredItemSession);
		} else {
			this.currentItemPlayer.setResponses(responses as any);
		}

		this.notifyItemChange();
		this.notifySectionChange();
	}

	public async navigateToSection(sectionId: string): Promise<void> {
		const idx = this.items.findIndex((q) => q.section.identifier === sectionId);
		if (idx >= 0) await this.navigateTo(idx);
	}

	public async next(): Promise<void> {
		const state = this.getNavigationState();
		if (!state.canNext) return;

		const q = this.items[this.currentItemIndex];
		if (q) {
			const responses = this.sessionCoordinator.getActiveResponses();
			this.sessionCoordinator.markAnswered(q.identifier, responses);

			const navAway = this.sessionCoordinator.canNavigateAway(q.identifier, responses);
			if (!navAway.allowed) {
				throw new Error(navAway.reason || 'You must answer this question before continuing.');
			}

			// In individual submission mode, submit current item before moving forward.
			if (this.assessment.submissionMode === 'individual') {
				const before = this.currentItemIndex;
				await this.submitCurrentItem();
				// submitCurrentItem may branch/navigate; if it did, we're done.
				if (this.currentItemIndex !== before) return;
			}
		}

		await this.navigateTo(this.currentItemIndex + 1);
	}

	public async previous(): Promise<void> {
		const state = this.getNavigationState();
		if (!state.canPrevious) return;
		await this.navigateTo(this.currentItemIndex - 1);
	}

	/** Submit current item (server-side scoring) */
	public async submitCurrentItem(): Promise<ItemResult> {
		const q = this.items[this.currentItemIndex];
		if (!q) throw new Error('No current item');

		const submittedAt = Date.now();
		let itemSession: SerializedItemSessionState | undefined;
		const responses = this.sessionCoordinator.getActiveResponses();
		if (this.currentItemPlayer) {
			this.currentItemPlayer.setResponses(responses as any);
			const attempt = (this.currentItemPlayer as ItemSessionCapablePlayer).endAttempt({
				validateResponses: this.sessionCoordinator.mustValidateResponses(),
			});
			if (attempt.validation && !attempt.validation.valid) {
				throw new Error(attempt.validation.issues[0]?.message || 'Submit failed: invalid response');
			}
			itemSession = attempt.sessionState;
			this.sessionCoordinator.setItemSession(q.identifier, itemSession);
		}
		const res = await this.backend.submitResponses({
			sessionId: this.sessionId,
			itemIdentifier: q.identifier,
			responses: responses as any,
			submittedAt,
			timeSpent: itemSession?.duration,
			timing: this.getSubmitTimingEvidence(q, itemSession?.duration ?? 0),
			itemSession: this.config.sendItemSessionToBackend ? itemSession : undefined,
		});

		if (!res.success || !res.result) {
			throw new Error(res.error || 'Submit failed');
		}

		if (res.updatedState) {
			this.sessionCoordinator.replaceStatePreservingItemSessions(res.updatedState);
		} else {
			// Minimal state update when backend doesn't return full state.
			this.state.itemScores = this.state.itemScores || {};
			this.state.itemScores[q.identifier] = res.result;
			this.sessionCoordinator.markVisited(q.identifier);
			this.state.itemResponses[q.identifier] = responses as any;
			if (itemSession) {
				this.sessionCoordinator.setItemSession(q.identifier, itemSession);
			}
		}

		const itemResult: ItemResult = {
			itemIdentifier: q.identifier,
			score: res.result.score,
			maxScore: res.result.maxScore,
			responses: { ...responses },
		};
		this.sessionCoordinator.setItemResult(itemResult);

		// Track item session rules (review/attempts) and visited items for navigation hints.
		try {
			this.sessionCoordinator.recordAttempt(q.identifier);
		} catch {
			// ignore
		}
		this.sessionCoordinator.markAnswered(q.identifier, responses);
		this.navigationManager.markVisited(this.currentItemIndex);

		// Apply backend branching decision if provided.
		// Special QTI targets EXIT_TEST / EXIT_TESTPART / EXIT_SECTION trigger finalization.
		if (res.nextItemIdentifier) {
			const special = res.nextItemIdentifier;
			if (special === 'EXIT_TEST') {
				// Finalize immediately — no further navigation
				for (const l of this.completeListeners) l();
				this.config.onComplete?.();
			} else if (special === 'EXIT_TESTPART' || special === 'EXIT_SECTION') {
				// Advance past all remaining items in the current testPart or section
				const currentItem = this.items[this.currentItemIndex];
				const isSection = special === 'EXIT_SECTION';
				const nextIdx = this.items.findIndex((item, i) =>
					i > this.currentItemIndex &&
					(isSection
						? item.section.identifier !== currentItem?.section.identifier
						: item.testPart.identifier !== currentItem?.testPart.identifier)
				);
				if (nextIdx >= 0) {
					await this.navigateTo(nextIdx);
				} else {
					// No further items — signal completion
					for (const l of this.completeListeners) l();
					this.config.onComplete?.();
				}
			} else {
				const nextIdx = this.items.findIndex((x) => x.identifier === special);
				if (nextIdx >= 0) {
					await this.navigateTo(nextIdx);
				}
			}
		}

		return itemResult;
	}

	private canPrevious(): boolean {
		if (this.currentItemIndex <= 0) return false;
		const prev = this.items[this.currentItemIndex - 1];
		if (!prev) return false;
		if (!this.navigationManager.canNavigateTo(this.currentItemIndex - 1, this.currentItemIndex)) return false;
		return this.sessionCoordinator.canReview(prev.identifier);
	}

	private canNext(): boolean {
		if (this.currentItemIndex < 0) return false;
		const nextIdx = this.currentItemIndex + 1;
		if (nextIdx >= this.items.length) return false;
		if (!this.navigationManager.canNavigateTo(nextIdx, this.currentItemIndex)) return false;
		// Note: itemSessionControl constraints on leaving current item are enforced in next().
		return true;
	}

	/** Submit entire assessment (finalize on backend) */
	public async submit(): Promise<AssessmentResults> {
		// For simultaneous submission, ensure all items are submitted before finalize so
		// the backend can compute a complete test score.
		if (this.assessment.submissionMode === 'simultaneous') {
			this.saveCurrentItemSession();
			// Preserve client-collected responses across backend state updates.
			// Some backend adapters return an updatedState snapshot that may only include
			// responses for items that have been submitted so far, which would otherwise
			// wipe out responses for later items during this loop.
			const allItemResponses = { ...(this.state.itemResponses || {}) } as any;
			const allItemSessions = { ...(this.state.itemSessions || {}) };

			for (const q of this.items) {
				if (this.sessionCoordinator.hasItemResult(q.identifier)) continue;
				const submittedAt = Date.now();
				const responsesForItem = (allItemResponses?.[q.identifier] || {}) as any;
				const itemSession = this.endItemSessionForSubmit(q, responsesForItem, allItemSessions[q.identifier]);
				allItemSessions[q.identifier] = itemSession;
				const res = await this.backend.submitResponses({
					sessionId: this.sessionId,
					itemIdentifier: q.identifier,
					responses: responsesForItem,
					submittedAt,
					timeSpent: itemSession?.duration,
					timing: this.getSubmitTimingEvidence(q, itemSession?.duration ?? 0),
					itemSession: this.config.sendItemSessionToBackend ? itemSession : undefined,
				});
				if (!res.success || !res.result) {
					throw new Error(res.error || `Submit failed for item ${q.identifier}`);
				}
				if (res.updatedState) {
					this.sessionCoordinator.replaceStatePreservingResponsesAndSessions(
						res.updatedState,
						allItemResponses,
						allItemSessions
					);
				} else {
					this.state.itemScores = this.state.itemScores || {};
					this.state.itemScores[q.identifier] = res.result;
					this.sessionCoordinator.markVisited(q.identifier);
					this.state.itemResponses[q.identifier] = responsesForItem;
					if (itemSession) {
						this.sessionCoordinator.setItemSession(q.identifier, itemSession);
					}
				}
				this.sessionCoordinator.setItemResult({
					itemIdentifier: q.identifier,
					score: res.result.score,
					maxScore: res.result.maxScore,
					responses: this.state.itemResponses[q.identifier] || {},
				});
			}
		} else {
			// Ensure current item is submitted (individual submission mode)
			const q = this.items[this.currentItemIndex];
			if (q && !this.sessionCoordinator.hasItemResult(q.identifier)) {
				await this.submitCurrentItem();
			}
		}

		const finalized: FinalizeAssessmentResponse = await this.backend.finalizeAssessment({
			sessionId: this.sessionId,
		});
		if (!finalized.success) throw new Error('Finalize failed');

		// Map backend itemScores to ItemResult[]
		const itemScores = finalized.itemScores || {};
		const itemResults: ItemResult[] = Object.values(itemScores).map((r: AssessmentScoringResult) => ({
			itemIdentifier: r.itemIdentifier,
			score: r.score,
			maxScore: r.maxScore,
			responses: this.state.itemResponses[r.itemIdentifier] || {},
		}));

		// Evaluate testFeedback visibility using QTI string equality:
		// show when outcomeIdentifier's value equals feedback.identifier (for showHide='show'),
		// or does NOT equal it (for showHide='hide').
		const structuredFeedback = this.assessment.testFeedback ?? [];
		const outcomes = finalized.outcomes ?? {};
		if (structuredFeedback.length > 0) {
			this.visibleFeedback = structuredFeedback
				.filter((fb) => fb.access === 'atEnd')
				.filter((fb) => {
					const outcomeValue = String(outcomes[fb.outcomeIdentifier] ?? '');
					const matches = outcomeValue === fb.identifier;
					return fb.showHide === 'show' ? matches : !matches;
				})
				.map((fb) => ({ identifier: fb.identifier, content: fb.content, access: fb.access }));
		} else {
			// Legacy: backend returns a plain feedback string
			this.visibleFeedback = finalized.feedback
				? [{ identifier: 'testFeedback', content: finalized.feedback, access: 'atEnd' }]
				: [];
		}

		this.notifyComplete();
		if (this.config.onComplete) this.config.onComplete();

		return {
			totalScore: finalized.totalScore,
			maxScore: finalized.maxScore,
			itemResults,
			completedAt: new Date(finalized.finalizedAt),
		};
	}

	// ---------------------------------------------------------------------------
	// Session info + time helpers
	// ---------------------------------------------------------------------------

	public getItemSessionInfo(_itemIdentifier?: string): {
		canSubmit: boolean;
		remainingAttempts: number | null;
		attemptCount: number;
		showFeedback: boolean;
		showSolution: boolean;
		canReview: boolean;
		canSkip: boolean;
	} | null {
		const q = this.items[this.currentItemIndex];
		if (!q) return null;
		const id = q.identifier;

		return this.sessionCoordinator.getItemSessionInfo(id);
	}

	public getRemainingTime(): number {
		// TimeManager exposes seconds getters.
		return this.timeManager?.getRemainingSeconds() ?? 0;
	}

	public getElapsedTime(): number {
		return this.timeManager?.getElapsedSeconds() ?? 0;
	}

	public isTimeExpired(): boolean {
		return this.timeManager?.isExpired() ?? false;
	}

	// ---------------------------------------------------------------------------
	// Event subscriptions
	// ---------------------------------------------------------------------------

	public onItemChange(listener: (index: number, total: number) => void): () => void {
		this.itemChangeListeners.add(listener);
		return () => this.itemChangeListeners.delete(listener);
	}

	public onSectionChange(listener: (index: number, total: number) => void): () => void {
		this.sectionChangeListeners.add(listener);
		return () => this.sectionChangeListeners.delete(listener);
	}

	public onResponseChange(listener: (responses: Record<string, unknown>) => void): () => void {
		this.responseChangeListeners.add(listener);
		return () => this.responseChangeListeners.delete(listener);
	}

	public onComplete(listener: () => void): () => void {
		this.completeListeners.add(listener);
		return () => this.completeListeners.delete(listener);
	}

	public onTimeWarning(listener: (remainingSeconds: number) => void): () => void {
		this.timeWarningListeners.add(listener);
		return () => this.timeWarningListeners.delete(listener);
	}

	public onTimeExpired(listener: () => void): () => void {
		this.timeExpiredListeners.add(listener);
		return () => this.timeExpiredListeners.delete(listener);
	}

	public onTimeTick(listener: (remainingSeconds: number, elapsedSeconds: number) => void): () => void {
		this.timeTickListeners.add(listener);
		return () => this.timeTickListeners.delete(listener);
	}

	public destroy(): void {
		this.timeManager?.destroy();
		this.currentItemPlayer?.destroy();
		this.itemChangeListeners.clear();
		this.sectionChangeListeners.clear();
		this.responseChangeListeners.clear();
		this.completeListeners.clear();
		this.timeWarningListeners.clear();
		this.timeExpiredListeners.clear();
		this.timeTickListeners.clear();
		this.currentItemPlayer = null;
	}

	// ---------------------------------------------------------------------------
	// Internal notify helpers
	// ---------------------------------------------------------------------------

	private notifyItemChange(): void {
		for (const l of this.itemChangeListeners) l(this.currentItemIndex, this.items.length);
		this.config.onItemChange?.(this.currentItemIndex, this.items.length);
	}

	private notifySectionChange(): void {
		const q = this.items[this.currentItemIndex];
		const sectionIndex = q?.sectionIndex ?? 0;
		const totalSections = this.getAllSections().length;
		for (const l of this.sectionChangeListeners) l(sectionIndex, totalSections);
		this.config.onSectionChange?.(sectionIndex, totalSections);
	}

	private notifyResponseChange(): void {
		const responses = this.sessionCoordinator.getActiveResponses();
		for (const l of this.responseChangeListeners) l(responses);
		this.config.onResponseChange?.(responses);
	}

	private notifyComplete(): void {
		for (const l of this.completeListeners) l();
	}

	private notifyTimeWarning(remainingSeconds: number): void {
		for (const l of this.timeWarningListeners) l(remainingSeconds);
	}

	private notifyTimeExpired(): void {
		for (const l of this.timeExpiredListeners) l();
	}

	private notifyTimeTick(remainingSeconds: number, elapsedSeconds: number): void {
		for (const l of this.timeTickListeners) l(remainingSeconds, elapsedSeconds);
	}

	/**
	 * Get the i18n provider instance
	 * @returns I18nProvider instance
	 */
	public getI18nProvider(): any {
		return this.i18nProvider;
	}

	/**
	 * Create a simple fallback i18n provider when none is provided
	 */
	private createDefaultI18nProvider(): any {
		return {
			getLocale: () => 'en-US',
			setLocale: () => {},
			t: (key: string) => key, // Fallback to key
			plural: (key: string) => key,
			formatNumber: (value: number) => value.toString(),
			formatDate: (date: Date) => date.toISOString(),
		};
	}
}

/** Fisher-Yates shuffle using a provided RNG (returns a new array). */
function shuffleArray<T>(arr: T[], rng: () => number): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
