<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Player,
		type QTIRole,
		type RubricBlock,
	} from '@pie-qti/item-player';
	import { registerDefaultComponents } from '@pie-qti/default-components';
	import { onMount, untrack, getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/i18n';
	import { SAMPLE_ITEMS } from '$lib/sample-items';
	import { getItemXmlForLocale, hasMultilingualVariants } from '$lib/locale-aware-items';
	import { getSecurityConfig } from '$lib/player-config';
	import ConfigurationPanel from './components/ConfigurationPanel.svelte';
	import QuestionPanel from './components/QuestionPanel.svelte';
	import ResizableDivider from './components/ResizableDivider.svelte';
	import ResultsPanel from './components/ResultsPanel.svelte';
	import SettingsPanel from './components/SettingsPanel.svelte';
	import { exportToCsv, exportToJson } from './lib/export-utils';
	import * as PanelResize from './lib/panel-resize';
	import { loadSessionFromServer, saveSessionToServer } from './lib/session-api';
	import type { SessionData } from './lib/types';
	// Import custom operator for drawing scoring
	import { hasLineOperator } from '$lib/drawing-scoring';

	// Get i18n provider from context (set in root layout)
	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = $derived(i18nContext?.value ?? null);

	// State
	let selectedSampleId = $state('simple-choice');
	let xmlContent = $state('');
	let player = $state<Player | null>(null);
	let responses = $state<Record<string, any>>({});
	let scoringResult = $state<any>(null);
	let errorMessage = $state('');
	let useBackendScoring = $state(false);
	let sessionId = $state<string | null>(null);
	let isSaving = $state(false);
	let isSubmitting = $state(false);
	let selectedRole = $state<QTIRole>('candidate');
	let rubrics = $state<RubricBlock[]>([]);
	let templateVariables = $derived(player ? player.getTemplateVariables() : {});
	let hasLoadedCustomUpload = false; // Track if we've loaded a custom upload in this effect cycle

	// Panel resize state
	let leftPanelWidth = $state(50);
	let isDragging = $state(false);

	// Progress tracking (derived from player) - delegated to Player APIs
	let progress = $derived(player ? player.getProgress(responses) : null);
	let totalInteractions = $derived(progress?.total ?? 0);
	let answeredCount = $derived(progress?.answered ?? 0);
	let progressPercentage = $derived(
		totalInteractions > 0 ? (answeredCount / totalInteractions) * 100 : 0
	);

	// Load player
	function loadPlayer(xml: string) {
		try {
			errorMessage = '';
			scoringResult = null;

			if (!xml.trim()) {
				player = null;
				responses = {};
				return;
			}

			const newPlayer = new Player({
				itemXml: xml,
				role: selectedRole,
				security: getSecurityConfig(),
				customOperators: {
					'drawing.hasLine': hasLineOperator,
				},
			});

			// Register default components with the player's registry
			registerDefaultComponents(newPlayer.getComponentRegistry());

			player = newPlayer;
			rubrics = player.getRubrics();

			// Initialize responses for response interactions (delegated to Player APIs)
			const interactions = newPlayer.getResponseInteractions();
			const newResponses: Record<string, any> = {};
			for (const interaction of interactions) {
				if (interaction?.responseIdentifier) {
					newResponses[interaction.responseIdentifier] = null;
				}
			}
			responses = newResponses;
		} catch (err: any) {
			player = null;
			responses = {};
			errorMessage = err.message;
		}
	}

	// Event handlers
	function handleSampleChange(id: string) {
		// Use full page reload for fast, reliable navigation with proper math rendering
		window.location.href = `${base}/item-demo/${encodeURIComponent(id)}`;
	}

	function handleXmlChange(newXml: string) {
		xmlContent = newXml;
		loadPlayer(newXml);
	}

	function handleRoleChange() {
		if (xmlContent) {
			loadPlayer(xmlContent);
		}
	}

	function handleResponseChange(responseId: string, value: any) {
		console.log('[Demo] Response changed:', { responseId, value, valueType: typeof value, isArray: Array.isArray(value), arrayLength: Array.isArray(value) ? value.length : 'N/A' });
		responses = { ...responses, [responseId]: value };
		console.log('[Demo] All responses:', responses);
		if (player) {
			const validation = player.validateResponses(responses);
			console.log('[Demo] Validation result:', validation);
			const canSubmit = player.canSubmitResponses(responses);
			console.log('[Demo] Can submit:', canSubmit);
		}
	}

	async function submitResponses() {
		if (!player) return;

		try {
			errorMessage = '';
			isSubmitting = true;

			if (useBackendScoring) {
				const response = await fetch('/api/score', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						itemXml: xmlContent,
						responses,
					}),
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || 'Failed to score responses');
				}

				scoringResult = data.result;
			} else {
				player.setResponses(responses);
				scoringResult = player.processResponses();
			}
		} catch (err: any) {
			errorMessage = err.message;
		} finally {
			isSubmitting = false;
		}
	}

	function resetResponses() {
		if (!player) return;

		const interactions = player.getResponseInteractions();
		const newResponses: Record<string, any> = {};
		for (const interaction of interactions) {
			if (interaction?.responseIdentifier) {
				newResponses[interaction.responseIdentifier] = null;
			}
		}

		responses = newResponses;
		scoringResult = null;
		errorMessage = '';
	}

	function regenerateVariant() {
		// New player instance => templateProcessing re-runs, producing a fresh variant
		if (!xmlContent.trim()) return;
		loadPlayer(xmlContent);
	}

	async function saveSession() {
		try {
			isSaving = true;
			errorMessage = '';

			const sessionData: SessionData = {
				selectedSampleId,
				itemXml: xmlContent,
				responses,
				scoringResult,
			};

			const newSessionId = await saveSessionToServer(sessionId, sessionData);
			sessionId = newSessionId;
			alert(`Session saved! ID: ${sessionId}`);
		} catch (err: any) {
			errorMessage = err.message;
		} finally {
			isSaving = false;
		}
	}

	async function loadSession() {
		const id = prompt('Enter session ID:');
		if (!id) return;

		try {
			errorMessage = '';

			const sessionData = await loadSessionFromServer(id);

			selectedSampleId = sessionData.selectedSampleId || 'simple-choice';
			xmlContent = sessionData.itemXml || '';
			responses = sessionData.responses || {};
			scoringResult = sessionData.scoringResult || null;
			sessionId = id;

			if (sessionData.itemXml) {
				loadPlayer(sessionData.itemXml);
			}

			alert('Session loaded successfully!');
		} catch (err: any) {
			errorMessage = err.message;
		}
	}

	function exportResponses(format: 'json' | 'csv') {
		if (!player) return;

		try {
			if (format === 'json') {
				exportToJson({
					timestamp: new Date().toISOString(),
					sampleId: selectedSampleId,
					responses,
					scoringResult,
				});
			} else {
				exportToCsv(responses, scoringResult);
			}
		} catch (err: any) {
			errorMessage = `Export failed: ${err.message}`;
		}
	}

	// Panel resizing
	function handleDividerMouseDown(event: MouseEvent) {
		PanelResize.handleDividerMouseDown(event, (dragging) => (isDragging = dragging));
	}

	function handleMouseMove(event: MouseEvent) {
		PanelResize.handleMouseMove(event, isDragging, (width) => (leftPanelWidth = width));
	}

	function handleMouseUp() {
		PanelResize.handleMouseUp((dragging) => (isDragging = dragging));
	}

	function handleDividerKeyDown(event: KeyboardEvent) {
		PanelResize.handleDividerKeyDown(event, leftPanelWidth, (width) => (leftPanelWidth = width));
	}

	// React to URL parameter changes and locale changes
	$effect(() => {
		// Read dependencies - effect will re-run when these change
		const urlSampleId = $page.params.sample;
		const i18nProvider = i18n;
		const currentLocale = i18nProvider?.getLocale() ?? 'en-US';

		// Early return if no valid sample ID
		if (!urlSampleId) return;

		// Reset the flag when navigating TO a non-custom page
		if (urlSampleId !== 'custom') {
			hasLoadedCustomUpload = false;
		}

		// Handle 'custom' sample ID for uploaded files
		if (urlSampleId === 'custom') {
			// Check for uploaded XML from sessionStorage (only if we haven't loaded it yet)
			const uploadedXml = !hasLoadedCustomUpload ? sessionStorage.getItem('uploadedItemXml') : null;
			const uploadedName = !hasLoadedCustomUpload ? sessionStorage.getItem('uploadedItemName') : null;

			console.log('[ItemDemo] custom effect - uploadedXml:', uploadedXml?.length, 'hasLoadedCustomUpload:', hasLoadedCustomUpload, 'current xmlContent:', xmlContent.length);

			if (uploadedXml && !hasLoadedCustomUpload) {
				console.log('[ItemDemo] Found uploaded XML:', uploadedName);

				// Mark that we've loaded the upload
				hasLoadedCustomUpload = true;

				// Clear the stored data
				sessionStorage.removeItem('uploadedItemXml');
				sessionStorage.removeItem('uploadedItemName');

				// Load the uploaded XML
				untrack(() => {
					xmlContent = uploadedXml;
					selectedSampleId = '';
					console.log('[ItemDemo] Set xmlContent to:', xmlContent.length);
					loadPlayer(uploadedXml);
				});
			} else {
				console.log('[ItemDemo] No uploaded XML in sessionStorage or already loaded');
				// No uploaded XML, just set selectedSampleId to empty
				untrack(() => {
					selectedSampleId = '';
				});
			}
			return;
		}

		// Validate sample exists
		if (!SAMPLE_ITEMS.find((item) => item.id === urlSampleId)) {
			// Invalid sample - redirect to default
			goto(`${base}/item-demo/simple-choice`, { replaceState: true, noScroll: true });
			return;
		}

		console.log('[ItemDemo] Loading item:', urlSampleId, 'Locale:', currentLocale);

		// Use AbortController to cancel in-flight requests when effect re-runs
		// This is the standard pattern for async operations in effects
		const abortController = new AbortController();
		const signal = abortController.signal;

		// Clean up previous player instance before creating a new one
		// Use untrack to prevent reactive updates from triggering the effect again
		untrack(() => {
			if (player) {
				player = null;
				responses = {};
				scoringResult = null;
			}
			selectedSampleId = urlSampleId;
		});

		// Use locale-aware XML loading - automatically gets the right language variant
		getItemXmlForLocale(urlSampleId, currentLocale)
			.then((xml) => {
				// Ignore results if this effect has been superseded (standard cancellation pattern)
				if (signal.aborted) return;

				// Use untrack to prevent reactive updates from triggering the effect
				// This is the standard pattern when updating state from async operations
				untrack(() => {
					xmlContent = xml;
					loadPlayer(xml);
				});
			})
			.catch((err) => {
				// Ignore errors if this effect has been superseded
				if (signal.aborted) return;

				console.error('[ItemDemo] Error loading XML:', err);
				untrack(() => {
					errorMessage = err instanceof Error ? err.message : String(err);
				});
			});

		// Cleanup function: abort in-flight requests when effect re-runs or component unmounts
		// This is the standard Svelte 5 pattern for async cleanup
		return () => {
			abortController.abort();
		};
	});

	// Keyboard shortcuts
	onMount(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
				event.preventDefault();
				if (scoringResult === null && answeredCount > 0 && !isSubmitting) {
					submitResponses();
				}
			} else if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
				event.preventDefault();
				if (scoringResult !== null) {
					resetResponses();
				}
			} else if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
				event.preventDefault();
				if (player && Object.keys(responses).length > 0) {
					exportResponses('json');
				}
			} else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
				event.preventDefault();
				if (player && !isSaving) {
					saveSession();
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<svelte:window onmouseup={handleMouseUp} />

<svelte:head>
	<title>{i18n?.t('demo.pageTitle') ?? 'Player Demo - PIE QTI 2.2 Player'}</title>
</svelte:head>

<div class="container mx-auto px-8 py-12">
	<div
		class="flex flex-col xl:flex-row gap-0 relative min-w-0"
		onmousemove={handleMouseMove}
		role="group"
		aria-label="Resizable item demo panels"
	>
		<!-- Left Panel: Configuration -->
		<div
			class="space-y-6 w-full xl:w-[calc(var(--left-panel-width)*1%)] xl:min-w-[300px] xl:pr-4 min-w-0"
			style="--left-panel-width: {leftPanelWidth};"
		>
			<ConfigurationPanel
				bind:selectedSampleId
				bind:xmlContent
				bind:selectedRole
				onSampleChange={handleSampleChange}
				onXmlChange={handleXmlChange}
				onRoleChange={handleRoleChange}
			/>
		</div>

		<!-- Draggable Divider (desktop only) -->
		<div class="hidden xl:block">
			<ResizableDivider
				{isDragging}
				{leftPanelWidth}
				onMouseDown={handleDividerMouseDown}
				onKeyDown={handleDividerKeyDown}
			/>
		</div>

		<!-- Right Panel: Player -->
		<div
			class="space-y-6 w-full xl:w-[calc((100-var(--left-panel-width))*1%)] xl:min-w-[300px] xl:pl-4 min-w-0"
			style="--left-panel-width: {leftPanelWidth};"
		>
			{#if errorMessage}
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
					<span>{errorMessage}</span>
				</div>
			{/if}

			{#if player && !errorMessage}
				<QuestionPanel
					{player}
					{rubrics}
					{responses}
					{scoringResult}
					{answeredCount}
					{totalInteractions}
					{progressPercentage}
					{isSubmitting}
					{i18n}
					disabled={scoringResult !== null}
					role={selectedRole}
					onResponseChange={handleResponseChange}
					onSubmit={submitResponses}
					onReset={resetResponses}
				/>

				<ResultsPanel {scoringResult} />
			{:else if !errorMessage}
				<div class="alert alert-info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="stroke-current shrink-0 w-6 h-6"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<span>{i18n?.t('demo.selectItemOrPasteXml') ?? 'Select a sample item or paste custom XML to get started.'}</span>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Prevent text selection during drag */
	:global(body.resizing) {
		cursor: col-resize !important;
		user-select: none;
	}
</style>
