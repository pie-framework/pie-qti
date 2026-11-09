import { filterToolsForRole, type QtiSectionRole, type QtiSectionToolConfig } from '@pie-qti/section-player';

export interface NormalizeQtiToolConfigOptions {
  tools?: QtiSectionToolConfig[];
  role?: QtiSectionRole;
}

/**
 * The enabled tools visible to `role` (the candidate when unset): the section player's
 * tool filter, applied without PNP supports. Empty when none remain.
 */
export function normalizeQtiToolConfig(options: NormalizeQtiToolConfigOptions): QtiSectionToolConfig[] {
  return filterToolsForRole(options.tools, options.role) ?? [];
}
