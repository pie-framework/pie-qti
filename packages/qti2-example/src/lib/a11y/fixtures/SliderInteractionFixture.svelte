<script lang="ts">
	import { ItemBody } from '@pie-qti/qti2-item-player/components';
	import { Player } from '@pie-qti/qti2-item-player';
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	import { onMount } from 'svelte';

	// QTI 2.2 slider interaction XML
	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="slider-a11y-fixture"
                title="Slider Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer">
		<correctResponse>
			<value>75</value>
		</correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<p>Use the slider to select a value between 0 and 100:</p>
		<sliderInteraction responseIdentifier="RESPONSE" lowerBound="0" upperBound="100" step="5"/>
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
		Fixture for slider/range input. Use arrow keys (left/right or up/down) to adjust value, Home/End
		keys for min/max, Page Up/Down for large steps. Value changes announced to screen readers.
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
