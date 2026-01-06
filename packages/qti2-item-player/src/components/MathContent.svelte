<script lang="ts">
	
	import type { HtmlContent } from '../types';
import { typesetAction } from './actions/typesetAction.js';

	interface Props {
		/** HTML content that may contain MathML or LaTeX */
		content: HtmlContent;
		/** Typeset function (KaTeX, MathJax, etc.) */
		typeset: (root: HTMLElement) => void | Promise<void>;
		/** Additional CSS classes */
		class?: string;
	}

	const { content, typeset, class: className = '' }: Props = $props();
</script>

<div class={className} use:typesetAction={{ typeset }}>
	{@html content}
</div>
