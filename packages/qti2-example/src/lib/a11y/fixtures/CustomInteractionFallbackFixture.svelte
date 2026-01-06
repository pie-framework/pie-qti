<script lang="ts">
	import CustomInteractionFallback from '@pie-qti/qti2-default-components/shared/components/CustomInteractionFallback.svelte';

	let value = $state<string | null>(null);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for unsupported custom interactions (fallback UI + optional manual response field).
	</p>

	<CustomInteractionFallback
		responseId="CUST_1"
		prompt="Vendor-specific interaction prompt"
		rawAttributes={{ vendor: 'acme', interactionType: 'custom' }}
		xml="<customInteraction responseIdentifier=&quot;CUST_1&quot;/>"
		{value}
		onChange={(v) => (value = v)}
	/>
</div>


