<script lang="ts">
	
	import type { InitSessionRequest } from '@pie-qti/qti2-assessment-player';
	import { ReferenceBackendAdapter } from '@pie-qti/qti2-assessment-player';
import AssessmentShell from '@pie-qti/qti2-assessment-player/components/AssessmentShell.svelte';
	import { typesetAction } from '@pie-qti/qti2-default-components/shared';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';
	import { SAMPLE_ASSESSMENTS, type SampleAssessment, toSecureAssessment } from '$lib/sample-assessments';
	import { getSecurityConfig } from '$lib/player-config';

	let selectedSampleId = $state('reading-comp-1');
	let selectedAssessment = $state<SampleAssessment | null>(null);
	let backend = $state(new ReferenceBackendAdapter());
	let initSession = $state<InitSessionRequest>({ assessmentId: 'reading-comp-1', candidateId: 'qti2-example' });

	// Load initial sample assessment
	$effect(() => {
		const sample = SAMPLE_ASSESSMENTS.find((s) => s.id === selectedSampleId);
		if (sample) {
			selectedAssessment = sample;
			const secure = toSecureAssessment(sample.assessment, { role: 'candidate' });
			const b = new ReferenceBackendAdapter();
			b.registerAssessment(secure.identifier, secure);
			backend = b;
			initSession = { assessmentId: secure.identifier, candidateId: 'qti2-example' };
		}
	});
</script>

<div class="max-w-6xl mx-auto">
	<!-- Simple control panel -->
	<div class="card bg-base-100 shadow-xl mb-4">
		<div class="card-body">
			<div class="form-control">
				<label class="label" for="sample-select">
					<span class="label-text">Select Assessment</span>
				</label>
				<select id="sample-select" class="select select-bordered w-full" bind:value={selectedSampleId}>
					{#each SAMPLE_ASSESSMENTS as sample}
						<option value={sample.id}>{sample.name}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Assessment Player -->
	{#if selectedAssessment}
		{#key selectedAssessment.id}
			<div use:typesetAction={{ typeset: (el) => typesetMathInElement(el) }}>
				<AssessmentShell
					{backend}
					{initSession}
					config={{
						role: 'candidate',
						showSections: true,
						allowSectionNavigation: true,
						showProgress: true,
						security: getSecurityConfig(),
						onComplete: () => {
							// No-op for test fixtures
						},
					}}
				/>
			</div>
		{/key}
	{/if}
</div>
