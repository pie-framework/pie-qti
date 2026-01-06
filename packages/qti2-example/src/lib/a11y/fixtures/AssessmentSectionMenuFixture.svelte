<script lang="ts">
	import SectionMenu from '@pie-qti/qti2-assessment-player/components/SectionMenu.svelte';

	const sections = [
		{ id: 'sec-1', index: 0, title: 'Section 1' },
		{ id: 'sec-2', index: 1, title: 'Section 2' },
	];

	let currentSectionIndex = $state(0);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">Fixture for section navigation menu + overlay.</p>

	<SectionMenu
		{sections}
		{currentSectionIndex}
		onSectionSelect={(idx) => (currentSectionIndex = idx)}
	/>
</div>


