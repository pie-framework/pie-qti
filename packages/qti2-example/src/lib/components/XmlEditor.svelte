<script lang="ts">
/**
 * XmlEditor Component
 *
 * A syntax-highlighted XML editor built with TipTap and Lowlight.
 * Uses CSS filters to create distinct syntax colors that automatically
 * adapt to any DaisyUI theme (all 32 standard themes supported).
 *
 * Features:
 * - Filter-based syntax highlighting (works on both light and dark themes)
 * - Auto-format XML with indentation
 * - Customizable colors via CSS variables
 * - Read-only mode support
 * - Bindable content for live updates
 *
 * Syntax Color Mapping:
 * - Element names (e.g., <assessmentItem>) - Blue (190deg hue rotation)
 * - Attributes (e.g., identifier, xmlns) - Purple (260deg hue rotation)
 * - String values (e.g., "simple-choice") - Green (80deg hue rotation)
 * - XML declarations (e.g., <?xml version="1.0"?>) - Orange (10deg hue rotation)
 * - Keywords and built-ins - Red (340deg hue rotation)
 * - Numbers - Cyan (160deg hue rotation)
 * - Comments - Muted base content color
 *
 * Customization:
 * Override CSS variables to adjust syntax highlighting:
 *
 * @example
 * <XmlEditor bind:content={xml} />
 *
 * @example Custom colors
 * <XmlEditor bind:content={xml} />
 * <style>
 *   :global(.xml-editor-container) {
 *     --xml-syntax-saturation: 700%;
 *     --xml-syntax-name-hue: 220deg;
 *     --xml-syntax-string-hue: 120deg;
 *   }
 * </style>
 */

	import { Editor } from '@tiptap/core';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import Document from '@tiptap/extension-document';
	import History from '@tiptap/extension-history';
	import Text from '@tiptap/extension-text';
	import { all, createLowlight } from 'lowlight';
	import { onDestroy, onMount, getContext } from 'svelte';
	import type { SvelteI18nProvider } from '@pie-qti/qti2-i18n';

	const lowlight = createLowlight(all);
	const i18nContext = getContext<{ value: SvelteI18nProvider | null }>('i18n');
	const i18n = $derived(i18nContext?.value);

	interface Props {
		content: string;
		onContentChange?: (content: string) => void;
		readOnly?: boolean;
		language?: string;
	}

	let {
		content = $bindable(''),
		onContentChange,
		readOnly = false,
		language = 'xml',
	}: Props = $props();

	let editor: Editor | null = $state(null);
	let editorElement: HTMLDivElement | null = $state(null);
	let isUpdatingFromProp = false;

	// Helper to escape HTML entities
	function escapeHtml(text: string): string {
		const map: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;',
		};
		return text.replace(/[&<>"']/g, (m) => map[m]);
	}

	// Helper to unescape HTML entities
	function unescapeHtml(text: string): string {
		const map: Record<string, string> = {
			'&amp;': '&',
			'&lt;': '<',
			'&gt;': '>',
			'&quot;': '"',
			'&#039;': "'",
		};
		return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, (m) => map[m]);
	}

	// Format content as HTML for Tiptap
	function formatContentAsHtml(text: string): string {
		return `<pre><code data-language="${language}">${escapeHtml(text)}</code></pre>`;
	}

	// Extract plain text from Tiptap HTML
	function extractTextFromHtml(html: string): string {
		// Extract text from code blocks
		const codeBlockMatch = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
		if (codeBlockMatch) {
			return unescapeHtml(codeBlockMatch[1]);
		}
		return '';
	}

	// Format XML
	function formatXml() {
		if (!editor) return;
		try {
			const text = extractTextFromHtml(editor.getHTML());
			// Simple XML formatting
			const formatted = text
				.replace(/>\s*</g, '>\n<')
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0);

			let indentLevel = 0;
			const indentedLines = formatted.map((line) => {
				if (line.startsWith('</')) {
					indentLevel = Math.max(0, indentLevel - 1);
				}
				const indented = '  '.repeat(indentLevel) + line;
				if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
					indentLevel++;
				}
				return indented;
			});

			const formattedXml = indentedLines.join('\n');
			isUpdatingFromProp = true;
			editor.commands.setContent(formatContentAsHtml(formattedXml));
			content = formattedXml;
			onContentChange?.(formattedXml);
		} catch (err) {
			console.error('Error formatting XML:', err);
		}
	}

	// Initialize editor
	onMount(() => {
		if (!editorElement) return;

		const htmlContent = formatContentAsHtml(content);

		editor = new Editor({
			element: editorElement,
			extensions: [
				Document,
				CodeBlockLowlight.configure({
					lowlight,
					defaultLanguage: language,
				}),
				Text,
				History,
			],
			content: htmlContent,
			editable: !readOnly,
			editorProps: {
				attributes: {
					class: 'tiptap-editor',
				},
			},
			onUpdate: ({ editor }) => {
				if (isUpdatingFromProp) {
					isUpdatingFromProp = false;
					return;
				}
				const newContent = extractTextFromHtml(editor.getHTML());
				content = newContent;
				onContentChange?.(newContent);
			},
			onCreate: ({ editor }) => {
				// Check if content was properly set during init
				const initialContent = extractTextFromHtml(editor.getHTML());
				if (initialContent !== content) {
					setTimeout(() => {
						isUpdatingFromProp = true;
						editor.commands.setContent(htmlContent);
					}, 100);
				}
			},
		});
	});

	// Update editor when content prop changes externally
	$effect(() => {
		if (editor && !isUpdatingFromProp) {
			const currentContent = extractTextFromHtml(editor.getHTML());
			if (currentContent !== content) {
				isUpdatingFromProp = true;
				editor.commands.setContent(formatContentAsHtml(content));
			}
		}
	});

	// Update editor when readOnly changes
	$effect(() => {
		if (editor) {
			editor.setEditable(!readOnly);
		}
	});

	// Cleanup
	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});
