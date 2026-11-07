<script lang="ts">
	import { onMount, tick, getContext } from 'svelte';
	import { DefaultI18nProvider, interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	import type { QtiSharedHtmlBlock } from '@pie-qti/section-player';
	import {
		PlayerBaseStyles,
		SectionPlayerSplitPane,
		SectionPlayerVertical,
		TestFeedback as SectionTestFeedback,
	} from '../../../section-player/src/components/index.js';
	import type { BackendAssessmentPlayerConfig } from '../core/AssessmentPlayer.js';
	import { AssessmentPlayer } from '../core/AssessmentPlayer.js';
	import { assessmentErrorDisplay, isAssessmentPlayerError } from '../core/errors.js';
	import type { BackendAdapter, InitSessionRequest } from '../integration/api-contract.js';
	import { toSectionComposition } from '../integration/toSectionComposition.js';
	import type {
		AssessmentResults,
		CandidateSectionView,
		NavigationState,
		VisibleTestFeedback,
	} from '../types/index.js';
	import AccessibilityAnnouncer from './AccessibilityAnnouncer.svelte';
	import AssessmentHeader from './AssessmentHeader.svelte';
	import NavigationBar from './NavigationBar.svelte';

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
	}

	const { backend, initSession, config = {}, onSubmit, typeset, fullViewport = false, headingLevel }: Props = $props();

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
	// The section menu only offers legal navigation targets for the current
	// navigationMode (linear: none beyond staying; nonlinear: the current test part).
	const menuSections = $derived(
		sections
			.filter((section) => section.navigable)
			.map((section, index) => ({ ...section, index })),
	);
	const menuCurrentSectionIndex = $derived(
		navState.currentSection ? menuSections.find((s) => s.id === navState.currentSection?.id)?.index : undefined,
	);
	// The assessmentTest `title`, else a localized generic title — never the identifier.
	const assessmentTitle = $derived(player?.getAssessmentTitle() ?? i18n.t('assessment.title', 'Assessment'));

	// Initialize player
	onMount(() => {
		// Never allow infinite "Loading assessment..." state
		initTimeout = setTimeout(() => {
			if (!hasFirstItem && !error) {
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
			i18nProvider: playerI18n,
		};

		(async () => {
			player = await AssessmentPlayer.create(playerConfig);

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

			// Terminal branching (QTI EXIT_TEST) finalizes the core like a normal submit;
			// the shell shows the same completed state without a submit call.
			player.onComplete(() => {
				isComplete = true;
				sections = player?.getAllSections() ?? [];
				updateState();
			});

			// If backend did not restore a current item, start at index 0.
			if (player.getNavigationState().currentIndex < 0) {
				await player.navigateTo(0);
			} else {
				updateState();
				hasFirstItem = true;
				if (initTimeout) {
					clearTimeout(initTimeout);
					initTimeout = null;
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

	function updateState() {
		if (!player) return;

		navState = player.getNavigationState();
		currentItem = player.getCurrentItem();
		currentRubricBlocks = player.getCurrentRubricBlocks();
		currentResponses = player.getResponses();
		testFeedback = player.getVisibleFeedback();
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

	async function handleNext() {
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

	async function handleSectionSelect(menuIndex: number) {
		if (!player || isSubmitting || isComplete || !menuSections[menuIndex]) return;

		const section = menuSections[menuIndex];
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
		await focusQuestion();
	}

	function handleSkipToQuestion(event: MouseEvent) {
		// The question is focused in place; the host page's URL and router stay untouched.
		event.preventDefault();
		void focusQuestion();
	}

	async function handleSubmit() {
		if (!player || isSubmitting || isComplete) return;

		submitError = null;
		isSubmitting = true;
		let results: AssessmentResults;
		try {
			results = await player.submit();
		} catch (err) {
			if (isBusyRejection(err)) {
				isSubmitting = false;
				return;
			}
			console.error('Failed to submit assessment:', err);
			submitError = localizeSubmitError(err);
			// Keep the shell and its session available after the core restores a
			// failed submission. Already accepted responses are retained for retry.
			updateState();
			return;
		} finally {
			isSubmitting = false;
			if (submitError) {
				await tick();
				retryButton?.focus();
			}
		}

		testFeedback = player.getVisibleFeedback();
		sections = player.getAllSections();
		isComplete = true;
		onSubmit?.(results);
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

		<!-- Header with title and section menu (legal navigation targets only) -->
		<AssessmentHeader
			title={assessmentTitle}
			{titleId}
			headingLevel={titleHeadingLevel}
			sections={menuSections}
			currentSectionIndex={menuCurrentSectionIndex}
			showSections={config.showSections}
			allowSectionNavigation={!isSubmitting && !isComplete && config.allowSectionNavigation !== false}
			{i18n}
			onSectionSelect={handleSectionSelect}
		/>

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
			class:has-passage={hasSplitPane}
			tabindex="-1"
			role={fullViewport ? undefined : 'region'}
			aria-label={i18n?.t('accessibility.itemBody') ?? 'Question content'}
		>
			{#if sectionComposition}
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
				<button bind:this={retryButton} type="button" class="retry-button" onclick={handleSubmit} disabled={isSubmitting}>
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
				onSubmit={handleSubmit}
				showProgress={config.showProgress !== false}
			/>
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

	.support-code {
		padding-inline-start: var(--pie-qti-space-2, 0.5rem);
		font-size: 0.85em;
		color: var(--pie-qti-warning-text, #92400e);
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
