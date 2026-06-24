import type { QtiSectionRole, QtiSharedContext, QtiSharedHtmlBlock, QtiSharedHtmlBlockKind } from '@pie-qti/section-player';
import { isQtiViewVisibleForRole } from './role-view.js';

export interface QtiRubricLikeBlock {
  identifier?: string;
  use?: string;
  view?: string[];
  content: string;
}

export interface NormalizeQtiSharedContextOptions {
  rubricBlocks?: QtiRubricLikeBlock[];
  role?: QtiSectionRole;
}

export function normalizeQtiSharedContext(options: NormalizeQtiSharedContextOptions): QtiSharedContext {
  const passages: QtiSharedHtmlBlock[] = [];
  const rubricBlocks: QtiSharedHtmlBlock[] = [];

  for (const [index, block] of (options.rubricBlocks ?? []).entries()) {
    const normalized = toSharedHtmlBlock(block, index);
    if (!isQtiViewVisibleForRole(normalized.view, options.role)) continue;

    if (normalized.kind === 'passage') {
      passages.push(normalized);
    } else {
      rubricBlocks.push(normalized);
    }
  }

  return {
    passages,
    stimuli: [],
    rubricBlocks,
    testFeedback: [],
    stylesheets: [],
    catalogSources: [],
    assetDiagnostics: [],
  };
}

function toSharedHtmlBlock(block: QtiRubricLikeBlock, index: number): QtiSharedHtmlBlock {
  return {
    identifier: block.identifier ?? `${block.use ?? 'rubric'}-${index}`,
    kind: toSharedHtmlBlockKind(block.use),
    scope: 'section',
    view: block.view,
    rawHtml: block.content,
  };
}

function toSharedHtmlBlockKind(use: string | undefined): QtiSharedHtmlBlockKind {
  if (use === 'passage') return 'passage';
  if (use === 'instructions') return 'instructions';
  return 'rubric';
}
