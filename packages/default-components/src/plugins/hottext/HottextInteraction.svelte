<svelte:options customElement="pie-qti-hottext" />

<script lang="ts">
	import type { HottextInteractionData } from '@pie-qti/item-player';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { HOTTEXT_SELECTOR } from './hottextSelector';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';

	interface Props {
		interaction?: HottextInteractionData | string;
		response?: string | string[] | null;
		correctResponse?: string | string[] | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		onChange?: (value: string | string[] | null) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), onChange }: Props = $props();

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<HottextInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string | string[]>(response));
	const parsedCorrectResponse = $derived(parseJsonProp<string | string[]>(correctResponse));
	const isShowingCorrect = $derived(role === 'scorer' && parsedCorrectResponse !== null);

	// Get correct IDs as array
	const correctIds = $derived.by(() => {
		if (!isShowingCorrect) return [];
		if (Array.isArray(parsedCorrectResponse)) {
			return parsedCorrectResponse;
		}
		return parsedCorrectResponse ? [parsedCorrectResponse] : [];
	});

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	let selectedIds = $state<string[]>([]);

	$effect(() => {
		// Sync with parent response changes
		// Handle both single string (maxChoices=1) and array (maxChoices>1) formats
		if (Array.isArray(parsedResponse)) {
			selectedIds = [...parsedResponse];
		} else if (typeof parsedResponse === 'string') {
			selectedIds = [parsedResponse];
		} else {
			selectedIds = [];
		}
	});
	let contentElement: HTMLDivElement | null = $state(null);

	// Unique id prefix so the aria-labelledby parts survive several hottext interactions
	// (or two renderings of the same item) in one document.
	const uid = $props.id();

	/** Sanitize an identifier for use in an element id. */
	function safeId(identifier: string): string {
		return identifier.replace(/[^A-Za-z0-9_-]/g, '-');
	}

	/**
	 * Check if selection limit has been reached
	 */
	// maxChoices=0 means unlimited per QTI spec
	const canSelectMore = $derived(
		parsedInteraction
			? parsedInteraction.maxChoices === 0 || selectedIds.length < parsedInteraction.maxChoices
			: false
	);

	// An unselected hottext can still be chosen: below the cap, or always when a single
	// selection switches (maxChoices=1). Drives the visible "selectable" cue.
	const canChooseUnselected = $derived(
		parsedInteraction ? parsedInteraction.maxChoices === 1 || canSelectMore : false
	);

	/**
	 * Check if a hottext element is selected
	 */
	function isSelected(identifier: string): boolean {
		return selectedIds.includes(identifier);
	}

	/**
	 * Check if a hottext element is correct
	 */
	function isCorrect(identifier: string): boolean {
		return isShowingCorrect && correctIds.includes(identifier);
	}

	/**
	 * Give each hottext a structured accessible name: the rendered content plus a
	 * localized state word, referenced with `aria-labelledby` instead of flattened
	 * `textContent`. Returns the ids to reference.
	 */
	function ensureAccessibleNameStructure(htmlElem: HTMLElement, identifier: string): { textId: string; stateId: string; correctId: string } {
		const textId = `${uid}-hottext-text-${safeId(identifier)}`;
		const stateId = `${uid}-hottext-state-${safeId(identifier)}`;
		const correctId = `${uid}-hottext-correct-${safeId(identifier)}`;

		let textSpan = htmlElem.querySelector<HTMLSpanElement>(':scope > [data-hottext-text]');
		if (!textSpan) {
			// Wrap the rendered content once so `aria-labelledby` can point at it.
			textSpan = document.createElement('span');
			textSpan.setAttribute('data-hottext-text', '');
			while (htmlElem.firstChild) textSpan.appendChild(htmlElem.firstChild);
			htmlElem.appendChild(textSpan);
		}
		textSpan.id = textId;

		let stateSpan = htmlElem.querySelector<HTMLSpanElement>(':scope > [data-hottext-state]');
		if (!stateSpan) {
			stateSpan = document.createElement('span');
			stateSpan.setAttribute('data-hottext-state', '');
			stateSpan.classList.add('sr-only');
			htmlElem.appendChild(stateSpan);
		}
		stateSpan.id = stateId;

		return { textId, stateId, correctId };
	}

	/**
	 * Handle hottext element click.
	 *
	 * Selection semantics match ChoiceInteraction where the widgets overlap:
	 * - `maxChoices=1` (single cardinality) is radio-like: selecting another hottext
	 *   replaces the current selection instead of being refused.
	 * - Activating a selected hottext deselects it for every cardinality: each span is an
	 *   `aria-pressed` toggle button, and removing a selection never exceeds `maxChoices`.
	 * - With `maxChoices>1`, a selection beyond the cap is refused; the cap message explains it.
	 */
	function handleHottextClick(identifier: string) {
		if (disabled || !parsedInteraction) return;

		if (isSelected(identifier)) {
			// Deselect
			selectedIds = selectedIds.filter((id) => id !== identifier);
		} else if (parsedInteraction.maxChoices === 1) {
			// Switch: the new hottext replaces the previous selection
			selectedIds = [identifier];
		} else if (canSelectMore) {
			// Select
			selectedIds = [...selectedIds, identifier];
		} else {
			// Refused at the cap: nothing changes, so nothing is emitted
			return;
		}

		// Return single string for maxChoices=1, array for multiple selection
		const responseValue = parsedInteraction.maxChoices === 1
			? (selectedIds.length > 0 ? selectedIds[0] : null)
			: selectedIds;

		response = responseValue;
		// Emit unconditionally: a null value is the deselect/clear signal the player listens for.
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: responseValue, onChange });
		updateHottextStyles();
	}

	/**
	 * Update visual styles of hottext elements based on selection state
	 */
	function updateHottextStyles() {
		if (!contentElement) return;

		const hottextElements = contentElement.querySelectorAll(HOTTEXT_SELECTOR);
		hottextElements.forEach((elem: Element) => {
			const identifier = elem.getAttribute('identifier');
			if (identifier) {
				const htmlElem = elem as HTMLElement;
				const selected = isSelected(identifier);

				// Update ARIA state
				htmlElem.setAttribute('aria-pressed', selected ? 'true' : 'false');

				// Update the localized state word in the accessible name
				const stateSpan = htmlElem.querySelector<HTMLElement>(':scope > [data-hottext-state]');
				if (stateSpan) {
					stateSpan.textContent = translate(
						i18n,
						selected ? 'interactions.hottext.selectedState' : 'interactions.hottext.selectableState',
						selected ? 'Selected' : 'Selectable'
					);
				}

				// Update classes
				const isCorrectChoice = isCorrect(identifier);
				if (selected) {
					htmlElem.classList.add('selected');
					htmlElem.classList.remove('selectable');
				} else {
					htmlElem.classList.remove('selected');
					if (canChooseUnselected && !disabled) {
						htmlElem.classList.add('selectable');
					} else {
						htmlElem.classList.remove('selectable');
					}
				}
				if (isCorrectChoice) {
					htmlElem.classList.add('correct');
				} else {
					htmlElem.classList.remove('correct');
				}

				// Scorer view: mark correct hottexts with more than color — a hidden
				// "Correct answer" phrase joins the accessible name (WCAG 1.4.1).
				const textSpan = htmlElem.querySelector<HTMLElement>(':scope > [data-hottext-text]');
				let correctSpan = htmlElem.querySelector<HTMLElement>(':scope > [data-hottext-correct]');
				if (isCorrectChoice) {
					if (!correctSpan) {
						correctSpan = document.createElement('span');
						correctSpan.setAttribute('data-hottext-correct', '');
						correctSpan.classList.add('sr-only');
						htmlElem.appendChild(correctSpan);
					}
					correctSpan.id = `${uid}-hottext-correct-${safeId(identifier)}`;
					correctSpan.textContent = translate(
						i18n,
						'accessibility.correctAnswerIs',
						'Correct answer: {answer}.',
						{ answer: textSpan?.textContent?.trim() ?? identifier }
					);
				} else {
					correctSpan?.remove();
				}

				// Accessible name = rendered content + localized state (+ correct marker)
				const labelIds: string[] = [];
				if (textSpan?.id) labelIds.push(textSpan.id);
				if (stateSpan?.id) labelIds.push(stateSpan.id);
				if (isCorrectChoice && correctSpan?.id) labelIds.push(correctSpan.id);
				if (labelIds.length > 0) {
					htmlElem.setAttribute('aria-labelledby', labelIds.join(' '));
				}
			}
		});
	}

	/**
	 * Initialize hottext elements with click handlers and keyboard accessibility
	 */
	$effect(() => {
		if (!contentElement) return;

		const hottextElements = contentElement.querySelectorAll(HOTTEXT_SELECTOR);
		hottextElements.forEach((elem: Element) => {
			const identifier = elem.getAttribute('identifier');
			if (identifier) {
				const htmlElem = elem as HTMLElement;

				// Make it visually interactive
				htmlElem.style.cursor = disabled ? 'default' : 'pointer';
				htmlElem.style.padding = '2px 4px';
				htmlElem.style.borderRadius = '3px';
				htmlElem.style.transition = 'all 0.2s';

				// Make keyboard accessible
				htmlElem.setAttribute('role', 'button');
				htmlElem.setAttribute('tabindex', disabled ? '-1' : '0');
				htmlElem.setAttribute('aria-pressed', isSelected(identifier) ? 'true' : 'false');

				// Structured accessible name from the rendered content + a localized state
				ensureAccessibleNameStructure(htmlElem, identifier);

				// Add click handler
				htmlElem.onclick = () => handleHottextClick(identifier);

				// Add keyboard handler
				htmlElem.onkeydown = (e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleHottextClick(identifier);
					}
				};
			}
		});

		updateHottextStyles();
	});

	/**
	 * Update styles when selection or disabled state changes
	 */
	$effect(() => {
		updateHottextStyles();
	});

	// Selection limit message: an authored message is shown at the cap for any cardinality;
	// without one, a localized default is shown whenever a selection can actually be refused
	// (maxChoices>1). Single selection switches instead of refusing, so it needs no default.
	// Same rule as ChoiceInteraction (WCAG 3.3.1 / 4.1.3).
	const maxChoices = $derived(parsedInteraction?.maxChoices ?? 0);
	const maxMessage = $derived.by(() => {
		const authored = parsedInteraction?.maxSelectionsMessage;
		if (authored) return authored;
		return translate(
			i18n,
			'interactions.hottext.maxChoicesReached',
			'You can select up to {max}. Deselect one to choose another.',
			{ max: maxChoices }
		);
	});
	const showMaxMessage = $derived(
		maxChoices > 0 && selectedIds.length >= maxChoices && (!!parsedInteraction?.maxSelectionsMessage || maxChoices > 1)
	);
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class={['qti-hottext-interaction space-y-3', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-hottext-prompt qti-rich-content font-semibold">
				{@html parsedInteraction.prompt}
			</div>
		{/if}

		<div
			bind:this={contentElement}
			part="content"
			class="hottext-content qti-hottext-content qti-rich-content prose max-w-none"
			role="group"
			aria-label={translate(i18n, 'interactions.hottext.ariaLabel', 'Text selection interaction')}
		>
			{@html parsedInteraction.contentHtml}
		</div>

		<div part="footer" class="qti-hottext-footer flex items-center justify-between text-sm text-base-content/70">
			<div>
				<span class="font-medium">{translate(i18n, 'interactions.hottext.selected', 'Selected:')}</span>
				<span class="ms-2">{selectedIds.length} / {parsedInteraction.hottextChoices?.length ?? 0}</span>
				{#if parsedInteraction.minChoices > 0}
					{#if selectedIds.length >= parsedInteraction.minChoices}
						<span class="badge badge-success badge-sm ms-2">✓ {translate(i18n, 'interactions.hottext.minimumMet', 'Minimum met')}</span>
					{:else}
						<span class="badge badge-warning badge-sm ms-2">{translate(i18n, 'interactions.hottext.selectAtLeast', `Select at least ${parsedInteraction.minChoices}`, { minChoices: parsedInteraction.minChoices })}</span>
					{/if}
				{/if}
			</div>

			{#if selectedIds.length > 0}
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					onclick={() => {
						selectedIds = [];
						// Return null for single selection, empty array for multiple
						const responseValue = parsedInteraction!.maxChoices === 1 ? null : [];
						response = responseValue;
						emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: responseValue, onChange });
						updateHottextStyles();
					}}
					{disabled}
				>
					{translate(i18n, 'interactions.hottext.clearSelection', 'Clear Selection')}
				</button>
			{/if}
		</div>
		{#if showMaxMessage}
			<p class="qti-selection-message" role="alert">{maxMessage}</p>
		{/if}
	{/if}
</div>

<style>
	.qti-selection-message {
		font-size: 0.875rem;
		color: var(--pie-qti-warning-text, #92400e);
		margin-top: 0.25rem;
	}

	/* qti-input-control-hidden: hide visual selection indicators but keep keyboard-accessible.
	   The control keeps its focus ring: focus must stay visible (WCAG 2.4.7). */
	.qti-input-control-hidden :global(hottext),
	.qti-input-control-hidden :global(qti-hottext) {
		cursor: pointer;
	}
	.qti-input-control-hidden :global(hottext[data-selected]),
	.qti-input-control-hidden :global(qti-hottext[data-selected]) {
		background-color: transparent;
		text-decoration: underline;
	}

	/* Focus must stay visible in every mode, including with hidden input controls */
	:global(.hottext-content hottext:focus-visible),
	:global(.hottext-content qti-hottext:focus-visible) {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* qti-unselected-hidden: unselected hottexts read as plain text until focused; they stay operable */
	.qti-unselected-hidden :global(.hottext-content :is(hottext, qti-hottext):not(.selected):not(:focus-visible)) {
		background-color: transparent;
		border-color: transparent;
	}

	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-hottext-interaction {
		display: grid;
		gap: 0.75rem;
	}
	.qti-hottext-prompt {
		margin: 0;
	}
	.qti-hottext-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	:global(.hottext-content hottext),
	:global(.hottext-content qti-hottext) {
		display: inline;
		user-select: none;
	}

	/* Selectable cue (WCAG 1.4.11): a border at 3:1 against the background, not a faint fill */
	:global(.hottext-content hottext.selectable),
	:global(.hottext-content qti-hottext.selectable) {
		background-color: color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 6%, transparent);
		border: 1px solid var(--pie-qti-border-strong, #767676);
	}

	:global(.hottext-content hottext.selectable:hover),
	:global(.hottext-content qti-hottext.selectable:hover) {
		background-color: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 20%, transparent);
		border-color: var(--pie-qti-border-strong, #767676);
	}

	:global(.hottext-content hottext.selected),
	:global(.hottext-content qti-hottext.selected) {
		background-color: color-mix(in oklch, var(--pie-qti-primary, oklch(45% 0.24 277)) 30%, transparent);
		border: 2px solid var(--pie-qti-primary, oklch(45% 0.24 277));
		font-weight: 600;
	}

	/* Scorer view: correct hottexts get an underline in addition to the color change (WCAG 1.4.1) */
	:global(.hottext-content hottext.correct),
	:global(.hottext-content qti-hottext.correct) {
		background-color: color-mix(in oklch, var(--pie-qti-success, oklch(76% 0.177 163.223)) 8%, transparent);
		border: 1px solid var(--pie-qti-success, oklch(76% 0.177 163.223));
		border-radius: 0.25rem;
		padding: 2px 4px;
		margin: -2px -4px;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.15em;
	}
</style>
