<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import type { QtiSectionFrameworkError, ResolvedQtiSectionComposition } from '../contracts/index.js';
	import {
		notifyActiveItemChange,
		notifyFrameworkError,
		notifyResponseDelta,
		notifySnapshotChange,
	} from '../runtime/notifyRuntimeHost.js';
	import ItemRenderer from './ItemRenderer.svelte';
	import RubricDisplay from './RubricDisplay.svelte';
	import SplitPaneResizer from './SplitPaneResizer.svelte';

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

	let reportedActiveItemKey = $state<string | null>(null);
	let reportedSnapshot = $state<ResolvedQtiSectionComposition['snapshot'] | null>(null);

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
</script>

<SplitPaneResizer storageKey="pie-qti22-assessment-player.splitLeftPct" {i18n} onRightPaneReady={onItemPaneReady}>
	{#snippet leftPane()}
		<RubricDisplay
			passages={composition.sharedContext.passages}
			{role}
			{i18n}
			security={effectiveSecurity}
			host={composition.host}
			{typeset}
		/>
	{/snippet}

	<div
		class="section-player-right-pane"
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
			onResponseChange={handleResponseChange}
			onFrameworkError={handleFrameworkError}
		/>
	</div>
</SplitPaneResizer>

<style>
	.section-player-right-pane {
		min-height: 100%;
		outline: none;
	}

	.section-player-right-pane:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
