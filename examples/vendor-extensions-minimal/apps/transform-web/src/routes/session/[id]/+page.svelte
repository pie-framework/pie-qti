<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	const session = $derived(data.session);

	let isTransforming = $state(false);
	let transformError = $state<string | null>(null);
	let showDeleteConfirm = $state(false);

	async function transformToPie() {
		isTransforming = true;
		transformError = null;

		try {
			const response = await fetch(`/api/sessions/${session.id}/transform`, {
				method: 'POST'
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Transform failed');
			}

			await invalidateAll();
		} catch (error) {
			transformError = error instanceof Error ? error.message : 'Transform failed';
		} finally {
			isTransforming = false;
		}
	}

	async function confirmDeleteSession() {
		try {
			const response = await fetch(`/api/sessions/${session.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) throw new Error('Failed to delete session');
			await goto('/');
		} catch (error) {
			transformError = error instanceof Error ? error.message : 'Failed to delete session';
			throw error;
		}
	}

	function downloadPieJson() {
		if (!session.transform?.output) return;
		const blob = new Blob([session.transform.output], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${session.qti?.filename || 'transform'}.pie.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleString();
	}
</script>

<svelte:head>
	<title>Session {session.id.slice(0, 8)} - PIE-QTI</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-6xl mx-auto space-y-6">
		<div class="flex justify-between items-center">
			<div>
				<h1 class="text-3xl font-bold">Session {session.id.slice(0, 8)}</h1>
				<p class="text-sm text-base-content/60 mt-1">Created {formatDate(session.created)}</p>
			</div>
			<div class="flex gap-2">
				<a href="/" class="btn btn-ghost btn-sm">← Home</a>
				<button onclick={() => showDeleteConfirm = true} class="btn btn-error btn-sm">Delete</button>
			</div>
		</div>

		{#if session.qti}
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">QTI Content</h2>
					<div class="grid grid-cols-2 gap-4 text-sm">
						<div><span class="font-semibold">Filename:</span> {session.qti.filename}</div>
						<div><span class="font-semibold">Size:</span> {(session.qti.content.length / 1024).toFixed(2)} KB</div>
						{#if session.qti.vendor}
							<div><span class="font-semibold">Vendor:</span> <span class="badge badge-primary badge-sm">{session.qti.vendor}</span></div>
						{/if}
					</div>

					<div class="divider"></div>

					<div class="form-control">
						<label for="qti-xml-preview" class="label"><span class="label-text font-semibold">XML Content (Preview)</span></label>
						<textarea id="qti-xml-preview" class="textarea textarea-bordered font-mono text-xs h-64" readonly value={session.qti.content.slice(0, 2000) + (session.qti.content.length > 2000 ? '\n\n... (truncated)' : '')}></textarea>
					</div>
				</div>
			</div>

			{#if !session.transform}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">Transform to PIE</h2>
						<p class="text-sm text-base-content/60 mb-4">Transform this QTI content to PIE format</p>
						<button class="btn btn-primary btn-lg w-full" onclick={transformToPie} disabled={isTransforming}>
							{#if isTransforming}
								<span class="loading loading-spinner"></span>
								Transforming...
							{:else}
								Transform to PIE Format
							{/if}
						</button>
						{#if transformError}
							<div class="alert alert-error mt-4"><span>{transformError}</span></div>
						{/if}
					</div>
				</div>
			{/if}

			{#if session.transform}
				<div class="card bg-base-100 shadow-xl">
					<div class="card-body">
						<h2 class="card-title">Transform Result</h2>

						<div class="stats stats-vertical lg:stats-horizontal shadow">
							<div class="stat">
								<div class="stat-title">Status</div>
								<div class="stat-value text-2xl">{session.transform.success ? '✓' : '✗'}</div>
								<div class="stat-desc">{session.transform.success ? 'Success' : 'Failed'}</div>
							</div>
							{#if session.transform.pluginUsed}
								<div class="stat">
									<div class="stat-title">Plugin Used</div>
									<div class="stat-value text-xl">{session.transform.pluginUsed}</div>
									<div class="stat-desc">Priority: {session.transform.pluginPriority}</div>
								</div>
							{/if}
							{#if session.transform.detectedVendor}
								<div class="stat">
									<div class="stat-title">Detected Vendor</div>
									<div class="stat-value text-xl">{session.transform.detectedVendor}</div>
									<div class="stat-desc">Confidence: {((session.transform.confidence || 0) * 100).toFixed(0)}%</div>
								</div>
							{/if}
						</div>

						{#if session.transform.success && session.transform.output}
							<div class="divider"></div>
							<div class="form-control">
								<label for="pie-output" class="label"><span class="label-text font-semibold">PIE Model Output</span></label>
								<textarea id="pie-output" class="textarea textarea-bordered font-mono text-xs h-64" readonly value={session.transform.output}></textarea>
							</div>
							<div class="card-actions justify-end">
								<button onclick={downloadPieJson} class="btn btn-primary">Download PIE JSON</button>
							</div>
						{/if}

						{#if session.transform.error}
							<div class="alert alert-error"><span>{session.transform.error}</span></div>
						{/if}
					</div>
				</div>
			{/if}
		{:else}
			<div class="alert alert-warning">
				<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
				<span>No QTI content in this session</span>
			</div>
		{/if}
	</div>
</div>

<ConfirmDialog bind:open={showDeleteConfirm} title="Delete Session" message="Delete this session? This cannot be undone." confirmText="Delete" cancelText="Cancel" confirmClass="btn-error" onConfirm={confirmDeleteSession}/>
