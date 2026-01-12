<svelte:options customElement="pie-qti-associate" />

<script lang="ts">
	import type { AssociateInteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: AssociateInteractionData | string;
		response?: string[] | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		selectedForPairing?: string | null;
		onSelectionChange?: (selected: string | null) => void;
		onChange?: (value: string[]) => void;
	}

	let {
		interaction = $bindable(),
		response = $bindable(),
		disabled = false,
		i18n = $bindable(),
		selectedForPairing: externalSelectedForPairing,
		onSelectionChange,
		onChange,
	}: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<AssociateInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string[]>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Use external selection state if provided, otherwise use internal state
	let internalSelectedForPairing = $state<string | null>(null);
	const selectedForPairing = $derived(externalSelectedForPairing ?? internalSelectedForPairing);

	// Ensure response is always an array
	const pairs = $derived(parsedResponse || []);

	function emitChange(newPairs: string[]) {
		response = newPairs;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(newPairs);
		// Dispatch custom event for web component usage - event will bubble up to the host element
		if (rootElement) {
			const event = new CustomEvent('qti-change', {
				detail: {
					responseId: parsedInteraction?.responseId,
					value: newPairs,
					timestamp: Date.now(),
				},
				bubbles: true,
				composed: true,
			});
			rootElement.dispatchEvent(event);
		}
	}

	function setSelectedForPairing(value: string | null) {
		if (onSelectionChange) {
			onSelectionChange(value);
		} else {
			internalSelectedForPairing = value;
		}
	}

	function handleChoiceClick(choiceId: string) {
		if (disabled) return;

		// If no item selected yet, select this one
		if (selectedForPairing === null) {
			setSelectedForPairing(choiceId);
		}
		// If same item clicked again, deselect
		else if (selectedForPairing === choiceId) {
			setSelectedForPairing(null);
		}
		// If different item clicked, create a pair
		else {
			const newPair = `${selectedForPairing} ${choiceId}`;
			const newPairs = [...pairs, newPair];
			emitChange(newPairs);
			setSelectedForPairing(null);
		}
	}

	function removePair(index: number) {
		const newPairs = pairs.filter((_, i) => i !== index);
		emitChange(newPairs);
	}

	function isInPair(choiceId: string): boolean {
		return pairs.some((p) => p.includes(choiceId));
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-associate-interaction space-y-3">
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<p part="prompt" class="qti-associate-prompt font-semibold">{@html parsedInteraction.prompt}</p>
		{/if}

		<!-- Display choices as buttons that can be clicked to form pairs -->
		<div part="choices" class="qti-associate-choices grid grid-cols-2 gap-2">
			{#each parsedInteraction.choices as choice}
			{@const isSelected = selectedForPairing === choice.identifier}
			<button
				part="choice"
				class="btn btn-outline {isSelected ? 'btn-accent' : isInPair(choice.identifier) ? 'btn-primary' : 'btn-neutral'}"
				onclick={() => handleChoiceClick(choice.identifier)}
				{disabled}
			>
				{@html choice.text}
				{#if isSelected}
					<span class="ml-2">◉</span>
				{:else if isInPair(choice.identifier)}
					<span class="ml-2">✓</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Display current pairs -->
	{#if pairs.length > 0}
		<div part="pairs-title" class="divider">Current Associations</div>
		<div part="pairs" class="qti-associate-pairs space-y-2">
			{#each pairs as pair, index}
				{@const [id1, id2] = pair.split(' ')}
				{@const choice1 = parsedInteraction.choices.find((c: any) => c.identifier === id1)}
				{@const choice2 = parsedInteraction.choices.find((c: any) => c.identifier === id2)}
				{#if choice1 && choice2}
					<div part="pair" class="qti-associate-pair flex items-center gap-4 p-2 bg-primary/10 rounded">
						<span class="flex-1">{choice1.text}</span>
						<span class="text-primary">↔</span>
						<span class="flex-1">{choice2.text}</span>
						<button
							part="pair-remove"
							class="btn btn-sm btn-ghost btn-circle"
							onclick={() => removePair(index)}
							{disabled}
						>
							✕
						</button>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

		<!-- Selection helper -->
		<div part="helper" class="qti-associate-helper alert alert-info">
			<span class="text-sm">
				{#if selectedForPairing}
					{i18n?.t('interactions.associate.clickAnotherOrDeselect') ?? 'Click another item to create an association (or click again to deselect)'}
				{:else}
					{i18n?.t('interactions.associate.clickToAssociate') ?? 'Click two items to create an association between them'}
				{/if}
			</span>
		</div>
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-associate-interaction {
		display: grid;
		gap: 0.75rem;
	}
	.qti-associate-prompt {
		margin: 0;
	}
	.qti-associate-choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	@media (max-width: 640px) {
		.qti-associate-choices {
			grid-template-columns: 1fr;
		}
	}
	.qti-associate-pairs {
		display: grid;
		gap: 0.5rem;
	}
	.qti-associate-pair {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: color-mix(in oklch, var(--color-primary, oklch(45% 0.24 277)) 6%, transparent);
	}
	.qti-associate-helper {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
	}
</style>
