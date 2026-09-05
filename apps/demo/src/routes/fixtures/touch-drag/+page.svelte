<script lang="ts">
	import { onMount } from 'svelte';
	import type { OrderInteractionData } from '@pie-qti/item-player';
	import { DefaultI18nProvider } from '@pie-qti/i18n';
	import { loadPieQtiPlayerElements } from '@pie-qti/web-component-loaders';

	let container: HTMLDivElement;
	let response = $state<string[]>([]);
	let changeCount = $state(0);
	const interaction: OrderInteractionData = {
		type: 'orderInteraction', responseId: 'ORDER', prompt: 'Put the numbers in order.', shuffle: false, minChoices: 0, maxChoices: 3,
		choices: [{ identifier: 'one', text: 'One' }, { identifier: 'two', text: 'Two' }, { identifier: 'three', text: 'Three' }],
	};
	onMount(() => {
		let disposed = false;
		void loadPieQtiPlayerElements().then(() => {
			if (disposed) return;
			const nested = new URLSearchParams(window.location.search).get('nested') === 'true';
			const host = document.createElement('div');
			container.appendChild(host);
			const target = nested ? host.attachShadow({ mode: 'open' }) : host;
			const element = document.createElement('pie-qti-order');
			Object.assign(element, { interaction, response: [], i18n: new DefaultI18nProvider() });
			element.addEventListener('qti-change', (event) => {
				response = (event as CustomEvent).detail.value;
				changeCount += 1;
			});
			target.appendChild(element);
		});
		return () => { disposed = true; container.replaceChildren(); };
	});
</script>

<h1 class="text-xl font-semibold mb-4">Touch drag through shadow DOM</h1>
<div bind:this={container}></div>
<output data-testid="response">{JSON.stringify(response)}</output>
<p data-testid="change-count">Changes: {changeCount}</p>
