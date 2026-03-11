<script lang="ts">
	import { page } from '$app/stores';

	const { error } = $derived($page);
	const sessionId = $derived($page.params.id);
</script>

<svelte:head>
	<title>Error - QTI Batch Processor</title>
</svelte:head>

<div class="flex items-center justify-center min-h-screen p-4">
	<div class="card bg-base-100 shadow-xl max-w-md w-full">
		<div class="card-body items-center text-center">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="stroke-warning h-16 w-16 mb-4"
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<h2 class="card-title text-2xl">Items Not Available</h2>
			<p class="text-base-content/70">
				{error?.message || 'Unable to display items for this session.'}
			</p>
			<div class="card-actions justify-center mt-4 gap-2">
				{#if sessionId}
					<a href="/session/{sessionId}" class="btn btn-primary">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
						Back to Session
					</a>
				{/if}
				<a href="/" class="btn btn-outline">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
						/>
					</svg>
					Home
				</a>
			</div>
		</div>
	</div>
</div>
