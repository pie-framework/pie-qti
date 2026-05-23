<script lang="ts">
	
	import type { InitSessionRequest } from '@pie-qti/assessment-player';
	import { ReferenceBackendAdapter } from '@pie-qti/assessment-player';
import { AssessmentShell } from '@pie-qti/assessment-player/components';
	import { SAMPLE_ASSESSMENTS } from '$lib/sample-assessments';

	const secureAssessment = SAMPLE_ASSESSMENTS[0]?.assessment ?? null;

	const backend = new ReferenceBackendAdapter();
	if (secureAssessment) backend.registerAssessment(secureAssessment.identifier, secureAssessment);

	const initSession: InitSessionRequest | null = secureAssessment
		? { assessmentId: secureAssessment.identifier, candidateId: 'example' }
		: null;
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for the assessment shell (navigation, sections, rubrics, and item rendering).
	</p>

	{#if secureAssessment}
		<div class="border border-base-300 rounded">
			<AssessmentShell
				{backend}
				initSession={initSession!}
				config={{
					role: 'candidate',
					showSections: true,
					allowSectionNavigation: true,
					showProgress: true,
				}}
			/>
		</div>
	{:else}
		<div class="alert alert-error">No sample assessments available.</div>
	{/if}
</div>


