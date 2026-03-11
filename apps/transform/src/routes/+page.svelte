<script lang="ts">
	import { goto } from '$app/navigation';
	import { getContext } from 'svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import QtiPackageUploader from '$lib/components/QtiPackageUploader.svelte';
	import type { PageData } from './$types';
	import type { SvelteI18nProvider } from '@pie-qti/i18n';

	const { data }: { data: PageData } = $props();
	const i18nContext = getContext<{ value: SvelteI18nProvider | undefined }>('i18n');
	const i18n = $derived(i18nContext?.value);

	let _isUploading = $state(false);
	let _uploadError = $state<string | null>(null);
	let sessions = $state<any[]>([]);
	let _loadingSessions = $state(false);
	let _samples = $state<any[]>([]);
	let _loadingSamples = $state(false);
	let _showDeleteConfirm = $state(false);
	let _sessionToDelete = $state<string | null>(null);
	let _initializedFromLoad = $state(false);

	// Initialize state from server load (once).
	$effect(() => {
		if (_initializedFromLoad) return;
		sessions = data.sessions ?? [];
		_samples = data.samples ?? [];
		_initializedFromLoad = true;
	});

	async function loadRecentSessions() {
		try {
			const response = await fetch('/api/sessions');
			const data = await response.json();
			sessions = data.sessions.slice(0, 5); // Show 5 most recent
		} catch (error) {
			console.error('Failed to load sessions:', error);
		} finally {
			_loadingSessions = false;
		}
	}

	async function loadSamples() {
		try {
			const response = await fetch('/api/samples');
			const data = await response.json();
			if (data.success) {
				_samples = data.samples;
			}
		} catch (error) {
			console.error('Failed to load samples:', error);
		} finally {
			_loadingSamples = false;
		}
	}

	async function _loadSample(sampleId: string) {
		_isUploading = true;
		_uploadError = null;

		try {
			const response = await fetch(`/api/samples/${sampleId}/load`, {
				method: 'POST'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to load sample');
			}

			const result = await response.json();
			await goto(`/session/${result.sessionId}`);
		} catch (error) {
			console.error('Load sample error:', error);
			_uploadError = error instanceof Error ? error.message : 'Failed to load sample';
		} finally {
			_isUploading = false;
		}
	}

	function _promptDeleteSession(sessionId: string) {
		console.log('Prompting delete for session:', sessionId);
		_sessionToDelete = sessionId;
		_showDeleteConfirm = true;
	}

	async function _confirmDeleteSession() {
		console.log('Confirming delete for session:', _sessionToDelete);
		if (!_sessionToDelete) {
			console.warn('No session selected for deletion');
			return;
		}

		try {
			console.log('Sending DELETE request to:', `/api/sessions/${_sessionToDelete}`);
			const response = await fetch(`/api/sessions/${_sessionToDelete}`, {
				method: 'DELETE'
			});

			console.log('DELETE response status:', response.status);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
				console.error('DELETE failed with error:', errorData);
				throw new Error(errorData.message || `Delete failed with status ${response.status}`);
			}

			const deleteData = await response.json();
			console.log('=== SESSION DELETION INFO ===');
			console.log(`Session ID: ${_sessionToDelete}`);
			console.log(`Storage Backend: ${deleteData.storageBackend}`);
			console.log(`Storage Path: ${deleteData.storagePath}`);
			console.log(`Deletion Verified: ${deleteData.verified}`);
			console.log('============================');

			console.log('Delete successful, removing from local state');
			// Remove from local state
			sessions = sessions.filter((s) => s.id !== _sessionToDelete);
			_sessionToDelete = null;
			console.log('Session removed from list');
		} catch (error) {
			console.error('Delete session error:', error);
			_uploadError = error instanceof Error ? error.message : 'Failed to delete session';
			throw error; // Re-throw to keep dialog open on error
		}
	}

	async function handleUpload(files: FileList) {
		_uploadError = null;
		_isUploading = true;

		try {
			const formData = new FormData();

			// Add all files
			for (let i = 0; i < files.length; i++) {
				formData.append('files', files[i]);
			}

			const response = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Upload failed');
			}

			const result = await response.json();

			// Redirect to session page
			await goto(`/session/${result.sessionId}`);
		} catch (error) {
			console.error('Upload error:', error);
			_uploadError = error instanceof Error ? error.message : 'Upload failed';
		} finally {
			_isUploading = false;
		}
	}

	function _formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
		if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		return 'Just now';
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
			default:
				return 'badge-info';
		}
	}
</script>

<svelte:head>
	<title>{i18n?.t('transform.appName') ?? 'QTI Batch Processor'}</title>
	<meta name="description" content={i18n?.t('transform.appDescription') ?? 'Upload QTI packages to analyze structure, transform to PIE format, and preview results'} />
</svelte:head>

