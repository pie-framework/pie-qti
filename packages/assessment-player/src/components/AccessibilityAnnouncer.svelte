<script lang="ts">
	import { onDestroy } from 'svelte';

	/**
	 * Accessibility Announcer Component
	 *
	 * Two persistent ARIA live regions — one polite, one assertive — both mounted for
	 * the component's whole lifetime, with `announce()` routing each message by
	 * priority. Several screen readers sample a region's politeness when the region is
	 * created, so a single region whose `aria-live` flips polite↔assertive per
	 * announcement would deliver urgent messages through a polite-born region; two
	 * fixed regions keep every announcement at its authored priority.
	 *
	 * Usage:
	 * ```svelte
	 * <AccessibilityAnnouncer bind:this={announcer} />
	 *
	 * // Later announce something
	 * announcer.announce('Session restored from previous attempt');
	 * announcer.announce('Time has expired', 4000, 'assertive');
	 * ```
	 */

	interface Props {
		/** Default priority for announcements that pass none. */
		priority?: 'polite' | 'assertive';
		/** The interface locale's `lang` and `dir`, which announcements are in. */
		lang?: string;
		dir?: 'ltr' | 'rtl';
	}

	const { priority = 'polite', lang, dir }: Props = $props();

	let politeMessage = $state('');
	let assertiveMessage = $state('');
	/** Each region clears on its own timer: one announcement never cuts another short. */
	const clearTimers: Record<'polite' | 'assertive', ReturnType<typeof setTimeout> | null> = {
		polite: null,
		assertive: null,
	};

	function setMessage(region: 'polite' | 'assertive', message: string): void {
		if (region === 'assertive') assertiveMessage = message;
		else politeMessage = message;
	}

	function cancelTimer(region: 'polite' | 'assertive'): void {
		const timer = clearTimers[region];
		if (timer) clearTimeout(timer);
		clearTimers[region] = null;
	}

	// Clean up timeouts on destroy to prevent memory leaks
	onDestroy(() => {
		cancelTimer('polite');
		cancelTimer('assertive');
	});

	/**
	 * Announce a message to screen readers on the region matching its priority
	 *
	 * @param message - Text to announce
	 * @param clearAfter - Milliseconds to wait before clearing (default: 1000)
	 * @param nextPriority - Announcement priority for this message
	 */
	export function announce(message: string, clearAfter = 1000, nextPriority: 'polite' | 'assertive' = priority): void {
		// Route by priority: the two regions never trade roles, so an assertive
		// message always rides the assertive-born region. The other region is left
		// alone — clearing it would drop a message still pending there (e.g. the
		// assertive "restarted" and the polite "Question 1 of 3" of one start over).
		cancelTimer(nextPriority);
		setMessage(nextPriority, message);

		// Clear after delay to allow screen readers to announce
		// and prepare for next announcement
		clearTimers[nextPriority] = setTimeout(() => {
			setMessage(nextPriority, '');
			clearTimers[nextPriority] = null;
		}, clearAfter);
	}

	/**
	 * Clear the current announcement immediately
	 */
	export function clear(): void {
		cancelTimer('polite');
		cancelTimer('assertive');
		politeMessage = '';
		assertiveMessage = '';
	}
</script>

<!--
	Two persistent live regions, present before their content changes so assistive
	technology picks the updates up:
	- polite `role="status"` for routine announcements (question position, saves);
	- assertive `role="alert"` for urgent ones (pause, expiry, failures).
-->
<div {lang} {dir} class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-announcer="polite">
	{politeMessage}
</div>
<div {lang} {dir} class="sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-announcer="assertive">
	{assertiveMessage}
</div>

<style>
	/* Screen reader only - visually hidden but accessible */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
