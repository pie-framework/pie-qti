<script lang="ts">
	import { onMount } from 'svelte';
	import type { OrderInteractionData, MatchInteractionData, GapMatchInteractionData, GraphicGapMatchInteractionData } from '@pie-qti/item-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';

	let container: HTMLDivElement;
	let answers = $state<Record<string, unknown>>({});
	const order: OrderInteractionData = {
		type: 'orderInteraction', responseId: 'ORDER', prompt: 'Arrange the numbers.', shuffle: false, minChoices: 0, maxChoices: 3,
		choices: [{ identifier: 'one', text: 'One' }, { identifier: 'two', text: 'Two' }, { identifier: 'three', text: 'Three' }],
	};
	const match: MatchInteractionData = {
		type: 'matchInteraction', responseId: 'MATCH', prompt: 'Match each city to its country.', shuffle: false, maxAssociations: 2,
		sourceSet: [{ identifier: 'paris', text: 'Paris', matchMax: 1 }, { identifier: 'rome', text: 'Rome', matchMax: 1 }],
		targetSet: [{ identifier: 'france', text: 'France', matchMax: 1 }, { identifier: 'italy', text: 'Italy', matchMax: 1 }],
	};
	const gap: GapMatchInteractionData = {
		type: 'gapMatchInteraction', responseId: 'GAP', prompt: null, shuffle: false,
		promptText: '<p>The sky is [GAP:sky].</p>', gaps: [{ identifier: 'sky', index: 0 }],
		gapTexts: [{ identifier: 'blue', text: 'Blue', matchMax: 1 }, { identifier: 'green', text: 'Green', matchMax: 1 }],
	};
	const graphic: GraphicGapMatchInteractionData = {
		type: 'graphicGapMatchInteraction', responseId: 'GRAPHIC', prompt: 'Place the labels on the diagram.', maxAssociations: 2,
		imageData: { src: '', type: 'svg', width: '250', height: '160', content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 160"><rect width="250" height="160" fill="#e5e7eb"/></svg>' },
		gapTexts: [{ identifier: 'rain', text: 'Rain', matchMax: 1 }, { identifier: 'sun', text: 'Sun', matchMax: 1 }], gapImages: [],
		hotspots: [{ identifier: 'left', shape: 'circle', coords: '65,80,35', matchMax: 1 }, { identifier: 'right', shape: 'rect', coords: '150,45,220,115', matchMax: 1 }],
	};
	onMount(() => {
		let disposed = false;
		void loadPieQtiPlayerElements().then(() => {
			if (disposed) return;
			for (const [tag, interaction] of [['order', order], ['match', match], ['gap-match', gap], ['graphic-gap-match', graphic]] as const) {
				const element = document.createElement(`pie-qti-${tag}`);
				Object.assign(element, { interaction, i18n: new DefaultI18nProvider(), response: [] });
				element.addEventListener('qti-change', (event) => {
					const detail = (event as CustomEvent).detail;
					answers[detail.responseId] = detail.value;
				});
				container.querySelector(`[data-host="${tag}"]`)?.appendChild(element);
			}
		});
		return () => { disposed = true; container.querySelectorAll('[data-host]').forEach((host) => host.replaceChildren()); };
	});
</script>

<h1 class="text-xl font-semibold">Pointer interaction alternatives</h1>
<div bind:this={container} class="space-y-8" data-testid="a11y-fixture-root">
	<section aria-label="Ordering"><h2>Ordering</h2><div data-host="order"></div><output data-testid="ORDER">{JSON.stringify(answers.ORDER ?? [])}</output></section>
	<section aria-label="Matching"><h2>Matching</h2><div data-host="match"></div><output data-testid="MATCH">{JSON.stringify(answers.MATCH ?? [])}</output></section>
	<section aria-label="Gap matching"><h2>Gap matching</h2><div data-host="gap-match"></div><output data-testid="GAP">{JSON.stringify(answers.GAP ?? [])}</output></section>
	<section aria-label="Graphic gap matching"><h2>Graphic gap matching</h2><div data-host="graphic-gap-match"></div><output data-testid="GRAPHIC">{JSON.stringify(answers.GRAPHIC ?? [])}</output></section>
</div>
