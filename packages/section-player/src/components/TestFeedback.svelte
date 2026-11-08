<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig } from '@pie-qti/item-player';
	import type { QtiSectionRole, QtiSectionRuntimeHostContract, QtiSharedHtmlBlock } from '../contracts/index.js';
	import { prepareReadableBlock } from '../tts/spoken-catalogs.js';
	import { isQtiViewVisibleForRole } from '../visibility/role-view.js';
	import SanitizedHtml from './SanitizedHtml.svelte';

	interface Props {
		feedback?: QtiSharedHtmlBlock[];
		role?: QtiSectionRole;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		host?: QtiSectionRuntimeHostContract;
		typeset?: (root: HTMLElement) => void | Promise<void>;
	}

	const { feedback = [], role = 'candidate', i18n, security, host, typeset }: Props = $props();
	const visibleFeedback = $derived(feedback.filter((item) => isQtiViewVisibleForRole(item.view, role)));
	// The passages' preparation restates a nested `xml:lang` as `lang` (and `dir` where the
	// direction changes), so a language change inside the feedback reads in its own language;
	// HTML ignores `xml:lang`. A host-supplied `html` renders as given.
	const readableFeedback = $derived(
		new Map(
			visibleFeedback.map((item) => [
				item.identifier,
				item.html === undefined && item.rawHtml
					? prepareReadableBlock(item.rawHtml, item.language).html
					: item.rawHtml,
			]),
		),
	);
</script>

{#if visibleFeedback.length > 0}
	<section class="test-feedback" aria-live="polite" aria-label={i18n?.t('feedback.testFeedback') ?? 'Test feedback'}>
		{#each visibleFeedback as item (item.identifier)}
			<!-- The section's name is interface text; each block reads in its content language. -->
			<SanitizedHtml
				rawHtml={readableFeedback.get(item.identifier) ?? item.rawHtml}
				html={item.html}
				{security}
				{host}
				sanitizeContext={{ kind: 'test-feedback', source: item.source }}
				language={item.language}
				class="test-feedback-content pie-qti-content"
				{typeset}
			/>
		{/each}
	</section>
{/if}

<style>
	.test-feedback {
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-3, 0.75rem);
		margin-block: var(--pie-qti-space-3, 0.75rem);
		margin-inline: var(--pie-qti-space-4, 1rem);
	}

	/* `--feedback-*` stay available as host overrides; the defaults follow the theme tokens. */
	.test-feedback :global(.test-feedback-content) {
		padding: var(--pie-qti-space-4, 1rem);
		border-radius: var(--pie-qti-radius, 0.5rem);
		background-color: var(--feedback-bg, var(--pie-qti-base-200, oklch(98% 0 0)));
		border: 1px solid var(--feedback-border, var(--pie-qti-base-300, oklch(95% 0 0)));
		border-inline-start: 4px solid var(--feedback-border, var(--pie-qti-info-text, #1d4ed8));
		color: var(--feedback-text, var(--pie-qti-base-content, oklch(21% 0 0)));
		line-height: 1.6;
	}

	.test-feedback :global(.test-feedback-content > :first-child) {
		margin-block-start: 0;
	}

	.test-feedback :global(.test-feedback-content > :last-child) {
		margin-block-end: 0;
	}

	.test-feedback :global(.test-feedback-content p) {
		margin-block: 0 0.5em;
	}

	.test-feedback :global(.test-feedback-content p:last-child) {
		margin-block-end: 0;
	}
</style>
