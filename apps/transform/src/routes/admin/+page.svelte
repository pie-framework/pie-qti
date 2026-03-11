<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		// Redirect to plugins page
		goto('/admin/plugins');
	});
</script>

<div class="flex items-center justify-center min-h-96">
	<div class="loading loading-spinner loading-lg"></div>
</div>
