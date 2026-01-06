<script lang="ts">

	import { Editor } from '@tiptap/core';
	import { Mathematics } from '@tiptap/extension-mathematics';
	import Placeholder from '@tiptap/extension-placeholder';
	import StarterKit from '@tiptap/starter-kit';
	import { untrack } from 'svelte';
	import { openMathLiveEditor } from '../extensions/MathLiveEditor.js';

	interface Props {
		value?: string;
		editable?: boolean;
		placeholder?: string;
		minHeight?: number;
		onChange?: (html: string) => void;
	}

	const {
		value = '',
		editable = true,
		placeholder = '',
		minHeight = 200,
		onChange,
	}: Props = $props();

	let el: HTMLDivElement | null = $state(null);
	let editor: Editor | null = $state(null);
	// Use a regular variable (not $state) to track last emitted value
	// This prevents circular dependencies in $effect
	let lastEmitted = '';
	// Track if we're currently programmatically updating to avoid loops
	let isProgrammaticUpdate = false;

	function emit(html: string) {
		// Don't emit changes that we're causing programmatically
		if (isProgrammaticUpdate) return;
		lastEmitted = html;
		onChange?.(html);
	}

	function insertInlineMath() {
		if (!editor) return;
		openMathLiveEditor({
			initialLatex: '\\frac{a}{b}',
			isBlock: false,
			onConfirm: (latex) => {
				editor?.commands.insertInlineMath({ latex });
				editor?.commands.focus();
			},
			onCancel: () => {
				editor?.commands.focus();
			},
		});
	}

	function insertBlockMath() {
		if (!editor) return;
		openMathLiveEditor({
			initialLatex: '\\frac{a}{b}',
			isBlock: true,
			onConfirm: (latex) => {
				editor?.commands.insertBlockMath({ latex });
				editor?.commands.focus();
			},
			onCancel: () => {
				editor?.commands.focus();
			},
		});
	}

	// Initialize editor once when element is available
	// Only tracks 'el' as a dependency, use untrack for other props to prevent recreation
	$effect(() => {
		if (!el) return;

		// Capture initial values without tracking them as dependencies
		const initialValue = untrack(() => value?.trim() ? value : '<p></p>');
		const initialPlaceholder = untrack(() => placeholder);
		const initialMinHeight = untrack(() => minHeight);
		const initialEditable = untrack(() => editable);

		const ed = new Editor({
			element: el,
			extensions: [
				StarterKit.configure({
					// keep these minimal, but sensible for extended response editing
					codeBlock: false,
				}),
				Placeholder.configure({
					placeholder: initialPlaceholder,
				}),
				Mathematics.configure({
					inlineOptions: {
						onClick: (node, pos) => {
							openMathLiveEditor({
								initialLatex: node.attrs?.latex || '',
								isBlock: false,
								onConfirm: (latex) => {
									ed.chain().setNodeSelection(pos).updateInlineMath({ latex }).focus().run();
								},
								onCancel: () => {
									ed.commands.focus();
								},
							});
						},
					},
					blockOptions: {
						onClick: (node, pos) => {
							openMathLiveEditor({
								initialLatex: node.attrs?.latex || '',
								isBlock: true,
								onConfirm: (latex) => {
									ed.chain().setNodeSelection(pos).updateBlockMath({ latex }).focus().run();
								},
								onCancel: () => {
									ed.commands.focus();
								},
							});
						},
					},
					katexOptions: {
						throwOnError: false,
					},
				}),
			],
			content: initialValue,
			editable: initialEditable,
			editorProps: {
				attributes: {
					// Stable hook for theming. The host app's DaisyUI theme vars cascade here.
					class: 'pie-tiptap tiptap-prose',
					style: `min-height: ${initialMinHeight}px`,
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-label': initialPlaceholder || 'Extended response editor',
				},
			},
			onUpdate: ({ editor: ed }) => {
				const html = ed.getHTML();
				// Only emit if content actually changed
				if (html !== lastEmitted) {
					emit(html);
				}
			},
		});

		editor = ed;
		lastEmitted = ed.getHTML();

		return () => {
			editor?.destroy();
			editor = null;
		};
	});

	// Keep editable in sync (without re-creating the editor)
	$effect(() => {
		if (editor) {
			editor.setEditable(editable);
		}
	});

	// External value updates (avoid stomping over active edits)
	$effect(() => {
		if (!editor) return;
		// Only react to value prop changes
		const next = value || '';
		// Skip if this value was just emitted by us
		if (next === lastEmitted) return;
		// Don't interrupt active editing
		if (editor.isFocused) return;
		// Set flag to prevent emit from firing during programmatic update
		isProgrammaticUpdate = true;
		try {
			// Update editor content without triggering onUpdate callback
			editor.commands.setContent(next || '<p></p>', { emitUpdate: false });
			// Track what we set so we don't react to our own updates
			lastEmitted = editor.getHTML();
		} finally {
			isProgrammaticUpdate = false;
		}
	});
