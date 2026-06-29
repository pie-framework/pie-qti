<script lang="ts">
	import { onMount } from 'svelte';
	import { AssessmentPlayer, ReferenceBackendAdapter, toSectionComposition } from '@pie-qti/assessment-player';
	import { assignProps } from '@pie-qti/qti-common';
	import { MIXED_TOPICS_ASSESSMENT } from '$lib/sample-assessments';
	import { getSecurityConfig } from '$lib/player-config';

	type Status = 'booting' | 'registering' | 'registered' | 'rendered' | 'error';
	type SectionDelta = {
		sectionIdentifier: string;
		itemIdentifier: string;
		responseIdentifier: string;
		value: unknown;
	};

	let status = $state<Status>('booting');
	let message = $state<string>('Starting...');
	let el = $state<any | null>(null);
	let lastDelta = $state<SectionDelta | null>(null);

	async function waitForRender(timeoutMs: number) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const host = el ?? document.querySelector('pie-qti-section-player-vertical');
			if (host?.querySelector('pie-qti-item-player')) return true;
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
		return false;
	}

	async function buildComposition() {
		const security = getSecurityConfig();
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(MIXED_TOPICS_ASSESSMENT.assessment.identifier, MIXED_TOPICS_ASSESSMENT.assessment);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: {
				assessmentId: MIXED_TOPICS_ASSESSMENT.assessment.identifier,
				candidateId: 'wc-section-vertical-candidate',
			},
			role: 'candidate',
			security,
		});

		return toSectionComposition(player, { role: 'candidate', security });
	}

	onMount(async () => {
		try {
			status = 'registering';
			message = 'Registering web components...';

			await import('@pie-qti/web-component-loaders').then((module) => module.loadPieQtiPlayerElements());
			await customElements.whenDefined('pie-qti-section-player-vertical');

			status = 'registered';
			message = 'Web component registered. Rendering...';

			const host = el ?? document.querySelector('pie-qti-section-player-vertical');
			if (!host) throw new Error('Element not mounted');

			host.addEventListener('qti-section-response-delta', (event: Event) => {
				lastDelta = (event as CustomEvent<SectionDelta>).detail;
			});

			assignProps(host, {
				composition: await buildComposition(),
				security: getSecurityConfig(),
			});

			const ok = await waitForRender(35_000);
			if (!ok) throw new Error('Timeout waiting for section vertical to render');

			status = 'rendered';
			message = 'Rendered successfully.';
		} catch (error) {
			status = 'error';
			message = error instanceof Error ? error.message : String(error);
		}
	});
</script>

<svelte:head>
	<title>Web Component: Section Player Vertical</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-6 py-8 space-y-6">
	<div class="prose max-w-none">
		<h1>Web Component: Section Player Vertical</h1>
		<p>
			This route smoke-tests <code>&lt;pie-qti-section-player-vertical&gt;</code> with a section that renders item
			content without a shared passage pane.
		</p>
	</div>

	<div class="alert {status === 'error' ? 'alert-error' : status === 'rendered' ? 'alert-success' : 'alert-info'}">
		<div class="flex-1">
			<div class="font-semibold">Status: {status}</div>
			<div class="text-sm">{message}</div>
		</div>
	</div>

	{#if lastDelta}
		<pre data-testid="section-delta" class="mockup-code whitespace-pre-wrap p-4">{JSON.stringify(lastDelta)}</pre>
	{/if}

	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">Vertical Section</h2>
			<div class="bg-base-200 rounded-lg p-4 min-h-[260px]">
				<pie-qti-section-player-vertical bind:this={el} class="block w-full"></pie-qti-section-player-vertical>
			</div>
		</div>
	</div>
</div>
