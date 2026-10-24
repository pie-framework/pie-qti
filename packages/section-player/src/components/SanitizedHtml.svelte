<script lang="ts">
	import { typesetAction } from '@pie-qti/default-components/shared';
	import { htmlToString } from '@pie-qti/item-player/security';
	import type { HtmlContent, PlayerSecurityConfig } from '@pie-qti/item-player';
	import { contentLanguageAttributes } from '@pie-qti/i18n';
	import type { QtiSectionRuntimeHostContract, QtiSharedHtmlSanitizeContext } from '../contracts/index.js';
	import { sanitizeSectionSharedHtml } from '../security/sanitizeSharedHtml.js';

	interface Props {
		html?: HtmlContent;
		rawHtml?: string;
		security?: PlayerSecurityConfig;
		host?: QtiSectionRuntimeHostContract;
		sanitizeContext: QtiSharedHtmlSanitizeContext;
		class?: string;
		/** The content's declared language; sets the root's `lang` and `dir`. */
		language?: string;
		typeset?: (root: HTMLElement) => void | Promise<void>;
	}

	const {
		html,
		rawHtml = '',
		security,
		host,
		sanitizeContext,
		class: className = '',
		language,
		typeset,
	}: Props = $props();

	const contentAttributes = $derived(contentLanguageAttributes(language));

	const unsafeHtml = $derived(html === undefined ? rawHtml : htmlToString(html));
	const content = $derived(sanitizeSectionSharedHtml(unsafeHtml, security, sanitizeContext, host));
</script>

<div use:typesetAction={{ typeset }} class={className} lang={contentAttributes?.lang} dir={contentAttributes?.dir}>
	{@html content}
</div>
