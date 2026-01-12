/**
 * AssessmentPlayer (backend-authoritative)
 *
 * Client responsibilities:
 * - Render items using @pie-qti/qti2-item-player
 * - Collect candidate responses
 * - Submit responses to BackendAdapter
 * - Apply backend navigation decisions + session state
 */

import type { QTIRole } from '@pie-qti/qti2-item-player';
import { Player } from '@pie-qti/qti2-item-player';
import type {
	BackendAdapter,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	ScoringResult,
	SecureAssessment,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	SessionId,
	SessionState,
} from '../integration/api-contract.js';
import type {
	AssessmentResults,
	ItemResult,
	NavigationState,
} from '../types/index.js';
import { ItemSessionController } from './ItemSessionController.js';
import { NavigationManager } from './NavigationManager.js';
import { TimeManager } from './TimeManager.js';

export interface BackendAssessmentPlayerConfig {
	backend: BackendAdapter;
	initSession: InitSessionRequest;
	role?: QTIRole;
	/**
	 * Optional hint for item renderers that support multiple extended text editors.
	 * (Plumbed through the shell; the item player remains authoritative for behavior.)
	 */
	extendedTextEditor?: string;
	/**
	 * Optional i18n provider for internationalization.
	 * If provided, this will be shared across all item players in the assessment.
	 */
	i18nProvider?: any; // Will be I18nProvider from @pie-qti/qti2-i18n
	/**
	 * Security configuration for URL policy and content restrictions.
	 * If provided, this will be passed to all item players in the assessment.
	 */
	security?: any; // Will be PlayerSecurityConfig from @pie-qti/qti2-item-player
	// UI options
	showSections?: boolean;
	allowSectionNavigation?: boolean;
	showProgress?: boolean;
	// Time management
	timeWarningThreshold?: number;
	// Callbacks
	onItemChange?: (itemIndex: number, totalItems: number) => void;
	onSectionChange?: (sectionIndex: number, totalSections: number) => void;
	onResponseChange?: (responses: Record<string, unknown>) => void;
	onComplete?: () => void;
}

type FlatQuestion = {
	identifier: string;
	item: SecureItemRef;
	section: SecureSection;
	testPart: SecureTestPart;
	index: number;
	sectionIndex: number;
};

export class AssessmentPlayer {
	public static async create(config: BackendAssessmentPlayerConfig): Promise<AssessmentPlayer> {
		const init = await config.backend.initSession(config.initSession);
		return new AssessmentPlayer(config, init);
	}

	private backend: BackendAdapter;
	private sessionId: SessionId;
	private assessment: SecureAssessment;
	private state: SessionState;
	private i18nProvider: any; // I18nProvider from @pie-qti/qti2-i18n

	private navigationManager: NavigationManager;
	private sessionController: ItemSessionController;
	private timeManager: TimeManager | null = null;

	private questions: FlatQuestion[] = [];
	private currentItemIndex = -1;
	private currentItemPlayer: Player | null = null;
	private responses: Record<string, unknown> = {};
	private itemResults: Map<string, ItemResult> = new Map();
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
		this.state =
			init.restoredState ??
			({
				currentItemIdentifier: '',
				visitedItems: [],
				itemResponses: {},
				itemScores: {},
				timing: { startedAt: Date.now(), itemTimes: {}, totalTime: 0 },
			} as SessionState);

		this.questions = this.flattenQuestions(this.assessment);

		const navigationMode = this.assessment.navigationMode || 'nonlinear';
		this.navigationManager = new NavigationManager(navigationMode, this.questions.length);

		// Item session control is a UI hint; backend remains authoritative.
		const itemSessionControl = this.assessment.testParts?.[0]?.itemSessionControl;
		this.sessionController = new ItemSessionController(itemSessionControl);

		// Initialize per-item session state so itemSessionControl checks work immediately.
		for (const q of this.questions) {
			this.sessionController.initializeItem(q.identifier);
		}

		// Initialize time manager if time limits exist
		if (this.assessment.timeLimits?.maxTime) {
			this.timeManager = new TimeManager({
				assessmentTimeLimits: this.assessment.timeLimits,
				warningThreshold: config.timeWarningThreshold || 60,
				onWarning: (remainingSeconds) => this.notifyTimeWarning(remainingSeconds),
				onExpired: () => this.notifyTimeExpired(),
				onTick: (remainingSeconds, elapsedSeconds) => this.notifyTimeTick(remainingSeconds, elapsedSeconds),
			});
		}

