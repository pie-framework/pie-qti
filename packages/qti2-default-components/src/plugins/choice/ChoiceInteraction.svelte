<svelte:options customElement="pie-qti-choice" />

<script lang="ts">
	import type { ChoiceInteractionData } from '@pie-qti/qti2-item-player';
	import type { I18nProvider } from '@pie-qti/qti2-i18n';
	import { typesetAction } from '../../shared/actions/typesetAction';
	import ShadowBaseStyles from '../../shared/components/ShadowBaseStyles.svelte';
	import { createQtiChangeEvent } from '../../shared/utils/eventHelpers';
	import { parseJsonProp } from '../../shared/utils/webComponentHelpers';

	interface Props {
		interaction?: ChoiceInteractionData | string;
		response?: string | string[] | null;
		disabled?: boolean;
		i18n?: I18nProvider;
		typeset?: (element: HTMLElement) => void;
		onChange?: (value: string | string[]) => void;
	}

	let { interaction = $bindable(), response = $bindable(), disabled = false, i18n = $bindable(), typeset, onChange }: Props = $props();

	// Simplified translation helper - locale changes trigger page refresh
	const t = $derived((key: string, fallback: string) => i18n?.t(key) ?? fallback);

	// Parse props that may be JSON strings (web component usage)
	const parsedInteraction = $derived(parseJsonProp<ChoiceInteractionData>(interaction));
	const parsedResponse = $derived(parseJsonProp<string | string[]>(response));

	// Get reference to the root element for event dispatching
	let rootElement: HTMLDivElement | undefined = $state();

	function handleRadioChange(identifier: string) {
		response = identifier;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(identifier);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, identifier));
		}
	}

	function handleCheckboxChange(identifier: string, checked: boolean) {
		const currentValues = Array.isArray(parsedResponse) ? parsedResponse : [];
		let newValues = [...currentValues];

		if (checked) {
			newValues.push(identifier);
		} else {
			newValues = newValues.filter((v) => v !== identifier);
		}

		response = newValues;
		// Call onChange callback if provided (for Svelte component usage)
		onChange?.(newValues);
		// Dispatch event for web component usage - event will bubble up to the host element
		if (rootElement) {
			rootElement.dispatchEvent(createQtiChangeEvent(parsedInteraction?.responseId, newValues));
		}
	}
</script>

<ShadowBaseStyles />

<div bind:this={rootElement} part="root" class="qti-choice-interaction space-y-2" use:typesetAction={{ typeset }}>
	{#if !parsedInteraction}
		<div class="alert alert-error">{i18n?.t('common.errorNoData') ?? 'No interaction data provided'}</div>
	{:else if parsedInteraction.maxChoices === 1}
		<!-- Single choice (radio buttons) -->
		{#each parsedInteraction.choices as choice}
			<div part="option" class="qti-choice-option form-control">
				<label part="label" class="qti-choice-label label cursor-pointer justify-start gap-4">
					<input
						part="input"
						type="radio"
						name={parsedInteraction.responseId}
						class="radio radio-primary"
						value={choice.identifier}
						checked={parsedResponse === choice.identifier}
						onchange={() => handleRadioChange(choice.identifier)}
						{disabled}
					/>
					<span part="text" class="qti-choice-text label-text">
						{@html choice.text}
					</span>
				</label>
			</div>
		{/each}
	{:else}
		<!-- Multiple choice (checkboxes) -->
		{@const currentValues = Array.isArray(parsedResponse) ? parsedResponse : []}
		{#each parsedInteraction.choices as choice}
			<div part="option" class="qti-choice-option form-control">
				<label part="label" class="qti-choice-label label cursor-pointer justify-start gap-4">
					<input
						part="input"
						type="checkbox"
						class="checkbox checkbox-primary"
						value={choice.identifier}
						checked={currentValues.includes(choice.identifier)}
						onchange={(e: Event) => {
							const checked = (e.currentTarget as HTMLInputElement).checked;
							handleCheckboxChange(choice.identifier, checked);
						}}
						{disabled}
					/>
					<span part="text" class="qti-choice-text label-text">
						{@html choice.text}
					</span>
				</label>
			</div>
		{/each}
	{/if}
</div>

<style>
	/* Minimal layout so this works without Tailwind/DaisyUI */
	.qti-choice-interaction {
		display: grid;
		gap: 0.5rem;
	}
	.qti-choice-option {
		display: block;
	}
	.qti-choice-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
	}
	.qti-choice-text {
		display: inline-block;
		line-height: 1.35;
	}
	.qti-choice-interaction input[type='radio'],
	.qti-choice-interaction input[type='checkbox'] {
		margin-top: 0.15rem;
	}
</style>
