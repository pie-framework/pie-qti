<script lang="ts">
	import SectionMenu from './SectionMenu.svelte';

	interface Section {
		id: string;
		title?: string;
		index: number;
	}

	interface Props {
		/** Assessment title */
		title: string;
		/** Available sections */
		sections?: Section[];
		/** Current section index */
		currentSectionIndex?: number;
		/** Whether to show section menu */
		showSections?: boolean;
		/** Whether section navigation is allowed */
		allowSectionNavigation?: boolean;
		/** Section selection callback */
		onSectionSelect?: (sectionIndex: number) => void;
	}

	const {
		title,
		sections = [],
		currentSectionIndex,
		showSections = true,
		allowSectionNavigation = true,
		onSectionSelect
	}: Props = $props();
</script>

<div class="assessment-header">
	<div class="assessment-title">
		<h2 class="text-2xl font-bold">{title}</h2>
	</div>

	{#if showSections && sections.length > 1}
		<SectionMenu
			{sections}
			{currentSectionIndex}
			{onSectionSelect}
			disabled={!allowSectionNavigation}
		/>
	{/if}
</div>

<style>
	.assessment-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--color-base-300);
		background: var(--color-base-100);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.assessment-title {
		flex: 1;
	}

	@media (max-width: 768px) {
		.assessment-header {
			padding: 1rem;
		}

		.assessment-title :global(h2) {
			font-size: 1.25rem;
		}
	}
</style>
