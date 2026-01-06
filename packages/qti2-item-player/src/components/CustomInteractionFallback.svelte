<script lang="ts">
	/**
	 * Fallback-only renderer for customInteraction.
	 *
	 * This does not execute custom logic; it provides visibility + optional manual response entry.
	 */

	interface Props {
		responseId: string;
		prompt?: string | null;
		rawAttributes?: Record<string, string>;
		xml?: string;
		disabled?: boolean;
		value?: string | null;
		onChange?: (value: string | null) => void;
		testIdInput?: string;
	}

	const {
		responseId,
		prompt = null,
		rawAttributes = {},
		xml = '',
		disabled = false,
		value = null,
		onChange,
		testIdInput,
	}: Props = $props();

	let open = $state(false);
	let manualValue = $state('');

	$effect(() => {
		manualValue = value ?? '';
	});

	function handleInput(e: Event) {
		manualValue = (e.currentTarget as HTMLTextAreaElement).value;
		onChange?.(manualValue || null);
	}
</script>

<div class="space-y-3">
	<div class="alert alert-warning">
		<div>
			<div class="font-semibold">Unsupported customInteraction</div>
			<div class="text-sm">
				This item contains a vendor-specific interaction. This player does not execute custom interactions.
			</div>
			{#if prompt}
				<div class="text-sm mt-2"><strong>Prompt:</strong> {prompt}</div>
			{/if}
		</div>
	</div>

	{#if onChange}
		<div class="form-control">
			<label class="label" for={`custom-${responseId}`}>
				<span class="label-text font-semibold">Manual response (optional)</span>
			</label>
			<textarea
				id={`custom-${responseId}`}
				data-testid={testIdInput}
				class="textarea textarea-bordered w-full"
				rows="3"
				placeholder="Enter a manual response (fallback)"
				value={manualValue}
				oninput={handleInput}
				disabled={disabled}
			></textarea>
		</div>
	{/if}

	<button type="button" class="btn btn-sm btn-outline" onclick={() => (open = !open)}>
		{open ? 'Hide' : 'Show'} details
	</button>

	{#if open}
		<div class="card bg-base-100 border border-base-300">
			<div class="card-body">
				<h3 class="card-title text-base">Details</h3>
				<div class="text-sm">
					<div class="font-semibold mb-1">Attributes</div>
					<pre class="text-xs bg-base-200 p-2 rounded overflow-auto">{JSON.stringify(rawAttributes, null, 2)}</pre>
				</div>
				{#if xml}
					<div class="text-sm">
						<div class="font-semibold mb-1">XML</div>
						<pre class="text-xs bg-base-200 p-2 rounded overflow-auto">{xml}</pre>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>


