<script lang="ts">
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/qti2-item-player/components';
	import { Player } from '@pie-qti/qti2-item-player';
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	import { onMount } from 'svelte';

	// QTI 2.2 extended text interaction XML
	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="extended-text-a11y-fixture"
                title="Extended Text Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<p>Write a short paragraph (3-5 sentences) describing your favorite season:</p>
		<extendedTextInteraction responseIdentifier="RESPONSE" expectedLength="200" expectedLines="5"/>
	</itemBody>
</assessmentItem>`;

	let player = $state<Player | null>(null);
	let responses = $state<Record<string, any>>({ RESPONSE: '' });
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
		Fixture for multi-line textarea/rich text editor. Full keyboard navigation within editor, proper
		ARIA labels, character count announcements, and form field accessibility.
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
