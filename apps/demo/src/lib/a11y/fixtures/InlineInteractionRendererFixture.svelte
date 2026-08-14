<script lang="ts">
	import { ItemBody } from '@pie-qti/item-player/components';
	import { DemoItemSessionController } from '$lib/item-session.svelte';
	import { onMount } from 'svelte';

	const qtiXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"
                identifier="inline-a11y-fixture"
                title="Inline Interaction A11y Fixture"
                adaptive="false"
                timeDependent="false">
	<responseDeclaration identifier="R1" cardinality="single" baseType="string"/>
	<responseDeclaration identifier="R2" cardinality="single" baseType="identifier"/>
	<itemBody>
		<p>
			Enter <strong>one</strong> value:
			<textEntryInteraction responseIdentifier="R1" expectedLength="10"/>
			and pick:
			<inlineChoiceInteraction responseIdentifier="R2">
				<inlineChoice identifier="c1">First</inlineChoice>
				<inlineChoice identifier="c2">Second</inlineChoice>
			</inlineChoiceInteraction>
		</p>
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
		Fixture for inline native controls (text input + select) rendered through ItemBody.
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
