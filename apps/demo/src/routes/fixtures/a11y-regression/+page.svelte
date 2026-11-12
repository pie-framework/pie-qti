<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { registerDefaultComponents } from '@pie-qti/default-components';
	import type { AssessmentItemDefinitionPlugin } from '@pie-qti/item-player';
	import { ItemPlayer } from '@pie-qti/item-player/components';
	import { A11Y_REGRESSION_FIXTURES } from './items';

	// The standalone ItemPlayer with the default interaction components and, deliberately, no
	// i18n provider: every candidate-facing string must still read as English.
	const plugins: readonly AssessmentItemDefinitionPlugin[] = [
		Object.freeze({
			kind: 'assessment-item-definition-plugin',
			name: '@pie-qti/demo-a11y-regression-fixture',
			version: '1.0.0',
			registerComponents: registerDefaultComponents,
		}),
	];

	// The query string exists in the browser only; the static build prerenders the shell.
	const fixtureId = $derived((browser ? page.url.searchParams.get('item') : null) ?? 'leaky-names');
	const itemXml = $derived(A11Y_REGRESSION_FIXTURES[fixtureId] ?? '');
	// The player shows its Submit button only when a submit handler is wired.
	let submissions = $state(0);
</script>

<h1 class="text-xl font-semibold mb-4">Accessibility regression</h1>
<button type="button" data-testid="a11y-focus-start">Before the item</button>
<main class="bg-base-100 p-4" data-testid="a11y-regression-root">
	{#key fixtureId}
		<ItemPlayer {itemXml} {plugins} onSubmit={() => (submissions += 1)} />
	{/key}
</main>
<p class="mt-4">Submissions: <span data-testid="submission-count">{submissions}</span></p>
