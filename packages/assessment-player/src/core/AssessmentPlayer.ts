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
	type ItemSessionTransition,
	type PciConfiguration,
	type PnpProfile,
	type PlayerSecurityConfig,
	type QTIRole,
	type SerializedItemSessionState,
} from '@pie-qti/item-player';
import { DefaultI18nProvider, type I18nProvider } from '@pie-qti/i18n';
import { isShownByIdentifier } from '@pie-qti/qti-common';
import type { DeclarationMap, QtiValue, StringComparisonOptions } from '@pie-qti/qti-processing';
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
	SubmitTimingEvidence,
	TestFeedbackItem,
	TestOutcomeValues,
} from '../integration/api-contract.js';
import type {
	AssessmentEndReason,
	AssessmentResults,
	CandidateSectionView,
	CheckAnswerState,
	ItemFeedbackEntry,
	ItemFeedbackView,
	ItemResult,
	NavigationState,
	ResultsSummary,
	TimeLimits,
	VisibleTestFeedback,
} from '../types/index.js';
import { AssessmentSessionCoordinator, isSkippedResponseSet, type ResponseDefault } from './AssessmentSessionCoordinator.js';
import { AutosaveManager, type AutosaveState } from './AutosaveManager.js';
import { AssessmentPlayerError, type AssessmentPlayerErrorCode, isAssessmentPlayerError } from './errors.js';
import { attemptFeedbackVisible, resolveMaxAttempts } from './feedback.js';
import { NavigationManager } from './NavigationManager.js';
import {
	addItemVariableDeclarations,
	applyVariableMappings,
	type DeliveredItem,
	deliveredItems,
	endAttemptInteractionInfo,
	evaluateTestExpression,
	isAdaptiveItemXml,
	itemSessionVariableValues,
	plainQtiValue,
	recordedItemVariableValues,
	resolveItemSessionControl,
	sectionComponents,
	testOutcomeDeclarations,
} from './testStructure.js';
import { firstEligibleItem, nextItemIdentifier } from '../integration/test-navigation.js';
import { extendTimeLimit, TimeManager } from './TimeManager.js';
import {
	cloneData,
	cloneResponseRecord,
	closedItemSession,
	isWritableItemLifecycle,
	responseDefaultsOf,
	responseValuesEqual,
	valuesFromItemSession,
} from './sessionRecords.js';
import { TypedEventEmitter, type AssessmentPlayerEventMap } from './playerEvents.js';
import {
	interactionRequirementFromXml,
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
	 * String comparison folds beyond QTI's equality for the candidates' input, applied by every
	 * item session the player opens (see the item player's
	 * `AssessmentItemDefinitionConfig.stringComparison`). Exact when absent. Give the scoring
	 * backend the same setting: it re-runs response processing on submitted items.
	 */
	stringComparison?: StringComparisonOptions;
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
	 * Include the rich serialized item session (`SubmitResponsesRequest.itemSession`) in
	 * submissions. Off by default for production backends: template variables can contain
	 * answer keys, and such a backend should own that state server-side. A backend that
	 * scores from the item session declares `requiresItemSession` (the reference adapter —
	 * reference/preview mode — does) and always receives it, whatever this says.
	 */
	sendItemSessionToBackend?: boolean;
	// UI options
	showSections?: boolean;
	allowSectionNavigation?: boolean;
	showProgress?: boolean;
	// Time management
	/** Seconds before a limit expires at which a warning fires. Default 60. */
	timeWarningThreshold?: number;
	/**
	 * Additional warning thresholds in seconds (for example `[300, 60]` for 5-minute
	 * and 1-minute warnings). Each fires once per limiting scope.
	 */
	timeWarningThresholds?: number[];
	/**
	 * Opt-in begin gate. When true the player is created without entering an item and
	 * every clock stays stopped until `start()` (the shell's Begin button); hosts that
	 * leave it unset keep starting delivery and the clocks at session creation.
	 */
	beginGate?: boolean;
	/**
	 * Debounced autosave of the session snapshot through `BackendAdapter.saveState`
	 * after candidate activity (responses, navigation, flags, timer visibility, pause),
	 * and an immediate best-effort save via `flushAutosave()`. Default ON when the
	 * backend reports the save capability (`canSaveState` is not false); set `false`
	 * when the host persists state itself. Failures are non-fatal and surface through
	 * `onAutosaveChange` (`failed`) and `onAutosaveFailed`.
	 */
	autosave?: boolean;
	/** Autosave debounce window in ms. Default 1500. */
	autosaveIntervalMs?: number;
	/** Save-indicator state changes: `idle`, `pending`, `saving`, `saved`, `failed`. */
	onAutosaveChange?: (state: AutosaveState) => void;
	/** A debounced or flushed autosave failed; the draft retries on the next change. */
	onAutosaveFailed?: (error: Error) => void;
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
	/**
	 * The test ended in this delivery (every ending: a candidate submit, a proctor's
	 * force-submit, a QTI EXIT_TEST branch, a whole-test expiry), with its results.
	 */
	onComplete?: (results: AssessmentResults) => void;
	/**
	 * A hard time limit ran out with no late submission: the whole test (the core then
	 * finalizes automatically), or a scope whose expiry leaves nothing unlocked.
	 */
	onTimeExpired?: (event: AssessmentTimeExpiryEvent) => void;
	/** A test part, section or item limit expired; its items are now closed. */
	onScopeTimeExpired?: (event: ScopeTimeExpiryEvent) => void;
	/**
	 * A proctor pause started (`paused` true, with its reason) or ended. A session
	 * restored paused reports its pause here once, right after creation.
	 */
	onPauseChange?: (paused: boolean, reason?: string) => void;
	/**
	 * The session reached its terminal state: finalized in this delivery
	 * (`restored: false`) or restored already finalized (`restored: true`).
	 */
	onFinalized?: (event: AssessmentFinalizedEvent) => void;
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

/** What a shell's start screen shows before delivery begins (opt-in begin gate). */
export interface AssessmentStartInfo {
	/** The assessmentTest title; shells fall back to a localized generic title. */
	title?: string;
	/**
	 * Seconds the candidate has for the whole test, PNP extended time applied (what
	 * remains of it for a resumed session); undefined when the test has no maximum.
	 */
	testTimeLimitSeconds?: number;
	/** Whether any test part, section or item adds its own maximum. */
	hasScopedTimeLimits: boolean;
	/** The first test part's rubric blocks (candidate instructions); role-filter before display. */
	rubricBlocks: import('../integration/api-contract.js').AssessmentRubricBlock[];
	/** Delivered item count. */
	totalItems: number;
	/** True when the session carries prior activity (a resume). */
	resuming: boolean;
	/**
	 * When the restored draft was last saved (client clock), for the resume prompt
	 * ("You have answers saved from {time}"); undefined for a fresh session.
	 */
	savedAt?: number;
}

export interface EffectiveItemTimeLimits {
	timeLimits?: TimeLimits;
	source?: 'item' | 'section' | 'testPart' | 'assessment';
	/**
	 * Identifier of the scope that supplied the binding maximum (the section among the
	 * enclosing chain when a section limit binds; undefined for the assessment scope).
	 */
	scopeIdentifier?: string;
}

/**
 * Fired through `onTimeExpired` (and the element's `time-expired` event) when a hard
 * time limit runs out with no late submission: the whole-test limit, or a scope whose
 * expiry leaves no unlocked item.
 */
export interface AssessmentTimeExpiryEvent {
	/** The scope whose hard limit expired; `assessment` is the whole test. */
	scope: 'assessment' | 'testPart' | 'section' | 'item';
	/** The expired scope's identifier; undefined for the assessment scope. */
	identifier?: string;
	/** True when the core already ran the automatic finalization for a whole-test expiry. */
	autoFinalized: boolean;
	/** True when the candidate must submit now (auto-finalize failed, or nothing unlocked remains). */
	submissionRequired: boolean;
}

/** Fired through `onScopeTimeExpired` when a test part, section or item limit expires. */
export interface ScopeTimeExpiryEvent {
	scope: 'testPart' | 'section' | 'item';
	identifier: string;
	/** True when delivery moved on to an open item; false when nothing open remains (a dead end). */
	deliveryContinues: boolean;
	/**
	 * The flat index of the open item delivery moves to (forward in the part, an open
	 * question earlier in a nonlinear part, or the next part). Absent when the candidate
	 * was outside the expired scope and stays where they are, and at a dead end.
	 */
	nextIndex?: number;
}

/** Fired through `onFinalized` once the session is terminal. */
export interface AssessmentFinalizedEvent {
	/** True for a session the backend restored already finalized; false for a finalization in this delivery. */
	restored: boolean;
	results: AssessmentResults;
	/**
	 * Why the test ended, for a finalization in this delivery: a candidate submit, a time
	 * expiry, a proctor's forced submit, or a QTI branch rule (`EXIT_TEST` and friends).
	 * Absent for a session restored already finalized (this delivery did not end it).
	 */
	endReason?: AssessmentEndReason;
}

export type { AssessmentEndReason };

/**
 * An item a candidate-initiated end of the test would refuse to submit
 * (`getSubmissionBlockers()`): QTI `allowSkipping=false` with no response (`required`),
 * or `validateResponses=true` with responses that do not satisfy the interactions
 * (`invalid`). Both apply only to items in individual submission parts.
 */
export interface SubmissionBlocker {
	identifier: string;
	/** Flat delivery index (for `navigateTo`). */
	index: number;
	/** 1-based position shown to the candidate. */
	number: number;
	reason: 'required' | 'invalid';
	/** Whether the navigation rules let the candidate jump to it now. */
	jumpAllowed: boolean;
	/** False when the candidate can no longer reach the question (its part was left). */
	reachable: boolean;
	/**
	 * What the response still owes, when derivable from the item's interaction constraints
	 * (a minimum number of selections, strings, associations or plays); absent when the
	 * item only needs an answer. The shell localizes it into the entry text.
	 */
	requirement?: { kind: 'minChoices' | 'minStrings' | 'minAssociations' | 'minPlays' | 'incomplete'; count?: number };
}

/** What the presentation of an item session shows: QTI showFeedback / showSolution, resolved. */
type PresentationPolicy = { showFeedback: boolean; showSolution: boolean };

/** What a shell's countdown shows for the active scope right now. */
export interface AssessmentTimeState {
	/** Whether any active scope carries a hard maximum (false: nothing to count down). */
	limited: boolean;
	/** Seconds left on the nearest active maximum; null when nothing is limited. */
	remainingSeconds: number | null;
	elapsedSeconds: number;
	/** Whether the nearest active maximum has run out. */
	expired: boolean;
	/** The scope the displayed limit was authored on. */
	scope: 'assessment' | 'testPart' | 'section' | 'item' | null;
	/** Whether the displayed limit allows working past its expiry. */
	allowLateSubmission: boolean;
	/** Whether a proctor pause currently freezes every clock. */
	paused: boolean;
	/** Whether delivery has begun (false while a begin gate holds the start screen). */
	started: boolean;
}

export class AssessmentPlayer {
	public static async create(config: BackendAssessmentPlayerConfig): Promise<AssessmentPlayer> {
		const init = await config.backend.initSession(config.initSession);
		const player = new AssessmentPlayer(config, init);
		// Restored terminal and paused states set no listener off during construction:
		// the host hooks hear them once here, so an embedding (the element's
		// `session-finalized` / `player-pause` events) never misses them.
		if (player.finalized && player.finalResults) {
			config.onFinalized?.({ restored: true, results: player.finalResults });
		} else if (player.paused) {
			config.onPauseChange?.(true, player.pauseReason);
		}
		return player;
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
	/** endAttemptInteraction bindings per item: response identifier → countAttempt. */
	private readonly endAttemptResponses = new Map<string, Map<string, boolean>>();
	private currentItemSession: ItemSession | null = null;
	private currentItemSessionUnsubscribe: (() => void) | null = null;
	/** Test-level outcomes from the last outcome processing; null until it first runs. */
	private testOutcomes: TestOutcomeValues | null = null;
	private finalized = false;
	/** Set by destroy(); a scheduled end-attempt submission after teardown is dropped. */
	private destroyed = false;
	/** Results produced by the finalization; returned when submit() is called again after the end. */
	private finalResults: AssessmentResults | null = null;
	/** Scopes whose time limit expired without late submission, keyed `scope:identifier`. */
	private readonly lockedScopes = new Set<string>();
	/**
	 * Navigation serialization: exactly one navigation or submission transition may run at
	 * a time. While set, further navigation and submit calls are rejected as busy.
	 */
	private transitionInFlight = false;
	/** Last reported test-level outcome-processing failure, so hosts hear about each new one once. */
	private reportedOutcomeProcessingError: OutcomeProcessingError | null = null;
	/** False while an opt-in begin gate holds delivery: no item is entered and no clock runs. */
	private started = true;
	/** A proctor pause: every clock is frozen and candidate actions are rejected. */
	private paused = false;
	private pauseReason: string | undefined;
	/** The whole-test hard limit expired (no late submission); delivery collects and ends. */
	private assessmentExpired = false;
	/** The live attempt was suspended by a pause; resume() reopens it from its pause snapshot. */
	private suspendedForPause = false;
	/** Debounced draft persistence through `saveState` (autosave); null when disabled. */
	private autosave: AutosaveManager | null = null;
	/** True while the session carries a backend-restored snapshot (a resume). */
	private restoredFromSnapshot = false;
	/** `timing.savedAt` of the restored snapshot, shown on the resume prompt. */
	private restoredSavedAt: number | undefined;
	/**
	 * Item feedback the most recent item-level submission produced (item modal feedback
	 * from the session's response processing, else the backend's `result.feedback`).
	 * Shells show it after a check-answer or a submit-on-move; it clears on the next
	 * submission or when the shell dismisses it.
	 */
	private lastItemFeedback: ItemFeedbackView | null = null;
	/**
	 * The responses each item's last counted submission carried. Moving on from an item
	 * that already has a recorded result (a practice check) re-submits only when the
	 * candidate changed something: an unchanged response does not spend another attempt.
	 */
	private readonly lastSubmittedResponses = new Map<string, Record<string, unknown>>();
	/**
	 * Template defaults of nonlinear test parts, evaluated once at part entry for every
	 * item ref (QTI): test part identifier → item identifier → defaults.
	 */
	private readonly templateDefaultsByPart = new Map<string, Map<string, Record<string, unknown> | undefined>>();
	/** The presentation policy the live session was opened with (null: the item-player default). */
	private liveSessionPresentation: PresentationPolicy | null = null;
	/** Set during a proctor force-submit: submissions carry `submissionReason: 'proctor'`. */
	private administrativeReason: 'proctor' | null = null;
	/**
	 * Items the running end of the test collects although their QTI skipping/validation
	 * control would refuse them, because the candidate can no longer reach them (their
	 * test part was left): they go out as they stand, `submissionReason: 'unreachable'`.
	 */
	private unreachableCollection = new Set<string>();
	/** Why the running (or finished) end of the test happens; the first caller decides. */
	private endReason: AssessmentEndReason | null = null;
	/**
	 * Scopes that expired while an end of the test ran: they closed at once, but delivery
	 * leaves them only if that end does not finalize (the end of the test never navigates).
	 */
	private readonly expiriesDuringEnd: Array<{ scope: 'testPart' | 'section' | 'item'; identifier: string }> = [];
	/** The delivered items as the delivery rules walk them (index-aligned with `items`). */
	private deliveredForRules: DeliveredItem[] = [];
	/** Flat index per item identifier. */
	private readonly indexByIdentifier = new Map<string, number>();
	/**
	 * Whether the test carries branch rules or preconditions at all; without them the next item
	 * is always the adjacent open one, and no rule is evaluated.
	 */
	private hasDeliveryRules = false;
	/** Set while the end of the test persists its final snapshot: every item session in it is closed. */
	private snapshotsCloseItemSessions = false;
	/** Rejections for force-submits queued behind a transition, settled on destroy(). */
	private readonly queuedForceSubmits = new Set<(error: Error) => void>();
	/** A restored whole-test expiry's automatic finalize is scheduled (or ran). */
	private restoredExpiryFinalizeScheduled = false;

	// Event listeners (typed emitter; the host-config callbacks stay in the notify helpers)
	private readonly events = new TypedEventEmitter<AssessmentPlayerEventMap>();
	/** Item XML–derived review facts (interaction response ids, item title) per item identifier. */
	private readonly reviewInfoCache = new Map<string, { responseIds: string[]; title?: string }>();
	/** Declared response default values per item (QTI: a response equal to its default is no response). */
	private readonly responseDefaultsCache = new Map<string, Record<string, unknown>>();

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
		this.deliveredForRules = this.items.map(({ item, testPart, sections }) => ({ item, testPart, sections }));
		for (const q of this.items) this.indexByIdentifier.set(q.identifier, q.index);
		const ruled = (holder: { preConditions?: string[]; branchRule?: unknown[] }) =>
			(holder.preConditions?.length ?? 0) > 0 || (holder.branchRule?.length ?? 0) > 0;
		this.hasDeliveryRules = this.items.some(
			(q) => ruled(q.item) || ruled(q.testPart) || q.sections.some((section) => ruled(section)),
		);

		this.navigationManager = new NavigationManager();
		// Visited marks ride the snapshot: a resumed session keeps them, not only a
		// host-driven restoreState().
		this.navigationManager.restoreState(this.visitedIndexes(initialState.visitedItems));

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
			// The default warning (60 s unless the host moves it), then any additional ones.
			warningThresholds: [config.timeWarningThreshold || 60, ...(config.timeWarningThresholds ?? [])],
			now: config.now,
			extendedTime: config.pnp?.content?.extendedTime,
			onWarning: (remainingSeconds) => this.notifyTimeWarning(remainingSeconds),
			onExpired: () => this.handleAssessmentTimeExpired(),
			onScopeExpired: (scope, identifier) => this.handleScopeExpired(scope, identifier),
			onTick: (remainingSeconds, elapsedSeconds) => this.notifyTimeTick(remainingSeconds, elapsedSeconds),
		});
		// Items whose recorded result the snapshot carries were submitted with their
		// snapshot responses: identical responses must not re-submit (and re-spend an
		// attempt) on the next move or at finalize after a resume.
		this.seedSubmittedResponses(initialState);
		if (init.restoredState?.timing) {
			this.restoreTimeTracking(init.restoredState.timing);
			// Expiries are not in the snapshot: every scope whose restored clock already ran
			// out locks now, before any item is entered, so none reopens editable.
			this.lockExpiredScopesFromClocks(init.restoredState.timing);
		}
		// A session saved during a proctor pause reopens paused, its clocks frozen.
		this.paused = init.restoredState?.timing?.isPaused === true;
		this.pauseReason = this.paused ? init.restoredState?.timing?.pauseReason : undefined;

		this.restoredFromSnapshot = init.restoredState !== undefined;
		this.restoredSavedAt = init.restoredState?.timing?.savedAt;
		this.createAutosave();

		// A session the backend stored as finalized restores terminal: submit() returns
		// the stored results instead of failing, no item is entered, no clock runs, and
		// nothing autosaves. The shell shows its already-submitted view for it.
		if (init.finalized === true) {
			this.finalized = true;
			this.finalResults = this.finalResultsFromInit(init);
			this.autosave?.stop();
			this.timeManager?.pause();
			this.timeManager?.stopTimer();
			return;
		}

		if (config.beginGate === true) {
			// The begin gate holds delivery: no item is entered and no clock runs until start().
			this.started = false;
			this.timeManager.pause();
			return;
		}
		this.enterInitialItem();
		this.finalizeRestoredExpiryWhenRunning();
	}

	/**
	 * Enter the backend-provided current item (or the first) as delivery begins. The
	 * restoring navigation has no await before the session is attached, so the live
	 * session exists when this returns. A failure is recorded (not swallowed): the shell
	 * shows its typed failure screen with Retry instead of an eternal loading state.
	 * An item an expired limit closed is never entered editable: delivery lands on the
	 * next open item, like the live expiry's hop, or — with none left — shows the closed
	 * item read-only and asks for the submission (reported once listeners can hear it).
	 */
	private enterInitialItem(): void {
		const startId = this.state.currentItemIdentifier;
		const idx = startId ? this.items.findIndex((q) => q.identifier === startId) : -1;
		const requested = idx >= 0 ? idx : this.items.length > 0 ? 0 : -1;
		if (requested < 0) return;
		const { index: target, deadEnd } = this.restoringEntryTarget(requested);
		this.pendingEntryIndex = target;
		this.performNavigateTo(target, { restoring: true })
			.then(() => {
				if (this.pendingEntryIndex === target) this.pendingEntryIndex = null;
				// The shell attaches its listeners right after creation; report the dead end
				// on the next task so it is heard.
				if (deadEnd) setTimeout(() => this.notifyExpiryDeadEnd(), 0);
			})
			.catch((error) => {
				this.recordEntryFailure(error);
			});
	}

	/**
	 * Where a restoring entry lands: the requested item when it is open; else the open item
	 * the live expiry would have moved the candidate to (forward in the part, an open earlier
	 * question of a nonlinear part, the next part); else — nothing open remains — the
	 * requested item itself, shown read-only, as an expiry dead end.
	 */
	private restoringEntryTarget(index: number): { index: number; deadEnd: boolean } {
		const q = this.items[index];
		if (!q || !this.isItemLocked(q)) return { index, deadEnd: false };
		const open = this.openItemAfterClosure(index);
		return open >= 0 ? { index: open, deadEnd: false } : { index, deadEnd: true };
	}

	/** Flat indexes of the snapshot's visited item identifiers. */
	private visitedIndexes(identifiers: readonly string[] | undefined): number[] {
		return (identifiers ?? [])
			.map((id) => this.items.findIndex((q) => q.identifier === id))
			.filter((index) => index >= 0);
	}

	/**
	 * Lock every scope whose restored clock already ran past its hard maximum (no late
	 * submission): its live expiry never fired in this runtime, so without this its items
	 * would reopen editable until the next tick. A whole-test limit that ran out marks the
	 * test expired. The live timer is told, so it does not fire these expiries again.
	 */
	private lockExpiredScopesFromClocks(timing: AssessmentSessionState['timing'] | undefined): void {
		if (!timing) return;
		const extended = this.config.pnp?.content?.extendedTime;
		const ranOut = (limits: TimeLimits | undefined, elapsedMs: number | undefined): boolean => {
			if (limits?.maxTime === undefined || limits.allowLateSubmission === true) return false;
			const maxSeconds = extendTimeLimit(limits.maxTime, extended);
			return maxSeconds !== undefined && (Number(elapsedMs) || 0) >= maxSeconds * 1000;
		};
		const expired: string[] = [];
		const lock = (key: string): void => {
			if (this.lockedScopes.has(key)) return;
			this.lockedScopes.add(key);
			expired.push(key);
		};
		for (const q of this.items) {
			if (ranOut(q.testPart.timeLimits, timing.testPartTimes?.[q.testPart.identifier])) {
				lock(`testPart:${q.testPart.identifier}`);
			}
			for (const section of q.sections) {
				if (ranOut(section.timeLimits, timing.sectionTimes?.[section.identifier])) lock(`section:${section.identifier}`);
			}
			if (ranOut(q.item.timeLimits, timing.itemTimes?.[q.identifier])) lock(`item:${q.identifier}`);
		}
		if (ranOut(this.assessment.timeLimits, timing.totalTime)) {
			this.assessmentExpired = true;
			expired.push('assessment');
		}
		this.timeManager?.markExpired(expired);
	}

	/**
	 * A whole-test limit that ran out while the session was away finalizes like a live
	 * expiry — once delivery runs (not behind a begin gate, not during a pause), and on
	 * the next task so the shell's listeners hear it.
	 */
	private finalizeRestoredExpiryWhenRunning(): void {
		if (!this.assessmentExpired || this.restoredExpiryFinalizeScheduled) return;
		if (this.finalized || this.destroyed || !this.started || this.paused) return;
		this.restoredExpiryFinalizeScheduled = true;
		setTimeout(() => {
			if (this.finalized || this.destroyed || !this.started || this.paused) {
				this.restoredExpiryFinalizeScheduled = false;
				return;
			}
			this.autoFinalizeForTimeExpiry(0);
		}, 0);
	}

	/** The item entry a failed hop will retry: the initial item, or an expiry hop target. */
	private pendingEntryIndex: number | null = null;
	/** The last failed item entry, for the shell's typed failure screen. */
	private entryError: Error | null = null;

	private recordEntryFailure(error: unknown): void {
		this.entryError = error instanceof Error ? error : new Error(String(error));
		this.config.onError?.(this.entryError);
	}

	/** Whether the last item entry (the first item, or an expiry hop) failed. */
	public hasEntryFailure(): boolean {
		return this.entryError !== null;
	}

	/** The failed item entry's error, for host logs and localized shell display. */
	public getEntryError(): Error | null {
		return this.entryError;
	}

	/**
	 * Retry the failed item entry: re-enter the initial item, or re-run the expiry hop
	 * that failed. Serialized with all other transitions; a renewed failure is reported
	 * through `onError` and this rejects.
	 */
	public async retryEntry(): Promise<void> {
		const target = this.pendingEntryIndex;
		this.entryError = null;
		if (target === null || target < 0 || this.destroyed) return;
		await this.runExclusive(async () => {
			try {
				await this.performNavigateTo(target, { restoring: true });
				if (this.pendingEntryIndex === target) this.pendingEntryIndex = null;
			} catch (error) {
				// Still broken: the failure is recorded again (the shell's error screen
				// stays) and the rejection surfaces to the caller.
				this.recordEntryFailure(error);
				throw error;
			}
		});
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

	/**
	 * A candidate-initiated transition (navigation, submission): rejected with a coded
	 * error during a proctor pause or before the begin gate opens, otherwise serialized
	 * like every transition.
	 */
	private runCandidateTransition<T>(operation: () => Promise<T>): Promise<T> {
		try {
			this.assertCandidateActionAllowed();
		} catch (error) {
			return Promise.reject(error);
		}
		return this.runExclusive(operation);
	}

	private assertCandidateActionAllowed(): void {
		if (this.paused) {
			throw new AssessmentPlayerError('assessmentPaused', 'The assessment is paused.');
		}
		if (!this.started) {
			throw new AssessmentPlayerError('navigationNotAllowed', 'The assessment has not started yet.');
		}
	}

	// ---------------------------------------------------------------------------
	// Autosave: debounced draft persistence through BackendAdapter.saveState
	// ---------------------------------------------------------------------------

	/**
	 * Create the autosave engine. ON by default when the backend reports the save
	 * capability (`canSaveState !== false`); `config.autosave === false` disables it
	 * for hosts that persist state themselves.
	 */
	private createAutosave(): void {
		const enabled = this.config.autosave !== false && this.backend.canSaveState !== false;
		if (!enabled) return;
		this.autosave = new AutosaveManager({
			enabled: true,
			intervalMs: this.config.autosaveIntervalMs ?? 1500,
			collect: () => {
				const snapshot = this.getState({ includeItemSessions: true });
				if (this.snapshotsCloseItemSessions && snapshot.itemSessions) {
					snapshot.itemSessions = Object.fromEntries(
						Object.entries(snapshot.itemSessions).map(([identifier, session]) => [
							identifier,
							closedItemSession(session),
						]),
					);
				}
				snapshot.timing = { ...snapshot.timing, savedAt: Date.now() };
				return { sessionId: this.sessionId, state: snapshot };
			},
			save: (request) => this.backend.saveState(request as never),
			isBlocked: () => this.transitionInFlight,
			isStopped: () => this.destroyed || this.finalized,
			onStateChange: (state) => this.notifyAutosaveChange(state),
			onError: (error) => this.config.onAutosaveFailed?.(error),
		});
	}

	/** A due save is deferred while a transition runs and retried once it settles. */
	private notifyAutosaveActivity(): void {
		this.autosave?.notify();
	}

	/**
	 * Save the current draft immediately (best-effort): the shell calls this from
	 * `visibilitychange`/`pagehide`, and hosts may call it before their own teardown.
	 * While a transition is in flight the save is re-queued instead of racing it.
	 * Resolves once a save attempt settled (or immediately when autosave is off).
	 */
	public flushAutosave(): Promise<void> {
		return this.autosave?.flush() ?? Promise.resolve();
	}

	/** The current save-indicator state (`idle` when autosave is disabled). */
	public getAutosaveState(): AutosaveState {
		return this.autosave?.getState() ?? { status: 'idle' };
	}

	/** Whether autosave is active for this session (backend capability + config). */
	public isAutosaveEnabled(): boolean {
		return this.autosave !== null;
	}

	/** Fires on every save-indicator state change. */
	public onAutosaveChange(listener: (state: AutosaveState) => void): () => void {
		return this.events.on('autosaveChange', listener);
	}

	private notifyAutosaveChange(state: AutosaveState): void {
		this.events.emit('autosaveChange', state);
		this.config.onAutosaveChange?.(state);
	}

	// ---------------------------------------------------------------------------
	// Resume + start over
	// ---------------------------------------------------------------------------

	/**
	 * Whether the session was created from a backend snapshot that already carries
	 * candidate work (a resume worth offering: saved answers). Shells show their
	 * resume prompt from this. Elapsed time alone does not count: a session that was
	 * merely started (or started over) has nothing to resume.
	 */
	public hasRestoredProgress(): boolean {
		if (!this.restoredFromSnapshot) return false;
		const responses = this.state.itemResponses ?? {};
		return Object.values(responses).some(
			(responsesForItem) => responsesForItem !== undefined && Object.keys(responsesForItem).length > 0,
		);
	}

	/** When the restored snapshot was last saved (client clock), for the resume prompt. */
	public getRestoredSavedAt(): number | undefined {
		return this.hasRestoredProgress() ? this.restoredSavedAt : undefined;
	}

	/**
	 * Discard the candidate's draft and restart delivery. Start over clears what the
	 * candidate authored and the backend has not accepted — responses, flags, comments,
	 * visited state, the timer preference and unrecorded check state — and persists the
	 * blank draft at once. It keeps the time accounting: every clock, each expired scope
	 * and a whole-test expiry persist, so restarting never grants a fresh time allowance
	 * after the questions were seen. Items the backend already accepted keep their
	 * recorded results (the backend stays authoritative for them). Delivery repositions
	 * to the first item that is still open; when none is, the closed item is shown
	 * read-only and the expiry's submit path is requested again (`onTimeExpired` with
	 * `submissionRequired`). Rejects while paused, behind a begin gate, once finalized,
	 * and while another transition runs.
	 */
	public async startOver(): Promise<void> {
		return this.runCandidateTransition(async () => {
			if (this.finalized) {
				throw new AssessmentPlayerError('testFinalized', 'Cannot start over: the assessment has ended.');
			}
			const snapshot = this.getState({ includeItemSessions: true });
			// Test parts are delivered in order and a left part is never re-entered — not
			// even by a restart. The restart covers the furthest part reached and what
			// follows; questions of parts already left stay closed exactly as they stand
			// (the end of the test collects them so), visited marks included.
			const reachedIndex = Math.max(this.currentItemIndex, ...this.navigationManager.getVisited(), 0);
			const reachedPart = this.partOrder(this.items[reachedIndex]);
			const left = new Set(
				this.items.filter((q) => this.partOrder(q) < reachedPart).map((q) => q.identifier),
			);
			// Accepted items keep their recorded state; everything else is the draft.
			const accepted = new Set(
				this.items.filter((q) => this.sessionCoordinator.hasItemResult(q.identifier)).map((q) => q.identifier),
			);
			const keepAccepted = <T>(record: Record<string, T> | undefined): Record<string, T> =>
				Object.fromEntries(
					Object.entries(record ?? {}).filter(([identifier]) => accepted.has(identifier) || left.has(identifier)),
				);
			const keepLeft = <T>(record: Record<string, T> | undefined): Record<string, T> =>
				Object.fromEntries(Object.entries(record ?? {}).filter(([identifier]) => left.has(identifier)));
			const fresh: AssessmentSessionState = {
				currentItemIdentifier: this.items[0]?.identifier ?? '',
				visitedItems: snapshot.visitedItems.filter((identifier) => left.has(identifier)),
				itemResponses: keepAccepted(snapshot.itemResponses),
				itemScores: keepAccepted(snapshot.itemScores),
				itemSessions: keepAccepted(snapshot.itemSessions),
				itemSessionStates: keepAccepted(snapshot.itemSessionStates),
				itemFlags: keepLeft(snapshot.itemFlags),
				itemComments: keepLeft(snapshot.itemComments),
				// The clocks continue: the live TimeManager is not reset, and the draft's
				// timing reflects it.
				timing: snapshot.timing,
			};
			// Replaces coordinator state (responses, sessions, results, flags) and clears
			// visited/navigation state beyond the left parts. Locked scopes, the whole-test
			// expiry and the timer's fired-limit record stay as they are.
			this.state = fresh;
			this.navigationManager.restoreState(this.visitedIndexes(fresh.visitedItems));
			// (A pause cannot be in force here: startOver is a candidate transition, and a
			// pause requested while it runs applies once it settles.)
			// The resumable draft is gone; the shell's resume prompt must not reappear.
			this.restoredFromSnapshot = false;
			this.restoredSavedAt = undefined;
			// Unrecorded check state goes with the draft; the memory of accepted responses stays.
			for (const identifier of [...this.lastSubmittedResponses.keys()]) {
				if (!accepted.has(identifier)) this.lastSubmittedResponses.delete(identifier);
			}
			this.lastItemFeedback = null;
			this.templateDefaultsByPart.clear();
			// Delivery repositions to the first open item of the furthest part reached (else
			// the first open item after it); with none left, the expiry dead end: the
			// candidate's way out is the submission.
			const inReach = (q: FlatItem) => this.partOrder(q) >= reachedPart;
			const inPart = this.items.findIndex((q) => this.partOrder(q) === reachedPart && this.isOpenTarget(q));
			const firstOpen =
				inPart >= 0 ? inPart : this.items.findIndex((q) => this.partOrder(q) > reachedPart && !this.isItemLocked(q));
			const target = firstOpen >= 0 ? firstOpen : Math.max(0, this.items.findIndex(inReach));
			if (this.items[target]) {
				this.state.currentItemIdentifier = this.items[target]!.identifier;
				await this.performNavigateTo(target, { restoring: true });
				if (firstOpen < 0) this.notifyExpiryDeadEnd();
			}
			// Persist the blank draft now so a refresh cannot resurrect the discarded answers.
			await this.autosave?.flushImmediate();
		});
	}

	/** Delivery order of the item's test part (parts are delivered in sequence). */
	private partOrder(q: FlatItem | undefined): number {
		if (!q) return 0;
		return (this.assessment.testParts ?? []).findIndex((part) => part.identifier === q.testPart.identifier);
	}

	private getEffectiveItemTimeLimits(flat: FlatItem): EffectiveItemTimeLimits {
		const scopes: Array<{
			source: EffectiveItemTimeLimits['source'];
			identifier?: string;
			limits?: TimeLimits;
		}> = [
			{ source: 'assessment', limits: this.assessment.timeLimits },
			{ source: 'testPart', identifier: flat.testPart.identifier, limits: flat.testPart.timeLimits },
			// Every enclosing section limits the item, not only the innermost one.
			...flat.sections.map((section) => ({
				source: 'section' as const,
				identifier: section.identifier,
				limits: section.timeLimits,
			})),
			{ source: 'item', identifier: flat.identifier, limits: flat.item.timeLimits },
		];
		let source: EffectiveItemTimeLimits['source'];
		let scopeIdentifier: string | undefined;
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
					scopeIdentifier = scope.identifier;
					allowLateSubmission = scope.limits.allowLateSubmission;
				}
			} else if (scope.limits.allowLateSubmission !== undefined && maxTime === undefined) {
				allowLateSubmission = scope.limits.allowLateSubmission;
				source = scope.source;
				scopeIdentifier = scope.identifier;
			}
		}

		if (maxTime === undefined && minTime === undefined && allowLateSubmission === undefined) {
			return {};
		}
		return { source, scopeIdentifier, timeLimits: { minTime, maxTime, allowLateSubmission } };
	}

	public getCurrentEffectiveTimeLimits(): EffectiveItemTimeLimits {
		const q = this.items[this.currentItemIndex];
		return q ? this.getEffectiveItemTimeLimits(q) : {};
	}

	private getSubmitTimingEvidence(
		q: FlatItem,
		elapsedMs: number,
		submissionReason?: SubmitTimingEvidence['submissionReason'],
	): SubmitTimingEvidence | undefined {
		const effective = this.getEffectiveItemTimeLimits(q);
		const limitSeconds = effective.timeLimits?.maxTime;
		if (!effective.source || limitSeconds === undefined) {
			// An administrative collection (a proctor's forced end) reports its reason even
			// when nothing is timed.
			return submissionReason
				? {
					scope: 'assessment',
					elapsedMs: this.timeManager?.getScopeElapsedMs('assessment') ?? elapsedMs,
					submissionReason,
				}
				: undefined;
		}
		const scopeIdentifier = effective.source === 'assessment'
			? undefined
			: (effective.scopeIdentifier ??
				(effective.source === 'item'
					? q.identifier
					: effective.source === 'section'
						? q.section.identifier
						: q.testPart.identifier));
		const tracked = this.timeManager?.getScopeElapsedMs(effective.source, scopeIdentifier);
		const scopedElapsedMs = tracked ?? elapsedMs;
		const assessmentLimitSeconds = this.assessment.timeLimits?.maxTime === undefined
			? undefined
			: extendTimeLimit(this.assessment.timeLimits.maxTime, this.config.pnp?.content?.extendedTime);
		return {
			scope: effective.source,
			elapsedMs: scopedElapsedMs,
			limitSeconds,
			expired: scopedElapsedMs >= limitSeconds * 1000,
			allowLateSubmission: effective.timeLimits?.allowLateSubmission,
			// The candidate's own test clock: it excludes begin-gate and proctor-pause time,
			// which a backend wall clock measured from session creation would count.
			...(assessmentLimitSeconds !== undefined && this.timeManager
				? {
					assessmentElapsedMs: this.timeManager.getScopeElapsedMs('assessment'),
					assessmentLimitSeconds,
				}
				: {}),
			...(submissionReason ? { submissionReason } : {}),
		};
	}

	private assertMinimumTime(
		scope: 'assessment' | 'testPart' | 'section' | 'item',
		q: FlatItem,
		section: FlatItem['section'] = q.section,
	): void {
		const limits = scope === 'assessment'
			? this.assessment.timeLimits
			: scope === 'testPart'
				? q.testPart.timeLimits
				: scope === 'section'
					? section.timeLimits
					: q.item.timeLimits;
		if (limits?.minTime === undefined) return;
		const identifier = scope === 'testPart'
			? q.testPart.identifier
			: scope === 'section'
				? section.identifier
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

	/**
	 * Every enclosing section's minimum time gates leaving it: a transition out of an
	 * enclosing scope (another section, another test part, or the end of the test) waits
	 * for the outer sections' minimums too, not only the innermost section's.
	 */
	private assertEnclosingSectionMinimumTime(q: FlatItem, target?: FlatItem): void {
		for (const section of q.sections) {
			if (target?.sections.some((enclosing) => enclosing.identifier === section.identifier)) continue;
			this.assertMinimumTime('section', q, section);
		}
	}

	private assertTransitionMinimum(current: FlatItem, target: FlatItem): void {
		if (current === target) return;
		this.assertMinimumTime('item', current);
		this.assertEnclosingSectionMinimumTime(current, target);
		if (current.testPart !== target.testPart) this.assertMinimumTime('testPart', current);
	}

	/**
	 * Whether an item still owes the backend a submission: it has no recorded result yet
	 * (the candidate left it open, answered or not), or its live responses differ from the
	 * ones its last counted submission carried (a practice answer revised after the
	 * check, or a revised answer a nonlinear jump left behind). Unchanged responses are
	 * never re-sent, so an accepted item spends no extra attempt here.
	 */
	private itemNeedsSubmission(q: FlatItem): boolean {
		if (!this.sessionCoordinator.hasItemResult(q.identifier)) return true;
		return !this.responsesUnchangedSinceSubmission(q.identifier, this.sessionCoordinator.getResponses(q.identifier));
	}

	private isIndividual(q: FlatItem): boolean {
		return (q.testPart.submissionMode ?? this.assessment.submissionMode) === 'individual';
	}

	/**
	 * Whether submissions carry the serialized item session: always for a backend that
	 * scores from it (`requiresItemSession` — the reference adapter: a templated item must be
	 * scored against the instance the candidate saw), else as the host configured.
	 */
	private sendsItemSession(): boolean {
		return this.backend.requiresItemSession === true || this.config.sendItemSessionToBackend === true;
	}

	/** The item's current responses: the live session's for the active item, else the stored ones. */
	private currentResponsesFor(q: FlatItem): Record<string, unknown> {
		if (this.items[this.currentItemIndex] === q && this.currentItemSession) {
			return cloneResponseRecord(this.currentItemSession.state().responses);
		}
		return this.sessionCoordinator.getResponses(q.identifier);
	}

	/**
	 * QTI itemSessionControl `allowSkipping` / `validateResponses` for one item's
	 * responses. Both are "only applicable when the item is in a testPart with individual
	 * submission mode", so a simultaneous part is never gated. A skipped item (no
	 * response at all: every response NULL, empty or still equal to its declared default —
	 * the test `numberResponded` applies) may be submitted only when skipping is allowed,
	 * and is then not validated; an answered item validates when the item asks for it.
	 */
	private submissionGate(q: FlatItem, responses: Record<string, unknown>): { mustAnswer: boolean; validate: boolean } {
		if (!this.isIndividual(q)) return { mustAnswer: false, validate: false };
		const settings = this.sessionCoordinator.getItemSettings(q.identifier);
		const skipped = isSkippedResponseSet(responses, this.responseDefaultsFor(q));
		return {
			mustAnswer: skipped && settings.allowSkipping === false,
			validate: !skipped && settings.validateResponses === true,
		};
	}

	/**
	 * The declared default of each response variable, as the item's own session holds it
	 * (template processing may set it): the live session for the active item, the persisted
	 * handoff otherwise, else — for an item never opened — a fresh session's declarations.
	 */
	private responseDefaultsFor(q: FlatItem): Record<string, ResponseDefault> {
		const live = this.items[this.currentItemIndex] === q ? this.currentItemSession : null;
		const serialized = live ? live.serialize() : this.state.itemSessions?.[q.identifier];
		if (serialized) return responseDefaultsOf(serialized);
		const cached = this.responseDefaultsCache.get(q.identifier);
		if (cached) return cached as Record<string, ResponseDefault>;
		let defaults: Record<string, ResponseDefault> = {};
		let session: ItemSession | null = null;
		try {
			session = this.getItemDefinition(q).openSession({});
			defaults = responseDefaultsOf(session.serialize());
		} catch {
			// An item that cannot even open has no defaults to honour; the gate stays NULL-based.
		} finally {
			session?.dispose();
		}
		this.responseDefaultsCache.set(q.identifier, defaults);
		return defaults;
	}

	/**
	 * The item's response validation (a QTI valid response: every value well-formed and,
	 * where an interaction requires input — minChoices, minStrings, matchMin… — complete),
	 * checked on a detached session so the live attempt is untouched. Null when nothing is
	 * left to validate: the attempt already closed (accepted as it is), or the session could
	 * not be opened (the submission reports that, the gate invents no failure).
	 */
	private responseValidationFor(q: FlatItem): { ok: boolean; requirement?: SubmissionBlocker['requirement'] } | null {
		const live = this.items[this.currentItemIndex] === q ? this.currentItemSession : null;
		const restore = live ? live.serialize() : this.state.itemSessions?.[q.identifier];
		let session: ItemSession | null = null;
		try {
			session = this.getItemDefinition(q).openSession({
				restore,
				responses: live ? undefined : this.sessionCoordinator.getResponses(q.identifier),
				activate: true,
			});
			if (!isWritableItemLifecycle(session.state().lifecycleStatus)) return null;
			const validation = session.dispatch({ action: 'suspendAttempt' }).result?.validation;
			if (!validation) return null;
			const unmet = Object.values(validation.entries).find(
				(entry) => !entry.valid || (entry.required && !entry.complete),
			);
			if (validation.valid && !unmet) return { ok: true };
			const constraint = unmet?.valid ? interactionRequirementFromXml(q.item.itemXml, unmet.responseId) : undefined;
			return { ok: false, requirement: constraint ?? { kind: 'incomplete' } };
		} catch {
			return null;
		} finally {
			session?.dispose();
		}
	}

	/** Whether the item's responses satisfy their interactions' constraints (see `responseValidationFor`). */
	private responsesSatisfyConstraints(q: FlatItem): boolean {
		return this.responseValidationFor(q)?.ok !== false;
	}

	/**
	 * Whether the end of the test would submit this item: mirrors `endTestInternal`'s
	 * collection — the open current item without an accepted (unchanged) result, and every
	 * visited individual-mode item whose responses the backend has not accepted yet.
	 */
	private wouldCollectAtFinalize(q: FlatItem): boolean {
		if (!this.isIndividual(q) || this.isItemLocked(q)) return false;
		if (q.index === this.currentItemIndex) {
			if (!this.sessionCoordinator.hasItemResult(q.identifier)) return true;
			const status = this.currentItemSession?.state().lifecycleStatus;
			return (
				status !== undefined &&
				isWritableItemLifecycle(status) &&
				this.sessionCoordinator.canSubmit(q.identifier) &&
				!this.responsesUnchangedSinceSubmission(q.identifier)
			);
		}
		return this.navigationManager.isVisited(q.index) && this.itemNeedsSubmission(q);
	}

	/**
	 * The QTI submission control that would refuse this item's submission now, if any:
	 * `required` (allowSkipping=false, no response) or `invalid` (validateResponses=true,
	 * responses that do not satisfy the interactions), with what the response still owes.
	 */
	private blockerFor(q: FlatItem): SubmissionBlocker | null {
		const gate = this.submissionGate(q, this.currentResponsesFor(q));
		let reason: SubmissionBlocker['reason'] | null = gate.mustAnswer ? 'required' : null;
		let requirement: SubmissionBlocker['requirement'];
		if (!reason && gate.validate) {
			const validation = this.responseValidationFor(q);
			if (validation && !validation.ok) {
				reason = 'invalid';
				requirement = validation.requirement;
			}
		}
		if (!reason) return null;
		const jumpAllowed = this.isNavigationTargetLegal(q.index);
		return {
			identifier: q.identifier,
			index: q.index,
			number: q.index + 1,
			reason,
			jumpAllowed,
			reachable: jumpAllowed,
			...(requirement ? { requirement } : {}),
		};
	}

	/** Every item the end of the test would collect against its submission controls, reachable or not. */
	private blockerCandidates(filter: (q: FlatItem) => boolean = () => true): SubmissionBlocker[] {
		if (this.finalized) return [];
		const blockers: SubmissionBlocker[] = [];
		for (const q of this.items) {
			if (!filter(q) || !this.wouldCollectAtFinalize(q)) continue;
			const blocker = this.blockerFor(q);
			if (blocker) blockers.push(blocker);
		}
		return blockers;
	}

	/**
	 * Items a candidate-initiated end of the test would refuse to submit: in individual
	 * parts, an item without any response while `allowSkipping=false` (`required`), or an
	 * answered item whose responses fail validation while `validateResponses=true`
	 * (`invalid`). Only items the end of the test would actually submit are considered
	 * (presented ones the backend has not accepted), and only those the candidate can still
	 * reach: a question in a test part already left cannot hold Submit — it is collected as
	 * it stands (`getUnreachableSubmissionBlockers()`, `submissionReason: 'unreachable'`).
	 * An item an expired limit closed is collected as it stands too. Empty once the delivery
	 * is closed by time or finalized. Shells list these in the submit confirmation;
	 * `submit()` rejects naming them.
	 */
	public getSubmissionBlockers(): SubmissionBlocker[] {
		if (this.isTimeClosedDelivery()) return [];
		return this.blockerCandidates().filter((blocker) => blocker.reachable);
	}

	/**
	 * Questions the end of the test collects although their QTI skipping/validation control
	 * would refuse them, because the candidate can no longer reach them (their test part was
	 * left — a session restored from before the leave gate, a branch rule). They never hold
	 * Submit: the end of the test sends them as they stand with `submissionReason: 'unreachable'`.
	 */
	public getUnreachableSubmissionBlockers(): SubmissionBlocker[] {
		return this.blockerCandidates().filter((blocker) => !blocker.reachable);
	}

	/**
	 * Questions of the current test part that would be left behind owing an answer: QTI
	 * parts cannot be re-entered, so leaving an individual part with them would strand them.
	 * The shell's "Leave this part?" confirmation lists them (with jumps) and holds Continue;
	 * `next()` / `navigateTo()` refuse to leave the part while any remains
	 * (`leavePartResponseRequired` / `leavePartResponseInvalid`). Only questions the
	 * candidate can still reach count — one behind them in a linear part (a session restored
	 * from before this gate) could never be answered, so it cannot hold the way out; the end
	 * of the test collects it as it stands (`unreachable`). Empty for a simultaneous part
	 * (QTI: the controls do not apply), once finalized, and in a time-closed delivery.
	 */
	public getTestPartBlockers(): SubmissionBlocker[] {
		const current = this.items[this.currentItemIndex];
		if (!current || this.isTimeClosedDelivery()) return [];
		return this.blockerCandidates((q) => q.testPart === current.testPart).filter((blocker) => blocker.reachable);
	}

	/** Reject a candidate-initiated end of the test that would submit held-back items, naming them. */
	private assertNoSubmissionBlockers(): void {
		this.throwForBlockers(this.getSubmissionBlockers(), 'finalize');
	}

	/**
	 * Reject leaving the test part `from` belongs to while questions in it (or, for an
	 * EXIT_SECTION, in the ended scope) still owe an answer the candidate can still give.
	 * `exclude` is the item the move itself submits (next() submits the current item before
	 * it moves). An unreachable question never holds the way out (see `getTestPartBlockers`).
	 */
	private assertCanLeaveScope(from: FlatItem, options: { exclude?: FlatItem; scope?: (q: FlatItem) => boolean } = {}): void {
		if (!this.isIndividual(from)) return;
		const inScope = options.scope ?? ((q: FlatItem) => q.testPart === from.testPart);
		this.throwForBlockers(
			this.blockerCandidates((q) => q !== options.exclude && inScope(q)).filter((blocker) => blocker.reachable),
			'leavePart',
		);
	}

	private throwForBlockers(blockers: SubmissionBlocker[], context: 'finalize' | 'leavePart'): void {
		const required = blockers.filter((blocker) => blocker.reason === 'required');
		const named = required.length > 0 ? required : blockers;
		if (named.length === 0) return;
		const code: AssessmentPlayerErrorCode =
			context === 'finalize'
				? required.length > 0
					? 'finalizeResponseRequired'
					: 'finalizeResponseInvalid'
				: required.length > 0
					? 'leavePartResponseRequired'
					: 'leavePartResponseInvalid';
		const identifiers = named.map((blocker) => blocker.identifier);
		const what = context === 'finalize' ? 'the test can end' : 'leaving this test part';
		throw new AssessmentPlayerError(
			code,
			required.length > 0
				? `These items need a response before ${what}: ${identifiers.join(', ')}`
				: `These items have responses that do not satisfy their interactions (before ${what}): ${identifiers.join(', ')}`,
			{
				items: named.map((blocker) => blocker.number).join(', '),
				itemIdentifiers: identifiers.join(','),
				count: named.length,
			},
		);
	}

	/**
	 * QTI feedback visibility is attempt-relative: with more than one attempt allowed,
	 * feedback for every non-final attempt must be shown; once the last attempt has
	 * ended, `showFeedback` governs. Adaptive items always show their feedback.
	 * `attemptsAfter` counts the attempts once the attempt being judged has ended.
	 */
	private feedbackVisible(q: FlatItem, attemptsAfter: number): boolean {
		const control = this.sessionCoordinator.getItemSettings(q.identifier);
		const adaptive = isAdaptiveItemXml(q.item.itemXml);
		return attemptFeedbackVisible({
			showFeedback: control.showFeedback === true,
			maxAttempts: resolveMaxAttempts(control, adaptive),
			attempts: attemptsAfter,
			adaptive,
		});
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
				this.canReviewItem(q),
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
		return this.isNavigationTargetLegalWith(index, this.lazyForward());
	}

	/** `isNavigationTargetLegal` with the forward step computed once for a batch of targets. */
	private isNavigationTargetLegalWith(index: number, forward: () => number): boolean {
		if (this.finalized || this.currentItemIndex < 0) return false;
		const target = this.items[index];
		if (!target) return false;
		if (target !== this.items[this.currentItemIndex]) {
			if (this.isItemLocked(target)) return false;
			if (!this.canReviewItem(target)) return false;
			if (!this.canNavigateByTestPart(index, this.currentItemIndex, forward)) return false;
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
		const forward = this.lazyForward();
		return this.items.map((item) => ({
			identifier: item.identifier,
			index: item.index,
			number: item.index + 1,
			sectionId: item.presentedSection?.identifier ?? null,
			title: this.reviewInfoFor(item.identifier).title,
			status: this.getItemAnswerStatus(item.identifier),
			flagged: this.sessionCoordinator.isItemFlagged(item.identifier),
			visited: this.navigationManager.isVisited(item.index) || item.index === this.currentItemIndex,
			jumpAllowed: this.isNavigationTargetLegalWith(item.index, forward),
			isCurrent: item.index === this.currentItemIndex,
		}));
	}

	/**
	 * Candidate-facing results for a shell's opt-in completion summary: per delivered
	 * item the answered status and — when the backend returned one — its score, plus the
	 * finalized totals. Null until the assessment has been finalized; high-stakes hosts
	 * simply never render it (the shell's `showResultsSummary` stays off by default).
	 */
	public getResultsSummary(): ResultsSummary | null {
		if (!this.finalized || !this.finalResults) return null;
		const scoreByItem = new Map(this.finalResults.itemResults.map((result) => [result.itemIdentifier, result]));
		return {
			totalScore: this.finalResults.totalScore,
			maxScore: this.finalResults.maxScore,
			items: this.items.map((item) => {
				const result = scoreByItem.get(item.identifier);
				return {
					identifier: item.identifier,
					number: item.index + 1,
					title: this.reviewInfoFor(item.identifier).title,
					status: this.getItemAnswerStatus(item.identifier),
					...(result ? { score: result.score, maxScore: result.maxScore } : {}),
				};
			}),
		};
	}

	/**
	 * What the candidate's next forward step would do. QTI test parts are delivered in
	 * sequence and cannot be re-entered, so a step that leaves the current part is the
	 * irreversible move the shell confirms before making.
	 */
	public getForwardTransitionInfo(): ForwardTransitionInfo {
		const current = this.items[this.currentItemIndex];
		if (!current || this.finalized) return { nextIndex: null, leavesTestPart: false };
		// A decision the backend made for this item and delivery has not followed yet (a
		// check's, a branch exit held back while questions of the part still owed an answer)
		// is what Next does now — unless Next re-submits a changed response, which decides anew.
		const kept = this.nextSubmits(current) ? null : this.keptBranchDecisionFor(current);
		if (kept) {
			const target = this.branchTargetIndex(current, kept);
			return {
				nextIndex: target >= 0 ? target : null,
				leavesTestPart: this.branchExitLeavesPart(current, kept),
			};
		}
		const nextIndex = this.forwardStepIndex(current);
		const next = nextIndex >= 0 ? this.items[nextIndex] : undefined;
		return {
			nextIndex: next ? nextIndex : null,
			leavesTestPart: Boolean(next && next.testPart !== current.testPart),
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
		this.events.emit('flagChange', id, flagged);
		// Flags are part of the persisted draft.
		this.notifyAutosaveActivity();
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
		return this.events.on('flagChange', listener);
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
					// Shared by reference, not cloned: the delivery context is a static
					// content record the backend returned, composition rebuilds share it so
					// unchanged items keep identical props, and callers treat it read-only.
					deliveryContext: itemRef.deliveryContext,
				};
			});
	}

	public getResponsesForItem(itemIdentifier: string): Record<string, unknown> {
		return cloneData(this.sessionCoordinator.getResponses(itemIdentifier)) ?? {};
	}

	/**
	 * The assessment identifier the backend drew this session for (`SecureAssessment.identifier`).
	 * Section tool bars and host integrations name the assessment with it.
	 */
	public getAssessmentId(): string {
		return this.assessment.identifier;
	}

	/**
	 * The delivered items of the active item's innermost section, with their current
	 * response records shared by reference (a shallow copy of the outer map only).
	 * For section composition building: the values are read-only views of session
	 * state and must not be mutated by callers — the deep-cloning accessors above
	 * remain the boundary for persistence and events.
	 */
	public getSectionItemResponses(): Record<string, Record<string, unknown>> {
		const current = this.items[this.currentItemIndex];
		if (!current) return {};
		const out: Record<string, Record<string, unknown>> = {};
		for (const item of this.items) {
			if (item.section.identifier !== current.section.identifier) continue;
			out[item.identifier] = { ...this.sessionCoordinator.getResponses(item.identifier) };
		}
		return out;
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
		if (!outcomes) return [];
		const parts = this.assessment.testParts ?? [];

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
					...(fb.language ? { language: fb.language } : {}),
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
		this.assertCandidateActionAllowed();
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
		this.assertCandidateActionAllowed();
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
		options: { validate?: boolean } = {},
	): SerializedItemSessionState {
		// Responses frozen by an expired time limit are final as they stand: validation
		// cannot ask the candidate to correct them any more.
		const validateResponses = options.validate !== false && this.sessionCoordinator.mustValidateResponses(q.identifier);
		const endAttempt = (session: ItemSession): SerializedItemSessionState => {
			// A session whose attempt already ended contributes its accepted state unchanged;
			// dispatching another end-attempt on it would throw and fail the final submission.
			if (!isWritableItemLifecycle(session.state().lifecycleStatus)) {
				return session.serialize();
			}
			const result = session.dispatch({ action: 'endAttempt', validateResponses }).result;
			if (result?.validation && !result.validation.valid) {
				// Coded, naming the item, so a shell shows which question to fix instead of a
				// generic failure that no retry can clear.
				throw new AssessmentPlayerError(
					'finalizeResponseInvalid',
					result.validation.issues[0]?.message || `Submit failed: invalid response for item ${q.identifier}`,
					{ items: String(q.index + 1), itemIdentifiers: q.identifier, count: 1 },
				);
			}
			return result?.sessionState ?? session.serialize();
		};
		const active = this.items[this.currentItemIndex];
		if (
			active === q &&
			this.currentItemSession &&
			isWritableItemLifecycle(this.currentItemSession.state().lifecycleStatus)
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

	/**
	 * How an item presents feedback and solutions under its resolved item session
	 * control, for its current attempt count (feedback visibility is attempt-relative,
	 * see `feedbackVisible`).
	 */
	private presentationFor(
		q: FlatItem,
		attemptsAfter = this.sessionCoordinator.getItemSessionInfo(q.identifier).attemptCount,
	): PresentationPolicy {
		const control = this.sessionCoordinator.getItemSettings(q.identifier);
		return {
			showFeedback: this.feedbackVisible(q, attemptsAfter),
			showSolution: control.showSolution === true,
		};
	}

	/**
	 * A counted submission can change what the item shows: feedback a non-final attempt
	 * revealed hides once the last attempt ended (unless showFeedback is on), and the
	 * first non-final attempt reveals it. Reopen the live session under the new policy
	 * when it differs; the item stays where it is.
	 */
	private refreshLivePresentation(q: FlatItem, itemSession: SerializedItemSessionState | undefined): void {
		const live = this.currentItemSession;
		if (!live || this.items[this.currentItemIndex] !== q) return;
		const next = this.presentationFor(q);
		const current = this.liveSessionPresentation ?? { showFeedback: true, showSolution: false };
		if (current.showFeedback === next.showFeedback && current.showSolution === next.showSolution) return;
		const restore = isWritableItemLifecycle(live.state().lifecycleStatus) ? live.serialize() : (itemSession ?? live.serialize());
		const session = this.getItemDefinition(q).openSession({ restore, presentation: next });
		this.releaseCurrentItemSession();
		this.attachCurrentItemSession(q, session, next);
		this.notifyItemChange();
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
			...(this.config.stringComparison ? { stringComparison: this.config.stringComparison } : {}),
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

	private attachCurrentItemSession(q: FlatItem, session: ItemSession, presentation?: PresentationPolicy): void {
		this.currentItemSession = session;
		this.liveSessionPresentation = presentation ?? null;
		this.currentItemSessionUnsubscribe = session.subscribe((transition) => {
			if (this.currentItemSession !== session) return;
			if (this.mirrorSessionResponses(q.identifier, transition.current.responses)) {
				this.notifyResponseChange();
			}
			this.scheduleEndAttemptSubmission(q, session, transition);
		});
	}

	/** The item's endAttemptInteraction bindings, parsed from its item XML once and cached. */
	private endAttemptResponseMap(q: FlatItem): Map<string, boolean> {
		let map = this.endAttemptResponses.get(q.identifier);
		if (!map) {
			map = new Map();
			for (const info of endAttemptInteractionInfo(q.item.itemXml)) {
				map.set(info.responseIdentifier, info.countAttempt);
			}
			this.endAttemptResponses.set(q.identifier, map);
		}
		return map;
	}

	/**
	 * QTI endAttempt on the response path: a candidate activating an endAttemptInteraction writes
	 * its boolean response. Assessment delivery decides what that means — the item session is
	 * owned here and must never be closed by a renderer. In a simultaneous test part the response
	 * processing is deferred to the end of the part, so the response is recorded like any other.
	 * In an individual test part the item is submitted through the normal per-item path with the
	 * interaction's countAttempt honored; the candidate stays on the item.
	 */
	private scheduleEndAttemptSubmission(q: FlatItem, session: ItemSession, transition: ItemSessionTransition): void {
		const command = transition.command;
		if (command.action !== 'setResponse') return;
		const responseId = command.responseIdentifier;
		// Only the change to true activates the interaction; re-writing the value is inert.
		if (transition.current.responses[responseId] !== true || transition.previous.responses[responseId] === true) {
			return;
		}
		const countAttempt = this.endAttemptResponseMap(q).get(responseId);
		if (countAttempt === undefined) return;
		if ((q.testPart.submissionMode ?? this.assessment.submissionMode) !== 'individual') return;

		queueMicrotask(() => {
			void this.runExclusive(async () => {
				if (
					this.destroyed ||
					this.finalized ||
					this.currentItemSession !== session ||
					this.items[this.currentItemIndex] !== q
				) {
					return;
				}
				if (!isWritableItemLifecycle(session.state().lifecycleStatus)) return;
				await this.submitCurrentItemInternal({ countAttempt, followBranching: false });
			}).catch((error) => {
				// A concurrent navigation or submission owns the transition; its own path submits
				// this response. Anything else surfaces to the host without breaking delivery.
				if (isAssessmentPlayerError(error) && error.code === 'navigationInFlight') return;
				this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
			});
		});
	}

	private releaseCurrentItemSession(): void {
		this.currentItemSessionUnsubscribe?.();
		this.currentItemSessionUnsubscribe = null;
		this.currentItemSession?.dispose();
		this.currentItemSession = null;
	}

	/**
	 * Freeze the live attempt for a proctor pause: suspend it (its responses become
	 * read-only and its QTI `duration` is captured in the persisted snapshot). The
	 * suspended session stays attached so the item keeps rendering, disabled, behind the
	 * pause; `reopenLiveSessionAfterPause()` reopens it from the snapshot so the paused
	 * time never counts as time on task.
	 */
	private suspendLiveSessionForPause(): void {
		if (this.suspendedForPause) return;
		const session = this.currentItemSession;
		if (!session || !isWritableItemLifecycle(session.state().lifecycleStatus)) return;
		this.saveCurrentItemSession();
		this.suspendedForPause = true;
	}

	/** Reopen the attempt a proctor pause froze, at the exact state the pause captured. */
	private reopenLiveSessionAfterPause(): void {
		if (!this.suspendedForPause) return;
		this.suspendedForPause = false;
		const q = this.items[this.currentItemIndex];
		const snapshot = q ? this.state.itemSessions?.[q.identifier] : undefined;
		if (!q || !snapshot) return;
		this.releaseCurrentItemSession();
		const presentation = this.presentationFor(q);
		this.attachCurrentItemSession(
			q,
			this.getItemDefinition(q).openSession({
				restore: snapshot,
				activate: true,
				presentation,
			}),
			presentation,
		);
	}

	/**
	 * Get the current session state snapshot (client-side view).
	 * Note: backend remains authoritative; this is intended for simple save/resume.
	 */
	public getState(options: { includeItemSessions?: boolean } = {}): AssessmentSessionState {
		const snapshot = this.sessionCoordinator.snapshot(options);
		// Every item the candidate has been presented is visited (not only submitted ones),
		// so the review screen's "not yet visited" marks survive a reload.
		const visited = new Set(snapshot.visitedItems);
		for (const index of this.navigationManager.getVisited()) {
			const identifier = this.items[index]?.identifier;
			if (identifier) visited.add(identifier);
		}
		snapshot.visitedItems = this.items.map((q) => q.identifier).filter((identifier) => visited.has(identifier));
		const current = this.items[this.currentItemIndex];
		if (options.includeItemSessions && current && this.currentItemSession && !this.paused) {
			// Navigation snapshots may predate edits made after revisiting this item.
			// Serialize the live authority without suspending the learner's attempt.
			// (While paused, the snapshot taken at the pause is current: serializing the
			// suspended session would count the paused time as time on task.)
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
				// The proctor pause, not the begin gate's hold: a restored snapshot reopens
				// paused only when a proctor paused it.
				isPaused: this.paused,
				...(this.paused && this.pauseReason ? { pauseReason: this.pauseReason } : {}),
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
			this.seedSubmittedResponses(state);
			this.restoreTimeTracking(state.timing);
			// The snapshot's clocks are the time accounting from here on: expiries are
			// recomputed from them before any item is entered, so a scope that already ran
			// out never reopens editable (and one that has not is not held locked).
			this.lockedScopes.clear();
			this.assessmentExpired = false;
			this.restoredExpiryFinalizeScheduled = false;
			this.timeManager?.resetExpiryRecord();
			this.lockExpiredScopesFromClocks(state.timing);
			this.templateDefaultsByPart.clear();
			// The snapshot replaces delivery — kept branch decisions included, so a restored
			// session lands identically (a snapshot from before the feature simply carries
			// none). The snapshot carries the proctor pause; the begin gate keeps holding the
			// clocks.
			const wasPaused = this.paused;
			this.paused = state.timing?.isPaused === true;
			this.pauseReason = this.paused ? state.timing?.pauseReason : undefined;
			if (!this.started) this.timeManager?.pause();

			// Restore visited state for UI navigation hints.
			this.navigationManager.restoreState(this.visitedIndexes(state.visitedItems));

			// Behind a begin gate no item is entered yet: start() enters the restored one.
			let deadEnd = false;
			if (this.started) {
				const currentId = state.currentItemIdentifier;
				const idx = currentId ? this.items.findIndex((q) => q.identifier === currentId) : -1;
				const requested = idx >= 0 ? idx : this.items.length > 0 ? 0 : -1;
				if (requested >= 0) {
					const entry = this.restoringEntryTarget(requested);
					deadEnd = entry.deadEnd;
					await this.performNavigateTo(entry.index, { restoring: true });
				}
				// The (re-)entry succeeded: a previous entry failure is repaired.
				this.entryError = null;
				this.pendingEntryIndex = null;
			}
			if (wasPaused !== this.paused) this.notifyPauseChange();
			if (deadEnd) this.notifyExpiryDeadEnd();
			this.finalizeRestoredExpiryWhenRunning();
			// A host-restored snapshot is the new draft; the save runs once this settles.
			this.notifyAutosaveActivity();
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
		return this.runCandidateTransition(() => this.performNavigateTo(index, options));
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
		if (!options.restoring && target && !this.canReviewItem(target)) {
			throw new AssessmentPlayerError(
				'reviewNotAllowed',
				'You cannot go back to previous questions in this assessment.',
			);
		}

		const currentItem = this.items[this.currentItemIndex];
		if (!options.restoring && currentItem && target) {
			this.assertTransitionMinimum(currentItem, target);
			// QTI parts cannot be re-entered: a candidate-initiated step into the next part
			// refuses while questions of the current part still owe an answer (a left part
			// can never be revisited, and the end of the test only collects unreachable
			// questions as they stand). The move's own submission already ran for next();
			// a direct jump leaves the current item behind, so it is included here.
			if (target.testPart !== currentItem.testPart) this.assertCanLeaveScope(currentItem);
			if (
				target.testPart !== currentItem.testPart &&
				(currentItem.testPart.submissionMode ?? this.assessment.submissionMode) === 'simultaneous'
			) {
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
			// Every enclosing section runs its own clock, outermost first.
			sections: q.sections.map((section) => ({
				identifier: section.identifier,
				timeLimits: section.timeLimits,
			})),
			item: { identifier: q.identifier, timeLimits: q.item.timeLimits },
		});

		// Restore responses into one live session owned by the assessment. The section
		// composition and item renderer receive this exact object.
		const responses = this.sessionCoordinator.activateItem(q.identifier);
		const restoredItemSession = this.state.itemSessions?.[q.identifier];
		this.releaseCurrentItemSession();
		const presentation = this.presentationFor(q);
		const session = this.getItemDefinition(q).openSession({
			restore: restoredItemSession,
			responses: restoredItemSession ? undefined : responses,
			activate: true,
			templateDefaults: restoredItemSession ? undefined : this.templateDefaultsFor(q),
			presentation,
		});
		this.attachCurrentItemSession(q, session, presentation);
		this.suspendedForPause = false;
		// An expired limit closed this item (a restoring entry at an expiry dead end, or a
		// branch into a closed scope): it shows read-only, never editable.
		if (this.isItemLocked(q)) this.saveCurrentItemSession();
		// Entered during a proctor pause (a restore, or a held start): the attempt stays frozen.
		if (this.paused) this.suspendLiveSessionForPause();

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
		return this.runCandidateTransition(async () => {
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
		return this.runCandidateTransition(() => this.performNext());
	}

	private async performNext(): Promise<void> {
		const q = this.items[this.currentItemIndex];
		if (!q || this.finalized) return;
		const responses = this.sessionCoordinator.getActiveResponses();
		// In individual submission mode the move submits the current item unless its attempts
		// are used up, it is already closed, or its recorded result already carries these exact
		// responses (a practice item moved on unchanged): the backend then decides where it goes.
		const submits = this.nextSubmits(q, responses);
		// A move that submits nothing follows the backend's decision kept for this item (a
		// check's, an end-attempt's, a branch exit held back, an end of the test that did not
		// complete); with none on record, the delivery rules decide (`ruleForwardIndex`).
		const kept = submits ? null : this.keptBranchDecisionFor(q);
		// Next from a simultaneous part's last item always crosses (or ends the test): the
		// part commits at the crossing, and only then is a decision on record to follow.
		const crossesSimultaneousPart =
			!submits && !kept && this.endsTestPart(q) && this.isSimultaneousSubmission(q);
		// On a crossing the pre-flush rule result is provisional: the flush can still change
		// the outcomes the rules read, so the landing is computed again after it.
		const forward = submits ? this.nextUnlockedIndex(q.index) : kept ? -1 : this.ruleForwardIndex(q);
		if (!kept && forward < 0 && !crossesSimultaneousPart) return;

		this.sessionCoordinator.markAnswered(q.identifier, responses);
		// QTI allowSkipping (individual parts only): an item that is about to be submitted
		// without any response may only be skipped when skipping is allowed. A simultaneous
		// part, an item already closed, or one an expired limit closed (collected as it
		// stands) is never held here.
		if (submits && !this.isItemLocked(q) && this.submissionGate(q, responses).mustAnswer) {
			throw new AssessmentPlayerError('responseRequired', 'You must answer this question before continuing.');
		}
		// A step out of the part (the next item lies in the next part, or a kept decision
		// leaves it) is refused before anything is submitted while another question of the
		// part still owes an answer: the part cannot be re-entered. The current item is this
		// move's own submission (or already accepted as it stands).
		const leavesPart = kept
			? this.branchExitLeavesPart(q, kept)
			: crossesSimultaneousPart || this.items[forward]!.testPart !== q.testPart;
		if (leavesPart && !this.isItemLocked(q)) this.assertCanLeaveScope(q, { exclude: q });
		if (submits) {
			const before = this.currentItemIndex;
			this.clearKeptBranchDecisions();
			await this.submitCurrentItemInternal();
			// The submission may branch, navigate, or finalize the test (EXIT_TEST); in those
			// cases navigation stops here.
			if (this.currentItemIndex !== before || this.finalized) return;
		} else if (kept) {
			// The decision the backend made for this item's accepted submission is followed now.
			// The move submits nothing, so its minimum times are checked here (an end of the
			// test checks its own). One that can no longer be followed (it would re-enter a part
			// already left) leaves the forward step to the delivery rules.
			const target = this.items[this.branchTargetIndex(q, kept)];
			if (target && !this.isItemLocked(q)) this.assertTransitionMinimum(q, target);
			const before = this.currentItemIndex;
			await this.followBranch(q, kept);
			if (this.currentItemIndex !== before || this.finalized) return;
		} else if (crossesSimultaneousPart) {
			await this.crossSimultaneousPart(q);
			return;
		}
		// The candidate may still return and re-attempt this item: reopen it writable while
		// attempts remain (a no-op for closed single-attempt or writable items), so the
		// revisit restores an attemptable state instead of the closed one.
		this.reopenForRemainingAttempts(q);
		// No backend decision moved delivery (none was returned, or it could not be followed):
		// the delivery rules decide, as the navigation rules check them.
		const nextIndex = this.unsubmittedForwardIndex(q);
		if (nextIndex < 0) return;
		await this.performNavigateTo(nextIndex);
	}

	/**
	 * Leave the simultaneous test part `last` belongs to: its pending responses go out
	 * first (a failed request throws and keeps the candidate here for a retry), and the
	 * branch decision the flush returns for the part's last item — the part's testPart
	 * branchRule ran there, with every item's variables committed — is what delivery
	 * follows, through `followBranch`'s part-leave, EXIT_TEST and finalized guards. With
	 * no decision (or one that led nowhere) the delivery rules decide on the committed
	 * state, honouring the following parts' preconditions.
	 */
	private async crossSimultaneousPart(last: FlatItem): Promise<void> {
		await this.submitSimultaneousItems(this.items.filter((item) => item.testPart === last.testPart));
		const target = this.partCrossingDecisionTarget(last);
		if (target !== null) {
			const before = this.currentItemIndex;
			await this.followBranch(last, target);
			if (this.currentItemIndex !== before || this.finalized) return;
		}
		// No decision moved delivery: the delivery rules decide, as the navigation rules
		// check them — on the state the flush just committed.
		const nextIndex = this.unsubmittedForwardIndex(last);
		if (nextIndex < 0) return;
		await this.performNavigateTo(nextIndex);
	}

	/**
	 * The branch decision a simultaneous part's flush left for its last item, when it takes
	 * delivery out of the part that is ending. A target inside that part is rejected: the
	 * part is being left, its responses are out, and its rules cannot deliver into it again.
	 */
	private partCrossingDecisionTarget(last: FlatItem): string | null {
		const target = this.keptBranchDecisionFor(last);
		if (!target) return null;
		const targetIndex = this.indexOfItem(target);
		if (targetIndex >= 0 && this.items[targetIndex]!.testPart === last.testPart) return null;
		return target;
	}

	/** Whether the delivered item after `q` lies outside `q`'s test part (or nothing does). */
	private endsTestPart(q: FlatItem): boolean {
		return this.items[q.index + 1]?.testPart !== q.testPart;
	}

	/** The part's effective QTI submission mode. */
	private isSimultaneousSubmission(q: FlatItem): boolean {
		return (q.testPart.submissionMode ?? this.assessment.submissionMode) === 'simultaneous';
	}

	/**
	 * Whether `next()` from the item submits it: an individual part's item whose attempts
	 * remain, that is not closed, and whose responses differ from its last counted submission
	 * (or that has none).
	 */
	private nextSubmits(q: FlatItem, responses = this.sessionCoordinator.getActiveResponses()): boolean {
		return (
			this.isIndividual(q) &&
			this.sessionCoordinator.canSubmit(q.identifier) &&
			this.itemLifecycleOf(q.identifier) !== 'closed' &&
			!this.responsesUnchangedSinceSubmission(q.identifier, responses)
		);
	}

	/**
	 * The backend's decisions for leaving an item (`nextItemIdentifier`), keyed per item on
	 * the session state (`state.branchDecisions`) with that item's last-submission record,
	 * so a restored session lands identically. A counted submission that stays on the item
	 * (a practice check, a counted endAttemptInteraction) keeps its decision; so does a
	 * branch exit refused while questions of the part still owed an answer, and a
	 * simultaneous part's crossing flush keeps the decision made for its last item. The next
	 * forward step from that item that submits nothing — the candidate moves on with the
	 * response unchanged — follows it; a changed response re-submits and the fresh decision
	 * replaces it. At most the freshest decision is kept: any later counted submission voids
	 * the earlier ones (the outcomes they were decided on have moved), and following a
	 * decision clears it.
	 */

	/** The backend decision kept for `q` that delivery has not followed yet (its target). */
	private keptDecisionTarget(q: FlatItem): string | null {
		const target = this.state.branchDecisions?.[q.identifier];
		return target ?? null;
	}

	/** Keep `target` as the one decision delivery may still follow — the item's freshest. */
	private keepBranchDecision(q: FlatItem, target: string): void {
		this.state.branchDecisions = { [q.identifier]: target };
	}

	/** Every kept decision is void: a counted submission moved the outcomes they decided on. */
	private clearKeptBranchDecisions(): void {
		delete this.state.branchDecisions;
	}

	/**
	 * The backend decision kept for leaving `q` — its item's entry in the session state
	 * (`branchDecisions`), made by `q`'s last counted submission — if delivery has not
	 * followed it yet. A decision onto an item an expired time limit has closed since is
	 * passed over like the item itself: the delivery rules then find the next open item.
	 */
	private keptBranchDecisionFor(q: FlatItem): string | null {
		const target = this.keptDecisionTarget(q);
		if (!target) return null;
		const targetItem = this.items[this.indexOfItem(target)];
		return targetItem && this.isItemLocked(targetItem) ? null : target;
	}

	/**
	 * Where the candidate's Next goes from `q`: when it submits the item, the backend decides
	 * once the submission is accepted (the adjacent open item stands for that decision until
	 * then); otherwise the destination is known now (`unsubmittedForwardIndex`). -1 when
	 * nothing follows — Submit is the way on.
	 */
	private forwardStepIndex(q: FlatItem): number {
		return this.nextSubmits(q) ? this.nextUnlockedIndex(q.index) : this.unsubmittedForwardIndex(q);
	}

	/**
	 * Where a forward step from `q` that submits nothing lands — a move on after a practice
	 * check, a move out of a simultaneous part, a jump into the next test part: the backend's
	 * decision kept for `q`, else the next item the delivery rules make eligible
	 * (`ruleForwardIndex`). -1 when nothing follows (an EXIT_TEST decision, nothing eligible).
	 */
	private unsubmittedForwardIndex(q: FlatItem): number {
		const kept = this.keptBranchDecisionFor(q);
		return kept ? this.branchTargetIndex(q, kept) : this.ruleForwardIndex(q);
	}

	/**
	 * The next item after `q` when no backend decision applies, by the reference backend's own
	 * rules (`nextItemIdentifier`): branch rules first — in a linear part the item's and those
	 * of each section it ends, the test part's at its end — then preconditions: a test part's on
	 * entering it in any navigation mode, a linear part's sections and items on reaching them.
	 * They read the test outcomes the backend last returned and the recorded variables of every
	 * item it accepted (`ITEM.VARIABLE`), as the backend does. Items an expired time limit closed
	 * are passed over. A test without branch rules or preconditions moves to the adjacent open item.
	 */
	private ruleForwardIndex(q: FlatItem): number {
		if (!this.hasDeliveryRules) return this.nextUnlockedIndex(q.index);
		const decls = this.navigationDeclarationsFor(q);
		const first = this.indexOfItem(nextItemIdentifier(this.assessment, this.deliveredForRules, q.index, decls, Math.random));
		if (first < 0) return -1;
		if (!this.isItemLocked(this.items[first]!)) return first;
		for (const index of this.eligibleIndexesAfter(first, decls)) {
			if (!this.isItemLocked(this.items[index]!)) return index;
		}
		return -1;
	}

	/**
	 * The items the delivery rules reach after `fromIndex`, in order: each one whose
	 * preconditions hold as the sequence enters its test part (any navigation mode) and, in a
	 * linear part, its sections and the item itself. Without rules, every following item.
	 */
	private *eligibleIndexesAfter(fromIndex: number, decls?: DeclarationMap): Generator<number> {
		if (!this.hasDeliveryRules) {
			for (let index = fromIndex + 1; index < this.items.length; index++) yield index;
			return;
		}
		const from = this.items[fromIndex];
		if (!from) return;
		const declarations = decls ?? this.navigationDeclarationsFor(from);
		let previous = this.deliveredForRules[fromIndex];
		let start = fromIndex + 1;
		while (start < this.items.length) {
			const index = this.indexOfItem(
				firstEligibleItem(this.assessment, this.deliveredForRules, start, previous, declarations, Math.random),
			);
			if (index < 0) return;
			yield index;
			previous = this.deliveredForRules[index];
			start = index + 1;
		}
	}

	/**
	 * The declarations branch rules and preconditions read, built as the reference backend
	 * builds them for a decision about leaving `from`: the test outcomes the backend last
	 * returned, every item with a recorded result as `ITEM.VARIABLE` (an item without one reads
	 * as NULL), and `from`'s own variables unprefixed where the test declares no such outcome.
	 */
	private navigationDeclarationsFor(from: FlatItem): DeclarationMap {
		const recorded: Record<string, Record<string, QtiValue>> = {};
		for (const item of this.items) {
			const scoring = this.state.itemScores?.[item.identifier];
			if (!scoring && !this.sessionCoordinator.hasItemResult(item.identifier)) continue;
			const variables = recordedItemVariableValues(this.state.itemSessions?.[item.identifier], scoring?.outcomeValues);
			if (scoring && !variables.SCORE) variables.SCORE = { kind: 'value', baseType: 'float', cardinality: 'single', value: scoring.score };
			recorded[item.identifier] = applyVariableMappings(variables, item.item.variableMappings);
		}
		return addItemVariableDeclarations(
			testOutcomeDeclarations(this.assessment, this.testOutcomes ?? undefined),
			recorded,
			recorded[from.identifier] ?? {},
		);
	}

	private indexOfItem(identifier: string | undefined): number {
		return identifier === undefined ? -1 : (this.indexByIdentifier.get(identifier) ?? -1);
	}

	/** The forward step, computed at most once for a batch of legality checks. */
	private lazyForward(): () => number {
		let forward: number | undefined;
		return () => {
			if (forward === undefined) {
				const current = this.items[this.currentItemIndex];
				forward = current ? this.unsubmittedForwardIndex(current) : -1;
			}
			return forward;
		};
	}

	/**
	 * Whether the item's last counted submission already carried these responses.
	 * False when nothing was recorded: the caller then submits as usual.
	 */
	private responsesUnchangedSinceSubmission(
		itemIdentifier: string,
		responses?: Record<string, unknown>,
	): boolean {
		const submitted = this.lastSubmittedResponses.get(itemIdentifier);
		if (!submitted) return false;
		const current = responses ?? this.sessionCoordinator.getActiveResponses();
		return responseValuesEqual(submitted, current);
	}

	/**
	 * Seed the submitted-response memory from a restored snapshot: an item whose recorded
	 * result the snapshot carries was accepted with exactly those responses, so moving on
	 * (or finalizing) with them unchanged re-submits nothing and re-spends no attempt.
	 */
	private seedSubmittedResponses(state: AssessmentSessionState): void {
		const scores = state.itemScores ?? {};
		for (const [itemIdentifier, responses] of Object.entries(state.itemResponses ?? {})) {
			if (!scores[itemIdentifier]) continue;
			if (this.lastSubmittedResponses.has(itemIdentifier)) continue;
			this.lastSubmittedResponses.set(
				itemIdentifier,
				cloneResponseRecord(responses as Record<string, unknown>),
			);
		}
	}

	/** Move back. Serialized with all other transitions; rejects as busy while one is in flight. */
	public previous(): Promise<void> {
		return this.runCandidateTransition(async () => {
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
		return this.runCandidateTransition(() => this.submitCurrentItemInternal());
	}

	/**
	 * Whether the shell should offer the item-level "Check answer" control on the active
	 * item, with the attempt facts it displays. The control exists only in `individual`
	 * submission-mode parts where more than one attempt is allowed (or the item is
	 * adaptive): QTI shows feedback for every non-final attempt then, whatever
	 * `showFeedback` says, so checking in place always reveals something. A single
	 * attempt keeps the submit-on-move delivery (its feedback, under `showFeedback`, rides
	 * the transition); QTI simultaneous parts have no per-item submission.
	 */
	public getCheckAnswerState(): CheckAnswerState | null {
		const q = this.items[this.currentItemIndex];
		if (!q) return null;
		const id = q.identifier;
		const mode = q.testPart.submissionMode ?? this.assessment.submissionMode;
		const adaptive = isAdaptiveItemXml(q.item.itemXml);
		if (mode !== 'individual') {
			return {
				available: false,
				reason: 'simultaneous',
				adaptive,
				attemptsUsed: 0,
				maxAttempts: null,
				remainingAttempts: null,
				attemptsExhausted: false,
			};
		}
		const info = this.sessionCoordinator.getItemSessionInfo(id);
		const maxAttempts = resolveMaxAttempts(this.sessionCoordinator.getItemSettings(id), adaptive);
		const remainingAttempts = maxAttempts === null ? null : Math.max(0, maxAttempts - info.attemptCount);
		const attemptsExhausted = maxAttempts !== null && info.attemptCount >= maxAttempts;
		// maxAttempts 1 delivers feedback on the move (submit-on-move): no check control.
		const available = maxAttempts === null || maxAttempts > 1;
		return {
			available,
			reason: available ? null : 'feedbackOff',
			adaptive,
			attemptsUsed: info.attemptCount,
			maxAttempts,
			remainingAttempts,
			attemptsExhausted,
		};
	}

	/**
	 * Practice flow: submit the active item through the normal per-item path and STAY on
	 * it, so its feedback becomes visible (the shell shows `getLastItemFeedback()`).
	 * The submission counts toward `maxAttempts`; while attempts remain the item reopens
	 * writable afterwards (non-adaptive items reopen from the pre-submit state with the
	 * computed outcomes restored), so the candidate can revise and check again. Adaptive
	 * items keep their engine-driven attempt loop. Once the attempts are used up this
	 * rejects with a coded `maxAttemptsReached`; moving on with `next()` then needs no
	 * further submission. Serialized with all other transitions.
	 */
	public checkCurrentItem(): Promise<ItemResult | null> {
		return this.runCandidateTransition(async () => {
			const q = this.items[this.currentItemIndex];
			if (!q) return null;
			const state = this.getCheckAnswerState();
			if (!state?.available) {
				throw new AssessmentPlayerError(
					'navigationNotAllowed',
					'Checking answers is not available for this item.',
				);
			}
			if (state.attemptsExhausted || !this.sessionCoordinator.canSubmit(q.identifier)) {
				throw new AssessmentPlayerError(
					'maxAttemptsReached',
					`No attempts remain for item "${q.identifier}".`,
				);
			}
			const live = this.currentItemSession;
			if (live && !isWritableItemLifecycle(live.state().lifecycleStatus)) {
				// The attempt already ended (and attempts remain only for adaptive items the
				// engine kept open); nothing to check until delivery reopens the item.
				return null;
			}
			const result = await this.submitCurrentItemInternal({ countAttempt: true, followBranching: false });
			this.reopenForRemainingAttempts(q);
			return result;
		});
	}

	/**
	 * While counted attempts remain on a non-adaptive item whose attempt just ended (a
	 * practice check, a submit-on-move the candidate may come back to), reopen it writable
	 * from that processed attempt: the session keeps the attempt count (the engine restores
	 * `contextVariables.numAttempts`, so the next counted attempt runs response processing as
	 * attempt k+1) and the outcomes response processing computed — the integrated feedback
	 * renders from them while the candidate revises — with its lifecycle set back to
	 * `interacting`. What the item persists from then on is the attempt the backend accepted.
	 */
	private reopenForRemainingAttempts(q: FlatItem): void {
		if (isAdaptiveItemXml(q.item.itemXml)) return;
		// Only the item delivery stands on (a scope expiry may have moved the candidate away
		// while its submission was in flight): another item's live session is never replaced.
		if (this.items[this.currentItemIndex] !== q) return;
		// An item an expired time limit closed stays closed.
		if (this.isItemLocked(q)) return;
		const live = this.currentItemSession;
		if (!live || live.state().lifecycleStatus !== 'closed') return;
		if (!this.sessionCoordinator.canSubmit(q.identifier)) return;
		const presentation = this.presentationFor(q);
		const session = this.getItemDefinition(q).openSession({
			restore: { ...live.serialize(), lifecycleStatus: 'interacting' },
			presentation,
		});
		this.releaseCurrentItemSession();
		this.attachCurrentItemSession(q, session, presentation);
		this.notifyItemChange();
	}

	/**
	 * The item feedback the most recent item-level submission produced (item modal
	 * feedback from response processing, or the backend's `result.feedback`), or null.
	 * Shells show it after `checkCurrentItem()` and after a submit-on-move `next()`.
	 */
	public getLastItemFeedback(): ItemFeedbackView | null {
		return this.lastItemFeedback ? { ...this.lastItemFeedback, feedback: [...this.lastItemFeedback.feedback] } : null;
	}

	/** Discard the captured item feedback once the shell has shown it. */
	public clearLastItemFeedback(): void {
		this.lastItemFeedback = null;
	}

	private getLastItemFeedbackFor(itemIdentifier: string): ItemFeedbackView | null {
		return this.lastItemFeedback?.itemIdentifier === itemIdentifier ? this.lastItemFeedback : null;
	}

	/**
	 * Capture an item-level submission's feedback for the shell, under the item's
	 * attempt-relative feedback visibility (`attemptsAfter`: the counted attempts once this
	 * submission is recorded). A submission that produces none clears a stale capture for
	 * the flow that follows it.
	 */
	private captureItemFeedback(
		q: FlatItem,
		feedback: ReadonlyArray<{ identifier: string; content: string; title?: string }> | undefined,
		attemptsAfter: number,
	): void {
		if (!this.feedbackVisible(q, attemptsAfter) || !feedback || feedback.length === 0) {
			this.lastItemFeedback = null;
			return;
		}
		this.lastItemFeedback = {
			itemIdentifier: q.identifier,
			feedback: cloneData([...feedback]) as ItemFeedbackEntry[],
		};
	}

	private async submitCurrentItemInternal(
		options: { countAttempt?: boolean; followBranching?: boolean } = {},
	): Promise<ItemResult> {
		const countAttempt = options.countAttempt ?? true;
		const q = this.items[this.currentItemIndex];
		if (!q) throw new AssessmentPlayerError('invalidNavigationTarget', 'No current item');
		// An expired limit closed this attempt (or a proctor ends the test): neither its
		// minimum time nor the skipping/validation gates can hold it open, and the backend
		// receives it as the collection of the responses as they stand.
		const submissionReason = this.submissionReasonFor(q);
		const administrative = submissionReason !== undefined;
		if (!administrative) this.assertMinimumTime('item', q);
		const responses = this.currentItemSession
			? cloneResponseRecord(this.currentItemSession.state().responses)
			: this.sessionCoordinator.getActiveResponses();
		// QTI allowSkipping / validateResponses on the per-item path (individual parts only).
		// A hint (countAttempt=false) is not an attempt and is not held back.
		const gate = administrative || !countAttempt ? { mustAnswer: false, validate: false } : this.submissionGate(q, responses);
		if (gate.mustAnswer) {
			throw new AssessmentPlayerError('responseRequired', 'You must answer this question before continuing.');
		}
		if (gate.validate && !this.responsesSatisfyConstraints(q)) {
			throw new AssessmentPlayerError(
				'attemptValidationFailed',
				`Submit failed: the responses for item ${q.identifier} do not satisfy its interactions`,
			);
		}
		// The counted attempts once this submission is recorded: feedback visibility is
		// attempt-relative (a non-final attempt shows feedback whatever showFeedback says).
		const attemptsAfter =
			this.sessionCoordinator.getItemSessionInfo(q.identifier).attemptCount + (countAttempt ? 1 : 0);

		const submittedAt = Date.now();
		let itemSession: SerializedItemSessionState | undefined;
		const submittedSession = this.currentItemSession;
		const preSubmitSession = submittedSession?.serialize();
		let res: Awaited<ReturnType<BackendAdapter['submitResponses']>>;
		try {
			if (submittedSession) {
				// A session whose attempt already ended contributes its accepted state unchanged;
				// dispatching another end-attempt on it would throw and fail the submission.
				const transition = isWritableItemLifecycle(submittedSession.state().lifecycleStatus)
					? submittedSession.dispatch({
							action: 'endAttempt',
							countAttempt,
							validateResponses: gate.validate,
						})
					: undefined;
				const attempt = transition?.result;
				if (transition && !attempt) throw new Error('Item session did not produce an end-attempt result');
				if (attempt?.validation && !attempt.validation.valid) {
					throw new AssessmentPlayerError(
						'attemptValidationFailed',
						attempt.validation.issues[0]?.message || 'Submit failed: invalid response',
					);
				}
				itemSession = attempt?.sessionState ?? submittedSession.serialize();
				this.captureItemFeedback(q, attempt?.scoring?.modalFeedback, attemptsAfter);
			}
			res = await this.backend.submitResponses({
				sessionId: this.sessionId,
				itemIdentifier: q.identifier,
				responses: responses as any,
				submittedAt,
				countAttempt,
				timeSpent: itemSession?.duration,
				timing: this.getSubmitTimingEvidence(q, itemSession?.duration ?? 0, submissionReason),
				itemSession: this.sendsItemSession() ? itemSession : undefined,
				comment: this.sessionCoordinator.getItemComment(q.identifier),
			});

			if (!res.success || !res.result) {
				// Backend error text stays on the Error (logs/host callbacks); candidates
				// see the localized `assessment.errors.codes.submitFailed` message instead.
				throw new AssessmentPlayerError('submitFailed', res.error || 'Submit failed');
			}
			// A backend that produced no session-side modal feedback (production item XML
			// is delivered without responseProcessing) may still return feedback entries
			// from its own scoring: the same capture, backend-authored.
			if (res.result.feedback?.length && !this.getLastItemFeedbackFor(q.identifier)) {
				this.captureItemFeedback(
					q,
					res.result.feedback.map((item) => ({
						identifier: item.type,
						content: item.content,
					})),
					attemptsAfter,
				);
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
				const presentation = this.presentationFor(q);
				this.attachCurrentItemSession(
					q,
					this.getItemDefinition(q).openSession({ restore: preSubmitSession, presentation }),
					presentation,
				);
				this.notifyItemChange();
			}
			// Nothing committed: no feedback belongs to this attempt.
			this.lastItemFeedback = null;
			throw error;
		}

		if (itemSession) {
			this.sessionCoordinator.setItemSession(q.identifier, itemSession);
		}

		this.setTestOutcomes(res.outcomes);
		this.reportOutcomeProcessingError(res.outcomeProcessingError);

		// An uncounted submission (QTI endAttempt countAttempt=false, a hint request) persists the
		// response and session but records no result and consumes no attempt: the candidate stays
		// on the item and a later submission carries the final response.
		if (countAttempt) {
			// The attempt count before this submission: a backend `updatedState` carries its own
			// authoritative count (`itemSessionStates`), which must not be counted twice.
			const attemptsBefore = this.sessionCoordinator.getItemSessionInfo(q.identifier).attemptCount;
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

			const itemResult: ItemResult = {
				itemIdentifier: q.identifier,
				score: res.result.score,
				maxScore: res.result.maxScore,
				responses: { ...responses },
			};
			this.sessionCoordinator.setItemResult(itemResult);
			// The counted submission's response set: a later move-time or end-of-test
			// submission of the same responses is skipped (no wasted attempt).
			this.lastSubmittedResponses.set(q.identifier, cloneResponseRecord(responses));

			// Track item session rules (review/attempts) and visited items for navigation hints.
			// The backend already counted this attempt when its `updatedState` restored a
			// higher count; only a backend without state updates records locally.
			try {
				if (this.sessionCoordinator.getItemSessionInfo(q.identifier).attemptCount <= attemptsBefore) {
					this.sessionCoordinator.recordAttempt(q.identifier);
				}
			} catch {
				// ignore
			}
			this.sessionCoordinator.markAnswered(q.identifier, responses);
			// The submitted item, not wherever delivery stands now (a scope expiry may have
			// moved the candidate while the submission was in flight).
			this.navigationManager.markVisited(q.index);

			// Apply the backend's branching decision, if any. QTI branchRule semantics:
			// - EXIT_TEST terminates the test: remaining items are not presented and the test
			//   finalizes exactly like a normal end of test.
			// - EXIT_TESTPART ends the current test part; EXIT_SECTION ends the current section.
			//   Delivery continues with the next item outside the ended scope; when none follows
			//   (for the part, or the test), the ended scope finalizes like a normal end of test.
			// A submission that stays on the item (a practice check, a counted end-attempt) keeps
			// the decision instead: the next forward step from the item that submits nothing
			// follows it. Either way it voids every earlier decision, which was made on outcomes
			// this submission has moved.
			this.clearKeptBranchDecisions();
			if (options.followBranching === false) {
				if (res.nextItemIdentifier) {
					this.keepBranchDecision(q, res.nextItemIdentifier);
				}
			} else if (res.nextItemIdentifier) {
				await this.followBranch(q, res.nextItemIdentifier);
			}
			// Still on the item (a check, a hint, the last item): what it shows follows the
			// attempt count — a final attempt hides feedback a non-final one revealed.
			if (!this.finalized && this.items[this.currentItemIndex] === q) {
				this.refreshLivePresentation(q, itemSession);
			}

			return itemResult;
		}

		this.sessionCoordinator.markAnswered(q.identifier, responses);
		return {
			itemIdentifier: q.identifier,
			score: res.result.score,
			maxScore: res.result.maxScore,
			responses: { ...responses },
		};
	}

	/**
	 * Follow the backend's branching decision for the item just submitted. A decision that
	 * would leave the test part (EXIT_TESTPART, an EXIT_SECTION with nothing after it in
	 * the part, a target in a later part) or end the test (EXIT_TEST) while other questions
	 * of the part still owe an answer is refused like a candidate's own step out of the
	 * part: the candidate stays, the coded error names the questions, and the decision is
	 * kept — the next `next()` from this item follows it once they are answered (a changed
	 * response re-submits and replaces it).
	 *
	 * The end of the test never navigates: a decision its own submission returns is kept
	 * the same way and the collection runs where the candidate stands. A decision that
	 * arrives after delivery moved on (a scope expiry closed the item while its submission
	 * was in flight and moved the candidate) is not followed — it would undo that move —
	 * and a test part delivery already left is never re-entered.
	 */
	private async followBranch(q: FlatItem, target: string): Promise<void> {
		const targetIndex = this.items.findIndex((item) => item.identifier === target);
		const standing = this.items[this.currentItemIndex] ?? q;
		// A test part delivery already left is never re-entered, whatever the decision says.
		if (targetIndex >= 0 && this.partOrder(this.items[targetIndex]) < this.partOrder(standing)) {
			this.clearKeptBranchDecisions();
			return;
		}
		// An end of the test is running: it collects where the candidate stands.
		if (this.endReason !== null) {
			this.keepBranchDecision(q, target);
			return;
		}
		// Delivery moved on while the submission was in flight: the decision no longer applies.
		if (standing !== q) return;
		try {
			if (target === 'EXIT_TEST') this.assertNoSubmissionBlockers();
			else if (this.branchExitLeavesPart(q, target)) this.assertCanLeaveScope(q, { exclude: q });
		} catch (error) {
			this.keepBranchDecision(q, target);
			throw error;
		}
		this.clearKeptBranchDecisions();
		if (target === 'EXIT_TEST') {
			await this.endTestInternal({ reason: 'branch' });
			return;
		}
		if (target === 'EXIT_TESTPART' || target === 'EXIT_SECTION') {
			await this.applyExitBoundary(target, q);
			return;
		}
		if (targetIndex >= 0) {
			// A target in the same part leaves this item revisitable: while attempts remain
			// (QTI allowReview governs only after the last one) its handoff must be
			// attemptable, exactly as on the candidate's own move — reopen it writable and
			// hand it off before the hop (a branch hop does not save the outgoing session).
			if (this.items[targetIndex]!.testPart === q.testPart) {
				this.reopenForRemainingAttempts(q);
				const status = this.currentItemSession?.state().lifecycleStatus;
				if (status !== undefined && isWritableItemLifecycle(status)) this.saveCurrentItemSession();
			}
			await this.performNavigateTo(targetIndex, { restoring: true });
		}
	}

	/** Where a branch decision lands: an item index, or -1 when it ends the test. */
	private branchTargetIndex(q: FlatItem, target: string): number {
		if (target === 'EXIT_TEST') return -1;
		if (target === 'EXIT_TESTPART') {
			return this.items.findIndex((item, i) => i > q.index && item.testPart !== q.testPart);
		}
		if (target === 'EXIT_SECTION') {
			const exited = this.endedEnclosingSection(q);
			const inside = this.items.findIndex(
				(item, i) => i > q.index && !item.sections.some((section) => section.identifier === exited.identifier),
			);
			return inside >= 0 ? inside : this.items.findIndex((item, i) => i > q.index && item.testPart !== q.testPart);
		}
		return this.items.findIndex((item) => item.identifier === target);
	}

	/** Whether a branch decision takes delivery out of the item's test part (or ends the test). */
	private branchExitLeavesPart(q: FlatItem, target: string): boolean {
		const index = this.branchTargetIndex(q, target);
		return index < 0 || this.items[index]!.testPart !== q.testPart;
	}

	/**
	 * Leave the scope ended by an EXIT_TESTPART / EXIT_SECTION branch rule: continue with
	 * the first delivered item outside it, finalizing the ended test part (or, when nothing
	 * follows anywhere, the whole test) through the same finalization path as submit().
	 *
	 * The literal resolves over the item's full enclosing chain (like the backend's
	 * branch-rule walk), not the innermost section alone: an outer-section EXIT lands
	 * outside the whole outer section.
	 */
	private async applyExitBoundary(
		special: 'EXIT_TESTPART' | 'EXIT_SECTION',
		current: FlatItem,
	): Promise<void> {
		const exitedSection = special === 'EXIT_SECTION' ? this.endedEnclosingSection(current) : undefined;
		let nextIdx = this.items.findIndex((item, i) =>
			i > this.currentItemIndex &&
			(exitedSection
				? !item.sections.some((section) => section.identifier === exitedSection.identifier)
				: item.testPart.identifier !== current.testPart.identifier),
		);
		if (exitedSection && nextIdx < 0) {
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
		await this.endTestInternal({ reason: 'branch' });
	}

	/**
	 * The enclosing section a literal EXIT_SECTION leaves: the innermost section, walked
	 * outward while the next enclosing one also ends with the current item — a branch rule
	 * on an outer section fires at its last item, where the whole outer boundary closes, so
	 * the EXIT lands outside the entire outer section, not just outside the innermost one.
	 */
	private endedEnclosingSection(current: FlatItem): FlatItem['section'] {
		let ended = current.section;
		for (let level = current.sections.length - 2; level >= 0; level--) {
			const section = current.sections[level]!;
			const continues = this.items.some(
				(item, i) => i > this.currentItemIndex && item.sections.some((s) => s.identifier === section.identifier),
			);
			if (continues) break;
			ended = section;
		}
		return ended;
	}

	private canPrevious(): boolean {
		if (this.currentItemIndex <= 0) return false;
		const prev = this.items[this.currentItemIndex - 1];
		if (!prev || this.isItemLocked(prev)) return false;
		if (!this.canNavigateByTestPart(this.currentItemIndex - 1, this.currentItemIndex)) return false;
		return this.canReviewItem(prev);
	}

	/**
	 * QTI `allowReview` for returning to an item: it governs only once the item's session is
	 * over — after its last attempt, or (adaptive) once it completed. While attempts remain
	 * the candidate may come back and use them.
	 */
	private canReviewItem(q: FlatItem): boolean {
		const completed =
			isAdaptiveItemXml(q.item.itemXml) && this.itemLifecycleOf(q.identifier) === 'closed';
		return this.sessionCoordinator.canReview(q.identifier, { completed });
	}

	/** The lifecycle of an item's session: the live one for the active item, else the persisted handoff. */
	private itemLifecycleOf(itemIdentifier: string): SerializedItemSessionState['lifecycleStatus'] | undefined {
		const current = this.items[this.currentItemIndex];
		if (current?.identifier === itemIdentifier) {
			return (
				this.currentItemSession?.state().lifecycleStatus ??
				this.state.itemSessions?.[itemIdentifier]?.lifecycleStatus
			);
		}
		return this.state.itemSessions?.[itemIdentifier]?.lifecycleStatus;
	}

	private canNext(): boolean {
		const current = this.items[this.currentItemIndex];
		if (!current) return false;
		// Note: itemSessionControl constraints on leaving current item are enforced in next().
		return this.forwardStepIndex(current) >= 0;
	}

	/**
	 * Whether a candidate-initiated move from `currentIndex` to `targetIndex` follows the
	 * navigation rules. Within a nonlinear test part any item is reachable. Otherwise the only
	 * forward move is the forward step itself — `forward`, the item the backend's decision kept
	 * for the current item or the delivery rules (branch rules, preconditions) deliver next,
	 * passing over items an expired limit closed: in a linear part no item is skipped or
	 * revisited, and test parts are entered in sequence — never a jump across a part, never
	 * one back, never into a part whose precondition fails.
	 */
	private canNavigateByTestPart(
		targetIndex: number,
		currentIndex: number,
		forward: () => number = () => {
			const current = this.items[currentIndex];
			return current ? this.unsubmittedForwardIndex(current) : -1;
		},
	): boolean {
		if (targetIndex < 0 || targetIndex >= this.items.length) return false;
		const current = this.items[currentIndex];
		const target = this.items[targetIndex];
		if (!current || !target) return false;
		if (targetIndex === currentIndex) return true;
		const mode = current.testPart.navigationMode ?? this.assessment.navigationMode ?? 'nonlinear';
		if (current.testPart === target.testPart && mode === 'nonlinear') return true;
		if (targetIndex < currentIndex) return false;
		return targetIndex === forward();
	}

	private async submitSimultaneousItems(items: readonly FlatItem[]): Promise<void> {
		// Items the backend already accepted with exactly these responses are done; one
		// whose recorded result predates the current responses still goes out.
		if (items.every((q) => !this.itemNeedsSubmission(q))) return;
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
				if (!this.itemNeedsSubmission(q)) continue;
				const submittedAt = Date.now();
				const responsesForItem = (allItemResponses?.[q.identifier] || {}) as any;
				// An item an expired limit closed (or a proctor's end of the test) submits its
				// responses as they stand. Response validation is an individual-part control
				// (QTI), and a candidate's end of the test checked those items already.
				const submissionReason = this.submissionReasonFor(q);
				const itemSession = this.endItemSessionForSubmit(
					q,
					responsesForItem,
					allItemSessions[q.identifier],
					{ validate: submissionReason === undefined && this.isIndividual(q) },
				);
				allItemSessions[q.identifier] = itemSession;
				const res = await this.backend.submitResponses({
					sessionId: this.sessionId,
					itemIdentifier: q.identifier,
					responses: responsesForItem,
					submittedAt,
					timeSpent: itemSession.duration,
					timing: this.getSubmitTimingEvidence(q, itemSession.duration, submissionReason),
					itemSession: this.sendsItemSession() ? itemSession : undefined,
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
				// The accepted response set: a retry, a later collection pass, or finalize
				// must not re-submit identical responses for this item.
				this.lastSubmittedResponses.set(q.identifier, cloneResponseRecord(responsesForItem));
				// This submission voids every earlier decision (the outcomes they were decided
				// on have moved). Only a part crossing keeps the fresh one — the decision the
				// part's last item returns is what the crossing follows — while the end of the
				// test's own collection (the same submit path, for every item) stores none: it
				// never navigates.
				this.clearKeptBranchDecisions();
				if (this.endReason === null && res.nextItemIdentifier) {
					this.keepBranchDecision(q, res.nextItemIdentifier);
				}
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
					const presentation = this.presentationFor(submittedItem);
					this.attachCurrentItemSession(
						submittedItem,
						this.getItemDefinition(submittedItem).openSession({ restore: accepted, presentation }),
						presentation,
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
					const presentation = this.presentationFor(submittedItem);
					this.attachCurrentItemSession(
						submittedItem,
						this.getItemDefinition(submittedItem).openSession({ restore: restored, presentation }),
						presentation,
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
	 *
	 * A candidate's submit is rejected while paused, and — with a coded
	 * `finalizeResponseRequired` / `finalizeResponseInvalid` naming the items
	 * (`getSubmissionBlockers()`) — while items in individual parts would be submitted
	 * against their `allowSkipping=false` / `validateResponses=true` controls.
	 *
	 * `{ force: true }` is the proctor's administrative end of the test: it runs during a
	 * pause, and neither minimum times nor the skipping/validation gates hold it back; the
	 * collected submissions carry `timing.submissionReason: 'proctor'` — except items an
	 * expired time limit closed, which go out as `time-expired` (time wins), and the end is
	 * an `expiry` end when the time had already closed the delivery. It never fails for
	 * concurrency: while a candidate's navigation or submission is in flight, it waits for
	 * that transition to settle and then ends the test (when the transition itself ended
	 * the test, it resolves with those results).
	 */
	public submit(options: { force?: boolean } = {}): Promise<AssessmentResults> {
		if (options.force === true) {
			return this.runWhenIdle(async () => {
				this.administrativeReason = 'proctor';
				try {
					return await this.endTestInternal({ administrative: true, reason: 'proctor' });
				} finally {
					this.administrativeReason = null;
				}
			});
		}
		return this.runCandidateTransition(() => this.endTestInternal({ reason: 'candidate' }));
	}

	/**
	 * Run an administrative transition exclusively as soon as the lock is free: queued
	 * behind the transition in flight (like a pause) instead of rejecting as busy. The
	 * lock is taken synchronously when the in-flight transition releases it, so no
	 * candidate action can slip in between. Rejects only when the player is destroyed.
	 */
	private runWhenIdle<T>(operation: () => Promise<T>): Promise<T> {
		if (this.destroyed) {
			return Promise.reject(new AssessmentPlayerError('navigationNotAllowed', 'The assessment player was destroyed.'));
		}
		if (!this.transitionInFlight) return this.runExclusive(operation);
		return new Promise<T>((resolve, reject) => {
			const cancel = (error: Error) => {
				off();
				reject(error);
			};
			const off = this.onBusyChange((busy) => {
				if (busy || this.transitionInFlight) return;
				off();
				this.queuedForceSubmits.delete(cancel);
				this.runWhenIdle(operation).then(resolve, reject);
			});
			this.queuedForceSubmits.add(cancel);
		});
	}

	/**
	 * Whether an expired hard limit closed the delivery: the whole test expired, or the
	 * current item sits inside an expired scope and no open question remains reachable from
	 * it (an expiry dead end). An earlier question still open in the part keeps delivery
	 * open — the expiry moves the candidate there instead — so its skipping/validation
	 * controls and minimum times keep applying. Only a closed delivery is collected as
	 * `time-expired` without them.
	 */
	private isTimeClosedDelivery(): boolean {
		if (this.assessmentExpired) return true;
		const current = this.items[this.currentItemIndex];
		return current !== undefined && this.isItemLocked(current) && this.openItemAfterClosure(current.index) < 0;
	}

	/**
	 * Why an item's submission runs: an item an expired hard limit closed submits the
	 * responses frozen at the expiry (`time-expired`) — its own scope expired, or the
	 * whole test did; a proctor's forced end of the test collects as `proctor`; a question
	 * the candidate can no longer reach although its QTI skipping/validation control would
	 * refuse it is collected as it stands (`unreachable`); everything else is a normal
	 * candidate submission.
	 */
	private submissionReasonFor(q: FlatItem): SubmitTimingEvidence['submissionReason'] {
		if (this.assessmentExpired || this.isItemLocked(q)) return 'time-expired';
		if (this.administrativeReason) return this.administrativeReason;
		if (this.unreachableCollection.has(q.identifier)) return 'unreachable';
		return undefined;
	}

	/**
	 * The one normal-end-of-test path: pending simultaneous-mode responses are submitted,
	 * the current individual-mode item is submitted if needed, then the backend finalizes
	 * (outcome processing runs, results are produced) and navigation closes. Individual-
	 * mode attempts an expired limit closed are collected as well: their responses were
	 * frozen when the time ran out. The same is true for any visited individual-mode item
	 * whose responses never reached the backend because the candidate jumped away without
	 * a forward submission (nonlinear `navigateTo`/`previous` submit nothing): it is
	 * collected through the same detached end-attempt loop instead of being finalized
	 * from NULL.
	 *
	 * A candidate-initiated end of the test first checks the QTI submission controls of
	 * individual parts: it never submits an item without a response while
	 * `allowSkipping=false`, nor an answered item whose responses fail validation while
	 * `validateResponses=true` — it rejects naming them instead, as long as the candidate
	 * can still reach them. A question in a test part already left cannot hold the end of
	 * the test: it is collected as it stands (`submissionReason: 'unreachable'`). An
	 * administrative end (a time expiry, a proctor's forced submit) collects everything as
	 * it stands; an item a skipping control held back is then recorded as skipped.
	 *
	 * `reason` records why the test ends; the outermost caller decides (a candidate's
	 * submit whose final submission branches to EXIT_TEST stays a candidate end) — except
	 * that an end collecting a delivery the time already closed (the whole test expired, or
	 * an expiry dead end left nothing open) is an `expiry` end whoever triggers it: the
	 * auto-finalize, the candidate's Submit after it failed, a proctor's force-submit.
	 *
	 * The end never navigates: it collects where the candidate stands. A branch decision
	 * its own submission returns is kept on record (`followBranch`), and a scope expiry
	 * while it runs only closes the scope — moving delivery off it waits for this end and
	 * happens only if the end does not finalize.
	 */
	private async endTestInternal(
		options: { administrative?: boolean; reason?: AssessmentEndReason } = {},
	): Promise<AssessmentResults> {
		if (this.finalized && this.finalResults) return this.finalResults;
		const outermost = this.endReason === null;
		if (outermost) this.endReason = this.isTimeClosedDelivery() ? 'expiry' : (options.reason ?? 'candidate');
		try {
			return await this.collectAndFinalize(options.administrative === true);
		} finally {
			if (outermost) {
				this.unreachableCollection = new Set();
				const heldExpiries = this.expiriesDuringEnd.splice(0);
				if (!this.finalized) {
					// A refused or failed end leaves the test running: no reason is pending,
					// and delivery now leaves the scopes that expired while it ran.
					this.endReason = null;
					for (const expiry of heldExpiries) this.leaveExpiredScope(expiry.scope, expiry.identifier);
				}
			}
		}
	}

	private async collectAndFinalize(administrative: boolean): Promise<AssessmentResults> {
		const closed = administrative || this.isTimeClosedDelivery();
		const current = this.items[this.currentItemIndex];
		if (current && !closed) {
			// A current item an expired limit closed is collected as it stands: its own and
			// its scopes' minimum times cannot hold the end of the test.
			if (!this.isItemLocked(current)) {
				this.assertMinimumTime('item', current);
				this.assertEnclosingSectionMinimumTime(current);
				this.assertMinimumTime('testPart', current);
			}
			this.assertMinimumTime('assessment', current);
		}
		if (!closed) this.assertNoSubmissionBlockers();
		// Questions the candidate can no longer reach go out as they stand, marked so the
		// backend never mistakes them for a normal candidate submission.
		if (!administrative) {
			this.unreachableCollection = new Set(
				this.getUnreachableSubmissionBlockers().map((blocker) => blocker.identifier),
			);
		}
		const isIndividual = (q: FlatItem) => this.isIndividual(q);
		// Submission modes belong to test parts. The assessment-level field is only
		// a fallback for older hosts that do not supply a mode on each part.
		await this.submitSimultaneousItems(
			this.items.filter((q) =>
				(q.testPart.submissionMode ?? this.assessment.submissionMode) === 'simultaneous',
			),
		);
		if (this.finalized && this.finalResults) return this.finalResults;
		await this.submitSimultaneousItems(
			this.items.filter(
				(q) =>
					q !== current &&
					isIndividual(q) &&
					this.navigationManager.isVisited(q.index) &&
					// Only what the backend has not accepted yet: an expired limit froze the
					// item's responses, but responses it already accepted are never re-sent
					// (that would spend another attempt and fail the end of the test).
					this.itemNeedsSubmission(q),
			),
		);
		const q = this.items[this.currentItemIndex];
		if (q && isIndividual(q)) {
			const liveStatus = this.currentItemSession?.state().lifecycleStatus;
			const liveWritable = liveStatus !== undefined && isWritableItemLifecycle(liveStatus);
			const hasResult = this.sessionCoordinator.hasItemResult(q.identifier);
			// An item without a recorded result is collected as it stands (an expired limit
			// closed it, or the candidate is leaving it open). An item with a recorded
			// result — a practice check — re-submits only when the live attempt is still
			// open, attempts remain, and the candidate changed their response.
			const needsSubmission = !hasResult
				? true
				: liveWritable
					? this.sessionCoordinator.canSubmit(q.identifier) &&
						!this.responsesUnchangedSinceSubmission(q.identifier)
					: false;
			if (needsSubmission) {
				// Collected where the candidate stands: a branch decision this submission
				// returns is kept on record, never followed (`followBranch`).
				await this.submitCurrentItemInternal();
				if (this.finalized && this.finalResults) return this.finalResults;
			}
		}

		return this.finalizeInternal();
	}

	private async finalizeInternal(): Promise<AssessmentResults> {
		if (this.finalized && this.finalResults) return this.finalResults;

		// Persist the final draft before the backend finalizes: outcome processing reads
		// the stored timing (the built-in durations), so it must see the end-of-test
		// clocks, not the last debounced autosave. Safe mid-transition (inside the
		// exclusive lock); a failed save stays non-fatal. It is the record of the ended
		// test, so every item session in it is over: a practice item reopened for attempts
		// the candidate did not use stands closed, as the backend last accepted it (the
		// collection re-sent every changed response).
		this.snapshotsCloseItemSessions = true;
		try {
			await this.autosave?.flushImmediate();
		} finally {
			this.snapshotsCloseItemSessions = false;
		}
		let finalized: FinalizeAssessmentResponse;
		try {
			finalized = await this.backend.finalizeAssessment({ sessionId: this.sessionId });
			if (!finalized.success) throw new AssessmentPlayerError('finalizeFailed', 'Finalize failed');
		} catch (error) {
			// The test goes on: the stored draft gets its open sessions back, so attempts the
			// candidate may still use survive a reload.
			await this.autosave?.flushImmediate();
			throw error;
		}

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
		// A proctor's forced end of the test may land during a pause: the session is over,
		// so the pause no longer holds anything (no pause event — the end of the test is it).
		this.paused = false;
		this.pauseReason = undefined;
		this.suspendedForPause = false;
		// The test ended through its real submission: draft autosave has nothing left to do.
		this.autosave?.stop();
		// Delivery is over: no clock keeps running, and no later expiry can fire.
		this.timeManager?.pause();
		this.timeManager?.stopTimer();
		this.testOutcomes = cloneData(finalized.outcomes ?? this.testOutcomes ?? {})!;
		this.notifyTestFeedbackChange();
		this.reportOutcomeProcessingError(finalized.outcomeProcessingError);

		const endReason: AssessmentEndReason = this.endReason ?? 'candidate';
		this.endReason = endReason;
		const results: AssessmentResults = {
			totalScore: finalized.totalScore,
			maxScore: finalized.maxScore,
			itemResults,
			completedAt: new Date(finalized.finalizedAt),
			endReason,
		};
		if (this.reportedOutcomeProcessingError) {
			results.outcomeProcessingError = this.reportedOutcomeProcessingError;
		}
		this.finalResults = results;
		// The test is over: no decision remains for delivery to follow.
		this.clearKeptBranchDecisions();
		// Every delivered item session is over, the active one included: the player's record
		// of the ended test reports each as final, never as owing a submission.
		this.closeItemSessionsForEnd();

		// Completion listeners run once the results exist, so `getResultsSummary()` (the
		// shell's completion screen), `getEndReason()` and `submit()` already report them.
		// Every ending reaches them alike — a candidate submit, a proctor's force-submit, an
		// EXIT_TEST branch, a whole-test expiry — so a shell hands the results to its host
		// from here.
		this.notifyComplete(results);
		if (this.config.onComplete) this.config.onComplete(results);
		this.config.onFinalized?.({ restored: false, results, endReason });
		return results;
	}

	/**
	 * Why the test ended in this delivery (`candidate`, `expiry`, `proctor` or `branch`);
	 * null while it runs and for a session restored already finalized.
	 */
	public getEndReason(): AssessmentEndReason | null {
		return this.finalized ? this.endReason : null;
	}

	/**
	 * The test ended: close every delivered item session in the player's record. Nothing
	 * can be submitted any more, so an item a practice check reopened for attempts the
	 * candidate did not use stands as the backend accepted it; the active item's live
	 * session is replaced by a closed one (read-only; no item change — the end never
	 * navigates).
	 */
	private closeItemSessionsForEnd(): void {
		const sessions = this.state.itemSessions;
		if (sessions) {
			this.state.itemSessions = Object.fromEntries(
				Object.entries(sessions).map(([identifier, session]) => [identifier, closedItemSession(session)]),
			);
		}
		const q = this.items[this.currentItemIndex];
		const live = this.currentItemSession;
		if (!q || !live || live.state().lifecycleStatus === 'closed') return;
		const closed = closedItemSession(live.serialize());
		this.sessionCoordinator.setItemSession(q.identifier, closed);
		const presentation = this.presentationFor(q);
		this.releaseCurrentItemSession();
		this.attachCurrentItemSession(q, this.getItemDefinition(q).openSession({ restore: closed, presentation }), presentation);
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

	/** The current item's session-control state (attempts, feedback, review, skipping, comments); null before delivery. */
	public getItemSessionInfo(): {
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
		// Comments ride the persisted snapshot (`itemComments`), so autosave runs too.
		this.notifyAutosaveActivity();
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
	// Time administration: begin gate, proctor pause, countdown state
	// ---------------------------------------------------------------------------

	/** Whether delivery has begun. False only while an opt-in begin gate holds the start screen. */
	public hasStarted(): boolean {
		return this.started;
	}

	/**
	 * Open the begin gate (`beginGate` config): enter the first — or restored — item and
	 * start every clock. The shell calls it from its Begin button. Idempotent, and a no-op
	 * without a begin gate (the player then started at creation). A proctor pause in
	 * force keeps the clocks frozen until `resume()`.
	 */
	public start(): void {
		// A test that already ended (a proctor's force-submit behind the gate) never starts.
		if (this.started || this.destroyed || this.finalized) return;
		this.started = true;
		if (!this.paused) this.timeManager?.resume();
		this.enterInitialItem();
		this.finalizeRestoredExpiryWhenRunning();
	}

	/**
	 * Proctor pause. Freezes every clock — assessment, test part, section and item; the
	 * live attempt is suspended so its QTI `duration` stops too — and rejects candidate
	 * actions with a coded `assessmentPaused` error until `resume()`. `reason` is
	 * host-supplied, candidate-facing text shown with the pause (localize it in the host).
	 * A pause requested during a navigation or submission applies once it settles; while
	 * already paused, a new reason replaces the shown one. No-op after the test ended.
	 */
	public pause(reason?: string): void {
		if (this.finalized || this.destroyed) return;
		const nextReason = reason?.trim() || undefined;
		if (this.paused) {
			if (nextReason !== this.pauseReason) {
				this.pauseReason = nextReason;
				this.notifyPauseChange();
			}
			return;
		}
		if (this.transitionInFlight) {
			const off = this.onBusyChange((busy) => {
				if (busy) return;
				off();
				this.pause(reason);
			});
			return;
		}
		this.paused = true;
		this.pauseReason = nextReason;
		this.timeManager?.pause();
		this.suspendLiveSessionForPause();
		this.notifyPauseChange();
	}

	/** End a proctor pause: the clocks continue and the live attempt reopens where it stood. */
	public resume(): void {
		if (!this.paused || this.destroyed) return;
		this.paused = false;
		this.pauseReason = undefined;
		if (this.started && !this.finalized) {
			this.timeManager?.resume();
			this.reopenLiveSessionAfterPause();
		}
		this.notifyPauseChange();
		this.finalizeRestoredExpiryWhenRunning();
	}

	public isPaused(): boolean {
		return this.paused;
	}

	/** The candidate-facing reason given for the current pause, if any. */
	public getPauseReason(): string | undefined {
		return this.paused ? this.pauseReason : undefined;
	}

	/** The countdown a shell shows: the active scope's nearest hard maximum and the clock state. */
	public getTimeState(): AssessmentTimeState {
		const nearest = this.timeManager?.getNearestLimit() ?? null;
		return {
			limited: nearest !== null,
			remainingSeconds: nearest ? Math.max(0, Math.ceil(nearest.remainingSeconds)) : null,
			elapsedSeconds: this.getElapsedTime(),
			expired: nearest !== null && nearest.remainingSeconds <= 0,
			scope: nearest?.scope ?? null,
			allowLateSubmission: nearest?.allowLateSubmission ?? false,
			paused: this.paused,
			started: this.started,
		};
	}

	/**
	 * Whether the session is terminal: the test has ended here, or the backend restored a
	 * session it had already finalized. Shells show their completed view; `submit()`
	 * returns the stored results without another backend round trip.
	 */
	public isFinalized(): boolean {
		return this.finalized;
	}

	/** The stored results of a session restored already finalized. */
	private finalResultsFromInit(init: InitSessionResponse): AssessmentResults {
		const summary = init.finalResults;
		const itemScores = summary?.itemScores ?? {};
		const itemResults: ItemResult[] = Object.values(itemScores).map((r) => ({
			itemIdentifier: r.itemIdentifier,
			score: r.score,
			maxScore: r.maxScore,
			responses: (this.state.itemResponses[r.itemIdentifier] ?? {}) as Record<string, unknown>,
		}));
		return {
			totalScore: summary?.totalScore ?? 0,
			maxScore: summary?.maxScore ?? 0,
			itemResults,
			completedAt: new Date(summary?.finalizedAt ?? Date.now()),
		};
	}

	/**
	 * What a start screen shows before delivery begins: the test title, the time the
	 * candidate has for the whole test (PNP extended time applied; what remains of it for
	 * a resumed session), whether parts, sections or items carry their own limits, and the
	 * first test part's rubric blocks (role-filter them before display).
	 */
	public getStartInfo(): AssessmentStartInfo {
		const extended = this.config.pnp?.content?.extendedTime;
		const limited = (limits?: TimeLimits) =>
			limits?.maxTime !== undefined && extendTimeLimit(limits.maxTime, extended) !== undefined;
		const testRemaining = this.timeManager?.getAssessmentRemainingSeconds() ?? null;
		const firstPart = this.items[0]?.testPart ?? this.assessment.testParts?.[0];
		return {
			title: this.getAssessmentTitle(),
			testTimeLimitSeconds: testRemaining === null ? undefined : Math.max(0, Math.ceil(testRemaining)),
			hasScopedTimeLimits: this.items.some(
				(q) =>
					limited(q.testPart.timeLimits) ||
					q.sections.some((section) => limited(section.timeLimits)) ||
					limited(q.item.timeLimits),
			),
			rubricBlocks: (firstPart?.rubricBlocks ?? []).map((block) => ({ ...block, view: [...block.view] })),
			totalItems: this.items.length,
			resuming: (this.state.timing?.totalTime ?? 0) > 0 || this.state.visitedItems.length > 0,
			savedAt: this.getRestoredSavedAt(),
		};
	}

	/** Whether the candidate hid the countdown. Persisted in the session state, like flags. */
	public isTimerHidden(): boolean {
		return this.state.timerHidden === true;
	}

	public setTimerHidden(hidden: boolean): void {
		this.state.timerHidden = hidden;
		// The preference rides the persisted snapshot, like flags.
		this.notifyAutosaveActivity();
	}

	// ---------------------------------------------------------------------------
	// Event subscriptions
	// ---------------------------------------------------------------------------

	public onItemChange(listener: (index: number, total: number) => void): () => void {
		return this.events.on('itemChange', listener);
	}

	public onSectionChange(listener: (index: number, total: number) => void): () => void {
		return this.events.on('sectionChange', listener);
	}

	public onResponseChange(listener: (responses: Record<string, unknown>) => void): () => void {
		return this.events.on('responseChange', listener);
	}

	/**
	 * The test ended in this delivery — by any path: a candidate submit, a proctor's
	 * force-submit, a QTI EXIT_TEST branch, a whole-test expiry — with its results.
	 */
	public onComplete(listener: (results: AssessmentResults) => void): () => void {
		return this.events.on('complete', listener);
	}

	/** Fires when a navigation/submission transition starts or ends (`getNavigationState().isLoading` mirrors this). */
	public onBusyChange(listener: (busy: boolean) => void): () => void {
		return this.events.on('busyChange', listener);
	}

	/** Called when `getVisibleFeedback()` may have changed: new outcomes, a new test part, or the end. */
	public onTestFeedbackChange(listener: () => void): () => void {
		return this.events.on('testFeedbackChange', listener);
	}

	public onTimeWarning(listener: (remainingSeconds: number) => void): () => void {
		return this.events.on('timeWarning', listener);
	}

	/**
	 * A hard time limit ran out with no late submission: the whole test (the core then
	 * finalizes automatically; the event follows with `autoFinalized`, or with
	 * `submissionRequired` when finalization failed), or a scope whose expiry leaves nothing
	 * unlocked (`submissionRequired`: the candidate must submit now).
	 */
	public onTimeExpired(listener: (event: AssessmentTimeExpiryEvent) => void): () => void {
		return this.events.on('timeExpired', listener);
	}

	/** A test part, section or item limit expired: its items closed, delivery moved on if it could. */
	public onScopeTimeExpired(listener: (event: ScopeTimeExpiryEvent) => void): () => void {
		return this.events.on('scopeTimeExpired', listener);
	}

	/** Fires when a proctor pause starts (with its reason) or ends. */
	public onPauseChange(listener: (paused: boolean, reason?: string) => void): () => void {
		return this.events.on('pauseChange', listener);
	}

	public onTimeTick(listener: (remainingSeconds: number, elapsedSeconds: number) => void): () => void {
		return this.events.on('timeTick', listener);
	}

	public destroy(): void {
		this.destroyed = true;
		// A force-submit still queued behind a transition can no longer run.
		for (const cancel of [...this.queuedForceSubmits]) {
			cancel(new AssessmentPlayerError('navigationNotAllowed', 'The assessment player was destroyed.'));
		}
		this.queuedForceSubmits.clear();
		this.autosave?.stop();
		this.timeManager?.destroy();
		this.releaseCurrentItemSession();
		this.lastItemFeedback = null;
		this.clearKeptBranchDecisions();
		this.itemDefinitions.clear();
		this.events.clear();
		this.reviewInfoCache.clear();
	}

	// ---------------------------------------------------------------------------
	// Internal notify helpers
	// ---------------------------------------------------------------------------

	private notifyItemChange(): void {
		this.events.emit('itemChange', this.currentItemIndex, this.items.length);
		this.config.onItemChange?.(this.currentItemIndex, this.items.length);
		// A navigation settles into a new draft worth persisting.
		this.notifyAutosaveActivity();
	}

	private notifySectionChange(): void {
		const q = this.items[this.currentItemIndex];
		const sectionIndex = q?.sectionIndex ?? -1;
		const totalSections = this.presentedSectionList().length;
		this.events.emit('sectionChange', sectionIndex, totalSections);
		this.config.onSectionChange?.(sectionIndex, totalSections);
	}

	private notifyResponseChange(): void {
		const responses = this.sessionCoordinator.getActiveResponses();
		this.events.emit('responseChange', responses);
		this.config.onResponseChange?.(responses);
		// Candidate input happened: restart the autosave debounce.
		this.notifyAutosaveActivity();
	}

	private notifyComplete(results: AssessmentResults): void {
		this.events.emit('complete', results);
	}

	private notifyBusyChange(busy: boolean): void {
		this.events.emit('busyChange', busy);
	}

	private notifyTestFeedbackChange(): void {
		this.events.emit('testFeedbackChange');
	}

	private notifyTimeWarning(remainingSeconds: number): void {
		this.events.emit('timeWarning', remainingSeconds);
	}

	private notifyPauseChange(): void {
		const reason = this.pauseReason;
		this.events.emit('pauseChange', this.paused, reason);
		this.config.onPauseChange?.(this.paused, reason);
		// The pause rides the snapshot (`timing.isPaused`), so persist it too.
		this.notifyAutosaveActivity();
	}

	/**
	 * The template defaults an item's new session starts from (QTI `templateDefault`).
	 * In a nonlinear test part they are evaluated once, at the start of the part, for
	 * every item ref in it — with the test outcomes and the other items' variables
	 * (`ITEM.VARIABLE`, as persisted so far; NULL for an item not instantiated yet) in
	 * scope — and cached for the part. Linear parts evaluate each item's defaults on
	 * entering it, against the test outcomes.
	 */
	private templateDefaultsFor(q: FlatItem): Record<string, unknown> | undefined {
		const mode = q.testPart.navigationMode ?? this.assessment.navigationMode ?? 'nonlinear';
		if (mode !== 'nonlinear') {
			if (!q.item.templateDefaults?.length) return undefined;
			return this.evaluateTemplateDefaults(q, testOutcomeDeclarations(this.assessment, this.testOutcomes ?? undefined));
		}
		let defaults = this.templateDefaultsByPart.get(q.testPart.identifier);
		if (!defaults) {
			const declarations = addItemVariableDeclarations(
				testOutcomeDeclarations(this.assessment, this.testOutcomes ?? undefined),
				this.persistedItemVariables(),
			);
			defaults = new Map(
				this.items
					.filter((item) => item.testPart === q.testPart)
					.map((item) => [item.identifier, this.evaluateTemplateDefaults(item, declarations)]),
			);
			this.templateDefaultsByPart.set(q.testPart.identifier, defaults);
		}
		return defaults.get(q.identifier);
	}

	/** Every item's variables from its persisted session, as test-scope expressions read them. */
	private persistedItemVariables(): Record<string, Record<string, QtiValue>> {
		const out: Record<string, Record<string, QtiValue>> = {};
		for (const item of this.items) {
			const serialized = this.state.itemSessions?.[item.identifier];
			if (!serialized) continue;
			out[item.identifier] = applyVariableMappings(itemSessionVariableValues(serialized), item.item.variableMappings);
		}
		return out;
	}

	private evaluateTemplateDefaults(q: FlatItem, declarations: DeclarationMap): Record<string, unknown> | undefined {
		const defaults = q.item.templateDefaults;
		if (!defaults?.length) return undefined;
		const out: Record<string, unknown> = {};
		for (const { templateIdentifier, expressionXml } of defaults) {
			out[templateIdentifier] = plainQtiValue(evaluateTestExpression(expressionXml, declarations, Math.random));
		}
		return out;
	}

	private isItemLocked(q: FlatItem): boolean {
		// A whole-test expiry closes every item: the collection of the test is all that remains.
		if (this.assessmentExpired) return true;
		return (
			this.lockedScopes.has(`item:${q.identifier}`) ||
			this.lockedScopes.has(`testPart:${q.testPart.identifier}`) ||
			q.sections.some((section) => this.lockedScopes.has(`section:${section.identifier}`))
		);
	}

	/** The expired scope that closes an item (outermost first); the assessment for a whole-test expiry. */
	private lockingScopeOf(q: FlatItem | undefined): Pick<AssessmentTimeExpiryEvent, 'scope' | 'identifier'> {
		if (this.assessmentExpired || !q) return { scope: 'assessment' };
		if (this.lockedScopes.has(`testPart:${q.testPart.identifier}`)) {
			return { scope: 'testPart', identifier: q.testPart.identifier };
		}
		for (const section of q.sections) {
			if (this.lockedScopes.has(`section:${section.identifier}`)) {
				return { scope: 'section', identifier: section.identifier };
			}
		}
		return { scope: 'item', identifier: q.identifier };
	}

	/**
	 * Nothing open remains (a restore, or a start over, landed on an expired scope with
	 * no open item after it): the candidate must submit now — the same report the live
	 * expiry dead end makes, so the shell offers Submit wherever the candidate is.
	 */
	private notifyExpiryDeadEnd(): void {
		if (this.finalized || this.destroyed) return;
		const scope = this.lockingScopeOf(this.items[this.currentItemIndex]);
		this.notifyTimeExpired({ ...scope, autoFinalized: false, submissionRequired: true });
	}

	private nextUnlockedIndex(fromIndex: number): number {
		for (let i = fromIndex + 1; i < this.items.length; i++) {
			if (!this.isItemLocked(this.items[i]!)) return i;
		}
		return -1;
	}

	/**
	 * Whether delivery may land on the item after a closure: no expired limit closed it and
	 * the review policy lets the candidate be there (QTI `allowReview` once its attempts are
	 * used up). Later parts are entered fresh, so only the time lock applies to them.
	 */
	private isOpenTarget(q: FlatItem): boolean {
		return !this.isItemLocked(q) && this.canReviewItem(q);
	}

	/**
	 * Where delivery goes when the item at `fromIndex` closes (a scope expiry, or a restore
	 * that lands on a closed item), looking across the whole reachable delivery rather than
	 * only forward: the next open item of its test part; else — in a nonlinear part — the
	 * nearest open item before it; else the first open item of a later part (parts are
	 * delivered in order, so earlier parts are never re-entered, and a part is left only
	 * when nothing in it is open any more). Forward, only items the delivery rules reach
	 * count: a part (or, in a linear part, a section or item) whose precondition fails is
	 * skipped as on any forward step. -1 when nothing open remains: the expiry dead end,
	 * where the candidate's way out is the submission.
	 */
	private openItemAfterClosure(fromIndex: number): number {
		const from = this.items[fromIndex];
		if (!from) return -1;
		const decls = this.hasDeliveryRules ? this.navigationDeclarationsFor(from) : undefined;
		for (const i of this.eligibleIndexesAfter(fromIndex, decls)) {
			const q = this.items[i]!;
			if (q.testPart !== from.testPart) break;
			if (this.isOpenTarget(q)) return i;
		}
		const mode = from.testPart.navigationMode ?? this.assessment.navigationMode ?? 'nonlinear';
		if (mode === 'nonlinear') {
			for (let i = fromIndex - 1; i >= 0; i--) {
				const q = this.items[i]!;
				if (q.testPart !== from.testPart) break;
				if (this.isOpenTarget(q)) return i;
			}
		}
		for (const i of this.eligibleIndexesAfter(fromIndex, decls)) {
			const q = this.items[i]!;
			if (q.testPart !== from.testPart && !this.isItemLocked(q)) return i;
		}
		return -1;
	}

	/**
	 * A test part, section or item without late submission ran out of time: its items close for the
	 * candidate, and delivery moves to the next open item — forward in the part, else an open
	 * question earlier in a nonlinear part, else the next part. Only when nothing open
	 * remains anywhere reachable is it the expiry dead end.
	 *
	 * The end of the test never navigates: while one runs, the expiry only closes the scope
	 * (the collection takes its items as they stand, `time-expired`). Leaving it — the move
	 * and its report — waits for that end, and is moot once the end finalized.
	 */
	private handleScopeExpired(scope: 'testPart' | 'section' | 'item', identifier: string): void {
		this.lockedScopes.add(`${scope}:${identifier}`);
		if (this.endReason !== null) {
			this.expiriesDuringEnd.push({ scope, identifier });
			return;
		}
		this.leaveExpiredScope(scope, identifier);
	}

	/** Close an expired scope for the candidate: move delivery off it, or report the dead end. */
	private leaveExpiredScope(scope: 'testPart' | 'section' | 'item', identifier: string): void {
		const current = this.items[this.currentItemIndex];
		if (!current || !this.isItemLocked(current)) {
			// Delivery is already outside the expired scope; the shell still learns it closed.
			this.notifyScopeTimeExpired(scope, identifier, true);
			return;
		}
		this.saveCurrentItemSession();
		this.notifyItemChange();
		const nextIndex = this.openItemAfterClosure(this.currentItemIndex);
		if (nextIndex < 0) {
			// Nothing unlocked remains: the candidate must submit now (a later expiry of
			// another already-covered scope reports through its own scope event).
			this.notifyTimeExpired({
				scope,
				identifier,
				autoFinalized: false,
				submissionRequired: true,
			});
			this.notifyScopeTimeExpired(scope, identifier, false);
			return;
		}
		this.notifyScopeTimeExpired(scope, identifier, true, nextIndex);
		this.pendingEntryIndex = nextIndex;
		this.performNavigateTo(nextIndex, { restoring: true }).catch((error) => {
			// The expiry's hop failed: the shell's typed failure screen (localized, with
			// Retry) replaces the "moving on" flow instead of a silently stuck delivery.
			this.recordEntryFailure(error);
		});
	}

	/**
	 * The whole-test hard limit expired without late submission (TimeManager calls this
	 * only for that case): finalize like a submit so pending responses are collected and
	 * outcomes computed, then report the expiry. If finalization fails, the session stays
	 * open and the shell offers the Submit action.
	 */
	private handleAssessmentTimeExpired(): void {
		this.assessmentExpired = true;
		if (this.finalized) {
			this.notifyTimeExpired({ scope: 'assessment', autoFinalized: false, submissionRequired: false });
			return;
		}
		void this.autoFinalizeForTimeExpiry(0);
	}

	private autoFinalizeForTimeExpiry(attempt: number): void {
		if (this.destroyed || this.finalized) return;
		void this.runExclusive(() => this.endTestInternal({ reason: 'expiry' }))
			.then(() => {
				if (this.destroyed || !this.finalized) return;
				this.notifyTimeExpired({ scope: 'assessment', autoFinalized: true, submissionRequired: false });
			})
			.catch((error) => {
				if (
					!this.destroyed &&
					!this.finalized &&
					isAssessmentPlayerError(error) &&
					error.code === 'navigationInFlight' &&
					attempt < 4
				) {
					// A candidate transition owns the lock; retry once it settles.
					const off = this.onBusyChange((busy) => {
						if (busy) return;
						off();
						this.autoFinalizeForTimeExpiry(attempt + 1);
					});
					return;
				}
				// Finalization failed: the shell's expiry notice with a Submit action and the
				// host's error surface keep the candidate unstuck and the host informed.
				this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
				this.notifyTimeExpired({ scope: 'assessment', autoFinalized: false, submissionRequired: true });
			});
	}

	private notifyTimeExpired(event: AssessmentTimeExpiryEvent): void {
		this.events.emit('timeExpired', event);
		this.config.onTimeExpired?.(event);
	}

	private notifyScopeTimeExpired(
		scope: ScopeTimeExpiryEvent['scope'],
		identifier: string,
		deliveryContinues: boolean,
		nextIndex?: number,
	): void {
		const event: ScopeTimeExpiryEvent = {
			scope,
			identifier,
			deliveryContinues,
			...(nextIndex === undefined ? {} : { nextIndex }),
		};
		this.events.emit('scopeTimeExpired', event);
		this.config.onScopeTimeExpired?.(event);
	}

	private notifyTimeTick(remainingSeconds: number, elapsedSeconds: number): void {
		this.events.emit('timeTick', remainingSeconds, elapsedSeconds);
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
