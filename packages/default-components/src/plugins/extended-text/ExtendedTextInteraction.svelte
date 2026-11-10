<svelte:options customElement="pie-qti-extended-text" />

<script lang="ts">
	import type { ExtendedTextInteractionData, PnpProfile } from '@pie-qti/item-player';
	import { tick, untrack } from 'svelte';
	import { xsdPatternToRegExp } from '@pie-qti/qti-processing';
	import { emitInteractionChange, emitQtiChange } from '../../shared/utils/eventHelpers';
	import {
		createExtendedTextResponse,
		createExtendedTextStringResponse,
		extendedTextResponseToStrings,
	} from '@pie-qti/item-player';
	import { interactionAria } from '../../shared/utils/interactionAria';
	import InteractionDescription from '../../shared/components/InteractionDescription.svelte';
	import MinimumRequirementHint from '../../shared/components/MinimumRequirementHint.svelte';
	import { minimumHint } from '../../shared/utils/minimumRequirement';
	import { translate, translatePlural, type I18nProvider } from '@pie-qti/i18n';
	import RichTextEditor from '../../shared/components/RichTextEditor.svelte';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createInteractionShell, parseJsonProp } from '../../shared/utils/webComponentHelpers';
	import { isLimited } from '../../shared/utils/capacity';
	import {
		characterCount,
		isSpellcheckAllowed,
		patternMaskMessage,
		reachedExpectedLength,
		responseInputMode,
		writingAssistance,
	} from './textInput';

	interface Props {
		interaction?: ExtendedTextInteractionData | string;
		response?: unknown;
		/** Lexical response held by the declaration named by stringIdentifier. */
		stringResponse?: unknown;
		correctResponse?: unknown;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		/**
		 * The candidate's Personal Needs and Preferences profile (or its JSON). Its
		 * spell-checker grant opts the fields into spelling help like the
		 * `spellcheck` prop does.
		 */
		pnp?: PnpProfile | string;
		/**
		 * Allow the browser's spell check and autocorrect in the response fields.
		 * Off by default, so spelling and writing items give every candidate the
		 * same help; a host turns it on for a candidate whose needs grant it —
		 * through this prop or the candidate's PNP spell-checker grant.
		 * Accepts `true`/`"true"` (or the bare attribute) on the custom element.
		 */
		spellcheck?: boolean | string;
		onChange?: (value: unknown) => void;
	}

	let {
		interaction = $bindable(),
		response = $bindable(),
		stringResponse = $bindable(),
		correctResponse = $bindable(),
		disabled = false,
		role = 'candidate',
		i18n = $bindable(),
		typeset,
		pnp,
		spellcheck = false,
		onChange,
	}: Props = $props();

	const shell = $derived(
		createInteractionShell<ExtendedTextInteractionData, unknown, unknown>({
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
	let editorValues: string[] = $state(['']);
	let lastRenderedResponse: unknown;
	let lastInteractionShape = '';

	// The editable field of each response region, to move focus after add/remove.
	let textareas: Array<HTMLTextAreaElement | null> = $state([]);
	let richEditors: Array<{ focus: () => void } | null> = $state([]);

	// Polite live region: threshold and removal messages only, never per keystroke.
	let liveMessage = $state('');
	let liveToggle = false;

	// Fields whose text failed the pattern mask when the candidate left them (by index). The
	// message shows from then until the text matches again, as for the text entry.
	let patternInvalidFields = $state<ReadonlySet<number>>(new Set());

	function sameResponse(a: unknown, b: unknown): boolean {
		if (Object.is(a, b)) return true;
		try {
			return JSON.stringify(a) === JSON.stringify(b);
		} catch {
			return false;
		}
	}

	$effect(() => {
		if (!parsedInteraction) return;
		const editorResponse = parsedInteraction.stringIdentifier && stringResponse != null
			? stringResponse
			: parsedResponse;
		const interactionShape = [
			parsedInteraction.responseId,
			parsedInteraction.cardinality,
			parsedInteraction.minStrings,
			parsedInteraction.maxStrings,
		].join('|');
		if (
			interactionShape === lastInteractionShape &&
			sameResponse(editorResponse, lastRenderedResponse)
		) return;
		lastInteractionShape = interactionShape;
		lastRenderedResponse = editorResponse;
		const values = extendedTextResponseToStrings(editorResponse, parsedInteraction);
		const minimumEditors =
			parsedInteraction.cardinality === 'multiple' || parsedInteraction.cardinality === 'ordered'
				? Math.max(1, parsedInteraction.minStrings)
				: 1;
		const editorCount = isLimited(parsedInteraction.maxStrings)
			? Math.min(Math.max(values.length, minimumEditors), parsedInteraction.maxStrings)
			: Math.max(values.length, minimumEditors);
		editorValues = Array.from({ length: editorCount }, (_, index) => values[index] ?? '');
		// The rebuilt text may differ from what a mask message was for (a restored response):
		// only a flag whose field still exists and still fails the mask stays.
		untrack(prunePatternFlags);
	});

	function emitResponses(strings: string[]) {
		if (!parsedInteraction) return;
		const primaryResponse = createExtendedTextResponse(strings, parsedInteraction);
		lastRenderedResponse = primaryResponse;
		response = primaryResponse;
		emitInteractionChange({
			target: rootElement,
			responseId: shell.responseId,
			value: primaryResponse,
			onChange,
		});

		if (
			rootElement &&
			parsedInteraction.stringIdentifier &&
			parsedInteraction.stringIdentifier !== shell.responseId
		) {
			const lexicalResponse = createExtendedTextStringResponse(
				strings,
				parsedInteraction.cardinality,
				parsedInteraction.format,
			);
			stringResponse = lexicalResponse;
			lastRenderedResponse = lexicalResponse;
			emitQtiChange(
				rootElement,
				parsedInteraction.stringIdentifier,
				lexicalResponse,
			);
		}
	}

	/** Announce through the polite live region; a repeat still changes the DOM. */
	function announce(message: string) {
		liveToggle = !liveToggle;
		liveMessage = liveToggle ? message : `${message}\u00A0`;
	}

	function handleChange(index: number, html: string) {
		const before = characterCount(editorValues[index] ?? '', format);
		editorValues[index] = html;
		editorValues = [...editorValues];
		emitResponses(editorValues);
		// A flagged field clears as soon as its text matches (or is emptied); a new mismatch
		// waits for the candidate to leave the field, so typing is never interrupted.
		if (patternInvalidFields.has(index) && !failsPatternMask(html)) setPatternInvalid(index, false);
		// The counter itself is quiet; reaching the expected length is the moment to hear.
		if (showCounter && reachedExpectedLength(before, characterCount(html, format), expectedLength)) {
			announce(
				translatePlural(
					i18n,
					'interactions.extendedText.expectedLengthReached',
					{
						one: 'Expected length of {count} character reached.',
						other: 'Expected length of {count} characters reached.',
					},
					expectedLength,
				),
			);
		}
	}

	/** Focus the field of response `index` once the DOM reflects the latest change. */
	async function focusField(index: number) {
		await tick();
		const target = Math.max(0, Math.min(index, editorValues.length - 1));
		if (format === 'xhtml') richEditors[target]?.focus();
		else textareas[target]?.focus();
	}

	function addString() {
		if (!parsedInteraction) return;
		if (isLimited(parsedInteraction.maxStrings) && editorValues.length >= parsedInteraction.maxStrings) return;
		editorValues = [...editorValues, ''];
		void focusField(editorValues.length - 1);
	}

	function removeString(index: number) {
		// Minimum requirement (minStrings): removing a response would take the multi-part
		// response below the minimum response validation enforces, so the removal is
		// refused and the requirement is announced.
		const minimum = !disabled && role === 'candidate' ? (parsedInteraction?.minStrings ?? 0) : 0;
		if (minimum > 0 && editorValues.length <= minimum) {
			announce(
				translate(i18n, 'interactions.extendedText.minStringsRemoveRefused', 'Response not removed: at least {count} responses are required.', {
					count: minimum,
				}),
			);
			return;
		}
		if (editorValues.length === 1) {
			editorValues = [''];
		} else {
			editorValues = editorValues.filter((_, valueIndex) => valueIndex !== index);
		}
		// Mask messages follow their fields: the removed one's goes, later ones move up a place.
		patternInvalidFields = new Set(
			[...patternInvalidFields].filter((flagged) => flagged !== index).map((flagged) => (flagged > index ? flagged - 1 : flagged)),
		);
		emitResponses(editorValues);
		announce(
			translate(i18n, 'interactions.extendedText.responseRemoved', 'Response {number} removed.', {
				number: index + 1,
			}),
		);
		// The removed region's button is gone: continue at the response before it
		// (or the one that moved up into its place).
		void focusField(index - 1);
	}

	const format = $derived(parsedInteraction?.format ?? 'plain');
	// Character counters (QTI 3 shared vocabulary §1.2.3.2): qti-counter-down starts at the
	// authored expected-length and counts down to 0; qti-counter-up starts at 0 and increases to
	// it. Both are defined by that length, and by default no counter is displayed, so without an
	// authored expected length (absent, or 0) neither class shows one: no target is invented.
	const expectedLength = $derived(parsedInteraction?.expectedLength ?? 0);
	const classes = $derived(parsedInteraction?.interactionClasses ?? []);
	const showCounterDown = $derived(classes.includes('qti-counter-down') && expectedLength > 0);
	const showCounterUp = $derived(classes.includes('qti-counter-up') && expectedLength > 0);
	const showCounter = $derived(showCounterDown || showCounterUp);
	const isContainer = $derived(
		parsedInteraction?.cardinality === 'multiple' || parsedInteraction?.cardinality === 'ordered'
	);
	const canAddString = $derived(
		isContainer &&
		!!parsedInteraction &&
		(!isLimited(parsedInteraction.maxStrings) || editorValues.length < parsedInteraction.maxStrings)
	);
	const correctResponseStrings = $derived(
		parsedInteraction ? extendedTextResponseToStrings(parsedCorrectResponse, parsedInteraction) : []
	);

	const parsedPnp = $derived(parseJsonProp<PnpProfile>(pnp));
	// The host's prop and the candidate's PNP spell-checker grant both opt in.
	const spellcheckAllowed = $derived(isSpellcheckAllowed(spellcheck) || parsedPnp?.cognitive?.spellChecker === true);
	const assistance = $derived(writingAssistance(spellcheckAllowed));
	const inputMode = $derived(parsedInteraction ? responseInputMode(parsedInteraction) : undefined);
	const placeholder = $derived(
		parsedInteraction?.placeholderText ||
			translate(i18n, 'interactions.extendedText.placeholder', 'Type your response here...'),
	);

	// Ids stay unique per interaction in a shared light DOM as well as in the shadow root.
	const idBase = $derived(
		`qti-extended-text-${(parsedInteraction?.responseId ?? 'response').replace(/[^A-Za-z0-9_-]/g, '-')}`,
	);
	const promptId = $derived(parsedInteraction?.prompt ? `${idBase}-prompt` : undefined);
	const fieldId = (index: number) => `${idBase}-field-${index + 1}`;
	const fieldLabelId = (index: number) => `${fieldId(index)}-label`;
	const counterId = (index: number) => `${fieldId(index)}-counter`;
	const patternErrorId = (index: number) => `${fieldId(index)}-pattern-error`;

	// patternMask (QTI 2.1; QTI 3.0 §5.48.4): a string response whose text does not match it is
	// invalid under validateResponses. The fields compile the mask with the player's own XSD
	// translation and test the text the response holds (empty text is not tested), so the
	// message and validation agree. Validation holds only string responses to the mask, so a
	// numeric response is not flagged either.
	const patternRegExp = $derived(
		parsedInteraction?.patternMask && parsedInteraction.baseType === 'string'
			? xsdPatternToRegExp(parsedInteraction.patternMask)
			: null,
	);
	const patternErrorText = $derived(parsedInteraction ? patternMaskMessage(i18n, parsedInteraction) : '');

	function failsPatternMask(value: string): boolean {
		return patternRegExp !== null && value !== '' && !patternRegExp.test(value);
	}

	function setPatternInvalid(index: number, invalid: boolean) {
		const next = new Set(patternInvalidFields);
		if (invalid) next.add(index);
		else next.delete(index);
		patternInvalidFields = next;
	}

	/** Drop the flags of fields that are gone or whose text now matches the mask. */
	function prunePatternFlags() {
		const kept = [...patternInvalidFields].filter(
			(index) => index < editorValues.length && failsPatternMask(editorValues[index] ?? ''),
		);
		if (kept.length !== patternInvalidFields.size) patternInvalidFields = new Set(kept);
	}

	/**
	 * The candidate left field `index`: flag it, and announce the message once, politely, when
	 * its text fails the mask; else clear its flag. The text entry checks at the same moment
	 * (on blur), so both interactions tell the candidate alike, and typing is never blocked.
	 */
	function handleFieldLeave(index: number) {
		const invalid = failsPatternMask(editorValues[index] ?? '');
		if (invalid === patternInvalidFields.has(index)) return;
		setPatternInvalid(index, invalid);
		if (invalid) announce(patternErrorText);
	}

	/** Focus left a rich text field (its toolbar and surface) altogether, not moved within it. */
	function handleRichFieldFocusOut(index: number, event: FocusEvent) {
		const field = event.currentTarget as HTMLElement;
		if (field.contains(event.relatedTarget as Node | null)) return;
		handleFieldLeave(index);
	}

	/** What describes field `index`: its counter, and its mask message while it shows. */
	function fieldDescribedBy(index: number): string | undefined {
		return (
			[showCounter ? counterId(index) : '', patternInvalidFields.has(index) ? patternErrorId(index) : '']
				.filter(Boolean)
				.join(' ') || undefined
		);
	}

	/**
	 * A single field is named by the prompt (the placeholder is only a hint);
	 * without a prompt it gets a generic name. Fields of a multi-part response
	 * are each named by their visible "Response N" label, inside a group the
	 * prompt names.
	 */
	function fieldName(index: number): { labelledby?: string; label?: string } {
		if (isContainer) return { labelledby: fieldLabelId(index) };
		if (promptId) return { labelledby: promptId };
		return { label: translate(i18n, 'interactions.extendedText.responseLabel', 'Response') };
	}

	function counterText(value: string): string {
		const count = characterCount(value, format);
		if (showCounterDown) {
			return translatePlural(
				i18n,
				'interactions.extendedText.charactersRemaining',
				{ one: '{count} character remaining', other: '{count} characters remaining' },
				Math.max(0, expectedLength - count),
			);
		}
		return translate(i18n, 'interactions.extendedText.characterLimit', '{count} / {max} characters', {
			count,
			max: expectedLength,
		});
	}

	// Minimum requirement (minStrings): the response must hold at least that many filled
	// fields before it counts as complete — the same minimum response validation
	// enforces. Stated while the fields fall short; only while the candidate can answer.
	const minHintId = $derived(`${idBase}-min-hint`);
	const filledCount = $derived(editorValues.filter((value) => value.trim().length > 0).length);
	const minHint = $derived(
		disabled || role !== 'candidate' || !parsedInteraction
			? ''
			: minimumHint({
					i18n,
					minimum: parsedInteraction.minStrings,
					count: filledCount,
					key: 'interactions.extendedText.minStringsHint',
					fallback: { one: 'Write at least {count} response.', other: 'Write at least {count} responses.' },
				}),
	);
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} {...interactionAria(parsedInteraction)} part="root" class={['qti-extended-text-interaction', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')}>
	<InteractionDescription interaction={parsedInteraction} />
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div id={promptId} part="prompt" class="qti-extended-text-prompt qti-rich-content font-semibold" use:typesetAction={{ typeset }}>
				{@html parsedInteraction.prompt}
			</div>
		{/if}
		<div
			part="editor"
			class="qti-extended-text-editors"
			role={isContainer && promptId ? 'group' : undefined}
			aria-labelledby={isContainer && promptId ? promptId : undefined}
		>
			{#each editorValues as editorValue, index}
				{@const name = fieldName(index)}
				<div part="string" class="qti-extended-text-string">
					{#if isContainer}
						<label
							id={fieldLabelId(index)}
							for={format === 'xhtml' ? undefined : fieldId(index)}
							part="string-label"
							class="qti-extended-text-label"
						>
							{translate(i18n, 'interactions.extendedText.responseNumber', 'Response {number}', { number: index + 1 })}
						</label>
					{/if}
					{#if format === 'xhtml'}
						<!-- The field ends where the editor (toolbar and surface) ends: leaving it checks the mask. -->
						<div class="qti-extended-text-rich-field" onfocusout={(event) => handleRichFieldFocusOut(index, event)}>
							<RichTextEditor
								bind:this={richEditors[index]}
								value={editorValue}
								editable={!disabled}
								{placeholder}
								minHeight={parsedInteraction.expectedLines ? parsedInteraction.expectedLines * 24 : 200}
								ariaLabelledby={name.labelledby}
								ariaLabel={name.label}
								ariaDescribedby={fieldDescribedBy(index)}
								ariaInvalid={patternInvalidFields.has(index)}
								spellcheck={spellcheckAllowed}
								{i18n}
								onChange={(html) => handleChange(index, html)}
							/>
						</div>
					{:else}
						<textarea
							bind:this={textareas[index]}
							{...assistance}
							id={fieldId(index)}
							value={editorValue}
							disabled={disabled}
							rows={parsedInteraction.expectedLines || 3}
							dir="auto"
							inputmode={inputMode}
							{placeholder}
							aria-labelledby={name.labelledby}
							aria-label={name.label}
							aria-describedby={fieldDescribedBy(index)}
							aria-invalid={patternInvalidFields.has(index) ? 'true' : undefined}
							oninput={(event) => handleChange(index, event.currentTarget.value)}
							onblur={() => handleFieldLeave(index)}
						></textarea>
					{/if}
					{#if showCounter}
						<p id={counterId(index)} part="counter" class="qti-character-counter">{counterText(editorValue)}</p>
					{/if}
					{#if patternInvalidFields.has(index)}
						<p id={patternErrorId(index)} part="pattern-error" class="qti-extended-text-pattern-error">{patternErrorText}</p>
					{/if}
					{#if isContainer && !disabled}
						<button
							type="button"
							part="remove-string"
							class="qti-extended-text-remove"
							onclick={() => removeString(index)}
						>
							{translate(i18n, 'interactions.extendedText.removeResponseNumber', 'Remove response {number}', { number: index + 1 })}
						</button>
					{/if}
				</div>
			{/each}
			{#if canAddString && !disabled}
				<button type="button" part="add-string" class="qti-extended-text-add" onclick={addString}>
					{translate(i18n, 'interactions.extendedText.addResponse', 'Add response')}
				</button>
			{/if}
		</div>
		<MinimumRequirementHint id={minHintId} hint={minHint} responseKey={JSON.stringify(editorValues)} />
		<div part="announcer" class="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveMessage}</div>
		{#if isShowingCorrect && parsedCorrectResponse}
			<div part="correct-answer" class="mt-3 p-3 bg-success bg-opacity-10 border border-success rounded">
				<div class="qti-extended-text-correct-heading text-sm font-semibold mb-2">
					{translate(i18n, 'interactions.extendedText.correctAnswerHeading', 'Correct answer:')}
				</div>
				{#each correctResponseStrings as correctResponseString}
					<div class="text-sm">{correctResponseString}</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-extended-text-interaction {
		display: grid;
		gap: 0.75rem;
	}

	.qti-extended-text-prompt {
		line-height: 1.5;
	}

	.qti-extended-text-prompt :global(:first-child) {
		margin-top: 0;
	}

	.qti-extended-text-prompt :global(:last-child) {
		margin-bottom: 0;
	}

	.qti-extended-text-editors,
	.qti-extended-text-string {
		display: grid;
		gap: 0.5rem;
	}

	.qti-extended-text-label {
		font-weight: 600;
	}

	textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 4.5rem;
		padding: 0.75rem;
		/* The field boundary identifies the control: 3:1 against the page (WCAG 1.4.11). */
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.25rem;
		font: inherit;
		line-height: 1.5;
		resize: vertical;
		white-space: pre-wrap;
	}

	textarea:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.qti-extended-text-add,
	.qti-extended-text-remove {
		justify-self: start;
		box-sizing: border-box;
		/* Primary K-12 targets: at least 44 by 44 CSS pixels. */
		min-block-size: 2.75rem;
		min-inline-size: 2.75rem;
		padding-block: 0.5rem;
		padding-inline: 0.75rem;
		border: 1px solid currentColor;
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.qti-extended-text-add:focus-visible,
	.qti-extended-text-remove:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	/* QTI 3.0 Shared Vocabulary: qti-height-lines-N sets minimum textarea height.
	   Each line unit = 1.5rem (24px) matching the editor's line-height. */
	.qti-height-lines-1  { --qti-min-height: 1.5rem; }
	.qti-height-lines-2  { --qti-min-height: 3rem; }
	.qti-height-lines-3  { --qti-min-height: 4.5rem; }
	.qti-height-lines-4  { --qti-min-height: 6rem; }
	.qti-height-lines-5  { --qti-min-height: 7.5rem; }
	.qti-height-lines-6  { --qti-min-height: 9rem; }
	.qti-height-lines-7  { --qti-min-height: 10.5rem; }
	.qti-height-lines-8  { --qti-min-height: 12rem; }
	.qti-height-lines-10 { --qti-min-height: 15rem; }
	.qti-height-lines-12 { --qti-min-height: 18rem; }
	.qti-height-lines-15 { --qti-min-height: 22.5rem; }
	.qti-height-lines-20 { --qti-min-height: 30rem; }
	.qti-height-lines-25 { --qti-min-height: 37.5rem; }

	/* Apply the CSS variable to the editor's inner textarea via the part */
	[class*='qti-height-lines-'] :global([part='editor'] .ProseMirror),
	[class*='qti-height-lines-'] :global([part='editor'] textarea) {
		min-height: var(--qti-min-height);
	}

	.qti-character-counter {
		font-size: 0.8125rem;
		/* Solid text color (no opacity) keeps the counter at 4.5:1. */
		color: var(--pie-qti-base-content, #374151);
		margin-top: 0.25rem;
		text-align: end;
	}

	/* Only a focus boundary for the rich text field: it adds no box of its own. */
	.qti-extended-text-rich-field {
		display: contents;
	}

	.qti-extended-text-pattern-error {
		margin: 0;
		font-size: 0.875rem;
		/* Text token, not a fill token: the error fill color fails 1.4.3 as text. */
		color: var(--pie-qti-error-text, #b91c1c);
	}

	.qti-extended-text-correct-heading {
		color: var(--pie-qti-success-text, #15803d);
	}
</style>
