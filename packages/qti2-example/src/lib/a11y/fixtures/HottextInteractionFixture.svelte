<script lang="ts">
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/qti2-item-player/components';
	import { Player } from '@pie-qti/qti2-item-player';
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	import { onMount } from 'svelte';

	// QTI 2.2 hottext interaction XML
	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="hottext-a11y-fixture"
                title="Hottext Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
		<correctResponse>
			<value>verb</value>
		</correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<p>Select the verb in the following sentence:</p>
		<hottextInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<p>
				The <hottext identifier="det">the</hottext>
				<hottext identifier="noun">cat</hottext>
				<hottext identifier="verb">jumps</hottext>
				over the <hottext identifier="prep">over</hottext> fence.
			</p>
		</hottextInteraction>
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
		Fixture for hottext/text highlighting interaction. Use Tab to navigate between selectable text
		spans, Space/Enter to select. Selection state announced to screen readers with proper ARIA
		attributes.
	</p>

	{#if mounted && player}
		<div class="qti-item-player">
			<ItemBody
				{player}
				{responses}
				disabled={false}
				onResponseChange={(id: string, value: any) => (responses = { ...responses, [id]: value })}
			/>
		</div>
	{/if}
</div>
