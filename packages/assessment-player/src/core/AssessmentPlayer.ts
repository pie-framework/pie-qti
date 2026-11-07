/**
 * AssessmentPlayer (backend-authoritative)
 *
 * Client responsibilities:
 * - Render items using @pie-qti/item-player
 * - Collect candidate responses
 * - Submit responses to BackendAdapter
 * - Apply backend navigation decisions + session state
 */

import {
	createAssessmentItemDefinition,
	type AssessmentItemDefinition,
	type AssessmentItemDefinitionPlugin,
	type ItemSession,
	type PciConfiguration,
	type PnpProfile,
	type PlayerSecurityConfig,
	type QTIRole,
	type SerializedItemSessionState,
} from '@pie-qti/item-player';
import { DefaultI18nProvider, type I18nProvider } from '@pie-qti/i18n';
import { isShownByIdentifier } from '@pie-qti/qti-common';
import type { QtiSectionRuntimeHostContract, QtiSectionToolConfig } from '@pie-qti/section-player';
import type {
	AssessmentRubricBlock,
	AssessmentSessionState,
	AssessmentScoringResult,
	BackendAdapter,
	FinalizeAssessmentResponse,
	InitSessionRequest,
	InitSessionResponse,
	OutcomeProcessingError,
	SecureAssessment,
	SecureItemRef,
	SecureSection,
	SecureTestPart,
	SessionId,
	TestFeedbackItem,
	TestOutcomeValues,
} from '../integration/api-contract.js';
import type {
	AssessmentResults,
	CandidateSectionView,
	ItemResult,
	NavigationState,
	TimeLimits,
	VisibleTestFeedback,
} from '../types/index.js';
import { AssessmentSessionCoordinator } from './AssessmentSessionCoordinator.js';
import { AssessmentPlayerError, type AssessmentPlayerErrorCode } from './errors.js';
import { NavigationManager } from './NavigationManager.js';
import {
	deliveredItems,
	evaluateTestExpression,
	isAdaptiveItemXml,
	plainQtiValue,
	resolveItemSessionControl,
	sectionComponents,
	testOutcomeDeclarations,
} from './testStructure.js';
import { extendTimeLimit, TimeManager } from './TimeManager.js';
import {
	interactionResponseIdentifiers,
	itemAnswerStatus,
	itemTitleFromXml,
	type ForwardTransitionInfo,
	type ItemAnswerStatus,
	type ReviewItemView,
} from './reviewState.js';

export interface BackendAssessmentPlayerConfig {
	backend: BackendAdapter;
	initSession: InitSessionRequest;
	role?: QTIRole;
	/**
	 * @deprecated Ignored. The backend draws selection and ordering at session start; pass an rng to
	 * `new ReferenceBackendAdapter({ rng })` for deterministic draws.
	 */
	rng?: () => number;
	/** Definition-lifetime extractor and renderer extensions applied to every item. */
	plugins?: readonly AssessmentItemDefinitionPlugin[];
	/**
	 * Shared catalog files the package manifest lists (resource type
	 * `imsqti_catalog_xmlv3p0`), read by the host that loaded the package. When the
	 * reference backend parses the assessment test they become package-scope
	 * catalog sources beneath item-level catalogs (QTI 3.0 §6.3).
	 */
	sharedCatalogs?: ReadonlyArray<{ href?: string; xml?: string }>;
	/**
	 * Optional i18n provider for internationalization.
	 * If provided, this will be shared across all item players in the assessment.
	 */
	i18nProvider?: I18nProvider;
	/**
	 * Security configuration for URL policy and content restrictions.
	 * If provided, this will be passed to all item players in the assessment.
	 */
	security?: PlayerSecurityConfig;
	/**
	 * Explicit host trust configuration for Portable Custom Interaction modules.
	 * Without this resolver, authored PCI code remains disabled.
	 */
	pci?: PciConfiguration;
	/**
	 * Optional host hooks for delegated section rendering.
	 * Used for section shared-content URL policy and runtime callbacks.
	 */
	sectionHost?: QtiSectionRuntimeHostContract;
	/** Optional section-scoped tools rendered by delegated section players. */
	sectionTools?: QtiSectionToolConfig[];
	/** Optional tools rendered in passage/rubric headers. */
	passageTools?: QtiSectionToolConfig[];
	/** Optional tools rendered in item headers. */
	itemTools?: QtiSectionToolConfig[];
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
	 * Deterministic clock for time-limit tracking. Defaults to Date.now; intended for
	 * tests and hosts that drive delivery from their own timeline.
	 */
	now?: () => number;
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
	/**
	 * Host hook for core and backend failures. Errors are `AssessmentPlayerError`
	 * instances carrying a stable `code` for localization; `message` keeps the raw
	 * detail (including backend error text) for logs — never show it to candidates.
	 */
	onError?: (error: Error) => void;
}

type FlatItem = {
	identifier: string;
	item: SecureItemRef;
	/** Innermost enclosing section. */
	section: SecureSection;
	/** Enclosing sections, outermost first. */
	sections: SecureSection[];
	/** Outermost enclosing section the candidate is actually shown (QTI visible="false" merges content into the parent). */
	presentedSection: SecureSection | undefined;
	testPart: SecureTestPart;
	index: number;
	/** Index of `presentedSection` in the candidate-facing section list; -1 when none is visible. */
	sectionIndex: number;
};

type CurrentItemView = {
	identifier: string;
	title?: string;
	required?: boolean;
	itemXml: string;
	deliveryContext?: SecureItemRef['deliveryContext'];
};

type SectionItemRefView = {
	identifier: string;
	href?: string;
	title?: string;
	itemXml: string;
	deliveryContext?: SecureItemRef['deliveryContext'];
};

export interface EffectiveItemTimeLimits {
	timeLimits?: TimeLimits;
	source?: 'item' | 'section' | 'testPart' | 'assessment';
}

export class AssessmentPlayer {
	public static async create(config: BackendAssessmentPlayerConfig): Promise<AssessmentPlayer> {
		const init = await config.backend.initSession(config.initSession);
		return new AssessmentPlayer(config, init);
	}

	private backend: BackendAdapter;
	private sessionId: SessionId;
	private assessment: SecureAssessment;
	private i18nProvider: I18nProvider;

	private navigationManager: NavigationManager;
	private sessionCoordinator!: AssessmentSessionCoordinator;
	private timeManager: TimeManager | null = null;

	private items: FlatItem[] = [];
	private currentItemIndex = -1;
	private readonly itemDefinitions = new Map<string, AssessmentItemDefinition>();
	private currentItemSession: ItemSession | null = null;
	private currentItemSessionUnsubscribe: (() => void) | null = null;
	/** Test-level outcomes from the last outcome processing; null until it first runs. */
	private testOutcomes: TestOutcomeValues | null = null;
	private finalized = false;
	/** Results produced by the finalization; returned when submit() is called again after the end. */
	private finalResults: AssessmentResults | null = null;
	/** Scopes whose time limit expired without late submission, keyed `scope:identifier`. */
	private readonly lockedScopes = new Set<string>();
	private legacyFeedback: string | undefined;
	/**
	 * Navigation serialization: exactly one navigation or submission transition may run at
	 * a time. While set, further navigation and submit calls are rejected as busy.
	 */
	private transitionInFlight = false;
	/** Last reported test-level outcome-processing failure, so hosts hear about each new one once. */
	private reportedOutcomeProcessingError: OutcomeProcessingError | null = null;

	// Event listeners
	private itemChangeListeners = new Set<(index: number, total: number) => void>();
	private sectionChangeListeners = new Set<(index: number, total: number) => void>();
	private responseChangeListeners = new Set<(responses: Record<string, unknown>) => void>();
	private completeListeners = new Set<() => void>();
	private busyChangeListeners = new Set<(busy: boolean) => void>();
	private testFeedbackChangeListeners = new Set<() => void>();
	private timeWarningListeners = new Set<(remainingSeconds: number) => void>();
	private timeExpiredListeners = new Set<() => void>();
	private timeTickListeners = new Set<(remainingSeconds: number, elapsedSeconds: number) => void>();
	private flagChangeListeners = new Set<(itemIdentifier: string, flagged: boolean) => void>();
	/** Item XML–derived review facts (interaction response ids, item title) per item identifier. */
	private readonly reviewInfoCache = new Map<string, { responseIds: string[]; title?: string }>();

