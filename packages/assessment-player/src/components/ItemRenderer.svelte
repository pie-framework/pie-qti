<script lang="ts">
	import type { PciConfiguration, PlayerSecurityConfig, PnpProfile, QTIRole } from '@pie-qti/item-player';
	import type { InteractionResponseValue } from '@pie-qti/item-player/web-components';
	import type { I18nProvider } from '@pie-qti/i18n';
	import { assignProps } from '@pie-qti/qti-common';
	import { onMount } from 'svelte';
	import type { ItemRef } from '../types/index.js';

	type ItemResponseValue = InteractionResponseValue | null;
	type ItemResponseMap = Record<string, ItemResponseValue>;
	type PieQtiItemPlayerElement = HTMLElement & {
		itemXml?: string;
		role?: QTIRole;
		disabled?: boolean;
		responses?: ItemResponseMap;
		typeset?: (root: HTMLElement) => void | Promise<void>;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		pci?: PciConfiguration;
		pnp?: PnpProfile;
		deliveryContext?: ItemRef['deliveryContext'];
		onResponseChange?: (responseId: string, value: ItemResponseValue) => void;
	};

	interface Props {
		itemRef: ItemRef;
		role?: QTIRole;
		extendedTextEditor?: string;
		/** Responses for the current item (keyed by responseIdentifier). */
		responses?: ItemResponseMap;
		onResponseChange?: (responseId: string, value: ItemResponseValue) => void;
		/** Math typesetting function (KaTeX, MathJax, etc.) */
		typeset?: (root: HTMLElement) => void | Promise<void>;
		/** I18n provider for translations */
		i18n?: I18nProvider;
		/** Security configuration for URL policy and content restrictions */
		security?: PlayerSecurityConfig;
		/** Explicit host trust configuration for Portable Custom Interactions. */
		pci?: PciConfiguration;
		/** QTI 3.0 Personal Needs and Preferences profile */
		pnp?: PnpProfile;
	}

	const {
		itemRef,
		role = 'candidate',
		extendedTextEditor: _extendedTextEditor,
		responses = {},
		onResponseChange,
		typeset,
		i18n,
		security,
		pci,
		pnp,
	}: Props = $props();

	let playerLoaded = $state(false);
	let errorMessage = $state<string | null>(null);

	onMount(() => {
		let cancelled = false;
		void import('@pie-qti/item-player/element')
			.then(() => {
				if (!cancelled) {
					playerLoaded = true;
				}
			})
			.catch((error) => {
				if (!cancelled) {
					errorMessage =
						error instanceof Error ? error.message : 'Unable to load the QTI item player.';
				}
			});

		return () => {
			cancelled = true;
		};
	});

	function handleResponseChange(responseId: string, value: ItemResponseValue) {
		onResponseChange?.(responseId, value);
	}

	function itemPlayerProps(node: PieQtiItemPlayerElement, props: Record<string, unknown>) {
		assignProps(node, props);

		return {
			update(next: Record<string, unknown>) {
				assignProps(node, next);
			},
		};
	}
</script>

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
		<span>{i18n?.t('item.loadError', 'Error loading item: {error}', { error: errorMessage })}</span>
	</div>
{:else if !itemRef.itemXml}
	<div class="alert alert-error">
		<span>{i18n?.t('item.loadingError') ?? 'No item XML provided'}</span>
	</div>
{:else if !playerLoaded}
	<div class="flex items-center justify-center p-8">
		<span class="loading loading-spinner loading-lg"></span>
		<span class="ml-4">{i18n?.t('item.loading', 'Loading item...')}</span>
	</div>
{:else}
	<div class="item-container">
		{#if itemRef.title}
			<div class="item-header">
				<h3 class="text-lg font-semibold mb-4">{itemRef.title}</h3>
			</div>
		{/if}

		<div class="item-content">
			<pie-qti-item-player
				use:itemPlayerProps={{
					itemXml: itemRef.itemXml,
					role,
					disabled: role !== 'candidate',
					responses,
					typeset,
					i18n,
					security,
					pci,
					pnp,
					deliveryContext: itemRef.deliveryContext,
					onResponseChange: handleResponseChange,
				}}
			></pie-qti-item-player>
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
