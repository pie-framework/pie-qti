<script lang="ts">
	import { onMount } from 'svelte';
	import { assignProps } from '../utils/assignProps';

	const {
		itemXml,
		identifier = 'item',
		title,
		role = 'candidate'
	}: {
		itemXml: string;
		identifier?: string;
		title?: string;
		role?: 'candidate' | 'scorer' | 'author' | 'tutor' | 'proctor' | 'testConstructor';
	} = $props();

	let playerElement = $state<any>(null);
	let error = $state<string | null>(null);
	let isLoading = $state(true);
	let isReady = $state(false);

	// Track current values to detect changes
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
		
		// Debug: log what we're setting
		console.log('[Qti2ItemPlayer] Updating properties:', {
			identifier,
			title,
			role,
			itemXmlLength: itemXml?.length,
			itemXmlPreview: itemXml?.substring(0, 200),
			hasItemXml: !!itemXml
		});
		
		assignProps(playerElement, {
			itemXml,
			role,
			identifier,
			title,
			security: getSecurityConfig(),
		});
		
		// Verify it was set
		if (playerElement.itemXml !== itemXml) {
			console.warn('[Qti2ItemPlayer] Warning: itemXml property may not have been set correctly', {
				expected: itemXml?.substring(0, 100),
				actual: playerElement.itemXml?.substring(0, 100)
			});
		}
	}

	onMount(async () => {
		try {
			// Load web components
			await import('@pie-qti/web-component-loaders').then((m) => m.loadPieQtiPlayerElements());
			await customElements.whenDefined('pie-qti2-item-player');

			isLoading = false;
			isReady = true;

			// Set initial properties after component is ready
			updatePlayerProperties();
		} catch (err) {
			isLoading = false;
			error = err instanceof Error ? err.message : String(err);
			console.error('[Qti2ItemPlayer] Error loading web components:', err);
		}
	});

	// Track previous XML to detect changes
	let previousItemXml = $state<string | undefined>(undefined);

	// Update player properties when they change (using $effect for reactivity)
	$effect(() => {
		// Create dependencies on props
		const currentXml = itemXml;
		const xmlChanged = currentXml !== previousItemXml;
		
		// Update previous value
		previousItemXml = currentXml;

		// Only update if XML actually changed or component just became ready
		if (xmlChanged || isReady) {
			updatePlayerProperties();
		}
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
			<h3 class="font-bold">Error loading QTI player</h3>
			<div class="text-sm whitespace-pre-wrap font-mono mt-2">{error}</div>
		</div>
	</div>
{:else if isLoading}
	<div class="flex items-center justify-center p-8">
		<span class="loading loading-spinner loading-lg"></span>
		<span class="ml-4">Loading QTI player...</span>
	</div>
{:else}
	<pie-qti2-item-player bind:this={playerElement} class="block w-full"></pie-qti2-item-player>
{/if}