	private constructor(private config: BackendAssessmentPlayerConfig, init: InitSessionResponse) {
		this.backend = config.backend;
		this.sessionId = init.sessionId;
		this.assessment = init.assessment;
		this.testOutcomes = init.outcomes ? cloneData(init.outcomes)! : null;
		this.i18nProvider = config.i18nProvider ?? this.createDefaultI18nProvider();
		const initialState =
			init.restoredState ??
			({
				currentItemIdentifier: init.currentItemIdentifier ?? '',
				visitedItems: [],
				itemResponses: {},
				itemScores: {},
				itemSessions: {},
				timing: { startedAt: Date.now(), itemTimes: {}, totalTime: 0 },
			} as AssessmentSessionState);

		this.items = this.flattenItems(this.assessment);

		this.navigationManager = new NavigationManager();

		// Item session control is a UI hint; backend remains authoritative.
		this.sessionCoordinator = new AssessmentSessionCoordinator({
			state: initialState,
			itemIdentifiers: this.items.map((q) => q.identifier),
			itemSessionControlByItem: Object.fromEntries(
				this.items.map((q) => [q.identifier, resolveItemSessionControl(q.testPart, q.sections, q.item)]),
			),
		});

		this.timeManager = new TimeManager({
			assessmentTimeLimits: this.assessment.timeLimits,
			warningThreshold: config.timeWarningThreshold || 60,
			now: config.now,
			extendedTime: config.pnp?.content?.extendedTime,
			onWarning: (remainingSeconds) => this.notifyTimeWarning(remainingSeconds),
			onExpired: () => this.notifyTimeExpired(),
			onScopeExpired: (scope, identifier) => this.handleScopeExpired(scope, identifier),
			onTick: (remainingSeconds, elapsedSeconds) => this.notifyTimeTick(remainingSeconds, elapsedSeconds),
		});
		if (init.restoredState?.timing) {
			this.restoreTimeTracking(init.restoredState.timing);
		}

		// Restore to backend-provided current item if present
		const startId = this.state.currentItemIdentifier;
		const idx = startId ? this.items.findIndex((q) => q.identifier === startId) : -1;
		if (idx >= 0) {
			this.performNavigateTo(idx, { restoring: true }).catch(() => {});
		} else if (this.items.length > 0) {
			this.performNavigateTo(0, { restoring: true }).catch(() => {});
		}
	}

	private get state(): AssessmentSessionState {
		return this.sessionCoordinator.state;
	}

	private set state(state: AssessmentSessionState) {
		this.sessionCoordinator.restoreState(state);
	}

	/**
	 * Whether a navigation or submission transition is currently in flight. Shells must
	 * disable navigation controls while this is set.
	 */
	public isBusy(): boolean {
		return this.transitionInFlight;
	}

