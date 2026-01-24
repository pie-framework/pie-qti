<script lang="ts">
	import { onMount } from 'svelte';
	import { assignProps } from '../utils/assignProps';

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

	function getSecurityConfig() {
		if (typeof window === 'undefined') return {};
		return {
			urlPolicy: {
				assetBaseUrl: `${window.location.origin}/`,
			},
		};
	}

	function updatePlayerProperties() {
		if (!playerElement || !isReady) {
			return;
		}

		if (!assessmentTestXml) {
			console.error('[Qti2AssessmentPlayer] ERROR: assessmentTestXml is empty/undefined!');
			return;
		}

		assignProps(playerElement, {
			assessmentTestXml,
			items,
			config: {
				role: config.role || 'candidate',
				navigationMode: config.navigationMode,
				showSections: config.showSections !== false,
			},
			security: getSecurityConfig(),
		});
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
	<!-- Only render the player when we have assessment XML -->
	{#if assessmentTestXml}
		<pie-qti2-assessment-player bind:this={playerElement} class="block w-full min-h-[400px]"></pie-qti2-assessment-player>
	{:else}
		<div class="alert alert-info">
			<span>Waiting for assessment data...</span>
		</div>
	{/if}
{/if}
