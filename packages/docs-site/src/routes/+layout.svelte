<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import SiteHeader from '$lib/components/SiteHeader.svelte';

	let { children } = $props();

	// Keep a stable theme for docs
	$effect(() => {
		if (browser) {
			document.documentElement.setAttribute('data-theme', 'halloween');
		}
	});
</script>

<div class="min-h-screen">
	<SiteHeader />
	<main class="px-4 py-10">
		{@render children()}
	</main>
</div>
