<script lang="ts">
	import '../app.css';
	import { browser } from '$app/env';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import StatusBanner from '#lib/components/StatusBanner.svelte';

	let { children } = $props();

	// Keep a stable theme for docs
	$effect(() => {
		if (browser) {
			document.documentElement.setAttribute('data-theme', 'light');
		}
	});
</script>

<div class="min-h-screen">
	<SiteHeader />
	<StatusBanner />
	<main class="px-4 py-10">
		{@render children()}
	</main>
</div>
