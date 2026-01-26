<script lang="ts">
	import { onDestroy } from 'svelte';

	/**
	 * Accessibility Announcer Component
	 *
	 * Provides ARIA live region for announcing dynamic content changes
	 * to screen reader users, particularly for state restoration.
	 *
	 * Usage:
	 * ```svelte
	 * <AccessibilityAnnouncer bind:this={announcer} />
	 *
	 * // Later announce something
	 * announcer.announce('Session restored from previous attempt');
	 * ```
	 */

	interface Props {
		/** Priority level for announcements */
		priority?: 'polite' | 'assertive';
	}

	const { priority = 'polite' }: Props = $props();

	let announcement = $state('');
	let announceTimeout: ReturnType<typeof setTimeout> | null = null;

	// Clean up timeout on destroy to prevent memory leaks
	onDestroy(() => {
		if (announceTimeout) {
			clearTimeout(announceTimeout);
			announceTimeout = null;
		}
	});

	/**
	 * Announce a message to screen readers
	 *
	 * @param message - Text to announce
	 * @param clearAfter - Milliseconds to wait before clearing (default: 1000)
	 */
	export function announce(message: string, clearAfter = 1000): void {
		// Clear any existing announcement timeout
		if (announceTimeout) {
			clearTimeout(announceTimeout);
			announceTimeout = null;
		}

		// Set the new announcement
		announcement = message;

		// Clear after delay to allow screen readers to announce
		// and prepare for next announcement
		announceTimeout = setTimeout(() => {
			announcement = '';
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
		announcement = '';
	}
</script>

<!--
	ARIA live region for screen reader announcements
	- visually-hidden: Hide from sighted users but available to screen readers
	- aria-live: Announce changes to this region
	- aria-atomic: Read entire region content when it changes
	- role="status": Indicates this is a status message
-->
<div
	class="sr-only"
	role="status"
	aria-live={priority}
	aria-atomic="true"
>
	{announcement}
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
