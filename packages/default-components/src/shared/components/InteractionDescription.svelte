<script lang="ts">
	import type { InteractionAccessibility } from '@pie-qti/item-player';
	import { interactionDescriptionId } from '../utils/interactionAria';

	let { interaction }: { interaction?: { accessibility?: InteractionAccessibility } | null } = $props();

	// Same helper the root's `interactionAria()` uses, keyed by this interaction object,
	// so the reference and the target stay in step even in a composite item where several
	// interactions each carry their own description.
	const descriptionId = $derived(interactionDescriptionId(interaction));
</script>

{#if descriptionId}
	<span id={descriptionId} hidden>{interaction?.accessibility?.description}</span>
{/if}
