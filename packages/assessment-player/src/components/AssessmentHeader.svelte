<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import SectionMenu from './SectionMenu.svelte';

	interface Section {
		id: string;
		title?: string;
		index: number;
	}

	interface Props {
		/** Assessment title: the assessmentTest `title`, or a localized generic title — never its identifier. */
		title: string;
		/** Id of the title element, so the shell can be labelled by it. */
		titleId?: string;
		/** Heading level of the title, so it fits the host page outline. Default 2. */
		headingLevel?: number;
		/** Available sections */
		sections?: Section[];
		/** Current section index */
		currentSectionIndex?: number;
		/** Whether to show section menu */
		showSections?: boolean;
		/** Whether section navigation is allowed */
		allowSectionNavigation?: boolean;
		/** Interface locale for the section menu. */
		i18n?: I18nProvider;
		/** Section selection callback */
		onSectionSelect?: (sectionIndex: number) => void;
	}

	const {
		title,
		titleId,
		headingLevel = 2,
		sections = [],
		currentSectionIndex,
		showSections = true,
		allowSectionNavigation = true,
		i18n,
		onSectionSelect
	}: Props = $props();

	const headingTag = $derived(`h${Math.min(6, Math.max(1, Math.round(headingLevel)))}`);
</script>

<header class="assessment-header">
	<div class="assessment-title">
		<svelte:element this={headingTag} id={titleId} class="assessment-title-text">{title}</svelte:element>
	</div>

	{#if showSections && sections.length > 1}
		<SectionMenu
			{sections}
			{currentSectionIndex}
			{i18n}
			{onSectionSelect}
			disabled={!allowSectionNavigation}
		/>
	{/if}
</header>

<style>
	.assessment-header {
		box-sizing: border-box;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem) var(--pie-qti-space-4, 1rem);
		padding-block: var(--pie-qti-space-3, 0.75rem);
		padding-inline: var(--pie-qti-space-5, 1.5rem);
		border-block-end: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-100, oklch(100% 0 0));
	}

	.assessment-title {
		flex: 1 1 12rem;
		min-inline-size: 0;
	}

	.assessment-title-text {
		margin: 0;
		font-size: 1.375em;
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	/*
	 * Interim: SectionMenu still carries DaisyUI/Tailwind classes and colour variables
	 * and is restyled in its own later change. Until then the header keeps it usable,
	 * sized and on the theme tokens without host CSS.
	 */
	.assessment-header :global(.section-menu > button) {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		gap: var(--pie-qti-space-2, 0.5rem);
		min-inline-size: var(--pie-qti-control-min-size, 2.75rem);
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		padding-block: var(--pie-qti-space-2, 0.5rem);
		padding-inline: var(--pie-qti-space-3, 0.75rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
	}

	.assessment-header :global(.section-menu > button:hover:not(:disabled)) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.assessment-header :global(.section-menu > button:disabled) {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.assessment-header :global(.section-menu svg) {
		flex: none;
		inline-size: 1.25rem;
		block-size: 1.25rem;
	}

	.assessment-header :global(.section-menu .section-dropdown-content) {
		border: 1px solid var(--pie-qti-border-strong, #767676);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
	}

	.assessment-header :global(.section-menu .section-item) {
		min-block-size: var(--pie-qti-control-min-size, 2.75rem);
		color: inherit;
		font: inherit;
	}

	.assessment-header :global(.section-menu .section-item:hover:not(:disabled)) {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}

	.assessment-header :global(.section-menu .section-item.active) {
		background: color-mix(in oklab, var(--pie-qti-primary, oklch(45% 0.24 277)) 12%, var(--pie-qti-base-100, oklch(100% 0 0)));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		font-weight: 700;
	}

	.assessment-header :global(.section-menu .section-icon) {
		color: inherit;
	}

	.assessment-header :global(.section-menu > button:focus-visible) {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* Inset: the menu list scrolls and would clip an outer ring. */
	.assessment-header :global(.section-menu .section-item:focus-visible) {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: -2px;
	}

	@media (max-width: 40rem) {
		.assessment-header {
			padding-inline: var(--pie-qti-space-3, 0.75rem);
		}

		.assessment-title-text {
			font-size: 1.125em;
		}
	}
</style>
