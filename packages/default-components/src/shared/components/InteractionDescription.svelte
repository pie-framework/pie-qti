<script lang="ts">
	import type { InteractionAccessibility } from '@pie-qti/item-player';
	import { INTERACTION_DESCRIPTION_ID } from '../utils/interactionAria';

	let { interaction }: { interaction?: { accessibility?: InteractionAccessibility } | null } = $props();
</script>

{#if interaction?.accessibility?.description}
	<span id={INTERACTION_DESCRIPTION_ID} hidden>{interaction.accessibility.description}</span>
{/if}
