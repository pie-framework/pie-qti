import type { QtiSectionRole } from '@pie-qti/section-player';

export function normalizeQtiViewTokens(view: string[] | undefined): string[] {
  return (view ?? [])
    .flatMap((token) => token.split(/[\s,]+/))
    .map((token) => token.trim())
    .filter(Boolean);
}

export function isQtiViewVisibleForRole(view: string[] | undefined, role: QtiSectionRole = 'candidate'): boolean {
  const tokens = normalizeQtiViewTokens(view);
  if (tokens.length === 0) return true;
  return tokens.includes(role);
}

export function filterQtiRoleVisible<T extends { view?: string[] }>(blocks: T[], role?: QtiSectionRole): T[] {
  return blocks.filter((block) => isQtiViewVisibleForRole(block.view, role));
}
