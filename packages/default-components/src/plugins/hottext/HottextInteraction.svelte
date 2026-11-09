<svelte:options customElement="pie-qti-hottext" />

<script lang="ts">
	import type { HottextInteractionData } from '@pie-qti/item-player';
	import { tick } from 'svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { translate, type I18nProvider } from '@pie-qti/i18n';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';
	import { HOTTEXT_SELECTOR } from './hottextSelector';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import { radioArrowStep, wrapIndex } from '../../shared/utils/radioGroup';
	import { accessibleTextFromHtml } from '../../shared/utils/accessibleText';
	import { choiceAccessibleName } from '../../shared/utils/choiceName';
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

	// Parse props that may be JSON strings (web component usage). Correct-answer mode is the
	// scorer's view of an item that has a correct response (the shared shell's rule).
	const shell = $derived(
		createInteractionShell<HottextInteractionData, string | string[], string | string[]>({
			interaction,
			response,
			correctResponse,
			role,
		}),
	);
	const parsedInteraction = $derived(shell.interaction);
	const parsedResponse = $derived(shell.response);
	const parsedCorrectResponse = $derived(shell.correctResponse);
	const isShowingCorrect = $derived(shell.isShowingCorrect);

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

	// Single cardinality (maxChoices=1) is a radio group: one checked hottext, which another
	// one replaces and which activating it again never unchecks. Multiple selection keeps
	// aria-pressed toggle buttons, checkbox-like.
	const isSingle = $derived(parsedInteraction?.maxChoices === 1);

	// An unselected hottext can still be chosen: below the cap, or always when a single
	// selection switches (maxChoices=1). Drives the visible "selectable" cue.
	const canChooseUnselected = $derived(parsedInteraction ? isSingle || canSelectMore : false);

	/**
	 * Check if a hottext element is selected
	 */
	function isSelected(identifier: string): boolean {
		return selectedIds.includes(identifier);
	}

	/**
	 * The passage's hottext elements that carry an identifier, in document order.
	 */
	function hottextElements(): HTMLElement[] {
		if (!contentElement) return [];
		return Array.from(contentElement.querySelectorAll<HTMLElement>(HOTTEXT_SELECTOR)).filter(
			(elem) => !!elem.getAttribute('identifier')
		);
	}

	/**
	 * Check if a hottext element is correct
	 */
	function isCorrect(identifier: string): boolean {
		return isShowingCorrect && correctIds.includes(identifier);
	}

	/**
	 * Give each hottext a structured accessible name, referenced with `aria-labelledby`
	 * instead of a flattened `textContent` label: its rendered content, wrapped once so the
	 * name can point at it. Content with nothing to read (an empty hottext) is named by a
	 * hidden, localized ordinal of its position in reading order ("Choice 2"), never by its
	 * identifier. The selection state is not part of the name: `aria-checked` (radio) or
	 * `aria-pressed` (toggle button) carries it, so it is announced once and the name stays
	 * the same as the selection changes.
	 */
	function ensureAccessibleNameStructure(htmlElem: HTMLElement, identifier: string, position: number): void {
		let textSpan = htmlElem.querySelector<HTMLSpanElement>(':scope > [data-hottext-text]');
		if (!textSpan) {
			// Wrap the rendered content once so `aria-labelledby` can point at it.
			textSpan = document.createElement('span');
			textSpan.setAttribute('data-hottext-text', '');
			while (htmlElem.firstChild) textSpan.appendChild(htmlElem.firstChild);
			htmlElem.appendChild(textSpan);
		}
		textSpan.id = `${uid}-hottext-text-${safeId(identifier)}`;

		const label = accessibleTextFromHtml(textSpan.innerHTML);
		let fallbackSpan = htmlElem.querySelector<HTMLSpanElement>(':scope > [data-hottext-fallback]');
		if (label) {
			fallbackSpan?.remove();
			return;
		}
		if (!fallbackSpan) {
			fallbackSpan = document.createElement('span');
			fallbackSpan.setAttribute('data-hottext-fallback', '');
			fallbackSpan.classList.add('sr-only');
			htmlElem.appendChild(fallbackSpan);
		}
		fallbackSpan.id = `${uid}-hottext-fallback-${safeId(identifier)}`;
		fallbackSpan.textContent = choiceAccessibleName({ i18n, label, position });
	}

	/** The element that names a hottext: its content, or the positional fallback when that is empty. */
	function nameElement(htmlElem: HTMLElement): HTMLElement | null {
		return (
			htmlElem.querySelector<HTMLElement>(':scope > [data-hottext-fallback]') ??
			htmlElem.querySelector<HTMLElement>(':scope > [data-hottext-text]')
		);
	}

	/**
	 * Handle hottext activation: click or tap, Enter or Space, or an arrow key in the radio group.
	 *
	 * Selection semantics match ChoiceInteraction where the widgets overlap:
	 * - `maxChoices=1` (single cardinality) is a radio group, like ChoiceInteraction's native
	 *   radios: selecting another hottext replaces the current selection, and activating the
	 *   checked hottext again keeps it. "Clear answer" is the explicit way to retract it.
	 * - With `maxChoices>1` each span is an `aria-pressed` toggle button, checkbox-like:
	 *   activating a selected hottext deselects it, which never exceeds `maxChoices`, and a
	 *   selection beyond the cap is refused; the cap message explains it.
	 */
	function handleHottextClick(identifier: string) {
		if (disabled || !parsedInteraction) return;

		if (isSingle) {
			// A checked radio stays checked: nothing changes, so nothing is emitted
			if (isSelected(identifier)) return;
			// Switch: the new hottext replaces the previous selection
			selectedIds = [identifier];
		} else if (isSelected(identifier)) {
			// Toggle off
			selectedIds = selectedIds.filter((id) => id !== identifier);
		} else if (canSelectMore) {
			// Select
			selectedIds = [...selectedIds, identifier];
		} else {
			// Refused at the cap: nothing changes, so nothing is emitted
			return;
		}

		// Return single string for maxChoices=1, array for multiple selection
		const responseValue = isSingle ? (selectedIds[0] ?? null) : selectedIds;

		response = responseValue;
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: responseValue, onChange });
		updateHottextStyles();
	}

	/**
	 * Keyboard model. Enter and Space activate the focused hottext in either mode. In the
	 * radio group (single selection) the arrow keys move focus to the next or previous
	 * hottext, wrapping at the ends, and check it (WAI-ARIA APG radio group pattern); Tab
	 * leaves the group from its one tab stop. Toggle buttons (multiple selection) are each a
	 * Tab stop and leave the arrow keys alone, so the text can still be read and scrolled.
	 */
	function handleHottextKeydown(event: KeyboardEvent, htmlElem: HTMLElement, identifier: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleHottextClick(identifier);
			return;
		}
		if (!isSingle || disabled) return;
		const step = radioArrowStep(event, htmlElem);
		if (step === 0) return;
		event.preventDefault();

		const radios = hottextElements();
		const index = radios.indexOf(htmlElem);
		if (index < 0) return;
		const next = radios[wrapIndex(index, step, radios.length)];
		const nextId = next?.getAttribute('identifier');
		if (!next || !nextId) return;
		next.focus();
		handleHottextClick(nextId);
	}

	// Clear answer: the visible way to retract the whole answer, with the same name and the
	// same rule as ChoiceInteraction's control (WCAG 3.2.4): offered only while there is an
	// answer to retract and the interaction is enabled.
	const canClearAnswer = $derived(selectedIds.length > 0 && !disabled);

	/**
	 * Retract the whole answer. The control removes itself with the answer, which would drop
	 * keyboard focus to the document; focus moves to the first hottext instead — the radio
	 * group's tab stop once nothing is checked — as ChoiceInteraction focuses its first radio.
	 */
	async function clearAnswer() {
		if (disabled || !parsedInteraction) return;
		selectedIds = [];
		// Return null for single selection, empty array for multiple
		const responseValue = isSingle ? null : [];
		response = responseValue;
		// Emit unconditionally: a null value is the clear signal the player listens for.
		emitInteractionChange({ target: rootElement, responseId: parsedInteraction?.responseId, value: responseValue, onChange });
		updateHottextStyles();
		await tick();
		hottextElements()[0]?.focus();
	}

	/**
	 * Update the ARIA state, tab order and visual styles of the hottext elements from the
	 * selection, cardinality and disabled state.
	 */
	function updateHottextStyles() {
		const elements = hottextElements();
		if (elements.length === 0) return;

		// Roving tabindex (single selection): the radio group is one tab stop, the checked
		// radio or else the first one, and the arrow keys move within it.
		const tabStop = isSingle
			? (elements.find((elem) => isSelected(elem.getAttribute('identifier') ?? '')) ?? elements[0])
			: null;

		for (const htmlElem of elements) {
			const identifier = htmlElem.getAttribute('identifier');
			if (identifier) {
				const selected = isSelected(identifier);

				// Update ARIA state: a radio is checked, a toggle button is pressed
				if (isSingle) {
					htmlElem.setAttribute('aria-checked', selected ? 'true' : 'false');
					htmlElem.removeAttribute('aria-pressed');
				} else {
					htmlElem.setAttribute('aria-pressed', selected ? 'true' : 'false');
					htmlElem.removeAttribute('aria-checked');
				}

				// Tab order: none while disabled, one stop for the radio group, every toggle button
				const tabbable = !disabled && (!isSingle || htmlElem === tabStop);
				htmlElem.setAttribute('tabindex', tabbable ? '0' : '-1');
				// A disabled hottext says so, as a disabled native control does
				if (disabled) {
					htmlElem.setAttribute('aria-disabled', 'true');
				} else {
					htmlElem.removeAttribute('aria-disabled');
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
				const nameSource = nameElement(htmlElem);
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
						{ answer: accessibleTextFromHtml(nameSource?.innerHTML) }
					);
				} else {
					correctSpan?.remove();
				}

				// Accessible name = rendered content, or its positional fallback (+ correct marker).
				// Never the state: aria-checked / aria-pressed carry it.
				const labelIds: string[] = [];
				if (nameSource?.id) labelIds.push(nameSource.id);
				if (isCorrectChoice && correctSpan?.id) labelIds.push(correctSpan.id);
				if (labelIds.length > 0) {
					htmlElem.setAttribute('aria-labelledby', labelIds.join(' '));
				}
			}
		}
	}

	/**
	 * Initialize hottext elements with click handlers and keyboard accessibility
	 */
	$effect(() => {
		if (!contentElement) return;
		// Single selection is a radio group; multiple selection keeps toggle buttons.
		// The spans stay inline in the running text either way.
		const role = isSingle ? 'radio' : 'button';

		for (const [index, htmlElem] of hottextElements().entries()) {
			const identifier = htmlElem.getAttribute('identifier');
			if (identifier) {
				// Make it visually interactive
				htmlElem.style.cursor = disabled ? 'default' : 'pointer';
				htmlElem.style.padding = '2px 4px';
				htmlElem.style.borderRadius = '3px';
				htmlElem.style.transition = 'all 0.2s';

				// Make keyboard accessible; ARIA state and tab order follow in updateHottextStyles()
				htmlElem.setAttribute('role', role);

				// Structured accessible name from the rendered content (or its 1-based position)
				ensureAccessibleNameStructure(htmlElem, identifier, index + 1);

				// Add click handler
				htmlElem.onclick = () => handleHottextClick(identifier);

				// Add keyboard handler
				htmlElem.onkeydown = (event: KeyboardEvent) => handleHottextKeydown(event, htmlElem, identifier);
			}
		}

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

		<!-- Single selection: a radio group (role="radio" spans, roving tabindex, arrow keys).
		     Multiple selection: a group of aria-pressed toggle buttons. -->
		<div
			bind:this={contentElement}
			part="content"
			class="hottext-content qti-hottext-content qti-rich-content prose max-w-none"
			role={isSingle ? 'radiogroup' : 'group'}
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

			<!-- Same name and rule as ChoiceInteraction's "Clear answer" (WCAG 3.2.4) -->
			{#if canClearAnswer}
				<button
					type="button"
					part="clear"
					class="btn btn-sm btn-ghost"
					onclick={clearAnswer}
				>
					{translate(i18n, 'interactions.choice.clearAnswer', 'Clear answer')}
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
