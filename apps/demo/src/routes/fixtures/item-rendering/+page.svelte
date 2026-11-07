<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { registerDefaultComponents } from '@pie-qti/default-components';
	import type { AssessmentItemDefinitionPlugin } from '@pie-qti/item-player';
	import { ItemPlayer } from '@pie-qti/item-player/components';
	import { ITEM_RENDERING_FIXTURES } from './items';

	// The standalone ItemPlayer with the default interaction components and, deliberately, no
	// i18n provider: every string must still read as English, never as a raw catalog key.
	const plugins: readonly AssessmentItemDefinitionPlugin[] = [
		Object.freeze({
			kind: 'assessment-item-definition-plugin',
			name: '@pie-qti/demo-item-rendering-fixture',
			version: '1.0.0',
			registerComponents: registerDefaultComponents,
		}),
	];

	// The query string exists in the browser only; the static build prerenders the shell.
	const fixtureId = $derived((browser ? page.url.searchParams.get('item') : null) ?? 'parts');
	const itemXml = $derived(ITEM_RENDERING_FIXTURES[fixtureId] ?? '');
	let submissions = $state(0);
</script>

<h1 class="text-xl font-semibold mb-4">Item rendering</h1>
<main class="bg-base-100 p-4" data-testid="item-rendering-fixture">
	{#key fixtureId}
		<ItemPlayer {itemXml} {plugins} onSubmit={() => (submissions += 1)} />
	{/key}
</main>
<p class="mt-4">Submissions: <span data-testid="submission-count">{submissions}</span></p>
