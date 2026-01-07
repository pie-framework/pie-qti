<script lang="ts">
	import { dev } from '$app/environment';
	import { base } from '$app/paths';

	// Note: docs-site is prerendered; avoid creating an internal prerender-crawled link to /examples
	// (that path is served by a separate app, merged into the final Pages artifact).
	const examplesHref = dev ? `${base}/examples/` : 'https://pie-framework.github.io/pie-qti/examples/';
</script>

<header class="border-b border-base-200 bg-base-100/80 backdrop-blur">
	<div class="navbar max-w-6xl mx-auto px-4">
		<div class="navbar-start">
			<a class="btn btn-ghost text-base gap-2" href="{base}/">
				<img
					alt="PIE-QTI"
					class="w-6 h-6"
					src="{base}/pie-logo-orange.svg"
					loading="eager"
				/>
				<span class="font-semibold">PIE-QTI</span>
			</a>
		</div>

		<div class="navbar-center hidden md:flex">
			<ul class="menu menu-horizontal px-1">
				<li><a href="{base}/">Architecture</a></li>
				<li><a href={examplesHref}>Examples</a></li>
			</ul>
		</div>

		<div class="navbar-end">
			<a
				class="btn btn-sm btn-outline"
				href="https://github.com/pie-framework/pie-qti"
				target="_blank"
				rel="noreferrer"
			>
				GitHub
			</a>
		</div>
	</div>
</header>


