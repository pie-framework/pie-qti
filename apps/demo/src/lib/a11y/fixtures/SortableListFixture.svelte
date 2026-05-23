<script lang="ts">
	import { SortableList } from '@pie-qti/default-components/shared/components';

	const items = [
		{ id: 'a', text: 'Alpha' },
		{ id: 'b', text: 'Bravo' },
		{ id: 'c', text: 'Charlie' },
	];

	let orderedIds = $state(items.map((i) => i.id));
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for keyboard + screen reader behaviors (grab/move/drop via Space + arrows).
	</p>

	<SortableList
		items={items}
		{orderedIds}
		onReorder={(newOrder) => (orderedIds = newOrder)}
	/>
</div>


