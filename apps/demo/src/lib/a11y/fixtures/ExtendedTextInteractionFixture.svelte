<script lang="ts">
	import { ItemBody } from '@pie-qti/item-player/components';
	import { DemoItemSessionController } from '$lib/item-session.svelte';
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
		Fixture for multi-line textarea/rich text editor. Full keyboard navigation within editor, proper
		ARIA labels, character count announcements, and form field accessibility.
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
