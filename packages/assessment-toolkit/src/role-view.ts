import type { QtiSectionRole } from '@pie-qti/section-player';

// The view-token semantics live in @pie-qti/section-player; re-export them so
// toolkit consumers have one place to import from, and add the block-filter
// convenience on top.
import { isQtiViewVisibleForRole } from '@pie-qti/section-player';

export {
  normalizeQtiViewTokens,
  isQtiViewVisibleForRole,
} from '@pie-qti/section-player';

export function filterQtiRoleVisible<T extends { view?: string[] }>(blocks: T[], role?: QtiSectionRole): T[] {
  return blocks.filter((block) => isQtiViewVisibleForRole(block.view, role));
}
