<script lang="ts">
	import { onMount } from 'svelte';
	import { ReferenceBackendAdapter, type SecureAssessment } from '@pie-qti/assessment-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import { AssessmentShell } from '$assessment-components';

	/**
	 * Fixture for timer and time administration flows.
	 *
	 * `?scenario=`:
	 * - `auto-submit` (default): a 6s whole-test limit with a 3s warning threshold; at
	 *   expiry the player submits automatically and the results reach the host.
	 * - `dead-end`: a 3s test-part limit over three questions; the expiry leaves no
	 *   reachable question, so Submit must be offered and work from question 1.
	 * - `pause`: a 60s limit plus proctor Pause/Resume buttons; the overlay names the
	 *   reason and the countdown freezes. `&resume=1` resumes the stored draft, so a
	 *   reload during the pause reopens paused behind the overlay.
	 * - `start-gate`: the begin gate; delivery and the clocks wait for Begin.
	 * - `late`: an expired limit with allowLateSubmission; the test stays open.
	 * - `section-expiry`: a 3s section limit on question 1 ahead of an untimed section;
	 *   with `&resume=1` a reload resumes the stored draft (for Start over after expiry).
	 *
	 * `window.__timedShell.pause(reason)` / `.resume()` drive the proctor pause from a
	 * test while a modal dialog makes the page's own buttons inert.
	 */

	const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

	const choiceItem = (identifier: string, prompt: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${prompt}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>${prompt}</p><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

	type Scenario = 'auto-submit' | 'dead-end' | 'pause' | 'start-gate' | 'late' | 'section-expiry';

	let ready = $state(false);
	let scenario = $state<Scenario>('auto-submit');
	let resume = $state(false);
	let completed = $state(false);
	let resultsLine = $state('');
	let shell = $state<AssessmentShell | null>(null);
	let pausedNow = $state(false);
	const config = { i18nProvider: new DefaultI18nProvider() };

	const ASSESSMENTS: Record<Scenario, () => { assessment: SecureAssessment; beginGate?: boolean }> = {
		'auto-submit': () => ({
			assessment: {
				identifier: 'timed-auto',
				title: 'Timed delivery check',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				timeLimits: { maxTime: 6 },
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
								],
							},
						],
					},
				],
			},
		}),
		'dead-end': () => ({
			assessment: {
				identifier: 'timed-dead-end',
				title: 'Dead end check',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				testParts: [
					{
						identifier: 'part-1',
						timeLimits: { maxTime: 3 },
						sections: [
							{
								identifier: 'section-1',
								title: 'Only section',
								visible: true,
								assessmentItemRefs: [
									{ identifier: 'q1', role: 'candidate', itemXml: choiceItem('q1', 'Question one') },
									{ identifier: 'q2', role: 'candidate', itemXml: choiceItem('q2', 'Question two') },
									{ identifier: 'q3', role: 'candidate', itemXml: choiceItem('q3', 'Question three') },
								],
							},
						],
					},
				],
			},
		}),
		pause: () => ({
			assessment: {
				identifier: 'timed-pause',
				title: 'Pause check',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				timeLimits: { maxTime: 600 },
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
								],
							},
						],
					},
				],
			},
		}),
		'start-gate': () => ({
			assessment: {
				identifier: 'timed-gate',
				title: 'Begin gate check',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				timeLimits: { maxTime: 600 },
				testParts: [
					{
						identifier: 'part-1',
						rubricBlocks: [
							{
								identifier: 'instructions',
								use: 'instructions',
								view: ['candidate'],
								content: '<p>Answer every question, then submit.</p>',
							},
						],
						sections: [
							{
								identifier: 'section-1',
								title: 'Alphabet',
								visible: true,
								assessmentItemRefs: [
									{ identifier: 'q1', role: 'candidate', itemXml: choiceItem('q1', 'Question one') },
								],
							},
						],
					},
				],
			},
			beginGate: true,
		}),
		late: () => ({
			assessment: {
				identifier: 'timed-late',
				title: 'Late submission check',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				timeLimits: { maxTime: 2, allowLateSubmission: true },
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
								],
							},
						],
					},
				],
			},
		}),
		'section-expiry': () => ({
			assessment: {
				identifier: 'timed-section-expiry',
				title: 'Section expiry check',
				navigationMode: 'nonlinear',
				submissionMode: 'simultaneous',
				testParts: [
					{
						identifier: 'part-1',
						sections: [
							{
								identifier: 'section-1',
								title: 'Quick round',
								visible: true,
								timeLimits: { maxTime: 3 },
								assessmentItemRefs: [
									{ identifier: 'q1', role: 'candidate', itemXml: choiceItem('q1', 'Question one') },
								],
							},
							{
								identifier: 'section-2',
								title: 'Main round',
								visible: true,
								assessmentItemRefs: [
									{ identifier: 'q2', role: 'candidate', itemXml: choiceItem('q2', 'Question two') },
									{ identifier: 'q3', role: 'candidate', itemXml: choiceItem('q3', 'Question three') },
								],
							},
						],
					},
				],
			},
		}),
	};

	function mountAssessment(selected: Scenario) {
		const { assessment, beginGate } = ASSESSMENTS[selected]();
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		const initSession: { assessmentId: string; candidateId: string; resumeSessionId?: string } = {
			assessmentId: assessment.identifier,
			candidateId: 'timed-candidate',
		};
		if (resume) {
			const stored = backend.latestSessionId(assessment.identifier, initSession.candidateId);
			if (stored) initSession.resumeSessionId = stored;
		}
		return { backend, initSession, beginGate };
	}

	function handleSubmit(results: { totalScore: number; maxScore: number }) {
		completed = true;
		resultsLine = `${results.totalScore} of ${results.maxScore}`;
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const requested = params.get('scenario') ?? 'auto-submit';
		if (requested in ASSESSMENTS) scenario = requested as Scenario;
		resume = params.get('resume') === '1';
		ready = true;
		// Test hook: a proctor pause while a modal dialog makes this page's buttons inert.
		(window as unknown as { __timedShell?: unknown }).__timedShell = {
			pause: (reason?: string) => shell?.pause(reason),
			resume: () => shell?.resume(),
		};
	});
</script>

<h1 class="text-xl font-semibold mb-4">Assessment timer and time administration</h1>
<p class="mb-4 text-sm" data-testid="timed-scenario">Scenario: {scenario}</p>
{#if completed}
	<p role="status" data-testid="timed-completed">Assessment completed ({resultsLine})</p>
{/if}
{#if ready}
	{#key scenario}
		{@const props = mountAssessment(scenario)}
		<AssessmentShell {...props} {config} onSubmit={handleSubmit} bind:this={shell} />
		{#if scenario === 'pause'}
			<div class="flex gap-2 mt-4">
				<button
					type="button"
					class="btn btn-sm"
					data-testid="proctor-pause"
					onclick={() => {
						shell?.pause('Proctor needs your attention');
						pausedNow = true;
					}}
				>
					Pause (proctor)
				</button>
				<button
					type="button"
					class="btn btn-sm"
					data-testid="proctor-resume"
					onclick={() => {
						shell?.resume();
						pausedNow = false;
					}}
				>
					Resume (proctor)
				</button>
			</div>
		{/if}
	{/key}
{/if}
