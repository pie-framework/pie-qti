<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Documentation - PIE QTI Player Demo</title>
</svelte:head>

<div class="container mx-auto px-8 py-12">
	<div class="prose max-w-none">
		<h1>PIE-QTI Quickstart</h1>

		<div class="alert alert-info mb-8 not-prose">
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
				This demo is a public, clean-room reference for loading QTI items, uploading IMS packages,
				and checking compatibility with the PIE-QTI player stack.
			</span>
		</div>

		<div class="not-prose grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
			<a href="{base}/item-demo" class="card bg-base-100 shadow hover:shadow-xl transition-shadow">
				<div class="card-body">
					<h2 class="card-title">Try an Item</h2>
					<p class="text-sm text-base-content/70">
						Select a clean-room sample or paste custom XML. The demo renders the item, processes
						responses, and shows compatibility diagnostics.
					</p>
				</div>
			</a>
			<a href="{base}/assessment-demo" class="card bg-base-100 shadow hover:shadow-xl transition-shadow">
				<div class="card-body">
					<h2 class="card-title">Run an Assessment</h2>
					<p class="text-sm text-base-content/70">
						Exercise navigation modes, sections, item sessions, response processing, and assessment
						scoring through the assessment player.
					</p>
				</div>
			</a>
			<a href="{base}/package-upload" class="card bg-base-100 shadow hover:shadow-xl transition-shadow">
				<div class="card-body">
					<h2 class="card-title">Upload a Package</h2>
					<p class="text-sm text-base-content/70">
						Open IMS content packages in the browser, browse items/tests/assets, and validate item
						references before playback.
					</p>
				</div>
			</a>
		</div>

		<h2>What This Demo Proves</h2>
		<p>
			PIE-QTI is built around production packages rather than demo-only parsers. The item player
			instantiates QTI XML, extracts supported interactions, renders through standard web components,
			and executes response processing through the shared AST engine. The assessment player adds test
			navigation, item session state, submission modes, and aggregate scoring.
		</p>

		<h2>Supported Capability Areas</h2>
		<ul>
			<li><strong>QTI versions:</strong> QTI 2.1/2.2 compatibility and QTI 3.0 element/attribute mapping.</li>
			<li><strong>Interactions:</strong> standard choice, text, inline, ordering, matching, graphical, media, upload, custom, and end-attempt interactions.</li>
			<li><strong>Processing:</strong> response, outcome, and template processing through <code>@pie-qti/qti-processing</code>.</li>
			<li><strong>Packages:</strong> IMS content package manifest parsing, item/test/resource discovery, and browser-local upload handling.</li>
			<li><strong>Accessibility:</strong> WCAG-oriented component fixtures and assessment behavior checks in Playwright.</li>
			<li><strong>Certification:</strong> public clean-room coverage tracked by the certification matrix and run with <code>bun run test:certification:public</code>.</li>
		</ul>

		<h2>When Importing Your Own QTI</h2>
		<p>
			Use the item demo for single XML files and package upload for ZIP packages. The compatibility
			diagnostics panel reports detected interactions, response variables, response processing templates,
			asset checks, and matching public certification coverage. A warning does not always mean the item
			cannot play, but it does mark the next place to inspect.
		</p>

		<h2>Useful Source References</h2>
		<ul>
			<li><a href="https://github.com/pie-framework/pie-qti/blob/master/packages/item-player/README.md" target="_blank" rel="noreferrer">Item Player README</a></li>
			<li><a href="https://github.com/pie-framework/pie-qti/blob/master/packages/assessment-player/README.md" target="_blank" rel="noreferrer">Assessment Player README</a></li>
			<li><a href="https://github.com/pie-framework/pie-qti/blob/master/docs/certification/PUBLIC_COVERAGE_MATRIX.md" target="_blank" rel="noreferrer">Public Certification Coverage</a></li>
			<li><a href="https://www.1edtech.org/standards/qti" target="_blank" rel="noreferrer">1EdTech QTI Standard</a></li>
		</ul>

		<div class="not-prose mt-10 flex flex-wrap gap-3">
			<a href="{base}/item-demo" class="btn btn-primary">
				Try Item Demo
			</a>
			<a href="{base}/package-upload" class="btn btn-outline">
				Upload Package
			</a>
			<a href="{base}/" class="btn btn-ghost">
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
