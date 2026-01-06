<script lang="ts">
	import type { ChoiceInteractionData } from '../types/interactions';
	import { typesetAction } from './actions/typesetAction';

	interface Props {
		interaction: ChoiceInteractionData;
		response: string | string[] | null;
		disabled: boolean;
		onChange: (value: string | string[]) => void;
		typeset?: (element: HTMLElement) => void;
	}

	let { interaction, response, disabled, onChange, typeset }: Props = $props();

	function handleRadioChange(identifier: string) {
		onChange(identifier);
	}

	function handleCheckboxChange(identifier: string, checked: boolean) {
		const currentValues = Array.isArray(response) ? response : [];
		let newValues = [...currentValues];

		if (checked) {
			newValues.push(identifier);
		} else {
			newValues = newValues.filter((v) => v !== identifier);
		}

		onChange(newValues);
	}
</script>

<div class="qti-choice-interaction space-y-2">
	{#if interaction.maxChoices === 1}
		<!-- Single choice (radio buttons) -->
		{#each interaction.choices as choice}
			<div class="form-control">
				<label class="label cursor-pointer justify-start gap-4">
					<input
						type="radio"
						name={interaction.responseId}
						class="radio radio-primary"
						value={choice.identifier}
						checked={response === choice.identifier}
						onchange={() => handleRadioChange(choice.identifier)}
						{disabled}
					/>
					{#if typeset}
						<span class="label-text" use:typesetAction={{ typeset }}>
							{@html choice.text}
						</span>
					{:else}
						<span class="label-text">
							{@html choice.text}
						</span>
					{/if}
				</label>
			</div>
		{/each}
	{:else}
		<!-- Multiple choice (checkboxes) -->
		{@const currentValues = Array.isArray(response) ? response : []}
		{#each interaction.choices as choice}
			<div class="form-control">
				<label class="label cursor-pointer justify-start gap-4">
					<input
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
					{#if typeset}
						<span class="label-text" use:typesetAction={{ typeset }}>
							{@html choice.text}
						</span>
					{:else}
						<span class="label-text">
							{@html choice.text}
						</span>
					{/if}
				</label>
			</div>
		{/each}
	{/if}
</div>
