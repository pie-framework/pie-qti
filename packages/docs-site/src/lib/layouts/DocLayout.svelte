<script lang="ts">
	let { children } = $props();
</script>

<div class="max-w-4xl mx-auto">
	<article class="prose prose-lg max-w-none">
		{@render children()}
	</article>
</div>
