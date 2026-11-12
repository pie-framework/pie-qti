<svelte:options customElement="pie-qti-match" />

<script lang="ts">
	import type { MatchInteractionData } from '@pie-qti/item-player';
	import type { InteractionProps, TypesetProps } from '../../shared/utils/interactionProps';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { formatList, joinSentences, translate, type I18nProvider } from '@pie-qti/i18n';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import MatchDragDrop from '../../shared/components/MatchDragDrop.svelte';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { isAtLimit, limitMessage } from '../../shared/utils/capacity';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { accessibleTextFromHtml } from '../../shared/utils/accessibleText.js';
	import { choiceAccessibleName } from '../../shared/utils/choiceName';
	import { choicesShortOfMatchMin, minimumHint } from '../../shared/utils/minimumRequirement';

	interface Props extends InteractionProps<'matchInteraction'>, TypesetProps {
		/** PNP structured labels: the answer sets are announced as labelled groups (G-13). */
		structuredLabelSupport?: boolean;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), typeset, onChange, structuredLabelSupport = false }: Props = $props();

	// Unique per component instance: two renderings of the same item on one page
	// must not share prompt ids (their aria references would cross).
	const uid = $props.id();
	const promptId = `${uid}-prompt`;

	// Parse props that may be JSON strings (web component usage). Correct-answer mode is the
	// scorer's view of an item that has a correct response (the shared shell's rule).
	const shell = $derived(
		createInteractionShell<MatchInteractionData, string[], string[]>({ interaction, response, correctResponse, role, listResponse: true }),
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);

	// G-13 structured labels: the answer set becomes one ARIA group named by the prompt.
	const structuredAria = $derived.by(() => {
		if (!structuredLabelSupport || !parsedInteraction) return {};
		if (parsedInteraction.prompt) return { role: 'group', 'aria-labelledby': promptId };
		// An authored accessible name beats the generic group label.
		if (parsedInteraction.accessibility?.label) return { role: 'group' };
		return { role: 'group', 'aria-label': i18n?.t('interactions.match.groupLabel') ?? 'Matching items' };
	});

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Convert response to pairs array, or empty array
	const pairs = $derived(parsedResponse && Array.isArray(parsedResponse) ? parsedResponse : []);

	// Minimum requirement (minAssociations, and each choice's matchMin): stated while the response
	// falls short of either, the same minimums response validation enforces; the author's message
	// wins. It describes the matching region. Only while the candidate can still answer.
	const minHintId = `${uid}-min-hint`;
	// 1-based position of each choice in its column as presented to the candidate (after
	// shuffle): the localized-ordinal name of a choice whose content carries no text.
	const choicePositions = $derived.by(() => {
		const positions = new Map<object, number>();
		parsedInteraction?.sourceSet.forEach((choice, index) => positions.set(choice, index + 1));
		parsedInteraction?.targetSet.forEach((choice, index) => positions.set(choice, index + 1));
		return positions;
	});
	const minHint = $derived.by(() => {
		if (disabled || role !== 'candidate' || !parsedInteraction) return '';
		const fewerMatches = minimumHint({
			i18n,
			minimum: parsedInteraction.minAssociations,
			count: pairs.length,
			key: 'interactions.match.minAssociationsHint',
			fallback: { one: 'Make at least {count} match.', other: 'Make at least {count} matches.' },
		});
		const shortChoices = choicesShortOfMatchMin(
			[...parsedInteraction.sourceSet, ...parsedInteraction.targetSet],
			pairs,
		);
		if (!fewerMatches && shortChoices.length === 0) return '';
		return (
			parsedInteraction.minSelectionsMessage?.trim() ||
			joinSentences(
				fewerMatches,
				shortChoices.length > 0 &&
					translate(i18n, 'interactions.match.minChoiceUsesHint', 'Needs more matches: {items}.', {
						// Readable names (image alt, MathML alttext); a localized ordinal for
						// content-less choices — never the identifier.
						items: formatList(
							i18n,
							shortChoices.map((choice) =>
								choiceAccessibleName({
									i18n,
									label: accessibleTextFromHtml(choice.text),
									position: choicePositions.get(choice) ?? 0,
								}),
							),
						),
					}),
			)
		);
	});

	// The author's limit message (data-max-selections-message), stated at maxAssociations; match
	// states no default: its refusals announce the limit themselves.
	const authoredMaxMessage = $derived(limitMessage(parsedInteraction?.maxSelectionsMessage, ''));

	function handlePairsChange(newPairs: string[]) {
		response = newPairs;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: newPairs, onChange });
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} {...structuredAria} class={['qti-match-interaction', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')} use:typesetAction={{ typeset }}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div id={promptId} part="prompt" class="qti-match-prompt qti-rich-content mb-3 text-sm text-base-content/70">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<MatchDragDrop
			sourceSet={parsedInteraction.sourceSet}
			targetSet={parsedInteraction.targetSet}
			{pairs}
			maxAssociations={parsedInteraction.maxAssociations}
			correctPairs={isShowingCorrect ? (parsedCorrectResponse || []) : []}
			{disabled}
			{i18n}
			structuredLabels={structuredLabelSupport}
			describedBy={minHint ? minHintId : undefined}
			onPairsChange={handlePairsChange}
		/>
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(pairs)} />
		{#if authoredMaxMessage && isAtLimit(pairs.length, parsedInteraction.maxAssociations)}
			<p class="qti-selection-message" role="alert">{authoredMaxMessage}</p>
		{/if}
	{/if}
</div>

<style>
	/* qti-choices-top|bottom|left|right: the first set's side of the second; left by default */
	.qti-match-interaction:is(.qti-choices-top, .qti-choices-bottom) :global(.qti-match-grid) {
		grid-template-columns: 1fr;
	}
	.qti-match-interaction:is(.qti-choices-bottom, .qti-choices-right) :global(.qti-match-grid > [part='source-column']) {
		order: 2;
	}

	.qti-selection-message {
		font-size: 0.875rem;
		/* Text token, not a fill token: warning yellow fails 1.4.3 as text. */
		color: var(--pie-qti-warning-text, #92400e);
		margin-top: 0.5rem;
	}
</style>
