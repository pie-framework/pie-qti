<svelte:options customElement="pie-qti-choice" />

<script lang="ts">
	import type { ChoiceInteractionData } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { createEliminationTool, eliminationActionLabel } from '../../shared/utils/eliminationTool.svelte';
	import { translate, type I18nProvider } from '@pie-qti/i18n';
	import { normalizeHeuristicsConfig, type QtiHeuristicsConfig } from '@pie-qti/item-player';
	import { processFeedbackInline } from '@pie-qti/qti-common';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { describedByIds, minimumHint } from '../../shared/utils/minimumRequirement';

	interface Props {
		interaction?: ChoiceInteractionData | string;
		response?: string | string[] | null;
		correctResponse?: string | string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string | string[]) => void;
		outcomeValues?: Record<string, any>;
		heuristicsConfig?: QtiHeuristicsConfig;
		/** When true, renders an elimination toggle button per choice (QTI 3.0 PNP §6.2). */
		eliminationTool?: boolean;
		/** AfA `answer-masking`: each choice stays masked behind a reveal button until the candidate reveals it. */
		answerMasking?: boolean;
		/**
		 * G-13 structured labels. The group is now always associated with the prompt via
		 * `aria-labelledby` (generic localized name only when there is no prompt), so this
		 * prop is kept for API compatibility and no longer changes behaviour.
		 */
		structuredLabelSupport?: boolean;
	}

	let {
		interaction = $bindable(),
		response = $bindable(),
		correctResponse = $bindable(),
		disabled = false,
		role = 'candidate',
		i18n = $bindable(),
		typeset,
		onChange,
		outcomeValues = {},
		heuristicsConfig,
		eliminationTool = false,
		answerMasking = false,
		structuredLabelSupport = false
	}: Props = $props();

	// Normalize heuristics configuration with defaults
	const heuristics = $derived(normalizeHeuristicsConfig(heuristicsConfig));

	// Translation helper:
	// The default i18n provider returns the key itself when a translation is missing.
	// We treat that as "missing" so we can safely fall back to the provided string.
	const t = $derived((key: string, fallback: string) => {
		const v = i18n?.t(key);
		return !v || v === key ? fallback : v;
	});

	const shell = $derived(
		createInteractionShell<ChoiceInteractionData, string | string[], string | string[]>({
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

	// Helper function to check if a choice is correct
	function isCorrectChoice(identifier: string): boolean {
		if (!isShowingCorrect) return false;
		if (Array.isArray(parsedCorrectResponse)) {
			return parsedCorrectResponse.includes(identifier);
		}
		return parsedCorrectResponse === identifier;
	}

	// Helper function to check if a choice is currently selected
	function isSelectedChoice(identifier: string): boolean {
		if (Array.isArray(parsedResponse)) return parsedResponse.includes(identifier);
		return parsedResponse === identifier;
	}

	// Helper function to filter feedbackInline from choice text based on outcome values
	function filterFeedbackInline(text: string): string {
		return processFeedbackInline(text, {
			outcomeValues,
			applyHeuristics: heuristics.feedbackTextFormatting,
			wrapWithSpan: true
		});
	}

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	// Elimination tool (QTI 3.0 PNP §6.2): eliminated choices remain in DOM and in the response;
	// only the candidate's view of them changes.
	const elimination = createEliminationTool();
	const eliminationLabel = (identifier: string): string =>
		eliminationActionLabel(elimination.isEliminated(identifier), i18n);

	// Answer masking state: choices the candidate has revealed. A masked choice cannot be selected.
	let revealedChoices = $state(new Set<string>());

	function isMasked(identifier: string): boolean {
		return answerMasking && !revealedChoices.has(identifier);
	}

	function revealChoice(identifier: string) {
		revealedChoices = new Set(revealedChoices).add(identifier);
	}

	function handleRadioChange(identifier: string) {
		response = identifier;
		emitInteractionChange({ target: rootElement, responseId: shell.responseId, value: identifier, onChange });
	}

	function handleCheckboxChange(identifier: string, checked: boolean, input?: HTMLInputElement) {
		const currentValues = Array.isArray(parsedResponse) ? parsedResponse : [];
		let newValues = [...currentValues];

		if (checked) {
			// Enforce maxChoices (0 = unlimited)
			const max = parsedInteraction?.maxChoices ?? 0;
			if (max > 0 && newValues.length >= max) {
				// The selection is refused, so don't leave the checkbox visually checked.
				if (input) input.checked = false;
				return;
			}
			newValues.push(identifier);
		} else {
			newValues = newValues.filter((v) => v !== identifier);
		}

		response = newValues;
		emitInteractionChange({ target: rootElement, responseId: shell.responseId, value: newValues, onChange });
	}

	// Unique per instance, so two renderings of the same item (same responseId) in one
	// document neither share label/description ids nor join one radio group.
	const uid = $props.id();
	const radioGroupName = `${uid}-choice`;

	function idToken(value: string): string {
		return value.replace(/[^A-Za-z0-9_-]/g, '-');
	}

	function choiceTextId(identifier: string): string {
		return `${uid}-choice-text-${idToken(identifier)}`;
	}

	function eliminationVerbId(identifier: string): string {
		return `${uid}-eliminate-verb-${idToken(identifier)}`;
	}

	// The answer set is one ARIA group associated with the prompt, so a screen reader
	// announces the question once and each choice within it.
	const promptId = `${uid}-choice-prompt`;
	const groupAria = $derived.by(() => {
		if (!parsedInteraction) return {};
		// An authored accessible name beats the prompt and the generic group label.
		if (parsedInteraction.accessibility?.label) return { role: 'group' };
		if (parsedInteraction.prompt) return { role: 'group', 'aria-labelledby': promptId };
		return { role: 'group', 'aria-label': t('interactions.choice.groupLabel', 'Answer choices') };
	});

	// Selection limit message: an authored message is shown at the cap for any cardinality;
	// without one, a localized default is announced whenever a selection can actually be
	// refused (multiple choice). Single-choice radios replace their selection instead.
	const selectionCount = $derived(Array.isArray(parsedResponse) ? parsedResponse.length : (parsedResponse ? 1 : 0));
	const maxChoices = $derived(parsedInteraction?.maxChoices ?? 0);
	const maxMessage = $derived.by(() => {
		const authored = parsedInteraction?.maxSelectionsMessage;
		if (authored) return authored;
		return translate(
			i18n,
			'interactions.choice.maxChoicesReached',
			'You can select up to {max}. Deselect one to choose another.',
			{ max: maxChoices }
		);
	});
	const showMaxMessage = $derived(
		maxChoices > 0 && selectionCount >= maxChoices && (!!parsedInteraction?.maxSelectionsMessage || maxChoices > 1)
	);

	// Minimum requirement (minChoices): stated on the question while the response is short of it,
	// the same minimum response validation enforces; the author's message wins. Only while the
	// candidate can still answer.
	const minHintId = `${uid}-min-hint`;
	const minHint = $derived(
		minimumHint({
			i18n,
			minimum: !disabled && role === 'candidate' ? parsedInteraction?.minChoices : 0,
			count: selectionCount,
			authored: parsedInteraction?.minSelectionsMessage,
			key: 'interactions.choice.minChoicesHint',
			fallback: { one: 'Select at least {count} answer.', other: 'Select at least {count} answers.' },
		})
	);
	// The answer group's description: the authored one, then the hint while it shows.
	const groupDescribedBy = $derived(
		describedByIds(interactionAria(parsedInteraction)['aria-describedby'], minHint && minHintId)
	);

	// Clear answer (single choice): a visible way to retract the selection, not just re-selecting.
	const canClearAnswer = $derived(
		parsedInteraction?.maxChoices === 1 && typeof parsedResponse === 'string' && parsedResponse.length > 0 && !disabled
	);

	function clearAnswer() {
		if (disabled) return;
		response = null;
		const nullAwareOnChange = onChange as ((value: string | string[] | null) => void) | undefined;
		emitInteractionChange<string | string[] | null>({
			target: rootElement,
			responseId: shell.responseId,
			value: null,
			onChange: nullAwareOnChange
		});
		// Move focus to the first choice so keyboard users stay in the interaction.
		rootElement?.querySelector<HTMLInputElement>('input[type="radio"]:not([disabled])')?.focus();
	}
</script>

<ShadowBaseStyles />

{#snippet maskedChoice(identifier: string, index: number)}
	<button
		type="button"
		part="reveal"
		class="qti-reveal-btn"
		onclick={() => revealChoice(identifier)}
	>{i18n?.t('interactions.choice.revealChoice', { index: index + 1 }) ?? `Reveal choice ${index + 1}`}</button>
{/snippet}

<div class="qti-choice-shell">
	<div bind:this={rootElement} {...interactionAria(parsedInteraction)} {...groupAria} aria-describedby={groupDescribedBy} part="root" class={['qti-choice-interaction space-y-2', eliminationTool ? 'qti-has-elimination' : '', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')} use:typesetAction={{ typeset }}>
		<InteractionDescription interaction={parsedInteraction} />
		{#if parsedInteraction?.prompt}
			<div id={promptId} part="prompt" class="qti-choice-prompt qti-rich-content font-semibold">{@html parsedInteraction.prompt}</div>
		{/if}

		{#if !parsedInteraction}
			<div class="alert alert-error">{i18n?.t('common.errorNoData') ?? 'No interaction data provided'}</div>
		{:else if parsedInteraction.maxChoices === 1}
			<!-- Single choice (radio buttons) -->
			{#each parsedInteraction.choices as choice, index}
				{@const textId = choiceTextId(choice.identifier)}
				<div
					part="option"
					class="qti-choice-option"
					data-eliminated={elimination.isEliminated(choice.identifier) ? '' : undefined}
					data-masked={isMasked(choice.identifier) ? '' : undefined}
				>
					{#if isMasked(choice.identifier)}
						{@render maskedChoice(choice.identifier, index)}
					{:else}
					<label
						part="label"
						class="qti-choice-label"
						class:qti-choice-correct={isCorrectChoice(choice.identifier)}
						data-selected={isSelectedChoice(choice.identifier) ? '' : undefined}
					>
						<input
							part="input"
							type="radio"
							name={radioGroupName}
							class="radio radio-primary"
							class:radio-success={isCorrectChoice(choice.identifier)}
							value={choice.identifier}
							aria-labelledby={textId}
							checked={parsedResponse === choice.identifier}
							onchange={() => handleRadioChange(choice.identifier)}
							{disabled}
						/>
						<div id={textId} part="text" class="qti-choice-text qti-rich-content">
							{@html choice.text}
						</div>
						{#if isCorrectChoice(choice.identifier)}
							<span class="badge badge-success badge-sm">{t('interactions.choice.correct', 'Correct')}</span>
						{/if}
					</label>
					{/if}
					{#if eliminationTool}
						<button
							type="button"
							part="eliminate"
							class="qti-eliminate-btn"
							aria-labelledby={`${eliminationVerbId(choice.identifier)} ${textId}`}
							aria-pressed={elimination.isEliminated(choice.identifier)}
							onclick={() => elimination.toggle(choice.identifier)}
						><span class="sr-only" id={eliminationVerbId(choice.identifier)}>{eliminationLabel(choice.identifier)}</span>✕</button>
					{/if}
				</div>
			{/each}
		{:else}
			<!-- Multiple choice (checkboxes) -->
			{@const currentValues = Array.isArray(parsedResponse) ? parsedResponse : []}
			{#each parsedInteraction.choices as choice, index}
				{@const textId = choiceTextId(choice.identifier)}
				<div
					part="option"
					class="qti-choice-option"
					data-eliminated={elimination.isEliminated(choice.identifier) ? '' : undefined}
					data-masked={isMasked(choice.identifier) ? '' : undefined}
				>
					{#if isMasked(choice.identifier)}
						{@render maskedChoice(choice.identifier, index)}
					{:else}
					<label
						part="label"
						class="qti-choice-label"
						class:qti-choice-correct={isCorrectChoice(choice.identifier)}
						data-selected={currentValues.includes(choice.identifier) ? '' : undefined}
					>
						<input
							part="input"
							type="checkbox"
							class="checkbox checkbox-primary"
							class:checkbox-success={isCorrectChoice(choice.identifier)}
							value={choice.identifier}
							aria-labelledby={textId}
							checked={currentValues.includes(choice.identifier)}
							onchange={(e: Event) => {
								const target = e.currentTarget as HTMLInputElement;
								handleCheckboxChange(choice.identifier, target.checked, target);
							}}
							{disabled}
						/>
						<div id={textId} part="text" class="qti-choice-text qti-rich-content">
							{@html choice.text}
						</div>
						{#if isCorrectChoice(choice.identifier)}
							<span class="badge badge-success badge-sm">{t('interactions.choice.correct', 'Correct')}</span>
						{/if}
					</label>
					{/if}
					{#if eliminationTool}
						<button
							type="button"
							part="eliminate"
							class="qti-eliminate-btn"
							aria-labelledby={`${eliminationVerbId(choice.identifier)} ${textId}`}
							aria-pressed={elimination.isEliminated(choice.identifier)}
							onclick={() => elimination.toggle(choice.identifier)}
						><span class="sr-only" id={eliminationVerbId(choice.identifier)}>{eliminationLabel(choice.identifier)}</span>✕</button>
					{/if}
				</div>
			{/each}
		{/if}
		{#if canClearAnswer}
			<button type="button" part="clear" class="qti-clear-btn" onclick={clearAnswer}>
				{t('interactions.choice.clearAnswer', 'Clear answer')}
			</button>
		{/if}
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(parsedResponse ?? null)} />
		{#if showMaxMessage}
			<p class="qti-selection-message qti-max-selection-message" role="alert">{maxMessage}</p>
		{/if}
	</div>
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-choice-shell {
		/* Reflow (WCAG 1.4.10): the shell is the query container the stacking/horizontal
		   grids collapse against on narrow widths. */
		container-type: inline-size;
	}
	.qti-choice-interaction {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.5rem;
	}
	/* Prompt, description and messages span the full row so the stacking/horizontal
	   grids arrange the choices themselves. */
	.qti-choice-interaction > :global(:not(.qti-choice-option)) {
		grid-column: 1 / -1;
	}
	.qti-choice-prompt {
		margin: 0 0 0.25rem;
	}
	.qti-choice-option {
		display: block;
		position: relative;
	}

	.qti-choice-label {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		/* K-12 target size: the whole row is the touch/click target (WCAG 2.5.8 exceeds AA). */
		min-height: 2.75rem;
		padding: 0.375rem 0.75rem;
		border: 2px solid transparent;
		border-radius: 0.5rem;
	}

	/* Selected affordance: border weight + background + the native checked control, so the
	   state never relies on color alone (WCAG 1.4.1). */
	.qti-choice-interaction .qti-choice-label[data-selected] {
		border-color: var(--pie-qti-primary, oklch(45% 0.24 277));
		background-color: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 7%, transparent);
	}

	/* Focus visible on the whole row, including when the native control is hidden
	   (qti-input-control-hidden) and paints no focus ring of its own (WCAG 2.4.7). */
	.qti-choice-label:has(input:focus-visible) {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}
	/* Fallback for engines without :has() */
	@supports not selector(:has(*)) {
		.qti-choice-label:focus-within {
			outline: 2px solid var(--pie-qti-focus, #4338ca);
			outline-offset: 2px;
		}
	}

	.qti-choice-text {
		display: block;
		/* K-12 readability: base choice text at 1rem, not the smaller UI label size. */
		font-size: 1rem;
		line-height: 1.4;
		min-width: 0;
	}
	.qti-choice-text > :global(:first-child) {
		margin-top: 0;
	}
	.qti-choice-text > :global(:last-child) {
		margin-bottom: 0;
	}
	.qti-choice-text :global(:is(p, ul, ol, blockquote, pre, table):first-child) {
		margin-top: 0;
	}
	.qti-choice-text :global(:is(p, ul, ol, blockquote, pre, table):last-child) {
		margin-bottom: 0;
	}
	.qti-choice-interaction input[type='radio'],
	.qti-choice-interaction input[type='checkbox'] {
		margin: 0;
		width: 1.25rem;
		height: 1.25rem;
		flex: 0 0 auto;
	}

	/* Clear answer (single choice) */
	.qti-clear-btn {
		justify-self: start;
		min-height: 2.75rem;
		padding: 0.375rem 1rem;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.qti-clear-btn:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* Correct answer highlighting */
	.qti-choice-correct {
		background-color: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 8%, transparent);
		border-radius: 0.5rem;
		padding: 0.25rem 0.5rem;
		margin: -0.25rem -0.5rem;
	}

	.radio-success,
	.checkbox-success {
		accent-color: var(--pie-qti-success, oklch(76% 0.177 163.223));
	}

	/* Elimination tool */
	.qti-has-elimination .qti-choice-option {
		padding-inline-end: 3.5rem;
	}

	.qti-eliminate-btn {
		position: absolute;
		inset-inline-end: 0.25rem;
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 999px;
		width: 2.75rem;
		height: 2.75rem;
		line-height: 1;
		font-size: 1rem;
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: inherit;
	}

	.qti-eliminate-btn:hover {
		background-color: color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 8%, transparent);
	}

	.qti-eliminate-btn:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* Eliminated choices are dimmed but stay readable, with a strikethrough */
	[data-eliminated] .qti-choice-label {
		opacity: 0.7;
		text-decoration: line-through;
	}

	[data-eliminated] .qti-eliminate-btn {
		color: var(--pie-qti-error-text, #b91c1c);
		border-color: var(--pie-qti-error-text, #b91c1c);
	}

	/* Answer masking */
	.qti-reveal-btn {
		width: 100%;
		min-height: 2.75rem;
		text-align: start;
		padding: 0.5rem 0.75rem;
		border: 1px dashed var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		background: var(--pie-qti-base-200, transparent);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.qti-reveal-btn:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* ── QTI Shared Vocabulary behavioral classes ─────────────────────────── */

	/* qti-input-control-hidden: hide radio/checkbox controls but keep keyboard-accessible */
	:global(.qti-input-control-hidden) .qti-choice-interaction input[type='radio'],
	:global(.qti-input-control-hidden) .qti-choice-interaction input[type='checkbox'],
	.qti-choice-interaction.qti-input-control-hidden input[type='radio'],
	.qti-choice-interaction.qti-input-control-hidden input[type='checkbox'] {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}

	/* qti-orientation-horizontal: choices in a row; auto-fit reflows to one column
	   when the container is too narrow (WCAG 1.4.10) */
	.qti-choice-interaction.qti-orientation-horizontal {
		grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
	}

	/* qti-choices-stacking-N: N-column grid */
	.qti-choice-interaction.qti-choices-stacking-1 { grid-template-columns: minmax(0, 1fr); }
	.qti-choice-interaction.qti-choices-stacking-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.qti-choice-interaction.qti-choices-stacking-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.qti-choice-interaction.qti-choices-stacking-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
	.qti-choice-interaction.qti-choices-stacking-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }

	/* Reflow: multi-column layouts collapse to one column on narrow containers */
	@container (max-width: 40rem) {
		.qti-choice-interaction[class*='qti-choices-stacking-'] {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	/* Fallback for engines without container queries */
	@supports not (container-type: inline-size) {
		@media (max-width: 40rem) {
			.qti-choice-interaction[class*='qti-choices-stacking-'] {
				grid-template-columns: minmax(0, 1fr);
			}
		}
	}

	/* qti-orientation-vertical: the default single column, stated explicitly */
	.qti-choice-interaction.qti-orientation-vertical {
		grid-template-columns: minmax(0, 1fr);
	}

	/* qti-labels-*: generated choice labels, part of each choice's accessible name */
	.qti-choice-interaction {
		counter-reset: qti-choice;
		--qti-label-suffix: '.';
	}
	.qti-choice-option {
		counter-increment: qti-choice;
	}
	.qti-choice-interaction.qti-labels-suffix-none { --qti-label-suffix: ''; }
	.qti-choice-interaction.qti-labels-suffix-period { --qti-label-suffix: '.'; }
	.qti-choice-interaction.qti-labels-suffix-parenthesis { --qti-label-suffix: ')'; }
	.qti-choice-interaction:is(.qti-labels-decimal, .qti-labels-lower-alpha, .qti-labels-upper-alpha, .qti-labels-cjk-ideographic) .qti-choice-text::before {
		float: inline-start;
		margin-inline-end: 0.5em;
		font-weight: 600;
	}
	.qti-choice-interaction.qti-labels-decimal .qti-choice-text::before {
		content: counter(qti-choice, decimal) var(--qti-label-suffix);
	}
	.qti-choice-interaction.qti-labels-lower-alpha .qti-choice-text::before {
		content: counter(qti-choice, lower-alpha) var(--qti-label-suffix);
	}
	.qti-choice-interaction.qti-labels-upper-alpha .qti-choice-text::before {
		content: counter(qti-choice, upper-alpha) var(--qti-label-suffix);
	}
	.qti-choice-interaction.qti-labels-cjk-ideographic .qti-choice-text::before {
		content: counter(qti-choice, cjk-ideographic) var(--qti-label-suffix);
	}

	/* qti-writing-orientation-vertical-*: vertical CJK and Mongolian layout, labels upright */
	.qti-choice-interaction.qti-writing-orientation-vertical-rl { writing-mode: vertical-rl; }
	.qti-choice-interaction.qti-writing-orientation-vertical-lr { writing-mode: vertical-lr; }
	.qti-choice-interaction:is(.qti-writing-orientation-vertical-rl, .qti-writing-orientation-vertical-lr) .qti-choice-text::before {
		text-orientation: upright;
	}

	/* Selection limit messages (WCAG 1.4.3): warning-text token for contrast */
	.qti-selection-message {
		font-size: 0.875rem;
		color: var(--pie-qti-warning-text, #92400e);
		margin-top: 0.5rem;
	}
</style>
