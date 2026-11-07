<script lang="ts">
	import { onMount, tick, getContext } from 'svelte';
	import { DefaultI18nProvider, interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	import { normalizeQtiSharedContext } from '@pie-qti/assessment-toolkit';
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
	import { assessmentErrorDisplay, isAssessmentPlayerError } from '../core/errors.js';
	import { TimeManager } from '../core/TimeManager.js';
	import type { ReviewGroup } from './ReviewScreen.svelte';
	import type { BackendAdapter, InitSessionRequest } from '../integration/api-contract.js';
	import { toSectionComposition } from '../integration/toSectionComposition.js';
	import type {
		AssessmentResults,
		CandidateSectionView,
		NavigationState,
		VisibleTestFeedback,
	} from '../types/index.js';
	import AccessibilityAnnouncer from './AccessibilityAnnouncer.svelte';
	import AssessmentDialog from './AssessmentDialog.svelte';
	import AssessmentHeader from './AssessmentHeader.svelte';
	import AssessmentTimer from './AssessmentTimer.svelte';
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
	}

	const { backend, initSession, config = {}, onSubmit, typeset, fullViewport = false, headingLevel, beginGate = false }: Props = $props();

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
		const message = i18n.t(display.i18nKey, display.params);
		return {
			message,
			supportCode: isAssessmentPlayerError(err) ? null : display.supportCode,
		};
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
	let currentResponses = $state<Record<string, unknown>>({});
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
	let initTimeout: ReturnType<typeof setTimeout> | null = null;
	let hasFirstItem = $state(false);
	let announcer = $state<AccessibilityAnnouncer | null>(null);
	let responseVersion = $state(0);
	let stateVersion = $state(0);
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

	const sectionComposition = $derived.by(() => {
		responseVersion;
		stateVersion;
		return player ? toSectionComposition(player, config) : null;
	});
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
	// count; only legal jump targets are enabled inside the menu.
	const headerSections = $derived.by(() => {
		responseVersion;
		stateVersion;
		navState.currentSection?.id;
		if (!player || navState.currentIndex < 0) return [];
		const items = player.getReviewItems();
		return player.getAllSections().map((section) => {
			const members = items.filter((item) => item.sectionId === section.id);
			return {
				id: section.id,
				title: section.title,
				index: section.index,
				navigable: section.navigable,
				answered: members.filter((item) => item.status !== 'unanswered').length,
				total: members.length,
				isCurrent: navState.currentSection?.id === section.id,
			};
		});
	});

	// Initialize player
	onMount(() => {
		// Never allow infinite "Loading assessment..." state. Behind a begin gate the
		// clock only starts once the candidate has begun.
		initTimeout = setTimeout(() => {
			if (!hasFirstItem && !error && !startPending) {
				error = { message: i18n.t('assessment.loadingError'), supportCode: null };
				announcer?.announce(error.message, 3000, 'assertive');
			}
		}, 10000);

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
		};

		(async () => {
			const created = await AssessmentPlayer.create(playerConfig);
			startPending = !created.hasStarted();
			player = created;

			// Get sections
			sections = player.getAllSections();

			// Set up event listeners
			player.onItemChange(async () => {
				updateState();
				navError = null;
				hasFirstItem = true;
				if (initTimeout) {
					clearTimeout(initTimeout);
					initTimeout = null;
				}
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

			player.onResponseChange((responses) => {
				currentResponses = responses;
				responseVersion += 1;
			});

			player.onBusyChange(() => {
				updateState();
			});

			player.onFlagChange(() => {
				// Flag state lives in the core session state; re-render whatever shows it.
				stateVersion += 1;
			});

			// Terminal branching (QTI EXIT_TEST) and the whole-test time expiry finalize the
			// core like a normal submit; the shell shows the same completed state.
			player.onComplete(() => {
				isComplete = true;
				submitRequired = false;
				sections = player?.getAllSections() ?? [];
				updateState();
			});

			// A hard time limit ran out: the core auto-finalizes a whole-test expiry; a
			// scope dead end leaves the candidate to submit from wherever they are.
			player.onTimeExpired((event) => {
				updateState();
				if (event.autoFinalized) {
					// The completed view arrives through onComplete; say why it happened, and
					// hand the results to the host like a Submit (submit() returns them now).
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
					if (initTimeout) {
						clearTimeout(initTimeout);
						initTimeout = null;
					}
				}
			}
		})().catch((err) => {
			console.error('Failed to initialize assessment player:', err);
			error = localizeError(err);
			announcer?.announce(error.message, 3000, 'assertive');
		});

		return () => {
			if (initTimeout) {
				clearTimeout(initTimeout);
				initTimeout = null;
			}
			if (player) {
				player.destroy();
			}
		};
	});

	$effect(() => {
		// The start screen lands focus on its heading, like a dialog.
		if (awaitingBegin) {
			void tick().then(() => startHeadingEl?.focus());
		}
	});

	function updateState() {
		if (!player) return;

		navState = player.getNavigationState();
		currentItem = player.getCurrentItem();
		currentRubricBlocks = player.getCurrentRubricBlocks();
		currentResponses = player.getResponses();
		testFeedback = player.getVisibleFeedback();
		timerLimited = player.getTimeState().limited;
		timerHidden = player.isTimerHidden();
		stateVersion += 1;
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
		} catch (err) {
			if (isBusyRejection(err)) return;
			console.error('Next navigation failed:', err);
			navError = localizeError(err);
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
	 * the content region.
	 */
	async function focusQuestion(): Promise<void> {
		await tick(); // Wait for DOM updates
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
	 * announce it like a navigation. Also the imperative `start()` export.
	 */
	async function handleBegin() {
		if (!player || !startPending || isComplete) return;
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

	async function handleExpiryConfirm() {
		const mode = expiryDialog?.mode;
		expiryDialogOpen = false;
		if (mode === 'submit') {
			// The dialog carries the Submit action: an expired test ends here (or shows
			// the retry alert when the backend refused).
			await performSubmit();
			return;
		}
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

	function openSubmitDialog() {
		if (!player || isSubmitting || isComplete) return;
		const items = player.getReviewItems();
		submitSummary = {
			answeredCount: player.getAnsweredItemCount(),
			total: items.length,
			flaggedCount: items.filter((item) => item.flagged).length,
			unanswered: items
				.filter((item) => item.status === 'unanswered')
				.map((item) => ({ number: item.number, index: item.index, jumpAllowed: item.jumpAllowed })),
		};
		navError = null;
		submitDialogOpen = true;
	}

	/**
	 * The real terminal transition, shared by the confirmation dialog and the imperative
	 * API. Returns false when the submission failed (the shell then shows the alert and
	 * moves focus to the retry control); true once the test has ended.
	 */
	async function performSubmit(): Promise<boolean> {
		if (!player || isSubmitting || isComplete) return false;

		submitError = null;
		isSubmitting = true;
		let results: AssessmentResults;
		try {
			results = await player.submit();
		} catch (err) {
			if (!isBusyRejection(err)) {
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

	export async function submit() {
		return player?.submit();
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

<!-- Accessibility announcer for screen readers -->
<AccessibilityAnnouncer bind:this={announcer} lang={interfaceAttributes?.lang} dir={interfaceAttributes?.dir} />

{#if error}
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
			<button
				type="button"
				class="assessment-start-button"
				data-testid="assessment-begin"
				onclick={() => void handleBegin()}
			>
				{startInfo?.resuming
					? i18n.t('assessment.start.resume', 'Continue')
					: i18n.t('assessment.start.begin', 'Begin')}
			</button>
		</div>
	</svelte:element>
{:else if !player || navState.currentIndex < 0}
	<div class="assessment-loading pie-qti-chrome" lang={interfaceAttributes?.lang} dir={interfaceAttributes?.dir}>
		<div class="assessment-loading-status" role="status" aria-live="polite">
			<span class="assessment-spinner" aria-hidden="true"></span>
			<span>{i18n.t('assessment.loading')}</span>
		</div>
	</div>
{:else}
	<!--
		Embedded, the shell is one region named by the assessment title inside the host
		page. Full-viewport, it is the page: its header, main and nav are landmarks.
	-->
	<svelte:element
		this={fullViewport ? 'div' : 'section'}
		class="assessment-shell pie-qti-chrome"
		class:full-viewport={fullViewport}
		lang={interfaceAttributes?.lang}
		dir={interfaceAttributes?.dir}
		aria-labelledby={fullViewport ? undefined : titleId}
		aria-busy={isSubmitting || navState.isLoading}
	>
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

		<!-- Question content: the scrolling region the skip link leads to -->
		<svelte:element
			this={fullViewport ? 'main' : 'div'}
			bind:this={contentEl}
			id={contentId}
			class="assessment-content"
			class:has-passage={hasSplitPane && !reviewOpen}
			tabindex="-1"
			role={fullViewport ? undefined : 'region'}
			aria-label={i18n?.t('accessibility.itemBody') ?? 'Question content'}
			inert={paused || undefined}
		>
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
					/>
				{/if}
			{/if}
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
				flagged={currentFlagged}
				onToggleFlag={handleToggleFlag}
				showReview={!isComplete && reviewData !== null}
				{reviewOpen}
				onToggleReview={toggleReview}
				showSubmit={submitRequired && !isComplete}
				inert={paused}
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
				{:else}
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
					aria-disabled={isSubmitting ? 'true' : undefined}
					onclick={() => close('confirm')}
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

		<!-- Proctor pause: an overlay replaces the blocked shell, naming the reason. -->
		{#if paused}
			<div class="pause-overlay" data-testid="assessment-pause-overlay">
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
	}
</style>
