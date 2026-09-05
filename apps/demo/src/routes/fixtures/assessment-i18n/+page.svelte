<script lang="ts">
	import { setContext } from 'svelte';
	import { DefaultI18nProvider, type I18nProvider } from '@pie-qti/i18n';
	import { ReferenceBackendAdapter, type BackendAssessmentPlayerConfig } from '@pie-qti/assessment-player';
	import { AssessmentShell } from '$assessment-components';
	import { READING_COMPREHENSION_ASSESSMENT } from '$lib/sample-assessments';

	let provider = $state<I18nProvider | null>(null);
	let config = $state<Partial<BackendAssessmentPlayerConfig>>({});
	setContext('i18n', { get value() { return provider; } });
	const assessment = READING_COMPREHENSION_ASSESSMENT.assessment;
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	async function loadFrench() {
		const french = new DefaultI18nProvider('fr-FR');
		await french.loadLocale('fr-FR');
		french.setLocale('fr-FR');
		provider = french;
	}
</script>

<h1 class="text-xl font-semibold mb-4">Assessment translation initialization</h1>
<div class="flex gap-2 mb-4">
	<button class="btn" onclick={loadFrench}>Load French translations</button>
	<button class="btn" onclick={() => { config = { i18nProvider: new DefaultI18nProvider('en-US') }; }}>Use explicit English provider</button>
</div>
<AssessmentShell {backend} initSession={{ assessmentId: assessment.identifier, candidateId: 'i18n-candidate' }} {config}/>
