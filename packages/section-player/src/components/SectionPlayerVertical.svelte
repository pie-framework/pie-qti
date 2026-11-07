<script lang="ts">
	import { interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	import type { PciConfiguration, PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import type { QtiSectionFrameworkError, ResolvedQtiSectionComposition } from '../contracts/index.js';
	import {
		notifyActiveItemChange,
		notifyFrameworkError,
		notifyResponseDelta,
		notifySnapshotChange,
	} from '../runtime/notifyRuntimeHost.js';
	import ItemRenderer from './ItemRenderer.svelte';
	import PlayerBaseStyles from './PlayerBaseStyles.svelte';
	import RubricDisplay from './RubricDisplay.svelte';

	interface Props {
		composition: ResolvedQtiSectionComposition;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		pci?: PciConfiguration;
		pnp?: PnpProfile;
		typeset?: (root: HTMLElement) => void | Promise<void>;
		/**
		 * Heading level of the passage and item titles, so they fit the host page
		 * outline (the assessment shell passes one below its own title). Default 3.
		 */
		headingLevel?: number;
		onResponseChange?: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
		onItemPaneReady?: (element: HTMLElement) => void;
		onFrameworkError?: (error: QtiSectionFrameworkError) => void;
	}

	const {
		composition,
		i18n,
		security,
		pci,
		pnp,
		typeset,
		headingLevel = 3,
		onResponseChange,
		onItemPaneReady,
		onFrameworkError,
	}: Props = $props();

	const role = $derived(composition.section.role ?? 'candidate');
	const effectiveSecurity = $derived(security ?? composition.security);
	const activeResponses = $derived(
		composition.snapshot.responses[composition.activeItem.identifier] ?? {}
	);

	let itemPaneElement = $state<HTMLElement | null>(null);
	let reportedItemPaneElement: HTMLElement | null = null;
	let reportedActiveItemKey: string | null = null;
	let reportedSnapshot: ResolvedQtiSectionComposition['snapshot'] | null = null;

	$effect(() => {
		if (itemPaneElement && itemPaneElement !== reportedItemPaneElement) {
			reportedItemPaneElement = itemPaneElement;
			onItemPaneReady?.(itemPaneElement);
		}
	});

	$effect(() => {
		const activeItemKey = `${composition.section.identifier}:${composition.activeItem.identifier}:${composition.activeItemIndex}:${composition.section.itemRefs.length}`;
		if (activeItemKey !== reportedActiveItemKey) {
			reportedActiveItemKey = activeItemKey;
			notifyActiveItemChange(composition);
		}
	});

	$effect(() => {
		if (composition.snapshot !== reportedSnapshot) {
			reportedSnapshot = composition.snapshot;
			notifySnapshotChange(composition);
		}
	});

	function handleResponseChange(itemIdentifier: string, responseIdentifier: string, value: unknown) {
		notifyResponseDelta(composition, itemIdentifier, responseIdentifier, value);
		onResponseChange?.(itemIdentifier, responseIdentifier, value);
	}

	function handleFrameworkError(error: QtiSectionFrameworkError) {
		const event = notifyFrameworkError(composition, error);
		onFrameworkError?.(event);
	}

	/** Move focus to the active item. Shells use this for skip links and after navigation. */
	export async function focusActiveItem(options?: FocusOptions): Promise<boolean> {
		const pane = itemPaneElement;
		if (!pane) return false;
		pane.focus(options);
		return pane.ownerDocument.activeElement === pane;
	}

	// The section's chrome takes the interface locale; passages and items set
	// their own from their content language.
	const interfaceAttributes = $derived(interfaceLocaleAttributes(i18n));
</script>

<PlayerBaseStyles />

<div class="section-player-vertical pie-qti-chrome" lang={interfaceAttributes?.lang} dir={interfaceAttributes?.dir}>
	<RubricDisplay
		passages={composition.sharedContext.passages}
		{role}
		{i18n}
		security={effectiveSecurity}
		host={composition.host}
		{typeset}
		{headingLevel}
	/>

	<div
		class="section-player-item-pane"
		tabindex="-1"
		bind:this={itemPaneElement}
		role="region"
		aria-label={i18n?.t('sectionPlayer.question', 'Question') ?? 'Question'}
	>
		<RubricDisplay
			rubricBlocks={composition.sharedContext.rubricBlocks}
			{role}
			{i18n}
			security={effectiveSecurity}
			host={composition.host}
			{typeset}
			{headingLevel}
		/>
		<ItemRenderer
			itemRef={composition.activeItem}
			responses={activeResponses}
			{role}
			disabled={role !== 'candidate'}
			{i18n}
			security={effectiveSecurity}
			{pci}
			{pnp}
			{typeset}
			{headingLevel}
			onResponseChange={handleResponseChange}
			onFrameworkError={handleFrameworkError}
		/>
	</div>
</div>

<style>
	.section-player-vertical {
		box-sizing: border-box;
		inline-size: 100%;
		max-inline-size: 60rem;
		margin-inline: auto;
		padding-block: var(--pie-qti-space-5, 1.5rem);
		padding-inline: var(--pie-qti-space-6, 2rem);
	}

	.section-player-item-pane {
		outline: none;
	}

	.section-player-item-pane:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* Phones: one slim gutter instead of nested ones. */
	@media (max-width: 40rem) {
		.section-player-vertical {
			padding-block: var(--pie-qti-space-3, 0.75rem);
			padding-inline: var(--pie-qti-space-3, 0.75rem);
		}
	}
</style>
