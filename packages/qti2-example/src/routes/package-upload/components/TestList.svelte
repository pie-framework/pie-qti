<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{ view: [test: { identifier: string; href: string }] }>();

	export let tests: Array<{ identifier: string; href: string; title?: string }>;

	function handleView(test: { identifier: string; href: string }) {
		dispatch('view', test);
	}
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title">
			Tests / Assessments
			<div class="badge badge-secondary badge-lg">{tests.length}</div>
		</h2>
		<p class="text-sm text-base-content/70">Click a test to view the complete assessment</p>

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
					{#each tests as test, index}
						<tr>
							<td>{index + 1}</td>
							<td>
								<code class="text-xs">{test.identifier}</code>
							</td>
							<td>
								{#if test.title}
									{test.title}
								{:else}
									<span class="text-base-content/50 italic">No title</span>
								{/if}
							</td>
							<td>
								<button class="btn btn-sm btn-secondary" on:click={() => handleView(test)}>
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
