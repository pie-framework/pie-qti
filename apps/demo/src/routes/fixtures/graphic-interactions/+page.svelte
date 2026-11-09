<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { registerDefaultComponents } from '@pie-qti/default-components';
	import type { AssessmentItemDefinitionPlugin } from '@pie-qti/item-player';
	import { ItemPlayer } from '@pie-qti/item-player/components';
	import { GRAPHIC_INTERACTION_FIXTURES } from './items';

	// The standalone ItemPlayer with the default interaction components, as the
	// accessibility regression fixture mounts it.
	const plugins: readonly AssessmentItemDefinitionPlugin[] = [
		Object.freeze({
			kind: 'assessment-item-definition-plugin',
			name: '@pie-qti/demo-graphic-interactions-fixture',
			version: '1.0.0',
			registerComponents: registerDefaultComponents,
		}),
	];

	// The query string exists in the browser only; the static build prerenders the shell.
	const fixtureId = $derived((browser ? page.url.searchParams.get('item') : null) ?? 'hotspot-multiple');
	const itemXml = $derived(GRAPHIC_INTERACTION_FIXTURES[fixtureId] ?? '');
	// The last value the interaction reported, and the score of the last submission.
	let lastResponse = $state('');
	let score = $state('');
</script>

<h1 class="text-xl font-semibold mb-4">Graphic interactions</h1>
<section class="bg-base-100 p-4" data-testid="graphic-interactions-root" aria-label="Item">
	{#key fixtureId}
		<ItemPlayer
			{itemXml}
			{plugins}
			onResponseChange={(_responseId, value) => (lastResponse = JSON.stringify(value ?? null))}
			onSubmit={(_responses, result) => (score = String(result.score))}
		/>
	{/key}
</section>
<p class="mt-4">Response: <output data-testid="response">{lastResponse}</output></p>
<p>Score: <output data-testid="score">{score}</output></p>
