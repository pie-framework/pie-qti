<script lang="ts">
	import { onMount } from 'svelte';
	import Qti2AssessmentPlayer from '$lib/components/Qti2AssessmentPlayer.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const session = $derived(data.session);

	interface AssessmentInfo {
		id: string;
		title: string;
		filePath: string;
		itemCount: number;
		xml: string;
		items: Record<string, string>;
	}

	let assessments = $state<AssessmentInfo[]>([]);
	let selectedAssessmentIndex = $state(0);
	let _isLoadingAssessments = $state(true);
	let _assessmentsError = $state<string | null>(null);
	let _showCorrectResponses = $state(false);

	const _selectedAssessment = $derived(assessments[selectedAssessmentIndex]);

	onMount(async () => {
		await loadAssessments();
	});

	async function loadAssessments() {
		_isLoadingAssessments = true;
		_assessmentsError = null;

		try {
			const response = await fetch(`/api/sessions/${session.id}/assessments`);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to load assessments');
			}

			const result = await response.json();
			assessments = result.assessments;
		} catch (error) {
			console.error('Failed to load assessments:', error);
			_assessmentsError = error instanceof Error ? error.message : 'Failed to load assessments';
		} finally {
			_isLoadingAssessments = false;
		}
	}

	function _selectAssessment(index: number) {
		selectedAssessmentIndex = index;
		_showCorrectResponses = false;
	}
</script>

<div class="min-h-screen bg-base-200">
	<div class="mx-auto w-full max-w-screen-2xl p-4">
		<!-- Header -->
		<div class="flex items-center justify-between mb-6">
			<div>
				<div class="breadcrumbs text-sm">
					<ul>
						<li><a href="/">Home</a></li>
						<li><a href="/session/{session.id}">Session {session.id.slice(0, 8)}</a></li>
						<li>Assessment Tests</li>
					</ul>
				</div>
				<h1 class="text-3xl font-bold">Assessment Tests</h1>
				<p class="text-base-content/60 mt-2">
					Browse and preview {session.analysis?.totalTests || 0} QTI assessment tests
				</p>
			</div>
		</div>

		{#if _isLoadingAssessments}
			<div class="flex items-center justify-center p-12">
				<span class="loading loading-spinner loading-lg"></span>
				<span class="ml-4 text-lg">Loading assessment tests...</span>
			</div>
		{:else if _assessmentsError}
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
				<span>{_assessmentsError}</span>
			</div>
		{:else if assessments.length === 0}
			<div class="alert alert-info">
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
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>No assessment tests found in this session.</span>
			</div>
		{:else}
			<!-- Split Panel Layout -->
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
				<!-- Left Panel: Assessment List -->
				<div class="lg:col-span-3">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body p-4">
							<h2 class="card-title text-lg mb-2">Tests ({assessments.length})</h2>

							<div class="overflow-y-auto max-h-[calc(100vh-250px)]">
								<div class="space-y-2">
									{#each assessments as assessment, index}
										<button
											class="w-full text-left p-3 rounded-lg transition-colors {index ===
											selectedAssessmentIndex
												? 'bg-primary text-primary-content'
												: 'bg-base-200 hover:bg-base-300'}"
											onclick={() => _selectAssessment(index)}
										>
											<div class="font-semibold text-sm">{assessment.title}</div>
											<div class="text-xs opacity-80 mt-1">{assessment.itemCount} items</div>
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Panel: Assessment Preview -->
				<div class="lg:col-span-9">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body">
							<div class="flex items-center justify-between mb-4">
								<div>
									<h2 class="card-title">{_selectedAssessment?.title}</h2>
									<div class="flex flex-wrap gap-2 mt-2">
										<span class="badge badge-info badge-sm"
											>{_selectedAssessment?.itemCount} items</span
										>
									</div>
								</div>

								<div class="form-control">
									<label class="label cursor-pointer gap-2">
										<span class="label-text">Show Correct</span>
										<input
											type="checkbox"
											class="toggle toggle-primary"
											bind:checked={_showCorrectResponses}
										/>
									</label>
								</div>
							</div>

							<div class="divider"></div>

							<!-- QTI Assessment Player -->
							{#if _selectedAssessment && _selectedAssessment.xml}
								<div class="bg-base-200 rounded-lg p-4">
									<Qti2AssessmentPlayer
										assessmentTestXml={_selectedAssessment.xml}
										items={_selectedAssessment.items}
										identifier={_selectedAssessment.id}
										title={_selectedAssessment.title}
										config={{
											role: _showCorrectResponses ? 'scorer' : 'candidate',
											navigationMode: 'nonlinear',
											showSections: true
										}}
									/>
								</div>
							{:else if _selectedAssessment}
								<div class="alert alert-warning">
									<span>Assessment test XML not available</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
