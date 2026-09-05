<script lang="ts">
	import { onMount } from 'svelte';
	import { ReferenceBackendAdapter, type SecureAssessment, type SubmitResponsesRequest, type FinalizeAssessmentRequest } from '@pie-qti/assessment-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import { AssessmentShell } from '$assessment-components';

	let submitCalls = $state(0);
	let finalizeCalls = $state(0);
	let completed = $state(false);
	let ready = $state(false);
	let failureStage = 'responses';
	const assessment: SecureAssessment = {
		identifier: 'submission-recovery', title: 'Submission recovery',
		navigationMode: 'nonlinear', submissionMode: 'simultaneous',
		testParts: [{ identifier: 'part', sections: [{
			identifier: 'section', visible: true,
			assessmentItemRefs: [{ identifier: 'choice', role: 'candidate', itemXml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="choice" title="Choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>water</value></correctResponse></responseDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" shuffle="false"><prompt>Which drink would you choose?</prompt><simpleChoice identifier="water">Water</simpleChoice><simpleChoice identifier="milk">Milk</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>` }],
		}] }],
	};
	class FailingOnceBackend extends ReferenceBackendAdapter {
		override async submitResponses(request: SubmitResponsesRequest) {
			submitCalls += 1;
			await new Promise((resolve) => setTimeout(resolve, 250));
			if (failureStage === 'responses' && submitCalls === 1) throw new Error('Connection interrupted. Your answers are still here. Try submitting again.');
			return super.submitResponses(request);
		}
		override async finalizeAssessment(request: FinalizeAssessmentRequest) {
			finalizeCalls += 1;
			if (failureStage === 'finalize' && finalizeCalls === 1) throw new Error('Could not finish submission. Your answers are still here. Try submitting again.');
			return super.finalizeAssessment(request);
		}
	}
	const backend = new FailingOnceBackend();
	backend.registerAssessment(assessment.identifier, assessment);
	const config = { i18nProvider: new DefaultI18nProvider() };
	onMount(() => {
		failureStage = new URLSearchParams(window.location.search).get('stage') ?? 'responses';
		ready = true;
	});
</script>

<h1 class="text-xl font-semibold mb-4">Assessment submission recovery</h1>
<p data-testid="request-counts">Responses: {submitCalls}; finalizations: {finalizeCalls}</p>
{#if completed}<p role="status">Assessment completed</p>{/if}
{#if ready}
	<AssessmentShell {backend} initSession={{ assessmentId: assessment.identifier, candidateId: 'recovery-candidate' }} {config} onSubmit={() => { completed = true; }}/>
{/if}
