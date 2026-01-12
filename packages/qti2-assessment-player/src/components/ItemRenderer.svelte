<script lang="ts">

	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/qti2-item-player/components';
	import { Player, type PlayerSecurityConfig, type QTIRole } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import { onMount } from 'svelte';
	import type { QuestionRef } from '../types/index.js';

	/**
	 * Ensure default interaction web components are registered (browser-only).
	 *
	 * NOTE: `@pie-qti/qti2-default-components/plugins` has side effects (customElements.define),
	 * so we only load it on the client to remain SSR-safe.
	 */
	let pluginsLoadPromise: Promise<void> | null = null;
	function ensureDefaultPluginsLoaded() {
		if (pluginsLoadPromise) return pluginsLoadPromise;
		pluginsLoadPromise = import('@pie-qti/qti2-default-components/plugins')
			.then(() => {})
			.catch((err) => {
				console.warn('Failed to load default QTI web components:', err);
			});
		return pluginsLoadPromise;
	}

	onMount(() => {
		void ensureDefaultPluginsLoaded();
	});

	interface Props {
		questionRef: QuestionRef;
		role?: QTIRole;
		extendedTextEditor?: string;
		/** Responses for the current item (keyed by responseIdentifier). */
		responses?: Record<string, any>;
		onResponseChange?: (responseId: string, value: unknown) => void;
		/** Math typesetting function (KaTeX, MathJax, etc.) */
		typeset?: (root: HTMLElement) => void | Promise<void>;
		/** I18n provider for translations */
		i18n?: I18nProvider;
		/** Security configuration for URL policy and content restrictions */
		security?: PlayerSecurityConfig;
	}

	const {
		questionRef,
		role = 'candidate',
		extendedTextEditor: _extendedTextEditor,
		responses = {},
		onResponseChange,
		typeset,
		i18n,
		security,
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
				security,
			});

			// Ensure the item player can actually render interactions by registering the
			// default component set into this player's component registry.
			registerDefaultComponents(newPlayer.getComponentRegistry());

			return {
				player: newPlayer,
				error: null,
			};
		} catch (err) {
			console.error('Failed to initialize item player:', err);
			return {
				player: null,
				error: err instanceof Error ? err.message : 'Failed to load item',
			};
		}
	});

	// Handle response changes
	function handleResponseChange(responseId: string, value: any) {
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
		<span>{i18n?.t('item.loadError', 'Error loading item: {error}', { error: playerData.error })}</span>
	</div>
{:else if !playerData.player}
	<div class="flex items-center justify-center p-8">
		<span class="loading loading-spinner loading-lg"></span>
		<span class="ml-4">{i18n?.t('item.loading', 'Loading item...')}</span>
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
				{i18n}
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
