<script lang="ts">
	
	import { typesetAction } from '@pie-qti/qti2-default-components/shared';
	import ItemBody from '@pie-qti/qti2-default-components/shared/components/ItemBody.svelte';
import { Player, type QTIRole } from '@pie-qti/qti2-item-player';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';

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

	let player = $state<Player | null>(null);
	let responses = $state<Record<string, any>>({});
	let error = $state<string | null>(null);
	let isLoading = $state(false);
	let loadTimeout: ReturnType<typeof setTimeout> | null = null;

	// Track last inputs using plain variables (NOT $state) to avoid re-triggering $effect
	let lastKey = '';

	// Clear timeout on unmount
	$effect(() => {
		return () => {
			if (loadTimeout) {
				clearTimeout(loadTimeout);
			}
		};
	});

	// Initialize/update player when itemXml or role changes
	$effect(() => {
		// Clear any existing timeout
		if (loadTimeout) {
			clearTimeout(loadTimeout);
			loadTimeout = null;
		}

		const key = `${role}::${itemXml}`;
		if (key === lastKey) return;
		lastKey = key;

		// Reset state
		player = null;
		responses = {};
		error = null;
		isLoading = true;

		if (!itemXml || itemXml.trim() === '') {
			isLoading = false;
			error = 'No XML provided';
			return;
		}

		// Set a timeout to detect if loading is stuck
		loadTimeout = setTimeout(() => {
			if (isLoading && !player && !error) {
				isLoading = false;
				error = 'Timeout: Failed to load QTI player. The XML may be invalid or the player encountered an error.';
			}
		}, 5000); // 5 second timeout

		try {
			const p = new Player({
				itemXml,
				role: role as QTIRole,
			});
			player = p;

			// Initialize responses for all interactions
			const interactions = p.getInteractions();
			const newResponses: Record<string, any> = {};
			for (const interaction of interactions) {
				if (interaction?.responseIdentifier) {
					newResponses[interaction.responseIdentifier] = null;
				}
			}
			responses = newResponses;
			
			// Success - clear loading and error
			isLoading = false;
			error = null;
			
			if (loadTimeout) {
				clearTimeout(loadTimeout);
				loadTimeout = null;
			}
		} catch (err) {
			isLoading = false;
			const errorMsg = err instanceof Error ? err.message : String(err);
			const errorStack = err instanceof Error ? err.stack : undefined;
			error = `Failed to load QTI item: ${errorMsg}${errorStack ? `\n\nStack: ${errorStack}` : ''}`;
			player = null;
			responses = {};
			
			if (loadTimeout) {
				clearTimeout(loadTimeout);
				loadTimeout = null;
			}
			
			// Log to console for debugging
			console.error('[Qti2ItemPlayer] Error creating player:', err);
		}
	});

	function handleResponseChange(responseId: string, value: any) {
		responses = { ...responses, [responseId]: value };
	}
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
{:else if player}
	<div class="w-full" use:typesetAction={{ typeset: typesetMathInElement }}>
		<ItemBody {player} {responses} disabled={false} typeset={typesetMathInElement} onResponseChange={handleResponseChange} />
	</div>
{:else}
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
		<span>No player instance available. Please check the console for errors.</span>
	</div>
{/if}
