<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import {
		ITEM_PACKAGES,
		TEST_PACKAGES,
		ITEM_PACKAGES_QTI30_BASIC,
		TEST_PACKAGES_QTI30_BASIC,
		type ConformancePackage,
	} from '$lib/conformance-packages.js';
	import { loadConformancePackageFromUrl } from '$lib/package-processor.js';

	// Per-package loading state
	let loadingId = $state<string | null>(null);
	let errorId = $state<string | null>(null);
	let errorMessage = $state<string>('');

	async function loadPackage(pkg: ConformancePackage) {
		loadingId = pkg.id;
		errorId = null;
		errorMessage = '';

		try {
			const packageData = await loadConformancePackageFromUrl(pkg.zipPath);

			if (pkg.type === 'item' && packageData.items.length > 0) {
				// Navigate to the first item in the package
				await goto(
					`${base}/package-upload/${packageData.packageId}/item/${packageData.items[0].identifier}`
				);
			} else if (pkg.type === 'test' && packageData.tests.length > 0) {
				// Navigate to the test viewer
				await goto(
					`${base}/package-upload/${packageData.packageId}/test/${packageData.tests[0].identifier}`
				);
			} else if (packageData.items.length > 0) {
				// Fallback: show items even for test packages (e.g. s3-s4 which has no manifest items)
				await goto(
					`${base}/package-upload/${packageData.packageId}/item/${packageData.items[0].identifier}`
				);
			} else {
				errorId = pkg.id;
				errorMessage = 'Package loaded but no items or tests found in manifest.';
			}
		} catch (err) {
			errorId = pkg.id;
			errorMessage = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loadingId = null;
		}
	}
</script>