</script>

<div part="root" class="richtext-editor" data-readonly={editable ? 'false' : 'true'}>
	<div part="toolbar" class="rte-toolbar">
		<button
			part="toolbar-button"
			class="btn btn-sm btn-ghost"
			type="button"
			disabled={!editor || !editable}
			onclick={() => editor?.chain().focus().toggleBold().run()}
			aria-label="Bold"
		>
			<strong>B</strong>
		</button>
		<button
			part="toolbar-button"
			class="btn btn-sm btn-ghost"
			type="button"
			disabled={!editor || !editable}
			onclick={() => editor?.chain().focus().toggleItalic().run()}
			aria-label="Italic"
		>
			<em>I</em>
		</button>
		<div part="toolbar-divider" class="divider divider-horizontal mx-0"></div>
		<button
			part="toolbar-button"
			class="btn btn-sm btn-ghost"
			type="button"
			disabled={!editor || !editable}
			onclick={() => insertInlineMath()}
			aria-label="Insert inline math"
		>
			Math (inline)
		</button>
		<button
			part="toolbar-button"
			class="btn btn-sm btn-ghost"
			type="button"
			disabled={!editor || !editable}
			onclick={() => insertBlockMath()}
			aria-label="Insert block math"
		>
			Math (block)
		</button>
	</div>

	<div part="editor" class="tiptap-editor-container" bind:this={el}></div>
</div>

<style>
	.richtext-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.rte-toolbar {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.tiptap-editor-container {
		background: var(--color-base-100, oklch(100% 0 0));
		border: 1px solid var(--color-base-300, oklch(95% 0 0));
		border-radius: 0.5rem;
		padding: 0.75rem;
	}

	.tiptap-editor-container:focus-within {
		border-color: var(--color-primary, oklch(45% 0.24 277));
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary, oklch(45% 0.24 277)) 20%, transparent);
	}

	.richtext-editor[data-readonly='true'] .tiptap-editor-container {
		background: var(--color-base-200, oklch(98% 0 0));
		cursor: not-allowed;
	}

	/* Prose content styling (scoped to our stable hook) */
	:global(.pie-tiptap) {
		outline: none;
		color: var(--color-base-content, oklch(21% 0 0));
	}

	:global(.pie-tiptap p) {
		margin: 0 0 0.5rem 0;
	}

	:global(.pie-tiptap p:last-child) {
		margin-bottom: 0;
	}

	/* Placeholder */
	:global(.pie-tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: color-mix(in oklch, var(--color-base-content, oklch(21% 0 0)) 45%, transparent);
		pointer-events: none;
		height: 0;
	}

	/* Mathematics extension (KaTeX) */
	:global(.pie-tiptap .katex) {
		font-size: 1em;
	}

	:global(.pie-tiptap .katex-display) {
		margin: 1rem 0;
		text-align: center;
	}
</style>


