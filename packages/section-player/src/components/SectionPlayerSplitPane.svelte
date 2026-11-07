<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
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
	import SplitPaneResizer from './SplitPaneResizer.svelte';

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
	const activeItemKey = $derived(
		`${composition.section.identifier}:${composition.activeItem.identifier}:${composition.activeItemIndex}`,
	);

	let resizer = $state<SplitPaneResizer | null>(null);
	let reportedActiveItemKey: string | null = null;
	let reportedSnapshot: ResolvedQtiSectionComposition['snapshot'] | null = null;

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

	/**
	 * Move focus to the active item, first selecting the question tab when the
	 * panes are stacked. Shells use this for skip links and after navigation.
	 */
	export async function focusActiveItem(options?: FocusOptions): Promise<boolean> {
		const pane = (await resizer?.revealItemPane()) ?? null;
		if (!pane) return false;
		pane.focus(options);
		return pane.ownerDocument.activeElement === pane;
	}
</script>

<PlayerBaseStyles />

<SplitPaneResizer
	bind:this={resizer}
	storageKey="pie-qti22-assessment-player.splitLeftPct"
	{i18n}
	{activeItemKey}
	onRightPaneReady={onItemPaneReady}
>
	{#snippet leftPane()}
		<RubricDisplay
			passages={composition.sharedContext.passages}
			{role}
			{i18n}
			security={effectiveSecurity}
			host={composition.host}
			{typeset}
			{headingLevel}
		/>
	{/snippet}

	<div class="section-player-right-pane">
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
</SplitPaneResizer>

<style>
	.section-player-right-pane {
		min-block-size: 100%;
	}
</style>
