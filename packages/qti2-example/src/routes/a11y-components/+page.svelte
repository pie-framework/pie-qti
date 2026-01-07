<script lang="ts">
	import { base } from '$app/paths';
	import { A11Y_FIXTURES } from '$lib/a11y/fixtures';
</script>

<svelte:head>
	<title>A11y Component Fixtures</title>
</svelte:head>

<div class="container mx-auto px-8 py-12 space-y-6">
	<h1 class="text-2xl font-bold">A11y component fixtures</h1>
	<p class="text-base-content/70">
		These pages render individual UI components in isolation so Playwright + axe scans focus on library
		accessibility (not demo UI).
	</p>

	<ul class="list-disc pl-6 space-y-2">
		{#each A11Y_FIXTURES as f}
			<li>
				<a class="link link-primary" href={`${base}/a11y-components/${f.id}`}>{f.title}</a>
			</li>
		{/each}
	</ul>
</div>


