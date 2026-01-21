<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{ view: [item: { identifier: string; href: string }] }>();

	export let items: Array<{ identifier: string; href: string; title?: string }>;

	function handleView(item: { identifier: string; href: string }) {
		dispatch('view', item);
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title">
			Items
			<div class="badge badge-primary badge-lg">{items.length}</div>
		</h2>
		<p class="text-sm text-base-content/70">Click an item to view it in the QTI player</p>

		<div class="overflow-x-auto">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>#</th>
						<th>Identifier</th>
						<th>Title</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item, index}
						<tr>
							<td>{index + 1}</td>
							<td>
								<code class="text-xs">{item.identifier}</code>
							</td>
							<td>
								{#if item.title}
									{item.title}
								{:else}
									<span class="text-base-content/50 italic">No title</span>
								{/if}
							</td>
							<td>
								<button class="btn btn-sm btn-primary" on:click={() => handleView(item)}>
									View
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
