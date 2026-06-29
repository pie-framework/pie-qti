import type { QtiSectionRole, QtiSectionToolConfig, QtiSharedContext, QtiSharedHtmlBlock, QtiSharedHtmlBlockKind } from '@pie-qti/section-player';
import { isQtiViewVisibleForRole } from './role-view.js';
import { normalizeQtiToolConfig } from './tool-normalization.js';

export interface QtiRubricLikeBlock {
  identifier?: string;
  use?: string;
  view?: string[];
  tools?: QtiSectionToolConfig[];
  content: string;
}

export interface NormalizeQtiSharedContextOptions {
  rubricBlocks?: QtiRubricLikeBlock[];
  role?: QtiSectionRole;
  passageTools?: QtiSectionToolConfig[];
  rubricTools?: QtiSectionToolConfig[];
}

export function normalizeQtiSharedContext(options: NormalizeQtiSharedContextOptions): QtiSharedContext {
  const passages: QtiSharedHtmlBlock[] = [];
  const rubricBlocks: QtiSharedHtmlBlock[] = [];

  for (const [index, block] of (options.rubricBlocks ?? []).entries()) {
    const normalized = toSharedHtmlBlock(block, index, options);
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

function toSharedHtmlBlock(
  block: QtiRubricLikeBlock,
  index: number,
  options: NormalizeQtiSharedContextOptions,
): QtiSharedHtmlBlock {
  const kind = toSharedHtmlBlockKind(block.use);
  const defaultTools = kind === 'passage' ? options.passageTools : options.rubricTools;
  const tools = normalizeQtiToolConfig({ tools: block.tools ?? defaultTools, role: options.role });
  return {
    identifier: block.identifier ?? `${block.use ?? 'rubric'}-${index}`,
    kind,
    scope: 'section',
    view: block.view,
    ...(tools.length > 0 ? { tools } : {}),
    rawHtml: block.content,
  };
}

function toSharedHtmlBlockKind(use: string | undefined): QtiSharedHtmlBlockKind {
  if (use === 'passage') return 'passage';
  if (use === 'instructions') return 'instructions';
  return 'rubric';
}
