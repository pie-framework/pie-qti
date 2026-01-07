<script lang="ts">
	import { dev } from '$app/environment';
	import { base } from '$app/paths';

	// Note: docs-site is prerendered; avoid creating an internal prerender-crawled link to /examples
	// (that path is served by a separate app, merged into the final Pages artifact).
	const examplesHref = dev ? `${base}/examples/` : 'https://pie-framework.github.io/pie-qti/examples/';
</script>

<svelte:head>
	<title>PIE-QTI</title>
</svelte:head>

<div class="max-w-6xl mx-auto">
	<section class="py-8 lg:py-14">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
			<div>
				<h1 class="text-4xl lg:text-5xl font-bold tracking-tight">PIE-QTI</h1>
				<p class="mt-4 text-lg opacity-80">
					Production-ready <strong>QTI 2.x players</strong> and a <strong>PIE ↔ QTI 2.2</strong> transformation framework.
				</p>

				<div class="mt-6 flex flex-wrap gap-2">
					<span class="badge badge-success badge-lg">QTI 2.2 compliant</span>
					<span class="badge badge-success badge-lg">21/21 interactions</span>
					<span class="badge badge-info badge-lg">Accessibility tested</span>
					<span class="badge badge-info badge-lg">TypeScript strict</span>
				</div>

				<div class="mt-8 flex flex-wrap gap-3">
					<a class="btn btn-primary" href={examplesHref} target={dev ? undefined : '_blank'} rel="noreferrer">
						Live Examples
					</a>
					<a
						class="btn btn-outline"
						href="https://github.com/pie-framework/pie-qti"
						target="_blank"
						rel="noreferrer"
					>
						GitHub
					</a>
					<a
						class="btn btn-ghost"
						href="https://github.com/pie-framework/pie-qti/blob/master/STATUS.md"
						target="_blank"
						rel="noreferrer"
					>
						Status
					</a>
				</div>

				<div class="mt-8 stats shadow bg-base-200 w-full">
					<div class="stat">
						<div class="stat-title">Players</div>
						<div class="stat-value text-primary">Ready</div>
						<div class="stat-desc">Item + assessment</div>
					</div>
					<div class="stat">
						<div class="stat-title">Transforms</div>
						<div class="stat-value">Active</div>
						<div class="stat-desc">QTI ↔ PIE</div>
					</div>
					<div class="stat">
						<div class="stat-title">Evals</div>
						<div class="stat-value">64</div>
						<div class="stat-desc">49 components + 15 assessment</div>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<div class="mockup-browser border border-base-300 bg-base-200">
						<div class="mockup-browser-toolbar">
							<div class="input border border-base-300 bg-base-100">pie-framework.github.io/pie-qti/examples</div>
						</div>
						<div class="bg-base-100 p-3">
							<img
								alt="QTI player examples"
								class="rounded-lg border border-base-200"
								src={`${base}/images/examples-screenshot-1.png`}
								loading="lazy"
							/>
						</div>
					</div>
					<p class="mt-3 text-sm opacity-70">
						Try the item demo (all interactions) or the assessment demo (navigation, sections, scoring).
					</p>
				</div>
			</div>
		</div>
	</section>

	<section class="py-10">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Why this exists</h2>
					<p class="opacity-80">
						Partners exchange assessment content in <strong>QTI</strong>; modern delivery and authoring often happens in
						<strong>PIE</strong>. PIE-QTI provides both: rendering and transformation.
					</p>
					<div class="card-actions mt-2">
						<a
							class="link link-primary"
							href="https://pie-framework.org/"
							target="_blank"
							rel="noreferrer"
						>
							What is PIE?
						</a>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">QTI 2.x Players</h2>
					<ul class="mt-2 space-y-1 opacity-80">
						<li><strong>Item player</strong>: 21 interaction types, 45 operators, role-based rendering</li>
						<li><strong>Assessment player</strong>: sections, navigation rules, submission modes, scoring</li>
						<li><strong>Extensible</strong>: plugins + registries + custom operators</li>
						<li><strong>Themable</strong>: web components + CSS variable contract</li>
					</ul>
					<div class="card-actions justify-end mt-4">
						<a
							class="btn btn-sm btn-outline"
							href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-item-player/README.md"
							target="_blank"
							rel="noreferrer"
						>
							Item Player README
						</a>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Transforms</h2>
					<ul class="mt-2 space-y-1 opacity-80">
						<li><strong>QTI → PIE</strong>: lossless when QTI originated from PIE, best-effort otherwise</li>
						<li><strong>PIE → QTI</strong>: rebuild QTI, generate IMS content packages</li>
						<li><strong>Tooling</strong>: CLI + web app for upload/analyze/transform/preview</li>
					</ul>
					<div class="card-actions justify-end mt-4">
						<a
							class="btn btn-sm btn-outline"
							href="https://github.com/pie-framework/pie-qti/blob/master/docs/PIE-QTI-TRANSFORMATION-GUIDE.md"
							target="_blank"
							rel="noreferrer"
						>
							Transformation Guide
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="py-10">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Transform App</h2>
					<p class="opacity-80">
						Upload, analyze, transform, and preview QTI/PIE content.
					</p>
					<img
						alt="Transform app screenshot"
						class="mt-4 rounded-lg border border-base-200"
						src={`${base}/images/transform-app-screenshot-1.png`}
						loading="lazy"
					/>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Quick links</h2>
					<ul class="mt-2 space-y-2">
						<li>
							<a class="link link-primary" href={examplesHref} target={dev ? undefined : '_blank'} rel="noreferrer">
								Live Examples
							</a>
						</li>
						<li>
							<a
								class="link link-primary"
								href="https://github.com/pie-framework/pie-qti/blob/master/docs/ARCHITECTURE.md"
								target="_blank"
								rel="noreferrer"
							>
								Architecture Guide
							</a>
						</li>
						<li>
							<a
								class="link link-primary"
								href="https://github.com/pie-framework/pie-qti/blob/master/packages/qti2-default-components/STYLING.md"
								target="_blank"
								rel="noreferrer"
							>
								Styling Contract
							</a>
						</li>
						<li>
							<a
								class="link link-primary"
								href="https://github.com/pie-framework/pie-qti/blob/master/STATUS.md"
								target="_blank"
								rel="noreferrer"
							>
								Implementation Status
							</a>
						</li>
					</ul>

					<div class="divider"></div>

					<h3 class="font-semibold">Develop</h3>
					<pre class="mockup-code mt-3"><code># Install dependencies
bun install

# Run checks
bun run check

# Preview GitHub Pages build
bun run build:pages
bun run preview:pages</code></pre>
				</div>
			</div>
		</div>
	</section>
</div>