		// Restore to backend-provided current item if present
		const startId = this.state.currentItemIdentifier;
		const idx = startId ? this.questions.findIndex((q) => q.identifier === startId) : -1;
		if (idx >= 0) {
			this.navigateTo(idx).catch(() => {});
		}
	}

	private hasAnyResponse(responses: Record<string, unknown>): boolean {
		for (const v of Object.values(responses)) {
			if (v == null) continue;
			if (Array.isArray(v)) {
				if (v.length > 0) return true;
				continue;
			}
			if (typeof v === 'string') {
				if (v.trim().length > 0) return true;
				continue;
			}
			// object / number / boolean etc.
			return true;
		}
		return false;
	}

	private flattenQuestions(assessment: SecureAssessment): FlatQuestion[] {
		const out: FlatQuestion[] = [];
		const testParts = assessment.testParts || [];
		let idx = 0;
		let secIdx = 0;

		for (const tp of testParts) {
			for (const section of tp.sections || []) {
				for (const item of section.items || []) {
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
		const total = this.questions.length;
		const canPrevious = this.canPrevious();
		const canNext = this.canNext();
		const q = this.questions[this.currentItemIndex];
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

	public getCurrentQuestion(): any | null {
		const q = this.questions[this.currentItemIndex];
		if (!q) return null;
		// Keep the legacy QuestionRef-ish shape expected by ItemRenderer.svelte
		return {
			identifier: q.item.identifier,
			title: q.section.title,
			required: q.item.required,
			itemXml: q.item.itemXml,
		};
	}

	public getCurrentRubricBlocks(): any[] {
		const q = this.questions[this.currentItemIndex];
		if (!q) return [];
		return q.section.rubrics || q.testPart.rubrics || [];
	}

	public getVisibleFeedback(): Array<{ identifier: string; content: string; access: string }> {
		return this.visibleFeedback;
	}

	public updateResponse(responseId: string, value: unknown): void {
		this.responses = { ...this.responses, [responseId]: value };
		const q = this.questions[this.currentItemIndex];
		if (q) {
			this.state.itemResponses[q.identifier] = this.responses as any;
			this.sessionController.markAnswered(q.identifier, this.hasAnyResponse(this.responses));
		}
		this.notifyResponseChange();
	}

	/**
	 * Update a response for a specific item.
	 * Useful when response events are observed outside the current-item renderer and we
	 * want to be explicit about which item receives the response (some assessments reuse
	 * the same responseIdentifier like "RESPONSE" across items).
	 */
	public updateResponseForItem(itemIdentifier: string, responseId: string, value: unknown): void {
		const prev = (this.state.itemResponses?.[itemIdentifier] || {}) as Record<string, unknown>;
		const next = { ...prev, [responseId]: value };
		this.state.itemResponses[itemIdentifier] = next as any;

		// If this is the active item, keep the live response state + UI hints in sync.
		const active = this.questions[this.currentItemIndex];
		if (active?.identifier === itemIdentifier) {
			this.responses = next;
			this.sessionController.markAnswered(itemIdentifier, this.hasAnyResponse(this.responses));
			this.currentItemPlayer?.setResponses(this.responses as any);
			this.notifyResponseChange();
		}
	}

	/**
	 * Get current unsaved responses for the active item.
	 * (Useful for host integrations / web components.)
	 */
	public getResponses(): Record<string, unknown> {
		return { ...this.responses };
	}

	/**
	 * Get the current session state snapshot (client-side view).
	 * Note: backend remains authoritative; this is intended for simple save/resume.
	 */
	public getState(): SessionState {
		// Shallow clone to avoid accidental external mutation.
		return {
			...this.state,
			visitedItems: [...this.state.visitedItems],
			itemResponses: { ...this.state.itemResponses },
			itemScores: this.state.itemScores ? { ...this.state.itemScores } : undefined,
			timing: {
				...this.state.timing,
				itemTimes: { ...this.state.timing.itemTimes },
			},
		};
	}

	/**
	 * Restore a previously saved session state.
	 */
	public async restoreState(state: SessionState): Promise<void> {
		this.state = state;

		// Restore visited state for UI navigation hints.
		const visitedIdx = (state.visitedItems || [])
			.map((id) => this.questions.findIndex((q) => q.identifier === id))
			.filter((i) => i >= 0);
		this.navigationManager.restoreState(visitedIdx);

		// Rehydrate itemResults from scores if present, so submit() can behave sensibly.
		this.itemResults.clear();
		if (state.itemScores) {
			for (const [itemIdentifier, scoring] of Object.entries(state.itemScores)) {
				this.itemResults.set(itemIdentifier, {
					itemIdentifier,
					score: scoring.score,
					maxScore: scoring.maxScore,
					responses: state.itemResponses?.[itemIdentifier] || {},
				});
			}
		}

		const currentId = state.currentItemIdentifier;
		const idx = currentId ? this.questions.findIndex((q) => q.identifier === currentId) : -1;
		if (idx >= 0) {
			await this.navigateTo(idx);
		} else if (this.questions.length > 0) {
			await this.navigateTo(0);
		}
	}

	public async navigateTo(index: number): Promise<void> {
		if (index < 0 || index >= this.questions.length) throw new Error(`Invalid item index: ${index}`);

		// Enforce navigation rules (UI hints, still backend-authoritative for real deployments).
		if (this.currentItemIndex >= 0 && !this.navigationManager.canNavigateTo(index, this.currentItemIndex)) {
			if (this.navigationManager.getMode() === 'linear' && index > this.currentItemIndex + 1) {
				throw new Error('In linear navigation mode, you can only move to the next question.');
			}
			throw new Error('Navigation is not allowed.');
		}
		const target = this.questions[index];
		if (target && !this.sessionController.canReview(target.identifier)) {
			throw new Error('You cannot go back to previous questions in this assessment.');
		}

		this.currentItemIndex = index;
		const q = this.questions[index]!;
		this.state.currentItemIdentifier = q.identifier;

		// Restore responses
		this.responses = { ...(this.state.itemResponses[q.identifier] || {}) };

		// Create item player
		this.currentItemPlayer = new Player({
			itemXml: q.item.itemXml,
			role: q.item.role,
			i18nProvider: this.i18nProvider,
		});
		this.currentItemPlayer.setResponses(this.responses as any);

		this.notifyItemChange();
		this.notifySectionChange();
	}

	public async navigateToSection(sectionId: string): Promise<void> {
		const idx = this.questions.findIndex((q) => q.section.identifier === sectionId);
		if (idx >= 0) await this.navigateTo(idx);
	}

	public async next(): Promise<void> {
		const state = this.getNavigationState();
		if (!state.canNext) return;

		const q = this.questions[this.currentItemIndex];
		if (q) {
			const hasResponses = this.hasAnyResponse(this.responses);
			this.sessionController.markAnswered(q.identifier, hasResponses);

			const navAway = this.sessionController.canNavigateAway(q.identifier, hasResponses);
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
		const q = this.questions[this.currentItemIndex];
		if (!q) throw new Error('No current item');

		const submittedAt = Date.now();
		const res = await this.backend.submitResponses({
			sessionId: this.sessionId,
			itemIdentifier: q.identifier,
			responses: this.responses as any,
			submittedAt,
		});

		if (!res.success || !res.result) {
			throw new Error(res.error || 'Submit failed');
		}

		if (res.updatedState) {
			this.state = res.updatedState;
		} else {
			// Minimal state update when backend doesn't return full state.
			this.state.itemScores = this.state.itemScores || {};
			this.state.itemScores[q.identifier] = res.result;
			if (!this.state.visitedItems.includes(q.identifier)) this.state.visitedItems.push(q.identifier);
			this.state.itemResponses[q.identifier] = this.responses as any;
		}

		const itemResult: ItemResult = {
			itemIdentifier: q.identifier,
			score: res.result.score,
			maxScore: res.result.maxScore,
			responses: { ...this.responses },
		};
		this.itemResults.set(q.identifier, itemResult);

		// Track item session rules (review/attempts) and visited items for navigation hints.
		try {
			this.sessionController.recordAttempt(q.identifier);
		} catch {
			// ignore
		}
		this.sessionController.markAnswered(q.identifier, this.hasAnyResponse(this.responses));
		this.navigationManager.markVisited(this.currentItemIndex);

		// Apply backend branching decision if provided
		if (res.nextItemIdentifier) {
			const nextIdx = this.questions.findIndex((x) => x.identifier === res.nextItemIdentifier);
			if (nextIdx >= 0) {
				await this.navigateTo(nextIdx);
			}
		}

		return itemResult;
	}

	private canPrevious(): boolean {
		if (this.currentItemIndex <= 0) return false;
		const prev = this.questions[this.currentItemIndex - 1];
		if (!prev) return false;
		if (!this.navigationManager.canNavigateTo(this.currentItemIndex - 1, this.currentItemIndex)) return false;
		return this.sessionController.canReview(prev.identifier);
	}

	private canNext(): boolean {
		if (this.currentItemIndex < 0) return false;
		const nextIdx = this.currentItemIndex + 1;
		if (nextIdx >= this.questions.length) return false;
		if (!this.navigationManager.canNavigateTo(nextIdx, this.currentItemIndex)) return false;
		// Note: itemSessionControl constraints on leaving current item are enforced in next().
		return true;
	}

	/** Submit entire assessment (finalize on backend) */
	public async submit(): Promise<AssessmentResults> {
		// For simultaneous submission, ensure all items are submitted before finalize so
		// the backend can compute a complete test score.
		if (this.assessment.submissionMode === 'simultaneous') {
			// Preserve client-collected responses across backend state updates.
			// Some backend adapters return an updatedState snapshot that may only include
			// responses for items that have been submitted so far, which would otherwise
			// wipe out responses for later items during this loop.
			const allItemResponses = { ...(this.state.itemResponses || {}) } as any;

			for (const q of this.questions) {
				if (this.itemResults.has(q.identifier)) continue;
				const submittedAt = Date.now();
				const responsesForItem = (allItemResponses?.[q.identifier] || {}) as any;
				const res = await this.backend.submitResponses({
					sessionId: this.sessionId,
					itemIdentifier: q.identifier,
					responses: responsesForItem,
					submittedAt,
				});
				if (!res.success || !res.result) {
					throw new Error(res.error || `Submit failed for item ${q.identifier}`);
				}
				if (res.updatedState) {
					this.state = res.updatedState;
					// Restore full response map captured on the client.
					this.state.itemResponses = allItemResponses;
				} else {
					this.state.itemScores = this.state.itemScores || {};
					this.state.itemScores[q.identifier] = res.result;
					if (!this.state.visitedItems.includes(q.identifier)) this.state.visitedItems.push(q.identifier);
					this.state.itemResponses[q.identifier] = responsesForItem;
				}
				this.itemResults.set(q.identifier, {
					itemIdentifier: q.identifier,
					score: res.result.score,
					maxScore: res.result.maxScore,
					responses: this.state.itemResponses[q.identifier] || {},
				});
			}
		} else {
			// Ensure current item is submitted (individual submission mode)
			const q = this.questions[this.currentItemIndex];
			if (q && !this.itemResults.has(q.identifier)) {
				await this.submitCurrentItem();
			}
		}

		const finalized: FinalizeAssessmentResponse = await this.backend.finalizeAssessment({
			sessionId: this.sessionId,
		});
		if (!finalized.success) throw new Error('Finalize failed');

		// Map backend itemScores to ItemResult[]
		const itemScores = finalized.itemScores || {};
		const itemResults: ItemResult[] = Object.values(itemScores).map((r: ScoringResult) => ({
			itemIdentifier: r.itemIdentifier,
			score: r.score,
			maxScore: r.maxScore,
			responses: this.state.itemResponses[r.itemIdentifier] || {},
		}));

		this.visibleFeedback = finalized.feedback
			? [{ identifier: 'testFeedback', content: finalized.feedback, access: 'atEnd' }]
			: [];

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
		const q = this.questions[this.currentItemIndex];
		if (!q) return null;
		const id = q.identifier;

		const state = this.sessionController.getItemState(id);
		if (!state) {
			this.sessionController.initializeItem(id);
		}
		const st = this.sessionController.getItemState(id);
		return {
			canSubmit: this.sessionController.canSubmit(id),
			remainingAttempts: this.sessionController.getRemainingAttempts(id),
			attemptCount: st?.attemptCount ?? 0,
			showFeedback: this.sessionController.shouldShowFeedback(id),
			showSolution: this.sessionController.shouldShowSolution(id),
			canReview: this.sessionController.canReview(id),
			canSkip: this.sessionController.canSkip(id),
		};
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
		for (const l of this.itemChangeListeners) l(this.currentItemIndex, this.questions.length);
		this.config.onItemChange?.(this.currentItemIndex, this.questions.length);
	}

	private notifySectionChange(): void {
		const q = this.questions[this.currentItemIndex];
		const sectionIndex = q?.sectionIndex ?? 0;
		const totalSections = this.getAllSections().length;
		for (const l of this.sectionChangeListeners) l(sectionIndex, totalSections);
		this.config.onSectionChange?.(sectionIndex, totalSections);
	}

	private notifyResponseChange(): void {
		for (const l of this.responseChangeListeners) l(this.responses);
		this.config.onResponseChange?.(this.responses);
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
