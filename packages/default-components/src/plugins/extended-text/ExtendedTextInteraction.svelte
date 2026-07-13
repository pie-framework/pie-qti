<svelte:options customElement="pie-qti-extended-text" />

<script lang="ts">
	import type { ExtendedTextInteractionData } from '@pie-qti/item-player';
	import {
		createExtendedTextResponse,
		createExtendedTextStringResponse,
		extendedTextResponseToStrings,
	} from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import RichTextEditor from '../../shared/components/RichTextEditor.svelte';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { emitInteractionChange, emitQtiChange } from '../../shared/utils/eventHelpers';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';

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
		onChange?: (value: unknown) => void;
	}

	let { interaction = $bindable(), response = $bindable(), stringResponse = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), typeset, onChange }: Props = $props();

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
		const editorCount = parsedInteraction.maxStrings > 0
			? Math.min(Math.max(values.length, minimumEditors), parsedInteraction.maxStrings)
			: Math.max(values.length, minimumEditors);
		editorValues = Array.from({ length: editorCount }, (_, index) => values[index] ?? '');
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

	function handleChange(index: number, html: string) {
		editorValues[index] = html;
		editorValues = [...editorValues];
		emitResponses(editorValues);
	}

	function addString() {
		if (!parsedInteraction) return;
		if (parsedInteraction.maxStrings > 0 && editorValues.length >= parsedInteraction.maxStrings) return;
		editorValues = [...editorValues, ''];
	}

	function removeString(index: number) {
		if (editorValues.length === 1) {
			editorValues = [''];
		} else {
			editorValues = editorValues.filter((_, valueIndex) => valueIndex !== index);
		}
		emitResponses(editorValues);
	}

	// Character counter support (qti-counter-down / qti-counter-up)
	function charCount(html: string, format: string): number {
		if (format === 'xhtml') {
			// Strip HTML tags, count only text characters
			return html.replace(/<[^>]*>/g, '').length;
		}
		return html.length;
	}

	const expectedLength = $derived(parsedInteraction?.expectedLength ?? 0);
	const classes = $derived(parsedInteraction?.interactionClasses ?? []);
	const showCounterDown = $derived(classes.includes('qti-counter-down') && expectedLength > 0);
	const showCounterUp = $derived(classes.includes('qti-counter-up') && expectedLength > 0);
	const isContainer = $derived(
		parsedInteraction?.cardinality === 'multiple' || parsedInteraction?.cardinality === 'ordered'
	);
	const canAddString = $derived(
		isContainer &&
		(parsedInteraction?.maxStrings === 0 || editorValues.length < (parsedInteraction?.maxStrings ?? 0))
	);
	const correctResponseStrings = $derived(
		parsedInteraction ? extendedTextResponseToStrings(parsedCorrectResponse, parsedInteraction) : []
	);
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class={['qti-extended-text-interaction', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')}>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-extended-text-prompt qti-rich-content font-semibold" use:typesetAction={{ typeset }}>
				{@html parsedInteraction.prompt}
			</div>
		{/if}
		<div part="editor" class="qti-extended-text-editors">
			{#each editorValues as editorValue, index}
				{@const currentCount = charCount(editorValue, parsedInteraction.format)}
				{@const remaining = expectedLength - currentCount}
				<div part="string" class="qti-extended-text-string">
					{#if parsedInteraction.format === 'xhtml'}
						<RichTextEditor
							value={editorValue}
							editable={!disabled}
							placeholder={parsedInteraction.placeholderText || 'Enter your response...'}
							minHeight={parsedInteraction.expectedLines ? parsedInteraction.expectedLines * 24 : 200}
							{i18n}
							onChange={(html) => handleChange(index, html)}
						/>
					{:else}
						<textarea
							value={editorValue}
							disabled={disabled}
							rows={parsedInteraction.expectedLines || 3}
							placeholder={parsedInteraction.placeholderText || 'Enter your response...'}
							aria-label={parsedInteraction.placeholderText || 'Enter your response'}
							oninput={(event) => handleChange(index, event.currentTarget.value)}
						></textarea>
					{/if}
					{#if showCounterDown}
						<p part="counter" class="qti-character-counter" aria-live="polite">
							{remaining >= 0 ? remaining : 0} {i18n?.t('interactions.extendedText.charsRemaining', 'characters remaining')}
						</p>
					{:else if showCounterUp}
						<p part="counter" class="qti-character-counter" aria-live="polite">
							{currentCount} / {expectedLength} {i18n?.t('interactions.extendedText.charsUsed', 'characters')}
						</p>
					{/if}
					{#if isContainer && !disabled}
						<button
							type="button"
							part="remove-string"
							class="qti-extended-text-remove"
							onclick={() => removeString(index)}
							aria-label={i18n?.t('interactions.extendedText.removeResponse', 'Remove response')}
						>
							{i18n?.t('interactions.extendedText.removeResponse', 'Remove response')}
						</button>
					{/if}
				</div>
			{/each}
			{#if canAddString && !disabled}
				<button type="button" part="add-string" class="qti-extended-text-add" onclick={addString}>
					{i18n?.t('interactions.extendedText.addResponse', 'Add response')}
				</button>
			{/if}
		</div>
		{#if isShowingCorrect && parsedCorrectResponse}
			<div part="correct-answer" class="mt-3 p-3 bg-success bg-opacity-10 border border-success rounded">
				<div class="text-sm font-semibold text-success mb-2">
					{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'} Answer:
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

	textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 4.5rem;
		padding: 0.75rem;
		border: 1px solid var(--pie-qti-border-color, #9ca3af);
		border-radius: 0.25rem;
		font: inherit;
		line-height: 1.5;
		resize: vertical;
		white-space: pre-wrap;
	}

	.qti-extended-text-add,
	.qti-extended-text-remove {
		justify-self: start;
		min-height: 2.75rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid currentColor;
		border-radius: 0.25rem;
		background: transparent;
		cursor: pointer;
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
		color: var(--pie-qti-base-content, #374151);
		opacity: 0.7;
		margin-top: 0.25rem;
		text-align: right;
	}
</style>
