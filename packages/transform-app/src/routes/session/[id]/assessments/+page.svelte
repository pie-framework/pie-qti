<script lang="ts">
	import { onMount } from 'svelte';
	import { ReferenceBackendAdapter } from '@pie-qti/qti2-assessment-player';
	import AssessmentShell from '@pie-qti/qti2-assessment-player/components/AssessmentShell.svelte';
	import { parseAssessmentTestXml, resolveItemsForAssessment } from '@pie-qti/qti2-player-elements';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';
	import type { PageData } from './$types';
	import type { InitSessionRequest, SecureAssessment, QTIRole } from '@pie-qti/qti2-assessment-player';

	const { data }: { data: PageData } = $props();
	const session = $derived(data.session);

	interface AssessmentInfo {
		id: string;
		title: string;
		filePath: string;
		itemCount: number;
		xml: string;
		items: Record<string, string>;
		identifier: string;
		navigationMode: 'linear' | 'nonlinear';
		submissionMode: 'individual' | 'simultaneous';
		sectionCount: number;
	}

	let assessments = $state<AssessmentInfo[]>([]);
	let selectedAssessmentIndex = $state<number | null>(null);
	let _isLoadingAssessments = $state(true);
	let _assessmentsError = $state<string | null>(null);
	let _showCorrectResponses = $state(false);

	// Store parsed assessment (minimal state)
	let parsedAssessment = $state<any>(null);

	const _selectedAssessment = $derived(
		selectedAssessmentIndex !== null ? assessments[selectedAssessmentIndex] : null
	);

	// Compute actual section count from secure assessment (sections with items)
	const _actualSectionCount = $derived.by(() => {
		if (!backend || !parsedAssessment) return 0;
		const secure = toSecureAssessment(parsedAssessment, _showCorrectResponses ? 'scorer' : 'candidate');
		return secure.testParts.reduce((count, tp) => count + tp.sections.length, 0);
	});

	// Derive backend and initSession from state (no effects needed)
	const backend = $derived.by(() => {
		if (!parsedAssessment) return null;

		try {
			const role: QTIRole = _showCorrectResponses ? 'scorer' : 'candidate';
			const secure = toSecureAssessment(parsedAssessment, role);
			const b = new ReferenceBackendAdapter();
			b.registerAssessment(secure.identifier, secure);
			return b;
		} catch (error) {
			console.error('Failed to create backend:', error);
			return null;
		}
	});

	const initSession = $derived.by<InitSessionRequest | null>(() => {
		if (!parsedAssessment || !backend) return null;
		return {
			assessmentId: parsedAssessment.identifier,
			candidateId: 'transform-app',
		};
	});

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

	async function _selectAssessment(index: number) {
		selectedAssessmentIndex = index;
		_assessmentsError = null;
		_showCorrectResponses = false; // Reset toggle when selecting new assessment

		const assessment = assessments[index];

		try {
			// Parse assessment XML
			const parsed = parseAssessmentTestXml(assessment.xml);

			// Resolve items
			await resolveItemsForAssessment({
				assessment: parsed,
				items: assessment.items,
			});

			// Store parsed assessment - backend/initSession will derive automatically
			parsedAssessment = parsed;
		} catch (error) {
			console.error('Failed to load assessment:', error);
			_assessmentsError = error instanceof Error ? error.message : 'Failed to load assessment';
			parsedAssessment = null;
		}
	}

	// Helper to convert ParsedAssessmentTest to SecureAssessment
	function toSecureAssessment(parsed: any, role: QTIRole): SecureAssessment {
		const firstPart = parsed.testParts?.[0];
		const navigationMode = firstPart?.navigationMode ?? 'nonlinear';
		const submissionMode = firstPart?.submissionMode ?? 'individual';

		// Helper to flatten nested sections recursively
		function flattenSections(sections: any[]): any[] {
			const result: any[] = [];

			for (const section of sections) {
				// Process current section
				const items = (section.questionRefs || [])
					.filter((q: any) => {
						if (!q.itemXml) {
							console.warn(`Item ${q.identifier} has no itemXml, skipping`);
							return false;
						}
						return true;
					})
					.map((q: any) => ({
						identifier: q.identifier,
						itemXml: q.itemXml,
						role,
						required: q.required,
					}));

				const processedSection = {
					identifier: section.identifier,
					title: section.title,
					visible: section.visible !== false,
					items,
					rubrics: (section.rubricBlocks || []).map((rb: any) => ({
						identifier: rb.identifier ?? rb.id,
						content: rb.content,
						view: [(rb.view ?? 'candidate') as QTIRole],
						use: rb.use,
					})),
				};

				// Only include section if it has items
				if (items.length > 0) {
					result.push(processedSection);
				} else {
					console.warn(`Section ${section.identifier} has no items, skipping`);
				}

				// Recursively flatten nested sections
				if (section.sections && section.sections.length > 0) {
					result.push(...flattenSections(section.sections));
				}
			}

			return result;
		}

		return {
			identifier: parsed.identifier,
			title: parsed.title || 'Untitled Assessment',
			navigationMode,
			submissionMode,
			testParts: (parsed.testParts || []).map((tp: any) => ({
				identifier: tp.identifier,
				itemSessionControl: tp.itemSessionControl,
				sections: flattenSections(tp.sections || []),
			})),
		};
	}

	function getSecurityConfig() {
		return {
			urlPolicy: {
				assetBaseUrl: `${window.location.origin}/`,
			},
		};
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
		{:else if _assessmentsError && assessments.length === 0}
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
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
				<!-- Left Panel: Assessment List (3 columns) -->
				<div class="lg:col-span-3">
					<div class="card bg-base-100 shadow-xl">
						<div class="card-body p-4">
							<h2 class="card-title text-lg mb-2">
								Assessments ({assessments.length})
							</h2>

							<div class="overflow-y-auto max-h-[calc(100vh-250px)]">
								<div class="space-y-2">
									{#each assessments as assessment, index}
										<button
											class="w-full text-left p-3 rounded-lg transition-colors
												{index === selectedAssessmentIndex
													? 'bg-primary text-primary-content'
													: 'bg-base-200 hover:bg-base-300'}"
											onclick={() => _selectAssessment(index)}
										>
											<div class="font-semibold text-sm">{assessment.title}</div>

											<!-- Metadata badges -->
											<div class="flex flex-wrap gap-1 mt-2">
												<span class="badge badge-sm badge-info">
													{assessment.itemCount} items
												</span>
												<span class="badge badge-sm badge-outline">
													{assessment.sectionCount} sections
												</span>
												<span class="badge badge-sm badge-outline">
													{assessment.navigationMode}
												</span>
											</div>
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Panel: Preview (9 columns) -->
				<div class="lg:col-span-9">
					{#if _selectedAssessment && backend && initSession}
						<div class="card bg-base-100 shadow-xl">
							<div class="card-body">
								<!-- Header with metadata -->
								<div class="flex items-center justify-between mb-4">
									<div>
										<h2 class="card-title">{_selectedAssessment.title}</h2>
										<div class="flex flex-wrap gap-2 mt-2">
											<span class="badge badge-info">
												{_selectedAssessment.itemCount} items
											</span>
											<span class="badge badge-outline">
												{_actualSectionCount} {_actualSectionCount === 1 ? 'section' : 'sections'}
											</span>
											<span class="badge badge-outline">
												Navigation: {_selectedAssessment.navigationMode}
											</span>
											<span class="badge badge-outline">
												Submission: {_selectedAssessment.submissionMode}
											</span>
										</div>
									</div>

									<!-- Show Correct toggle -->
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

								{#if _assessmentsError}
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
										<span>{_assessmentsError}</span>
									</div>
								{/if}

								<!-- Assessment Player using AssessmentShell directly -->
								<div class="bg-base-200 rounded-lg p-4">
									{#key backend}
										<AssessmentShell
											{backend}
											{initSession}
											config={{
												role: _showCorrectResponses ? 'scorer' : 'candidate',
												showSections: true,
												allowSectionNavigation: true,
												security: getSecurityConfig(),
											}}
											typeset={(el) => typesetMathInElement(el, {})}
										/>
									{/key}
								</div>
							</div>
						</div>
					{:else if _assessmentsError}
						<div class="card bg-base-100 shadow-xl">
							<div class="card-body items-center justify-center min-h-[400px]">
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
							</div>
						</div>
					{:else}
						<!-- No selection state -->
						<div class="card bg-base-100 shadow-xl">
							<div class="card-body items-center justify-center min-h-[400px]">
								<div class="text-center">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-16 w-16 mx-auto mb-4 text-base-content/40"
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
									<p class="text-lg text-base-content/60">
										Select an assessment to preview
									</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