<svelte:head>
	<title>QTI Conformance Test Packages | PIE-QTI Demo</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold mb-2">QTI Conformance Test Packages</h1>
		<p class="text-base-content/70 text-sm">
			Each package below is the official 1EdTech conformance ZIP, loaded through
			<code class="font-mono">@pie-qti/ims-cp-browser</code> exactly as a production deployment
			would receive it. Click <strong>Load &amp; View</strong> to fetch the ZIP, parse the
			manifest, resolve image assets, and open the first item or test in the standard viewer.
		</p>
	</div>

	<!-- QTI 2.2 Advanced header -->
	<div class="mb-6">
		<h2 class="text-2xl font-bold">QTI 2.2 Advanced</h2>
	</div>

	<!-- Item interaction packages -->
	<section class="mb-10" aria-labelledby="item-packages-heading">
		<h2 id="item-packages-heading" class="text-xl font-semibold mb-4 border-b border-base-300 pb-2">
			Item Interaction Packages
		</h2>
		<div class="flex flex-col gap-3">
			{#each ITEM_PACKAGES as pkg (pkg.id)}
				<div class="card bg-base-100 border border-base-300 shadow-sm">
					<div class="card-body py-4 px-5">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="badge badge-primary badge-sm font-mono font-bold">{pkg.featureId}</span>
									<h3 class="font-semibold text-base">{pkg.title}</h3>
								</div>
								<p class="text-sm text-base-content/70 mb-2">{pkg.description}</p>
								{#if pkg.deliveryCriteria.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each pkg.deliveryCriteria as criterion}
											<span class="badge badge-outline badge-xs font-mono">{criterion}</span>
										{/each}
									</div>
								{/if}
							</div>
							<div class="flex-shrink-0 flex flex-col items-end gap-1">
								<button
									class="btn btn-sm btn-primary"
									class:loading={loadingId === pkg.id}
									disabled={loadingId !== null}
									onclick={() => loadPackage(pkg)}
									aria-label="Load and view {pkg.title}"
								>
									{loadingId === pkg.id ? 'Loading…' : 'Load & View'}
								</button>
								{#if errorId === pkg.id}
									<span class="text-error text-xs max-w-48 text-right">{errorMessage}</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Assessment test packages (QTI 2.2 Advanced) -->
	<section aria-labelledby="test-packages-heading">
		<h2 id="test-packages-heading" class="text-xl font-semibold mb-4 border-b border-base-300 pb-2">
			Assessment Test Packages
		</h2>
		<p class="text-sm text-base-content/60 mb-4">
			These packages contain a full <code class="font-mono">assessmentTest</code> XML with multiple
			items. The test viewer currently shows the raw XML; full test execution is via the Assessment
			Player in the <a href="{base}/assessment-demo" class="link">Assessment Demo</a>.
		</p>
		<div class="flex flex-col gap-3">
			{#each TEST_PACKAGES as pkg (pkg.id)}
				<div class="card bg-base-100 border border-base-300 shadow-sm">
					<div class="card-body py-4 px-5">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="badge badge-secondary badge-sm font-mono font-bold">{pkg.featureId}</span>
									<h3 class="font-semibold text-base">{pkg.title}</h3>
								</div>
								<p class="text-sm text-base-content/70 mb-2">{pkg.description}</p>
								{#if pkg.deliveryCriteria.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each pkg.deliveryCriteria as criterion}
											<span class="badge badge-outline badge-xs font-mono">{criterion}</span>
										{/each}
									</div>
								{/if}
							</div>
							<div class="flex-shrink-0 flex flex-col items-end gap-1">
								<button
									class="btn btn-sm btn-secondary"
									class:loading={loadingId === pkg.id}
									disabled={loadingId !== null}
									onclick={() => loadPackage(pkg)}
									aria-label="Load and view {pkg.title}"
								>
									{loadingId === pkg.id ? 'Loading…' : 'Load & View'}
								</button>
								{#if errorId === pkg.id}
									<span class="text-error text-xs max-w-48 text-right">{errorMessage}</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- QTI 3.0 Basic divider -->
	<div class="divider my-10"></div>
	<div class="mb-6">
		<h2 class="text-2xl font-bold">QTI 3.0 Basic</h2>
		<p class="text-base-content/70 text-sm mt-1">
			Official 1EdTech QTI 3.0 Basic conformance packages. Includes Shared Vocabulary CSS classes
			(qti-labels-*, qti-height-lines-N, qti-input-width-N, data-patternmask-message).
		</p>
	</div>

	<!-- QTI 3.0 Basic — item packages -->
	<section class="mb-10" aria-labelledby="qti30-item-packages-heading">
		<h3 id="qti30-item-packages-heading" class="text-xl font-semibold mb-4 border-b border-base-300 pb-2">
			Item Interaction Packages
		</h3>
		<div class="flex flex-col gap-3">
			{#each ITEM_PACKAGES_QTI30_BASIC as pkg (pkg.id)}
				<div class="card bg-base-100 border border-base-300 shadow-sm">
					<div class="card-body py-4 px-5">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="badge badge-primary badge-sm font-mono font-bold">{pkg.featureId}</span>
									<h4 class="font-semibold text-base">{pkg.title}</h4>
								</div>
								<p class="text-sm text-base-content/70 mb-2">{pkg.description}</p>
								{#if pkg.deliveryCriteria.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each pkg.deliveryCriteria as criterion}
											<span class="badge badge-outline badge-xs font-mono">{criterion}</span>
										{/each}
									</div>
								{/if}
							</div>
							<div class="flex-shrink-0 flex flex-col items-end gap-1">
								<button
									class="btn btn-sm btn-primary"
									class:loading={loadingId === pkg.id}
									disabled={loadingId !== null}
									onclick={() => loadPackage(pkg)}
									aria-label="Load and view {pkg.title}"
								>
									{loadingId === pkg.id ? 'Loading…' : 'Load & View'}
								</button>
								{#if errorId === pkg.id}
									<span class="text-error text-xs max-w-48 text-right">{errorMessage}</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- QTI 3.0 Basic — test packages -->
	<section aria-labelledby="qti30-test-packages-heading">
		<h3 id="qti30-test-packages-heading" class="text-xl font-semibold mb-4 border-b border-base-300 pb-2">
			Assessment Test Packages
		</h3>
		<div class="flex flex-col gap-3">
			{#each TEST_PACKAGES_QTI30_BASIC as pkg (pkg.id)}
				<div class="card bg-base-100 border border-base-300 shadow-sm">
					<div class="card-body py-4 px-5">
						<div class="flex items-start justify-between gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class="badge badge-secondary badge-sm font-mono font-bold">{pkg.featureId}</span>
									<h4 class="font-semibold text-base">{pkg.title}</h4>
								</div>
								<p class="text-sm text-base-content/70 mb-2">{pkg.description}</p>
								{#if pkg.deliveryCriteria.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each pkg.deliveryCriteria as criterion}
											<span class="badge badge-outline badge-xs font-mono">{criterion}</span>
										{/each}
									</div>
								{/if}
							</div>
							<div class="flex-shrink-0 flex flex-col items-end gap-1">
								<button
									class="btn btn-sm btn-secondary"
									class:loading={loadingId === pkg.id}
									disabled={loadingId !== null}
									onclick={() => loadPackage(pkg)}
									aria-label="Load and view {pkg.title}"
								>
									{loadingId === pkg.id ? 'Loading…' : 'Load & View'}
								</button>
								{#if errorId === pkg.id}
									<span class="text-error text-xs max-w-48 text-right">{errorMessage}</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
