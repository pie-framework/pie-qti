<script lang="ts">
	import { onMount } from 'svelte';
	import { ReferenceBackendAdapter, type SecureAssessment } from '@pie-qti/assessment-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import { AssessmentShell } from '$assessment-components';

	/**
	 * Fixture for the submit-safety, review-screen and flag flows.
	 * `?layout=linear-parts` delivers a linear part followed by a nonlinear part
	 * (for the "you cannot return" warning); the default is one nonlinear section.
	 */

	const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

	const choiceItem = (identifier: string, prompt: string) => `<assessmentItem ${NS} identifier="${identifier}" title="${prompt}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>${prompt}</p><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

	const compositeItem = `<assessmentItem ${NS} identifier="q3" title="Two-part question" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <responseDeclaration identifier="RESPONSE2" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p>Pick one from each group.</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">First A</simpleChoice><simpleChoice identifier="B">First B</simpleChoice></choiceInteraction>
    <choiceInteraction responseIdentifier="RESPONSE2" shuffle="false" maxChoices="1"><simpleChoice identifier="C">Second C</simpleChoice><simpleChoice identifier="D">Second D</simpleChoice></choiceInteraction>
  </itemBody>
</assessmentItem>`;

	const ASSESSMENTS: Record<string, SecureAssessment> = {
		nonlinear: {
			identifier: 'review-safety',
			title: 'Review safety check',
			navigationMode: 'nonlinear',
			submissionMode: 'simultaneous',
			testParts: [
				{
					identifier: 'part-1',
					sections: [
						{
							identifier: 'section-1',
							title: 'Alphabet',
							visible: true,
							assessmentItemRefs: [
								{ identifier: 'q1', role: 'candidate', itemXml: choiceItem('q1', 'Question one') },
								{ identifier: 'q2', role: 'candidate', itemXml: choiceItem('q2', 'Question two') },
								{ identifier: 'q3', role: 'candidate', itemXml: compositeItem },
							],
						},
					],
				},
			],
		},
		'linear-parts': {
			identifier: 'linear-parts',
			title: 'Linear parts check',
			navigationMode: 'nonlinear',
			submissionMode: 'simultaneous',
			testParts: [
				{
					identifier: 'part-1',
					navigationMode: 'linear',
					sections: [
						{
							identifier: 'section-1',
							title: 'Part One',
							visible: true,
							assessmentItemRefs: [{ identifier: 'q1', role: 'candidate', itemXml: choiceItem('q1', 'Linear question') }],
						},
					],
				},
				{
					identifier: 'part-2',
					navigationMode: 'nonlinear',
					sections: [
						{
							identifier: 'section-2',
							title: 'Part Two',
							visible: true,
							assessmentItemRefs: [{ identifier: 'q2', role: 'candidate', itemXml: choiceItem('q2', 'Final question') }],
						},
					],
				},
			],
		},
	};

	let ready = $state(false);
	let layout = $state('nonlinear');
	let completed = $state(false);
	const config = { i18nProvider: new DefaultI18nProvider() };

	function mountAssessment(selected: string) {
		const assessment = ASSESSMENTS[selected];
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		return { backend, initSession: { assessmentId: assessment.identifier, candidateId: 'review-candidate' } };
	}

	onMount(() => {
		layout = new URLSearchParams(window.location.search).get('layout') ?? 'nonlinear';
		ready = true;
	});
</script>

<h1 class="text-xl font-semibold mb-4">Assessment review and submit safety</h1>
{#if completed}<p role="status">Assessment completed</p>{/if}
{#if ready}
	{#key layout}
		{@const props = mountAssessment(layout)}
		<AssessmentShell {...props} {config} onSubmit={() => { completed = true; }} />
	{/key}
{/if}
