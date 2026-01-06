<script lang="ts">
	import InlineInteractionRenderer from '@pie-qti/qti2-default-components/shared/components/InlineInteractionRenderer.svelte';

	const html =
		'<p>Enter <strong>one</strong> value:</p> [TEXTENTRY:R1] <p>and pick:</p> [INLINECHOICE:R2]';

	const interactions = [
		{ responseId: 'R1', expectedLength: 10 },
		{
			responseId: 'R2',
			choices: [
				{ identifier: 'c1', text: 'First' },
				{ identifier: 'c2', text: 'Second' },
			],
		},
	];

	let responses = $state<Record<string, any>>({ R1: '', R2: '' });
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for inline native controls (text input + select) embedded in HTML.
	</p>

	<InlineInteractionRenderer
		{html}
		{interactions}
		{responses}
		onResponseChange={(id, value) => (responses = { ...responses, [id]: value })}
	/>
</div>


