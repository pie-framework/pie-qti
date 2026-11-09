<script lang="ts">
	import { interfaceLocaleAttributes, type I18nProvider } from '@pie-qti/i18n';
	import type { PciConfiguration, PlayerSecurityConfig, PnpProfile } from '@pie-qti/item-player';
	import type { QtiSectionDisplaySettingsEvent, QtiSectionFrameworkError, ResolvedQtiSectionComposition } from '../contracts/index.js';
	import type { QtiCandidateDisplaySettings } from '../tools/display-settings.js';
	import { interfaceText } from '../i18n/interface-text.js';
	import { pnpSurface } from '../pnp/section-surface.js';
	import SectionLayout from './SectionLayout.svelte';

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

	let itemPaneElement = $state<HTMLElement | null>(null);
	let reportedItemPaneElement: HTMLElement | null = null;

	$effect(() => {
		if (itemPaneElement && itemPaneElement !== reportedItemPaneElement) {
			reportedItemPaneElement = itemPaneElement;
			onItemPaneReady?.(itemPaneElement);
		}
	});

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
		<div
			class="section-player-vertical pie-qti-chrome"
			lang={interfaceAttributes?.lang}
			dir={interfaceAttributes?.dir}
			use:pnpSurface={parts.effectivePnp}
		>
			{@render parts.passages()}

			<div
				class="section-player-item-pane"
				tabindex="-1"
				bind:this={itemPaneElement}
				role="region"
				aria-label={interfaceText(i18n, 'sectionPlayer.question', 'Question')}
			>
				{@render parts.question()}
			</div>

			<!-- Inside the PNP surface, so the dialog takes the candidate's display needs too. -->
			{@render parts.displaySettingsTool()}
		</div>
	{/snippet}
</SectionLayout>

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
