<script lang="ts">
	/**
	 * Proctor pause: an overlay replaces the blocked shell, naming the reason.
	 * It is rendered OUTSIDE the shell's inert chrome wrapper, so it stays
	 * operable while everything beneath it is inert; the shell focuses its
	 * heading like a dialog and returns focus past it on resume.
	 */
	import type { I18nProvider } from '@pie-qti/i18n';

	interface Props {
		/** The shell title's level: the pause heading sits one level below it. */
		headingLevel: number;
		/** The candidate-facing reason of the pause, if any. */
		reason?: string;
		i18n: I18nProvider;
		/** The focusable heading (the shell's focus target while paused). */
		headingElement?: HTMLElement | null;
		/** The overlay root (the shell's focus-containment boundary). */
		overlayElement?: HTMLElement | null;
	}

	let {
		headingLevel,
		reason,
		i18n,
		headingElement = $bindable(null),
		overlayElement = $bindable(null),
	}: Props = $props();
</script>

<div class="pause-overlay" data-testid="assessment-pause-overlay" bind:this={overlayElement}>
	<div class="pause-card" role="status" aria-live="assertive">
		<!-- One level below the shell title, like the passage and item titles. -->
		<svelte:element
			this={`h${Math.min(6, headingLevel + 1)}`}
			class="pause-title"
			tabindex="-1"
			bind:this={headingElement}
		>
			{i18n.t('assessment.pause.title', 'Assessment paused')}
		</svelte:element>
		<p class="pause-reason">
			{reason ?? i18n.t('assessment.pause.message', 'Your test has been paused. Please wait until it resumes.')}
		</p>
	</div>
</div>

<style>
	.pause-overlay {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--pie-qti-space-4, 1rem);
		background: color-mix(in oklab, var(--pie-qti-base-100, oklch(100% 0 0)) 92%, black);
	}

	.pause-card {
		box-sizing: border-box;
		inline-size: min(28rem, 100%);
		padding: var(--pie-qti-space-6, 2rem);
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		color: var(--pie-qti-base-content, oklch(21% 0 0));
		box-shadow: 0 1.25rem 2.75rem rgb(0 0 0 / 0.25);
	}

	.pause-title {
		margin: 0 0 var(--pie-qti-space-3, 0.75rem);
		font-size: 1.25em;
		font-weight: 700;
		line-height: 1.3;
	}

	.pause-title:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.pause-reason {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
