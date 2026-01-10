<script lang="ts">
	import { Player } from '@pie-qti/qti2-item-player';
	import { registerDefaultComponents } from '@pie-qti/qti2-default-components';
	import ItemBody from '@pie-qti/qti2-default-components/shared/components/ItemBody.svelte';
	import { onMount } from 'svelte';

	// QTI 2.2 hotspot interaction XML with image map
	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd"
                identifier="hotspot-a11y-fixture"
                title="Hotspot Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
		<correctResponse>
			<value>hotspot_b</value>
		</correctResponse>
	</responseDeclaration>
	<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"/>
	<itemBody>
		<p>Select the circle in the center:</p>
		<hotspotInteraction responseIdentifier="RESPONSE" maxChoices="1">
			<object type="image/svg+xml" width="300" height="200" data="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgMjAwIiB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCI+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmZmZmZmYiLz4KICA8Y2lyY2xlIGN4PSI2MCIgY3k9IjEwMCIgcj0iMzAiIGZpbGw9IiNlNWU3ZWIiIHN0cm9rZT0iIzljYTNhZiIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPGNpcmNsZSBjeD0iMTUwIiBjeT0iMTAwIiByPSIzMCIgZmlsbD0iI2U1ZTdlYiIgc3Ryb2tlPSIjOWNhM2FmIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8Y2lyY2xlIGN4PSIyNDAiIGN5PSIxMDAiIHI9IjMwIiBmaWxsPSIjZTVlN2ViIiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIvPgogIDx0ZXh0IHg9IjYwIiB5PSIxMDUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMxMTE4MjciPkE8L3RleHQ+CiAgPHRleHQgeD0iMTUwIiB5PSIxMDUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMxMTE4MjciPkI8L3RleHQ+CiAgPHRleHQgeD0iMjQwIiB5PSIxMDUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMxMTE4MjciPkM8L3RleHQ+Cjwvc3ZnPg==">
				Diagram with three circles labeled A, B, and C
			</object>
			<hotspotChoice identifier="hotspot_a" shape="circle" coords="60,100,30">Circle A (left)</hotspotChoice>
			<hotspotChoice identifier="hotspot_b" shape="circle" coords="150,100,30">Circle B (center)</hotspotChoice>
			<hotspotChoice identifier="hotspot_c" shape="circle" coords="240,100,30">Circle C (right)</hotspotChoice>
		</hotspotInteraction>
	</itemBody>
</assessmentItem>`;

	let player = $state<Player | null>(null);
	let responses = $state<Record<string, any>>({ RESPONSE: [] });
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
		Fixture for hotspot/image map interaction. Use Tab to navigate between hotspot regions,
		Space/Enter to select. Each hotspot has accessible label and is keyboard accessible.
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
