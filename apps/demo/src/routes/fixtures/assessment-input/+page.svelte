<script lang="ts">
	import { onMount } from 'svelte';
	import { ReferenceBackendAdapter, type SecureAssessment } from '@pie-qti/assessment-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import type { QtiAssessmentPlayerElement } from '@pie-qti/player-elements';
	import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';

	let target: HTMLDivElement;
	const assessment: SecureAssessment = {
		identifier: 'input-continuity', title: 'Input continuity',
		navigationMode: 'nonlinear', submissionMode: 'simultaneous',
		testParts: [{ identifier: 'part', sections: [{
			identifier: 'section', visible: true,
			assessmentItemRefs: [{
				identifier: 'entry', role: 'candidate',
				itemXml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="entry" title="Text entry" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody><p>Type the word water: <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="10"/></p></itemBody>
</assessmentItem>`,
			}, {
				identifier: 'order', role: 'candidate',
				itemXml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="order" title="Ordering" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier"/>
  <itemBody><orderInteraction responseIdentifier="RESPONSE" shuffle="false"><prompt>Arrange these numbers in order.</prompt><simpleChoice identifier="one">One</simpleChoice><simpleChoice identifier="two">Two</simpleChoice><simpleChoice identifier="three">Three</simpleChoice></orderInteraction></itemBody>
</assessmentItem>`,
			}],
		}] }],
	};

	onMount(() => {
		let disposed = false;
		let element: QtiAssessmentPlayerElement | undefined;
		void (async () => {
			await loadPieQtiPlayerElements();
			if (disposed) return;
			const backend = new ReferenceBackendAdapter();
			backend.registerAssessment(assessment.identifier, assessment);
			element = document.createElement('pie-qti-assessment-player') as QtiAssessmentPlayerElement;
			element.config = { i18nProvider: new DefaultI18nProvider() };
			element.backend = backend;
			element.initSession = { assessmentId: assessment.identifier, candidateId: 'input-candidate' };
			target.appendChild(element);
		})();
		return () => { disposed = true; element?.remove(); };
	});
</script>

<h1 class="text-xl font-semibold mb-4">Assessment input continuity</h1>
<div bind:this={target}></div>
