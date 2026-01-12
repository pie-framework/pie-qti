<script lang="ts">
	import { onMount } from 'svelte';

	const {
		assessmentTestXml,
		items = {},
		config = {},
		identifier = 'assessment',
		title
	}: {
		assessmentTestXml: string;
		items?: Record<string, string>;
		config?: {
			role?: 'candidate' | 'scorer' | 'author' | 'tutor' | 'proctor' | 'testConstructor';
			navigationMode?: 'linear' | 'nonlinear';
			showSections?: boolean;
		};
		identifier?: string;
		title?: string;
	} = $props();

	let playerElement = $state<any>(null);
	let error = $state<string | null>(null);
	let isLoading = $state(true);
	let isReady = $state(false);

	// Track current values to detect changes
	let currentXml = '';
	let currentItemsJson = '';

	function getSecurityConfig() {
		if (typeof window === 'undefined') return {};
		return {
			urlPolicy: {
				assetBaseUrl: `${window.location.origin}/`,
			},
		};
	}

	function updatePlayerProperties() {
		if (!playerElement || !isReady) return;

		const itemsJson = JSON.stringify(items);
		const xmlChanged = assessmentTestXml !== currentXml;
		const itemsChanged = itemsJson !== currentItemsJson;

		if (xmlChanged || itemsChanged) {
			playerElement.assessmentTestXml = assessmentTestXml;
			playerElement.items = items;
			playerElement.config = {
				role: config.role || 'candidate',
				navigationMode: config.navigationMode,
				showSections: config.showSections !== false
			};
			playerElement.security = getSecurityConfig();

			currentXml = assessmentTestXml;
			currentItemsJson = itemsJson;
		}
	}

	onMount(async () => {
		try {
			// Load web components
			await import('@pie-qti/web-component-loaders').then((m) => m.loadPieQtiPlayerElements());
			await customElements.whenDefined('pie-qti2-assessment-player');

			isLoading = false;
			isReady = true;

			// Set initial properties after component is ready
			updatePlayerProperties();
		} catch (err) {
			isLoading = false;
			error = err instanceof Error ? err.message : String(err);
			console.error('[Qti2AssessmentPlayer] Error loading web components:', err);
		}
	});

	// Update player properties when they change (using $effect for reactivity)
	$effect(() => {
		// Create dependencies on props
		void assessmentTestXml;
		void items;
		void config;

		updatePlayerProperties();
	});
</script>

{#if error}
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
		<div class="flex-1">
			<h3 class="font-bold">Error loading QTI assessment player</h3>
			<div class="text-sm whitespace-pre-wrap font-mono mt-2">{error}</div>
		</div>
	</div>
{:else if isLoading}
	<div class="flex items-center justify-center p-8">
		<span class="loading loading-spinner loading-lg"></span>
		<span class="ml-4">Loading QTI assessment player...</span>
	</div>
{:else}
	<pie-qti2-assessment-player bind:this={playerElement} class="block w-full min-h-[400px]"></pie-qti2-assessment-player>
{/if}
