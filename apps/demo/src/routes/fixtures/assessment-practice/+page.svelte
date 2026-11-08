<script lang="ts">
	import { onMount } from 'svelte';
	import { ReferenceBackendAdapter, type SecureAssessment, type SecureItemRef } from '@pie-qti/assessment-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import { AssessmentShell } from '$assessment-components';

	/**
	 * Fixture for practice delivery, comments and the completion screen.
	 *
	 * `?scenario=`:
	 * - `practice` (default): individual submission mode, `showFeedback` with two
	 *   attempts and outcome-matched modal feedback; `allowComment` on the first item.
	 * - `simultaneous`: the same item in a simultaneous part — no check control.
	 * - `linear-feedback`: a linear individual part with single-attempt feedback —
	 *   the submit-on-move transition carries the item's feedback dialog.
	 * - `complete`: two plain items; the built-in completion screen after submit.
	 *   `&summary=1` opts into the per-question results summary.
	 */

	const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

	/** A choice item with outcome-matched modal feedback. */
	const practiceItemXml = (identifier: string, prompt: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${prompt}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="FEEDBACK" cardinality="single" baseType="identifier">
    <defaultValue><value>none</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>${prompt}: what is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">Alpha</simpleChoice>
      <simpleChoice identifier="B">Beta</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">correct</baseValue></setOutcomeValue>
      </responseIf>
      <responseElse>
        <setOutcomeValue identifier="FEEDBACK"><baseValue baseType="identifier">incorrect</baseValue></setOutcomeValue>
      </responseElse>
    </responseCondition>
  </responseProcessing>
  <modalFeedback identifier="correct" outcomeIdentifier="FEEDBACK" showHide="show"><p>Nice work: 2 + 2 is 4.</p></modalFeedback>
  <modalFeedback identifier="incorrect" outcomeIdentifier="FEEDBACK" showHide="show"><p>Check your addition.</p></modalFeedback>
</assessmentItem>`;

	const plainItemXml = (identifier: string, prompt: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${prompt}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>B</value></correctResponse>
  </responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody>
    <p>${prompt}: what is 2 + 2?</p>
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="A">Alpha</simpleChoice>
      <simpleChoice identifier="B">Beta</simpleChoice>
    </choiceInteraction>
  </itemBody>
  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match>
        <setOutcomeValue identifier="SCORE"><baseValue baseType="float">1</baseValue></setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>
</assessmentItem>`;

	const practiceItemRef = (
		identifier: string,
		prompt: string,
		control: SecureItemRef['itemSessionControl'],
	): SecureItemRef => ({
		identifier,
		role: 'candidate',
		itemXml: practiceItemXml(identifier, prompt),
		...(control ? { itemSessionControl: control } : {}),
	});

	type Scenario = 'practice' | 'simultaneous' | 'linear-feedback' | 'complete';

	const ASSESSMENTS: Record<Scenario, () => SecureAssessment> = {
		practice: () => ({
			identifier: 'practice-flow',
			title: 'Practice check',
			navigationMode: 'nonlinear',
			submissionMode: 'individual',
			testParts: [
				{
					identifier: 'part-1',
					navigationMode: 'nonlinear',
					submissionMode: 'individual',
					sections: [
						{
							identifier: 'section-1',
							title: 'Alphabet',
							visible: true,
							assessmentItemRefs: [
								practiceItemRef('q1', 'Question one', { showFeedback: true, maxAttempts: 2, allowComment: true }),
								practiceItemRef('q2', 'Question two', { showFeedback: true, maxAttempts: 2 }),
							],
						},
					],
				},
			],
		}),
		simultaneous: () => ({
			identifier: 'practice-simultaneous',
			title: 'Simultaneous check',
			navigationMode: 'nonlinear',
			submissionMode: 'simultaneous',
			testParts: [
				{
					identifier: 'part-1',
					navigationMode: 'nonlinear',
					submissionMode: 'simultaneous',
					sections: [
						{
							identifier: 'section-1',
							title: 'Alphabet',
							visible: true,
							assessmentItemRefs: [
								practiceItemRef('q1', 'Question one', { showFeedback: true, maxAttempts: 2 }),
							],
						},
					],
				},
			],
		}),
		'linear-feedback': () => ({
			identifier: 'practice-linear',
			title: 'Linear feedback check',
			navigationMode: 'linear',
			submissionMode: 'individual',
			testParts: [
				{
					identifier: 'part-1',
					navigationMode: 'linear',
					submissionMode: 'individual',
					sections: [
						{
							identifier: 'section-1',
							title: 'Only part',
							visible: true,
							assessmentItemRefs: [
								practiceItemRef('q1', 'Question one', { showFeedback: true }),
								practiceItemRef('q2', 'Question two', { showFeedback: true }),
							],
						},
					],
				},
			],
		}),
		complete: () => ({
			identifier: 'practice-complete',
			title: 'Completion check',
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
								{ identifier: 'q1', role: 'candidate', itemXml: plainItemXml('q1', 'Question one') },
								{ identifier: 'q2', role: 'candidate', itemXml: plainItemXml('q2', 'Question two') },
							],
						},
					],
				},
			],
		}),
	};

	let ready = $state(false);
	let scenario = $state<Scenario>('practice');
	let summary = $state(false);
	let resultsLine = $state('');
	const config = { i18nProvider: new DefaultI18nProvider() };

	function mountAssessment(selected: Scenario) {
		const assessment = ASSESSMENTS[selected]();
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		return {
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'practice-candidate' },
		};
	}

	function handleSubmit(results: { totalScore: number; maxScore: number }) {
		resultsLine = `${results.totalScore} of ${results.maxScore}`;
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const requested = params.get('scenario') ?? 'practice';
		if (requested in ASSESSMENTS) scenario = requested as Scenario;
		summary = params.get('summary') === '1';
		ready = true;
	});
</script>

<h1 class="text-xl font-semibold mb-4">Assessment practice, feedback and completion</h1>
<p class="mb-4 text-sm" data-testid="practice-scenario">Scenario: {scenario}{summary ? ' + summary' : ''}</p>
{#if resultsLine}
	<p role="status" data-testid="practice-results">Results reached the host ({resultsLine})</p>
{/if}
{#key `${scenario}:${summary}`}
	{@const props = mountAssessment(scenario)}
	<AssessmentShell {...props} {config} showResultsSummary={summary} onSubmit={handleSubmit} />
{/key}
