/**
 * Re-vendor the QTI XSD closure under `schemas/qti/`.
 *
 * The validity gate must not touch the network at validation time, so every schema the
 * QTI roots reach — transitively, across four hosts — is fetched once and committed.
 * Two things make this more than a download loop:
 *
 * 1. **Locations are rewritten to flat local names.** libxml2 resolves `schemaLocation`
 *    literally; left as `http://…` URLs it would try to fetch them and fail closed
 *    inside the wasm sandbox. Every location is rewritten to the basename we store.
 * 2. **Encodings are normalized to UTF-8.** `XInclude.xsd` ships as UTF-16LE with no
 *    charset header, and xmllint reads UTF-8 only. Decoding is BOM-driven and any
 *    `encoding=` in the XML declaration is rewritten to match what we actually wrote.
 *
 * Run: `bun run packages/to-pie/scripts/fetch-qti-schemas.ts packages/to-pie/schemas/qti`
 * Re-run only to refresh the vendored set; the committed output is the source of truth.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** The two roots Composer validates against. QTI 2.1 dominates real partner content. */
const ROOTS: ReadonlyArray<readonly [string, string]> = [
  ['imsqti_v2p1.xsd', 'https://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd'],
  ['imsqti_v2p2.xsd', 'https://www.imsglobal.org/xsd/qti/qtiv2p2/imsqti_v2p2.xsd'],
];

const outDir = process.argv[2];
if (!outDir) {
  throw new Error('usage: fetch-qti-schemas.ts <outDir>');
}
fs.mkdirSync(outDir, { recursive: true });

const localNameByUrl = new Map<string, string>();
const usedNames = new Set<string>();
const failed: Array<{ url: string; reason: string }> = [];

/**
 * The same schema is reachable under several spellings — notably `http:` vs `https:`
 * for imsglobal.org — and treating those as distinct files makes libxml2 import one
 * namespace twice and emit a parser warning. Collapse scheme and host case so that one
 * schema gets exactly one vendored file.
 */
function canonicalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  return url.toString();
}

function assignName(url: string): string {
  const existing = localNameByUrl.get(url);
  if (existing) {
    return existing;
  }
  let base = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'schema.xsd');
  if (!base.endsWith('.xsd')) {
    base += '.xsd';
  }
  // Distinct schemas can share a basename across hosts (mathml2 and mathml3 both ship a
  // `tokens.xsd`), so suffix rather than overwrite.
  let name = base;
  let suffix = 1;
  while (usedNames.has(name)) {
    suffix += 1;
    name = base.replace(/\.xsd$/, `-${suffix}.xsd`);
  }
  usedNames.add(name);
  localNameByUrl.set(url, name);
  return name;
}

async function fetchSchemaText(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
  } else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    text = new TextDecoder('utf-8').decode(bytes.subarray(3));
  } else {
    text = new TextDecoder('utf-8').decode(bytes);
  }
  return text.replace(/^<\?xml\b[^?]*\?>/, (declaration) =>
    declaration.replace(/encoding\s*=\s*(["'])[^"']*\1/i, 'encoding="UTF-8"')
  );
}

const LOCATION_PATTERN = /\b(schemaLocation\s*=\s*)(["'])([^"']+)\2/g;

const queue: Array<{ url: string; name: string }> = [];
for (const [name, url] of ROOTS) {
  const canonical = canonicalizeUrl(url);
  localNameByUrl.set(canonical, name);
  usedNames.add(name);
  queue.push({ url: canonical, name });
}

let fetched = 0;
while (queue.length > 0) {
  const next = queue.shift();
  if (!next) {
    break;
  }
  let text: string;
  try {
    text = await fetchSchemaText(next.url);
  } catch (error) {
    failed.push({ url: next.url, reason: error instanceof Error ? error.message : String(error) });
    continue;
  }
  fetched += 1;

  const rewritten = text.replace(
    LOCATION_PATTERN,
    (whole: string, prefix: string, quote: string, location: string) => {
      // A namespace-only import carries no target to rewrite.
      if (!location.trim() || location.startsWith('#')) {
        return whole;
      }
      let absolute: string;
      try {
        absolute = canonicalizeUrl(new URL(location, next.url).toString());
      } catch {
        return whole;
      }
      const alreadyKnown = localNameByUrl.has(absolute);
      const localName = assignName(absolute);
      if (!alreadyKnown) {
        queue.push({ url: absolute, name: localName });
      }
      return `${prefix}${quote}${localName}${quote}`;
    }
  );

  fs.writeFileSync(path.join(outDir, next.name), rewritten);
  process.stdout.write(`\r${fetched} fetched, ${queue.length} queued   `);
}

const totalBytes = fs
  .readdirSync(outDir)
  .reduce((sum, file) => sum + fs.statSync(path.join(outDir, file)).size, 0);

console.log(`\n\nfetched ${fetched} schemas into ${outDir}`);
console.log(`total ${(totalBytes / 1024 / 1024).toFixed(1)} MiB across ${usedNames.size} files`);
if (failed.length > 0) {
  console.log(`\nFAILED (${failed.length}) — the vendored set is incomplete:`);
  for (const failure of failed) {
    console.log(`  ${failure.url} — ${failure.reason}`);
  }
  process.exitCode = 1;
}
