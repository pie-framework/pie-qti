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
	let announceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Clean up timeout on destroy to prevent memory leaks
	onDestroy(() => {
		if (announceTimeout) {
			clearTimeout(announceTimeout);
			announceTimeout = null;
		}
	});

	/**
	 * Announce a message to screen readers on the region matching its priority
	 *
	 * @param message - Text to announce
	 * @param clearAfter - Milliseconds to wait before clearing (default: 1000)
	 * @param nextPriority - Announcement priority for this message
	 */
	export function announce(message: string, clearAfter = 1000, nextPriority: 'polite' | 'assertive' = priority): void {
		// Clear any existing announcement timeout
		if (announceTimeout) {
			clearTimeout(announceTimeout);
			announceTimeout = null;
		}

		// Route by priority: the two regions never trade roles, so an assertive
		// message always rides the assertive-born region.
		if (nextPriority === 'assertive') {
			assertiveMessage = message;
			politeMessage = '';
		} else {
			politeMessage = message;
			assertiveMessage = '';
		}

		// Clear after delay to allow screen readers to announce
		// and prepare for next announcement
		announceTimeout = setTimeout(() => {
			politeMessage = '';
			assertiveMessage = '';
			announceTimeout = null;
		}, clearAfter);
	}

	/**
	 * Clear the current announcement immediately
	 */
	export function clear(): void {
		if (announceTimeout) {
			clearTimeout(announceTimeout);
			announceTimeout = null;
		}
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
