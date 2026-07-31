/**
 * QTI choice orientation to PIE choice layout
 */

/** The layout fields a PIE choice-based element understands. */
export interface PieChoiceLayout {
  choicesLayout?: 'grid' | 'horizontal' | 'vertical';
  gridColumns?: number;
}

/**
 * Map a QTI interaction's `orientation` onto the PIE choice layout.
 *
 * `horizontal` and `vertical` pass straight through. QTI's `grid` and `stacked`
 * have no PIE equivalent; a two-column grid is the closest the element can
 * render, and is what the loader with the most real-content exposure settles on.
 *
 * An absent or unrecognized orientation yields an empty object so the PIE
 * element keeps its own default rather than being pinned to a guess.
 */
export function mapChoiceLayout(orientation: string | null | undefined): PieChoiceLayout {
  switch ((orientation || '').trim().toLowerCase()) {
    case 'horizontal':
      return { choicesLayout: 'horizontal' };
    case 'vertical':
      return { choicesLayout: 'vertical' };
    case 'grid':
    case 'stacked':
      return { choicesLayout: 'grid', gridColumns: 2 };
    default:
      return {};
  }
}
