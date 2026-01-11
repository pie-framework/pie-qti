<script lang="ts">
	import { ItemBody } from '@pie-qti/qti2-item-player/components';
	import { Player } from '@pie-qti/qti2-item-player';
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	import { onMount } from 'svelte';

	// Simple QTI 2.2 choice interaction XML
	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="choice-a11y-fixture"
                title="Choice Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse>
			<value>choice_b</value>
		</correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<p>Which planet is closest to the Sun?</p>
		<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
			<simpleChoice identifier="choice_a">Earth</simpleChoice>
			<simpleChoice identifier="choice_b">Mercury</simpleChoice>
			<simpleChoice identifier="choice_c">Venus</simpleChoice>
		</choiceInteraction>
	</itemBody>
</assessmentItem>`;

	let player = $state<Player | null>(null);
	let responses = $state<Record<string, any>>({ RESPONSE: null });
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
		Fixture for single choice interaction. Use arrow keys to navigate between options, Space/Enter
		to select. Radio button pattern with proper ARIA roles.
	</p>

	{#if mounted && player}
		<div class="qti-item-player">
			<ItemBody
				{player}
				{responses}
				disabled={false}
				onResponseChange={(id, value) => (responses = { ...responses, [id]: value })}
			/>
		</div>
	{/if}
</div>
