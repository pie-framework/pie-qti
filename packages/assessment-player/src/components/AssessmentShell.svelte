<script lang="ts">
	import { flushSync, onDestroy, onMount, tick, getContext } from 'svelte';
	import { DefaultI18nProvider, interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	import { applyPnpToSurface, clearPnpSurface, type PnpProfile } from '@pie-qti/item-player';
	import { sanitizeHtml } from '@pie-qti/item-player/security';
	import { normalizeQtiSharedContext } from '@pie-qti/assessment-toolkit';
	import { withDisplaySettings, type QtiCandidateDisplaySettings } from '@pie-qti/section-player';
	import type { QtiSharedHtmlBlock } from '@pie-qti/section-player';
	import {
		PlayerBaseStyles,
		RubricDisplay,
		SectionPlayerSplitPane,
		SectionPlayerVertical,
		TestFeedback as SectionTestFeedback,
	} from '../../../section-player/src/components/index.js';
	import type { BackendAssessmentPlayerConfig } from '../core/AssessmentPlayer.js';
	import { AssessmentPlayer } from '../core/AssessmentPlayer.js';
	import type { AutosaveState } from '../core/AutosaveManager.js';
	import { assessmentErrorDisplay, isAssessmentPlayerError } from '../core/errors.js';
	import { TimeManager } from '../core/TimeManager.js';
	import type { ReviewGroup } from './ReviewScreen.svelte';
	import type { BackendAdapter, InitSessionRequest } from '../integration/api-contract.js';
	import { toSectionComposition } from '../integration/toSectionComposition.js';
	import type {
		AssessmentResults,
		CandidateSectionView,
		CheckAnswerState,
		ItemFeedbackEntry,
		NavigationState,
		ResultsSummary,
		VisibleTestFeedback,
	} from '../types/index.js';
	import AccessibilityAnnouncer from './AccessibilityAnnouncer.svelte';
	import AssessmentDialog from './AssessmentDialog.svelte';
	import AssessmentHeader from './AssessmentHeader.svelte';
	import AssessmentTimer from './AssessmentTimer.svelte';
	import CompletionScreen from './CompletionScreen.svelte';
	import NavigationBar from './NavigationBar.svelte';
	import ReviewScreen from './ReviewScreen.svelte';

	interface Props {
		backend: BackendAdapter;
		initSession: InitSessionRequest;
		config?: Partial<BackendAssessmentPlayerConfig>;
		/**
		 * Called after a successful submit (with results).
		 * Note: `config.onComplete` is invoked by `AssessmentPlayer.submit()` already.
		 */
		onSubmit?: (results: AssessmentResults) => void;
		/** Math typesetting function (KaTeX, MathJax, etc.) */
		typeset?: (root: HTMLElement) => void | Promise<void>;
		/**
		 * Own the whole viewport: `100dvh` tall, clear of notches and home indicators
		 * (needs `viewport-fit=cover`), with page-level `header`/`main`/`nav`
		 * landmarks. Off by default: the shell fills its host container.
		 */
		fullViewport?: boolean;
		/**
		 * Heading level of the assessment title, so the shell fits the host page
		 * outline; passage and item titles follow one level below. Default 2, or 1
		 * in full-viewport mode.
		 */
		headingLevel?: number;
		/**
		 * Opt-in begin gate: show an accessible start screen (title, the time the
		 * candidate has, test instructions) and only start the clocks and delivery
		 * when the candidate activates Begin. Off by default: delivery starts at
		 * session creation, as before.
		 */
		beginGate?: boolean;
		/**
		 * Autosave of the candidate's draft through the backend's `saveState`, with a
		 * save indicator and a resume prompt on reload. Default ON when the backend
		 * reports the save capability; set `false` for hosts that persist state
		 * themselves (the indicator stays hidden).
		 */
		autosave?: boolean;
		/** Autosave debounce window in ms. Default 1500. */
		autosaveIntervalMs?: number;
		/**
		 * Host opt-in: after finalization the built-in completion screen may add a
		 * per-question results summary (answered state plus the backend's scores).
		 * Off by default so high-stakes deliveries show no scores; `onSubmit` always
		 * receives the full results either way.
		 */
		showResultsSummary?: boolean;
		/**
		 * Whether the resume prompt offers "Start over" (deleting the saved draft). Default
		 * true. Hosts that never let a candidate discard saved work set false: a restored
		 * draft then simply continues, announced, without a prompt.
		 */
		allowStartOver?: boolean;
	}

	const {
		backend,
		initSession,
		config = {},
		onSubmit,
		typeset,
		fullViewport = false,
		headingLevel,
		beginGate = false,
		autosave,
		autosaveIntervalMs,
		showResultsSummary = false,
		allowStartOver = true,
	}: Props = $props();

	// Get i18n from context (set by +layout.svelte)
	const contextI18nWrapper = getContext<{ value: I18nProvider | null } | undefined>('i18n');
	const contextI18n = $derived(contextI18nWrapper?.value ?? undefined);
	const fallbackI18n = new DefaultI18nProvider();
	const i18n = $derived(config.i18nProvider ?? contextI18n ?? fallbackI18n);
	// The shell is chrome: it takes the interface locale, and the passages and
	// items inside set their own from their content language.
	const interfaceAttributes = $derived(interfaceLocaleAttributes(i18n));
	// The core and cached item definitions retain one provider reference, while a
	// host may finish loading its actual provider after this shell mounts. Resolve
	// methods against the current provider and preserve their receiver.
	const playerI18n: I18nProvider = new Proxy(fallbackI18n, {
		get(_target, key) {
			const provider = i18n;
			const value = Reflect.get(provider, key, provider);
			return typeof value === 'function' ? value.bind(provider) : value;
		},
	});

	/**
	 * Candidate-safe error rendering: coded core errors resolve to localized
	 * `assessment.errors.codes.*` messages; anything else (raw backend errors included)
	 * renders a generic localized message plus a short support code. Backend error text
	 * is never shown verbatim.
	 */
	function localizeError(err: unknown): { message: string; supportCode: string | null } {
		const display = assessmentErrorDisplay(err);
		const message = i18n.t(display.i18nKey, localizeItemList(display.params));
		return {
			message,
			supportCode: isAssessmentPlayerError(err) ? null : display.supportCode,
		};
	}

	/**
	 * A refused end of the test names question numbers (`items`: "1, 3"): render them as
	 * a localized list in the interface locale ("1 and 3", "1 et 3", "1、3").
	 */
	function localizeItemList(params: Record<string, string | number>): Record<string, string | number> {
		if (typeof params.items !== 'string') return params;
		const numbers = params.items
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => i18n.formatNumber?.(Number(part)) ?? part);
		let list = numbers.join(', ');
		// Intl.ListFormat (ES2021) is not in every lib target this compiles against.
		const ListFormat = (
			Intl as unknown as {
				ListFormat?: new (locale: string, options: { type: 'conjunction' }) => { format(items: string[]): string };
			}
		).ListFormat;
		try {
			if (ListFormat) list = new ListFormat(i18n.getLocale(), { type: 'conjunction' }).format(numbers);
		} catch {
			// An unsupported locale keeps the plain comma list.
		}
		return { ...params, items: list };
	}

	/** The coded refusals of a candidate's end of the test that name the items to fix. */
	function isSubmissionBlocked(err: unknown): boolean {
		return (
			isAssessmentPlayerError(err) &&
			(err.code === 'finalizeResponseRequired' || err.code === 'finalizeResponseInvalid')
		);
	}

	/**
	 * A failed submission reassures the candidate that nothing was lost. Uncoded failures
	 * (the backend rejected or the network dropped) get the localized submit-failure message
	 * plus a support code rather than the generic one; backend text is still never shown.
	 */
	function localizeSubmitError(err: unknown): { message: string; supportCode: string | null } {
		if (isAssessmentPlayerError(err)) return localizeError(err);
		return {
			message: i18n.t('assessment.errors.codes.submitFailed'),
			supportCode: assessmentErrorDisplay(err).supportCode,
		};
	}

	const uid = $props.id();
	const titleId = `${uid}-title`;
	const contentId = `${uid}-content`;

	/** Svelte action: run the host's math typesetting over a mounted content node. */
	function typesetNode(node: HTMLElement) {
		if (!typeset) return;
		void Promise.resolve(typeset(node)).catch(() => {});
	}

	let player = $state<AssessmentPlayer | null>(null);
	let navState = $state<NavigationState>({
		currentIndex: -1,
		totalItems: 0,
		canNext: false,
		canPrevious: false,
		isLoading: false,
		currentSection: undefined,
		totalSections: undefined,
	});
	let currentItem = $state<any>(null);
	let currentRubricBlocks = $state<any[]>([]);
	let sections = $state<CandidateSectionView[]>([]);
	let error = $state<{ message: string; supportCode: string | null } | null>(null);
	let navError = $state<{ message: string; supportCode: string | null } | null>(null);
	let submitError = $state<{ message: string; supportCode: string | null } | null>(null);
	let isSubmitting = $state(false);
	let retryButton = $state<HTMLButtonElement | null>(null);
	let contentEl = $state<HTMLElement | null>(null);
	let itemPaneEl = $state<HTMLElement | null>(null);
	let splitLayout = $state<SectionPlayerSplitPane | null>(null);
	let verticalLayout = $state<SectionPlayerVertical | null>(null);
	let testFeedback = $state<VisibleTestFeedback[]>([]);
	let isComplete = $state(false);
	let hasFirstItem = $state(false);
	let announcer = $state<AccessibilityAnnouncer | null>(null);
	/**
	 * Two version counters keep response updates targeted (O(item), not O(assessment)):
	 * `responseVersion` ticks on candidate input and drives the answered counts; the
	 * section composition — the whole section view — rebuilds only when the item,
	 * section or delivery state actually changes (`compositionVersion`). The active
	 * item renders from its live session object, which the composition carries by
	 * reference, so keystrokes never need a rebuild.
	 */
	let responseVersion = $state(0);
	let compositionVersion = $state(0);
	let stateVersion = $state(0);
	/** Loading is taking long: a polite status, never a permanent error on its own. */
	let stillLoading = $state(false);
	let initializing = $state(false);
	// Review screen + flag toggle
	let reviewOpen = $state(false);
	let reviewScreen = $state<ReviewScreen | null>(null);
	// Submit confirmation (WCAG 3.3.4: submitting the test is irreversible, so it is
	// confirmed, with the unanswered and flagged questions named before the candidate
	// commits) and the cannot-return warning for leaving a test part.
	let submitDialogOpen = $state(false);
	let leavePartDialogOpen = $state(false);
	// Time administration: countdown state, begin gate, proctor pause, expiry notices.
	let timerLimited = $state(false);
	let timerHidden = $state(false);
	let paused = $state(false);
	let pauseReason = $state<string | undefined>(undefined);
	/** The begin gate holds delivery: the core was created without starting it. */
	let startPending = $state(false);
	let startHeadingEl = $state<HTMLElement | null>(null);
	let pauseHeadingEl = $state<HTMLElement | null>(null);
	let pauseOverlayEl = $state<HTMLElement | null>(null);
	/** Where focus was when a pause began; it returns there on resume. */
	let focusBeforePause: HTMLElement | null = null;
	/**
	 * Expiry notices. `scope`: a part/section/question limit expired and delivery moved
	 * on (acknowledge only). `submit`: the whole test expired (or an expiry dead end
	 * left no reachable item) — the dialog carries the Submit action so the candidate is
	 * never stranded, whatever item they are on.
	 */
	let expiryDialog = $state<{
		mode: 'scope' | 'submit';
		scope: 'assessment' | 'testPart' | 'section' | 'item';
	} | null>(null);
	let expiryDialogOpen = $state(false);
	/** An expiry left no reachable item; Submit must be offered wherever the candidate is. */
	let submitRequired = $state(false);
	// Autosave: the save indicator rides the core's real save state.
	let saveStatus = $state<AutosaveState>({ status: 'idle' });
	/** A backend snapshot carried prior activity: the shell offers Resume / Start over. */
	let resumeDialogOpen = $state(false);
	/**
	 * A proctor pause closed the resume prompt before the candidate answered it: it
	 * returns when the pause lifts, if the draft is still there.
	 */
	let resumePromptDeferredByPause = $state(false);
	/** Deleting the saved draft is irreversible: confirmed before `startOver()` runs. */
	let startOverConfirmOpen = $state(false);
	let startOverBusy = $state(false);
	// Candidate display settings (PNP): the section layouts own the settings tool and
	// report changes; the shell root is a PNP surface so the profile also covers the
	// header, navigation and timer chrome around the item.
	let shellRootEl = $state<HTMLElement | null>(null);
	let candidateDisplaySettings = $state<QtiCandidateDisplaySettings>({});
	// Practice delivery: the item-level check control, the feedback it surfaces, and
	// the candidate's comment for the test team (QTI allowComment).
	let checkAnswer = $state<CheckAnswerState | null>(null);
	let allowComment = $state(false);
	let commentDraft = $state('');
	/** Item feedback from a check-answer (or a submit-on-move), shown in a dialog. */
	let feedbackEntries = $state<ItemFeedbackEntry[]>([]);
	let feedbackDialogOpen = $state(false);
	// Completion: the candidate-facing finished state replaces the dead last item.
	/** The whole-test limit auto-submitted: the completion heading says so. */
	let finishedByExpiry = $state(false);
	/** The session was restored already finalized: the terminal "already submitted" view. */
	let restoredFinalized = $state(false);
	let resultsSummary = $state<ResultsSummary | null>(null);
	let completionScreen = $state<CompletionScreen | null>(null);

	const sectionComposition = $derived.by(() => {
		compositionVersion;
		stateVersion;
		return player ? toSectionComposition(player, config) : null;
	});
	/** The PNP profile the shell chrome renders with: the host profile with the candidate's display settings applied. */
	const shellPnp = $derived<PnpProfile>(withDisplaySettings(config.pnp, candidateDisplaySettings));
	const hasSplitPane = $derived(sectionComposition?.layout === 'split-pane');
	const sectionRole = $derived(config.role ?? 'candidate');
	const titleHeadingLevel = $derived(Math.min(5, Math.max(1, Math.round(headingLevel ?? (fullViewport ? 1 : 2)))));
	const testFeedbackBlocks = $derived<QtiSharedHtmlBlock[]>(
		testFeedback.map((item) => ({
			identifier: item.key,
			kind: 'test-feedback',
			scope: item.testPartIdentifier ? 'testPart' : 'assessment',
			rawHtml: item.content,
		}))
	);
	// The assessmentTest `title`, else a localized generic title — never the identifier.
	const assessmentTitle = $derived(player?.getAssessmentTitle() ?? i18n.t('assessment.title', 'Assessment'));

	// The begin gate: the start screen holds until the candidate activates Begin.
	const awaitingBegin = $derived(player !== null && startPending);

	/** The start screen's content: title, the time the candidate has, test instructions. */
	const startInfo = $derived.by(() => {
		if (!player) return null;
		return player.getStartInfo();
	});
	const startBlocks = $derived.by(() => {
		const role = config.role ?? 'candidate';
		return normalizeQtiSharedContext({ rubricBlocks: startInfo?.rubricBlocks ?? [], role });
	});
	const startTimeLine = $derived.by(() => {
		const seconds = startInfo?.testTimeLimitSeconds;
		if (seconds === undefined) return null;
		const minutes = seconds / 60;
		const format = (value: number, options?: Intl.NumberFormatOptions) =>
			i18n.formatNumber?.(value, options) ?? String(value);
		if (Number.isInteger(minutes) && minutes > 0) {
			return minutes === 1
				? i18n.t('assessment.start.timeMinutesOne', 'You have 1 minute.')
				: i18n.t('assessment.start.timeMinutes', 'You have {count} minutes.', { count: minutes });
		}
		return i18n.t('assessment.start.timeExact', 'You have {time}.', { time: TimeManager.formatTime(seconds, (value, opts) => format(value, opts)) });
	});

	// Review data: recomputed when the item, its responses or flags change. The core
	// helpers are the single source of answered/flag/jump-legality truth.
	const reviewData = $derived.by(() => {
		responseVersion;
		stateVersion;
		navState.currentIndex;
		isComplete;
		if (!player || navState.currentIndex < 0) return null;
		const items = player.getReviewItems();
		const sectionGroups: ReviewGroup[] = player.getAllSections().map((section) => ({
			id: section.id,
			index: section.index,
			title: section.title,
			navigable: section.navigable,
			items: [],
		}));
		const groupById = new Map(sectionGroups.map((group) => [group.id as string, group]));
		const sectionless: ReviewGroup = { id: null, index: -1, navigable: false, items: [] };
		for (const item of items) {
			const group = item.sectionId !== null ? groupById.get(item.sectionId) : undefined;
			(group ?? sectionless).items.push(item);
		}
		const groups = sectionGroups.filter((group) => group.items.length > 0);
		if (sectionless.items.length > 0) groups.push(sectionless);
		return {
			groups,
			answeredCount: player.getAnsweredItemCount(),
			totalItems: items.length,
			flaggedCount: items.filter((item) => item.flagged).length,
		};
	});
	const currentFlagged = $derived.by(() => {
		stateVersion;
		return player ? player.isItemFlagged() : false;
	});
	// The section menu lists every candidate-visible section with its live answered
	// count; only legal jump targets are enabled inside the menu. Derived from the
	// review data so a keystroke computes the item statuses once, not twice.
	const headerSections = $derived.by(() => {
		navState.currentSection?.id;
		if (!reviewData) return [];
		return reviewData.groups
			.filter((group) => group.id !== null)
			.map((group) => {
				const members = reviewData.groups
					.filter((candidate) => candidate.id === group.id)
					.flatMap((candidate) => candidate.items);
				return {
					id: group.id as string,
					title: group.title,
					index: group.index,
					navigable: group.navigable,
					answered: members.filter((item) => item.status !== 'unanswered').length,
					total: members.length,
					isCurrent: navState.currentSection?.id === group.id,
				};
			});
	});

	// Initialize the player; `retryInitialize()` runs this again after a load failure.
	// A slow load is a polite status ("still loading"), never a permanent error: if the
	// backend recovers later, the shell proceeds on its own.
	let stillLoadingTimer: ReturnType<typeof setTimeout> | null = null;

	function clearStillLoadingTimer() {
		if (stillLoadingTimer) {
			clearTimeout(stillLoadingTimer);
			stillLoadingTimer = null;
		}
	}

	function armStillLoadingTimer() {
		clearStillLoadingTimer();
		// Behind a begin gate the start screen is the expected view, not a slow load.
		stillLoadingTimer = setTimeout(() => {
			stillLoadingTimer = null;
			if (!hasFirstItem && !error && !startPending) {
				stillLoading = true;
			}
		}, 10000);
	}

	onMount(() => {
		void initialize();

		return () => {
			clearStillLoadingTimer();
			teardownPlayer();
		};
	});

	function teardownPlayer() {
		const current = player;
		player = null;
		current?.destroy();
	}

	async function initialize() {
		if (initializing) return;
		initializing = true;
		error = null;
		stillLoading = false;
		armStillLoadingTimer();

		const hostOnError = config.onError;
		const playerConfig: BackendAssessmentPlayerConfig = {
			backend,
			initSession,
			showSections: config.showSections !== false,
			allowSectionNavigation: config.allowSectionNavigation !== false,
			showProgress: config.showProgress !== false,
			...config,
			// The shell prop and the core option open the same gate.
			beginGate: beginGate || config.beginGate === true,
			i18nProvider: playerI18n,
			// The shell props and the core options tune the same autosave.
			...(autosave === undefined ? {} : { autosave }),
			...(autosaveIntervalMs === undefined ? {} : { autosaveIntervalMs }),
			// The host's error hook stays; a failed item entry (the first item, or an
			// expiry hop) additionally routes to the shell's typed failure screen instead
			// of an eternal bare loading state.
			onError: (err) => {
				hostOnError?.(err);
				if (player?.hasEntryFailure() && !isComplete) {
					// Assign once per distinct message: a retry that fails with the same
					// error must not recreate the alert (and churn its focus).
					const message = localizeError(err);
					if (!error || error.message !== message.message) {
						error = message;
						stillLoading = false;
						clearStillLoadingTimer();
						announcer?.announce(message.message, 3000, 'assertive');
					}
				}
			},
		};

		try {
			const created = await AssessmentPlayer.create(playerConfig);
			startPending = !created.hasStarted();
			player = created;

			// A snapshot saved during a proctor pause reopens paused: no `onPauseChange`
			// fired (the shell had no listener yet), so the overlay state syncs from the
			// core here. The resume prompt below stays suppressed while it holds.
			if (created.isPaused()) {
				paused = true;
				pauseReason = created.getPauseReason();
			}

			// A session the backend stored as finalized is terminal: show the
			// already-submitted completion view instead of delivery whose every action
			// rejects, and never offer the resume prompt for it.
			if (created.isFinalized()) {
				restoredFinalized = true;
				isComplete = true;
				testFeedback = created.getVisibleFeedback();
				resultsSummary = created.getResultsSummary();
				sections = created.getAllSections();
				announcer?.announce(
					i18n.t('assessment.complete.alreadySubmitted', 'This test was already submitted.'),
					4000,
					'assertive',
				);
				return;
			}

			// Get sections
			sections = player.getAllSections();

			// An item entry that already failed during creation (the first item could not
			// be entered) routes here: the typed failure screen replaces the bare loading
			// state. Later entry failures (an expiry hop) report through onError.
			if (created.hasEntryFailure()) {
				error = localizeError(created.getEntryError()!);
				stillLoading = false;
				clearStillLoadingTimer();
				announcer?.announce(error.message, 3000, 'assertive');
				return;
			}

			// Set up event listeners
			player.onItemChange(async () => {
				updateState();
				navError = null;
				hasFirstItem = true;
				stillLoading = false;
				clearStillLoadingTimer();
				// The comment disclosure follows the active item's own comment.
				commentDraft = player?.getItemComment() ?? '';
				await tick();
				// A new item starts at its top, whichever region scrolls.
				contentEl?.scrollTo?.({ top: 0, behavior: 'auto' });
				itemPaneEl?.scrollTo?.({ top: 0, behavior: 'auto' });
			});

			player.onSectionChange(() => {
				updateState();
			});

			player.onTestFeedbackChange(() => {
				if (player) testFeedback = player.getVisibleFeedback();
			});

			player.onResponseChange(() => {
				// Targeted update: only the answered counts recompute; the section view
				// renders from the live session and needs no rebuild per keystroke.
				responseVersion += 1;
			});

			player.onBusyChange(() => {
				updateState();
			});

			player.onFlagChange(() => {
				// Flag state lives in the core session state; re-render whatever shows it.
				stateVersion += 1;
			});

			player.onAutosaveChange((state) => {
				saveStatus = state;
			});

			// Terminal branching (QTI EXIT_TEST) and the whole-test time expiry finalize the
			// core like a normal submit; the shell shows the same completed state.
			player.onComplete(() => {
				isComplete = true;
				submitRequired = false;
				// A proctor's forced submit can end the test during a pause: the completion
				// view replaces the overlay too.
				paused = false;
				pauseReason = undefined;
				sections = player?.getAllSections() ?? [];
				// The completion view replaces delivery: nothing modal may survive it.
				submitDialogOpen = false;
				leavePartDialogOpen = false;
				expiryDialog = null;
				expiryDialogOpen = false;
				reviewOpen = false;
				feedbackDialogOpen = false;
				resultsSummary = player?.getResultsSummary() ?? null;
				updateState();
			});

			// A hard time limit ran out: the core auto-finalizes a whole-test expiry; a
			// scope dead end leaves the candidate to submit from wherever they are.
			player.onTimeExpired((event) => {
				updateState();
				if (event.autoFinalized) {
					// The completed view arrives through onComplete; say why it happened, and
					// hand the results to the host like a Submit (submit() returns them now).
					finishedByExpiry = true;
					announcer?.announce(i18n.t('assessment.timeExpiry.autoSubmitted'), 4000, 'assertive');
					submitDialogOpen = false;
					leavePartDialogOpen = false;
					expiryDialogOpen = false;
					expiryDialog = null;
					reviewOpen = false;
					void player
						?.submit()
						.then((results) => {
							if (results) onSubmit?.(results);
						})
						.catch(() => {});
					return;
				}
				if (event.submissionRequired) {
					submitRequired = true;
					expiryDialog = { mode: 'submit', scope: event.scope };
					expiryDialogOpen = true;
				}
			});

			// A part, section or question limit expired: its items closed and delivery
			// moved on (or hit the dead end handled above).
			player.onScopeTimeExpired((event) => {
				updateState();
				if (!event.deliveryContinues) return;
				expiryDialog = { mode: 'scope', scope: event.scope };
				expiryDialogOpen = true;
			});

			// A proctor pause freezes the clocks and blocks the shell; the overlay says so.
			player.onPauseChange((isPaused, reason) => {
				const wasPaused = paused;
				paused = isPaused;
				pauseReason = reason;
				if (isPaused) {
					if (!wasPaused) {
						const active = document.activeElement;
						focusBeforePause = active instanceof HTMLElement && active !== document.body ? active : null;
						// No dialog survives a pause: a candidate must never answer or submit
						// underneath one. The resume prompt returns when the pause lifts.
						closeDialogsForPause();
					}
					const message = reason
						? i18n.t('assessment.pause.withReason', 'The assessment is paused: {reason}', { reason })
						: i18n.t('assessment.pause.announcement', 'The assessment is paused.');
					announcer?.announce(message, 4000, 'assertive');
					void tick().then(() => pauseHeadingEl?.focus());
				} else {
					announcer?.announce(i18n.t('assessment.pause.resumed', 'The assessment is running again.'), 3000, 'assertive');
					// Focus returns where it was, or to the question when that element is gone.
					const target = focusBeforePause;
					focusBeforePause = null;
					void tick().then(async () => {
						updateState();
						await tick();
						if (target?.isConnected && !target.closest('[inert]')) target.focus();
						else await manageFocusAfterNavigation();
					});
					// A resume prompt the pause interrupted returns once delivery continues.
					if (resumePromptDeferredByPause) {
						resumePromptDeferredByPause = false;
						if (!isComplete && allowStartOver && player?.hasRestoredProgress()) resumeDialogOpen = true;
					}
				}
			});

			// If backend did not restore a current item, start at index 0 — unless the
			// begin gate holds, in which case start() enters it.
			if (!startPending && player.getNavigationState().currentIndex < 0) {
				await player.navigateTo(0);
			} else {
				updateState();
				if (!startPending) {
					hasFirstItem = true;
					stillLoading = false;
					clearStillLoadingTimer();
				}
			}

			// A restored snapshot with prior activity is a resume: ask the candidate
			// whether to continue or start over. A restored-paused session stays behind
			// the pause overlay (a proctor resumes it) — the prompt is deferred there and
			// returns when the pause lifts; a begin gate already says "Continue" on its
			// start screen. Without Start over (the `allowStartOver` prop) there is no
			// choice to offer: the restored draft simply continues, announced.
			if (!startPending && player.hasRestoredProgress()) {
				if (!allowStartOver) {
					announcer?.announce(
						i18n.t('assessment.resume.resumedAnnouncement', 'Your saved answers were restored.'),
						3000,
						'polite',
					);
				} else if (paused) resumePromptDeferredByPause = true;
				else resumeDialogOpen = true;
			}

			// The restored pause was never observed as a change: announce it like a live
			// one. Focus lands on the overlay heading through the pause effect below (or
			// stays on the start screen, which shows the pause behind a begin gate).
			if (paused) {
				announcer?.announce(
					pauseReason
						? i18n.t('assessment.pause.withReason', 'The assessment is paused: {reason}', { reason: pauseReason })
						: i18n.t('assessment.pause.announcement', 'The assessment is paused.'),
					4000,
					'assertive',
				);
			}
		} catch (err) {
			console.error('Failed to initialize assessment player:', err);
			error = localizeError(err);
			announcer?.announce(error.message, 3000, 'assertive');
			// The failure alert is announced; focus lands on its Retry control (the
			// error-focus effect below).
		} finally {
			initializing = false;
			clearStillLoadingTimer();
		}
	}

	/**
	 * Retry a failure. A failed item entry (the first item, or an expiry hop) retries
	 * just that entry in the live session; a failed load tears the half-created player
	 * down and initializes again. On another failure the alert is re-announced and
	 * focus returns to Retry.
	 */
	async function handleRetryInitialize() {
		if (initializing) return;
		if (player?.hasEntryFailure()) {
			initializing = true;
			error = null;
			try {
				await player.retryEntry();
				navError = null;
				hasFirstItem = true;
				stillLoading = false;
				updateState();
				await manageFocusAfterNavigation();
				announceCurrentQuestion();
			} catch (err) {
				// The failure is already on screen: the core reported it through onError
				// (the entry-failure mapping above), which owns the error state.
				if (!isBusyRejection(err)) console.error('Retrying the failed item entry:', err);
			} finally {
				initializing = false;
			}
			return;
		}
		teardownPlayer();
		hasFirstItem = false;
		stillLoading = false;
		await initialize();
	}

	$effect(() => {
		// The start screen lands focus on its heading, like a dialog.
		if (awaitingBegin) {
			void tick().then(() => startHeadingEl?.focus());
		}
	});

	$effect(() => {
		// The completion view replaces delivery: focus moves to its heading so screen
		// readers hear "You have finished the test" (or the time-expired variant).
		const screen = completionScreen;
		if (!isComplete || !screen) return;
		void tick().then(() => screen.focusHeading());
	});

	$effect(() => {
		// The pause overlay — live or restored — holds focus like a dialog: the shell
		// beneath is inert, so focus must not linger outside it.
		if (!paused) return;
		void tick().then(() => pauseHeadingEl?.focus());
	});

	$effect(() => {
		// A failure alert carries the recovery control: once the alert renders and the
		// retry settles (a retry failure remounts it enabled), focus lands on Retry.
		if (!error || initializing) return;
		void tick().then(() => retryButton?.focus());
	});

	function updateState() {
		if (!player) return;

		navState = player.getNavigationState();
		currentItem = player.getCurrentItem();
		currentRubricBlocks = player.getCurrentRubricBlocks();
		testFeedback = player.getVisibleFeedback();
		timerLimited = player.getTimeState().limited;
		timerHidden = player.isTimerHidden();
		// Practice delivery (check answer + attempts) and QTI allowComment both follow
		// the active item's resolved session control.
		checkAnswer = player.getCheckAnswerState();
		allowComment = player.getItemSessionInfo()?.canComment === true;
		stateVersion += 1;
	}

	/**
	 * A proctor pause closes every dialog — submit confirmation, expiry notice, feedback,
	 * resume prompt, start-over confirmation, and the dialogs the section layouts and
	 * interactions own (display settings…), which would otherwise stay in the top layer
	 * above the pause card and keep the pause imperceptible: a candidate must never
	 * answer or submit underneath a pause (WCAG). Transient UI outside any dialog (the
	 * math editor, glossary popups) closes on the `pie-qti-close-transient-ui` event.
	 * The chrome wrapper's `inert` hard-disables whatever remains. The unanswered resume
	 * prompt is remembered and returns when the pause lifts.
	 */
	function closeDialogsForPause(): void {
		if (resumeDialogOpen) {
			resumeDialogOpen = false;
			resumePromptDeferredByPause = true;
		}
		submitDialogOpen = false;
		leavePartDialogOpen = false;
		feedbackDialogOpen = false;
		startOverConfirmOpen = false;
		expiryDialogOpen = false;
		expiryDialog = null;
		// Apply the shell's own closes (and the pause's inert wrapper) before looking for
		// the dialogs it does not own.
		flushShell();
		closeOwnedElsewhereDialogs();
		document.dispatchEvent(new CustomEvent('pie-qti-close-transient-ui', { detail: { reason: 'pause' } }));
	}

	/** Apply pending state to the DOM now (a no-op when Svelte is already flushing). */
	function flushShell(): void {
		try {
			flushSync();
		} catch {
			// Called while Svelte flushes: the DOM follows on its own.
		}
	}

	/**
	 * Close every dialog still open inside the shell. Each owner hears the native close
	 * request first (`cancel`, as Escape sends it) so it closes and syncs itself; one that
	 * ignores it is closed directly, which its own `close` handler observes.
	 */
	function closeOwnedElsewhereDialogs(): void {
		const root = shellRootEl;
		if (!root) return;
		const open = Array.from(root.querySelectorAll<HTMLDialogElement>('dialog[open]'));
		if (open.length === 0) return;
		for (const dialog of open) dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
		flushShell();
		for (const dialog of open) {
			if (!dialog.hasAttribute('open')) continue;
			if (typeof dialog.close === 'function') dialog.close();
			else dialog.removeAttribute('open');
		}
	}

	/**
	 * While a proctor pause holds, the inert chrome and the overlay leave one focus
	 * target inside the shell: the overlay heading. Focus that lands on covered shell
	 * content returns there. Containment is scoped to the shell: the host page around an
	 * embedded player (its help, a proctor chat) stays operable, and Tab moves on to it.
	 */
	function handlePauseFocusContainment(event: FocusEvent) {
		if (!paused || !pauseHeadingEl || !shellRootEl) return;
		const target = event.target;
		if (!(target instanceof Node) || !target.isConnected) return;
		if (!shellRootEl.contains(target) || pauseOverlayEl?.contains(target)) return;
		pauseHeadingEl.focus();
	}

	/** In-flight transitions reject further navigation; the busy UI already covers them. */
	function isBusyRejection(err: unknown): boolean {
		return isAssessmentPlayerError(err) && err.code === 'navigationInFlight';
	}

	async function handlePrevious() {
		if (!player || isSubmitting || isComplete) return;
		try {
			navError = null;
			await player.previous();
			await manageFocusAfterNavigation();
			announceCurrentQuestion();
		} catch (err) {
			if (isBusyRejection(err)) return;
			console.error('Previous navigation failed:', err);
			navError = localizeError(err);
		}
	}

	async function doNext() {
		if (!player || isSubmitting || isComplete) return;
		try {
			navError = null;
			await player.next();
			await manageFocusAfterNavigation();
			announceCurrentQuestion();
			// Submit-on-move feedback (`showFeedback` with a single attempt): the item was
			// scored as the candidate moved on — show what it produced before work continues.
			showCapturedItemFeedback({ focusQuestionOnClose: true });
		} catch (err) {
			if (isBusyRejection(err)) return;
			console.error('Next navigation failed:', err);
			navError = localizeError(err);
		}
	}

	/**
	 * Open the captured item feedback dialog, if the last item-level submission produced
	 * any. Used after a check-answer (the candidate stayed on the item) and after a
	 * submit-on-move next() (the feedback rides the transition). Closing clears the
	 * capture, so it never re-appears uninvited.
	 */
	function showCapturedItemFeedback({ focusQuestionOnClose = false } = {}): void {
		if (!player || feedbackDialogOpen || isComplete) return;
		const feedback = player.getLastItemFeedback();
		if (!feedback || feedback.feedback.length === 0) return;
		feedbackEntries = feedback.feedback;
		feedbackFocusQuestionOnClose = focusQuestionOnClose;
		feedbackDialogOpen = true;
		player.clearLastItemFeedback();
	}

	/** After a submit-on-move the trigger (Next) belongs to the previous item: land on the question. */
	let feedbackFocusQuestionOnClose = false;

	function handleFeedbackDialogClose() {
		feedbackDialogOpen = false;
		feedbackEntries = [];
		// A check-answer returns focus to the check control (the dialog restores it); a
		// submit-on-move lands on the new question instead.
		if (feedbackFocusQuestionOnClose) {
			feedbackFocusQuestionOnClose = false;
			void manageFocusAfterNavigation();
		}
	}

	/**
	 * Practice flow: submit the current item through the normal per-item path and stay
	 * on it. The item player's body then renders the item's integrated feedback from the
	 * computed outcomes, and any modal feedback opens here; the attempts counter beside
	 * the check control reads the new state.
	 */
	async function handleCheckAnswer() {
		if (!player || isSubmitting || isComplete) return;
		try {
			navError = null;
			await player.checkCurrentItem();
			updateState();
			showCapturedItemFeedback();
			if (!feedbackDialogOpen) {
				announcer?.announce(i18n.t('assessment.checkAnswer.submittedAnnouncement'), 3000);
			}
		} catch (err) {
			if (isBusyRejection(err)) return;
			console.error('Check answer failed:', err);
			navError = localizeError(err);
		}
	}

	// ---------------------------------------------------------------------------
	// Candidate comments (QTI allowComment)
	// ---------------------------------------------------------------------------

	/** Persist the comment into the session state (snapshot + next submission payload). */
	function saveComment() {
		if (!player || !allowComment) return;
		try {
			player.setItemComment(commentDraft);
		} catch (err) {
			// The control only renders when comments are allowed; guard anyway.
			console.error('Saving the comment failed:', err);
		}
	}

	/**
	 * Next is routed through a "you cannot return" confirmation when it would leave the
	 * current test part: QTI parts are delivered in sequence and cannot be re-entered.
	 */
	async function handleNext() {
		if (!player || isSubmitting || isComplete) return;
		const info = player.getForwardTransitionInfo();
		if (info.leavesTestPart && info.nextIndex !== null) {
			navError = null;
			leavePartDialogOpen = true;
			return;
		}
		await doNext();
	}

	async function handleLeavePartConfirm() {
		leavePartDialogOpen = false;
		await doNext();
	}

	/**
	 * Announce current question to screen readers
	 */
	function announceCurrentQuestion() {
		if (!player) return;
		const state = player.getNavigationState();
		const msg = i18n?.t('assessment.questionAnnouncement', {
			current: state.currentIndex + 1,
			total: state.totalItems
		}) ?? `assessment.questionAnnouncement (${state.currentIndex + 1}/${state.totalItems})`;
		announcer?.announce(msg, 1500);
	}

	async function handleSectionSelect(sectionIndex: number) {
		if (!player || isSubmitting || isComplete) return;
		const section = headerSections.find((candidate) => candidate.index === sectionIndex);
		if (!section) return;
		try {
			await player.navigateToSection(section.id);
			await manageFocusAfterNavigation();
		} catch (err) {
			if (isBusyRejection(err)) return;
			console.error('Section navigation failed:', err);
			navError = localizeError(err);
		}
	}

	/**
	 * Focus the active question through its section layout — which first selects the
	 * question tab when passage and question share a narrow viewport — falling back to
	 * the content region. A crashed question shows the boundary's fallback instead: its
	 * recovery control is the focus target, so focus never drops to the body or to the
	 * empty content region.
	 */
	async function focusQuestion(): Promise<void> {
		await tick(); // Wait for DOM updates
		const fallbackRetry = contentEl?.querySelector<HTMLElement>('[data-testid="assessment-content-retry"]');
		if (fallbackRetry) {
			fallbackRetry.focus();
			return;
		}
		const layout = hasSplitPane ? splitLayout : verticalLayout;
		if ((await layout?.focusActiveItem()) === true) return;
		contentEl?.focus();
	}

	/**
	 * Manage focus after navigation so screen reader users are aware of the content change.
	 */
	async function manageFocusAfterNavigation() {
		// A pause holds focus on its overlay; the inert content cannot take it.
		if (paused) return;
		await focusQuestion();
	}

	function handleSkipToQuestion(event: MouseEvent) {
		// The question is focused in place; the host page's URL and router stay untouched.
		event.preventDefault();
		void focusQuestion();
	}

	// ---------------------------------------------------------------------------
	// Review screen + item palette
	// ---------------------------------------------------------------------------

	async function toggleReview() {
		if (!player || isComplete || reviewData === null) return;
		if (reviewOpen) {
			reviewOpen = false;
			await focusQuestion();
			return;
		}
		reviewOpen = true;
		await tick();
		reviewScreen?.focusTitle();
	}

	/** Jump from the review palette (or the submit dialog) to an item, then focus it. */
	async function jumpToItem(index: number, { closePanel = true } = {}) {
		if (!player || isComplete) return;
		try {
			await player.navigateTo(index);
			if (closePanel && reviewOpen) reviewOpen = false;
			await manageFocusAfterNavigation();
			announceCurrentQuestion();
		} catch (err) {
			if (isBusyRejection(err)) return;
			console.error('Jump navigation failed:', err);
			navError = localizeError(err);
		}
	}

	async function handleReviewJump(index: number) {
		await jumpToItem(index);
	}

	// ---------------------------------------------------------------------------
	// Flag for review
	// ---------------------------------------------------------------------------

	function handleToggleFlag() {
		if (!player || isSubmitting || isComplete) return;
		player.toggleItemFlag();
		const flagged = player.isItemFlagged();
		const message = flagged
			? i18n.t('assessment.flag.flaggedAnnouncement', { number: navState.currentIndex + 1 })
			: i18n.t('assessment.flag.unflaggedAnnouncement', { number: navState.currentIndex + 1 });
		announcer?.announce(message, 1500);
	}

	// ---------------------------------------------------------------------------
	// Time administration: begin gate, timer visibility, expiry notices
	// ---------------------------------------------------------------------------

	/** The core enters the first item asynchronously; wait for it like the shell's boot. */
	async function waitForFirstItem(timeoutMs = 5000): Promise<boolean> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if ((player?.getNavigationState().currentIndex ?? -1) >= 0) return true;
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
		return false;
	}

	/**
	 * Open the begin gate: start the clocks and enter the first item, then focus and
	 * announce it like a navigation. Also the imperative `start()` export. Held while a
	 * proctor pause is in force: the start screen says so until the pause lifts.
	 */
	async function handleBegin() {
		if (!player || !startPending || isComplete || paused) return;
		startPending = false;
		player.start();
		await waitForFirstItem();
		updateState();
		await manageFocusAfterNavigation();
		announceCurrentQuestion();
	}

	/** The candidate's hide/show choice rides the session state, like flags. */
	function handleToggleTimerHidden(hidden: boolean) {
		if (!player) return;
		player.setTimerHidden(hidden);
		timerHidden = hidden;
	}

	// ---------------------------------------------------------------------------
	// Autosave: save indicator, page-lifecycle flush, resume / start over
	// ---------------------------------------------------------------------------

	/**
	 * The indicator's localized text from the real save state. `pending` (activity in
	 * the debounce window) and `saving` both read as "Saving…"; a failure stays "Not
	 * saved" until the next change retries it.
	 */
	const saveLabel = $derived.by(() => {
		if (!player?.isAutosaveEnabled()) return null;
		switch (saveStatus.status) {
			case 'pending':
			case 'saving':
				return i18n.t('assessment.autosave.saving', 'Saving…');
			case 'saved': {
				const time = saveStatus.lastSavedAt !== undefined
					? formatClockTime(new Date(saveStatus.lastSavedAt))
					: null;
				return time
					? i18n.t('assessment.autosave.saved', 'Saved · {time}', { time })
					: i18n.t('assessment.autosave.savedShort', 'Saved');
			}
			case 'failed':
				return i18n.t('assessment.autosave.notSaved', 'Not saved');
			default:
				return null;
		}
	});

	function formatClockTime(date: Date): string {
		const formatted = i18n.formatDate?.(date, { hour: '2-digit', minute: '2-digit' });
		if (formatted) return formatted;
		return new Intl.DateTimeFormat(i18n.getLocale(), { hour: '2-digit', minute: '2-digit' }).format(date);
	}

	/** The restored draft's save time for the resume prompt, in the interface locale. */
	const resumeSavedAtLine = $derived.by(() => {
		const savedAt = player?.getRestoredSavedAt();
		if (!savedAt) {
			return i18n.t('assessment.resume.descriptionNoTime', 'You have saved answers from a previous session.');
		}
		const formatted = i18n.formatDate?.(new Date(savedAt), {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}) ?? new Intl.DateTimeFormat(i18n.getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(savedAt));
		return i18n.t('assessment.resume.description', 'You have answers saved from {time}.', { time: formatted });
	});

	/** The candidate keeps their saved draft: close the prompt and continue. */
	function handleResume() {
		resumeDialogOpen = false;
		announcer?.announce(
			i18n.t('assessment.resume.resumedAnnouncement', 'Your saved answers were restored.'),
			3000,
			'assertive',
		);
	}

	/** "Start over" chosen: the irreversible deletion is confirmed before it runs. */
	function handleStartOverRequested() {
		resumeDialogOpen = false;
		if (!allowStartOver) return;
		startOverConfirmOpen = true;
	}

	function handleStartOverCancelled() {
		startOverConfirmOpen = false;
		resumeDialogOpen = true;
	}

	async function handleStartOverConfirmed() {
		if (!player || startOverBusy) return;
		// The confirmation stays open (busy) while the restart runs; it closes after.
		startOverBusy = true;
		try {
			await player.startOver();
			navError = null;
			sections = player.getAllSections();
			updateState();
			startOverConfirmOpen = false;
			announcer?.announce(
				i18n.t('assessment.resume.restartedAnnouncement', 'The test was restarted from the beginning.'),
				4000,
				'assertive',
			);
			await tick();
			await manageFocusAfterNavigation();
			announceCurrentQuestion();
		} catch (err) {
			startOverConfirmOpen = false;
			if (isBusyRejection(err)) {
				resumeDialogOpen = true;
				return;
			}
			console.error('Start over failed:', err);
			navError = localizeError(err);
			announcer?.announce(navError.message, 3000, 'assertive');
		} finally {
			startOverBusy = false;
		}
	}

	// ---------------------------------------------------------------------------
	// Content boundaries: a crashing question never takes the test down
	// ---------------------------------------------------------------------------

	/**
	 * A component inside the question content crashed (a broken interaction, a
	 * malformed passage). The boundary's fallback tells the candidate in plain
	 * language and keeps Previous/Next working, so they can move on where navigation
	 * rules allow; the raw error goes to the console and the host only.
	 */
	function handleContentCrash(error: unknown, reset: () => void) {
		console.error('Question content failed to render:', error);
		config.onError?.(error instanceof Error ? error : new Error(String(error)));
		// Remember the reset so the fallback's actions can recover the subtree.
		contentBoundaryReset = reset;
		announcer?.announce(i18n.t('assessment.itemError.title', 'This question could not be displayed.'), 4000, 'assertive');
		// Focus follows the announcement to the fallback's recovery control; without it,
		// focus silently drops to the page body.
		void tick().then(() => {
			contentEl?.querySelector<HTMLElement>('[data-testid="assessment-content-retry"]')?.focus();
		});
	}

	let contentBoundaryReset: (() => void) | null = null;

	/** Whether "Continue" can move past a crashed question (navigation rules still apply). */
	const canContinueAfterCrash = $derived(
		!isComplete && !paused && navState.canNext && navState.currentIndex >= 0,
	);

	async function handleContentFallbackRetry(reset: () => void) {
		contentBoundaryReset = null;
		reset();
		await tick();
		await focusQuestion();
	}

	async function handleContentFallbackContinue(reset: () => void) {
		contentBoundaryReset = null;
		reset();
		await doNext();
	}

	/**
	 * A dialog body crashed (a broken summary, a malformed notice). The shell stays
	 * usable: the fallback explains and closes the crashed dialog instead of blanking
	 * the page behind a broken modal.
	 */
	function handleDialogCrash(error: unknown, reset: () => void) {
		console.error('Assessment dialog failed to render:', error);
		config.onError?.(error instanceof Error ? error : new Error(String(error)));
		dialogBoundaryReset = reset;
	}

	let dialogBoundaryReset: (() => void) | null = null;

	function handleDialogFallbackDismiss(reset: () => void) {
		submitDialogOpen = false;
		leavePartDialogOpen = false;
		expiryDialog = null;
		expiryDialogOpen = false;
		dialogBoundaryReset = null;
		reset();
	}

	// ---------------------------------------------------------------------------
	// PNP surface: the shell chrome follows the candidate's display settings
	// ---------------------------------------------------------------------------

	/**
	 * The section layouts repaint their own surface when the candidate changes their
	 * display settings; the shell root is a separate PNP surface so the header,
	 * navigation bar and timer follow too (nested inverting filters are neutralized
	 * by the surface mechanism, and nothing outside the shell changes).
	 */
	function handleDisplaySettingsChange(event: { settings: QtiCandidateDisplaySettings }) {
		candidateDisplaySettings = event.settings;
	}

	$effect(() => {
		const root = shellRootEl;
		if (!root) return;
		const pnp = shellPnp;
		applyPnpToSurface(root, pnp);
		return () => clearPnpSurface(root);
	});

	async function handleExpiryConfirm() {
		const mode = expiryDialog?.mode;
		if (mode === 'submit') {
			// The dialog carries the Submit action: an expired test ends here (or shows
			// the retry alert when the backend refused). A busy rejection — another
			// transition owns the lock — keeps the dialog open in its busy state instead
			// of closing silently, so Submit stays reachable once it settles.
			const succeeded = await performSubmit();
			if (!succeeded && !submitError) {
				expiryDialogOpen = true;
				return;
			}
			expiryDialogOpen = false;
			return;
		}
		expiryDialogOpen = false;
		// Delivery already moved on: focus and announce the new question like a navigation.
		await manageFocusAfterNavigation();
		announceCurrentQuestion();
	}

	function handleExpiryClose() {
		expiryDialog = null;
		expiryDialogOpen = false;
	}

	// ---------------------------------------------------------------------------
	// Submit: confirmation first (WCAG 3.3.4), then the irreversible core transition
	// ---------------------------------------------------------------------------

	interface SubmitDialogItem {
		number: number;
		index: number;
		jumpAllowed: boolean;
	}

	let submitSummary = $state<{
		answeredCount: number;
		total: number;
		flaggedCount: number;
		unanswered: SubmitDialogItem[];
		/**
		 * Items the end of the test would refuse to submit (QTI allowSkipping=false with no
		 * answer, validateResponses=true with an incomplete answer): Submit stays
		 * unavailable until they are answered.
		 */
		needsAnswer: SubmitDialogItem[];
	} | null>(null);

	const submitTranslations = $derived.by(() => {
		const t = (key: string, fallback: string, values?: Record<string, string | number>) =>
			i18n?.t(key, fallback, values) ?? fallback;
		return {
			dialogTitle: t('assessment.submit.dialogTitle', 'Submit your test?'),
			dialogDescription: t('assessment.submit.dialogDescription', 'You cannot change your answers after you submit.'),
			answeredLine:
				submitSummary === null
					? ''
					: t('assessment.navigation.answeredCount', '{answered} of {total} answered', {
						answered: submitSummary.answeredCount,
						total: submitSummary.total,
					}),
			flaggedLine:
				submitSummary && submitSummary.flaggedCount > 0
					? t('assessment.submit.flaggedLine', '{count} questions are flagged for review', {
						count: submitSummary.flaggedCount,
					})
					: null,
			needsAnswerHeading:
				submitSummary && submitSummary.needsAnswer.length > 0
					? submitSummary.needsAnswer.length === 1
						? t('assessment.submit.needsAnswerHeadingOne', '1 question needs an answer before you can submit')
						: t('assessment.submit.needsAnswerHeading', '{count} questions need an answer before you can submit', {
							count: submitSummary.needsAnswer.length,
						})
					: null,
			unansweredHeading:
				submitSummary && submitSummary.unanswered.length > 0
					? submitSummary.unanswered.length === 1
						? t('assessment.submit.unansweredHeadingOne', '1 question is not answered')
						: t('assessment.submit.unansweredHeading', '{count} questions are not answered', {
							count: submitSummary.unanswered.length,
						})
					: null,
			allAnswered: t('assessment.submit.allAnswered', 'You have answered all the questions.'),
			confirm: t('assessment.submit.confirm', 'Submit test'),
			cancel: t('assessment.submit.cancel', 'Keep working'),
			reviewAction: t('assessment.review.open', 'Review questions'),
		};
	});

	/** Submit stays unavailable while the end of the test would refuse held-back items. */
	const submitBlocked = $derived((submitSummary?.needsAnswer.length ?? 0) > 0);

	function openSubmitDialog() {
		if (!player || isSubmitting || isComplete) return;
		const items = player.getReviewItems();
		const blockers = player.getSubmissionBlockers();
		const blocked = new Set(blockers.map((blocker) => blocker.index));
		submitSummary = {
			answeredCount: player.getAnsweredItemCount(),
			total: items.length,
			flaggedCount: items.filter((item) => item.flagged).length,
			needsAnswer: blockers.map((blocker) => ({
				number: blocker.number,
				index: blocker.index,
				jumpAllowed: blocker.jumpAllowed,
			})),
			unanswered: items
				.filter((item) => item.status === 'unanswered' && !blocked.has(item.index))
				.map((item) => ({ number: item.number, index: item.index, jumpAllowed: item.jumpAllowed })),
		};
		navError = null;
		submitDialogOpen = true;
	}

	/**
	 * The real terminal transition, shared by the confirmation dialog and the imperative
	 * API. Returns false when the submission failed (the shell then shows the alert and
	 * moves focus to the retry control); true once the test has ended. A refusal that
	 * names questions still needing an answer is not a failure to retry: it shows as a
	 * warning naming them, with no "Try again".
	 */
	async function performSubmit(): Promise<boolean> {
		if (!player || isSubmitting || isComplete) return false;

		submitError = null;
		isSubmitting = true;
		let results: AssessmentResults;
		try {
			results = await player.submit();
		} catch (err) {
			if (isSubmissionBlocked(err)) {
				navError = localizeError(err);
				announcer?.announce(navError.message, 4000, 'assertive');
				updateState();
			} else if (!isBusyRejection(err)) {
				console.error('Failed to submit assessment:', err);
				submitError = localizeSubmitError(err);
				// Keep the shell and its session available after the core restores a
				// failed submission. Already accepted responses are retained for retry.
				updateState();
			}
			return false;
		} finally {
			isSubmitting = false;
		}

		testFeedback = player.getVisibleFeedback();
		sections = player.getAllSections();
		isComplete = true;
		onSubmit?.(results);
		return true;
	}

	async function handleDialogSubmit() {
		if (submitBlocked) return;
		const succeeded = await performSubmit();
		// Close whether it worked or not: on failure the alert and the retry control
		// must be reachable, and they sit behind the modal otherwise.
		submitDialogOpen = false;
		if (!succeeded) {
			await tick();
			retryButton?.focus();
		}
	}

	async function handleDialogReview() {
		submitDialogOpen = false;
		if (reviewData === null) return;
		reviewOpen = true;
		await tick();
		reviewScreen?.focusTitle();
	}

	async function handleDialogJump(index: number) {
		submitDialogOpen = false;
		await jumpToItem(index);
	}

	/**
	 * Imperative API (useful for embedding in host frameworks / custom elements)
	 */
	export async function next() {
		return player?.next();
	}

	export async function previous() {
		return player?.previous();
	}

	export async function navigateTo(index: number) {
		return player?.navigateTo(index);
	}

	export async function navigateToSection(sectionIdentifier: string) {
		return player?.navigateToSection(sectionIdentifier);
	}

	/**
	 * End the test. `{ force: true }` is the proctor's administrative submit: it runs
	 * during a pause and is not held back by minimum times or the skipping/validation
	 * controls (a candidate's submit stays blocked while paused).
	 */
	export async function submit(options?: { force?: boolean }) {
		return player?.submit(options);
	}

	/** Open the begin gate (showing the start screen) and start delivery and the clocks. */
	export function start() {
		return handleBegin();
	}

	/** Whether delivery has begun (false while a begin gate holds the start screen). */
	export function hasStarted() {
		return player?.hasStarted() ?? false;
	}

	/** Proctor pause: freeze every clock and block the shell until `resume()`. */
	export function pause(reason?: string) {
		player?.pause(reason);
	}

	/** End a proctor pause; the clocks continue where they froze. */
	export function resume() {
		player?.resume();
	}

	/** Whether a proctor pause is in force (a restored session may open paused). */
	export function isPaused() {
		return player?.isPaused() ?? false;
	}

	/** The candidate-facing reason of the pause in force, if any. */
	export function getPauseReason() {
		return player?.getPauseReason();
	}

	/** Whether the session is terminal (finalized here, or restored already finalized). */
	export function isFinalized() {
		return player?.isFinalized() ?? false;
	}

	/** The countdown state: the active scope's nearest limit, the clocks, pause and start state. */
	export function getTimeState() {
		return player?.getTimeState();
	}

	/** Save the current draft now (best-effort); resolves once the save attempt settled. */
	export function flushAutosave() {
		return player?.flushAutosave() ?? Promise.resolve();
	}

	export function updateResponse(responseId: string, value: unknown) {
		return player?.updateResponse(responseId, value);
	}

	export function getResponses() {
		return player?.getResponses();
	}

	export function getState() {
		return player?.getState();
	}

	export function restoreState(state: any) {
		return player?.restoreState(state);
	}
