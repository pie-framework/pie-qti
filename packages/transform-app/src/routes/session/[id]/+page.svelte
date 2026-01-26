<script lang="ts">
	import { goto } from '$app/navigation';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy, getContext } from 'svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import type { PageData } from './$types';
	import type { SvelteI18nProvider } from '@pie-qti/i18n';

	const { data }: { data: PageData } = $props();
	const i18nContext = getContext<{ value: SvelteI18nProvider | undefined }>('i18n');
	const i18n = $derived(i18nContext?.value);

	const session = $derived(data.session);

	// Derived translations
	const t = $derived({
		home: i18n?.t('transform.home') ?? 'Home',
		session: i18n?.t('transform.sessions.session') ?? 'Session',
		created: i18n?.t('transform.sessions.created') ?? 'Created',
		deleteTitle: i18n?.t('transform.sessions.deleteTitle') ?? 'Delete session',
		delete: i18n?.t('transform.sessions.delete') ?? 'Delete',
		uploadedPackages: i18n?.t('transform.detail.uploadedPackages') ?? 'Uploaded Packages',
		package: i18n?.t('transform.detail.package') ?? 'Package',
		type: i18n?.t('transform.detail.type') ?? 'Type',
		size: i18n?.t('transform.detail.size') ?? 'Size',
		status: i18n?.t('transform.sessions.status') ?? 'Status',
		uploaded: i18n?.t('transform.detail.uploaded') ?? 'Uploaded',
		actions: i18n?.t('transform.detail.actions') ?? 'Actions',
		analyzing: i18n?.t('transform.detail.analyzing') ?? 'Package is being analyzed...',
		analysisComplete: i18n?.t('transform.detail.analysisComplete') ?? 'Analysis complete. Review results below or proceed to transformation.',
		cannotConvert: i18n?.t('transform.detail.cannotConvert') ?? 'Cannot Convert to PIE',
		unsupportedMessage: i18n?.t('transform.detail.unsupportedMessage') ?? 'This package contains QTI interaction types that have no PIE equivalent. See issues below for details. Use the QTI player instead to preview these items.',
		transforming: i18n?.t('transform.detail.transforming') ?? 'Transforming...',
		transformToPie: i18n?.t('transform.detail.transformToPie') ?? 'Transform to PIE',
		analysisResults: i18n?.t('transform.detail.analysisResults') ?? 'Analysis Results',
		totalItems: i18n?.t('transform.detail.totalItems') ?? 'Total Items',
		passages: i18n?.t('transform.detail.passages') ?? 'Passages',
		tests: i18n?.t('transform.detail.tests') ?? 'Tests',
		packages: i18n?.t('transform.sessions.packages') ?? 'Packages',
		interactionTypesFound: i18n?.t('transform.detail.interactionTypesFound') ?? 'Interaction Types Found',
		issuesFound: i18n?.t('transform.detail.issuesFound') ?? 'Issues Found',
		packageDetails: i18n?.t('transform.detail.packageDetails') ?? 'Package Details',
		noManifest: i18n?.t('transform.detail.noManifest') ?? 'No Manifest',
		items: i18n?.t('transform.detail.items') ?? 'items',
		interactionTypes: i18n?.t('transform.detail.interactionTypes') ?? 'Interaction Types',
		assessmentTests: i18n?.t('transform.detail.assessmentTests') ?? 'Assessment Tests',
		file: i18n?.t('transform.detail.file') ?? 'File',
		pattern: i18n?.t('transform.detail.pattern') ?? 'Pattern',
		sampleItems: i18n?.t('transform.detail.sampleItems') ?? 'Sample Items by Interaction Type',
		issues: i18n?.t('transform.detail.issues') ?? 'Issues',
		browseAssessments: i18n?.t('transform.detail.browseAssessments') ?? 'Browse & Preview Assessment Tests',
		individualItems: i18n?.t('transform.detail.individualItems') ?? 'Individual Items',
		browseItems: i18n?.t('transform.detail.browseItems') ?? 'Browse & Preview Items',
		deleteConfirmTitle: i18n?.t('transform.sessions.deleteConfirmTitle') ?? 'Delete Session',
		deleteConfirmMessage: i18n?.t('transform.sessions.deleteConfirmMessage') ?? 'Are you sure you want to delete this session? This action cannot be undone and all files will be permanently removed.',
		cancel: i18n?.t('common.cancel') ?? 'Cancel',
	});
	let _showDeleteConfirm = $state(false);
	let _isTransforming = $state(false);
	let _transformError = $state<string | null>(null);
	let _pollInterval: number | null = null;

	// Check if there are unsupported interactions that prevent PIE conversion
	const hasUnsupportedInteractions = $derived(() => {
		if (!session.analysis?.issues) return false;
		return session.analysis.issues.some(issue =>
			issue.includes('UNSUPPORTED INTERACTIONS') ||
			issue.includes('cannot convert to PIE')
		);
	});

	const canTransformToPie = $derived(!hasUnsupportedInteractions());

	function _getStatusColor(status: string): string {
		switch (status) {
			case 'complete':
				return 'badge-success';
			case 'error':
				return 'badge-error';
			case 'transforming':
			case 'analyzing':
			case 'extracting':
				return 'badge-warning';
			case 'ready':
				return 'badge-success';
			default:
				return 'badge-info';
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
				const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
				throw new Error(errorData.message || `Delete failed with status ${response.status}`);
			}

			const deleteData = await response.json();
			console.log('=== SESSION DELETION INFO ===');
			console.log(`Session ID: ${session.id}`);
			console.log(`Storage Backend: ${deleteData.storageBackend}`);
			console.log(`Storage Path: ${deleteData.storagePath}`);
			console.log(`Deletion Verified: ${deleteData.verified}`);
			console.log('============================');

			// Invalidate all cached data so the homepage reloads the session list
			await invalidateAll();

			// Redirect to home
			await goto('/');
		} catch (error) {
			console.error('Delete session error:', error);
			alert(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

			// Navigate to results view
			await goto(`/session/${session.id}/transformed`);
		} catch (error) {
			console.error('Transformation error:', error);
			_transformError = error instanceof Error ? error.message : 'Transformation failed';
		} finally {
			_isTransforming = false;
		}
	}

	// Poll for analysis completion when session is in extracting state
	onMount(() => {
		if (!session.analysis && (session.status === 'extracting' || session.status === 'analyzing')) {
			_pollInterval = window.setInterval(async () => {
				await invalidateAll();
			}, 2000); // Poll every 2 seconds
		}
	});

	onDestroy(() => {
		if (_pollInterval !== null) {
			clearInterval(_pollInterval);
		}
	});

	// Stop polling when analysis completes
	$effect(() => {
		if (session.analysis && _pollInterval !== null) {
			clearInterval(_pollInterval);
			_pollInterval = null;
		}
	});
