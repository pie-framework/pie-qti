<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<div class="container mx-auto p-4 max-w-7xl">
	<div class="mb-6">
		<div class="breadcrumbs text-sm">
			<ul>
				<li><a href="/">Home</a></li>
				<li><a href="/admin/plugins">Admin</a></li>
			</ul>
		</div>
	</div>

	{@render children()}
</div>
