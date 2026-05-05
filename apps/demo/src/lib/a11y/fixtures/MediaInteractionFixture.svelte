<script lang="ts">
	// @ts-expect-error - Svelte-check can't resolve workspace subpath exports, but runtime works correctly
	import { ItemBody } from '@pie-qti/item-player/components';
	import { Player } from '@pie-qti/item-player';
	import type { InteractionResponseValue } from '@pie-qti/item-player/web-components';
	import { registerDefaultComponents } from '@pie-qti/default-components';
	import { onMount } from 'svelte';

	type FixtureResponseValue = InteractionResponseValue | null;
	type FixtureResponseMap = Record<string, FixtureResponseValue>;

	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="media-a11y-fixture"
                title="Media Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="integer"/>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<p>Listen to the sample audio and answer the question that follows.</p>
		<mediaInteraction responseIdentifier="RESPONSE" autostart="false" minPlays="1" maxPlays="2">
			<audio controls="controls">
				<source src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=" type="audio/wav"/>
			</audio>
		</mediaInteraction>
	</itemBody>
</assessmentItem>`;

	let player = $state<Player | null>(null);
	let responses = $state<FixtureResponseMap>({ RESPONSE: null });
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
		Fixture for media interaction controls, accessible names, and playback status text.
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