<div class="h-full flex flex-col">
	<div class="flex-1 flex flex-col items-center justify-center p-8">
		<div class="w-full max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl">
			<!-- Header -->
			<div class="text-center mb-8" data-testid="home-header">
				<h1 class="text-4xl font-bold mb-2">{i18n?.t('transform.appName') ?? 'QTI Batch Processor'}</h1>
				<p class="text-base-content/60">
					{i18n?.t('transform.appDescription') ?? 'Upload QTI packages to analyze structure, transform to PIE format, and preview results'}
				</p>
			</div>

		<!-- Upload Area -->
		<div class="mb-8">
			<QtiPackageUploader loading={_isUploading} onUpload={handleUpload} />
		</div>

		{#if _uploadError}
			<div class="alert alert-error">
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
				<span>{_uploadError}</span>
			</div>
		{/if}

			<!-- Recent Sessions -->
			{#if !_loadingSessions && sessions.length > 0}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">{i18n?.t('transform.sessions.title') ?? 'Recent Sessions'}</h2>
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>{i18n?.t('transform.sessions.session') ?? 'Session'}</th>
										<th>{i18n?.t('transform.sessions.status') ?? 'Status'}</th>
										<th>{i18n?.t('transform.sessions.packages') ?? 'Packages'}</th>
										<th>{i18n?.t('transform.sessions.created') ?? 'Created'}</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									{#each sessions as session}
										<tr class="hover" data-testid={"recent-session-" + session.id}>
											<td class="font-mono text-xs">{session.id}</td>
											<td>
												<span class="badge {_getStatusColor(session.status)} badge-sm">
													{session.status}
												</span>
											</td>
											<td>{session.packageCount}</td>
											<td class="text-sm">{_formatDate(session.created)}</td>
											<td>
												<div class="flex gap-1">
													<a href="/session/{session.id}" class="btn btn-ghost btn-xs">
														{i18n?.t('transform.sessions.open') ?? 'Open'}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															class="h-4 w-4"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
														>
															<path
																stroke-linecap="round"
																stroke-linejoin="round"
																stroke-width="2"
																d="M9 5l7 7-7 7"
															/>
														</svg>
													</a>
													<button
														onclick={() => _promptDeleteSession(session.id)}
														class="btn btn-ghost btn-xs text-error"
														title={i18n?.t('transform.sessions.deleteTitle') ?? 'Delete session'}
													>
														<svg
															xmlns="http://www.w3.org/2000/svg"
															class="h-4 w-4"
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
													</button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}

			<!-- Sample Packages -->
			{#if !_loadingSamples && _samples.length > 0}
				<div class="card bg-base-100 shadow-xl mt-4" data-testid="samples-card">
					<div class="card-body">
						<h2 class="card-title">
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
									d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
								/>
							</svg>
							{i18n?.t('transform.samples.title') ?? 'Sample QTI Packages'}
						</h2>
						<p class="text-sm text-base-content/60 mb-4">
							{i18n?.t('transform.samples.description') ?? 'Try the processor with pre-loaded sample packages demonstrating various QTI interaction types.'}
						</p>
						<div class="grid grid-cols-1 gap-3">
							{#each _samples as sample}
								<div class="card bg-base-200 hover:bg-base-300 transition-colors">
									<div class="card-body p-4">
										<div class="flex justify-between items-start">
											<div class="flex-1">
												<h3 class="font-semibold text-base">{sample.name}</h3>
												<p class="text-sm text-base-content/60 mt-1">{sample.description}</p>
												<div class="flex flex-wrap gap-2 mt-2">
													<span class="badge badge-sm badge-outline">
														{i18n?.t('transform.samples.itemsCount', { count: sample.itemCount }) ?? `${sample.itemCount} items`}
													</span>
													<span class="badge badge-sm badge-outline">QTI {sample.qtiVersion}</span>
													{#if sample.hasManifest}
														<span class="badge badge-sm badge-success badge-outline">
															{i18n?.t('transform.samples.hasManifest') ?? 'Manifest'}
														</span>
													{/if}
												</div>
												<div class="flex flex-wrap gap-1 mt-2">
													{#each sample.interactions as interaction}
														<span class="badge badge-xs badge-ghost">
															{interaction.replace('Interaction', '')}
														</span>
													{/each}
												</div>
											</div>
											<button
												class="btn btn-primary btn-sm"
												onclick={() => _loadSample(sample.id)}
												disabled={_isUploading}
												data-testid={"sample-load-" + sample.id}
											>
												{#if _isUploading}
													<span class="loading loading-spinner loading-xs"></span>
												{:else}
													{i18n?.t('transform.samples.load') ?? 'Load Sample'}
												{/if}
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={_showDeleteConfirm}
	title={i18n?.t('transform.sessions.deleteConfirmTitle') ?? 'Delete Session'}
	message={i18n?.t('transform.sessions.deleteConfirmMessage') ?? 'Are you sure you want to delete this session? This action cannot be undone and all files will be permanently removed.'}
	confirmText={i18n?.t('transform.sessions.delete') ?? 'Delete'}
	cancelText={i18n?.t('common.cancel') ?? 'Cancel'}
	confirmClass="btn-error"
	onConfirm={_confirmDeleteSession}
/>
