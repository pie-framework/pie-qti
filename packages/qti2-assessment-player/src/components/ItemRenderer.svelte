<script lang="ts">

	import ItemBody from '@pie-qti/qti2-default-components/shared/components/ItemBody.svelte';
	import { Player, type QTIRole } from '@pie-qti/qti2-item-player';
	import type { QuestionRef } from '../types/index.js';

	interface Props {
		questionRef: QuestionRef;
		role?: QTIRole;
		extendedTextEditor?: string;
		onResponseChange?: (responseId: string, value: unknown) => void;
		/** Math typesetting function (KaTeX, MathJax, etc.) */
		typeset?: (root: HTMLElement) => void | Promise<void>;
	}

	const {
		questionRef,
		role = 'candidate',
		extendedTextEditor: _extendedTextEditor,
		onResponseChange,
		typeset,
	}: Props = $props();

	// Derive player from questionRef
	let playerData = $derived.by(() => {
		if (!questionRef.itemXml) {
			return { player: null, error: 'No item XML provided' };
		}

		try {
			const newPlayer = new Player({
				itemXml: questionRef.itemXml,
				role,
			});

			return {
				player: newPlayer,
				error: null
			};
		} catch (err) {
			console.error('Failed to initialize item player:', err);
			return {
				player: null,
				error: err instanceof Error ? err.message : 'Failed to load item'
			};
		}
	});

	// Get responses from parent or initialize empty
	let responses = $state<Record<string, any>>({});

	// Handle response changes
	function handleResponseChange(responseId: string, value: any) {
		responses = { ...responses, [responseId]: value };
		onResponseChange?.(responseId, value);
	}
</script>

{#if playerData.error}
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
		<span>Error loading item: {playerData.error}</span>
	</div>
{:else if !playerData.player}
	<div class="flex items-center justify-center p-8">
		<span class="loading loading-spinner loading-lg"></span>
		<span class="ml-4">Loading item...</span>
	</div>
{:else}
	<div class="item-container">
		{#if questionRef.title}
			<div class="item-header">
				<h3 class="text-lg font-semibold mb-4">{questionRef.title}</h3>
			</div>
		{/if}

		<div class="item-content">
			<ItemBody
				player={playerData.player}
				{responses}
				disabled={role !== 'candidate'}
				{typeset}
				onResponseChange={handleResponseChange}
			/>
		</div>
	</div>
{/if}

<style>
	.item-container {
		width: 100%;
		padding: 1rem;
	}

	.item-content {
		width: 100%;
	}
</style>
