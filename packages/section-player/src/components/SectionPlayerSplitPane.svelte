<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PciConfiguration, PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import { untrack } from 'svelte';
	import type {
		QtiSectionDisplaySettingsEvent,
		QtiSectionFrameworkError,
		QtiSectionToolConfig,
		ResolvedQtiSectionComposition,
	} from '../contracts/index.js';
	import { notifyActiveItemChange, notifyDisplaySettingsChange, notifyFrameworkError, notifyResponseDelta, notifySnapshotChange } from '../runtime/notifyRuntimeHost.js';
	import { type QtiCandidateDisplaySettings, readSessionDisplaySettings, withDisplaySettings, writeSessionDisplaySettings } from '../tools/display-settings.js';
	import ItemRenderer from './ItemRenderer.svelte';
	import PlayerBaseStyles from './PlayerBaseStyles.svelte';
	import RubricDisplay from './RubricDisplay.svelte';
	import SectionDisplaySettings from './SectionDisplaySettings.svelte';
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
		/** Offer the candidate the display settings tool. Default true. */
		displaySettings?: boolean;
		/** The settings the candidate starts with; defaults to what they chose earlier in this page session. */
		initialDisplaySettings?: QtiCandidateDisplaySettings;
		onResponseChange?: (itemIdentifier: string, responseIdentifier: string, value: unknown) => void;
		onItemPaneReady?: (element: HTMLElement) => void;
		onFrameworkError?: (error: QtiSectionFrameworkError) => void;
		/** The candidate changed their display settings; `pnp` is the profile the section now renders with. */
		onDisplaySettingsChange?: (event: QtiSectionDisplaySettingsEvent) => void;
	}

	const {
		composition,
		i18n,
		security,
		pci,
		pnp,
		typeset,
		headingLevel = 3,
		displaySettings = true,
		initialDisplaySettings,
		onResponseChange,
		onItemPaneReady,
		onFrameworkError,
		onDisplaySettingsChange,
	}: Props = $props();

	const role = $derived(composition.section.role ?? 'candidate');
	const effectiveSecurity = $derived(security ?? composition.security);
	const activeResponses = $derived(
		composition.snapshot.responses[composition.activeItem.identifier] ?? {}
	);
	const activeItemKey = $derived(
		`${composition.section.identifier}:${composition.activeItem.identifier}:${composition.activeItemIndex}`,
	);
	// The assessment the tool bars name; compositions from `resolveQtiSectionComposition`
	// carry one, older inputs fall back to the section identifier.
	const assessmentId = $derived(composition.assessmentId ?? composition.section.assessmentId ?? composition.section.identifier);
	// The profile the section renders with: the host's PNP with the candidate's own
	// display settings applied. A `pnp` prop wins over the composition's.
	const hostPnp = $derived(pnp ?? composition.pnp);
	// Read once, at mount: later changes come from the candidate, not the props.
	let candidateSettings = $state<QtiCandidateDisplaySettings>(
		untrack(() => initialDisplaySettings ?? readSessionDisplaySettings(assessmentId) ?? {}),
	);
	const effectivePnp = $derived(withDisplaySettings(hostPnp, candidateSettings));
	// Section-level tools follow the active item, so they render on its tool bar beside
	// its own; where both offer a tool, the item's configuration (its calculator type) wins.
	const itemTools = $derived.by<QtiSectionToolConfig[] | undefined>(() => {
		const own = composition.activeItem.tools ?? [];
		const ownIds = new Set(own.map((tool) => String(tool.toolId)));
		const merged = [...own, ...(composition.section.tools ?? []).filter((tool) => !ownIds.has(String(tool.toolId)))];
		return merged.length > 0 ? merged : undefined;
	});

	let resizer = $state<SplitPaneResizer | null>(null);
	let displaySettingsControls = $state<SectionDisplaySettings | null>(null);
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

	function handleDisplaySettingsChange(settings: QtiCandidateDisplaySettings) {
		candidateSettings = settings;
		// A shell that swaps layouts between items keeps the candidate's choices.
		writeSessionDisplaySettings(assessmentId, settings);
		const event = notifyDisplaySettingsChange(composition, settings, effectivePnp);
		onDisplaySettingsChange?.(event);
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
	pnp={effectivePnp}
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
			{assessmentId}
			pnp={hostPnp}
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
			tools={itemTools}
			{role}
			disabled={role !== 'candidate'}
			{i18n}
			security={effectiveSecurity}
			{pci}
			pnp={hostPnp}
			{typeset}
			{headingLevel}
			{assessmentId}
			displaySettingsControls={displaySettings ? displaySettingsControls : null}
			onResponseChange={handleResponseChange}
			onFrameworkError={handleFrameworkError}
		/>
	</div>

	{#snippet overlay()}
		<!-- Inside the PNP surface, so the dialog takes the candidate's display needs too. -->
		{#if displaySettings}
			<SectionDisplaySettings
				bind:this={displaySettingsControls}
				{i18n}
				settings={candidateSettings}
				onChange={handleDisplaySettingsChange}
			/>
		{/if}
	{/snippet}
</SplitPaneResizer>

<style>
	.section-player-right-pane {
		min-block-size: 100%;
	}
</style>
