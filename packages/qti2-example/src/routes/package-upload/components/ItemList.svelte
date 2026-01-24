<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { PackageItem } from '$lib/package-processor';

	const dispatch = createEventDispatcher<{ view: [item: { identifier: string; href: string }] }>();

	export let items: PackageItem[];

	function handleView(item: PackageItem) {
		dispatch('view', [item]);
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
						<th>Interaction Types</th>
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
								{#if item.metadata?.interactionTypes && item.metadata.interactionTypes.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each item.metadata.interactionTypes as interactionType}
											<span class="badge badge-sm badge-outline">{interactionType}</span>
										{/each}
									</div>
								{:else}
									<span class="text-base-content/50 italic text-xs">None detected</span>
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