</script>

<svelte:head>
	<title>{t.session} {session.id} - {i18n?.t('transform.appName') ?? 'QTI Batch Processor'}</title>
</svelte:head>

<div class="h-full flex flex-col p-4">
	<div class="mb-4">
		<!-- Breadcrumb -->
		<div class="text-sm breadcrumbs">
			<ul>
				<li><a href="/" data-testid="session-breadcrumb-home">{t.home}</a></li>
				<li data-testid="session-breadcrumb-session">{t.session} {session.id.split('-')[0]}</li>
			</ul>
		</div>

		<!-- Session Header -->
		<div class="flex justify-between items-center">
			<div>
				<h1 class="text-2xl font-bold">{t.session} {session.id.split('-')[0]}</h1>
				<p class="text-sm text-base-content/60">
					{t.created} {new Date(session.createdAt).toLocaleString()}
				</p>
			</div>
			<div class="flex items-center gap-2">
				<span class="badge {_getStatusColor(session.status)} badge-lg">
					{session.status}
				</span>
				<button onclick={() => _promptDeleteSession?.()} class="btn btn-error btn-sm" title={t.deleteTitle} data-testid="delete-session">
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
					{t.delete}
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
					<h2 class="card-title">{t.uploadedPackages}</h2>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>{t.package}</th>
									<th>{t.type}</th>
									<th>{t.size}</th>
									<th>{t.status}</th>
								</tr>
							</thead>
							<tbody>
								{#each session.analysis?.packages || [] as pkg}
									<tr>
										<td class="font-medium">{pkg.packageName}</td>
										<td>
											<span class="badge badge-sm">QTI</span>
										</td>
										<td class="text-sm text-base-content/60">{pkg.itemCount} {t.items}</td>
										<td>
											<span class="badge badge-info badge-sm">{t.uploaded}</span>
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
					<h2 class="card-title">{t.actions}</h2>

					{#if !session.analysis}
						<p class="text-sm text-base-content/60 mb-4">
							{t.analyzing}
						</p>
						<div class="flex justify-center py-4">
							<span class="loading loading-spinner loading-lg text-primary"></span>
						</div>
					{:else}
						{#if canTransformToPie}
							<p class="text-sm text-base-content/60 mb-4">
								{t.analysisComplete}
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
									<h3 class="font-bold">{t.cannotConvert}</h3>
									<div class="text-sm">
										{t.unsupportedMessage}
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

						<button
							class="btn btn-primary"
							onclick={() => _transformToPie?.()}
							disabled={_isTransforming || !canTransformToPie}
							data-testid="transform-to-pie"
							title={!canTransformToPie ? t.unsupportedMessage : ''}
						>
							{#if _isTransforming}
								<span class="loading loading-spinner"></span>
								{t.transforming}
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
								{t.transformToPie}
							{/if}
						</button>
					{/if}
				</div>
			</div>

			<!-- Analysis Results -->
			{#if session.analysis}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">{t.analysisResults}</h2>

						<!-- Summary Stats -->
						<div class="stats stats-vertical lg:stats-horizontal shadow mb-4">
							<div class="stat">
								<div class="stat-title">{t.totalItems}</div>
								<div class="stat-value text-primary">{session.analysis.totalItems}</div>
							</div>
							<div class="stat">
								<div class="stat-title">{t.passages}</div>
								<div class="stat-value text-secondary">{session.analysis.totalPassages}</div>
							</div>
							<div class="stat">
								<div class="stat-title">{t.tests}</div>
								<div class="stat-value">{session.analysis.totalTests}</div>
							</div>
							<div class="stat">
								<div class="stat-title">{t.packages}</div>
								<div class="stat-value">{session.analysis.packages.length}</div>
							</div>
						</div>

						<!-- Interaction Types -->
						{#if Object.keys(session.analysis.allInteractionTypes).length > 0}
							<div class="mb-4">
								<h3 class="font-semibold mb-2">{t.interactionTypesFound}</h3>
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
						<div class="mt-4">
							<h3 class="font-semibold text-lg mb-3">Package Details</h3>
							<div class="space-y-3">
								{#each session.analysis.packages as pkg, idx}
									<div class="collapse collapse-arrow bg-base-200">
										<input type="checkbox" id="pkg-{idx}" />
										<label for="pkg-{idx}" class="collapse-title">
											<div class="flex items-center justify-between pr-4">
												<div>
													<span class="font-semibold">{pkg.packageName}</span>
													{#if !pkg.hasManifest}
														<span class="badge badge-warning badge-sm ml-2">No Manifest</span>
													{/if}
												</div>
												<div class="flex gap-3 text-sm">
													<span class="text-base-content/60">
														{pkg.itemCount} items
													</span>
													{#if pkg.passageCount > 0}
														<span class="text-base-content/60">
															{pkg.passageCount} passages
														</span>
													{/if}
													{#if pkg.testCount > 0}
														<span class="text-base-content/60">
															{pkg.testCount} tests
														</span>
													{/if}
												</div>
											</div>
										</label>
										<div class="collapse-content">
											<div class="space-y-4 pt-2">
												<!-- Interaction Types -->
												{#if Object.keys(pkg.interactionTypes).length > 0}
													<div>
														<h4 class="text-sm font-semibold mb-2 text-base-content/80">Interaction Types</h4>
														<div class="flex flex-wrap gap-2">
															{#each Object.entries(pkg.interactionTypes) as [type, count]}
																<span class="badge badge-outline">
																	{type}
																	<span class="ml-1 font-bold">×{count}</span>
																</span>
															{/each}
														</div>
													</div>
												{/if}

												<!-- Assessment Tests -->
												{#if pkg.samples.tests.length > 0}
													<div>
														<h4 class="text-sm font-semibold mb-2 text-base-content/80">
															Assessment Tests
															{#if pkg.testCount > pkg.samples.tests.length}
																<span class="text-xs font-normal text-base-content/60">
																	(showing {pkg.samples.tests.length} of {pkg.testCount})
																</span>
															{/if}
														</h4>
														<div class="overflow-x-auto">
															<table class="table table-sm table-zebra">
																<thead>
																	<tr>
																		<th>File</th>
																	</tr>
																</thead>
																<tbody>
																	{#each pkg.samples.tests as test}
																		<tr>
																			<td class="font-mono text-xs">{test}</td>
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
													</div>
												{/if}

												<!-- Passages -->
												{#if pkg.samples.passages.length > 0}
													<div>
														<h4 class="text-sm font-semibold mb-2 text-base-content/80">
															Passages
															{#if pkg.passageCount > pkg.samples.passages.length}
																<span class="text-xs font-normal text-base-content/60">
																	(showing {pkg.samples.passages.length} of {pkg.passageCount})
																</span>
															{/if}
														</h4>
														<div class="overflow-x-auto">
															<table class="table table-sm table-zebra">
																<thead>
																	<tr>
																		<th>File</th>
																		<th>Pattern</th>
																	</tr>
																</thead>
																<tbody>
																	{#each pkg.samples.passages as passage}
																		<tr>
																			<td class="font-mono text-xs">{passage}</td>
																			<td>
																				{#if pkg.passagePatterns.inline > 0}
																					<span class="badge badge-xs">inline</span>
																				{/if}
																				{#if pkg.passagePatterns.object > 0}
																					<span class="badge badge-xs">object</span>
																				{/if}
																				{#if pkg.passagePatterns.standalone > 0}
																					<span class="badge badge-xs">standalone</span>
																				{/if}
																			</td>
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
													</div>
												{/if}

												<!-- Sample Interactions by Type -->
												{#if Object.keys(pkg.samples.interactions).length > 0}
													<div>
														<h4 class="text-sm font-semibold mb-2 text-base-content/80">Sample Items by Interaction Type</h4>
														<div class="space-y-2">
															{#each Object.entries(pkg.samples.interactions) as [type, items]}
																<div class="collapse collapse-arrow bg-base-100">
																	<input type="checkbox" id="int-{idx}-{type}" />
																	<label for="int-{idx}-{type}" class="collapse-title text-sm py-2 min-h-0">
																		<span class="badge badge-sm badge-outline">{type}</span>
																		<span class="text-xs text-base-content/60 ml-2">
																			{items.length} sample{items.length !== 1 ? 's' : ''}
																		</span>
																	</label>
																	<div class="collapse-content">
																		<div class="overflow-x-auto">
																			<table class="table table-xs">
																				<tbody>
																					{#each items as item}
																						<tr>
																							<td class="font-mono text-xs">{item}</td>
																						</tr>
																					{/each}
																				</tbody>
																			</table>
																		</div>
																	</div>
																</div>
															{/each}
														</div>
													</div>
												{/if}

												<!-- Package Issues -->
												{#if pkg.issues.length > 0}
													<div>
														<h4 class="text-sm font-semibold mb-2 text-base-content/80">Issues</h4>
														<div class="alert alert-warning py-2">
															<ul class="text-xs list-disc list-inside">
																{#each pkg.issues as issue}
																	<li>{issue}</li>
																{/each}
															</ul>
														</div>
													</div>
												{/if}
											</div>
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
						<h2 class="card-title">{t.assessmentTests}</h2>
						<p class="text-sm text-base-content/60 mb-4">
							{i18n?.t('transform.detail.browseAssessmentsDescription', { count: session.analysis.totalTests }) ?? `Browse and preview ${session.analysis.totalTests} QTI assessment tests found in this session`}
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
							{t.browseAssessments}
						</a>
					</div>
				</div>
			{/if}

			<!-- Item Browser & Preview -->
			{#if session.analysis && session.analysis.totalItems > 0}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">{t.individualItems}</h2>
						<p class="text-sm text-base-content/60 mb-4">
							{i18n?.t('transform.detail.browseItemsDescription', { count: session.analysis.totalItems }) ?? `Browse and preview ${session.analysis.totalItems} QTI items found in this session`}
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
							{t.browseItems}
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={_showDeleteConfirm}
	title={t.deleteConfirmTitle}
	message={t.deleteConfirmMessage}
	confirmText={t.delete}
	cancelText={t.cancel}
	confirmClass="btn-error"
	onConfirm={_confirmDeleteSession}
/>
