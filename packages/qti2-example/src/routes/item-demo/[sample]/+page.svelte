<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Player,
		type QTIRole,
		type RubricBlock,
	} from '@pie-qti/qti2-item-player';
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	import { onMount, untrack } from 'svelte';
	import { SAMPLE_ITEMS } from '$lib/sample-items';
	import ConfigurationPanel from './components/ConfigurationPanel.svelte';
	import QuestionPanel from './components/QuestionPanel.svelte';
	import ResizableDivider from './components/ResizableDivider.svelte';
	import ResultsPanel from './components/ResultsPanel.svelte';
	import SettingsPanel from './components/SettingsPanel.svelte';
	import { exportToCsv, exportToJson } from './lib/export-utils';
	import * as PanelResize from './lib/panel-resize';
	import { loadSessionFromServer, saveSessionToServer } from './lib/session-api';
	import type { SessionData } from './lib/types';

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
		responses = { ...responses, [responseId]: value };
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

	// React to URL parameter changes
	$effect(() => {
		// Read sample ID from URL path parameter
		const urlSampleId = $page.params.sample;
		if (urlSampleId && SAMPLE_ITEMS.find((item) => item.id === urlSampleId)) {
			selectedSampleId = urlSampleId;
			const xml = SAMPLE_ITEMS.find((item) => item.id === urlSampleId)?.xml || '';
			xmlContent = xml;
			// Use untrack to prevent tracking selectedRole as a dependency
			// This prevents infinite loops when loadPlayer reads selectedRole
			untrack(() => loadPlayer(xml));
		} else if (urlSampleId) {
			// Invalid sample - redirect to default
			goto(`${base}/item-demo/simple-choice`, { replaceState: true, noScroll: true });
		}
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
	<title>Player Demo - PIE QTI 2.2 Player</title>
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
				onSampleChange={handleSampleChange}
				onXmlChange={handleXmlChange}
			/>

			<SettingsPanel
				bind:selectedRole
				bind:useBackendScoring
				{sessionId}
				{isSaving}
				hasPlayer={player !== null}
				{templateVariables}
				onRegenerateVariant={regenerateVariant}
				onRoleChange={handleRoleChange}
				onBackendScoringChange={() => {}}
				onSaveSession={saveSession}
				onLoadSession={loadSession}
				onExport={exportResponses}
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
					<span>Select a sample item or paste custom XML to get started.</span>
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
