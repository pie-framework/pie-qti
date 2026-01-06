<script lang="ts">
	import '../../app.css';
	import '@pie-qti/qti2-typeset-katex/css';

	const { children } = $props();
</script>

<svelte:head>
	<title>PIE QTI 2.2 Player - Test Fixtures</title>
</svelte:head>

<!-- Minimal layout for test fixtures - no navigation, no theme selector, just the content -->
<div class="min-h-screen bg-base-200 p-4">
	{@render children()}
</div>
