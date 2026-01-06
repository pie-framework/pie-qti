<script lang="ts">
	
	import type { InitSessionRequest, SecureAssessment, SecureItemRef, SecureSection, SecureTestPart } from '@pie-qti/qti2-assessment-player';
	import { ReferenceBackendAdapter } from '@pie-qti/qti2-assessment-player';
import AssessmentShell from '@pie-qti/qti2-assessment-player/components/AssessmentShell.svelte';
	import { typesetMathInElement } from '@pie-qti/qti2-typeset-katex';

	const {
		assessmentTestXml,
		items = {},
		config = {},
		identifier = 'assessment',
		title
	}: {
		assessmentTestXml: string;
		items?: Record<string, string>;
		config?: {
			role?: 'candidate' | 'scorer' | 'author' | 'tutor' | 'proctor' | 'testConstructor';
			/** Optional override for UI behavior; otherwise parsed from <testPart navigationMode>. */
			navigationMode?: 'linear' | 'nonlinear';
			showSections?: boolean;
		};
		identifier?: string;
		title?: string;
	} = $props();

	let _error = $state<string | null>(null);
	let assessment = $state<SecureAssessment | null>(null);
	let initSession = $state<InitSessionRequest>({
		assessmentId: identifier,
		candidateId: 'transform-app',
	});

	// Demo-only backend adapter. Production apps should provide a real backend adapter.
	const backend = new ReferenceBackendAdapter();

	// Parse the assessment test XML and convert to SecureAssessment format
	$effect(() => {
		try {
			_error = null;

			if (!assessmentTestXml || assessmentTestXml.trim() === '') {
				_error = 'No assessment test XML provided';
				assessment = null;
				return;
			}

			// Parse the XML to create a SecureAssessment structure
			const parser = new DOMParser();
			const doc = parser.parseFromString(assessmentTestXml, 'text/xml');

			const assessmentTestEl = doc.querySelector('assessmentTest');
			if (!assessmentTestEl) {
				throw new Error('No assessmentTest element found in XML');
			}

			const testIdentifier = assessmentTestEl.getAttribute('identifier') || identifier;
			const testTitle = assessmentTestEl.getAttribute('title') || title || 'Assessment';

			// Build the assessment structure
			const testParts: SecureTestPart[] = [];
			const testPartEls = assessmentTestEl.querySelectorAll('testPart');

			let parsedNavMode: 'linear' | 'nonlinear' = 'nonlinear';
			let parsedSubmissionMode: 'individual' | 'simultaneous' = 'individual';

			testPartEls.forEach((testPartEl, idx) => {
				const testPartId = testPartEl.getAttribute('identifier') || 'part-1';
				const navMode = (testPartEl.getAttribute('navigationMode') || 'nonlinear') as 'linear' | 'nonlinear';
				const submissionMode = (testPartEl.getAttribute('submissionMode') || 'individual') as 'individual' | 'simultaneous';

				if (idx === 0) {
					parsedNavMode = navMode;
					parsedSubmissionMode = submissionMode;
				}

				const sections: SecureSection[] = [];
				const sectionEls = testPartEl.querySelectorAll('assessmentSection');

				sectionEls.forEach((sectionEl) => {
					const sectionId = sectionEl.getAttribute('identifier') || 'section-1';
					const sectionTitle = sectionEl.getAttribute('title') || 'Section';
					const sectionVisible = sectionEl.getAttribute('visible') !== 'false';

					const itemRefs: SecureItemRef[] = [];
					const itemRefEls = sectionEl.querySelectorAll('assessmentItemRef');

					itemRefEls.forEach((itemRefEl) => {
						const itemId = itemRefEl.getAttribute('identifier') || '';
						const href = itemRefEl.getAttribute('href') || '';
						const required = itemRefEl.getAttribute('required') === 'true';

						// Try to resolve the item XML from the items map
						const itemXml = items[itemId] || items[href] || '';

						itemRefs.push({
							identifier: itemId,
							itemXml,
							role: config.role || 'candidate',
							required,
						});
					});

					sections.push({
						identifier: sectionId,
						title: sectionTitle,
						visible: sectionVisible,
						items: itemRefs
					});
				});

				testParts.push({
					identifier: testPartId,
					sections
				});
			});

			assessment = {
				identifier: testIdentifier,
				title: testTitle,
				navigationMode: config.navigationMode ?? parsedNavMode,
				submissionMode: parsedSubmissionMode,
				testParts,
			};

			// Register assessment with reference backend so the shell can init a session.
			backend.registerAssessment(testIdentifier, assessment);
			initSession = {
				assessmentId: testIdentifier,
				candidateId: 'transform-app',
			};
		} catch (err) {
			console.error('Failed to parse assessment test XML:', err);
			_error = err instanceof Error ? err.message : 'Failed to parse assessment test XML';
			assessment = null;
		}
	});
</script>

{#if _error}
	<div class="alert alert-error">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="stroke-current shrink-0 h-6 w-6"
			fill="none"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
		<span>Error loading QTI assessment player: {_error}</span>
	</div>
{:else if !assessment}
	<div class="flex items-center justify-center p-8">
		<span class="loading loading-spinner loading-lg"></span>
		<span class="ml-4">Loading QTI assessment player...</span>
	</div>
{:else}
	<div class="w-full min-h-[400px]">
		<AssessmentShell
			{backend}
			{initSession}
			config={{
				role: config.role || 'candidate',
				showSections: config.showSections !== false,
				allowSectionNavigation: true,
				showProgress: true,
			}}
			typeset={typesetMathInElement}
		/>
	</div>
{/if}
