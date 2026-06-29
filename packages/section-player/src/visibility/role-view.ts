import type { QtiSectionRole } from '../contracts/index.js';

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