</script>

<PlayerBaseStyles />

<!--
	Page lifecycle: an immediate, best-effort autosave when the tab is hidden or the
	page is unloaded, so a refresh or crash loses at most the debounce window.
-->
<svelte:window
	onvisibilitychange={() => {
		if (document.visibilityState === 'hidden') void player?.flushAutosave();
	}}
	onpagehide={() => void player?.flushAutosave()}
	onfocusin={handlePauseFocusContainment}
/>

<!-- Accessibility announcer for screen readers -->
<AccessibilityAnnouncer bind:this={announcer} lang={interfaceAttributes?.lang} dir={interfaceAttributes?.dir} />

{#if error}
	<!--
		A failed load: the localized coded-error message (never raw backend text), a
		retry control that re-initializes the session, and focus on Retry when a retry
		fails again. A slow backend is not this screen — see the loading branch.
	-->
	<div class="assessment-error pie-qti-chrome" lang={interfaceAttributes?.lang} dir={interfaceAttributes?.dir}>
		<div class="assessment-alert error" role="alert" aria-live="assertive">
			<svg
				class="assessment-alert-icon"
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<p class="assessment-alert-message">
				<span>{error.message}</span>
				{#if error.supportCode}
					<span class="support-code">{i18n.t('assessment.errors.supportCode', { code: error.supportCode })}</span>
				{/if}
			</p>
			<button
				bind:this={retryButton}
				type="button"
				class="retry-button"
				data-testid="assessment-load-retry"
				disabled={initializing}
				onclick={() => void handleRetryInitialize()}
			>
				{i18n.t('assessment.loadingRetry', 'Try again')}
			</button>
		</div>
	</div>
{:else if awaitingBegin}
	<!--
		Begin gate: delivery and the clocks hold until the candidate begins. The screen
		names the assessment, states the time it allows, and shows the test's own
		instructions; Begin lands focus on the first question like a navigation.
	-->
	<svelte:element
		this={fullViewport ? 'main' : 'section'}
		class="assessment-start pie-qti-chrome"
		class:full-viewport={fullViewport}
		lang={interfaceAttributes?.lang}
		dir={interfaceAttributes?.dir}
		aria-labelledby={titleId}
		data-testid="assessment-start"
	>
		<div class="assessment-start-card">
			<svelte:element
				this={`h${titleHeadingLevel}`}
				bind:this={startHeadingEl}
				id={titleId}
				class="assessment-start-title"
				tabindex="-1"
			>
				{assessmentTitle}
			</svelte:element>
			{#if startTimeLine}
				<p class="assessment-start-time" data-testid="assessment-start-time">{startTimeLine}</p>
			{/if}
			{#if startInfo?.hasScopedTimeLimits}
				<p class="assessment-start-note">
					{i18n.t('assessment.start.scopedTimeLimits', 'Some parts of this test have their own time limits.')}
				</p>
			{/if}
			{#if startBlocks.rubricBlocks.length > 0}
				<!-- The first test part's candidate instructions, role-filtered like in delivery. -->
				<div class="assessment-start-section">
					<RubricDisplay
						rubricBlocks={startBlocks.rubricBlocks}
						role={sectionRole}
						{i18n}
						security={config.security}
						host={config.sectionHost}
						{typeset}
						headingLevel={titleHeadingLevel + 1}
					/>
				</div>
			{/if}
			{#if paused}
				<!--
					A proctor pause holds the begin gate too (a session restored paused, or a
					pause before Begin): the start screen says so, and Begin waits for the resume.
				-->
				<div class="assessment-start-paused" id={`${uid}-start-paused`} role="status" data-testid="assessment-start-paused">
					<p class="assessment-start-paused-title">
						{i18n.t('assessment.start.paused', 'This test is paused. Please wait until it resumes.')}
					</p>
					{#if pauseReason}
						<p class="assessment-start-paused-reason">{pauseReason}</p>
					{/if}
				</div>
			{/if}
			<button
				type="button"
				class="assessment-start-button"
				data-testid="assessment-begin"
				aria-disabled={paused ? 'true' : undefined}
				aria-describedby={paused ? `${uid}-start-paused` : undefined}
				onclick={() => void handleBegin()}
			>
				{startInfo?.resuming
					? i18n.t('assessment.start.resume', 'Continue')
					: i18n.t('assessment.start.begin', 'Begin')}
			</button>
		</div>
	</svelte:element>
{:else if isComplete && player}
	<!--
		The candidate-facing completion state: "You have finished the test" (or the
		time-expired variant when the whole-test limit auto-submitted; the
		already-submitted variant when a finalized session was restored), the test's
		outcome-matched testFeedback, and — only when the host opts in via
		`showResultsSummary` — a per-question results summary. Navigation is closed;
		the host's `onSubmit` still received the full results.
	-->
	<CompletionScreen
		bind:this={completionScreen}
		headingLevel={titleHeadingLevel}
		finishedByTimeExpiry={finishedByExpiry}
		alreadySubmitted={restoredFinalized}
		testFeedback={testFeedbackBlocks}
		resultsSummary={resultsSummary}
		{showResultsSummary}
		role={sectionRole}
		{i18n}
		security={config.security}
		host={config.sectionHost}
		{typeset}
		{fullViewport}
		lang={interfaceAttributes?.lang}
		dir={interfaceAttributes?.dir}
	/>
{:else if !player || navState.currentIndex < 0}
	<div class="assessment-loading pie-qti-chrome" lang={interfaceAttributes?.lang} dir={interfaceAttributes?.dir}>
		<div class="assessment-loading-status" role="status" aria-live="polite">
			<span class="assessment-spinner" aria-hidden="true"></span>
			<span>{i18n.t('assessment.loading')}</span>
			{#if stillLoading}
				<!-- Still working after 10s: a status update, not an error. If the
				     backend recovers, delivery proceeds without any action. -->
				<span class="assessment-still-loading" data-testid="assessment-still-loading" role="status" aria-live="polite">
					{i18n.t('assessment.stillLoading', 'Still loading. Please wait a moment.')}
				</span>
			{/if}
		</div>
	</div>
{:else}
	<!--
		Embedded, the shell is one region named by the assessment title inside the host
		page. Full-viewport, it is the page: its header, main and nav are landmarks.
	-->
	<svelte:element
		this={fullViewport ? 'div' : 'section'}
		bind:this={shellRootEl}
		class="assessment-shell pie-qti-chrome"
		class:full-viewport={fullViewport}
		lang={interfaceAttributes?.lang}
		dir={interfaceAttributes?.dir}
		aria-labelledby={fullViewport ? undefined : titleId}
	>
		<!--
			All shell chrome in one wrapper that the proctor pause makes inert (WCAG
			2.4.11): the skip link, the comments disclosure and the submit-error retry
			cannot be tabbed into beneath the opaque overlay. The pause overlay itself
			sits OUTSIDE this wrapper, so it stays operable while everything under it is
			inert. `display: contents` keeps the wrapper out of the layout.
		-->
		<div class="shell-chrome" inert={paused || undefined}>
			<a class="skip-link" href={`#${contentId}`} onclick={handleSkipToQuestion}>
			{i18n.t('assessment.skipToQuestion', 'Skip to question')}
		</a>

		<!-- Header with title, countdown timer and section menu (legal navigation targets only) -->
		<AssessmentHeader
			title={assessmentTitle}
			{titleId}
			headingLevel={titleHeadingLevel}
			sections={headerSections}
			currentSectionIndex={navState.currentSection?.index}
			showSections={config.showSections}
			allowSectionNavigation={!isSubmitting && !isComplete && config.allowSectionNavigation !== false}
			inert={paused}
			{i18n}
			onSectionSelect={handleSectionSelect}
		>
			{#snippet actions()}
				{#if timerLimited && player && !isComplete}
					<AssessmentTimer
						{player}
						{i18n}
						hidden={timerHidden}
						onToggleHidden={handleToggleTimerHidden}
					/>
				{/if}
			{/snippet}
		</AssessmentHeader>

		<!-- Test feedback: `during` once outcomes exist, `atEnd` once its test or test part has ended -->
		{#if testFeedback.length > 0}
			<SectionTestFeedback
				feedback={testFeedbackBlocks}
				role={sectionRole}
				{i18n}
				security={config.security}
				host={config.sectionHost}
				{typeset}
			/>
		{/if}

		{#if navError}
			<div class="assessment-nav-error">
				<div class="assessment-alert warning" role="alert" aria-live="assertive">
					<svg
						class="assessment-alert-icon"
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<p class="assessment-alert-message">
						<span>{navError.message}</span>
						{#if navError.supportCode}
							<span class="support-code">{i18n.t('assessment.errors.supportCode', { code: navError.supportCode })}</span>
						{/if}
					</p>
				</div>
			</div>
		{/if}

		<!--
			Question content: the scrolling region the skip link leads to. It — not the whole
			shell — is busy while a transition swaps the question, so the status messages
			outside it ("Submitting…", the save indicator) are still announced.
		-->
		<svelte:element
			this={fullViewport ? 'main' : 'div'}
			bind:this={contentEl}
			id={contentId}
			class="assessment-content"
			class:has-passage={hasSplitPane && !reviewOpen}
			tabindex="-1"
			role={fullViewport ? undefined : 'region'}
			aria-label={i18n?.t('accessibility.itemBody') ?? 'Question content'}
			aria-busy={isSubmitting || navState.isLoading}
			inert={paused || undefined}
		>
			<!--
				Error boundary around the question content: a crashing interaction (or a
				malformed passage) shows a plain-language fallback and keeps the test
				usable — Previous/Next still work, so the candidate moves on wherever
				navigation rules allow. The raw error goes to the console and the host.
			-->
			<svelte:boundary onerror={handleContentCrash}>
				{#if reviewOpen && reviewData}
					<ReviewScreen
						bind:this={reviewScreen}
						groups={reviewData.groups}
						answeredCount={reviewData.answeredCount}
						totalItems={reviewData.totalItems}
						flaggedCount={reviewData.flaggedCount}
						headingLevel={titleHeadingLevel + 1}
						busy={navState.isLoading || isSubmitting}
						{i18n}
						onJump={handleReviewJump}
					/>
				{:else if sectionComposition}
					{#if sectionComposition.layout === 'split-pane'}
						<SectionPlayerSplitPane
							bind:this={splitLayout}
							composition={sectionComposition}
							{i18n}
							security={config.security}
							pci={config.pci}
							pnp={config.pnp}
							{typeset}
							headingLevel={titleHeadingLevel + 1}
							onItemPaneReady={(el) => (itemPaneEl = el)}
							onDisplaySettingsChange={handleDisplaySettingsChange}
						/>
					{:else}
						<SectionPlayerVertical
							bind:this={verticalLayout}
							composition={sectionComposition}
							{i18n}
							security={config.security}
							pci={config.pci}
							pnp={config.pnp}
							{typeset}
							headingLevel={titleHeadingLevel + 1}
							onItemPaneReady={(el) => (itemPaneEl = el)}
							onDisplaySettingsChange={handleDisplaySettingsChange}
						/>
					{/if}
				{/if}
				{#snippet failed(_error, reset)}
					<div class="content-fallback" role="alert" data-testid="assessment-content-fallback">
						<svg
							class="assessment-alert-icon"
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<div class="content-fallback-body">
							<p class="content-fallback-title">
								{i18n.t('assessment.itemError.title', 'This question could not be displayed.')}
							</p>
							<div class="content-fallback-actions">
								<button
									type="button"
									class="retry-button"
									data-testid="assessment-content-retry"
									onclick={() => void handleContentFallbackRetry(reset)}
								>
									{i18n.t('assessment.itemError.tryAgain', 'Try again')}
								</button>
								{#if canContinueAfterCrash}
									<button
										type="button"
										class="content-fallback-continue"
										data-testid="assessment-content-continue"
										onclick={() => void handleContentFallbackContinue(reset)}
									>
										{i18n.t('assessment.itemError.continue', 'Continue')}
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/snippet}
			</svelte:boundary>
		</svelte:element>

		{#if submitError}
			<div class="assessment-submit-error">
				<p role="alert">
					{submitError.message}
					{#if submitError.supportCode}
						<span class="support-code">{i18n.t('assessment.errors.supportCode', { code: submitError.supportCode })}</span>
					{/if}
				</p>
				<button bind:this={retryButton} type="button" class="retry-button" onclick={() => void performSubmit()} disabled={isSubmitting}>
					{i18n?.t('common.tryAgain') ?? 'Try Again'}
				</button>
			</div>
		{/if}
		{#if isSubmitting}
			<p class="assessment-submit-status" role="status">{i18n?.t('common.submitting') ?? 'Submitting...'}</p>
		{/if}

		{#if allowComment && !isComplete}
			<!--
				QTI itemSessionControl allowComment: the candidate's comment for the test team
				on the active item. It lives in the session state (so it autosaves and rides
				snapshots) and is sent with the item's next submission payload.
			-->
			<details class="item-comments" data-testid="assessment-comments">
				<summary class="item-comments-summary">{i18n.t('assessment.comments.heading', 'Comments for the test team')}</summary>
				<div class="item-comments-body">
					<label class="item-comments-label" for={`${uid}-comment-input`}>
						{i18n.t('assessment.comments.label', 'Your comments')}
					</label>
					<textarea
						id={`${uid}-comment-input`}
						class="item-comments-input"
						data-testid="assessment-comments-input"
						rows="3"
						bind:value={commentDraft}
						placeholder={i18n.t('assessment.comments.placeholder', 'Write a comment for the test team (optional).')}
						oninput={() => saveComment()}
					></textarea>
				</div>
			</details>
		{/if}

		<!-- Navigation bar -->
		{#if i18n}
			<NavigationBar
				navState={{ ...navState, isLoading: navState.isLoading || isSubmitting || isComplete }}
				{i18n}
				onPrevious={handlePrevious}
				onNext={handleNext}
				onSubmit={openSubmitDialog}
				showProgress={config.showProgress !== false}
				answeredCount={reviewData?.answeredCount}
				saveLabel={saveLabel}
				saveStatusEnabled={player?.isAutosaveEnabled() === true}
				flagged={currentFlagged}
				onToggleFlag={handleToggleFlag}
				showReview={!isComplete && reviewData !== null}
				{reviewOpen}
				onToggleReview={toggleReview}
				showSubmit={submitRequired && !isComplete}
				checkAnswer={checkAnswer?.available && !isComplete
					? {
						adaptive: checkAnswer.adaptive,
						attemptsUsed: checkAnswer.attemptsUsed,
						maxAttempts: checkAnswer.maxAttempts,
						remainingAttempts: checkAnswer.remainingAttempts,
						attemptsExhausted: checkAnswer.attemptsExhausted,
					}
					: null}
				onCheckAnswer={() => void handleCheckAnswer()}
				inert={paused}
			/>
		{/if}

		<!--
			The shell's dialogs, inside one error boundary: a crashing dialog body cannot
			blank the shell or strand the candidate behind a broken modal. The fallback
			explains, dismisses the crashed dialogs and keeps delivery usable.
		-->
		<svelte:boundary onerror={handleDialogCrash}>
			<!--
				Resume prompt: the backend restored a snapshot with prior activity. The
				candidate continues where they left off, or — after confirming, because it
				cannot be undone (WCAG 3.3.4) — deletes the saved draft and starts over.
			-->
				{#if resumeDialogOpen}
					<AssessmentDialog
						bind:open={resumeDialogOpen}
						title={i18n.t('assessment.resume.title', 'Resume your test?')}
						description={resumeSavedAtLine}
						{i18n}
						// Escape keeps the saved answers and continues — it must never be one
						// step away from the irreversible deletion.
						onCancel={handleResume}
					>
						{#snippet actions({ close })}
							{#if allowStartOver}
								<!-- svelte-ignore a11y_autofocus -->
								<button
									type="button"
									class="submit-dialog-action"
									data-testid="assessment-resume-start-over"
									autofocus
									onclick={() => {
										close('cancel');
										handleStartOverRequested();
									}}
								>
									{i18n.t('assessment.resume.startOver', 'Start over')}
								</button>
							{/if}
							<!-- svelte-ignore a11y_autofocus -->
							<button
								type="button"
								class="submit-dialog-action primary"
								data-testid="assessment-resume-continue"
								autofocus={!allowStartOver}
								onclick={() => {
									close('confirm');
									handleResume();
								}}
							>
								{i18n.t('assessment.resume.resumeAction', 'Resume where you left off')}
							</button>
						{/snippet}
					</AssessmentDialog>
				{/if}

			{#if startOverConfirmOpen}
				<AssessmentDialog
					bind:open={startOverConfirmOpen}
					title={i18n.t('assessment.resume.confirmTitle', 'Start over and delete your saved answers?')}
					description={i18n.t(
						'assessment.resume.confirmDescription',
						'Your saved answers will be deleted and the test starts from the beginning. This cannot be undone.',
					)}
					confirmLabel={i18n.t('assessment.resume.confirmAction', 'Delete and start over')}
					cancelLabel={i18n.t('assessment.resume.cancel', 'Keep my saved answers')}
					tone="danger"
					dismissible={false}
					busy={startOverBusy}
					{i18n}
					onConfirm={handleStartOverConfirmed}
					onCancel={handleStartOverCancelled}
				/>
			{/if}

			<!--
				Submit confirmation: names the unanswered and flagged questions, links back to
				them when the navigation rules allow, and requires an explicit confirm. Focus
				returns to the Submit control on cancel.
			-->
			<AssessmentDialog
				bind:open={submitDialogOpen}
			title={submitTranslations.dialogTitle}
			description={submitTranslations.dialogDescription}
			tone="danger"
			closeOnConfirm={false}
			busy={isSubmitting}
			{i18n}
			onConfirm={handleDialogSubmit}
		>
			{#snippet children()}
				<p class="submit-dialog-summary" data-testid="submit-dialog-summary">
					<strong>{submitTranslations.answeredLine}</strong>
				</p>
				{#if submitTranslations.flaggedLine}
					<p class="submit-dialog-line">{submitTranslations.flaggedLine}</p>
				{/if}
				{#if submitTranslations.needsAnswerHeading && submitSummary}
					<!--
						Items the end of the test would refuse (QTI allowSkipping=false without an
						answer, validateResponses=true with an incomplete one): named first, with a
						jump where navigation allows. Submit is unavailable until they are answered.
					-->
					<p class="submit-dialog-line submit-dialog-needs-answer" id={`${uid}-needs-answer-heading`} data-testid="submit-dialog-needs-answer">
						{submitTranslations.needsAnswerHeading}
					</p>
					<ul class="submit-dialog-items" aria-labelledby={`${uid}-needs-answer-heading`}>
						{#each submitSummary.needsAnswer as item (item.index)}
							<li>
								{#if item.jumpAllowed}
									<button
										type="button"
										class="submit-dialog-jump"
										data-testid={`submit-dialog-needs-answer-jump-${item.number}`}
										disabled={isSubmitting}
										onclick={() => void handleDialogJump(item.index)}
									>
										{i18n.t('assessment.review.goToItem', 'Go to question {number}', { number: item.number })}
									</button>
								{:else}
									<span class="submit-dialog-static">
										{i18n.t('assessment.question', 'Question {current} of {total}', {
											current: item.number,
											total: submitSummary?.total ?? 0,
										})}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if submitTranslations.unansweredHeading && submitSummary}
					<p class="submit-dialog-line" id={`${uid}-unanswered-heading`}>{submitTranslations.unansweredHeading}</p>
					<ul class="submit-dialog-items" aria-labelledby={`${uid}-unanswered-heading`}>
						{#each submitSummary.unanswered as item (item.index)}
							<li>
								{#if item.jumpAllowed}
									<button
										type="button"
										class="submit-dialog-jump"
										data-testid={`submit-dialog-jump-${item.number}`}
										disabled={isSubmitting}
										onclick={() => void handleDialogJump(item.index)}
									>
										{i18n.t('assessment.review.goToItem', 'Go to question {number}', { number: item.number })}
									</button>
								{:else}
									<span class="submit-dialog-static">
										{i18n.t('assessment.question', 'Question {current} of {total}', {
											current: item.number,
											total: submitSummary?.total ?? 0,
										})}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else if !submitTranslations.needsAnswerHeading}
					<p class="submit-dialog-line">{submitTranslations.allAnswered}</p>
				{/if}
			{/snippet}
			{#snippet actions({ close })}
				<button
					type="button"
					class="submit-dialog-action"
					data-testid="submit-dialog-review"
					aria-disabled={isSubmitting ? 'true' : undefined}
					onclick={() => {
						close('cancel');
						void handleDialogReview();
					}}
				>
					{submitTranslations.reviewAction}
				</button>
				<!-- svelte-ignore a11y_autofocus -->
				<button
					type="button"
					class="submit-dialog-action"
					data-testid="assessment-dialog-cancel"
					autofocus
					aria-disabled={isSubmitting ? 'true' : undefined}
					onclick={() => close('cancel')}
				>
					{submitTranslations.cancel}
				</button>
				<button
					type="button"
					class="submit-dialog-action danger"
					data-testid="assessment-dialog-confirm"
					aria-disabled={isSubmitting || submitBlocked ? 'true' : undefined}
					aria-describedby={submitBlocked ? `${uid}-needs-answer-heading` : undefined}
					onclick={() => {
						if (submitBlocked) return;
						close('confirm');
					}}
				>
					{submitTranslations.confirm}
				</button>
			{/snippet}
		</AssessmentDialog>

		<!-- Leaving a test part is irreversible: confirm with a clear "cannot return" -->
		<AssessmentDialog
			bind:open={leavePartDialogOpen}
			title={i18n.t('assessment.leavePart.title', 'Leave this part?')}
			description={i18n.t('assessment.leavePart.description', 'After you continue, you cannot return to the questions in this part.')}
			confirmLabel={i18n.t('assessment.leavePart.confirm', 'Continue')}
			cancelLabel={i18n.t('assessment.leavePart.cancel', 'Stay on this part')}
			dismissible={false}
			{i18n}
			onConfirm={handleLeavePartConfirm}
		/>

		<!--
			Item feedback from a check-answer (or a submit-on-move with single-attempt
			feedback): the item's modal feedback, sanitized with the host's URL policy and
			shown with the shell's dialog semantics (focus in, Escape/Continue to close).
		-->
		{#if feedbackDialogOpen}
			<AssessmentDialog
				bind:open={feedbackDialogOpen}
				title={i18n.t('assessment.feedback.title', 'Feedback')}
				confirmLabel={i18n.t('common.continue', 'Continue')}
				showCancel={false}
				{i18n}
				onClose={() => handleFeedbackDialogClose()}
			>
				{#snippet children()}
					<div class="feedback-dialog-body pie-qti-content" data-testid="assessment-item-feedback" use:typesetNode>
						{#each feedbackEntries as entry, index (`${entry.identifier}:${index}`)}
							<div class="feedback-dialog-entry">
								{#if entry.title}
									<p class="feedback-dialog-entry-title">{entry.title}</p>
								{/if}
								{@html sanitizeHtml(entry.content, { security: config.security })}
							</div>
						{/each}
					</div>
				{/snippet}
			</AssessmentDialog>
		{/if}

		<!--
			Time expiry notices. Scope expiry: acknowledge the move to the next question.
			Dead end / whole-test expiry that could not auto-finalize: the dialog carries
			the Submit action so the candidate can finish wherever they are.
		-->
		{#if expiryDialog}
			{@const scopeTitle = expiryDialog.scope === 'testPart'
				? i18n.t('assessment.timeExpiry.partTitle', 'The time for this part is over')
				: expiryDialog.scope === 'section'
					? i18n.t('assessment.timeExpiry.sectionTitle', 'The time for this section is over')
					: expiryDialog.scope === 'item'
						? i18n.t('assessment.timeExpiry.questionTitle', 'The time for this question is over')
						: i18n.t('assessment.timeExpiry.submitTitle', 'The time for this test is over')}
			<AssessmentDialog
				bind:open={expiryDialogOpen}
				title={scopeTitle}
				description={
					expiryDialog.mode === 'submit'
						? i18n.t('assessment.timeExpiry.submitDescription', 'You can no longer change your answers. Submit your test to finish.')
						: expiryDialog.scope === 'item'
							? i18n.t('assessment.timeExpiry.questionDescription', 'You are moving on to the next question.')
							: i18n.t('assessment.timeExpiry.scopeDescription', 'You are moving on to the next part of the test.')
				}
				confirmLabel={
					expiryDialog.mode === 'submit'
						? i18n.t('assessment.navigation.submit', 'Submit')
						: i18n.t('assessment.timeExpiry.continue', 'Continue')
				}
				tone={expiryDialog.mode === 'submit' ? 'danger' : 'primary'}
				// Escape may dismiss either notice; a dismissed submit notice leaves the
				// Submit control in the navigation bar, so the candidate is never stuck.
				showCancel={expiryDialog.mode !== 'submit'}
				busy={isSubmitting}
				{i18n}
				onConfirm={handleExpiryConfirm}
				onClose={handleExpiryClose}
			/>
		{/if}
			{#snippet failed(_error, reset)}
				<div class="dialog-fallback" role="alert" data-testid="assessment-dialog-fallback">
					<p>{i18n.t('assessment.itemError.title', 'This question could not be displayed.')}</p>
					<button
						type="button"
						class="retry-button"
						data-testid="assessment-dialog-fallback-dismiss"
						onclick={() => handleDialogFallbackDismiss(reset)}
					>
						{i18n.t('common.close', 'Close')}
					</button>
				</div>
			{/snippet}
		</svelte:boundary>
		</div>

		<!-- Proctor pause: an overlay replaces the blocked shell, naming the reason.
		     It sits OUTSIDE the inert chrome wrapper, so it stays operable. -->
		{#if paused}
			<div class="pause-overlay" data-testid="assessment-pause-overlay" bind:this={pauseOverlayEl}>
				<div class="pause-card" role="status" aria-live="assertive">
					<h3 class="pause-title" tabindex="-1" bind:this={pauseHeadingEl}>
						{i18n.t('assessment.pause.title', 'Assessment paused')}
					</h3>
					<p class="pause-reason">
						{pauseReason ?? i18n.t('assessment.pause.message', 'Your test has been paused. Please wait until it resumes.')}
					</p>
				</div>
			</div>
		{/if}
	</svelte:element>
{/if}

<style>
	/*
	 * Layout. The shell fills its host container (`block-size: 100%`). When the host
	 * gives no height it sizes to its content between a usable minimum and the
	 * viewport, so Previous/Next stay reachable; header and nav sit outside the
	 * scrolling content and never cover it. Hosts tune the bounds with
	 * --pie-qti-assessment-min-block-size / --pie-qti-assessment-max-block-size.
	 */
	.assessment-shell {
		box-sizing: border-box;
		position: relative;
		display: flex;
		flex-direction: column;
		inline-size: 100%;
		block-size: 100%;
		min-block-size: var(--pie-qti-assessment-min-block-size, min(32rem, 100dvh));
		max-block-size: var(--pie-qti-assessment-max-block-size, 100dvh);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}

	@supports not (height: 100dvh) {
		.assessment-shell {
			min-block-size: var(--pie-qti-assessment-min-block-size, min(32rem, 100vh));
			max-block-size: var(--pie-qti-assessment-max-block-size, 100vh);
		}
	}

	/* Full viewport: the dynamic viewport (iOS toolbars) minus notch and home-indicator insets. */
	.assessment-shell.full-viewport {
		block-size: 100dvh;
		min-block-size: 0;
		max-block-size: none;
		padding-block-start: env(safe-area-inset-top, 0px);
		padding-block-end: env(safe-area-inset-bottom, 0px);
		/* Safe-area insets are physical by definition. */
		padding-left: env(safe-area-inset-left, 0px); /* i18n-physical */
		padding-right: env(safe-area-inset-right, 0px); /* i18n-physical */
	}

	@supports not (height: 100dvh) {
		.assessment-shell.full-viewport {
			block-size: 100vh;
		}
	}

	/*
	 * All chrome in one wrapper the proctor pause makes inert. `display: contents`
	 * keeps it out of the layout entirely — the shell's flex column, the pause
	 * overlay's absolute positioning and the landmarks are untouched; only focus and
	 * pointer interaction beneath the overlay are blocked (WCAG 2.4.11).
	 */
	.shell-chrome {
		display: contents;
	}

	.assessment-content {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-block-size: 0;
		inline-size: 100%;
		overflow: auto;
		/* Focused controls scroll clear of the region's edges (and keep their focus ring). */
		scroll-padding-block: var(--pie-qti-space-6, 2rem);
	}

	.assessment-content:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: -2px;
	}

	/* Passage layouts scroll each pane themselves. */
	.assessment-content.has-passage {
		overflow: hidden;
	}

	/*
	 * Short viewports (400% zoom, landscape phones): header and nav stop reserving
	 * room. Everything flows in one scroll — the page's, or the shell's own when the
	 * host gave it a fixed height — and nothing is pinned over the content.
	 */
	@media (max-height: 30rem) {
		.assessment-shell {
			max-block-size: none;
			overflow-y: auto;
			scroll-padding-block: var(--pie-qti-space-4, 1rem);
		}

		.assessment-content,
		.assessment-content.has-passage {
			flex: none;
			overflow: visible;
		}
	}

	.skip-link {
		position: absolute;
		inset-block-start: var(--pie-qti-space-2, 0.5rem);
		inset-inline-start: var(--pie-qti-space-2, 0.5rem);
		z-index: 20;
		box-sizing: border-box;
		/* Visually hidden until focused. */
		inline-size: 1px;
		block-size: 1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border-radius: var(--pie-qti-radius-sm, 0.25rem);
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
		font-weight: 600;
		text-decoration: underline;
	}

	.skip-link:focus {
		display: inline-flex;
		align-items: center;
		inline-size: auto;
		block-size: auto;
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-4, 1rem);
		overflow: visible;
		clip-path: none;
		white-space: normal;
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.assessment-error,
	.assessment-loading {
		box-sizing: border-box;
		padding: var(--pie-qti-space-6, 2rem);
	}

	.assessment-loading-status {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--pie-qti-space-4, 1rem);
		flex-wrap: wrap;
	}

	.assessment-still-loading {
		flex: 1 1 100%;
		text-align: center;
		font-weight: 600;
	}

	.assessment-spinner {
		flex: none;
		inline-size: 2rem;
		block-size: 2rem;
		box-sizing: border-box;
		border: 3px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-block-start-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		border-radius: 50%;
	}

	@media (prefers-reduced-motion: no-preference) {
		.assessment-spinner {
			animation: assessment-spin 0.9s linear infinite;
		}
	}

	@keyframes assessment-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.assessment-alert {
		box-sizing: border-box;
		display: flex;
		align-items: flex-start;
		gap: var(--pie-qti-space-3, 0.75rem);
		padding: var(--pie-qti-space-3, 0.75rem) var(--pie-qti-space-4, 1rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-inline-start-width: 4px;
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.assessment-alert.error {
		border-color: var(--pie-qti-error-text, #b91c1c);
	}

	.assessment-alert.warning {
		border-color: var(--pie-qti-warning-text, #92400e);
	}

	.assessment-alert-icon {
		flex: none;
		inline-size: 1.5rem;
		block-size: 1.5rem;
	}

	.assessment-alert.error .assessment-alert-icon {
		color: var(--pie-qti-error-text, #b91c1c);
	}

	.assessment-alert.warning .assessment-alert-icon {
		color: var(--pie-qti-warning-text, #92400e);
	}

	.assessment-alert-message {
		margin: 0;
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}

	.assessment-nav-error {
		padding-block: var(--pie-qti-space-3, 0.75rem) 0;
		padding-inline: var(--pie-qti-space-5, 1.5rem);
	}

	.assessment-submit-error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--pie-qti-space-3, 0.75rem);
		padding-block: var(--pie-qti-space-3, 0.75rem);
		padding-inline: var(--pie-qti-space-4, 1rem);
		border-block-start: 2px solid var(--pie-qti-error-text, #b91c1c);
	}

	.assessment-submit-error p {
		flex: 1 1 16rem;
		margin: 0;
		overflow-wrap: anywhere;
	}

	.retry-button {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-5, 1.5rem);
		border: 1px solid var(--pie-qti-primary, oklch(45% 0.24 277));
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
	}

	.retry-button:hover:not(:disabled) {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 85%, black);
	}

	.retry-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.retry-button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.assessment-submit-status {
		margin: 0;
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-4, 1rem);
	}

	/* The refused end of the test reads as a warning naming questions, not a failure alert. */
	.submit-dialog-needs-answer {
		font-weight: 600;
	}

	/*
	 * Candidate comments (QTI allowComment): a native disclosure above the navigation
	 * bar. The summary is a ≥44px target with a visible focus ring; the textarea takes
	 * the full width and resizes vertically only, so it never forces horizontal scroll.
	 */
	.item-comments {
		box-sizing: border-box;
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-4, 1rem);
		border-block-start: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.item-comments-summary {
		display: flex;
		align-items: center;
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		font-weight: 600;
		cursor: pointer;
	}

	.item-comments-summary:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.item-comments-body {
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-1, 0.25rem);
		padding-block-end: var(--pie-qti-space-2, 0.5rem);
	}

	.item-comments-label {
		font-size: 0.9375em;
	}

	.item-comments-input {
		box-sizing: border-box;
		inline-size: 100%;
		min-block-size: 4.5rem;
		padding: var(--pie-qti-space-2, 0.5rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius-sm, 0.25rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		line-height: 1.4;
		resize: vertical;
	}

	.item-comments-input:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* Item feedback inside the shell dialog (snippet content keeps the shell's CSS scope). */
	.feedback-dialog-body {
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-3, 0.75rem);
		overflow-wrap: anywhere;
	}

	.feedback-dialog-entry + .feedback-dialog-entry {
		padding-block-start: var(--pie-qti-space-3, 0.75rem);
		border-block-start: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
	}

	.feedback-dialog-entry-title {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
		font-weight: 700;
	}

	.feedback-dialog-entry :global(> :first-child) {
		margin-block-start: 0;
	}

	.feedback-dialog-entry :global(> :last-child) {
		margin-block-end: 0;
	}

	/* Submit-confirmation dialog body */
	.submit-dialog-summary {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
		font-size: 1.0625em;
	}

	.submit-dialog-line {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
	}

	.submit-dialog-items {
		margin: 0 0 var(--pie-qti-space-2, 0.5rem);
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-2, 0.5rem);
		max-block-size: 12rem;
		overflow-y: auto;
	}

	.submit-dialog-jump {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-4, 1rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		text-align: start;
		cursor: pointer;
	}

	.submit-dialog-jump:hover:not(:disabled) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.submit-dialog-jump:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.submit-dialog-jump:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.submit-dialog-static {
		font-weight: 600;
	}

	/* The dialog's action buttons (the actions snippet keeps the shell's CSS scope). */
	.submit-dialog-action {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-4, 1rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		text-align: center;
		cursor: pointer;
	}

	.submit-dialog-action:hover:not([aria-disabled='true']) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.submit-dialog-action.danger {
		border-color: var(--pie-qti-error-text, #b91c1c);
		background: var(--pie-qti-error-text, #b91c1c);
		color: oklch(98% 0.01 277);
	}

	.submit-dialog-action.danger:hover:not([aria-disabled='true']) {
		background: color-mix(in oklab, var(--pie-qti-error-text, #b91c1c) 85%, black);
	}

	.submit-dialog-action:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.submit-dialog-action[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.support-code {
		padding-inline-start: var(--pie-qti-space-2, 0.5rem);
		font-size: 0.85em;
		color: var(--pie-qti-warning-text, #92400e);
	}

	/* Crashed question content: plain-language fallback with recovery actions. */
	.content-fallback {
		box-sizing: border-box;
		display: flex;
		align-items: flex-start;
		gap: var(--pie-qti-space-3, 0.75rem);
		margin: var(--pie-qti-space-5, 1.5rem);
		padding: var(--pie-qti-space-4, 1rem);
		border: 1px solid var(--pie-qti-error-text, #b91c1c);
		border-inline-start-width: 4px;
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.content-fallback .assessment-alert-icon {
		color: var(--pie-qti-error-text, #b91c1c);
	}

	.content-fallback-body {
		min-inline-size: 0;
	}

	.content-fallback-title {
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.content-fallback-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--pie-qti-space-3, 0.75rem);
	}

	.content-fallback-continue {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-5, 1.5rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
	}

	.content-fallback-continue:hover {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.content-fallback-continue:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* Crashed dialog body: the shell dismisses the broken modal and stays usable. */
	.dialog-fallback {
		box-sizing: border-box;
		position: fixed;
		inset-block-start: var(--pie-qti-space-4, 1rem);
		inset-inline-start: 50%;
		transform: translateX(-50%); /* i18n-physical */
		z-index: 2147483000;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--pie-qti-space-3, 0.75rem);
		max-inline-size: min(32rem, calc(100% - 2 * var(--pie-qti-space-4, 1rem)));
		padding: var(--pie-qti-space-3, 0.75rem) var(--pie-qti-space-4, 1rem);
		border: 1px solid var(--pie-qti-error-text, #b91c1c);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		box-shadow: 0 1.25rem 2.75rem rgb(0 0 0 / 0.25);
	}

	.dialog-fallback p {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.submit-dialog-action.primary {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
	}

	.submit-dialog-action.primary:hover:not([aria-disabled='true']) {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 85%, black);
	}

	/* Begin gate: the start screen before the clocks run. */
	.assessment-start {
		box-sizing: border-box;
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--pie-qti-space-6, 2rem) var(--pie-qti-space-4, 1rem);
		overflow-y: auto;
	}

	.assessment-start.full-viewport {
		min-block-size: 100dvh;
		padding-block-start: max(var(--pie-qti-space-6, 2rem), env(safe-area-inset-top, 0px));
		padding-block-end: max(var(--pie-qti-space-6, 2rem), env(safe-area-inset-bottom, 0px));
	}

	.assessment-start-card {
		box-sizing: border-box;
		inline-size: min(42rem, 100%);
		padding: var(--pie-qti-space-6, 2rem);
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.assessment-start-title {
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		font-size: 1.375em;
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.assessment-start-title:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.assessment-start-time {
		margin: 0 0 var(--pie-qti-space-4, 1rem);
		font-weight: 600;
	}

	.assessment-start-note {
		margin: 0 0 var(--pie-qti-space-4, 1rem);
	}

	.assessment-start-section {
		margin-block-end: var(--pie-qti-space-4, 1rem);
	}

	.assessment-start-button {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-6, 2rem);
		border: 1px solid var(--pie-qti-primary, oklch(45% 0.24 277));
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-primary, oklch(45% 0.24 277));
		color: var(--pie-qti-primary-content, oklch(98% 0.01 277));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
	}

	.assessment-start-button:hover {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 85%, black);
	}

	.assessment-start-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.assessment-start-button[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* A proctor pause holds the begin gate: the start screen says so (status region). */
	.assessment-start-paused {
		margin: 0 0 var(--pie-qti-space-4, 1rem);
		padding: var(--pie-qti-space-3, 0.75rem) var(--pie-qti-space-4, 1rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-inline-start-width: 4px;
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}

	.assessment-start-paused-title {
		margin: 0;
		font-weight: 600;
	}

	.assessment-start-paused-reason {
		margin: var(--pie-qti-space-1, 0.25rem) 0 0;
		overflow-wrap: anywhere;
	}

	/* Proctor pause: blocks the shell and names the reason. */
	.pause-overlay {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--pie-qti-space-4, 1rem);
		background: color-mix(in oklab, var(--pie-qti-base-100, oklch(100% 0 0)) 92%, black);
	}

	.pause-card {
		box-sizing: border-box;
		inline-size: min(28rem, 100%);
		padding: var(--pie-qti-space-6, 2rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		box-shadow: 0 1.25rem 2.75rem rgb(0 0 0 / 0.25);
	}

	.pause-title {
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		font-size: 1.25em;
		font-weight: 700;
		line-height: 1.3;
	}

	.pause-title:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.pause-reason {
		margin: 0;
		overflow-wrap: anywhere;
	}

	/* Phones: slimmer gutters. */
	@media (max-width: 40rem) {
		.assessment-error,
		.assessment-loading {
			padding: var(--pie-qti-space-4, 1rem);
		}

		.assessment-nav-error {
			padding-inline: var(--pie-qti-space-3, 0.75rem);
		}

		.assessment-content {
			scroll-padding-block: var(--pie-qti-space-3, 0.75rem);
		}

		.item-comments {
			padding-inline: var(--pie-qti-space-3, 0.75rem);
		}
	}
</style>
