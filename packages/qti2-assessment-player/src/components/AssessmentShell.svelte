<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { BackendAssessmentPlayerConfig } from '../core/AssessmentPlayer.js';
	import { AssessmentPlayer } from '../core/AssessmentPlayer.js';
	import type { BackendAdapter, InitSessionRequest } from '../integration/api-contract.js';
	import type { AssessmentResults, NavigationState } from '../types/index.js';
	import AccessibilityAnnouncer from './AccessibilityAnnouncer.svelte';
	import AssessmentHeader from './AssessmentHeader.svelte';
	import ItemRenderer from './ItemRenderer.svelte';
	import NavigationBar from './NavigationBar.svelte';
	import RubricDisplay from './RubricDisplay.svelte';
	import SplitPaneResizer from './SplitPaneResizer.svelte';
	import TestFeedback from './TestFeedback.svelte';

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

	let player: AssessmentPlayer | null = $state(null);
	let navState = $state<NavigationState>({
		currentIndex: -1,
		totalItems: 0,
		canNext: false,
		canPrevious: false,
		isLoading: false,
		currentSection: undefined,
		totalSections: undefined,
	});
	let currentQuestion = $state<any>(null);
	let currentRubricBlocks = $state<any[]>([]);
	let currentResponses = $state<Record<string, unknown>>({});
	let sections = $state<any[]>([]);
	let error = $state<string | null>(null);
	let navError = $state<string | null>(null);
	let itemPaneEl = $state<HTMLDivElement | null>(null);
	let rootEl = $state<HTMLElement | null>(null);
	let testFeedback = $state<Array<{ identifier: string; content: string; access: string }>>([]);
	let isComplete = $state(false);
	let initTimeout: ReturnType<typeof setTimeout> | null = null;
	let hasFirstItem = $state(false);
	let announcer = $state<AccessibilityAnnouncer | null>(null);

	const passageBlocks = $derived(currentRubricBlocks.filter((b) => b?.use === 'passage'));
	const nonPassageRubricBlocks = $derived(currentRubricBlocks.filter((b) => b?.use !== 'passage'));
	const hasPassage = $derived(passageBlocks.length > 0);

	// Fallback: listen at the shell root for any `qti-change` custom events from nested
	// web components. Use a reactive effect so we attach even if `rootEl` is set after mount.
	function handleRootQtiChange(e: Event) {
		const ce = e as CustomEvent;
		const detail = (ce as any).detail;
		if (!detail) return;
		const { responseId, value } = detail;
		if (responseId) {
			handleResponseChange(responseId, value);
		}
	}

	$effect(() => {
		if (!rootEl) return;
		rootEl.addEventListener('qti-change', handleRootQtiChange as EventListener);
		return () => rootEl?.removeEventListener('qti-change', handleRootQtiChange as EventListener);
	});

	// Initialize player
	onMount(() => {
		// Capture bubbled `qti-change` events at the document level as a safety net.
		// This ensures responses are recorded even if an intermediate renderer misses the event.
		const handleDocumentQtiChange = (e: Event) => {
			const ce = e as CustomEvent;
			const detail = (ce as any).detail;
			if (!detail) return;
			const { responseId, value } = detail;
			if (responseId) handleResponseChange(responseId, value);
		};
		document.addEventListener('qti-change', handleDocumentQtiChange as EventListener);

		// Never allow infinite "Loading assessment..." state
		initTimeout = setTimeout(() => {
			if (!hasFirstItem && !error) {
				error =
					'Timeout loading assessment. This assessment may be invalid or the player failed to initialize.';
			}
		}, 10000);

		const playerConfig: BackendAssessmentPlayerConfig = {
			backend,
			initSession,
			showSections: config.showSections !== false,
			allowSectionNavigation: config.allowSectionNavigation !== false,
			showProgress: config.showProgress !== false,
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
			});

			// If backend did not restore a current item, start at index 0.
			if (player.getNavigationState().currentIndex < 0) {
				await player.navigateTo(0);
			}
		})().catch((err) => {
			console.error('Failed to initialize assessment player:', err);
			error = err instanceof Error ? err.message : 'Failed to initialize player';
		});

		return () => {
			document.removeEventListener('qti-change', handleDocumentQtiChange as EventListener);
			rootEl?.removeEventListener('qti-change', handleRootQtiChange as EventListener);
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
		currentQuestion = player.getCurrentQuestion();
		currentRubricBlocks = player.getCurrentRubricBlocks();
		currentResponses = player.getResponses();
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
			navError = err instanceof Error ? err.message : 'Failed to navigate to previous question';
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
			navError = err instanceof Error ? err.message : 'Failed to navigate to next question';
		}
	}

	/**
	 * Announce current question to screen readers
	 */
	function announceCurrentQuestion() {
		if (!player) return;
		const state = player.getNavigationState();
		const msg = `Question ${state.currentIndex + 1} of ${state.totalItems}`;
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
			error = err instanceof Error ? err.message : 'Failed to submit assessment';
		}
	}

	function handleResponseChange(responseId: string, value: unknown) {
		if (!player) return;
		if (currentQuestion?.identifier) {
			player.updateResponseForItem(currentQuestion.identifier, responseId, value);
		} else {
			player.updateResponse(responseId, value);
		}
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
		<div class="alert alert-error">
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
		<div class="flex items-center justify-center p-8">
			<span class="loading loading-spinner loading-lg"></span>
			<span class="ml-4">Loading assessment...</span>
		</div>
	</div>
{:else}
	<div bind:this={rootEl} class="assessment-shell" role="application" aria-label="Assessment player">
		<!-- Header with title and section menu -->
		<AssessmentHeader
			title={initSession.assessmentId || 'Assessment'}
			{sections}
			currentSectionIndex={navState.currentSection?.index}
			showSections={config.showSections}
			allowSectionNavigation={config.allowSectionNavigation}
			onSectionSelect={handleSectionSelect}
		/>

		<!-- Test Feedback (shown after completion) -->
		{#if isComplete && testFeedback.length > 0}
			<TestFeedback feedback={testFeedback} />
		{/if}

		{#if navError}
			<div class="assessment-nav-error">
				<div class="alert alert-warning">
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
			class:has-passage={hasPassage}
			class="assessment-content"
			tabindex="-1"
			role="region"
			aria-label="Question content"
			aria-live="polite"
		>
			{#if hasPassage}
				<SplitPaneResizer
					leftContent={passageBlocks}
					{typeset}
					storageKey="pie-qti22-assessment-player.splitLeftPct"
					onRightPaneReady={(el) => itemPaneEl = el}
				>
					{#if nonPassageRubricBlocks.length > 0}
						<RubricDisplay blocks={nonPassageRubricBlocks} {typeset} />
					{/if}

					{#if currentQuestion}
						<ItemRenderer
							questionRef={currentQuestion}
							responses={currentResponses}
							role={config.role || 'candidate'}
							extendedTextEditor={config.extendedTextEditor || 'tiptap'}
							onResponseChange={handleResponseChange}
							{typeset}
						/>
					{/if}
				</SplitPaneResizer>
			{:else}
				<!-- Rubric blocks (passages, instructions) -->
				{#if currentRubricBlocks.length > 0}
					<RubricDisplay blocks={currentRubricBlocks} {typeset} />
				{/if}

				<!-- Current item -->
				{#if currentQuestion}
					<ItemRenderer
						questionRef={currentQuestion}
						responses={currentResponses}
						role={config.role || 'candidate'}
						onResponseChange={handleResponseChange}
						{typeset}
					/>
				{/if}
			{/if}
		</div>

		<!-- Navigation bar -->
		<NavigationBar
			navState={navState}
			onPrevious={handlePrevious}
			onNext={handleNext}
			onSubmit={handleSubmit}
			showProgress={config.showProgress !== false}
		/>
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
