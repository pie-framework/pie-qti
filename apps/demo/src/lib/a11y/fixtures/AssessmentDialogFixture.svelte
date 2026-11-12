<script lang="ts">
	import { getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/i18n';
	import { AssessmentDialog } from '@pie-qti/assessment-player/components';

	// Get i18n from context (provided by layout)
	const contextI18nWrapper = getContext<{ value: SvelteI18nProvider | null } | undefined>('i18n');
	const i18n = $derived(contextI18nWrapper?.value ?? undefined);

	let open = $state(false);
	let lastResult = $state('none');
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">
		Fixture for the shell's modal dialog (submit confirmation, time notices, resume prompts).
	</p>

	<button type="button" class="btn btn-primary" onclick={() => (open = true)}>Open submit confirmation</button>
	<p data-testid="dialog-result">Last result: {lastResult}</p>

	<AssessmentDialog
		bind:open
		title="Submit your answers?"
		description="You answered 3 of 5 questions. You cannot change your answers after submitting."
		confirmLabel="Submit"
		cancelLabel="Keep working"
		{i18n}
		onClose={(reason) => (lastResult = reason)}
	/>
</div>
