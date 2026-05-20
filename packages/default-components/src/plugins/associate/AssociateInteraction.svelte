<svelte:options customElement="pie-qti-associate" />

<script lang="ts">
	import type { AssociateInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { isCompatibleMatchGroup } from '../../shared/utils/matchGroupUtils';

	interface Props {
		interaction?: AssociateInteractionData | string;
		response?: string[] | null;
		correctResponse?: string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		selectedForPairing?: string | null;
		onSelectionChange?: (selected: string | null) => void;
		onChange?: (value: string[]) => void;
	}

	let {
		interaction = $bindable(),
		response = $bindable(),
		correctResponse = $bindable(),
		disabled = false,
		role = 'candidate',
		i18n = $bindable(),
		selectedForPairing: externalSelectedForPairing,
		onSelectionChange,
		onChange,
	}: Props = $props();

	const shell = $derived(
		createInteractionShell<AssociateInteractionData, string[], string[]>({
			interaction,
			response,
			correctResponse,
			role,
		})
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Use external selection state if provided, otherwise use internal state
	let internalSelectedForPairing = $state<string | null>(null);
	const selectedForPairing = $derived(externalSelectedForPairing ?? internalSelectedForPairing);

	// Ensure response is always an array
	const pairs = $derived(parsedResponse || []);
	const helperId = $derived(`associate-helper-${parsedInteraction?.responseId ?? 'unknown'}`);

	function emitChange(newPairs: string[]) {
		response = newPairs;
		emitInteractionChange({ target: rootElement, responseId: shell.responseId, value: newPairs, onChange });
	}

	function setSelectedForPairing(value: string | null) {
		if (onSelectionChange) {
			onSelectionChange(value);
		} else {
			internalSelectedForPairing = value;
		}
	}

	// Choices that cannot be paired with the currently selected choice due to matchGroup constraints
	const blockedChoices = $derived.by(() => {
		if (!selectedForPairing || !parsedInteraction) return new Set<string>();
		const src = parsedInteraction.choices.find((c) => c.identifier === selectedForPairing);
		return new Set(
			parsedInteraction.choices
				.filter((c) => c.identifier !== selectedForPairing && !isCompatibleMatchGroup(src?.matchGroup, c.matchGroup))
				.map((c) => c.identifier)
		);
	});

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
		// If different item clicked, check matchGroup compatibility then create a pair
		else {
			if (blockedChoices.has(choiceId)) return;
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

	function isCorrectPair(choiceId: string): boolean {
		if (!isShowingCorrect) return false;
		return (parsedCorrectResponse || []).some((p) => p.includes(choiceId));
	}

	function isCorrectPairMatch(id1: string, id2: string): boolean {
		if (!isShowingCorrect || !parsedCorrectResponse) return false;
		return parsedCorrectResponse.some(
			(p) => p === `${id1} ${id2}` || p === `${id2} ${id1}`
		);
	}

	function toPlainText(html: string): string {
		return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
	}

	function getChoiceLabel(choice: { identifier: string; text: string }): string {
		const text = toPlainText(choice.text);
		return text ? `${choice.identifier}: ${text}` : choice.identifier;
	}

	function getPairLabel(choice1: { identifier: string; text: string }, choice2: { identifier: string; text: string }): string {
		return `${getChoiceLabel(choice1)} and ${getChoiceLabel(choice2)}`;
	}

	const correctPairs = $derived(
		isShowingCorrect && parsedCorrectResponse ? parsedCorrectResponse : []
	);
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
			{@const inPair = isInPair(choice.identifier)}
			{@const isCorrect = isCorrectPair(choice.identifier)}
			{@const isBlocked = blockedChoices.has(choice.identifier)}
			<button
				part="choice"
				class="btn btn-outline {isSelected ? 'btn-accent' : inPair ? 'btn-primary' : isCorrect ? 'btn-success' : 'btn-neutral'}"
				class:opacity-40={isBlocked}
				class:cursor-not-allowed={isBlocked}
				type="button"
				aria-label={getChoiceLabel(choice)}
				aria-pressed={isSelected}
				aria-disabled={isBlocked ? 'true' : undefined}
				aria-describedby={helperId}
				onclick={() => handleChoiceClick(choice.identifier)}
				{disabled}
			>
				{@html choice.text}
				{#if isSelected}
					<span class="ml-2">◉</span>
				{:else if inPair}
					<span class="ml-2">✓</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Display correct associations when in scorer mode -->
	{#if isShowingCorrect && correctPairs.length > 0}
		<div part="correct-pairs-title" class="divider">
			{i18n?.t('interactions.associate.correctAssociations') ?? 'Correct Associations'}
		</div>
		<div part="correct-pairs" class="qti-associate-pairs space-y-2">
			{#each correctPairs as pair}
				{@const [id1, id2] = pair.split(' ')}
				{@const choice1 = parsedInteraction.choices.find((c: any) => c.identifier === id1)}
				{@const choice2 = parsedInteraction.choices.find((c: any) => c.identifier === id2)}
				{@const isInUserPairs = pairs.some((p) => p === pair || p === `${id2} ${id1}`)}
				{#if choice1 && choice2}
					<div
						part="correct-pair"
						class="qti-associate-pair flex items-center gap-4 p-2 bg-success/10 border border-success rounded"
					>
						<span class="flex-1">{choice1.text}</span>
						<span class="text-success">↔</span>
						<span class="flex-1">{choice2.text}</span>
						<span class="badge badge-success badge-sm">
							{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}
						</span>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Display current pairs -->
	{#if pairs.length > 0}
		<div part="pairs-title" class="divider">
			{i18n?.t('interactions.associate.currentAssociations') ?? 'Current Associations'}
		</div>
		<div part="pairs" class="qti-associate-pairs space-y-2">
			{#each pairs as pair, index}
				{@const [id1, id2] = pair.split(' ')}
				{@const choice1 = parsedInteraction.choices.find((c: any) => c.identifier === id1)}
				{@const choice2 = parsedInteraction.choices.find((c: any) => c.identifier === id2)}
				{@const isCorrect = isCorrectPairMatch(id1, id2)}
				{#if choice1 && choice2}
					<div
						part="pair"
						class="qti-associate-pair flex items-center gap-4 p-2 rounded {isCorrect
							? 'bg-success/10 border border-success'
							: 'bg-primary/10 border border-base-300'}"
					>
						<span class="flex-1">{choice1.text}</span>
						<span class="{isCorrect ? 'text-success' : 'text-primary'}">↔</span>
						<span class="flex-1">{choice2.text}</span>
						{#if isCorrect}
							<span class="badge badge-success badge-sm">
								{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}
							</span>
						{/if}
						<button
							part="pair-remove"
							class="btn btn-sm btn-ghost btn-circle"
							type="button"
							aria-label={`Remove association between ${getPairLabel(choice1, choice2)}`}
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

		<!-- Selection helper - Hide when showing correct answers -->
		{#if !isShowingCorrect}
			<div id={helperId} part="helper" class="qti-associate-helper alert alert-info" role="status" aria-live="polite">
				<span class="text-sm">
					{#if selectedForPairing}
						{i18n?.t('interactions.associate.clickAnotherOrDeselect') ??
							'Select another item to create an association, or select this item again to deselect it.'}
					{:else}
						{i18n?.t('interactions.associate.clickToAssociate') ??
							'Select two items to create an association between them. Keyboard users can tab to each item and press Enter or Space.'}
					{/if}
				</span>
			</div>
		{/if}
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
	}
	.qti-associate-helper {
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		background: var(--color-base-200, oklch(98% 0 0));
	}
</style>
