<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Documentation - PIE QTI 2.2 Player</title>
</svelte:head>

<div class="container mx-auto px-8 py-12">
	<div class="prose max-w-none">
		<h1>Documentation</h1>

		<div class="alert alert-info mb-8">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="stroke-current shrink-0 w-6 h-6"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path>
			</svg>
			<span>
				Comprehensive documentation will be added in Phase 9 of the implementation.
			</span>
		</div>

		<h2>Quick Links</h2>
		<ul>
			<li>
				<a href="http://www.imsglobal.org/question/" target="_blank" class="link link-primary">
					IMS QTI Specification
				</a> - Official QTI 2.2 specification
			</li>
		</ul>

		<h2>Coming Soon</h2>
		<p>This documentation section will include:</p>
		<ul>
			<li><strong>Installation Guide</strong> - How to install and set up the player</li>
			<li><strong>Quick Start</strong> - Get up and running in 5 minutes</li>
			<li><strong>API Reference</strong> - Complete API documentation</li>
			<li><strong>Interaction Types</strong> - All 18 supported interaction types with examples</li>
			<li><strong>Hook Interface</strong> - How to integrate with a backend</li>
			<li><strong>Theming Guide</strong> - Customize the player appearance</li>
			<li><strong>Framework Integration</strong> - Examples for React, Vue, Angular, etc.</li>
		</ul>

		<div class="not-prose mt-8">
			<a href="{base}/" class="btn btn-primary">
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
						d="M10 19l-7-7m0 0l7-7m-7 7h18"
					/>
				</svg>
				Back to Home
			</a>
		</div>
	</div>
</div>
