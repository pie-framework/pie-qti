<script lang="ts">
	import { onMount } from 'svelte';
	import { READING_COMPREHENSION_ASSESSMENT } from '$lib/sample-assessments';
	import { getSecurityConfig } from '$lib/player-config';

	let status = $state<'booting' | 'registering' | 'registered' | 'rendered' | 'error'>('booting');
	let message = $state<string>('Starting…');
	let el = $state<any | null>(null);

	// Build a minimal QTI assessmentTest XML that references item hrefs we can resolve from an in-memory map.
	const testParts = READING_COMPREHENSION_ASSESSMENT.assessment?.testParts ?? [];
	const q1 = testParts[0]?.sections?.[0]?.questionRefs?.[0];
	const q2 = testParts[0]?.sections?.[0]?.questionRefs?.[1];
	const q3 = testParts[0]?.sections?.[0]?.questionRefs?.[2];

	const items: Record<string, string> = {
		'q1.xml': q1?.itemXml ?? '',
		'q2.xml': q2?.itemXml ?? '',
		'q3.xml': q3?.itemXml ?? '',
		// also allow resolving via identifier
		[q1?.identifier ?? 'q1']: q1?.itemXml ?? '',
		[q2?.identifier ?? 'q2']: q2?.itemXml ?? '',
		[q3?.identifier ?? 'q3']: q3?.itemXml ?? '',
	};

	const assessmentTestXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
  identifier="READING-COMP-001"
  title="Reading Comprehension: The Water Cycle">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="The Water Cycle" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml" />
      <assessmentItemRef identifier="q2" href="q2.xml" />
      <assessmentItemRef identifier="q3" href="q3.xml" />
    </assessmentSection>
  </testPart>
</assessmentTest>`;

	const expectedText = 'The Water Cycle';

	async function waitForRender(timeoutMs: number) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const text = (el?.textContent ?? '') + (el?.shadowRoot?.textContent ?? '');
			if (text.includes(expectedText)) return true;
			await new Promise((r) => setTimeout(r, 150));
		}
		return false;
	}

	onMount(async () => {
		try {
			status = 'registering';
			message = 'Registering web components…';

			await import('@pie-qti/web-component-loaders').then((m) => m.loadPieQtiPlayerElements());
			await customElements.whenDefined('pie-qti2-assessment-player');

			status = 'registered';
			message = 'Web component registered. Rendering…';

			if (!el) throw new Error('Element not mounted');

			el.assessmentTestXml = assessmentTestXml;
			el.items = items;
			el.config = { role: 'candidate', navigationMode: 'nonlinear', showSections: true };
			el.security = getSecurityConfig();

			const ok = await waitForRender(10000);
			if (!ok) throw new Error('Timeout waiting for assessment to render');

			status = 'rendered';
			message = 'Rendered successfully.';
		} catch (e) {
			status = 'error';
			message = e instanceof Error ? e.message : String(e);
		}
	});
</script>

<svelte:head>
	<title>Web Component: Assessment Player</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-6 py-8 space-y-6">
	<div class="prose max-w-none">
		<h1>Web Component: Assessment Player</h1>
		<p>
			This route is a <em>smoke test</em> for the <strong>custom element integration path</strong> of the assessment player.
			It proves that:
		</p>
		<ul>
			<li>
				<strong>Registration works</strong>: <code>@pie-qti/web-component-loaders</code> registers
				<code>&lt;pie-qti2-assessment-player&gt;</code> via <code>customElements</code>.
			</li>
			<li>
				<strong>Assessment wiring works</strong>: the host can provide <code>assessmentTestXml</code> plus an
				in-memory <code>items</code> map for resolving <code>&lt;assessmentItemRef href&gt;</code>.
			</li>
			<li>
				<strong>Rendering works</strong>: the element renders the expected section title text (checked in both light DOM
				and shadow DOM).
			</li>
		</ul>
		<p class="text-sm opacity-70">
			This does <strong>not</strong> aim to prove full end-to-end assessment navigation/scoring, network fetching, or deployment.
			Use <code>/assessment-demo</code> for a richer UI flow and fixtures.
		</p>
	</div>

	<div class="alert {status === 'error' ? 'alert-error' : status === 'rendered' ? 'alert-success' : 'alert-info'}">
		<div class="flex-1">
			<div class="font-semibold">Status: {status}</div>
			<div class="text-sm">{message}</div>
		</div>
	</div>

	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">Player</h2>
			<p class="text-sm text-base-content/70">Expected text: <strong>{expectedText}</strong></p>

			<div class="bg-base-200 rounded-lg p-4 min-h-[240px]">
				<pie-qti2-assessment-player bind:this={el} class="block w-full"></pie-qti2-assessment-player>
			</div>
		</div>
	</div>
</div>


