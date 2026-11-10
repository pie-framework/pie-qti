<script lang="ts">
	/**
	 * The visible statement of an unmet minimum (minChoices, minAssociations, matchMin): what the
	 * candidate still has to do before the answer counts as complete (WCAG 3.3.2, 3.3.3). The
	 * interaction's answer group names it in `aria-describedby` while it shows.
	 *
	 * It is announced politely, once, when a response change leaves the minimum unmet — not on
	 * every change: further changes while it stays unmet are silent, and the hint present when
	 * the question loads is its description, not an announcement. Meeting the minimum ends the
	 * stretch, so falling below it again announces it again. The live region is its own, always
	 * rendered, so it exists before its text changes and never re-reads the interaction's other
	 * announcements (pick-up, placement, removal) with it.
	 */
	import '../styles/srOnly.js';

	interface Props {
		/** Id of the visible hint, for the answer group's `aria-describedby`. */
		id: string;
		/** The requirement while it is unmet; empty when it is met or there is none. */
		hint: string;
		/** Any value that changes whenever the candidate's response changes. */
		responseKey: string;
	}

	let { id, hint, responseKey }: Props = $props();

	let announcement = $state('');
	// Plain bookkeeping, not render state.
	let announced = false;
	let lastResponseKey: string | undefined;

	$effect(() => {
		const text = hint;
		const key = responseKey;
		const changed = lastResponseKey !== undefined && key !== lastResponseKey;
		lastResponseKey = key;
		if (!text) {
			// Met (or none): the next time the response falls short is a new announcement.
			announced = false;
			announcement = '';
			return;
		}
		if (changed && !announced) {
			announced = true;
			announcement = text;
		}
	});
</script>

{#if hint}
	<p {id} part="min-hint" class="qti-min-hint">{hint}</p>
{/if}
<div class="qti-min-hint-live" aria-live="polite" aria-atomic="true">{announcement}</div>

<style>
	.qti-min-hint {
		margin-block: 0.5rem 0;
		font-size: 0.875rem;
		/* Text token, not a fill token: warning yellow fails 1.4.3 as text. */
		color: var(--pie-qti-warning-text, #92400e);
	}

</style>
