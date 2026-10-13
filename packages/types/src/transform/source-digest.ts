/**
 * Source digests
 *
 * Each direction of the PIE <-> QTI round-trip embeds the other format's source and prefers it on
 * the way back. The source carries a digest of the content generated beside it, and a reader uses
 * the source only while that content still has the same digest: an edit made after the export
 * changes the digest, and the reader transforms the edited content instead.
 *
 * A QTI document is digested as text with line endings normalized; a PIE config as JSON with keys
 * sorted, so storage that reorders keys keeps the digest. A deliberate trade: any byte-level edit,
 * reformatting included, marks the source stale, which costs fidelity and never correctness.
 */

/**
 * `sha256:<hex>` of a QTI document's text or a PIE config's canonical JSON.
 */
export async function sourceDigest(value: string | object): Promise<string> {
  const text = typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : canonicalJson(value);
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return `sha256:${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested) =>
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? Object.fromEntries(Object.keys(nested).sort().map((key) => [key, nested[key]]))
      : nested
  );
}
