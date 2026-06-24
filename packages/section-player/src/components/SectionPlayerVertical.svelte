<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import type { QtiSectionFrameworkError, ResolvedQtiSectionComposition } from '../contracts/index.js';
	import ItemRenderer from './ItemRenderer.svelte';
	import RubricDisplay from './RubricDisplay.svelte';

	interface Props {
		composition: ResolvedQtiSectionComposition;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		pnp?: PnpProfile;
		extendedTextEditor?: 'tiptap' | 'textarea';
		typeset?: (root: HTMLElement) => void | Promise<void>;
		onResponseChange?: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
		onItemPaneReady?: (element: HTMLElement) => void;
		onFrameworkError?: (error: QtiSectionFrameworkError) => void;
	}

	const {
		composition,
		i18n,
		security,
		pnp,
		extendedTextEditor,
		typeset,
		onResponseChange,
		onItemPaneReady,
		onFrameworkError,
	}: Props = $props();

	const role = $derived(composition.section.role ?? 'candidate');
	const effectiveSecurity = $derived(security ?? composition.security);
	const activeResponses = $derived(
		composition.snapshot.responses[composition.activeItem.identifier] ?? composition.activeItem.responses ?? {}
	);

	let itemPaneElement = $state<HTMLElement | null>(null);
	let reportedItemPaneElement = $state<HTMLElement | null>(null);

	$effect(() => {
		if (itemPaneElement && itemPaneElement !== reportedItemPaneElement) {
			reportedItemPaneElement = itemPaneElement;
			onItemPaneReady?.(itemPaneElement);
		}
	});
</script>

<div class="section-player-vertical">
	<RubricDisplay
		passages={composition.sharedContext.passages}
		{role}
		{i18n}
		security={effectiveSecurity}
		host={composition.host}
		{typeset}
	/>

	<div
		class="section-player-item-pane"
		tabindex="-1"
		bind:this={itemPaneElement}
		role="region"
		aria-label={i18n?.t('sectionPlayer.activeItem', 'Active item') ?? 'Active item'}
	>
		<RubricDisplay
			rubricBlocks={composition.sharedContext.rubricBlocks}
			{role}
			{i18n}
			security={effectiveSecurity}
			host={composition.host}
			{typeset}
		/>
		<ItemRenderer
			itemRef={composition.activeItem}
			responses={activeResponses}
			{role}
			disabled={role !== 'candidate'}
			{i18n}
			security={effectiveSecurity}
			{pnp}
			{extendedTextEditor}
			{typeset}
			{onResponseChange}
			{onFrameworkError}
		/>
	</div>
</div>

<style>
	.section-player-vertical {
		width: 100%;
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem;
	}

	.section-player-item-pane {
		outline: none;
	}

	.section-player-item-pane:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (max-width: 768px) {
		.section-player-vertical {
			padding: 1rem;
		}
	}
</style>
