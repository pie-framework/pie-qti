<script lang="ts">
	import { ItemBody } from '@pie-qti/item-player/components';
	import { DemoItemSessionController } from '#lib/item-session.svelte.js';
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
		Fixture for a single-select hottext interaction, exposed as a radio group. Tab reaches the
		group once (the checked span, or the first); the arrow keys move between spans and check
		them, and Space or Enter checks the focused span. "Clear answer" retracts the selection.
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
