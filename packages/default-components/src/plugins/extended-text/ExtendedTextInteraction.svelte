<svelte:options customElement="pie-qti-extended-text" />

<script lang="ts">
	import type { ExtendedTextInteractionData } from '@pie-qti/item-player';
	import type { I18nProvider } from '@pie-qti/i18n';
	import RichTextEditor from '../../shared/components/RichTextEditor.svelte';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { emitInteractionChange } from '../../shared/utils/eventHelpers';
	import { createInteractionShell } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: ExtendedTextInteractionData | string;
		response?: string | null;
		correctResponse?: string | null;
		disabled?: boolean;
		role?: string;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string) => void;
	}

	let { interaction = $bindable(), response = $bindable(), correctResponse = $bindable(), disabled = false, role = 'candidate', i18n = $bindable(), typeset, onChange }: Props = $props();

	const shell = $derived(
		createInteractionShell<ExtendedTextInteractionData, string, string>({
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

	function handleChange(html: string) {
		response = html;
		emitInteractionChange({ target: rootElement, responseId: shell.responseId, value: html, onChange });
	}

	// Character counter support (qti-counter-down / qti-counter-up)
	function charCount(html: string, format: string): number {
		if (format === 'xhtml') {
			// Strip HTML tags, count only text characters
			return html.replace(/<[^>]*>/g, '').length;
		}
		return html.length;
	}

	const currentCount = $derived(charCount(parsedResponse ?? '', parsedInteraction?.format ?? 'plain'));
	const expectedLength = $derived(parsedInteraction?.expectedLength ?? 0);
	const classes = $derived(parsedInteraction?.interactionClasses ?? []);
	const showCounterDown = $derived(classes.includes('qti-counter-down') && expectedLength > 0);
	const showCounterUp = $derived(classes.includes('qti-counter-up') && expectedLength > 0);
	const remaining = $derived(expectedLength - currentCount);
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class={['qti-extended-text-interaction', ...(parsedInteraction?.interactionClasses ?? [])].join(' ')}>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData', 'No interaction data provided')}</div>
	{:else}
		{#if parsedInteraction.prompt}
			<div part="prompt" class="qti-extended-text-prompt font-semibold" use:typesetAction={{ typeset }}>
				{@html parsedInteraction.prompt}
			</div>
		{/if}
		<div part="editor">
			<RichTextEditor
			value={parsedResponse || ''}
			editable={!disabled}
			placeholder={parsedInteraction.placeholderText || 'Enter your response...'}
			minHeight={parsedInteraction.expectedLines ? parsedInteraction.expectedLines * 24 : 200}
			{i18n}
			onChange={handleChange}
			/>
		</div>
		{#if showCounterDown}
			<p part="counter" class="qti-character-counter" aria-live="polite">
				{remaining >= 0 ? remaining : 0} {i18n?.t('interactions.extendedText.charsRemaining', 'characters remaining')}
			</p>
		{:else if showCounterUp}
			<p part="counter" class="qti-character-counter" aria-live="polite">
				{currentCount} / {expectedLength} {i18n?.t('interactions.extendedText.charsUsed', 'characters')}
			</p>
		{/if}
		{#if isShowingCorrect && parsedCorrectResponse}
			<div part="correct-answer" class="mt-3 p-3 bg-success bg-opacity-10 border border-success rounded">
				<div class="text-sm font-semibold text-success mb-2">
					{i18n?.t('interactions.choice.correct', 'Correct') ?? 'Correct'} Answer:
				</div>
				<div class="text-sm">{parsedCorrectResponse}</div>
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
