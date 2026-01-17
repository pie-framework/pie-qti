<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const session = $derived(data.session);
	let _isAnalyzing = $state(false);
	let _analysisError = $state<string | null>(null);
	let _showDeleteConfirm = $state(false);
	let _isTransforming = $state(false);
	let _transformError = $state<string | null>(null);

	// Check if there are unsupported interactions that prevent PIE conversion
	const hasUnsupportedInteractions = $derived(() => {
		if (!session.analysis?.issues) return false;
		return session.analysis.issues.some(issue =>
			issue.includes('UNSUPPORTED INTERACTIONS') ||
			issue.includes('cannot convert to PIE')
		);
	});

	const canTransformToPie = $derived(!hasUnsupportedInteractions());

	function _formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round(bytes / k ** i * 100) / 100 + ' ' + sizes[i];
	}

	function _getStatusColor(status: string): string {
		switch (status) {
			case 'complete':
				return 'badge-success';
			case 'error':
				return 'badge-error';
			case 'transforming':
			case 'analyzing':
				return 'badge-warning';
			case 'ready':
				return 'badge-success';
			default:
				return 'badge-info';
		}
	}

	async function _analyzePackages() {
		_isAnalyzing = true;
		_analysisError = null;

		try {
			const response = await fetch(`/api/sessions/${session.id}/analyze`, {
				method: 'POST'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Analysis failed');
			}

			const _result = await response.json();

			// Refresh SvelteKit data without a full page reload
			await invalidateAll();
		} catch (error) {
			console.error('Analysis error:', error);
			_analysisError = error instanceof Error ? error.message : 'Analysis failed';
		} finally {
			_isAnalyzing = false;
		}
	}

	function _promptDeleteSession() {
		_showDeleteConfirm = true;
	}

	async function _confirmDeleteSession() {
		try {
			const response = await fetch(`/api/sessions/${session.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete session');
			}

			// Redirect to home
			await goto('/');
		} catch (error) {
			console.error('Delete session error:', error);
			_analysisError = error instanceof Error ? error.message : 'Failed to delete session';
			throw error; // Re-throw to prevent dialog from closing
		}
	}

	async function _transformToPie() {
		_isTransforming = true;
		_transformError = null;

		try {
			const response = await fetch(`/api/sessions/${session.id}/transform`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}) // Transform all items
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Transformation failed');
			}

			const _results = await response.json();

			// Navigate to results view
			await goto(`/session/${session.id}/transformed`);
		} catch (error) {
			console.error('Transformation error:', error);
			_transformError = error instanceof Error ? error.message : 'Transformation failed';
		} finally {
			_isTransforming = false;
		}
	}
</script>

<svelte:head>
	<title>Session {session.id} - QTI Batch Processor</title>
</svelte:head>

<div class="h-full flex flex-col p-4">
	<div class="mb-4">
		<!-- Breadcrumb -->
		<div class="text-sm breadcrumbs">
			<ul>
				<li><a href="/" data-testid="session-breadcrumb-home">Home</a></li>
				<li data-testid="session-breadcrumb-session">Session {session.id.split('-')[0]}</li>
			</ul>
		</div>

		<!-- Session Header -->
		<div class="flex justify-between items-center">
			<div>
				<h1 class="text-2xl font-bold">Session {session.id.split('-')[0]}</h1>
				<p class="text-sm text-base-content/60">
					Created {new Date(session.createdAt).toLocaleString()}
				</p>
			</div>
			<div class="flex items-center gap-2">
				<span class="badge {_getStatusColor(session.status)} badge-lg">
					{session.status}
				</span>
				<button onclick={() => _promptDeleteSession?.()} class="btn btn-error btn-sm" title="Delete session" data-testid="delete-session">
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
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					Delete
				</button>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 overflow-auto">
		<div class="grid grid-cols-1 gap-4">
			<!-- Packages Section -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Uploaded Packages</h2>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>Package</th>
									<th>Type</th>
									<th>Size</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{#each session.analysis?.packages || [] as pkg}
									<tr>
										<td class="font-medium">{pkg.packageName}</td>
										<td>
											<span class="badge badge-sm">QTI</span>
										</td>
										<td class="text-sm text-base-content/60">{pkg.itemCount} items</td>
										<td>
											<span class="badge badge-info badge-sm">Uploaded</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<!-- Actions Section -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Actions</h2>

					{#if _analysisError}
						<div class="alert alert-error mb-4">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="stroke-current shrink-0 h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>{_analysisError}</span>
						</div>
					{/if}

					{#if !session.analysis}
						<p class="text-sm text-base-content/60 mb-4">
							Analyze the packages to inspect their structure and contents.
						</p>
						<div class="flex gap-2">
							<button
								class="btn btn-primary"
								onclick={() => _analyzePackages?.()}
								disabled={_isAnalyzing}
								data-testid="analyze-packages"
							>
								{#if _isAnalyzing}
									<span class="loading loading-spinner"></span>
									Analyzing...
								{:else}
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
											d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
										/>
									</svg>
									Analyze Packages
								{/if}
							</button>
							<button class="btn btn-outline" disabled>
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
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								Transform All (Coming Soon)
							</button>
						</div>
					{:else}
						{#if canTransformToPie}
							<p class="text-sm text-base-content/60 mb-4">
								Analysis complete. Review results below or proceed to transformation.
							</p>
						{:else}
							<div class="alert alert-error mb-4">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="stroke-current shrink-0 h-6 w-6"
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
								<div>
									<h3 class="font-bold">Cannot Convert to PIE</h3>
									<div class="text-sm">
										This package contains QTI interaction types that have no PIE equivalent.
										See issues below for details. Use the QTI player instead to preview these items.
									</div>
								</div>
							</div>
						{/if}

						{#if _transformError}
							<div class="alert alert-error mb-4">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="stroke-current shrink-0 h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<span>{_transformError}</span>
							</div>
						{/if}

						<div class="flex gap-2">
							<button
								class="btn btn-primary"
								onclick={() => _transformToPie?.()}
								disabled={_isTransforming || !canTransformToPie}
								data-testid="transform-to-pie"
								title={!canTransformToPie ? 'Package contains unsupported interaction types' : ''}
							>
								{#if _isTransforming}
									<span class="loading loading-spinner"></span>
									Transforming...
								{:else}
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
											d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
										/>
									</svg>
									Transform to PIE
								{/if}
							</button>
							<button class="btn btn-outline" onclick={() => _analyzePackages?.()} disabled={_isAnalyzing} data-testid="re-analyze">
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
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								Re-analyze
							</button>
						</div>
					{/if}
				</div>
			</div>

			<!-- Analysis Results -->
			{#if session.analysis}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">Analysis Results</h2>

						<!-- Summary Stats -->
						<div class="stats stats-vertical lg:stats-horizontal shadow mb-4">
							<div class="stat">
								<div class="stat-title">Total Items</div>
								<div class="stat-value text-primary">{session.analysis.totalItems}</div>
							</div>
							<div class="stat">
								<div class="stat-title">Passages</div>
								<div class="stat-value text-secondary">{session.analysis.totalPassages}</div>
							</div>
							<div class="stat">
								<div class="stat-title">Tests</div>
								<div class="stat-value">{session.analysis.totalTests}</div>
							</div>
							<div class="stat">
								<div class="stat-title">Packages</div>
								<div class="stat-value">{session.analysis.packages.length}</div>
							</div>
						</div>

						<!-- Interaction Types -->
						{#if Object.keys(session.analysis.allInteractionTypes).length > 0}
							<div class="mb-4">
								<h3 class="font-semibold mb-2">Interaction Types Found</h3>
								<div class="flex flex-wrap gap-2">
									{#each Object.entries(session.analysis.allInteractionTypes) as [type, count]}
										<div class="badge badge-outline badge-lg">
											{type}
											<span class="ml-1 font-bold">×{count}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Issues -->
						{#if session.analysis.issues.length > 0}
							<div class="alert alert-warning">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="stroke-current shrink-0 h-6 w-6"
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
								<div>
									<h3 class="font-bold">Issues Found ({session.analysis.issues.length})</h3>
									<ul class="text-sm list-disc list-inside">
										{#each session.analysis.issues.slice(0, 5) as issue}
											<li>{issue}</li>
										{/each}
										{#if session.analysis.issues.length > 5}
											<li class="text-base-content/60">
												... and {session.analysis.issues.length - 5} more
											</li>
										{/if}
									</ul>
								</div>
							</div>
						{/if}

						<!-- Package Details -->
						<div class="collapse collapse-arrow bg-base-200 mt-4">
							<input type="checkbox" />
							<div class="collapse-title font-medium">
								Package Details ({session.analysis.packages.length} packages)
							</div>
							<div class="collapse-content">
								{#each session.analysis.packages as pkg}
									<div class="card bg-base-100 mb-3">
										<div class="card-body p-4">
											<h4 class="font-semibold">{pkg.packageName}</h4>
											<div class="grid grid-cols-3 gap-2 text-sm">
												<div>
													<span class="text-base-content/60">Items:</span>
													<span class="font-medium">{pkg.itemCount}</span>
												</div>
												<div>
													<span class="text-base-content/60">Passages:</span>
													<span class="font-medium">{pkg.passageCount}</span>
												</div>
												<div>
													<span class="text-base-content/60">Tests:</span>
													<span class="font-medium">{pkg.testCount}</span>
												</div>
											</div>
											{#if Object.keys(pkg.interactionTypes).length > 0}
												<div class="mt-2">
													<div class="text-xs text-base-content/60 mb-1">Interactions:</div>
													<div class="flex flex-wrap gap-1">
														{#each Object.entries(pkg.interactionTypes) as [type, count]}
															<span class="badge badge-sm">{type} ×{count}</span>
														{/each}
													</div>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Assessment Tests Browser -->
			{#if session.analysis && session.analysis.totalTests > 0}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">Assessment Tests</h2>
						<p class="text-sm text-base-content/60 mb-4">
							Browse and preview {session.analysis.totalTests} QTI assessment tests found in this
							session
						</p>

						<a href="/session/{session.id}/assessments" class="btn btn-primary" data-testid="browse-assessments">
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
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							Browse & Preview Assessment Tests
						</a>
					</div>
				</div>
			{/if}

			<!-- Item Browser & Preview -->
			{#if session.analysis && session.analysis.totalItems > 0}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">Individual Items</h2>
						<p class="text-sm text-base-content/60 mb-4">
							Browse and preview {session.analysis.totalItems} QTI items found in this session
						</p>

						<a href="/session/{session.id}/items" class="btn btn-primary" data-testid="browse-items">
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
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
								/>
							</svg>
							Browse & Preview Items
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={_showDeleteConfirm}
	title="Delete Session"
	message="Are you sure you want to delete this session? All files will be permanently removed and this action cannot be undone."
	confirmText="Delete Session"
	cancelText="Cancel"
	confirmClass="btn-error"
	onConfirm={_confirmDeleteSession}
/>
