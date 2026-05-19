<script lang="ts">
	import { ItemBody } from '@pie-qti/item-player/components';
	import { Player } from '@pie-qti/item-player';
	import type { InteractionResponseValue } from '@pie-qti/item-player/web-components';
	import { onMount } from 'svelte';

	type FixtureResponseValue = InteractionResponseValue | null;
	type FixtureResponseMap = Record<string, FixtureResponseValue>;

	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="inline-a11y-fixture"
                title="Inline Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="R1" cardinality="single" baseType="string"/>
	<responseDeclaration identifier="R2" cardinality="single" baseType="identifier"/>
	<itemBody>
		<p>
			Enter <strong>one</strong> value:
			<textEntryInteraction responseIdentifier="R1" expectedLength="10"/>
			and pick:
			<inlineChoiceInteraction responseIdentifier="R2">
				<inlineChoice identifier="c1">First</inlineChoice>
				<inlineChoice identifier="c2">Second</inlineChoice>
			</inlineChoiceInteraction>
		</p>
	</itemBody>
</assessmentItem>`;

	let player = $state<Player | null>(null);
	let responses = $state<FixtureResponseMap>({ R1: null, R2: null });
	let mounted = $state(false);

	onMount(() => {
		player = new Player({
			itemXml: qtiXml,
			role: 'candidate',
		});
		mounted = true;
	});
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for inline native controls (text input + select) rendered through ItemBody.
	</p>

	{#if mounted && player}
		<div class="qti-item-player">
			<ItemBody
				{player}
				{responses}
				disabled={false}
				onResponseChange={(id: string, value: FixtureResponseValue) =>
					(responses = { ...responses, [id]: value })}
			/>
		</div>
	{/if}
</div>
