import type { QtiSectionRole, QtiSectionToolConfig } from '@pie-qti/section-player';
import { isQtiViewVisibleForRole } from './role-view.js';

export interface NormalizeQtiToolConfigOptions {
  tools?: QtiSectionToolConfig[];
  role?: QtiSectionRole;
}

export function normalizeQtiToolConfig(options: NormalizeQtiToolConfigOptions): QtiSectionToolConfig[] {
  return (options.tools ?? []).filter(
    (tool) => tool.enabled !== false && isQtiViewVisibleForRole(tool.view, options.role ?? 'candidate'),
  );
}