	/**
	 * Serialize navigation and submission transitions. Exactly one transition runs at a
	 * time; concurrent navigation or submit calls reject with a typed `navigationInFlight`
	 * error instead of racing the in-flight backend request.
	 */
	private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
		if (this.transitionInFlight) {
			throw new AssessmentPlayerError(
				'navigationInFlight',
				'A navigation or submission transition is already in progress.',
			);
		}
		this.transitionInFlight = true;
		this.notifyBusyChange(true);
		try {
			return await operation();
		} finally {
			this.transitionInFlight = false;
			this.notifyBusyChange(false);
		}
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
				const scopedMaxTime = extendTimeLimit(scope.limits.maxTime, this.config.pnp?.content?.extendedTime);
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
		const scopeIdentifier = effective.source === 'item'
			? q.identifier
			: effective.source === 'section'
				? q.section.identifier
				: effective.source === 'testPart'
					? q.testPart.identifier
					: undefined;
		const tracked = this.timeManager?.getScopeElapsedMs(effective.source, scopeIdentifier);
		const scopedElapsedMs = tracked ?? elapsedMs;
		return {
			scope: effective.source,
			elapsedMs: scopedElapsedMs,
			limitSeconds,
			expired: scopedElapsedMs >= limitSeconds * 1000,
			allowLateSubmission: effective.timeLimits?.allowLateSubmission,
		};
	}

	private assertMinimumTime(scope: 'assessment' | 'testPart' | 'section' | 'item', q: FlatItem): void {
		const limits = scope === 'assessment'
			? this.assessment.timeLimits
			: scope === 'testPart'
				? q.testPart.timeLimits
				: scope === 'section'
					? q.section.timeLimits
					: q.item.timeLimits;
		if (limits?.minTime === undefined) return;
		const identifier = scope === 'testPart'
			? q.testPart.identifier
			: scope === 'section'
				? q.section.identifier
				: scope === 'item'
					? q.identifier
					: undefined;
		const elapsedMs = this.timeManager?.getScopeElapsedMs(scope, identifier) ?? 0;
		if (elapsedMs < limits.minTime * 1000) {
			const remaining = Math.ceil(limits.minTime - elapsedMs / 1000);
			throw new AssessmentPlayerError(
				'minTimeNotElapsed',
				`The ${scope} minimum time has not elapsed (${remaining}s remaining).`,
				{ scope, remaining },
			);
		}
	}

	private assertTransitionMinimum(current: FlatItem, target: FlatItem): void {
		if (current === target) return;
		this.assertMinimumTime('item', current);
		if (current.section.identifier !== target.section.identifier) this.assertMinimumTime('section', current);
		if (current.testPart !== target.testPart) this.assertMinimumTime('testPart', current);
	}

	private flattenItems(assessment: SecureAssessment): FlatItem[] {
		const sectionIndexes = new Map(
			this.presentedSectionList().map((section, index) => [section.identifier, index]),
		);
		return deliveredItems(assessment).map(({ item, testPart, sections }, index) => {
			const section = sections[sections.length - 1];
			const presentedSection = this.presentedSectionOf(sections);
			return {
				identifier: item.identifier,
				item,
				section,
				sections,
				presentedSection,
				testPart,
				index,
				sectionIndex: presentedSection ? (sectionIndexes.get(presentedSection.identifier) ?? -1) : -1,
			};
		});
	}

	/**
	 * Sections presented to the candidate: visible themselves and under visible ancestors.
	 * A QTI `visible="false"` section is not presented as a section — its content appears as
	 * part of the parent — so neither it nor its descendants surface a title here. Items
	 * inside keep being delivered in order.
	 */
	private presentedSectionList(): SecureSection[] {
		const out: SecureSection[] = [];
		const seen = new Set<string>();
		const visit = (section: SecureSection, underInvisible: boolean): void => {
			const hidden = underInvisible || section.visible === false;
			if (!hidden && !seen.has(section.identifier)) {
				seen.add(section.identifier);
				out.push(section);
			}
			for (const component of sectionComponents(section)) {
				if (component.type === 'section') visit(component.section, hidden);
			}
		};
		for (const tp of this.assessment.testParts || []) {
			for (const section of tp.sections || []) visit(section, false);
		}
		return out;
	}

	/** Outermost enclosing section of an item that the candidate is shown, if any. */
	private presentedSectionOf(sections: readonly SecureSection[]): SecureSection | undefined {
		let underInvisible = false;
		for (const section of sections) {
			if (section.visible === false) {
				underInvisible = true;
				continue;
			}
			if (!underInvisible) return section;
		}
		return undefined;
	}

	/**
	 * Whether jumping to a presented section is legal right now: in linear navigation there
	 * is no jumping at all; in nonlinear navigation only sections of the current test part
	 * are reachable, never locked items or items review has closed. Finalized tests have no
	 * legal targets.
	 */
	private isLegalSectionTarget(section: SecureSection): boolean {
		if (this.finalized) return false;
		const current = this.items[this.currentItemIndex];
		if (!current) return false;
		const members = this.items.filter((q) =>
			q.sections.some((s) => s.identifier === section.identifier),
		);
		if (members.length === 0) return false;
		const mode = current.testPart.navigationMode ?? this.assessment.navigationMode ?? 'nonlinear';
		if (mode === 'linear') {
			return members.some((q) => q === current);
		}
		return members.some(
			(q) =>
				q.testPart === current.testPart &&
				!this.isItemLocked(q) &&
				this.sessionCoordinator.canReview(q.identifier),
		);
	}

	// ---------------------------------------------------------------------------
	// Public API used by components
	// ---------------------------------------------------------------------------

	/**
	 * The assessmentTest `title` the backend returned, trimmed, or `undefined` when it
	 * has none. Shells fall back to a localized generic title, never the identifier.
	 */
	public getAssessmentTitle(): string | undefined {
		const title = this.assessment.title?.trim();
		return title ? title : undefined;
	}

	/**
	 * Candidate-facing sections: visible sections only (QTI `visible="false"` sections are
	 * not presented as sections and their titles never surface), each with whether jumping
	 * to it is legal right now for the current navigationMode.
	 */
	public getAllSections(): CandidateSectionView[] {
		return this.presentedSectionList().map((section, index) => ({
			id: section.identifier,
			title: section.title,
			index,
			navigable: this.isLegalSectionTarget(section),
		}));
	}

	/**
	 * Whether jumping straight to a delivered item is legal right now: false once the test
	 * has finalized, and — for any item other than the current one — false while the target
	 * is time-locked, its review policy forbids returning, or the navigation rules (linear
	 * mode, test-part sequencing) do not reach it. The review screen renders illegal targets
	 * status-only; `navigateTo()` still enforces this authoritatively.
	 */
	public isNavigationTargetLegal(index: number): boolean {
		if (this.finalized || this.currentItemIndex < 0) return false;
		const target = this.items[index];
		if (!target) return false;
		if (target !== this.items[this.currentItemIndex]) {
			if (this.isItemLocked(target)) return false;
			if (!this.sessionCoordinator.canReview(target.identifier)) return false;
			if (!this.canNavigateByTestPart(index, this.currentItemIndex)) return false;
		}
		return true;
	}

	private reviewInfoFor(itemIdentifier: string): { responseIds: string[]; title?: string } {
		const cached = this.reviewInfoCache.get(itemIdentifier);
		if (cached) return cached;
		const flat = this.items.find((item) => item.identifier === itemIdentifier);
		const info = flat
			? {
				responseIds: interactionResponseIdentifiers(flat.item.itemXml),
				title: itemTitleFromXml(flat.item.itemXml),
			}
			: { responseIds: [] };
		this.reviewInfoCache.set(itemIdentifier, info);
		return info;
	}

	/**
	 * Answered / partially answered / unanswered for one delivered item, from its
	 * candidate responses (one verdict per interaction for composite items). The single
	 * definition of "answered" the review screen, section menu and submit confirmation share.
	 */
	public getItemAnswerStatus(itemIdentifier: string): ItemAnswerStatus {
		const info = this.reviewInfoFor(itemIdentifier);
		return itemAnswerStatus(this.sessionCoordinator.getResponses(itemIdentifier), info.responseIds);
	}

	/** How many delivered items carry a response (answered or partially answered). */
	public getAnsweredItemCount(): number {
		return this.items.filter((item) => this.getItemAnswerStatus(item.identifier) !== 'unanswered').length;
	}

	/** Every delivered item as the review screen lists it: status, flag, visited, jump legality. */
	public getReviewItems(): ReviewItemView[] {
		return this.items.map((item) => ({
			identifier: item.identifier,
			index: item.index,
			number: item.index + 1,
			sectionId: item.presentedSection?.identifier ?? null,
			title: this.reviewInfoFor(item.identifier).title,
			status: this.getItemAnswerStatus(item.identifier),
			flagged: this.sessionCoordinator.isItemFlagged(item.identifier),
			visited: this.navigationManager.isVisited(item.index) || item.index === this.currentItemIndex,
			jumpAllowed: this.isNavigationTargetLegal(item.index),
			isCurrent: item.index === this.currentItemIndex,
		}));
	}

	/**
	 * What the candidate's next forward step would do. QTI test parts are delivered in
	 * sequence and cannot be re-entered, so a step that leaves the current part is the
	 * irreversible move the shell confirms before making.
	 */
	public getForwardTransitionInfo(): ForwardTransitionInfo {
		const current = this.items[this.currentItemIndex];
		const nextIndex =
			this.finalized || this.currentItemIndex < 0 ? -1 : this.nextUnlockedIndex(this.currentItemIndex);
		const next = nextIndex >= 0 ? this.items[nextIndex] : undefined;
		return {
			nextIndex: next ? nextIndex : null,
			leavesTestPart: Boolean(current && next && next.testPart !== current.testPart),
		};
	}

	/**
	 * Set (or clear) the candidate's flag-for-review on an item; defaults to the current
	 * item. Flag state lives in the session state (`itemFlags`), survives navigation and
	 * is part of `getState()` snapshots.
	 */
	public setItemFlag(flagged: boolean, itemIdentifier?: string): void {
		const id = itemIdentifier ?? this.items[this.currentItemIndex]?.identifier;
		if (!id) return;
		this.sessionCoordinator.setItemFlag(id, flagged);
		for (const listener of this.flagChangeListeners) listener(id, flagged);
	}

	/** Toggle the current (or given) item's flag; returns the new state. */
	public toggleItemFlag(itemIdentifier?: string): boolean {
		const id = itemIdentifier ?? this.items[this.currentItemIndex]?.identifier;
		if (!id) return false;
		const flagged = !this.sessionCoordinator.isItemFlagged(id);
		this.setItemFlag(flagged, id);
		return flagged;
	}

	public isItemFlagged(itemIdentifier?: string): boolean {
		const id = itemIdentifier ?? this.items[this.currentItemIndex]?.identifier;
		return id ? this.sessionCoordinator.isItemFlagged(id) : false;
	}

	/** Identifiers of the items currently flagged for review. */
	public getFlaggedItemIdentifiers(): string[] {
		return this.sessionCoordinator.getFlaggedItemIdentifiers();
	}

	/** Fires when an item's flag-for-review state changes. */
	public onFlagChange(listener: (itemIdentifier: string, flagged: boolean) => void): () => void {
		this.flagChangeListeners.add(listener);
		return () => this.flagChangeListeners.delete(listener);
	}

	public getNavigationState(): NavigationState {
		const presented = this.presentedSectionList();
		const sectionIndexes = new Map(presented.map((section, index) => [section.identifier, index]));
		const total = this.items.length;
		const q = this.items[this.currentItemIndex];
		const presentedSection = q ? this.presentedSectionOf(q.sections) : undefined;
		return {
			currentIndex: this.currentItemIndex,
			totalItems: total,
			canNext: !this.finalized && this.canNext(),
			canPrevious: !this.finalized && this.canPrevious(),
			isLoading: this.transitionInFlight,
			isComplete: this.finalized,
			currentSection: presentedSection
				? {
					id: presentedSection.identifier,
					title: presentedSection.title,
					index: sectionIndexes.get(presentedSection.identifier) ?? -1,
				}
				: undefined,
			totalSections: presented.length,
		};
	}

	public getCurrentItem(): CurrentItemView | null {
		const q = this.items[this.currentItemIndex];
		if (!q) return null;
		return {
			identifier: q.item.identifier,
			title: q.presentedSection?.title,
			required: q.item.required,
			itemXml: q.item.itemXml,
			deliveryContext: q.item.deliveryContext,
		};
	}

	/**
	 * The one authoritative live session for the active item.
	 *
	 * Section and item renderers receive this exact instance. Serialized item-session
	 * state is reserved for persistence and restore, never for synchronizing a second
	 * live player.
	 */
	public getCurrentItemSession(): ItemSession | null {
		return this.currentItemSession;
	}

	public getCurrentSectionItemRefs(): SectionItemRefView[] {
		const current = this.items[this.currentItemIndex];
		if (!current) return [];

		return this.items
			.filter((item) => item.section.identifier === current.section.identifier)
			.map((item) => {
				const itemRef = item.item as SecureItemRef & { href?: string; title?: string };
				return {
					identifier: itemRef.identifier,
					href: itemRef.href,
					title: itemRef.title,
					itemXml: itemRef.itemXml,
					deliveryContext: cloneData(itemRef.deliveryContext),
				};
			});
	}

	public getResponsesForItem(itemIdentifier: string): Record<string, unknown> {
		return cloneData(this.sessionCoordinator.getResponses(itemIdentifier)) ?? {};
	}

	public getCurrentSharedRubricBlocks(): AssessmentRubricBlock[] {
		const q = this.items[this.currentItemIndex];
		if (!q) return [];

		return [
			...(q.testPart.rubricBlocks ?? []),
			...(q.section.rubricBlocks ?? []),
		].map((block) => ({ ...block, view: [...block.view] }));
	}

	public getCurrentRubricBlocks(): AssessmentRubricBlock[] {
		const q = this.items[this.currentItemIndex];
		if (!q) return [];
		return q.section.rubricBlocks || q.testPart.rubricBlocks || [];
	}

	/**
	 * Test feedback shown now, test-level first, then each test part's. Nothing shows before outcome
	 * processing first runs. `during` feedback then shows by its outcome, test-part `during`
	 * feedback while its part is current; `atEnd` feedback shows once the test, or its test part,
	 * has ended.
	 */
	public getVisibleFeedback(): VisibleTestFeedback[] {
		const outcomes = this.testOutcomes;
		const parts = this.assessment.testParts ?? [];
		const hasStructured =
			(this.assessment.testFeedback?.length ?? 0) > 0 || parts.some((part) => (part.testFeedback?.length ?? 0) > 0);
		if (!hasStructured) {
			return this.finalized && this.legacyFeedback
				? [{ key: 'testFeedback', identifier: 'testFeedback', content: this.legacyFeedback, access: 'atEnd' }]
				: [];
		}
		if (!outcomes) return [];

		const shown: VisibleTestFeedback[] = [];
		const add = (items: TestFeedbackItem[] | undefined, ended: boolean, current: boolean, part?: SecureTestPart) => {
			items?.forEach((fb, index) => {
				if (fb.access === 'atEnd' ? !ended : !current) return;
				if (!isShownByIdentifier(outcomes[fb.outcomeIdentifier] ?? null, fb.identifier, fb.showHide)) return;
				shown.push({
					key: part ? `part:${part.identifier}:${index}` : `test:${index}`,
					identifier: fb.identifier,
					content: fb.content,
					access: fb.access,
					...(part ? { testPartIdentifier: part.identifier } : {}),
				});
			});
		};
		add(this.assessment.testFeedback, this.finalized, true);
		const currentPart = this.currentTestPartIndex();
		parts.forEach((part, index) => {
			add(part.testFeedback, this.finalized || currentPart > index, currentPart === index, part);
		});
		return shown;
	}

	private currentTestPartIndex(): number {
		const part = this.items[this.currentItemIndex]?.testPart;
		return part ? (this.assessment.testParts ?? []).findIndex((p) => p.identifier === part.identifier) : -1;
	}

	private setTestOutcomes(outcomes: TestOutcomeValues | undefined): void {
		if (!outcomes) return;
		this.testOutcomes = cloneData(outcomes)!;
		this.notifyTestFeedbackChange();
	}

	public updateResponse(responseId: string, value: unknown): void {
		const active = this.items[this.currentItemIndex];
		if (!active) return;
		if (this.currentItemSession) {
			this.currentItemSession.dispatch({
				action: 'setResponse',
				responseIdentifier: responseId,
				value,
			});
			return;
		}
		this.sessionCoordinator.updateResponseForItem(active.identifier, responseId, value);
		this.notifyResponseChange();
	}

	/**
	 * Update a response for a specific item.
	 * Useful when response events are observed outside the current-item renderer and we
	 * want to be explicit about which item receives the response (some assessments reuse
	 * the same responseIdentifier like "RESPONSE" across items).
	 */
	public updateResponseForItem(itemIdentifier: string, responseId: string, value: unknown): void {
		const active = this.items[this.currentItemIndex];
		if (active?.identifier === itemIdentifier && this.currentItemSession) {
			const liveValue = this.currentItemSession.state().responses[responseId];
			if (!responseValuesEqual(liveValue, value)) {
				// Programmatic/host callers still enter through this API. Browser item
				// adapters have already dispatched, so their equal value is not applied twice.
				this.currentItemSession.dispatch({
					action: 'setResponse',
					responseIdentifier: responseId,
					value,
				});
			}
			return;
		}
		const persisted = this.sessionCoordinator.getPersistedItemSession(itemIdentifier);
		if (persisted && !isWritableItemLifecycle(persisted.lifecycleStatus)) {
			throw new AssessmentPlayerError(
				'itemSessionLocked',
				`Cannot update responses while item session is ${persisted.lifecycleStatus}`,
				{ status: persisted.lifecycleStatus },
			);
		}

		this.sessionCoordinator.updateResponseForItem(itemIdentifier, responseId, value);
		this.notifyResponseChange();
	}

	/**
	 * Get current unsaved responses for the active item.
	 * (Useful for host integrations / web components.)
	 */
	public getResponses(): Record<string, unknown> {
		if (this.currentItemSession) {
			return cloneData(this.currentItemSession.state().responses) ?? {};
		}
		return this.sessionCoordinator.getActiveResponses();
	}

	public saveCurrentItemSession(): SerializedItemSessionState | null {
		const q = this.items[this.currentItemIndex];
		if (!q || !this.currentItemSession) return null;

		const currentView = this.currentItemSession.state();
		const transition = isWritableItemLifecycle(currentView.lifecycleStatus)
			? this.currentItemSession.dispatch({ action: 'suspendAttempt' })
			: null;
		const itemSession = transition?.result?.sessionState ?? this.currentItemSession.serialize();
		const responses = cloneData(transition?.current.responses ?? currentView.responses) ?? {};
		this.sessionCoordinator.saveItemSession(
			q.identifier,
			responses,
			itemSession,
			transition?.current.duration ?? currentView.duration,
		);
		return itemSession;
	}

	private endItemSessionForSubmit(
		q: FlatItem,
		responses: Record<string, unknown>,
		itemSession?: SerializedItemSessionState,
	): SerializedItemSessionState {
		const validateResponses = this.sessionCoordinator.mustValidateResponses(q.identifier);
		const endAttempt = (session: ItemSession): SerializedItemSessionState => {
			const result = session.dispatch({ action: 'endAttempt', validateResponses }).result;
			if (result?.validation && !result.validation.valid) {
				throw new Error(result.validation.issues[0]?.message || `Submit failed: invalid response for item ${q.identifier}`);
			}
			return result?.sessionState ?? session.serialize();
		};
		const active = this.items[this.currentItemIndex];
		if (
			active === q &&
			this.currentItemSession &&
			this.currentItemSession.state().lifecycleStatus !== 'suspended'
		) {
			return endAttempt(this.currentItemSession);
		}

		const session = this.getItemDefinition(q).openSession({
			restore: itemSession,
			responses: itemSession ? undefined : responses,
			activate: true,
		});
		try {
			return endAttempt(session);
		} finally {
			session.dispose();
		}
	}

	private getItemDefinition(q: FlatItem): AssessmentItemDefinition {
		const cached = this.itemDefinitions.get(q.identifier);
		if (cached) return cached;

		const definition = createAssessmentItemDefinition({
			itemXml: q.item.itemXml,
			// The assessment host chooses the authorized delivery role. Item refs are
			// content records and must not silently widen or narrow session capabilities.
			role: this.config.role ?? 'candidate',
			i18nProvider: this.i18nProvider,
			pnp: this.config.pnp,
			security: this.config.security,
			pci: this.config.pci,
			plugins: this.config.plugins,
			deliveryContext: q.item.deliveryContext,
		});
		this.itemDefinitions.set(q.identifier, definition);
		return definition;
	}

	private mirrorSessionResponses(
		itemIdentifier: string,
		responses: Readonly<Record<string, unknown>>,
	): boolean {
		const current = this.sessionCoordinator.getResponses(itemIdentifier);
		if (responseValuesEqual(current, responses)) return false;

		const snapshot = cloneResponseRecord(responses);
		this.state.itemResponses[itemIdentifier] = snapshot as any;
		this.sessionCoordinator.markAnswered(itemIdentifier, snapshot);
		return true;
	}

	private attachCurrentItemSession(q: FlatItem, session: ItemSession): void {
		this.currentItemSession = session;
		this.currentItemSessionUnsubscribe = session.subscribe((transition) => {
			if (this.currentItemSession !== session) return;
			if (this.mirrorSessionResponses(q.identifier, transition.current.responses)) {
				this.notifyResponseChange();
			}
		});
	}

	private releaseCurrentItemSession(): void {
		this.currentItemSessionUnsubscribe?.();
		this.currentItemSessionUnsubscribe = null;
		this.currentItemSession?.dispose();
		this.currentItemSession = null;
	}

	/**
	 * Get the current session state snapshot (client-side view).
	 * Note: backend remains authoritative; this is intended for simple save/resume.
	 */
	public getState(options: { includeItemSessions?: boolean } = {}): AssessmentSessionState {
		const snapshot = this.sessionCoordinator.snapshot(options);
		const current = this.items[this.currentItemIndex];
		if (options.includeItemSessions && current && this.currentItemSession) {
			// Navigation snapshots may predate edits made after revisiting this item.
			// Serialize the live authority without suspending the learner's attempt.
			snapshot.itemSessions = {
				...snapshot.itemSessions,
				[current.identifier]: this.currentItemSession.serialize(),
			};
		}
		const timing = this.timeManager?.getState();
		if (timing) {
			snapshot.timing = {
				startedAt: timing.startedAt,
				itemTimes: { ...timing.itemTimes },
				sectionTimes: { ...timing.sectionTimes },
				testPartTimes: { ...timing.testPartTimes },
				totalTime: timing.totalElapsed,
				currentItemIdentifier: timing.currentItemId,
				currentSectionIdentifier: timing.currentSectionId,
				currentTestPartIdentifier: timing.currentTestPartId,
				isPaused: timing.isPaused,
			};
		}
		return snapshot;
	}

	/**
	 * Restore a previously saved session state.
	 */
	public restoreState(state: AssessmentSessionState): Promise<void> {
		return this.runExclusive(async () => {
			this.state = state;
			this.restoreTimeTracking(state.timing);

			// Restore visited state for UI navigation hints.
			const visitedIdx = (state.visitedItems || [])
				.map((id) => this.items.findIndex((q) => q.identifier === id))
				.filter((i) => i >= 0);
			this.navigationManager.restoreState(visitedIdx);

			const currentId = state.currentItemIdentifier;
			const idx = currentId ? this.items.findIndex((q) => q.identifier === currentId) : -1;
			if (idx >= 0) {
				await this.performNavigateTo(idx, { restoring: true });
			} else if (this.items.length > 0) {
				await this.performNavigateTo(0, { restoring: true });
			}
		});
	}

	private restoreTimeTracking(timing: AssessmentSessionState['timing']): void {
		this.timeManager?.restoreState({
			totalElapsed: timing.totalTime,
			itemTimes: { ...timing.itemTimes },
			sectionTimes: { ...(timing.sectionTimes ?? {}) },
			testPartTimes: { ...(timing.testPartTimes ?? {}) },
			startedAt: timing.startedAt,
			currentItemId: timing.currentItemIdentifier,
			currentSectionId: timing.currentSectionIdentifier,
			currentTestPartId: timing.currentTestPartIdentifier,
			isPaused: timing.isPaused === true,
		});
	}

	/**
	 * Navigate to an item by index. Serialized with all other navigation and submission
	 * transitions: while one is in flight this rejects with a `navigationInFlight` error,
	 * and once the test has finalized it rejects with `testFinalized`.
	 */
	public navigateTo(index: number, options: { restoring?: boolean } = {}): Promise<void> {
		return this.runExclusive(() => this.performNavigateTo(index, options));
	}

	private async performNavigateTo(index: number, options: { restoring?: boolean } = {}): Promise<void> {
		if (index < 0 || index >= this.items.length) {
			throw new AssessmentPlayerError('invalidNavigationTarget', `Invalid item index: ${index}`, { index });
		}
		if (this.finalized && !options.restoring) {
			throw new AssessmentPlayerError(
				'testFinalized',
				'Cannot navigate: the assessment has ended.',
			);
		}

		// Enforce navigation rules (UI hints, still backend-authoritative for real deployments).
		if (!options.restoring && this.currentItemIndex >= 0 && !this.canNavigateByTestPart(index, this.currentItemIndex)) {
			const currentMode = this.items[this.currentItemIndex]?.testPart.navigationMode ?? this.assessment.navigationMode;
			if (currentMode === 'linear' && index > this.nextUnlockedIndex(this.currentItemIndex)) {
				throw new AssessmentPlayerError(
					'linearNavigationOnly',
					'In linear navigation mode, you can only move to the next question.',
				);
			}
			throw new AssessmentPlayerError('navigationNotAllowed', 'Navigation is not allowed.');
		}
		const target = this.items[index];
		if (!options.restoring && target && this.isItemLocked(target)) {
			throw new AssessmentPlayerError('itemTimeExpired', 'The time limit for this question has expired.');
		}
		if (!options.restoring && target && !this.sessionCoordinator.canReview(target.identifier)) {
			throw new AssessmentPlayerError(
				'reviewNotAllowed',
				'You cannot go back to previous questions in this assessment.',
			);
		}

		const currentItem = this.items[this.currentItemIndex];
		if (!options.restoring && currentItem && target) {
			this.assertTransitionMinimum(currentItem, target);
			if (currentItem.testPart !== target.testPart
				&& (currentItem.testPart.submissionMode ?? this.assessment.submissionMode) === 'simultaneous') {
				// Commit this part before leaving it; a failed request keeps the learner
				// in the current part so its remaining answers can be retried.
				await this.submitSimultaneousItems(this.items.filter((q) => q.testPart === currentItem.testPart));
			}
		}
		if (!options.restoring && this.currentItemIndex === index && this.currentItemSession) {
			return;
		}
		const currentSessionStatus = currentItem
			? this.currentItemSession?.state().lifecycleStatus ??
				this.state.itemSessions?.[currentItem.identifier]?.lifecycleStatus
			: undefined;
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
		this.navigationManager.markVisited(index);
		const q = this.items[index]!;
		this.state.currentItemIdentifier = q.identifier;
		this.timeManager?.activateScopes({
			testPart: { identifier: q.testPart.identifier, timeLimits: q.testPart.timeLimits },
			section: { identifier: q.section.identifier, timeLimits: q.section.timeLimits },
			item: { identifier: q.identifier, timeLimits: q.item.timeLimits },
		});

		// Restore responses into one live session owned by the assessment. The section
		// composition and item renderer receive this exact object.
		const responses = this.sessionCoordinator.activateItem(q.identifier);
		const restoredItemSession = this.state.itemSessions?.[q.identifier];
		const control = this.sessionCoordinator.getItemSettings(q.identifier);
		this.releaseCurrentItemSession();
		const session = this.getItemDefinition(q).openSession({
			restore: restoredItemSession,
			responses: restoredItemSession ? undefined : responses,
			activate: true,
			templateDefaults: restoredItemSession ? undefined : this.evaluateTemplateDefaults(q),
			presentation: {
				// Feedback during an adaptive item's attempts is part of the item, whatever showFeedback says.
				showFeedback: control.showFeedback === true || isAdaptiveItemXml(q.item.itemXml),
				showSolution: control.showSolution === true,
			},
		});
		this.attachCurrentItemSession(q, session);

		this.notifyItemChange();
		this.notifySectionChange();
		if (currentItem?.testPart.identifier !== q.testPart.identifier) this.notifyTestFeedbackChange();
	}

	/**
	 * Navigate to a section by identifier. Legal targets only: a presented (visible)
	 * section reachable under the current navigationMode. Illegal jumps reject with a
	 * typed `AssessmentPlayerError` instead of throwing plain errors.
	 */
	public navigateToSection(sectionId: string): Promise<void> {
		return this.runExclusive(async () => {
			if (this.finalized) {
				throw new AssessmentPlayerError(
					'testFinalized',
					`Cannot navigate to section "${sectionId}": the assessment has ended.`,
				);
			}
			const idx = this.items.findIndex((q) =>
				q.sections.some((s) => s.identifier === sectionId),
			);
			if (idx < 0) {
				throw new AssessmentPlayerError(
					'invalidNavigationTarget',
					`Unknown section: ${sectionId}`,
					{ sectionId },
				);
			}
			const presented = this.presentedSectionList().find((s) => s.identifier === sectionId);
			if (!presented || !this.isLegalSectionTarget(presented)) {
				throw new AssessmentPlayerError(
					'navigationNotAllowed',
					`Navigation to section "${sectionId}" is not allowed.`,
					{ sectionId },
				);
			}
			await this.performNavigateTo(idx);
		});
	}

	/** Move forward. Serialized with all other transitions; rejects as busy while one is in flight. */
	public next(): Promise<void> {
		return this.runExclusive(() => this.performNext());
	}

	private async performNext(): Promise<void> {
		const state = this.getNavigationState();
		if (!state.canNext) return;

		const q = this.items[this.currentItemIndex];
		if (q) {
			const responses = this.sessionCoordinator.getActiveResponses();
			this.sessionCoordinator.markAnswered(q.identifier, responses);

			const navAway = this.sessionCoordinator.canNavigateAway(q.identifier, responses);
			if (!navAway.allowed) {
				const reason: AssessmentPlayerErrorCode = navAway.reason ?? 'responseRequired';
				throw new AssessmentPlayerError(
					reason,
					reason === 'responseInvalid'
						? 'Please provide valid responses before continuing.'
						: 'You must answer this question before continuing.',
				);
			}

			// In individual submission mode, submit the current item before moving forward
			// unless its attempts are used up or it is already closed.
			const lifecycle = this.currentItemSession?.state().lifecycleStatus;
			if (
				(q.testPart.submissionMode ?? this.assessment.submissionMode) === 'individual' &&
				this.sessionCoordinator.canSubmit(q.identifier) &&
				lifecycle !== 'closed'
			) {
				const before = this.currentItemIndex;
				await this.submitCurrentItemInternal();
				// The submission may branch, navigate, or finalize the test (EXIT_TEST);
				// in those cases navigation stops here.
				if (this.currentItemIndex !== before || this.finalized) return;
			}
		}

		const nextIndex = this.nextUnlockedIndex(this.currentItemIndex);
		if (nextIndex < 0) return;
		await this.performNavigateTo(nextIndex);
	}

	/** Move back. Serialized with all other transitions; rejects as busy while one is in flight. */
	public previous(): Promise<void> {
		return this.runExclusive(async () => {
			const state = this.getNavigationState();
			if (!state.canPrevious) return;
			await this.performNavigateTo(this.currentItemIndex - 1);
		});
	}

	/**
	 * Submit current item (server-side scoring). Serialized with all other navigation and
	 * submission transitions; rejects as busy while one is in flight.
	 */
	public submitCurrentItem(): Promise<ItemResult> {
		return this.runExclusive(() => this.submitCurrentItemInternal());
	}

	private async submitCurrentItemInternal(): Promise<ItemResult> {
		const q = this.items[this.currentItemIndex];
		if (!q) throw new AssessmentPlayerError('invalidNavigationTarget', 'No current item');
		this.assertMinimumTime('item', q);

		const submittedAt = Date.now();
		let itemSession: SerializedItemSessionState | undefined;
		const submittedSession = this.currentItemSession;
		const preSubmitSession = submittedSession?.serialize();
		const responses = this.currentItemSession
			? cloneResponseRecord(this.currentItemSession.state().responses)
			: this.sessionCoordinator.getActiveResponses();
		let res: Awaited<ReturnType<BackendAdapter['submitResponses']>>;
		try {
			if (submittedSession) {
				const transition = submittedSession.dispatch({
					action: 'endAttempt',
					validateResponses: this.sessionCoordinator.mustValidateResponses(q.identifier),
				});
				const attempt = transition.result;
				if (!attempt) throw new Error('Item session did not produce an end-attempt result');
				if (attempt.validation && !attempt.validation.valid) {
					throw new AssessmentPlayerError(
						'attemptValidationFailed',
						attempt.validation.issues[0]?.message || 'Submit failed: invalid response',
					);
				}
				itemSession = attempt.sessionState;
			}
			res = await this.backend.submitResponses({
				sessionId: this.sessionId,
				itemIdentifier: q.identifier,
				responses: responses as any,
				submittedAt,
				timeSpent: itemSession?.duration,
				timing: this.getSubmitTimingEvidence(q, itemSession?.duration ?? 0),
				itemSession: this.config.sendItemSessionToBackend ? itemSession : undefined,
				comment: this.sessionCoordinator.getItemComment(q.identifier),
			});

			if (!res.success || !res.result) {
				// Backend error text stays on the Error (logs/host callbacks); candidates
				// see the localized `assessment.errors.codes.submitFailed` message instead.
				throw new AssessmentPlayerError('submitFailed', res.error || 'Submit failed');
			}
		} catch (error) {
			// Ending an attempt is a local provisional commit until the backend accepts
			// it. Restore the exact pre-submit lifecycle so a transient failure can be
			// retried without a closed item or a double-counted attempt.
			if (
				submittedSession &&
				preSubmitSession &&
				this.currentItemSession === submittedSession &&
				this.items[this.currentItemIndex] === q
			) {
				this.releaseCurrentItemSession();
				this.attachCurrentItemSession(
					q,
					this.getItemDefinition(q).openSession({ restore: preSubmitSession }),
				);
				this.notifyItemChange();
			}
			throw error;
		}

		if (itemSession) {
			this.sessionCoordinator.setItemSession(q.identifier, itemSession);
		}

		if (res.updatedState) {
			const localResponses = cloneData(this.state.itemResponses || {})!;
			localResponses[q.identifier] = cloneResponseRecord(responses) as any;
			this.sessionCoordinator.replaceStatePreservingResponsesAndSessions(
				res.updatedState,
				localResponses,
				cloneData(this.state.itemSessions || {})!,
			);
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

		this.setTestOutcomes(res.outcomes);
		this.reportOutcomeProcessingError(res.outcomeProcessingError);

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

		// Apply the backend's branching decision, if any. QTI branchRule semantics:
		// - EXIT_TEST terminates the test: remaining items are not presented and the test
		//   finalizes exactly like a normal end of test.
		// - EXIT_TESTPART ends the current test part; EXIT_SECTION ends the current section.
		//   Delivery continues with the next item outside the ended scope; when none follows
		//   (for the part, or the test), the ended scope finalizes like a normal end of test.
		if (res.nextItemIdentifier) {
			const special = res.nextItemIdentifier;
			if (special === 'EXIT_TEST') {
				await this.endTestInternal();
			} else if (special === 'EXIT_TESTPART' || special === 'EXIT_SECTION') {
				await this.applyExitBoundary(special, q);
			} else {
				const nextIdx = this.items.findIndex((x) => x.identifier === special);
				if (nextIdx >= 0) {
					await this.performNavigateTo(nextIdx, { restoring: true });
				}
			}
		}

		return itemResult;
	}

	/**
	 * Leave the scope ended by an EXIT_TESTPART / EXIT_SECTION branch rule: continue with
	 * the first delivered item outside it, finalizing the ended test part (or, when nothing
	 * follows anywhere, the whole test) through the same finalization path as submit().
	 */
	private async applyExitBoundary(
		special: 'EXIT_TESTPART' | 'EXIT_SECTION',
		current: FlatItem,
	): Promise<void> {
		let nextIdx = this.items.findIndex((item, i) =>
			i > this.currentItemIndex &&
			(special === 'EXIT_SECTION'
				? item.section.identifier !== current.section.identifier
				: item.testPart.identifier !== current.testPart.identifier),
		);
		if (special === 'EXIT_SECTION' && nextIdx < 0) {
			// Nothing follows the section inside this test part: the part ends too.
			nextIdx = this.items.findIndex(
				(item, i) => i > this.currentItemIndex && item.testPart !== current.testPart,
			);
		}
		const partEnded = nextIdx < 0 || this.items[nextIdx]!.testPart !== current.testPart;
		if (partEnded) {
			// The part's pending simultaneous-mode responses are due when it ends.
			await this.submitSimultaneousItems(
				this.items.filter(
					(item) =>
						item.testPart === current.testPart &&
						(item.testPart.submissionMode ?? this.assessment.submissionMode) === 'simultaneous',
				),
			);
		}
		if (nextIdx >= 0) {
			await this.performNavigateTo(nextIdx, { restoring: true });
			return;
		}
		// No further test part: end the test exactly like a normal end of test.
		await this.endTestInternal();
	}

	private canPrevious(): boolean {
		if (this.currentItemIndex <= 0) return false;
		const prev = this.items[this.currentItemIndex - 1];
		if (!prev || this.isItemLocked(prev)) return false;
		if (!this.canNavigateByTestPart(this.currentItemIndex - 1, this.currentItemIndex)) return false;
		return this.sessionCoordinator.canReview(prev.identifier);
	}

	private canNext(): boolean {
		if (this.currentItemIndex < 0) return false;
		const nextIdx = this.nextUnlockedIndex(this.currentItemIndex);
		if (nextIdx < 0) return false;
		if (!this.canNavigateByTestPart(nextIdx, this.currentItemIndex)) return false;
		// Note: itemSessionControl constraints on leaving current item are enforced in next().
		return true;
	}

	private canNavigateByTestPart(targetIndex: number, currentIndex: number): boolean {
		if (targetIndex < 0 || targetIndex >= this.items.length) return false;
		const current = this.items[currentIndex];
		const target = this.items[targetIndex];
		if (!current || !target) return false;
		// Items locked by an expired time limit are passed over.
		const nextIndex = this.nextUnlockedIndex(currentIndex);
		if (current.testPart !== target.testPart) {
			// QTI testParts are delivered in sequence. A candidate may enter the next
			// part, but cannot jump across parts or return to a completed part.
			return targetIndex === nextIndex;
		}
		const mode = current.testPart.navigationMode ?? this.assessment.navigationMode ?? 'nonlinear';
		return mode === 'nonlinear' || targetIndex === currentIndex || targetIndex === nextIndex;
	}

	private async submitSimultaneousItems(items: readonly FlatItem[]): Promise<void> {
		if (items.every((q) => this.sessionCoordinator.hasItemResult(q.identifier))) return;
		const current = this.items[this.currentItemIndex];
		const submittedItem = current && items.includes(current) ? current : undefined;
		const preSubmitSession = submittedItem ? this.currentItemSession?.serialize() : undefined;
		let allItemSessions: NonNullable<AssessmentSessionState['itemSessions']> = {};

		try {
			// Suspending the rendered session gives the UI one non-writable state while
			// backend submission is in flight. Detached sessions perform the provisional
			// end-attempt work for every item.
			if (submittedItem) this.saveCurrentItemSession();
			// Preserve client-collected responses across backend state updates.
			// Some backend adapters return an updatedState snapshot that may only include
			// responses for items that have been submitted so far, which would otherwise
			// wipe out responses for later items during this loop.
			const allItemResponses = cloneData(this.state.itemResponses || {}) as any;
			allItemSessions = cloneData(this.state.itemSessions || {})!;

			for (const q of items) {
				if (this.sessionCoordinator.hasItemResult(q.identifier)) continue;
				const submittedAt = Date.now();
				const responsesForItem = (allItemResponses?.[q.identifier] || {}) as any;
				const itemSession = this.endItemSessionForSubmit(
					q,
					responsesForItem,
					allItemSessions[q.identifier],
				);
				allItemSessions[q.identifier] = itemSession;
				const res = await this.backend.submitResponses({
					sessionId: this.sessionId,
					itemIdentifier: q.identifier,
					responses: responsesForItem,
					submittedAt,
					timeSpent: itemSession.duration,
					timing: this.getSubmitTimingEvidence(q, itemSession.duration),
					itemSession: this.config.sendItemSessionToBackend ? itemSession : undefined,
					comment: this.sessionCoordinator.getItemComment(q.identifier),
				});
				if (!res.success || !res.result) {
					// Backend error text stays on the Error for logs/host callbacks only.
					throw new AssessmentPlayerError(
						'submitFailed',
						res.error || `Submit failed for item ${q.identifier}`,
					);
				}
				if (res.updatedState) {
					this.sessionCoordinator.replaceStatePreservingResponsesAndSessions(
						res.updatedState,
						allItemResponses,
						allItemSessions,
					);
				} else {
					this.state.itemScores = this.state.itemScores || {};
					this.state.itemScores[q.identifier] = res.result;
					this.sessionCoordinator.markVisited(q.identifier);
					this.state.itemResponses[q.identifier] = responsesForItem;
					this.sessionCoordinator.setItemSession(q.identifier, itemSession);
					this.sessionCoordinator.recordAttempt(q.identifier);
				}
				this.sessionCoordinator.setItemResult({
					itemIdentifier: q.identifier,
					score: res.result.score,
					maxScore: res.result.maxScore,
					responses: this.state.itemResponses[q.identifier] || {},
				});
				this.setTestOutcomes(res.outcomes);
				this.reportOutcomeProcessingError(res.outcomeProcessingError);
			}

			// The attached item must represent the same accepted lifecycle as persistence.
			// Replace the provisional suspended object with one restored from the accepted
			// closed state; no second live state owner remains.
			if (submittedItem && this.items[this.currentItemIndex] === submittedItem) {
				const accepted = allItemSessions[submittedItem.identifier];
				if (accepted) {
					this.releaseCurrentItemSession();
					this.attachCurrentItemSession(
						submittedItem,
						this.getItemDefinition(submittedItem).openSession({ restore: accepted }),
					);
					this.notifyItemChange();
				}
			}
		} catch (error) {
			// The backend accepts simultaneous items one request at a time. Keep earlier
			// accepted items committed so retry cannot double-submit them. If the rendered
			// item was not accepted, restore only that item to its exact writable state.
			if (submittedItem && this.items[this.currentItemIndex] === submittedItem) {
				const accepted = this.sessionCoordinator.hasItemResult(submittedItem.identifier)
					? allItemSessions[submittedItem.identifier]
					: undefined;
				const restored = accepted ?? preSubmitSession;
				if (!accepted && preSubmitSession) {
					this.sessionCoordinator.saveItemSession(
						submittedItem.identifier,
						cloneResponseRecord(valuesFromItemSession(preSubmitSession)),
						preSubmitSession,
						preSubmitSession.duration,
					);
				}
				this.releaseCurrentItemSession();
				if (restored) {
					this.attachCurrentItemSession(
						submittedItem,
						this.getItemDefinition(submittedItem).openSession({ restore: restored }),
					);
					this.notifyItemChange();
					this.notifyResponseChange();
				}
			}
			throw error;
		}
	}

	/**
	 * Submit the entire assessment and finalize on the backend — the single terminal
	 * transition, also used for QTI `EXIT_TEST` (and for EXIT_TESTPART / EXIT_SECTION when
	 * nothing follows the ended scope). Serialized with all other navigation and submission
	 * transitions. Calling it again after the test has ended returns the same results.
	 */
	public submit(): Promise<AssessmentResults> {
		return this.runExclusive(() => this.endTestInternal());
	}

	/**
	 * The one normal-end-of-test path: pending simultaneous-mode responses are submitted,
	 * the current individual-mode item is submitted if needed, then the backend finalizes
	 * (outcome processing runs, results are produced) and navigation closes.
	 */
	private async endTestInternal(): Promise<AssessmentResults> {
		if (this.finalized && this.finalResults) return this.finalResults;

		const current = this.items[this.currentItemIndex];
		if (current) {
			this.assertMinimumTime('item', current);
			this.assertMinimumTime('section', current);
			this.assertMinimumTime('testPart', current);
			this.assertMinimumTime('assessment', current);
		}
		// Submission modes belong to test parts. The assessment-level field is only
		// a fallback for older hosts that do not supply a mode on each part.
		await this.submitSimultaneousItems(this.items.filter((q) =>
			(q.testPart.submissionMode ?? this.assessment.submissionMode) === 'simultaneous',
		));
		if (this.finalized && this.finalResults) return this.finalResults;
		const q = this.items[this.currentItemIndex];
		if (q && (q.testPart.submissionMode ?? this.assessment.submissionMode) === 'individual'
			&& !this.sessionCoordinator.hasItemResult(q.identifier)) {
			await this.submitCurrentItemInternal();
			// That submission may itself have branched to EXIT_TEST and finalized the test.
			if (this.finalized && this.finalResults) return this.finalResults;
		}

		return this.finalizeInternal();
	}

	private async finalizeInternal(): Promise<AssessmentResults> {
		if (this.finalized && this.finalResults) return this.finalResults;

		const finalized: FinalizeAssessmentResponse = await this.backend.finalizeAssessment({
			sessionId: this.sessionId,
		});
		if (!finalized.success) throw new AssessmentPlayerError('finalizeFailed', 'Finalize failed');

		// Map backend itemScores to ItemResult[]
		const itemScores = finalized.itemScores || {};
		const itemResults: ItemResult[] = Object.values(itemScores).map((r: AssessmentScoringResult) => ({
			itemIdentifier: r.itemIdentifier,
			score: r.score,
			maxScore: r.maxScore,
			responses: this.state.itemResponses[r.itemIdentifier] || {},
		}));

		// Outcome processing has run by the end of the test, so a backend returning no outcomes
		// leaves them all NULL.
		this.finalized = true;
		this.legacyFeedback = finalized.feedback;
		this.testOutcomes = cloneData(finalized.outcomes ?? this.testOutcomes ?? {})!;
		this.notifyTestFeedbackChange();
		this.reportOutcomeProcessingError(finalized.outcomeProcessingError);

		this.notifyComplete();
		if (this.config.onComplete) this.config.onComplete();

		const results: AssessmentResults = {
			totalScore: finalized.totalScore,
			maxScore: finalized.maxScore,
			itemResults,
			completedAt: new Date(finalized.finalizedAt),
		};
		if (this.reportedOutcomeProcessingError) {
			results.outcomeProcessingError = this.reportedOutcomeProcessingError;
		}
		this.finalResults = results;
		return results;
	}

	/**
	 * Surface a backend test-level outcome-processing failure to the host (onError and,
	 * for finalize, the results). Candidate responses stay accepted and persisted; only
	 * SCORE/testFeedback computation failed.
	 */
	private reportOutcomeProcessingError(error: OutcomeProcessingError | undefined): void {
		if (!error) return;
		const isNew =
			!this.reportedOutcomeProcessingError ||
			this.reportedOutcomeProcessingError.message !== error.message ||
			this.reportedOutcomeProcessingError.code !== error.code;
		this.reportedOutcomeProcessingError = error;
		if (isNew) {
			this.config.onError?.(
				new AssessmentPlayerError('outcomeProcessingFailed', error.message, { code: error.code }),
			);
		}
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
		canComment: boolean;
	} | null {
		const q = this.items[this.currentItemIndex];
		if (!q) return null;
		const id = q.identifier;

		return this.sessionCoordinator.getItemSessionInfo(id);
	}

	/**
	 * Records the candidate's comment on an item (QTI `allowComment`), sent with its next submission.
	 * Defaults to the current item; throws when the item does not allow comments.
	 */
	public setItemComment(comment: string, itemIdentifier?: string): void {
		const id = itemIdentifier ?? this.items[this.currentItemIndex]?.identifier;
		if (!id) throw new Error('No current item');
		this.sessionCoordinator.setItemComment(id, comment);
	}

	public getItemComment(itemIdentifier?: string): string | undefined {
		const id = itemIdentifier ?? this.items[this.currentItemIndex]?.identifier;
		return id ? this.sessionCoordinator.getItemComment(id) : undefined;
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

	/** Fires when a navigation/submission transition starts or ends (`getNavigationState().isLoading` mirrors this). */
	public onBusyChange(listener: (busy: boolean) => void): () => void {
		this.busyChangeListeners.add(listener);
		return () => this.busyChangeListeners.delete(listener);
	}

	/** Called when `getVisibleFeedback()` may have changed: new outcomes, a new test part, or the end. */
	public onTestFeedbackChange(listener: () => void): () => void {
		this.testFeedbackChangeListeners.add(listener);
		return () => this.testFeedbackChangeListeners.delete(listener);
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
		this.releaseCurrentItemSession();
		this.itemDefinitions.clear();
		this.itemChangeListeners.clear();
		this.sectionChangeListeners.clear();
		this.responseChangeListeners.clear();
		this.completeListeners.clear();
		this.busyChangeListeners.clear();
		this.testFeedbackChangeListeners.clear();
		this.timeWarningListeners.clear();
		this.timeExpiredListeners.clear();
		this.timeTickListeners.clear();
		this.flagChangeListeners.clear();
		this.reviewInfoCache.clear();
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
		const sectionIndex = q?.sectionIndex ?? -1;
		const totalSections = this.presentedSectionList().length;
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

	private notifyBusyChange(busy: boolean): void {
		for (const l of this.busyChangeListeners) l(busy);
	}

	private notifyTestFeedbackChange(): void {
		for (const l of this.testFeedbackChangeListeners) l();
	}

	private notifyTimeWarning(remainingSeconds: number): void {
		for (const l of this.timeWarningListeners) l(remainingSeconds);
	}

	private evaluateTemplateDefaults(q: FlatItem): Record<string, unknown> | undefined {
		const defaults = q.item.templateDefaults;
		if (!defaults?.length) return undefined;
		const declarations = testOutcomeDeclarations(this.assessment, this.testOutcomes ?? undefined);
		const out: Record<string, unknown> = {};
		for (const { templateIdentifier, expressionXml } of defaults) {
			out[templateIdentifier] = plainQtiValue(evaluateTestExpression(expressionXml, declarations, Math.random));
		}
		return out;
	}

	private isItemLocked(q: FlatItem): boolean {
		return (
			this.lockedScopes.has(`item:${q.identifier}`) ||
			this.lockedScopes.has(`testPart:${q.testPart.identifier}`) ||
			q.sections.some((section) => this.lockedScopes.has(`section:${section.identifier}`))
		);
	}

	private nextUnlockedIndex(fromIndex: number): number {
		for (let i = fromIndex + 1; i < this.items.length; i++) {
			if (!this.isItemLocked(this.items[i]!)) return i;
		}
		return -1;
	}

	/**
	 * A test part, section or item without late submission ran out of time: its items close for the
	 * candidate, and delivery moves to the next item outside it.
	 */
	private handleScopeExpired(scope: 'testPart' | 'section' | 'item', identifier: string): void {
		this.lockedScopes.add(`${scope}:${identifier}`);
		const current = this.items[this.currentItemIndex];
		if (!current || !this.isItemLocked(current)) return;
		this.saveCurrentItemSession();
		this.notifyItemChange();
		const nextIndex = this.nextUnlockedIndex(this.currentItemIndex);
		if (nextIndex < 0) {
			this.notifyTimeExpired();
			return;
		}
		this.performNavigateTo(nextIndex, { restoring: true }).catch(() => {});
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
	public getI18nProvider(): I18nProvider {
		return this.i18nProvider;
	}

	/**
	 * The provider used when the host passes none: English, from the catalog
	 * `@pie-qti/i18n` bundles eagerly.
	 */
	private createDefaultI18nProvider(): I18nProvider {
		return new DefaultI18nProvider('en-US');
	}
}

function cloneData<T>(value: T | undefined): T | undefined {
	return value === undefined ? undefined : structuredClone(value);
}

function cloneResponseRecord(
	responses: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
	return structuredClone(responses) as Record<string, unknown>;
}

function valuesFromItemSession(
	state: SerializedItemSessionState,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(state.responseVariables).map(([identifier, variable]) => [
			identifier,
			cloneData(variable.value),
		]),
	);
}

function responseValuesEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
		return left.every((value, index) => responseValuesEqual(value, right[index]));
	}
	if (!isRecord(left) || !isRecord(right)) return false;

	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	const rightKeySet = new Set(rightKeys);
	return leftKeys.every(
		(key) => rightKeySet.has(key) && responseValuesEqual(left[key], right[key]),
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object';
}

function isWritableItemLifecycle(lifecycleStatus: SerializedItemSessionState['lifecycleStatus']): boolean {
	return lifecycleStatus === 'initial' || lifecycleStatus === 'interacting';
}
