<svelte:head>
	<title>QTI Certification Coverage | PIE-QTI Demo</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="card bg-base-100 border border-base-300 shadow-xl">
		<div class="card-body">
			<h1 class="card-title text-3xl">QTI Certification Coverage</h1>
			<p class="text-base-content/70">
				The public demo no longer bundles official 1EdTech conformance ZIPs. Those packages are
				member-only assets and are exercised in the private certification project.
			</p>
			<p class="text-base-content/70">
				Public CI now relies on clean-room fixtures and targeted browser tests that cover QTI 2.2
				Advanced and QTI 3.0 Advanced DELIVERY behavior without requiring a private sibling checkout.
			</p>
			<div class="bg-base-200 rounded-box p-4">
				<p class="font-semibold mb-2">Public gate</p>
				<code>bun run test:certification:public</code>
			</div>
			<p class="text-sm text-base-content/60">
				Developers with access to the private conformance repository should run official package
				verification there against published <code>@pie-qti/*</code> versions.
			</p>
		</div>
	</div>
</div>
