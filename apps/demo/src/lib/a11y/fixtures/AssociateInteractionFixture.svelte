<script lang="ts">
	import { ItemBody } from '@pie-qti/item-player/components';
	import { DemoItemSessionController } from '$lib/item-session.svelte';
	import { onMount } from 'svelte';

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

	const itemSession = new DemoItemSessionController();
	let mounted = $state(false);

	onMount(() => {
		itemSession.open({
			itemXml: qtiXml,
			role: 'candidate',
		});
		mounted = true;
		return () => itemSession.dispose();
	});
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for associate interaction pairing, selected state, and remove-pair controls.
	</p>

	{#if mounted && itemSession.session}
		<div class="qti-item-player">
			<ItemBody
				session={itemSession.session}
				revision={itemSession.revision}
				disabled={false}
			/>
		</div>
	{/if}
</div>
