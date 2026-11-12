<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig } from '@pie-qti/item-player';
	import type {
		QtiSectionFrameworkError,
		QtiSectionRole,
		QtiSectionRuntimeHostContract,
		QtiSharedHtmlBlock,
	} from '../contracts/index.js';
	import { interfaceText } from '../i18n/interface-text.js';
	import { tryPrepareReadableBlock, type ReadableBlockOutcome } from '../tts/spoken-catalogs.js';
	import { isQtiViewVisibleForRole } from '../visibility/role-view.js';
	import SanitizedHtml from './SanitizedHtml.svelte';

	interface Props {
		feedback?: QtiSharedHtmlBlock[];
		role?: QtiSectionRole;
		i18n?: I18nProvider;
		security?: PlayerSecurityConfig;
		host?: QtiSectionRuntimeHostContract;
		typeset?: (root: HTMLElement) => void | Promise<void>;
		onFrameworkError?: (error: QtiSectionFrameworkError) => void;
	}

	const { feedback = [], role = 'candidate', i18n, security, host, typeset, onFrameworkError }: Props = $props();
	const visibleFeedback = $derived(feedback.filter((item) => isQtiViewVisibleForRole(item.view, role)));
	// The passages' preparation restates a nested `xml:lang` as `lang` (and `dir` where the
	// direction changes), so a language change inside the feedback reads in its own language;
	// HTML ignores `xml:lang`. A host-supplied `html` renders as given. A block whose
	// preparation throws renders as authored, and the failure goes to `onFrameworkError`.
	const readableFeedback = $derived(
		new Map<string, ReadableBlockOutcome>(
			visibleFeedback.map((item) => [
				item.identifier,
				item.html === undefined && item.rawHtml
					? tryPrepareReadableBlock(item.rawHtml, item.language)
					: { ok: true as const, html: item.rawHtml ?? '', catalogs: [] },
			]),
		),
	);

	// One report per failing block; the set clears while nothing fails, so a block that
	// goes away and comes back broken reports again.
	type ReadableBlockFailure = Extract<ReadableBlockOutcome, { ok: false }>;
	const isReadableBlockFailure = (outcome: ReadableBlockOutcome): outcome is ReadableBlockFailure => !outcome.ok;
	let reportedReadableFailures = new Set<string>();
	$effect(() => {
		const failures = [...readableFeedback].filter(([, outcome]) => isReadableBlockFailure(outcome)) as Array<
			[string, ReadableBlockFailure]
		>;
		if (failures.length === 0) {
			reportedReadableFailures.clear();
			return;
		}
		for (const [identifier, failure] of failures) {
			const key = `${identifier}:${failure.message}`;
			if (reportedReadableFailures.has(key)) continue;
			reportedReadableFailures.add(key);
			onFrameworkError?.({
				code: 'readable-block-failed',
				message: `${identifier}: ${failure.message}`,
				cause: failure.cause,
			});
		}
	});
</script>

<!--
	The region exists before its content: a polite live region created together with
	what it announces is unreliably announced (WCAG 4.1.3), so the shell always renders
	and only the content toggles. While empty it takes no room.
-->
<section
	class="test-feedback"
	class:empty={visibleFeedback.length === 0}
	aria-live="polite"
	aria-label={interfaceText(i18n, 'feedback.testFeedback', 'Test feedback')}
>
	{#each visibleFeedback as item (item.identifier)}
		<!-- The section's name is interface text; each block reads in its content language. -->
		<SanitizedHtml
			rawHtml={readableFeedback.get(item.identifier)?.html ?? item.rawHtml}
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

<style>
	.test-feedback {
		display: flex;
		flex-direction: column;
		gap: var(--pie-qti-space-3, 0.75rem);
		margin-block: var(--pie-qti-space-3, 0.75rem);
		margin-inline: var(--pie-qti-space-4, 1rem);
	}

	.test-feedback.empty {
		margin-block: 0;
		margin-inline: 0;
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
