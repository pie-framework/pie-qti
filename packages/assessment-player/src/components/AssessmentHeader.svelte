<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { Snippet } from 'svelte';
	import SectionMenu from './SectionMenu.svelte';

	interface Section {
		id: string;
		title?: string;
		index: number;
		/** Whether jumping to this section is legal right now. */
		navigable?: boolean;
		/** Items with a response (answered or partially answered). */
		answered?: number;
		/** All delivered items in the section. */
		total?: number;
		isCurrent?: boolean;
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
		/**
		 * Whether the section menu shows at all — the shell decides from its config
		 * (the option's one defaulting site), so there is no second default here.
		 */
		showSections: boolean;
		/**
		 * Whether section menu entries are usable right now — the shell composes the
		 * config option with its own submission/completion gating.
		 */
		allowSectionNavigation: boolean;
		/** Interface locale for the section menu. */
		i18n?: I18nProvider;
		/** Section selection callback */
		onSectionSelect?: (sectionIndex: number) => void;
		/** Header-side actions (the countdown timer), kept outside the title block. */
		actions?: Snippet;
		/** Blocks interaction and focus while a proctor pause holds the assessment. */
		inert?: boolean;
	}

	const {
		title,
		titleId,
		headingLevel = 2,
		sections = [],
		currentSectionIndex,
		showSections,
		allowSectionNavigation,
		i18n,
		onSectionSelect,
		actions,
		inert = false,
	}: Props = $props();

	const headingTag = $derived(`h${Math.min(6, Math.max(1, Math.round(headingLevel)))}`);

	// The menu receives every candidate-visible section with its live status; it enables
	// only legal targets itself and lets disabled entries explain the rest.
	const menuSections = $derived(
		sections.map((section) => ({
			id: section.id,
			title: section.title,
			index: section.index,
			navigable: section.navigable ?? true,
			answered: section.answered ?? 0,
			total: section.total ?? 0,
			isCurrent: currentSectionIndex !== undefined ? section.index === currentSectionIndex : (section.isCurrent ?? false),
		})),
	);
</script>

<header class="assessment-header" inert={inert || undefined}>
	<div class="assessment-title">
		<svelte:element this={headingTag} id={titleId} class="assessment-title-text">{title}</svelte:element>
	</div>

	{#if actions}
		<div class="assessment-header-actions">
			{@render actions()}
		</div>
	{/if}

	{#if showSections && sections.length > 1}
		<SectionMenu
			sections={menuSections}
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

	.assessment-header-actions {
		display: flex;
		align-items: center;
		flex: 0 1 auto;
		min-inline-size: 0;
	}

	.assessment-title-text {
		margin: 0;
		font-size: 1.375em;
		font-weight: 700;
		line-height: 1.3;
		overflow-wrap: anywhere;
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
