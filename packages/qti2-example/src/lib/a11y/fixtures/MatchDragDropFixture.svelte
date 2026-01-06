<script lang="ts">
	import MatchDragDrop from '@pie-qti/qti2-default-components/shared/components/MatchDragDrop.svelte';

	const sourceSet = [
		{ identifier: 's1', text: 'Dog', matchMax: 1 },
		{ identifier: 's2', text: 'Cat', matchMax: 1 },
	];

	const targetSet = [
		{ identifier: 't1', text: 'Barks', matchMax: 1 },
		{ identifier: 't2', text: 'Meows', matchMax: 1 },
	];

	let pairs = $state<string[]>([]);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for keyboard matching (select source with Space/Enter, Tab to target, Space/Enter to match).
	</p>

	<MatchDragDrop
		{sourceSet}
		{targetSet}
		{pairs}
		onPairsChange={(newPairs) => (pairs = newPairs)}
	/>
</div>


