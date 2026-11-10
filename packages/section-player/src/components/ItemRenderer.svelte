<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PciConfiguration, PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import { assignProps } from '@pie-qti/qti-common';
	import type { QtiSectionFrameworkError, QtiSectionItemRef, QtiSectionRole, QtiSectionToolConfig } from '../contracts/index.js';
	import { interfaceText } from '../i18n/interface-text.js';
	import { tryExtractItemSpeech } from '../tts/spoken-catalogs.js';
	import type { QtiDisplaySettingsControls } from '../tools/display-settings.js';
	import QtiToolButtonBar from './QtiToolButtonBar.svelte';

	type ItemPlayerResponseChangeEvent = CustomEvent<{ responseId: string; value: unknown }>;

	interface Props {
		itemRef: QtiSectionItemRef;
		responses?: Record<string, unknown>;
		/** The tools the item header offers; defaults to the item ref's own. */
		tools?: QtiSectionToolConfig[];
		role?: QtiSectionRole;
		disabled?: boolean;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		pci?: PciConfiguration;
		pnp?: PnpProfile;
		typeset?: (root: HTMLElement) => void | Promise<void>;
		/** Heading level of the item title, so it fits the page outline. Default 3. */
		headingLevel?: number;
		/** The assessment the item's tool bar names. */
		assessmentId?: string;
		/** The section's display settings dialog; present, the item header opens it from its tool bar. */
		displaySettingsControls?: QtiDisplaySettingsControls | null;
		onResponseChange?: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
		onFrameworkError?: (error: QtiSectionFrameworkError) => void;
	}

	const {
		itemRef,
		responses,
		tools,
		role = 'candidate',
		disabled = false,
		i18n,
		security,
		pci,
		pnp,
		typeset,
		headingLevel = 3,
		assessmentId,
		displaySettingsControls = null,
		onResponseChange,
		onFrameworkError,
	}: Props = $props();

	const uid = $props.id();
	const titleId = `${uid}-title`;

	let playerLoaded = $state(false);
	/** The item player failed to load; the detail goes to `onFrameworkError`, never to the candidate. */
	let loadFailed = $state(false);
	let itemScopeElement = $state<HTMLElement | null>(null);
	const itemTitle = $derived(itemRef.title?.trim() || interfaceText(i18n, 'sectionPlayer.question', 'Question'));
	const headerTools = $derived(tools ?? itemRef.tools);
	const hasHeaderTools = $derived((headerTools?.length ?? 0) > 0);
	const showHeader = $derived(Boolean(itemRef.title?.trim()) || hasHeaderTools || displaySettingsControls !== null);
	// A rejected item (a `<!DOCTYPE>`, an item over the parsing limits) keeps rendering
	// without read-aloud: the failure goes to `onFrameworkError` below, never into the
	// layout's render, and the item player shows its own per-item alert if the XML
	// breaks it too.
	const itemSpeechOutcome = $derived(tryExtractItemSpeech(itemRef.itemXml, { security }));
	const itemSpeech = $derived(itemSpeechOutcome.ok ? itemSpeechOutcome.speech : { catalogs: [] });
	const headingTag = $derived(`h${Math.min(6, Math.max(1, Math.round(headingLevel)))}`);

	async function loadItemPlayerElement() {
		if (!customElements.get('pie-qti-item-player')) {
			await import('@pie-qti/item-player/element');
		}
		await customElements.whenDefined('pie-qti-item-player');
	}

	// An item with no XML renders the alert straight away; the element load can wait
	// until there is one to present.
	$effect(() => {
		if (playerLoaded || loadFailed || !itemRef.itemXml) return;
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
					loadFailed = true;
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

	$effect(() => {
		if (itemSpeechOutcome.ok) return;
		const failure = itemSpeechOutcome;
		onFrameworkError?.({
			itemIdentifier: itemRef.identifier,
			code: 'item-speech-extraction-failed',
			message: failure.message,
			cause: failure.cause,
		});
	});

	function itemPlayerProps(node: HTMLElement, props: Record<string, unknown>) {
		const handleItemPlayerResponseChange = (event: Event) => {
			const { responseId, value } = (event as ItemPlayerResponseChangeEvent).detail;
			handleResponseChange(responseId, value);
		};

		node.addEventListener('response-change', handleItemPlayerResponseChange);
		assignProps(node, props);

		return {
			update(next: Record<string, unknown>) {
				assignProps(node, next);
			},
			destroy() {
				node.removeEventListener('response-change', handleItemPlayerResponseChange);
			},
		};
	}

</script>

{#if loadFailed || !itemRef.itemXml}
	<div class="item-alert" role="alert">
		<svg class="item-alert-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
		<span>{interfaceText(i18n, 'item.loadingError', 'Failed to load item')}</span>
	</div>
{:else if !playerLoaded}
	<div class="item-loading" role="status">
		<span class="item-spinner" aria-hidden="true"></span>
		<span>{interfaceText(i18n, 'item.loading', 'Loading item...')}</span>
	</div>
{:else}
	<article
		class="item-container"
		aria-labelledby={Boolean(itemRef.title?.trim()) || hasHeaderTools ? titleId : undefined}
	>
		{#if showHeader}
			<header class="item-header">
				{#if Boolean(itemRef.title?.trim()) || hasHeaderTools}
					<svelte:element this={headingTag} id={titleId} class="item-title">{itemTitle}</svelte:element>
				{/if}
				<QtiToolButtonBar
					tools={headerTools}
					scopeId={itemRef.identifier}
					scopeLabel="question"
					sourceXml={itemRef.itemXml}
					accessibilityCatalogs={itemSpeech.catalogs}
					language={itemSpeech.language}
					scopeElement={itemScopeElement}
					{i18n}
					{assessmentId}
					{pnp}
					{displaySettingsControls}
				/>
			</header>
		{/if}

		<div class="item-content pie-qti-content" bind:this={itemScopeElement}>
			<pie-qti-item-player
				use:itemPlayerProps={{
					session: itemRef.session,
					responses: itemRef.session ? undefined : (responses ?? itemRef.responses ?? {}),
					deliveryContext: itemRef.deliveryContext,
					itemXml: itemRef.itemXml,
					security,
					pci,
					pnp,
					role,
					disabled,
					typeset,
					i18n,
				}}
			></pie-qti-item-player>
		</div>
	</article>
{/if}

<style>
	.item-container {
		box-sizing: border-box;
		inline-size: 100%;
	}

	.item-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--pie-qti-space-2, 0.5rem) var(--pie-qti-space-4, 1rem);
		margin-block-end: var(--pie-qti-space-3, 0.75rem);
	}

	.item-title {
		margin: 0;
		font-size: 1.125em;
		font-weight: 600;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.item-content {
		inline-size: 100%;
		position: relative;
	}

	.item-alert {
		display: flex;
		align-items: flex-start;
		gap: var(--pie-qti-space-3, 0.75rem);
		padding: var(--pie-qti-space-4, 1rem);
		border: 1px solid var(--pie-qti-error-text, #b91c1c);
		border-inline-start-width: 4px;
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-error-text, #b91c1c);
	}

	.item-alert-icon {
		flex: none;
		inline-size: 1.5rem;
		block-size: 1.5rem;
	}

	.item-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--pie-qti-space-3, 0.75rem);
		padding: var(--pie-qti-space-6, 2rem);
	}

	.item-spinner {
		flex: none;
		inline-size: 1.5rem;
		block-size: 1.5rem;
		border: 3px solid var(--pie-qti-base-300, oklch(95% 0 0));
		border-block-start-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		border-radius: 50%;
	}

	@media (prefers-reduced-motion: no-preference) {
		.item-spinner {
			animation: item-spin 0.9s linear infinite;
		}
	}

	@keyframes item-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
