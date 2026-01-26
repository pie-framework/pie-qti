<script lang="ts">
	import { base } from '$app/paths';
	import { A11Y_FIXTURES, type A11yFixtureId } from '$lib/a11y/fixtures';
	import AssessmentNavigationBarFixture from '$lib/a11y/fixtures/AssessmentNavigationBarFixture.svelte';
	import AssessmentRubricDisplayFixture from '$lib/a11y/fixtures/AssessmentRubricDisplayFixture.svelte';
	import AssessmentSectionMenuFixture from '$lib/a11y/fixtures/AssessmentSectionMenuFixture.svelte';
	import AssessmentShellFixture from '$lib/a11y/fixtures/AssessmentShellFixture.svelte';
	import CustomInteractionFallbackFixture from '$lib/a11y/fixtures/CustomInteractionFallbackFixture.svelte';
	import DrawingCanvasFixture from '$lib/a11y/fixtures/DrawingCanvasFixture.svelte';
	import FileUploadFixture from '$lib/a11y/fixtures/FileUploadFixture.svelte';
	import GraphicGapMatchFixture from '$lib/a11y/fixtures/GraphicGapMatchFixture.svelte';
	import InlineInteractionRendererFixture from '$lib/a11y/fixtures/InlineInteractionRendererFixture.svelte';
	import MatchDragDropFixture from '$lib/a11y/fixtures/MatchDragDropFixture.svelte';
	import SortableListFixture from '$lib/a11y/fixtures/SortableListFixture.svelte';
	import ChoiceInteractionFixture from '$lib/a11y/fixtures/ChoiceInteractionFixture.svelte';
	import SliderInteractionFixture from '$lib/a11y/fixtures/SliderInteractionFixture.svelte';
	import HotspotInteractionFixture from '$lib/a11y/fixtures/HotspotInteractionFixture.svelte';
	import HottextInteractionFixture from '$lib/a11y/fixtures/HottextInteractionFixture.svelte';
	import ExtendedTextInteractionFixture from '$lib/a11y/fixtures/ExtendedTextInteractionFixture.svelte';

	interface Props {
		data: { fixture: string };
	}

	const { data }: Props = $props();

	const fixture = $derived(data.fixture as A11yFixtureId);
	const fixtureMeta = $derived(A11Y_FIXTURES.find((f) => f.id === fixture));
</script>

<svelte:head>
	<title>{fixtureMeta?.title ?? 'A11y Fixture'}</title>
</svelte:head>

<div class="container mx-auto px-8 py-12 space-y-6">
	<div class="flex items-center justify-between gap-4">
		<div class="space-y-1">
			<h1 class="text-2xl font-bold">{fixtureMeta?.title ?? fixture}</h1>
			<div class="text-base-content/60 text-sm">`/a11y-components/{fixture}`</div>
		</div>
		<a class="btn btn-sm btn-outline" href="{base}/a11y-components">All fixtures</a>
	</div>

	<div data-testid="a11y-fixture-root" class="card bg-base-100 shadow-xl">
		<div class="card-body">
			{#if fixture === 'sortable-list'}
				<SortableListFixture />
			{:else if fixture === 'match-drag-drop'}
				<MatchDragDropFixture />
			{:else if fixture === 'graphic-gap-match'}
				<GraphicGapMatchFixture />
			{:else if fixture === 'inline-interaction-renderer'}
				<InlineInteractionRendererFixture />
			{:else if fixture === 'file-upload'}
				<FileUploadFixture />
			{:else if fixture === 'drawing-canvas'}
				<DrawingCanvasFixture />
			{:else if fixture === 'custom-interaction-fallback'}
				<CustomInteractionFallbackFixture />
			{:else if fixture === 'choice-interaction'}
				<ChoiceInteractionFixture />
			{:else if fixture === 'slider-interaction'}
				<SliderInteractionFixture />
			{:else if fixture === 'hotspot-interaction'}
				<HotspotInteractionFixture />
			{:else if fixture === 'hottext-interaction'}
				<HottextInteractionFixture />
			{:else if fixture === 'extended-text-interaction'}
				<ExtendedTextInteractionFixture />
			{:else if fixture === 'assessment-navigation-bar'}
				<AssessmentNavigationBarFixture />
			{:else if fixture === 'assessment-section-menu'}
				<AssessmentSectionMenuFixture />
			{:else if fixture === 'assessment-rubric-display'}
				<AssessmentRubricDisplayFixture />
			{:else if fixture === 'assessment-shell'}
				<AssessmentShellFixture />
			{:else}
				<div class="alert alert-error">
					Unknown fixture: <code class="font-mono">{data.fixture}</code>
				</div>
			{/if}
		</div>
	</div>
</div>


