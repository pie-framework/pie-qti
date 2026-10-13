/**
 * Accessibility catalogs
 *
 * pie-players' accessibility catalogs attach to a model, the item root, a passage or an
 * assessment, and markup points into them with `data-catalog-idref`. QTI 2.2 carries the same
 * content as APIP, which the export does not write, so an export that meets a catalog names it in
 * a warning. QTI 2.2 admits `data-*` attributes, so the idrefs stay in the markup.
 */

const CATALOG_IDREF = /\bdata-catalog-idref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/g;

/** Keys holding catalogs: pie-players' owner catalogs, and catalogs its SSML extraction wrote. */
const CATALOG_KEYS = new Set(['accessibilityCatalogs', 'extractedCatalogs']);

/**
 * The catalog identifiers `content` declares or references, in first-seen order. The embedded QTI
 * source under `qtiSource` is skipped: a generated export does not use it.
 */
export function findAccessibilityCatalogs(content: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(CATALOG_IDREF)) {
        const idref = (match[1] ?? match[2] ?? match[3]).trim();
        if (idref) found.add(idref);
      }
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'qtiSource') continue;
      if (CATALOG_KEYS.has(key) && Array.isArray(child)) {
        for (const catalog of child) {
          const identifier = (catalog as { identifier?: unknown } | null)?.identifier;
          if (typeof identifier === 'string' && identifier) found.add(identifier);
        }
        continue;
      }
      visit(child);
    }
  };
  visit(content);
  return [...found];
}

/**
 * A warning naming the catalogs `content` carries, which the export drops, or `undefined` when it
 * carries none. `subject` names what is exported, as in `Item "item-1"`.
 */
export function catalogsNotExportedWarning(subject: string, content: unknown): string | undefined {
  const catalogs = findAccessibilityCatalogs(content);
  if (catalogs.length === 0) return undefined;
  const names = catalogs.map((catalog) => `"${catalog}"`).join(', ');
  return `${subject} carries accessibility catalogs ${names}, which the QTI 2.2 export does not write`;
}
