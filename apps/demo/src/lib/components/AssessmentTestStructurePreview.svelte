<script lang="ts">
	import type {
		AssessmentItemRefSummary,
		AssessmentSectionSummary,
		AssessmentTestStructure,
		TestPartSummary,
	} from '$lib/qti-test-structure';

	interface Props {
		structure: AssessmentTestStructure | null;
	}

	let { structure }: Props = $props();

	function itemStatusClass(ref: AssessmentItemRefSummary): string {
		return ref.isResolved ? 'badge-success' : 'badge-warning';
	}
</script>

{#snippet itemRefList(refs: AssessmentItemRefSummary[])}
	{#if refs.length > 0}
		<ul class="space-y-2">
			{#each refs as ref}
				<li class="rounded-box border border-base-300 bg-base-100 p-3">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<div class="font-medium">{ref.resolvedItem?.title ?? ref.identifier}</div>
							<div class="text-xs text-base-content/70">
								<code>{ref.identifier}</code>
								{#if ref.href}
									<span aria-hidden="true"> · </span>
									<code>{ref.href}</code>
								{/if}
							</div>
						</div>
						<span class="badge {itemStatusClass(ref)}">
							{ref.isResolved ? 'resolved' : 'unresolved'}
						</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet sectionList(sections: AssessmentSectionSummary[])}
	{#if sections.length > 0}
		<div class="space-y-3">
			{#each sections as section}
				<section class="rounded-box border border-base-300 bg-base-200 p-4" aria-label="Assessment section {section.identifier}">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h4 class="font-semibold">{section.title ?? section.identifier}</h4>
							<p class="text-xs text-base-content/70">
								Section <code>{section.identifier}</code>
							</p>
						</div>
						{#if section.visible}
							<span class="badge badge-outline">visible: {section.visible}</span>
						{/if}
					</div>
					<div class="mt-3 space-y-3">
						{@render itemRefList(section.itemRefs)}
						{@render sectionList(section.sections)}
					</div>
				</section>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet testPartList(parts: TestPartSummary[])}
	{#if parts.length > 0}
		<div class="space-y-4">
			{#each parts as part}
				<section class="card bg-base-100 border border-base-300" aria-label="Test part {part.identifier}">
					<div class="card-body">
						<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
							<div>
								<h3 class="card-title">{part.identifier}</h3>
								<p class="text-sm text-base-content/70">Assessment test part</p>
							</div>
							<div class="flex flex-wrap gap-2">
								{#if part.navigationMode}
									<span class="badge badge-info">navigation: {part.navigationMode}</span>
								{/if}
								{#if part.submissionMode}
									<span class="badge badge-secondary">submission: {part.submissionMode}</span>
								{/if}
							</div>
						</div>

						<div class="space-y-3">
							{@render itemRefList(part.itemRefs)}
							{@render sectionList(part.sections)}
						</div>
					</div>
				</section>
			{/each}
		</div>
	{/if}
{/snippet}

{#if structure}
	<section class="card bg-base-100 shadow-xl" aria-labelledby="test-structure-title">
		<div class="card-body gap-4">
			<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<p class="text-xs uppercase tracking-wide text-base-content/60">Assessment package preview</p>
					<h2 id="test-structure-title" class="card-title">
						{structure.title ?? structure.identifier ?? 'Assessment test structure'}
					</h2>
					<p class="text-sm text-base-content/70">
						Parsed from the uploaded package so item references, sections, and navigation settings can be checked before full test playback.
					</p>
				</div>
				<div class="badge {structure.summary.unresolvedRefs > 0 ? 'badge-warning' : 'badge-success'} badge-lg">
					{structure.summary.unresolvedRefs > 0 ? 'Needs attention' : 'References resolved'}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3 md:grid-cols-5">
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">QTI version</div>
					<div class="font-semibold">{structure.version}</div>
				</div>
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">Test parts</div>
					<div class="font-semibold">{structure.summary.testParts}</div>
				</div>
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">Sections</div>
					<div class="font-semibold">{structure.summary.sections}</div>
				</div>
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">Item refs</div>
					<div class="font-semibold">{structure.summary.itemRefs}</div>
				</div>
				<div class="rounded-box bg-base-200 p-3">
					<div class="text-xs text-base-content/60">Unresolved</div>
					<div class="font-semibold">{structure.summary.unresolvedRefs}</div>
				</div>
			</div>

			{#if structure.errors.length > 0}
				<div class="alert alert-error">
					<div>
						<h3 class="font-semibold">Preview errors</h3>
						<ul class="list-disc pl-5 text-sm">
							{#each structure.errors as error}
								<li>{error}</li>
							{/each}
						</ul>
					</div>
				</div>
			{/if}

			{@render testPartList(structure.testParts)}
			{@render sectionList(structure.directSections)}
			{@render itemRefList(structure.directItemRefs)}

			{#if structure.summary.itemRefs === 0 && structure.errors.length === 0}
				<div class="alert alert-info">
					<span>No item references were found in this assessment test XML.</span>
				</div>
			{/if}
		</div>
	</section>
{/if}
