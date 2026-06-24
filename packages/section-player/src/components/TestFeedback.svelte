<script lang="ts">
	import type { I18nProvider } from '@pie-qti/i18n';
	import type { PlayerSecurityConfig } from '@pie-qti/item-player';
	import type { QtiSectionRole, QtiSectionRuntimeHostContract, QtiSharedHtmlBlock } from '../contracts/index.js';
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
</script>

{#if visibleFeedback.length > 0}
	<section class="test-feedback" aria-live="polite" aria-label={i18n?.t('feedback.testFeedback') ?? 'Test feedback'}>
		{#each visibleFeedback as item (item.identifier)}
			<SanitizedHtml
				rawHtml={item.rawHtml}
				html={item.html}
				{security}
				{host}
				sanitizeContext={{ kind: 'test-feedback', source: item.source }}
				class="test-feedback-content"
				{typeset}
			/>
		{/each}
	</section>
{/if}

<style>
	.test-feedback {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 1rem 0;
	}

	:global(.test-feedback-content) {
		padding: 1rem;
		border-radius: 0.5rem;
		background-color: var(--feedback-bg, #f0f9ff);
		border: 1px solid var(--feedback-border, #0ea5e9);
		color: var(--feedback-text, #0c4a6e);
		line-height: 1.6;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	:global(.test-feedback-content p) {
		margin: 0 0 0.5rem 0;
	}

	:global(.test-feedback-content p:last-child) {
		margin-bottom: 0;
	}
</style>
