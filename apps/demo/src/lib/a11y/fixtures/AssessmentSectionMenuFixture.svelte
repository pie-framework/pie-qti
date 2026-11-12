<script lang="ts">
	import { SectionMenu } from '@pie-qti/assessment-player/components';

	let sections = $state([
		{ id: 'sec-1', index: 0, title: 'Section 1', navigable: true, answered: 2, total: 4, isCurrent: true },
		{ id: 'sec-2', index: 1, title: 'Section 2', navigable: true, answered: 0, total: 3, isCurrent: false },
	]);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">Fixture for section navigation menu disclosure.</p>

	<SectionMenu
		{sections}
		onSectionSelect={(idx) =>
			sections = sections.map((section) => ({ ...section, isCurrent: section.index === idx }))}
	/>
</div>
