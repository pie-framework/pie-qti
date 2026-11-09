<script lang="ts">
	import { interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	import type { PciConfiguration, PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import { untrack } from 'svelte';
	import { interfaceText } from '../i18n/interface-text.js';
	import { pnpSurface } from '../pnp/section-surface.js';
	import type { QtiCandidateDisplaySettings } from '../tools/display-settings.js';
	import type {
		QtiSectionDisplaySettingsEvent,
		QtiSectionFrameworkError,
		QtiSectionToolConfig,
		ResolvedQtiSectionComposition,
	} from '../contracts/index.js';
	import { notifyActiveItemChange, notifyDisplaySettingsChange, notifyFrameworkError, notifyResponseDelta, notifySnapshotChange } from '../runtime/notifyRuntimeHost.js';
	import { readSessionDisplaySettings, withDisplaySettings, writeSessionDisplaySettings } from '../tools/display-settings.js';
	import ItemRenderer from './ItemRenderer.svelte';
	import PlayerBaseStyles from './PlayerBaseStyles.svelte';
	import RubricDisplay from './RubricDisplay.svelte';
	import SectionDisplaySettings from './SectionDisplaySettings.svelte';

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

	let itemPaneElement = $state<HTMLElement | null>(null);
	let displaySettingsControls = $state<SectionDisplaySettings | null>(null);
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

	function handleDisplaySettingsChange(settings: QtiCandidateDisplaySettings) {
		candidateSettings = settings;
		// A shell that swaps layouts between items keeps the candidate's choices.
		writeSessionDisplaySettings(assessmentId, settings);
		const event = notifyDisplaySettingsChange(composition, settings, effectivePnp);
		onDisplaySettingsChange?.(event);
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

<div
	class="section-player-vertical pie-qti-chrome"
	lang={interfaceAttributes?.lang}
	dir={interfaceAttributes?.dir}
	use:pnpSurface={effectivePnp}
>
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

	<div
		class="section-player-item-pane"
		tabindex="-1"
		bind:this={itemPaneElement}
		role="region"
		aria-label={interfaceText(i18n, 'sectionPlayer.question', 'Question')}
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

	<!-- Inside the PNP surface, so the dialog takes the candidate's display needs too. -->
	{#if displaySettings}
		<SectionDisplaySettings
			bind:this={displaySettingsControls}
			{i18n}
			settings={candidateSettings}
			onChange={handleDisplaySettingsChange}
		/>
	{/if}
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

	/*
	 * This layout is the section's PNP surface, so inverted polarity applies here,
	 * to everything it renders. Filters are not inherited and a second one cancels
	 * the first, so an inverting root nested inside another applies none of its own:
	 * an item body inside this surface, or this surface inside a host root that
	 * already inverts. The outer filter and its un-inverted media cover the subtree.
	 */
	.section-player-vertical:global([data-qti-invert-polarity='invert']) :global([data-qti-invert-polarity='invert']),
	:global([data-qti-invert-polarity='invert']) .section-player-vertical:global([data-qti-invert-polarity='invert']) {
		filter: none;
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
