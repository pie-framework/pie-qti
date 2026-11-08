<script lang="ts">
	import { onMount } from 'svelte';
	import { ReferenceBackendAdapter, type SecureAssessment } from '@pie-qti/assessment-player';
	import type { QtiSectionRuntimeHostContract, QtiSectionSnapshot } from '@pie-qti/section-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import { AssessmentShell } from '$assessment-components';

	/**
	 * Fixture for resilience flows (safe load/failure screens, error boundaries).
	 *
	 * `?scenario=`:
	 * - `retry` (default): `initSession` fails once with a developer message, then
	 *   works. The shell must show the candidate-safe load error with Retry — never
	 *   the raw text — and Retry must recover.
	 * - `slow`: `initSession` hangs ~11s then succeeds. After 10s the shell shows the
	 *   polite "still loading" status, never a permanent error, and proceeds alone.
	 * - `crash`: the fixture host throws synchronously while question two's renderer
	 *   reports its rendered state (the section host snapshot callback), the way any
	 *   synchronous failure in an item's rendering reaches the shell. The content
	 *   boundary must contain it: a plain-language fallback, the shell intact, and
	 *   Continue moving the candidate to question three.
	 */

	const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

	const choiceItem = (identifier: string, prompt: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${prompt}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>${prompt}</p><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

	type Scenario = 'retry' | 'slow' | 'crash';

	let ready = $state(false);
	let scenario = $state<Scenario>('retry');
	let completed = $state(false);
	const config = { i18nProvider: new DefaultI18nProvider() };

	const assessmentFor = (selected: Scenario): SecureAssessment => ({
		identifier: `resilience-${selected}`,
		title: 'Resilience check',
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
							{ identifier: 'q3', role: 'candidate', itemXml: choiceItem('q3', 'Question three') },
						],
					},
				],
			},
		],
	});

	/** Fails the first initSession (retry), or delays it ~11s (slow), per scenario. */
	class FlakyInitBackend extends ReferenceBackendAdapter {
		#scenario: Scenario;
		#initCalls = 0;
		constructor(scenario: Scenario) {
			super();
			this.#scenario = scenario;
		}
		override async initSession(...args: Parameters<ReferenceBackendAdapter['initSession']>) {
			this.#initCalls += 1;
			if (this.#scenario === 'retry' && this.#initCalls === 1) {
				throw new Error('Backend unavailable: connection refused by fixture (developer text)');
			}
			if (this.#scenario === 'slow') {
				await new Promise((resolve) => setTimeout(resolve, 11000));
			}
			return super.initSession(...args);
		}
	}

	function mountAssessment(selected: Scenario) {
		const assessment = assessmentFor(selected);
		const backend = new FlakyInitBackend(selected);
		backend.registerAssessment(assessment.identifier, assessment);

		// The crash fixture: question two's rendering throws synchronously — the section
		// host snapshot callback fails while the renderer reports the rendered item, the
		// path any renderer-side failure takes into the shell.
		const sectionHost: QtiSectionRuntimeHostContract | undefined =
			selected === 'crash'
				? {
						onSnapshotChange(event: QtiSectionSnapshot) {
							if (event.activeItemIdentifier === 'q2') {
								throw new Error('Renderer exploded while showing question two (fixture)');
							}
						},
					}
				: undefined;

		return {
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'resilience-candidate' },
			sectionHost,
		};
	}

	onMount(() => {
		const requested = new URLSearchParams(window.location.search).get('scenario') ?? 'retry';
		if ((['retry', 'slow', 'crash'] as const).includes(requested as Scenario)) scenario = requested as Scenario;
		ready = true;
	});
</script>

<h1 class="text-xl font-semibold mb-4">Assessment resilience</h1>
<p class="mb-4 text-sm" data-testid="resilience-scenario">Scenario: {scenario}</p>
{#if completed}<p role="status">Assessment completed</p>{/if}
{#if ready}
	{#key scenario}
		{@const { backend, initSession, sectionHost } = mountAssessment(scenario)}
		<AssessmentShell {backend} {initSession} config={{ i18nProvider: config.i18nProvider, sectionHost }} />
	{/key}
{/if}
