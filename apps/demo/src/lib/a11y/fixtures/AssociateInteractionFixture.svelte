<script lang="ts">
	import { ItemBody } from '@pie-qti/item-player/components';
	import { Player } from '@pie-qti/item-player';
	import type { InteractionResponseValue } from '@pie-qti/item-player/web-components';
	import { registerDefaultComponents } from '@pie-qti/default-components';
	import { onMount } from 'svelte';

	type FixtureResponseValue = InteractionResponseValue | null;
	type FixtureResponseMap = Record<string, FixtureResponseValue>;

	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="associate-a11y-fixture"
                title="Associate Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="pair"/>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<p>Associate each animal with its habitat.</p>
		<associateInteraction responseIdentifier="RESPONSE" maxAssociations="2">
			<simpleAssociableChoice identifier="fox" matchMax="1">Fox</simpleAssociableChoice>
			<simpleAssociableChoice identifier="forest" matchMax="1">Forest</simpleAssociableChoice>
			<simpleAssociableChoice identifier="fish" matchMax="1">Fish</simpleAssociableChoice>
			<simpleAssociableChoice identifier="river" matchMax="1">River</simpleAssociableChoice>
		</associateInteraction>
	</itemBody>
</assessmentItem>`;

	let player = $state<Player | null>(null);
	let responses = $state<FixtureResponseMap>({ RESPONSE: [] });
	let mounted = $state(false);

	onMount(() => {
		const newPlayer = new Player({
			itemXml: qtiXml,
			role: 'candidate',
		});
		registerDefaultComponents(newPlayer.getComponentRegistry());
		player = newPlayer;
		mounted = true;
	});
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for associate interaction pairing, selected state, and remove-pair controls.
	</p>

	{#if mounted && player}
		<div class="qti-item-player">
			<ItemBody
				{player}
				{responses}
				disabled={false}
				onResponseChange={(id: string, value: FixtureResponseValue) => (responses = { ...responses, [id]: value })}
			/>
		</div>
	{/if}
</div>
