<script lang="ts">
	import { goto } from '$app/navigation';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let isUploading = $state(false);
	let uploadError = $state<string | null>(null);
	let isDragging = $state(false);
	let sessions = $state<any[]>([]);
	let samples = $state<any[]>([]);
	let showDeleteConfirm = $state(false);
	let sessionToDelete = $state<string | null>(null);
	let initializedFromLoad = $state(false);
	let fileInput: HTMLInputElement;

	$effect(() => {
		if (initializedFromLoad) return;
		sessions = data.sessions ?? [];
		samples = data.samples ?? [];
		initializedFromLoad = true;
	});

	async function loadSample(sampleId: string) {
		isUploading = true;
		uploadError = null;
		try {
			const response = await fetch(`/api/samples/${sampleId}/load`, { method: 'POST' });
			if (!response.ok) throw new Error('Failed to load sample');
			const result = await response.json();
			await goto(`/session/${result.sessionId}`);
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Failed to load sample';
		} finally {
			isUploading = false;
		}
	}

	function promptDeleteSession(sessionId: string) {
		sessionToDelete = sessionId;
		showDeleteConfirm = true;
	}

	async function confirmDeleteSession() {
		if (!sessionToDelete) return;
		try {
			const response = await fetch(`/api/sessions/${sessionToDelete}`, { method: 'DELETE' });
			if (!response.ok) throw new Error('Failed to delete session');
			sessions = sessions.filter((s) => s.id !== sessionToDelete);
			sessionToDelete = null;
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Failed to delete session';
		}
	}

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		uploadError = null;
		isUploading = true;
		try {
			const file = files[0];
			if (!file.name.endsWith('.xml') && !file.name.endsWith('.qti')) {
				uploadError = 'Only XML and QTI files are allowed';
				isUploading = false;
				return;
			}
			const formData = new FormData();
			formData.append('file', file);
			const response = await fetch('/api/upload', { method: 'POST', body: formData });
			if (!response.ok) throw new Error('Upload failed');
			const result = await response.json();
			await goto(`/session/${result.sessionId}`);
		} catch (error) {
			uploadError = error instanceof Error ? error.message : 'Upload failed';
		} finally {
			isUploading = false;
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		if (event.dataTransfer?.files) handleFiles(event.dataTransfer.files);
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	function handleFileSelect(event: Event) {
		handleFiles((event.target as HTMLInputElement).files);
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const diff = Date.now() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor(diff / (1000 * 60 * 60));
		if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
		if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		return 'Just now';
	}

	function getStatusBadge(session: any): string {
		if (session.transform?.success) return 'badge-success';
		if (session.transform?.error) return 'badge-error';
		if (session.qti) return 'badge-info';
		return 'badge-ghost';
	}

	function getStatusText(session: any): string {
		if (session.transform?.success) return 'Transformed';
		if (session.transform?.error) return 'Error';
		if (session.qti) return 'Ready';
		return 'Empty';
	}
</script>

<svelte:head>
	<title>PIE-QTI Vendor Extensions</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<header class="text-center mb-12">
		<h1 class="text-4xl font-bold mb-4">PIE-QTI Vendor Extensions</h1>
		<p class="text-lg text-base-content/70">Upload QTI files with vendor extensions and transform to PIE</p>
	</header>

	<div class="max-w-4xl mx-auto space-y-6">
		<div class="alert alert-info">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
			<div><h3 class="font-bold">Example Vendor Plugin Active</h3><div class="text-sm">This app includes the <strong>ExampleCorp</strong> plugin.</div></div>
		</div>

		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Upload QTI File</h2>
				<div class="border-4 border-dashed rounded-lg p-12 text-center transition-colors {isDragging ? 'border-primary bg-primary/5' : 'border-base-300'}" ondrop={handleDrop} ondragover={handleDragOver} ondragleave={handleDragLeave} role="button" tabindex="0" onclick={() => fileInput.click()} onkeydown={(e) => e.key === 'Enter' && fileInput.click()}>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
					{#if isUploading}
						<span class="loading loading-spinner loading-lg"></span>
						<p class="text-lg font-semibold mt-4">Uploading...</p>
					{:else}
						<p class="text-lg font-semibold mb-2">Drop QTI XML here</p>
						<p class="text-base-content/60 mb-4">or click to select</p>
						<span class="btn btn-primary btn-sm pointer-events-none">Select File</span>
					{/if}
					<input type="file" bind:this={fileInput} onchange={handleFileSelect} accept=".xml,.qti" class="hidden"/>
				</div>
				{#if uploadError}
					<div class="alert alert-error mt-4"><span>{uploadError}</span></div>
				{/if}
			</div>
		</div>

		{#if samples.length > 0}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Sample Files</h2>
					<div class="grid gap-3">
						{#each samples as sample}
							<div class="card bg-base-200 hover:bg-base-300 transition">
								<div class="card-body p-4 flex-row justify-between items-center">
									<div>
										<h3 class="font-semibold">{sample.icon} {sample.name}</h3>
										<p class="text-sm text-base-content/60">{sample.description}</p>
										{#if sample.vendor}<span class="badge badge-sm badge-primary mt-1">{sample.vendor}</span>{/if}
									</div>
									<button class="btn btn-primary btn-sm" onclick={() => loadSample(sample.id)} disabled={isUploading}>
										{#if isUploading}<span class="loading loading-spinner loading-xs"></span>{:else}Load{/if}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		{#if sessions.length > 0}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Recent Sessions</h2>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead><tr><th>Session</th><th>File</th><th>Status</th><th>Created</th><th></th></tr></thead>
							<tbody>
								{#each sessions as session}
									<tr class="hover">
										<td class="font-mono text-xs">{session.id.slice(0, 8)}</td>
										<td class="text-sm">{session.qti?.filename ?? 'None'}</td>
										<td><span class="badge {getStatusBadge(session)} badge-sm">{getStatusText(session)}</span></td>
										<td class="text-sm">{formatDate(session.created)}</td>
										<td>
											<a href="/session/{session.id}" class="btn btn-ghost btn-xs">Open</a>
											<button onclick={() => promptDeleteSession(session.id)} class="btn btn-ghost btn-xs text-error">Delete</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<ConfirmDialog bind:open={showDeleteConfirm} title="Delete Session" message="Delete this session?" confirmText="Delete" cancelText="Cancel" confirmClass="btn-error" onConfirm={confirmDeleteSession}/>