</script>

<div class="xml-editor-container">
	<!-- Toolbar -->
	<div class="toolbar">
		<button class="btn btn-sm btn-ghost" onclick={() => formatXml?.()} disabled={readOnly}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
					clip-rule="evenodd"
				/>
			</svg>
			{i18n?.t('demo.format') ?? 'Format'}
		</button>
	</div>

	<!-- Editor -->
	<div class="editor-wrapper">
		<div bind:this={editorElement} class="editor-content"></div>
	</div>
</div>

<style>
	.xml-editor-container {
		border: 2px solid hsl(var(--bc) / 0.2);
		border-radius: 8px;
		overflow: hidden;
		background: hsl(var(--b1));
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid hsl(var(--bc) / 0.2);
		background: hsl(var(--b2));
		color: hsl(var(--bc));
	}

	.editor-wrapper {
		padding: 1rem;
		min-height: 400px;
		max-height: 600px;
		overflow-y: auto;
	}

	.editor-content :global(.tiptap-editor) {
		outline: none;
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
	}

	.editor-content :global(pre) {
		margin: 0;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 0;
	}

	.editor-content :global(code) {
		display: block;
		padding: 0;
		background: transparent;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	/* Force text selection enabled */
	.editor-content :global(*) {
		user-select: text !important;
		-webkit-user-select: text !important;
		-moz-user-select: text !important;
		-ms-user-select: text !important;
	}

	/* Editor wrapper uses DaisyUI base content color */
	.editor-wrapper {
		background: hsl(var(--b1));
		color: hsl(var(--bc));
	}

	/* Syntax highlighting using CSS filters to create distinct hue variations */
	/* All colors derive from base content, ensuring theme compatibility */
	/* Higher saturation (500%) works better across both light and dark themes */
	/*
	 * Customization: Override CSS variables to adjust syntax highlighting:
	 * --xml-syntax-saturation: Color saturation (default: 500%)
	 * --xml-syntax-name-hue: Element name hue rotation (default: 190deg for blue)
	 * --xml-syntax-attr-hue: Attribute hue rotation (default: 260deg for purple)
	 * --xml-syntax-string-hue: String value hue rotation (default: 80deg for green)
	 * --xml-syntax-meta-hue: Meta/declaration hue rotation (default: 10deg for orange)
	 * --xml-syntax-keyword-hue: Keyword hue rotation (default: 340deg for red)
	 * --xml-syntax-number-hue: Number hue rotation (default: 160deg for cyan)
	 */
	.xml-editor-container {
		--xml-syntax-saturation: 500%;
		--xml-syntax-name-hue: 190deg;
		--xml-syntax-attr-hue: 260deg;
		--xml-syntax-string-hue: 80deg;
		--xml-syntax-meta-hue: 10deg;
		--xml-syntax-keyword-hue: 340deg;
		--xml-syntax-number-hue: 160deg;
	}

	/* Tags: angle brackets < > - muted base content */
	.xml-editor-container :global(.hljs-tag) {
		color: hsl(var(--bc) / 0.6);
	}

	/* Element names: assessmentItem, responseDeclaration, etc. - blue shift */
	.xml-editor-container :global(.hljs-name) {
		color: hsl(var(--bc));
		font-weight: 600;
		filter: sepia(100%) saturate(var(--xml-syntax-saturation))
			hue-rotate(var(--xml-syntax-name-hue)) brightness(1.0);
	}

	/* Attributes: identifier, xmlns, cardinality, etc. - purple shift */
	.xml-editor-container :global(.hljs-attr) {
		color: hsl(var(--bc));
		font-weight: 500;
		filter: sepia(100%) saturate(var(--xml-syntax-saturation))
			hue-rotate(var(--xml-syntax-attr-hue)) brightness(0.95);
	}

	/* String values: "simple-choice", "1.0", etc. - green shift */
	.xml-editor-container :global(.hljs-string) {
		color: hsl(var(--bc));
		filter: sepia(100%) saturate(var(--xml-syntax-saturation))
			hue-rotate(var(--xml-syntax-string-hue)) brightness(0.9);
	}

	/* Comments: <!-- comment --> - very muted */
	.xml-editor-container :global(.hljs-comment) {
		color: hsl(var(--bc) / 0.5);
		font-style: italic;
	}

	/* Meta/declarations: <?xml version="1.0"?> - orange shift */
	.xml-editor-container :global(.hljs-meta) {
		color: hsl(var(--bc));
		font-weight: 500;
		filter: sepia(100%) saturate(var(--xml-syntax-saturation))
			hue-rotate(var(--xml-syntax-meta-hue)) brightness(1.1);
	}

	/* Keywords and built-ins - red shift */
	.xml-editor-container :global(.hljs-keyword),
	.xml-editor-container :global(.hljs-built_in) {
		color: hsl(var(--bc));
		font-weight: 500;
		filter: sepia(100%) saturate(var(--xml-syntax-saturation))
			hue-rotate(var(--xml-syntax-keyword-hue)) brightness(1.0);
	}

	/* Numbers - cyan shift */
	.xml-editor-container :global(.hljs-number) {
		color: hsl(var(--bc));
		filter: sepia(100%) saturate(var(--xml-syntax-saturation))
			hue-rotate(var(--xml-syntax-number-hue)) brightness(1.05);
	}

	/* Special variables and operators - slight desaturation */
	.xml-editor-container :global(.hljs-variable),
	.xml-editor-container :global(.hljs-operator) {
		color: hsl(var(--bc) / 0.8);
	}
</style>
