<script lang="ts">
	import { onMount } from 'svelte';
	import { AssessmentPlayer, ReferenceBackendAdapter, toSectionComposition } from '@pie-qti/assessment-player';
	import { assignProps } from '@pie-qti/qti-common';
	import type { ResolvedQtiSectionComposition, QtiSectionToolConfig } from '@pie-qti/section-player';
	import { SAMPLE_ASSESSMENTS } from '$lib/sample-assessments';
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

	const sample = SAMPLE_ASSESSMENTS.find((assessment) => assessment.id === 'interaction-showcase-1');
	const expectedText = 'Reading Passage';
	const pollyTtsProvider = {
		backend: 'polly',
		serverProvider: 'polly',
		apiEndpoint: '/api/tts',
		transportMode: 'pie',
		endpointMode: 'synthesizePath',
		defaultVoice: 'Joanna',
		language: 'en-US',
		engine: 'standard',
		format: 'mp3',
		speechMarksMode: 'word',
	};
	const passageTools: QtiSectionToolConfig[] = [{ toolId: 'textToSpeech', label: 'Read passage', provider: pollyTtsProvider }];
	const itemTools: QtiSectionToolConfig[] = [
		{ toolId: 'textToSpeech', label: 'Read question', provider: pollyTtsProvider },
		{ toolId: 'calculator', label: 'Calculator', renderParams: { calculatorType: 'scientific' } },
	];

	function deepText(root: Node | null | undefined): string {
		if (!root) return '';
		if (root.nodeType === Node.TEXT_NODE) return root.textContent ?? '';
		let text = '';
		for (const child of root.childNodes) text += deepText(child);
		if (root instanceof Element && root.shadowRoot) text += deepText(root.shadowRoot);
		return text;
	}

	async function waitForRender(timeoutMs: number) {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const host = el ?? document.querySelector('pie-qti-section-player-splitpane');
			if (host?.querySelector('pie-qti-item-player') && deepText(host).includes(expectedText)) return true;
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
		return false;
	}

	function withDemoTools(composition: ResolvedQtiSectionComposition): ResolvedQtiSectionComposition {
		const activeItem = { ...composition.activeItem, tools: itemTools };
		const itemRefs = composition.section.itemRefs.map((item) =>
			item.identifier === activeItem.identifier ? { ...item, tools: itemTools } : item,
		);
		const sharedContext = {
			...composition.sharedContext,
			passages: composition.sharedContext.passages.map((passage) => ({ ...passage, tools: passageTools })),
		};

		return {
			...composition,
			activeItem,
			sharedContext,
			section: {
				...composition.section,
				itemRefs,
				sharedContext,
			},
		};
	}

	async function buildComposition() {
		if (!sample) throw new Error('Interaction showcase sample not found');

		const security = getSecurityConfig();
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(sample.assessment.identifier, sample.assessment);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: {
				assessmentId: sample.assessment.identifier,
				candidateId: 'wc-section-splitpane-candidate',
			},
			role: 'candidate',
			security,
		});

		return withDemoTools(toSectionComposition(player, {
			role: 'candidate',
			security,
			passageTools,
			itemTools,
		}));
	}

	onMount(async () => {
		try {
			status = 'registering';
			message = 'Registering web components...';

			await import('@pie-qti/web-component-loaders').then((module) => module.loadPieQtiPlayerElements());
			await customElements.whenDefined('pie-qti-section-player-splitpane');

			status = 'registered';
			message = 'Web component registered. Rendering...';

			const host = el ?? document.querySelector('pie-qti-section-player-splitpane');
			if (!host) throw new Error('Element not mounted');

			host.addEventListener('qti-section-response-delta', (event: Event) => {
				lastDelta = (event as CustomEvent<SectionDelta>).detail;
			});

			assignProps(host, {
				composition: await buildComposition(),
				security: getSecurityConfig(),
			});

			const ok = await waitForRender(35_000);
			if (!ok) throw new Error('Timeout waiting for section split-pane to render');

			status = 'rendered';
			message = 'Rendered successfully.';
		} catch (error) {
			status = 'error';
			message = error instanceof Error ? error.message : String(error);
		}
	});
</script>

<svelte:head>
	<title>Web Component: Section Player Split Pane</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-6 py-8">
	{#if status === 'error'}
		<div class="alert alert-error mb-4">
			<div class="flex-1">
				<div class="font-semibold">Section player failed to render</div>
				<div class="text-sm">{message}</div>
			</div>
		</div>
	{/if}

	<pie-qti-section-player-splitpane bind:this={el} class="block w-full"></pie-qti-section-player-splitpane>

	{#if lastDelta}
		<pre data-testid="section-delta" class="hidden">{JSON.stringify(lastDelta)}</pre>
	{/if}
</div>
