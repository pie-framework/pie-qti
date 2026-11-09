import type { TextEntryInteractionData } from '../shared/types.js';

/**
 * The inline style of a text-entry blank: the authored `expectedLength` hint as its width, with
 * the minimum usable size, and a cap that keeps the blank inside its container (WCAG 2.2
 * SC 1.4.10 Reflow) — at a 320 CSS px viewport (400% zoom), an authored width larger than the
 * viewport must not force two-dimensional scrolling.
 */
export function textEntryInputStyle(
	interaction: Pick<TextEntryInteractionData, 'expectedLength'>,
	options?: { widthClass?: string },
): string {
	// QTI 3.0 Shared Vocabulary: a qti-input-width-N class owns the width in character units.
	const width = options?.widthClass ? '' : `width: ${interaction.expectedLength * 8}px; `;
	return `${width}min-width: 100px; max-width: 100%; display: inline-block; margin: 0 4px;`;
}
