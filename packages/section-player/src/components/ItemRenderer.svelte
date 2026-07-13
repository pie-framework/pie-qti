<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PciConfiguration, PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import { assignProps } from '@pie-qti/qti-common';
	import { onMount } from 'svelte';
	import type { QtiSectionFrameworkError, QtiSectionItemRef, QtiSectionRole } from '../contracts/index.js';
	import { extractReadableInteractionSpeechHtml } from '../tts/readable-interaction-projection.js';
	import QtiToolButtonBar from './QtiToolButtonBar.svelte';

	type ItemResponseMap = Record<string, unknown>;
	type PieQtiItemPlayerElement = HTMLElement & {
		itemXml?: string;
		role?: QtiSectionRole;
		disabled?: boolean;
		responses?: ItemResponseMap;
		deliveryContext?: QtiSectionItemRef['deliveryContext'];
		security?: PlayerSecurityConfig;
		pci?: PciConfiguration;
		pnp?: PnpProfile;
		typeset?: (root: HTMLElement) => void | Promise<void>;
		i18n?: I18nProvider;
		extendedTextEditor?: 'tiptap' | 'textarea';
		onResponseChange?: (responseIdentifier: string, value: unknown) => void;
	};

	interface Props {
		itemRef: QtiSectionItemRef;
		responses?: Record<string, unknown>;
		role?: QtiSectionRole;
		disabled?: boolean;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		pci?: PciConfiguration;
		pnp?: PnpProfile;
		extendedTextEditor?: 'tiptap' | 'textarea';
		typeset?: (root: HTMLElement) => void | Promise<void>;
		onResponseChange?: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
		onFrameworkError?: (error: QtiSectionFrameworkError) => void;
	}

	const {
		itemRef,
		responses,
		role = 'candidate',
		disabled = false,
		i18n,
		security,
		pci,
		pnp,
		extendedTextEditor,
		typeset,
		onResponseChange,
		onFrameworkError,
	}: Props = $props();

	let playerLoaded = $state(false);
	let errorMessage = $state<string | null>(null);
	let itemScopeElement = $state<HTMLElement | null>(null);
	const itemTitle = $derived(itemRef.title ?? 'Question');
	const hasHeaderTools = $derived((itemRef.tools?.length ?? 0) > 0);
	const interactionSpeechHtml = $derived(
		extractReadableInteractionSpeechHtml(itemRef.itemXml, { security }),
	);

	async function loadItemPlayerElement() {
		if (!customElements.get('pie-qti-item-player')) {
			await import('@pie-qti/item-player/element');
		}
		await customElements.whenDefined('pie-qti-item-player');
	}

	onMount(() => {
		let cancelled = false;
		void loadItemPlayerElement()
			.then(() => {
				if (!cancelled) {
					playerLoaded = true;
				}
			})
			.catch((error) => {
				if (!cancelled) {
					const message = error instanceof Error ? error.message : 'Unable to load the QTI item player.';
					errorMessage = message;
					onFrameworkError?.({
						itemIdentifier: itemRef.identifier,
						code: 'item-player-load-failed',
						message,
						cause: error,
					});
				}
			});

		return () => {
			cancelled = true;
		};
	});

	function handleResponseChange(responseIdentifier: string, value: unknown) {
		onResponseChange?.(itemRef.identifier, responseIdentifier, value);
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
	<div class="alert alert-error" role="alert">
		<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
		<span>{i18n?.t('item.loadError', 'Error loading item: {error}', { error: errorMessage })}</span>
	</div>
{:else if !itemRef.itemXml}
	<div class="alert alert-error" role="alert">
		<span>{i18n?.t('item.loadingError') ?? 'No item XML provided'}</span>
	</div>
{:else if !playerLoaded}
	<div class="flex items-center justify-center p-8" role="status">
		<span class="loading loading-spinner loading-lg" aria-hidden="true"></span>
		<span class="ml-4">{i18n?.t('item.loading', 'Loading item...')}</span>
	</div>
{:else}
	<article class="item-container" aria-labelledby={itemRef.title || hasHeaderTools ? `section-item-title-${itemRef.identifier}` : undefined}>
		{#if itemRef.title || hasHeaderTools}
			<header class="item-header">
				<h3 id={`section-item-title-${itemRef.identifier}`} class="text-lg font-semibold">{itemTitle}</h3>
				<QtiToolButtonBar
					tools={itemRef.tools}
					scopeId={itemRef.identifier}
					scopeLabel="question"
					sourceXml={itemRef.itemXml}
					scopeElement={itemScopeElement}
				/>
			</header>
		{/if}

		<div class="item-content" bind:this={itemScopeElement}>
			<pie-qti-item-player
				use:itemPlayerProps={{
					responses: responses ?? itemRef.responses ?? {},
					deliveryContext: itemRef.deliveryContext,
					itemXml: itemRef.itemXml,
					security,
					pci,
					pnp,
					role,
					disabled,
					typeset,
					i18n,
					extendedTextEditor,
					onResponseChange: handleResponseChange,
				}}
			></pie-qti-item-player>
			{#if interactionSpeechHtml}
				<div class="qti-tts-interaction-projection" data-qti-tts-readable-projection>
					{@html interactionSpeechHtml}
				</div>
			{/if}
		</div>
	</article>
{/if}

<style>
	.item-container {
		width: 100%;
		padding: 1rem;
	}

	.item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.item-content {
		width: 100%;
		position: relative;
	}

	.qti-tts-interaction-projection {
		position: absolute;
		left: -10000px;
		top: 0;
		width: 1px;
		opacity: 0.01;
		pointer-events: none;
	}
</style>
