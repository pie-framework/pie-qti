<script lang="ts">
	import { onMount, tick, getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/i18n';
	import type { QtiSharedHtmlBlock } from '@pie-qti/section-player';
	import { SectionPlayerSplitPane, SectionPlayerVertical, TestFeedback as SectionTestFeedback } from '../../../section-player/src/components/index.js';
	import type { BackendAssessmentPlayerConfig } from '../core/AssessmentPlayer.js';
	import { AssessmentPlayer } from '../core/AssessmentPlayer.js';
	import type { BackendAdapter, InitSessionRequest } from '../integration/api-contract.js';
	import { toSectionComposition } from '../integration/toSectionComposition.js';
	import type { AssessmentResults, NavigationState } from '../types/index.js';
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
	}

	const { backend, initSession, config = {}, onSubmit, typeset }: Props = $props();

	// Get i18n from context (set by +layout.svelte)
	const contextI18nWrapper = getContext<{ value: SvelteI18nProvider | null } | undefined>('i18n');
	const contextI18n = $derived(contextI18nWrapper?.value);

	let player = $state<AssessmentPlayer | null>(null);
	const i18n = $derived(player?.getI18nProvider() ?? contextI18n);
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
	let sections = $state<any[]>([]);
	let error = $state<string | null>(null);
	let navError = $state<string | null>(null);
	let itemPaneEl = $state<HTMLElement | null>(null);
	let rootEl = $state<HTMLElement | null>(null);
	let testFeedback = $state<Array<{ identifier: string; content: string; access: string }>>([]);
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
	const extendedTextEditor = $derived(
		config.extendedTextEditor === 'textarea' || config.extendedTextEditor === 'tiptap'
			? config.extendedTextEditor
			: undefined
	);
	const testFeedbackBlocks = $derived<QtiSharedHtmlBlock[]>(
		testFeedback.map((item) => ({
			identifier: item.identifier,
			kind: 'test-feedback',
			scope: 'assessment',
			rawHtml: item.content,
		}))
	);

	// Initialize player
	onMount(() => {
		// Never allow infinite "Loading assessment..." state
		initTimeout = setTimeout(() => {
			if (!hasFirstItem && !error) {
				error = contextI18n?.t('assessment.loadingError') ?? 'assessment.loadingError';
				announcer?.announce(error, 3000, 'assertive');
			}
		}, 10000);

		const playerConfig: BackendAssessmentPlayerConfig = {
			backend,
			initSession,
			showSections: config.showSections !== false,
			allowSectionNavigation: config.allowSectionNavigation !== false,
			showProgress: config.showProgress !== false,
			i18nProvider: contextI18n, // Pass i18n from context
			...config,
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
				itemPaneEl?.scrollTo({ top: 0, behavior: 'auto' });
			});

			player.onSectionChange(() => {
				updateState();
			});

			player.onResponseChange((responses) => {
				currentResponses = responses;
				responseVersion += 1;
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
			error = err instanceof Error ? err.message : (contextI18n?.t('assessment.loadingError') ?? 'assessment.loadingError');
			announcer?.announce(error, 3000, 'assertive');
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
		stateVersion += 1;
	}

	async function handlePrevious() {
		if (!player) return;
		try {
			navError = null;
			await player.previous();
			await manageFocusAfterNavigation();
			announceCurrentQuestion();
		} catch (err) {
			console.error('Previous navigation failed:', err);
			const message = err instanceof Error ? err.message : (i18n?.t('assessment.errors.navigationFailed') ?? 'assessment.errors.navigationFailed');
			navError = message;
		}
	}

	async function handleNext() {
		if (!player) return;
		try {
			navError = null;
			await player.next();
			await manageFocusAfterNavigation();
			announceCurrentQuestion();
		} catch (err) {
			console.error('Next navigation failed:', err);
			const message = err instanceof Error ? err.message : (i18n?.t('assessment.errors.navigationFailed') ?? 'assessment.errors.navigationFailed');
			navError = message;
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

	async function handleSectionSelect(sectionIndex: number) {
		if (!player || !sections[sectionIndex]) return;

		const section = sections[sectionIndex];
		await player.navigateToSection(section.id);
		await manageFocusAfterNavigation();
	}

	/**
	 * Manage focus after navigation to improve accessibility.
	 * Moves focus to the content area so screen reader users are aware of the content change.
	 */
	async function manageFocusAfterNavigation() {
		await tick(); // Wait for DOM updates

		// Try to focus on the item pane (for split pane layout)
		if (itemPaneEl) {
			itemPaneEl.focus();
			return;
		}

		// Otherwise focus on the content area
		const contentEl = document.querySelector('.assessment-content') as HTMLElement;
		if (contentEl) {
			contentEl.focus();
		}
	}

	async function handleSubmit() {
		if (!player) return;

		try {
			const results = await player.submit();
			console.log('Assessment results:', results);

			// Get test feedback based on outcomes
			testFeedback = player.getVisibleFeedback();
			isComplete = true;

			onSubmit?.(results);

			// Could also emit a custom event here
			// Or show results modal
		} catch (err) {
			console.error('Failed to submit assessment:', err);
			const message = err instanceof Error ? err.message : (i18n?.t('assessment.errors.submitFailed') ?? 'assessment.errors.submitFailed');
			error = message;
			announcer?.announce(message, 3000, 'assertive');
		}
	}

	function handleSectionResponseChange(itemIdentifier: string, responseIdentifier: string, value: unknown) {
		player?.updateResponseForItem(itemIdentifier, responseIdentifier, value);
		responseVersion += 1;
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

<!-- Accessibility announcer for screen readers -->
<AccessibilityAnnouncer bind:this={announcer} />

{#if error}
	<div class="assessment-error">
		<div class="alert alert-error" role="alert" aria-live="assertive">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-current shrink-0 h-6 w-6"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>{error}</span>
		</div>
	</div>
{:else if !player || navState.currentIndex < 0}
	<div class="assessment-loading">
		<div class="flex items-center justify-center p-8" role="status" aria-live="polite">
			<span class="loading loading-spinner loading-lg"></span>
			<span class="ml-4">{contextI18n?.t('assessment.loading') ?? 'assessment.loading'}</span>
		</div>
	</div>
{:else}
	<div bind:this={rootEl} class="assessment-shell" role="region" aria-label="Assessment player">
		<!-- Header with title and section menu -->
		<AssessmentHeader
			title={initSession.assessmentId || (i18n?.t('assessment.title') ?? 'Assessment')}
			{sections}
			currentSectionIndex={navState.currentSection?.index}
			showSections={config.showSections}
			allowSectionNavigation={config.allowSectionNavigation}
			onSectionSelect={handleSectionSelect}
		/>

		<!-- Test Feedback (shown after completion) -->
		{#if isComplete && testFeedback.length > 0}
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
				<div class="alert alert-warning" role="alert" aria-live="assertive">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<span>{navError}</span>
				</div>
			</div>
		{/if}

		<!-- Main content area -->
		<div
			class:has-passage={hasSplitPane}
			class="assessment-content"
			tabindex="-1"
			role="region"
			aria-label={i18n?.t('accessibility.itemBody') ?? 'Question content'}
		>
			{#if sectionComposition}
				{#if sectionComposition.layout === 'split-pane'}
					<SectionPlayerSplitPane
						composition={sectionComposition}
						{i18n}
						security={config.security}
						pnp={config.pnp}
						extendedTextEditor={extendedTextEditor}
						{typeset}
						onResponseChange={handleSectionResponseChange}
						onItemPaneReady={(el) => (itemPaneEl = el)}
					/>
				{:else}
					<SectionPlayerVertical
						composition={sectionComposition}
						{i18n}
						security={config.security}
						pnp={config.pnp}
						extendedTextEditor={extendedTextEditor}
						{typeset}
						onResponseChange={handleSectionResponseChange}
						onItemPaneReady={(el) => (itemPaneEl = el)}
					/>
				{/if}
			{/if}
		</div>

		<!-- Navigation bar -->
		{#if i18n}
			<NavigationBar
				navState={navState}
				{i18n}
				onPrevious={handlePrevious}
				onNext={handleNext}
				onSubmit={handleSubmit}
				showProgress={config.showProgress !== false}
			/>
		{/if}
	</div>
{/if}

<style>
	.assessment-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		background: var(--color-base-100);
	}

	.assessment-content {
		flex: 1;
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
		overflow: auto;
	}

	.assessment-content:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.assessment-content.has-passage {
		padding: 0;
		max-width: none;
		overflow: hidden;
	}

	.assessment-error,
	.assessment-loading {
		padding: 2rem;
	}

	.assessment-nav-error {
		padding: 1rem 2rem 0;
	}

	@media (max-width: 768px) {
		.assessment-content {
			padding: 1rem;
		}

		.assessment-content.has-passage {
			padding: 0;
		}
	}
</style>
