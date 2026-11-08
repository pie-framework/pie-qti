<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ReferenceBackendAdapter,
		type BackendAdapter,
		type SaveAssessmentStateRequest,
		type SaveAssessmentStateResponse,
		type SecureAssessment,
	} from '@pie-qti/assessment-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import { AssessmentShell } from '$assessment-components';

	/**
	 * Fixture for autosave and resume flows.
	 *
	 * `?resume=1` resumes the adapter's latest stored draft instead of starting a new
	 * session; `?autosave=off` disables autosave (no indicator, no drafts);
	 * `?save-fails=1` fails the first two `saveState` calls so the "Not saved"
	 * indicator state can be observed. The candidate can type an answer, flag a
	 * question and hide the countdown — everything a reload restores.
	 */

	const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

	const choiceItem = (identifier: string, prompt: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${prompt}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>${prompt}</p><choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1"><simpleChoice identifier="A">Alpha</simpleChoice><simpleChoice identifier="B">Beta</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

	const entryItem = (identifier: string, prompt: string) =>
		`<assessmentItem ${NS} identifier="${identifier}" title="${prompt}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody><p>${prompt}</p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="12"/></itemBody>
</assessmentItem>`;

	const ASSESSMENT: SecureAssessment = {
		identifier: 'autosave-resume',
		title: 'Autosave resume check',
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
							{ identifier: 'q1', role: 'candidate', itemXml: entryItem('q1', 'Type your favourite word.') },
							{ identifier: 'q2', role: 'candidate', itemXml: choiceItem('q2', 'Question two') },
							{ identifier: 'q3', role: 'candidate', itemXml: choiceItem('q3', 'Question three') },
						],
					},
				],
			},
		],
	};

	let ready = $state(false);
	let resume = $state(false);
	let autosaveOff = $state(false);
	let saveFails = $state(false);
	let saveEvents = $state(0);
	let saveFailures = $state(0);
	let completed = $state(false);

	const config = { i18nProvider: new DefaultI18nProvider() };

	class AutosaveFixtureBackend extends ReferenceBackendAdapter {
		#failuresLeft = 0;
		override async initSession(...args: Parameters<BackendAdapter['initSession']>) {
			this.#failuresLeft = saveFails ? 2 : 0;
			return super.initSession(...args);
		}
		override async saveState(request: SaveAssessmentStateRequest): Promise<SaveAssessmentStateResponse> {
			saveEvents += 1;
			if (this.#failuresLeft > 0) {
				this.#failuresLeft -= 1;
				saveFailures += 1;
				throw new Error('Storage unavailable');
			}
			return super.saveState(request);
		}
	}

	function mountAssessment() {
		const backend = new AutosaveFixtureBackend();
		backend.registerAssessment(ASSESSMENT.identifier, ASSESSMENT);
		const initSession: { assessmentId: string; candidateId: string; resumeSessionId?: string } = {
			assessmentId: ASSESSMENT.identifier,
			candidateId: 'autosave-candidate',
		};
		if (resume) {
			const stored = backend.latestSessionId(ASSESSMENT.identifier, initSession.candidateId);
			if (stored) initSession.resumeSessionId = stored;
		}
		return { backend, initSession };
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		resume = params.get('resume') === '1';
		autosaveOff = params.get('autosave') === 'off';
		saveFails = params.get('save-fails') === '1';
		ready = true;
	});
</script>

<h1 class="text-xl font-semibold mb-4">Assessment autosave and resume</h1>
<p class="mb-2 text-sm" data-testid="autosave-scenario">
	resume={resume} autosaveOff={autosaveOff} saveFails={saveFails}
</p>
<p class="mb-4 text-sm" data-testid="host-save-events">Host save events: {saveEvents}; failures: {saveFailures}</p>
{#if completed}<p role="status">Assessment completed</p>{/if}
{#if ready}
	{@const props = mountAssessment()}
	<AssessmentShell
		{...props}
		{config}
		autosave={autosaveOff ? false : undefined}
		autosaveIntervalMs={300}
		onSubmit={() => {
			completed = true;
		}}
	/>
{/if}
