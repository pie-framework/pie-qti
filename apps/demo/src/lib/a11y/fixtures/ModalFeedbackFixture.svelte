<script lang="ts">
	import { ModalFeedbackDisplay } from '@pie-qti/item-player/components';
	import type { ModalFeedback } from '@pie-qti/item-player';

	let feedback = $state<ModalFeedback[]>([
		{
			identifier: 'FEEDBACK',
			outcomeIdentifier: 'FEEDBACK',
			showHide: 'show',
			title: 'Review your answer',
			content: '<p>This feedback dialog should expose a name, modal role, and close controls.</p>',
		},
	]);
</script>

<div class="space-y-3">
	<p class="text-sm text-base-content/70">Fixture for modal feedback semantics and controls.</p>

	<!--
		The dialog opens as a true modal, which makes the rest of the page inert; it comes first so
		the first focusable control in the fixture is one the candidate can reach while it is open.
	-->
	<ModalFeedbackDisplay {feedback} onClose={() => (feedback = [])} />

	<button
		type="button"
		class="btn btn-outline"
		onclick={() =>
			(feedback = [
				{
					identifier: 'FEEDBACK',
					outcomeIdentifier: 'FEEDBACK',
					showHide: 'show',
					title: 'Review your answer',
					content: '<p>This feedback dialog should expose a name, modal role, and close controls.</p>',
				},
			])}
	>
		Show feedback
	</button>
</div>
