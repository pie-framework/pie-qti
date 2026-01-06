<script lang="ts">
	import { goto } from '$app/navigation';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let _isUploading = $state(false);
	let _uploadError = $state<string | null>(null);
	let _isDragging = $state(false);
	let sessions = $state<any[]>([]);
	let _loadingSessions = $state(false);
	let _samples = $state<any[]>([]);
	let _loadingSamples = $state(false);
	let _showDeleteConfirm = $state(false);
	let _sessionToDelete = $state<string | null>(null);
	let _initializedFromLoad = $state(false);

	let _fileInput: HTMLInputElement;

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
		_sessionToDelete = sessionId;
		_showDeleteConfirm = true;
	}

	async function _confirmDeleteSession() {
		if (!_sessionToDelete) return;

		try {
			const response = await fetch(`/api/sessions/${_sessionToDelete}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete session');
			}

			// Remove from local state
			sessions = sessions.filter((s) => s.id !== _sessionToDelete);
			_sessionToDelete = null;
		} catch (error) {
			console.error('Delete session error:', error);
			_uploadError = error instanceof Error ? error.message : 'Failed to delete session';
		}
	}

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;

		_uploadError = null;
		_isUploading = true;

		try {
			const formData = new FormData();

			// Add all files
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				if (!file.name.endsWith('.zip')) {
					_uploadError = 'Only ZIP files are allowed';
					_isUploading = false;
					return;
				}
				formData.append('files', file);
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

	function _handleDrop(event: DragEvent) {
		event.preventDefault();
		_isDragging = false;

		const files = event.dataTransfer?.files;
		if (files) {
			handleFiles(files);
		}
	}

	function _handleDragOver(event: DragEvent) {
		event.preventDefault();
		_isDragging = true;
	}

	function _handleDragLeave(event: DragEvent) {
		event.preventDefault();
		_isDragging = false;
	}

	function _handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		handleFiles(target.files);
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
	<title>QTI Batch Processor</title>
	<meta name="description" content="Upload and transform QTI packages to PIE format" />
</svelte:head>

<div class="h-full flex flex-col">
	<div class="flex-1 flex flex-col items-center justify-center p-8">
		<div class="w-full max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl">
			<!-- Header -->
			<div class="text-center mb-8" data-testid="home-header">
				<h1 class="text-4xl font-bold mb-2">QTI Batch Processor</h1>
				<p class="text-base-content/60">
					Upload QTI packages to analyze structure, transform to PIE format, and preview results
				</p>
			</div>

			<!-- Upload Area -->
			<div class="card bg-base-100 shadow-xl mb-8">
				<div class="card-body">
					<div
						class="border-4 border-dashed rounded-lg p-12 text-center transition-colors {_isDragging ? 'border-primary bg-primary/5' : 'border-base-300'}"
						ondrop={(e) => _handleDrop?.(e)}
						ondragover={(e) => _handleDragOver?.(e)}
						ondragleave={(e) => _handleDragLeave?.(e)}
						role="button"
						tabindex="0"
						onclick={() => _fileInput.click()}
						onkeydown={(e) => e.key === 'Enter' && _fileInput.click()}
						data-testid="upload-dropzone"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-16 w-16 mx-auto mb-4 opacity-50"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>

						{#if _isUploading}
							<div class="mb-4">
								<span class="loading loading-spinner loading-lg text-primary"></span>
							</div>
							<p class="text-lg font-semibold">Uploading...</p>
						{:else}
							<p class="text-lg font-semibold mb-2">Drop QTI ZIP files here</p>
							<p class="text-base-content/60 mb-4">or click to select files</p>
							<button class="btn btn-primary btn-sm">
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
										d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
									/>
								</svg>
								Select Files
							</button>
						{/if}

						<input
							type="file"
							bind:this={_fileInput}
							onchange={(e) => _handleFileSelect?.(e)}
							accept=".zip"
							multiple
							class="hidden"
						/>
					</div>

					{#if _uploadError}
						<div class="alert alert-error mt-4">
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
				</div>
			</div>

			<!-- Recent Sessions -->
			{#if !_loadingSessions && sessions.length > 0}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">Recent Sessions</h2>
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Session</th>
										<th>Status</th>
										<th>Packages</th>
										<th>Created</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									{#each sessions as session}
										<tr class="hover" data-testid={"recent-session-" + session.id}>
											<td class="font-mono text-xs">{session.id.split('-')[0]}</td>
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
														Open
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
														title="Delete session"
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
							Sample QTI Packages
						</h2>
						<p class="text-sm text-base-content/60 mb-4">
							Try the processor with pre-loaded sample packages demonstrating various QTI
							interaction types.
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
														{sample.itemCount} items
													</span>
													<span class="badge badge-sm badge-outline">QTI {sample.qtiVersion}</span>
													{#if sample.hasManifest}
														<span class="badge badge-sm badge-success badge-outline">
															Manifest
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
													Load Sample
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

			<!-- Features -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
				<div class="text-center">
					<div class="text-4xl mb-2">📦</div>
					<h3 class="font-semibold mb-1">Analyze</h3>
					<p class="text-sm text-base-content/60">
						Inspect QTI package structure, items, and interactions
					</p>
				</div>
				<div class="text-center">
					<div class="text-4xl mb-2">⚙️</div>
					<h3 class="font-semibold mb-1">Transform</h3>
					<p class="text-sm text-base-content/60">Batch convert QTI items to PIE format</p>
				</div>
				<div class="text-center">
					<div class="text-4xl mb-2">👁️</div>
					<h3 class="font-semibold mb-1">Preview</h3>
					<p class="text-sm text-base-content/60">Compare QTI and PIE rendering side-by-side</p>
				</div>
			</div>
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={_showDeleteConfirm}
	title="Delete Session"
	message="Are you sure you want to delete this session? This action cannot be undone and all files will be permanently removed."
	confirmText="Delete"
	cancelText="Cancel"
	confirmClass="btn-error"
	onConfirm={_confirmDeleteSession}
/>
