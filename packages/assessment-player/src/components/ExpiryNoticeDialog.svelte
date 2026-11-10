<script lang="ts" module>
	/**
	 * Expiry notices. `mode: 'scope'`: a part/section/question limit expired and
	 * delivery moved on (acknowledge only). `mode: 'submit'`: the whole test
	 * expired (or an expiry dead end left no reachable item) — the dialog carries
	 * the Submit action so the candidate is never stranded, whatever item they
	 * are on. `movingTo`: scope notices only, the 1-based question delivery moves
	 * to, or undefined when the candidate was outside the closed scope and stays
	 * where they are.
	 */
	export type ExpiryNotice = {
		mode: 'scope' | 'submit';
		scope: 'assessment' | 'testPart' | 'section' | 'item';
		movingTo?: number;
	};
</script>

<script lang="ts">
	/**
	 * Time expiry notices. Scope expiry: an acknowledge-only notice of where
	 * delivery moved (Continue and Escape both land focus on that question and
	 * announce it). Dead end / whole-test expiry that could not auto-finalize:
	 * the dialog carries the Submit action so the candidate can finish wherever
	 * they are; dismissed, Submit stays in the navigation bar and takes focus.
	 */
	import type { I18nProvider } from '@pie-qti/i18n';
	import AssessmentDialog from './AssessmentDialog.svelte';

	interface Props {
		/** Whether the dialog is shown. Bindable: the confirm action and Escape set it false. */
		open?: boolean;
		/** The expiry the notice reports. */
		notice: ExpiryNotice;
		/** The submit transition is in flight (the submit notice's action waits). */
		busy: boolean;
		i18n: I18nProvider;
		/** The notice's action: acknowledge (scope) or submit (dead end). */
		onConfirm: () => void | Promise<void>;
		/** After the notice closed, however it closed. */
		onClose: () => void;
	}

	let {
		open = $bindable(false),
		notice,
		busy,
		i18n,
		onConfirm,
		onClose,
	}: Props = $props();

	const scopeTitle = $derived(
		notice.scope === 'testPart'
			? i18n.t('assessment.timeExpiry.partTitle', 'The time for this part is over')
			: notice.scope === 'section'
				? i18n.t('assessment.timeExpiry.sectionTitle', 'The time for this section is over')
				: notice.scope === 'item'
					? i18n.t('assessment.timeExpiry.questionTitle', 'The time for this question is over')
					: i18n.t('assessment.timeExpiry.submitTitle', 'The time for this test is over'),
	);
</script>

<AssessmentDialog
	bind:open
	title={scopeTitle}
	description={
		notice.mode === 'submit'
			? i18n.t('assessment.timeExpiry.submitDescription', 'You can no longer change your answers. Submit your test to finish.')
			: notice.movingTo === undefined
				? i18n.t('assessment.timeExpiry.closedDescription', 'You can no longer change your answers to its questions.')
				: notice.scope === 'testPart'
					? i18n.t('assessment.timeExpiry.scopeDescription', 'You are moving on to the next part of the test.')
					: i18n.t('assessment.timeExpiry.movingToQuestion', 'You are moving on to question {number}.', {
							number: i18n.formatNumber?.(notice.movingTo) ?? String(notice.movingTo),
						})
	}
	confirmLabel={
		notice.mode === 'submit'
			? i18n.t('assessment.navigation.submit', 'Submit')
			: i18n.t('assessment.timeExpiry.continue', 'Continue')
	}
	tone={notice.mode === 'submit' ? 'danger' : 'primary'}
	// Acknowledge-only: there is nothing to cancel — delivery already moved on (or
	// only the submission remains). Escape still dismisses, through the same path.
	showCancel={false}
	closeOnConfirm={notice.mode !== 'submit'}
	{busy}
	{i18n}
	{onConfirm}
	{onClose}
/>
