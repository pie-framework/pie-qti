<script lang="ts">
	/**
	 * Fallback-only renderer for customInteraction.
	 *
	 * This does not execute custom logic; it provides visibility + optional manual response entry.
	 */

	import type { I18nProvider } from '@pie-qti/qti2-i18n';

	interface Props {
		responseId: string;
		prompt?: string | null;
		rawAttributes?: Record<string, string>;
		xml?: string;
		disabled?: boolean;
		value?: string | null;
		onChange?: (value: string | null) => void;
		testIdInput?: string;
		i18n?: I18nProvider;
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
		i18n,
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

<div part="root" class="qti-custom-fallback space-y-3">
	<div part="warning" class="qti-custom-warning alert alert-warning">
		<div>
			<div class="font-semibold">{i18n?.t('interactions.custom.unsupported') ?? 'Unsupported customInteraction'}</div>
			<div class="text-sm">
				This item contains a vendor-specific interaction. This player does not execute custom interactions.
			</div>
			{#if prompt}
				<div class="text-sm mt-2"><strong>Prompt:</strong> {prompt}</div>
			{/if}
		</div>
	</div>

	{#if onChange}
		<div part="manual" class="qti-custom-manual form-control">
			<label part="manual-label" class="qti-custom-manual-label label" for={`custom-${responseId}`}>
				<span class="label-text font-semibold">{i18n?.t('interactions.custom.manualResponse') ?? 'Manual response (optional)'}</span>
			</label>
			<textarea
				id={`custom-${responseId}`}
				data-testid={testIdInput}
				part="manual-input"
				class="qti-custom-manual-input textarea textarea-bordered w-full"
				rows="3"
				placeholder={i18n?.t('interactions.custom.placeholder') ?? 'Enter a manual response (fallback)'}
				value={manualValue}
				oninput={handleInput}
				disabled={disabled}
			></textarea>
		</div>
	{/if}

	<button part="toggle" type="button" class="qti-custom-toggle btn btn-sm btn-outline" onclick={() => (open = !open)}>
		{open ? 'Hide' : 'Show'} details
	</button>

	{#if open}
		<div part="details" class="qti-custom-details card bg-base-100 border border-base-300">
			<div class="qti-custom-details-body card-body">
				<h3 part="details-title" class="qti-custom-details-title card-title text-base">Details</h3>
				<div class="text-sm">
					<div class="font-semibold mb-1">{i18n?.t('interactions.custom.attributes') ?? 'Attributes'}</div>
					<pre part="attributes" class="qti-custom-pre text-xs bg-base-200 p-2 rounded overflow-auto">{JSON.stringify(rawAttributes, null, 2)}</pre>
				</div>
				{#if xml}
					<div class="text-sm">
						<div class="font-semibold mb-1">XML</div>
						<pre part="xml" class="qti-custom-pre text-xs bg-base-200 p-2 rounded overflow-auto">{xml}</pre>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-custom-fallback {
		display: grid;
		gap: 0.75rem;
		/* Ensure readable defaults even if the host sets a dark foreground color */
		color: var(--color-base-content, oklch(21% 0 0));
	}
	.qti-custom-warning,
	.qti-custom-details,
	.qti-custom-manual {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		border-radius: 0.75rem;
		background: var(--color-base-200, oklch(98% 0 0));
		padding: 0.75rem;
	}
	.qti-custom-details {
		background: var(--color-base-100, oklch(100% 0 0));
	}
	.qti-custom-manual-label {
		display: block;
		margin-bottom: 0.25rem;
	}
	/* Override ShadowBaseStyles' DaisyUI-ish label text color to meet WCAG contrast. */
	.qti-custom-manual .label-text {
		color: var(--color-base-content, oklch(21% 0 0));
	}
	.qti-custom-manual-input {
		width: 100%;
		min-height: 4.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-100, oklch(100% 0 0));
		color: var(--color-base-content, oklch(21% 0 0));
	}
	.qti-custom-toggle {
		align-self: start;
	}
	.qti-custom-details-body {
		padding: 0.75rem;
	}
	.qti-custom-pre {
		background: var(--color-base-200, oklch(98% 0 0));
		border-radius: 0.5rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		padding: 0.5rem;
		overflow: auto;
	}
</style>


