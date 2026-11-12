<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PciConfiguration, PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import type { QtiSectionDisplaySettingsEvent, QtiSectionFrameworkError, ResolvedQtiSectionComposition } from '../contracts/index.js';
	import type { QtiCandidateDisplaySettings } from '../tools/display-settings.js';
	import SectionLayout from './SectionLayout.svelte';
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

	let resizer = $state<SplitPaneResizer | null>(null);

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

<SectionLayout
	{composition}
	{i18n}
	{security}
	{pci}
	{pnp}
	{typeset}
	{headingLevel}
	{displaySettings}
	{initialDisplaySettings}
	{onResponseChange}
	{onFrameworkError}
	{onDisplaySettingsChange}
>
	{#snippet chrome(parts)}
		<SplitPaneResizer
			bind:this={resizer}
			storageKey="pie-qti22-assessment-player.splitLeftPct"
			{i18n}
			activeItemKey={parts.activeItemKey}
			pnp={parts.effectivePnp}
			onRightPaneReady={onItemPaneReady}
		>
			{#snippet leftPane()}
				{@render parts.passages()}
			{/snippet}

			<div class="section-player-right-pane">
				{@render parts.question()}
			</div>

			{#snippet overlay()}
				<!-- Inside the PNP surface, so the dialog takes the candidate's display needs too. -->
				{@render parts.displaySettingsTool()}
			{/snippet}
		</SplitPaneResizer>
	{/snippet}
</SectionLayout>

<style>
	.section-player-right-pane {
		min-block-size: 100%;
	}
</style>
