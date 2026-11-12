<script lang="ts">

	import { Editor } from '@tiptap/core';
	import { Mathematics } from '@tiptap/extension-mathematics';
	import Placeholder from '@tiptap/extension-placeholder';
	import StarterKit from '@tiptap/starter-kit';
	import { untrack } from 'svelte';
	import { translate, type I18nProvider } from '@pie-qti/i18n';
	import { openMathLiveEditor } from '../extensions/MathLiveEditor.js';

	interface Props {
		value?: string;
		editable?: boolean;
		/** A visible hint inside the empty editor; it is not the editor's name. */
		placeholder?: string;
		minHeight?: number;
		/** Id(s) of the element(s) that name the editor, such as the interaction prompt. */
		ariaLabelledby?: string;
		/** The editor's name when nothing on screen names it (ignored with `ariaLabelledby`). */
		ariaLabel?: string;
		/** Id(s) of the element(s) that describe the editor, such as a character counter. */
		ariaDescribedby?: string;
		/** The content fails the interaction's pattern mask: the surface states `aria-invalid`. */
		ariaInvalid?: boolean;
		/**
		 * Allow the browser's spell check and autocorrect. Off by default, so
		 * spelling and writing items give every candidate the same help.
		 */
		spellcheck?: boolean;
		i18n?: I18nProvider;
		onChange?: (html: string) => void;
	}

	const {
		value = '',
		editable = true,
		placeholder = '',
		minHeight = 200,
		ariaLabelledby,
		ariaLabel,
		ariaDescribedby,
		ariaInvalid = false,
		spellcheck = false,
		i18n,
		onChange,
	}: Props = $props();

	// Translations
	const translations = $derived({
		bold: translate(i18n, 'interactions.extendedText.bold', 'Bold'),
		italic: translate(i18n, 'interactions.extendedText.italic', 'Italic'),
		insertInlineMath: translate(i18n, 'interactions.extendedText.insertInlineMath', 'Insert inline math'),
		insertBlockMath: translate(i18n, 'interactions.extendedText.insertBlockMath', 'Insert block math'),
		editMath: translate(i18n, 'interactions.extendedText.editMath', 'Edit math'),
		editorLabel:
			ariaLabel || placeholder || translate(i18n, 'interactions.extendedText.placeholder', 'Type your response here...'),
	});

	/** A math node the current selection can re-edit: its shape, LaTeX and position. */
	interface MathSelection {
		isBlock: boolean;
		latex: string;
		/** Document position of the math node's start, for the update command. */
		pos: number;
	}

	interface MathNodeLike {
		type: { name: string };
		attrs: { latex?: unknown };
		nodeSize: number;
	}

	function isMathNode(node: MathNodeLike | null | undefined): boolean {
		return node !== null && node !== undefined && (node.type.name === 'inlineMath' || node.type.name === 'blockMath');
	}

	function mathLatex(node: MathNodeLike): string {
		return typeof node.attrs.latex === 'string' ? node.attrs.latex : '';
	}

	/**
	 * The math expression the selection can re-edit: a node selection on inline or block
	 * math, or a caret sitting right beside an inline math atom (the inserted node leaves
	 * the caret just after it, and arrow keys move it to just before).
	 */
	function mathAtSelection(current: Editor): MathSelection | null {
		const selection = current.state.selection as {
			from: number;
			$from: { pos: number; nodeBefore: MathNodeLike | null; nodeAfter: MathNodeLike | null };
			node?: MathNodeLike;
		};
		if (selection.node && isMathNode(selection.node)) {
			return { isBlock: selection.node.type.name === 'blockMath', latex: mathLatex(selection.node), pos: selection.from };
		}
		const before = selection.$from.nodeBefore;
		if (before && isMathNode(before)) {
			return { isBlock: before.type.name === 'blockMath', latex: mathLatex(before), pos: selection.$from.pos - before.nodeSize };
		}
		const after = selection.$from.nodeAfter;
		if (after && isMathNode(after)) {
			return { isBlock: after.type.name === 'blockMath', latex: mathLatex(after), pos: selection.$from.pos };
		}
		return null;
	}

	/**
	 * Open the math dialog pre-filled with the expression at `math`, re-editing it in
	 * place; keyboard focus returns to `target` (the editor surface or the toolbar
	 * control that opened it).
	 */
	function openMathEdit(current: Editor, math: MathSelection, target: HTMLElement) {
		openMathLiveEditor({
			initialLatex: math.latex,
			isBlock: math.isBlock,
			mode: 'edit',
			returnFocusTo: target,
			i18n,
			onConfirm: (latex) => {
				// The commands read the CURRENT selection when no pos is given, so the
				// captured node position is passed explicitly: the caret may have moved.
				if (math.isBlock) current.commands.updateBlockMath({ latex, pos: math.pos });
				else current.commands.updateInlineMath({ latex, pos: math.pos });
				current.commands.focus();
			},
			onCancel: () => {
				current.commands.focus();
			},
		});
	}

	/**
	 * Attributes of the editable surface. A prompt or label names it; the
	 * placeholder stays a hint (`aria-placeholder`). Writing assistance is off
	 * unless spell checking is allowed, and capitalization is never automatic.
	 */
	const editorAttributes = $derived<Record<string, string>>({
		// Stable hook for theming. The host app's DaisyUI theme vars cascade here.
		class: 'pie-tiptap tiptap-prose',
		style: `min-height: ${minHeight}px`,
		role: 'textbox',
		dir: 'auto',
		'aria-multiline': 'true',
		...(ariaLabelledby ? { 'aria-labelledby': ariaLabelledby } : { 'aria-label': translations.editorLabel }),
		...(ariaDescribedby ? { 'aria-describedby': ariaDescribedby } : {}),
		...(ariaInvalid ? { 'aria-invalid': 'true' } : {}),
		...(placeholder ? { 'aria-placeholder': placeholder } : {}),
		...(editable ? {} : { 'aria-readonly': 'true' }),
		spellcheck: spellcheck ? 'true' : 'false',
		autocorrect: spellcheck ? 'on' : 'off',
		autocapitalize: 'off',
	});

	let el: HTMLDivElement | null = $state(null);
	let editor: Editor | null = $state(null);
	let boldActive = $state(false);
	let italicActive = $state(false);
	/** The math expression the current selection can re-edit (drives the Edit math button). */
	let mathSelection = $state<MathSelection | null>(null);
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

	/** Move keyboard focus into the editor (used after adding or removing a response). */
	export function focus() {
		if (!editor) return;
		// TipTap focuses on the next frame; focus the surface now so the move is immediate.
		(editor.view.dom as HTMLElement).focus();
		editor.commands.focus();
	}

	/**
	 * Math typed into the insert dialog but not inserted when a host closed the dialog (a
	 * proctor pause): offered again the next time the candidate opens the insert dialog in this
	 * editor. Session-only — it lives as long as this editor, one response field, and is never
	 * stored. Inserting the math, or the candidate's own cancel, discards it.
	 */
	let mathInsertDraft: string | null = null;

	/** Open the math dialog; Cancel or Escape returns focus to `trigger`, Insert to the editor. */
	function insertMath(isBlock: boolean, trigger: HTMLElement) {
		if (!editor) return;
		openMathLiveEditor({
			initialLatex: mathInsertDraft ?? '\\frac{a}{b}',
			isBlock,
			mode: 'insert',
			returnFocusTo: trigger,
			i18n,
			onConfirm: (latex) => {
				mathInsertDraft = null;
				if (isBlock) editor?.commands.insertBlockMath({ latex });
				else editor?.commands.insertInlineMath({ latex });
				editor?.commands.focus();
			},
			onCancel: ({ interrupted, latex }) => {
				// Focus has already returned to the toolbar button that opened the dialog.
				// A host's close keeps what was typed; the candidate's own cancel discards it.
				mathInsertDraft = interrupted && latex ? latex : null;
			},
		});
	}

	function syncActiveMarks(current: Editor) {
		boldActive = current.isActive('bold');
		italicActive = current.isActive('italic');
	}

	// Initialize editor once when element is available
	// Only tracks 'el' as a dependency, use untrack for other props to prevent recreation
	$effect(() => {
		if (!el) return;

		// Capture initial values without tracking them as dependencies
		const initialValue = untrack(() => value?.trim() ? value : '<p></p>');
		const initialPlaceholder = untrack(() => placeholder);
		const initialEditable = untrack(() => editable);
		const initialAttributes = untrack(() => editorAttributes);
		const initialI18n = untrack(() => i18n);

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
								mode: 'edit',
								returnFocusTo: ed.view.dom as HTMLElement,
								i18n: initialI18n,
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
								mode: 'edit',
								returnFocusTo: ed.view.dom as HTMLElement,
								i18n: initialI18n,
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
				attributes: initialAttributes,
				// Keyboard route to re-editing inserted math (it is otherwise reachable only
				// with a pointer, through the node's click handler): Enter or F2 on a
				// selection that touches an inline/block math expression opens the edit
				// dialog pre-filled with the expression's LaTeX.
				handleKeyDown: (view, event) => {
					if (event.key !== 'Enter' && event.key !== 'F2') return false;
					const math = mathAtSelection(ed);
					if (!math) return false;
					event.preventDefault();
					openMathEdit(ed, math, view.dom as HTMLElement);
					return true;
				},
			},
			onTransaction: ({ editor: current }) => {
				syncActiveMarks(current);
				mathSelection = mathAtSelection(current);
			},
			onUpdate: ({ editor: ed, transaction }) => {
				// `setEditable()` emits `update` with an empty transaction, so an editability
				// change arrives here looking like an edit; only a document change is one.
				if (!transaction.docChanged) return;
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

	// Keep the editable surface's name, description and writing assistance current
	// without re-creating the editor.
	$effect(() => {
		const attributes = editorAttributes;
		if (editor) {
			editor.setOptions({ editorProps: { attributes } });
		}
	});

	// Keep editable in sync (without re-creating the editor). `emitUpdate: false` keeps an
	// editability change from masquerading as a content edit.
	$effect(() => {
		if (editor) {
			editor.setEditable(editable, false);
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
			class="btn btn-sm rte-button"
			type="button"
			disabled={!editor || !editable}
			onclick={() => editor?.chain().focus().toggleBold().run()}
			aria-label={translations.bold}
			aria-pressed={boldActive ? 'true' : 'false'}
		>
			<strong aria-hidden="true">B</strong>
		</button>
		<button
			part="toolbar-button"
			class="btn btn-sm rte-button"
			type="button"
			disabled={!editor || !editable}
			onclick={() => editor?.chain().focus().toggleItalic().run()}
			aria-label={translations.italic}
			aria-pressed={italicActive ? 'true' : 'false'}
		>
			<em aria-hidden="true">I</em>
		</button>
		<div part="toolbar-divider" class="divider divider-horizontal mx-0" aria-hidden="true"></div>
		<button
			part="toolbar-button"
			class="btn btn-sm rte-button"
			type="button"
			disabled={!editor || !editable}
			onclick={(event) => insertMath(false, event.currentTarget)}
		>
			{translations.insertInlineMath}
		</button>
		<button
			part="toolbar-button"
			class="btn btn-sm rte-button"
			type="button"
			disabled={!editor || !editable}
			onclick={(event) => insertMath(true, event.currentTarget)}
		>
			{translations.insertBlockMath}
		</button>
		<!-- Enabled only while the selection touches a math expression, so it always edits
		     the expression the candidate is on; the keyboard route (Enter/F2 in the editor)
		     opens the same dialog. -->
		<button
			part="toolbar-button"
			class="btn btn-sm rte-button qti-math-edit-button"
			type="button"
			disabled={!editor || !editable || !mathSelection}
			onclick={(event) => {
				if (editor && mathSelection) openMathEdit(editor, mathSelection, event.currentTarget);
			}}
		>
			{translations.editMath}
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

	/* Primary K-12 targets: at least 44 by 44 CSS pixels. */
	.rte-button {
		box-sizing: border-box;
		min-block-size: 2.75rem;
		min-inline-size: 2.75rem;
	}

	.rte-button:focus-visible {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.rte-button[aria-pressed='true'] {
		border-color: var(--pie-qti-border-strong, #767676);
		background: var(--pie-qti-base-300, oklch(95% 0 0));
	}

	/*
	 * Forced colors drop the pressed fill, so Bold and Italic would look the same on and off.
	 * A pressed toggle takes the system selection colours instead; disabled toggles keep the
	 * platform's disabled rendering. The focus outline stays as it is.
	 */
	@media (forced-colors: active) {
		.rte-button[aria-pressed='true']:not(:disabled) {
			border-color: Highlight;
			background-color: Highlight;
			color: HighlightText;
		}
	}

	.tiptap-editor-container {
		background: var(--pie-qti-base-100, oklch(100% 0 0));
		/* The field boundary identifies the control: 3:1 against the page. */
		border: 1px solid var(--pie-qti-border-strong, #767676);
		border-radius: 0.5rem;
		padding: 0.75rem;
	}

	/* The editable surface draws no ring of its own, so its container shows focus. */
	.tiptap-editor-container:focus-within {
		outline: 2px solid var(--pie-qti-focus, #4338ca);
		outline-offset: 2px;
	}

	.richtext-editor[data-readonly='true'] .tiptap-editor-container {
		background: var(--pie-qti-base-200, oklch(98% 0 0));
		cursor: not-allowed;
	}

	/* Prose content styling (scoped to our stable hook) */
	:global(.pie-tiptap) {
		outline: none;
		color: var(--pie-qti-base-content, oklch(21% 0 0));
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
		float: inline-start;
		/* A solid mix (not transparency) keeps the hint at 4.5:1 on the editor background. */
		color: color-mix(in oklch, var(--pie-qti-base-content, oklch(21% 0 0)) 65%, var(--pie-qti-base-100, oklch(100% 0 0)));
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
