<svelte:options customElement="pie-qti-associate" />

<script lang="ts">
	import type { AssociateInteractionData, HtmlContent } from '@pie-qti/item-player';
	import type { InteractionProps } from '../../shared/utils/interactionProps';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { formatList, joinSentences, translate, translatePlural, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { exceedsLimit, isAtLimit, isLimited } from '../../shared/utils/capacity';
	import { accessibleTextFromHtml } from '../../shared/utils/accessibleText.js';
	import { choiceAccessibleName } from '../../shared/utils/choiceName';
	import { createAnnouncer } from '../../shared/utils/announcer.svelte';
	import { matchGroupBlockedIds } from '../../shared/utils/matchGroupUtils';
	import { countPairsWithId, hasUnorderedPair, pairIncludesId } from '../../shared/utils/pairHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { describedByIds, choicesShortOfMatchMin, minimumHint } from '../../shared/utils/minimumRequirement';

	interface Props extends InteractionProps<'associateInteraction'> {
		selectedForPairing?: string | null;
		onSelectionChange?: (selected: string | null) => void;
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
			listResponse: true,
		})
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Polite announcements of pair removals and refused pairings, for the screen-reader
	// live region below.
	const statusAnnouncer = createAnnouncer();

	/** Announce through the polite live region; the shared announcer keeps repeats announcing. */
	function announce(message: string) {
		statusAnnouncer.announce(message);
	}
	// Use external selection state if provided, otherwise use internal state
	let internalSelectedForPairing = $state<string | null>(null);
	const selectedForPairing = $derived(externalSelectedForPairing ?? internalSelectedForPairing);

	// Ensure response is always an array
	const pairs = $derived(parsedResponse || []);

	// Unique id prefix so aria-labelledby/describedby survive several interactions
	// in one document, including two renderings of the same item.
	const uid = $props.id();
	const helperId = `${uid}-helper`;

	// Minimum requirement (minAssociations, and each choice's matchMin): stated while the response
	// falls short of either, the same minimums response validation enforces; the author's message
	// wins. The choices have no group of their own, so each choice is described by it, as by the
	// helper. Only while the candidate can still answer.
	const minHintId = `${uid}-min-hint`;
	const minHint = $derived.by(() => {
		if (disabled || role !== 'candidate' || !parsedInteraction) return '';
		const fewerAssociations = minimumHint({
			i18n,
			minimum: parsedInteraction.minAssociations,
			count: pairs.length,
			key: 'interactions.associate.minAssociationsHint',
			fallback: { one: 'Make at least {count} association.', other: 'Make at least {count} associations.' },
		});
		// No QTI version defines a selections message on associateInteraction, so the hint is
		// always the localized text.
		const shortChoices = choicesShortOfMatchMin(parsedInteraction.choices, pairs);
		if (!fewerAssociations && shortChoices.length === 0) return '';
		return (
			joinSentences(
				fewerAssociations,
				shortChoices.length > 0 &&
					translate(i18n, 'interactions.associate.minChoiceUsesHint', 'Needs more associations: {items}.', {
						items: formatList(i18n, shortChoices.map(getChoiceLabel)),
					}),
			)
		);
	});

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
	// (the selected choice itself is never shown as blocked: display-only, as a choice paired
	// with itself never breaks matchGroup)
	const blockedChoices = $derived.by(() => {
		if (!selectedForPairing || !parsedInteraction) return new Set<string>();
		const choices = parsedInteraction.choices;
		return matchGroupBlockedIds(
			choices.find((c) => c.identifier === selectedForPairing),
			choices.filter((c) => c.identifier !== selectedForPairing),
		);
	});

	// The interaction's association cap (QTI maxAssociations): 0 means unlimited, as every
	// spec version that defines the attribute reads it.
	const maxAssociations = $derived(parsedInteraction ? Math.max(0, Math.trunc(Number(parsedInteraction.maxAssociations) || 0)) : 0);
	const associationCapReached = $derived(isAtLimit(pairs.length, maxAssociations));

	function usesOf(choiceId: string): number {
		return countPairsWithId(pairs, choiceId);
	}

	/**
	 * True when the choice cannot join a further association: its own matchMax is used up,
	 * or the interaction's maxAssociations cap is reached (then no choice can).
	 */
	function isChoiceMaxed(choice: { identifier: string; matchMax: number }): boolean {
		return isAtLimit(usesOf(choice.identifier), choice.matchMax) || associationCapReached;
	}

	function announceAssociationLimit() {
		announce(
			translate(i18n, 'interactions.associate.associationLimitReached', 'Association not possible: the limit of {max} is reached.', {
				max: maxAssociations,
			}),
		);
	}

	function announceChoiceLimit(choice: { identifier: string; text: HtmlContent }) {
		announce(
			translate(i18n, 'interactions.associate.choiceLimitReached', 'Not possible: {label} cannot be in more associations.', {
				label: getChoiceLabel(choice),
			}),
		);
	}

	function handleChoiceClick(choiceId: string) {
		if (disabled || !parsedInteraction) return;
		const clicked = parsedInteraction.choices.find((c) => c.identifier === choiceId);

		// If same item clicked again, deselect — still allowed once a cap is reached.
		if (selectedForPairing === choiceId) {
			setSelectedForPairing(null);
			return;
		}

		// Capacity refusals (QTI matchMax per choice and maxAssociations per interaction),
		// announced: the same maxima response validation enforces, refused here so an
		// over-limit response never reaches the submit that would reject it.
		if (clicked && isAtLimit(usesOf(choiceId), clicked.matchMax)) {
			announceChoiceLimit(clicked);
			return;
		}
		if (associationCapReached) {
			announceAssociationLimit();
			return;
		}

		// If no item selected yet, select this one
		if (selectedForPairing === null) {
			setSelectedForPairing(choiceId);
			return;
		}

		// If a different item is clicked, check matchGroup compatibility then create a pair.
		// Both caps are re-checked against the would-be response, so every path that
		// completes a pair refuses alike (the same rule MatchDragDrop applies per match).
		// A refused partner is announced: aria-disabled alone states availability, not the
		// reason an activation did nothing (WCAG 4.1.3).
		if (blockedChoices.has(choiceId)) {
			announce(translate(i18n, 'interactions.associate.notAvailableSentence', 'Not available due to a match group restriction.'));
			return;
		}
		const newPair = `${selectedForPairing} ${choiceId}`;
		const newPairs = [...pairs, newPair];
		if (exceedsLimit(newPairs.length, maxAssociations)) {
			announceAssociationLimit();
			return;
		}
		const pending = parsedInteraction.choices.find((c) => c.identifier === selectedForPairing);
		for (const choice of [pending, clicked]) {
			if (choice && exceedsLimit(countPairsWithId(newPairs, choice.identifier), choice.matchMax)) {
				announceChoiceLimit(choice);
				return;
			}
		}
		emitChange(newPairs);
		setSelectedForPairing(null);
	}

	function removePair(index: number) {
		const removed = pairs[index];
		emitChange(pairs.filter((_, i) => i !== index));
		// Announce the removal politely: the focused remove button vanishes with the pair,
		// so the live region is what tells assistive technology what just happened. Only
		// pairs of known choices render a remove control, so both are found and named;
		// an identifier is never announced.
		if (removed) {
			const [id1, id2] = removed.split(' ');
			const choice1 = parsedInteraction?.choices.find((c) => c.identifier === id1);
			const choice2 = parsedInteraction?.choices.find((c) => c.identifier === id2);
			if (choice1 && choice2) {
				announce(
					translate(i18n, 'interactions.associate.removedAssociationBetween', 'Removed association between {first} and {second}.', {
						first: getChoiceLabel(choice1),
						second: getChoiceLabel(choice2),
					}),
				);
			}
		}
		void moveFocusAfterRemoval(index);
	}

	/**
	 * The activated button may be gone, which would drop keyboard focus to the
	 * document. Focus stays on the pair list (the pair now in that row, else the
	 * new last one), or returns to the choices when no pair is left to remove.
	 */
	async function moveFocusAfterRemoval(removedIndex: number) {
		await tick();
		const buttons = rootElement?.querySelectorAll<HTMLButtonElement>('[part="pair-remove"]');
		const nextPair = buttons?.[Math.min(removedIndex, buttons.length - 1)];
		(nextPair ?? rootElement?.querySelector<HTMLButtonElement>('[part="choice"]'))?.focus();
	}

	function isInPair(choiceId: string): boolean {
		return pairs.some((p) => pairIncludesId(p, choiceId));
	}

	function isCorrectPair(choiceId: string): boolean {
		if (!isShowingCorrect) return false;
		return (parsedCorrectResponse || []).some((p) => pairIncludesId(p, choiceId));
	}

	function isCorrectPairMatch(id1: string, id2: string): boolean {
		if (!isShowingCorrect || !parsedCorrectResponse) return false;
		// A QTI pair is unordered: the key's "B A" is the candidate's "A B".
		return hasUnorderedPair(parsedCorrectResponse, id1, id2);
	}

	// 1-based position of each choice as presented to the candidate (after shuffle):
	// the localized-ordinal name of a choice whose content carries no text.
	const choicePositions = $derived.by(() => {
		const positions = new Map<string, number>();
		(parsedInteraction?.choices ?? []).forEach((choice, index) => positions.set(choice.identifier, index + 1));
		return positions;
	});

	/** Whether the choice's content carries readable text (text, image alt, MathML alttext). */
	function hasAuthoredLabel(choice: { text: HtmlContent }): boolean {
		return accessibleTextFromHtml(choice.text) !== '';
	}

	/**
	 * Readable choice name for labels and announcements: the authored content (image
	 * alt and MathML alttext participate), else a localized ordinal of the presented
	 * position ("Choice 3"). Never the identifier: it is meaningless (and potentially
	 * answer-leaking) to candidates using a screen reader.
	 */
	function getChoiceLabel(choice: { identifier: string; text: HtmlContent }): string {
		return choiceAccessibleName({
			i18n,
			label: accessibleTextFromHtml(choice.text),
			position: choicePositions.get(choice.identifier) ?? 0,
		});
	}

	function getRemoveAssociationLabel(choice1: { identifier: string; text: HtmlContent }, choice2: { identifier: string; text: HtmlContent }): string {
		return translate(i18n, 'interactions.associate.removeAssociationBetween', 'Remove association between {first} and {second}', {
			first: getChoiceLabel(choice1),
			second: getChoiceLabel(choice2),
		});
	}

	const correctPairs = $derived(
		isShowingCorrect && parsedCorrectResponse ? parsedCorrectResponse : []
	);
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class="qti-associate-interaction space-y-3">
	<InteractionDescription interaction={parsedInteraction} />
	<!-- Polite announcements (pair removal, refused pairing) that survive the changed/focused controls themselves. -->
	<div aria-live="polite" aria-atomic="true" class="qti-associate-live-region">{statusAnnouncer.message}</div>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-associate-prompt qti-rich-content font-semibold">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<!-- Display choices as buttons that can be clicked to form pairs -->
		<div part="choices" class="qti-associate-choices grid grid-cols-2 gap-2">
			{#each parsedInteraction.choices as choice}
			{@const isSelected = selectedForPairing === choice.identifier}
			{@const inPair = isInPair(choice.identifier)}
			{@const isCorrect = isCorrectPair(choice.identifier)}
			{@const isBlocked = blockedChoices.has(choice.identifier)}
			{@const isMaxed = isChoiceMaxed(choice)}
			{@const isUnavailable = isBlocked || isMaxed}
			{@const hasLabel = hasAuthoredLabel(choice)}
			{@const choiceTextId = `${uid}-choice-${choice.identifier}-text`}
			{@const choiceStateId = `${uid}-choice-${choice.identifier}-state`}
			<!-- A maxed choice stays focusable: the disabled property would remove the very
			     control the candidate just activated from under their focus; aria-disabled
			     plus the handler's refusal guard instead. A choice with no readable content
			     (an image without alt) is named by its ordinal, never left nameless. -->
			<button
				part="choice"
				class="btn btn-outline {isSelected ? 'btn-accent' : inPair ? 'btn-primary' : isCorrect ? 'btn-success' : 'btn-neutral'}"
				class:opacity-40={isUnavailable}
				class:cursor-not-allowed={isUnavailable}
				type="button"
				aria-labelledby={hasLabel ? choiceTextId : undefined}
				aria-label={hasLabel ? undefined : getChoiceLabel(choice)}
				aria-describedby={describedByIds(!isShowingCorrect && helperId, choiceStateId, minHint && minHintId)}
				aria-pressed={isSelected}
				aria-disabled={isUnavailable ? 'true' : undefined}
				onclick={() => handleChoiceClick(choice.identifier)}
				{disabled}
			>
				<!-- The name source: image alt and MathML participate in name computation here. -->
				<span id={choiceTextId} class="qti-associate-choice-text qti-rich-inline-content">
					{@html choice.text}
				</span>
				{#if isSelected}
					<span class="ms-2">◉</span>
				{:else if inPair}
					<span class="ms-2">✓</span>
				{/if}
				<span id={choiceStateId} class="sr-only">
					{inPair ? translate(i18n, 'interactions.associate.inPairSentence', 'In an association.') : ''}
				</span>
			</button>
		{/each}
	</div>
	<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(pairs)} />

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
				{#if choice1 && choice2}
					<div
						part="correct-pair"
						class="qti-associate-pair flex items-center gap-4 p-2 bg-success/10 border border-success rounded"
					>
						<span class="flex-1 qti-rich-inline-content">{@html choice1.text}</span>
						<span class="text-success">↔</span>
						<span class="flex-1 qti-rich-inline-content">{@html choice2.text}</span>
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
						<span class="flex-1 qti-rich-inline-content">{@html choice1.text}</span>
						<span class="{isCorrect ? 'text-success' : 'text-primary'}">↔</span>
						<span class="flex-1 qti-rich-inline-content">{@html choice2.text}</span>
						{#if isCorrect}
							<span class="badge badge-success badge-sm">
								{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'}
							</span>
						{/if}
						<button
							part="pair-remove"
							class="qti-associate-pair-remove"
							type="button"
							aria-label={getRemoveAssociationLabel(choice1, choice2)}
							onclick={() => removePair(index)}
							{disabled}
						>
							<span aria-hidden="true">✕</span>
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
					{joinSentences(
						selectedForPairing
							? (i18n?.t('interactions.associate.clickAnotherOrDeselect') ??
								'Select another item to create an association, or select this item again to deselect it.')
							: (i18n?.t('interactions.associate.clickToAssociate') ??
								'Select two items to create an association between them. Keyboard users can tab to each item and press Enter or Space.'),
						// The interaction's cap, named up front (WCAG 3.3.2) so the limit is known
						// before the first refusal announces it.
						isLimited(maxAssociations) &&
							translatePlural(
								i18n,
								'interactions.associate.maxAssociationsHint',
								{ one: 'You can make up to {count} association.', other: 'You can make up to {count} associations.' },
								maxAssociations,
							),
					)}
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
	/*
	 * Pair remove: 44×44 CSS px, the K-12 house target (above the 24px WCAG 2.5.8
	 * minimum). Self-contained so the size holds without DaisyUI's btn classes.
	 */
	.qti-associate-pair-remove {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		inline-size: 44px;
		block-size: 44px;
		min-inline-size: 44px;
		min-block-size: 44px;
		margin: 0;
		padding: 0;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 999px;
		background: transparent;
		color: var(--pie-qti-error-text, #b91c1c);
		font: inherit;
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}
	.qti-associate-pair-remove:hover:not(:disabled) {
		background: color-mix(in srgb, var(--pie-qti-error-text, #b91c1c) 10%, transparent);
	}
	.qti-associate-pair-remove:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	.qti-associate-pair-remove:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
	.qti-associate-helper {
		border: 1px solid var(--pie-qti-base-300, oklch(95% 0 0));
		background: var(--pie-qti-base-200, oklch(98% 0 0));
	}
</style>
