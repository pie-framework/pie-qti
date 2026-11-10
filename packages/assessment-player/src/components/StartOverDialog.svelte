<script lang="ts">
	/**
	 * Start over confirmation: deleting the saved draft is irreversible, so it is
	 * confirmed before `startOver()` runs (WCAG 3.3.4).
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import AssessmentDialog from './AssessmentDialog.svelte';

	interface Props {
		/** Whether the dialog is shown. Bindable: the actions set it false. */
		open?: boolean;
		/** The restart runs while the dialog stays open (busy). */
		busy: boolean;
		i18n: I18nProvider;
		/** "Delete and start over" chosen. */
		onConfirm: () => void | Promise<void>;
		/** "Keep my saved answers" chosen: back to the resume prompt. */
		onCancel: () => void;
	}

	let {
		open = $bindable(false),
		busy,
		i18n,
		onConfirm,
		onCancel,
	}: Props = $props();
</script>

<AssessmentDialog
	bind:open
	title={i18n.t('assessment.resume.confirmTitle', 'Start over and delete your saved answers?')}
	description={i18n.t(
		'assessment.resume.confirmDescription',
		'Your saved answers will be deleted and the test starts from the beginning. This cannot be undone.',
	)}
	confirmLabel={i18n.t('assessment.resume.confirmAction', 'Delete and start over')}
	cancelLabel={i18n.t('assessment.resume.cancel', 'Keep my saved answers')}
	tone="danger"
	dismissible={false}
	{busy}
	{i18n}
	{onConfirm}
	{onCancel}
/>
