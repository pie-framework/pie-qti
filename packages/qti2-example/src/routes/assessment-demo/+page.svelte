<script lang="ts">
	import type { AssessmentResults, InitSessionRequest } from '@pie-qti/qti2-assessment-player';
	import { ReferenceBackendAdapter } from '@pie-qti/qti2-assessment-player';
	import AssessmentShell from '@pie-qti/qti2-assessment-player/components/AssessmentShell.svelte';
	import { typesetAction } from '@pie-qti/qti2-default-components/shared';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';
	import { SAMPLE_ASSESSMENTS, type SampleAssessment, toSecureAssessment } from '$lib/sample-assessments';
	import { getSecurityConfig } from '$lib/player-config';
	import AssessmentEndScreen from './components/AssessmentEndScreen.svelte';
	import FileUploader from './components/FileUploader.svelte';
	import SampleSelector from './components/SampleSelector.svelte';

	let selectedSampleId = $state('reading-comp-1');
	let selectedAssessment = $state<SampleAssessment | null>(null);
	let backend = $state(new ReferenceBackendAdapter());
	let initSession = $state<InitSessionRequest>({ assessmentId: 'reading-comp-1', candidateId: 'qti2-example' });
	let uploadedFile = $state<File | null>(null);
	let isUploading = $state(false);
	let uploadError = $state<string | null>(null);
	let results = $state<AssessmentResults | null>(null);
	let runKey = $state(0);

	type DisplayItemScore = {
		id: string;
		title: string;
		sectionTitle?: string;
		score: number;
		maxScore: number;
	};

	const displayItemScores = $derived.by((): DisplayItemScore[] => {
		if (!selectedAssessment || !results) return [];

		const metaById = new Map<string, { title?: string; sectionTitle?: string }>();
		for (const tp of selectedAssessment.assessment.testParts || []) {
			for (const section of tp.sections || []) {
				for (const q of section.questionRefs || []) {
					metaById.set(q.identifier, { title: q.title, sectionTitle: section.title });
				}
			}
		}

		return results.itemResults.map((r) => {
			const meta = metaById.get(r.itemIdentifier);
			return {
				id: r.itemIdentifier,
				title: meta?.title || r.itemIdentifier,
				sectionTitle: meta?.sectionTitle,
				score: r.score,
				maxScore: r.maxScore,
			};
		});
	});

	// Load initial sample assessment
	$effect(() => {
		const sample = SAMPLE_ASSESSMENTS.find((s) => s.id === selectedSampleId);
		if (sample) {
			selectedAssessment = sample;
			// Create a fresh reference backend for each sample selection.
			const secure = toSecureAssessment(sample.assessment, { role: 'candidate' });
			const b = new ReferenceBackendAdapter();
			b.registerAssessment(secure.identifier, secure);
			backend = b;
			initSession = { assessmentId: secure.identifier, candidateId: 'qti2-example' };
		}
	});

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		uploadedFile = file;
		isUploading = true;
		uploadError = null;

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/api/upload-qti', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				throw new Error(`Upload failed: ${response.statusText}`);
			}

			const result = await response.json();

			if (result.success && result.data.type === 'assessment') {
				// Future enhancement: Parse QTI assessmentTest XML and convert to SecureAssessment
				// Implementation plan:
				// 1. Use parseAssessmentTestXml() from qti2-player-elements
				// 2. Resolve item hrefs from result.data.files
				// 3. Convert ParsedAssessmentTest → SecureAssessment format
				// 4. Register with backend adapter and display
				console.log('Assessment uploaded successfully:', result);
				uploadError = 'QTI assessment parsing is not yet implemented. Coming soon!';
			} else if (result.data.type === 'item') {
				uploadError =
					'This appears to be a single item, not an assessment. Please use the Item Demo page for single items.';
			}
		} catch (err) {
			console.error('Upload error:', err);
			uploadError = err instanceof Error ? err.message : 'Failed to upload file';
		} finally {
			isUploading = false;
		}
	}

	function handleSampleChange(sampleId: string) {
		selectedSampleId = sampleId;
		uploadedFile = null;
		uploadError = null;
		results = null;
		runKey += 1;
	}

	function handleRetake() {
		results = null;
		runKey += 1;
	}

	// Expose function for E2E tests to programmatically change sample
	if (typeof window !== 'undefined') {
		(window as any).__testHelpers = {
			selectSample: (sampleId: string) => handleSampleChange(sampleId)
		};
	}
</script>

<div class="assessment-demo-page">
	<!-- Controls -->
	<div class="controls-section">
		<div class="card bg-base-200">
			<div class="card-body">
				<SampleSelector {selectedSampleId} onSampleChange={handleSampleChange} />
				<FileUploader {isUploading} {uploadError} onFileUpload={handleFileUpload} />
			</div>
		</div>
	</div>

	<!-- Assessment Player -->
	{#if selectedAssessment}
		<div class="player-section">
			{#if results}
				<AssessmentEndScreen {results} items={displayItemScores} onRetake={handleRetake} />
			{:else}
				{#key `${selectedAssessment.id}:${runKey}`}
					<AssessmentShell
						{backend}
						{initSession}
						config={{
							role: 'candidate',
							showSections: true,
							allowSectionNavigation: true,
							showProgress: true,
							security: getSecurityConfig(),
						}}
						onSubmit={(r) => (results = r)}
						typeset={(el) => typesetMathInElement(el)}
					/>
				{/key}
			{/if}
		</div>
	{/if}
</div>

<style>
	.assessment-demo-page {
		min-height: 100vh;
		padding: 2rem;
		background: var(--color-base-200);
	}

	.controls-section {
		max-width: 1200px;
		margin: 0 auto 2rem;
	}

	.player-section {
		max-width: 1200px;
		margin: 0 auto;
		border: 1px solid var(--color-base-300);
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--color-base-100);
	}

	@media (max-width: 768px) {
		.assessment-demo-page {
			padding: 1rem;
		}
	}
</style>
