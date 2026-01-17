<script lang="ts">
	
	import PieAssessmentPreview from '$lib/components/PieAssessmentPreview.svelte';
import PieItemPlayer from '$lib/components/PieItemPlayer.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const session = $derived(data.session);
	const transformation = $derived(data.transformation);

	type SelectionType = { type: 'item'; index: number } | { type: 'assessment'; index: number } | null;
	let selection = $state<SelectionType>(null);

	const selectedItem = $derived(
		selection?.type === 'item' ? transformation.items[selection.index] : null
	);

	const selectedAssessment = $derived(
		selection?.type === 'assessment' ? transformation.assessments[selection.index] : null
	);

	function selectItem(index: number) {
		selection = { type: 'item', index };
	}

	function selectAssessment(index: number) {
		selection = { type: 'assessment', index };
	}

	function formatDuration(startTime: Date | string, endTime: Date | string): string {
		const start = startTime instanceof Date ? startTime : new Date(startTime);
		const end = endTime instanceof Date ? endTime : new Date(endTime);

		const ms = end.getTime() - start.getTime();

		// Handle invalid dates or negative durations
		if (isNaN(ms) || ms < 0) return '0ms';

		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<svelte:head>
	<title>Transformation Results - Session {session.id}</title>
</svelte:head>

<div class="h-full flex flex-col p-4">
	<div class="mb-4">
		<!-- Breadcrumb -->
		<div class="text-sm breadcrumbs">
			<ul>
				<li><a href="/" data-testid="breadcrumb-home">Home</a></li>
				<li><a href="/session/{session.id}" data-testid="breadcrumb-session">Session {session.id.split('-')[0]}</a></li>
				<li data-testid="breadcrumb-transformed">Transformed</li>
			</ul>
		</div>

		<!-- Page Header -->
		<div class="flex justify-between items-center">
			<div>
				<h1 class="text-2xl font-bold">Transformation Results</h1>
				<p class="text-sm text-base-content/60">
					{transformation.items.length} item{transformation.items.length !== 1 ? 's' : ''}
					{#if transformation.assessments.length > 0}
						+ {transformation.assessments.length} assessment{transformation.assessments.length !== 1 ? 's' : ''}
					{/if}
					transformed in {formatDuration(transformation.startTime, transformation.endTime)}
				</p>
			</div>
			<div class="flex gap-2">
				<a href="/session/{session.id}" class="btn btn-outline btn-sm">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					Back to Session
				</a>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 overflow-auto">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left Sidebar: Item List -->
			<div class="lg:col-span-1">
				<div class="card bg-base-100 shadow-xl h-full">
					<div class="card-body">
						<h2 class="card-title">Transformed Content</h2>

						<!-- Summary Stats -->
						<div class="stats stats-vertical shadow mb-4">
							<div class="stat">
								<div class="stat-title">Items</div>
								<div class="stat-value text-2xl">{transformation.items.length}</div>
							</div>
							{#if transformation.assessments.length > 0}
								<div class="stat">
									<div class="stat-title">Assessments</div>
									<div class="stat-value text-2xl">{transformation.assessments.length}</div>
								</div>
							{/if}
							{#if transformation.errors.length > 0}
								<div class="stat">
									<div class="stat-title">Errors</div>
									<div class="stat-value text-2xl text-error">{transformation.errors.length}</div>
								</div>
							{/if}
						</div>

						<!-- Content List -->
						<div class="overflow-y-auto flex-1">
							<!-- Assessments -->
							{#if transformation.assessments.length > 0}
								<div class="mb-3">
									<h3 class="text-sm font-semibold mb-2 text-base-content/60">Assessments</h3>
									<div class="flex flex-col gap-2">
										{#each transformation.assessments as assessment, index}
											<button
												class="btn btn-sm justify-start text-left h-auto py-2 whitespace-normal"
												class:btn-primary={selection?.type === 'assessment' && selection.index === index}
												class:btn-ghost={!(selection?.type === 'assessment' && selection.index === index)}
												onclick={() => selectAssessment(index)}
												data-testid="assessment-{index}"
											>
												<div class="flex flex-col items-start gap-1">
													<div class="flex items-center gap-2">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
														</svg>
														<div class="font-medium">{assessment.title || assessment.identifier}</div>
													</div>
													{#if assessment.warnings.length > 0}
														<div class="badge badge-warning badge-xs">
															{assessment.warnings.length} warning{assessment.warnings.length > 1 ? 's' : ''}
														</div>
													{/if}
												</div>
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Items -->
							{#if transformation.items.length === 0}
								<div class="alert alert-info">
									<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span>No items transformed</span>
								</div>
							{:else}
								<div class="mb-3">
									<h3 class="text-sm font-semibold mb-2 text-base-content/60">Items</h3>
									<div class="flex flex-col gap-2">
										{#each transformation.items as item, index}
											<button
												class="btn btn-sm justify-start text-left h-auto py-2 whitespace-normal"
												class:btn-primary={selection?.type === 'item' && selection.index === index}
												class:btn-ghost={!(selection?.type === 'item' && selection.index === index)}
												onclick={() => selectItem(index)}
												data-testid="item-{index}"
											>
												<div class="flex flex-col items-start gap-1">
													<div class="font-medium">{item.title || item.identifier}</div>
													{#if item.warnings.length > 0}
														<div class="badge badge-warning badge-xs">
															{item.warnings.length} warning{item.warnings.length > 1 ? 's' : ''}
														</div>
													{/if}
												</div>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>

						<!-- Errors Section -->
						{#if transformation.errors.length > 0}
							<div class="divider"></div>
							<div class="alert alert-error">
								<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<div>
									<h3 class="font-bold">{transformation.errors.length} Transformation Error{transformation.errors.length > 1 ? 's' : ''}</h3>
									<ul class="text-sm list-disc list-inside mt-2">
										{#each transformation.errors.slice(0, 3) as error}
											<li>{error.identifier}: {error.error}</li>
										{/each}
										{#if transformation.errors.length > 3}
											<li class="text-base-content/60">... and {transformation.errors.length - 3} more</li>
										{/if}
									</ul>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Right Panel: PIE Preview -->
			<div class="lg:col-span-2">
				<div class="card bg-base-100 shadow-xl h-full">
					<div class="card-body">
						{#if selectedItem}
							<h2 class="card-title mb-2">{selectedItem.title || selectedItem.identifier}</h2>

							<!-- Warnings -->
							{#if selectedItem.warnings.length > 0}
								<div class="alert alert-warning mb-4">
									<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<div>
										<h3 class="font-bold">Warnings ({selectedItem.warnings.length})</h3>
										<ul class="text-sm list-disc list-inside">
											{#each selectedItem.warnings as warning}
												<li>{warning}</li>
											{/each}
										</ul>
									</div>
								</div>
							{/if}

							<!-- PIE Player -->
							<div class="mt-4">
								<PieItemPlayer
									config={selectedItem.pieConfig}
									showDebug={true}
								/>
							</div>
						{:else if selectedAssessment}
							<!-- Assessment Preview -->
							{#if selectedAssessment.warnings.length > 0}
								<div class="alert alert-warning mb-4">
									<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<div>
										<h3 class="font-bold">Warnings ({selectedAssessment.warnings.length})</h3>
										<ul class="text-sm list-disc list-inside">
											{#each selectedAssessment.warnings as warning}
												<li>{warning}</li>
											{/each}
										</ul>
									</div>
								</div>
							{/if}

							<div class="overflow-y-auto">
								<PieAssessmentPreview assessment={(selectedAssessment.pieConfig as any).items?.[0]} />
							</div>
						{:else}
							<div class="flex flex-col items-center justify-center h-96 text-base-content/60">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
								</svg>
								<p class="text-lg">Select an item or assessment to preview</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
