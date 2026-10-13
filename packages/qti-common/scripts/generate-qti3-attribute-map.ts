/**
 * Generate `src/element-mapper/qti3-attribute-map.ts` from the IMS QTI schemas vendored in
 * `packages/to-pie/schemas/qti`.
 *
 * QTI 3.0 renamed every QTI-defined attribute from camelCase to kebab-case (without the
 * `qti-` prefix that elements get), so the QTI 3 → QTI 2 attribute map is exactly "the
 * camelCase attribute names in the QTI 2.x vocabulary, kebab-cased". Deriving it from the
 * schemas rather than hand-listing it is the whole point: a hand-picked allow-list is how
 * the transform came to cover 7 attributes while real content used 24, silently leaving
 * `time-dependent` on every QTI 3 item — which both kept an illegal attribute and dropped
 * the QTI-2-required `timeDependent`.
 *
 * The uppercase filter is what keeps this safe. Attributes that are *already* kebab-case
 * in QTI 2.x — `aria-controls`, `aria-describedby`, and friends — contain no uppercase
 * letter, so they never enter the map and are never rewritten. Neither are `data-*`,
 * `xml:lang`, or any HTML attribute, because the map is matched by exact name.
 *
 * Run: `bun run packages/qti-common/scripts/generate-qti3-attribute-map.ts`
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCHEMA_DIR = path.join(import.meta.dirname, '..', '..', 'to-pie', 'schemas', 'qti');
const OUT_FILE = path.join(import.meta.dirname, '..', 'src', 'element-mapper', 'qti3-attribute-map.ts');
const ROOTS = ['imsqti_v2p1.xsd', 'imsqti_v2p2.xsd'];

const camelNames = new Set<string>();
for (const root of ROOTS) {
  const xsd = fs.readFileSync(path.join(SCHEMA_DIR, root), 'utf8');
  for (const match of xsd.matchAll(/<xs:attribute[^>]*\bname="([A-Za-z_][\w.-]*)"/g)) {
    // Declarations are named `attr` or `attr.Owner.Attr`; the attribute is the first part.
    const base = (match[1] as string).split('.')[0] as string;
    if (/[A-Z]/.test(base)) {
      camelNames.add(base);
    }
  }
}

const toKebab = (name: string) => name.replace(/([A-Z])/g, (c) => `-${c.toLowerCase()}`);
const entries = [...camelNames].sort().map((camel) => [toKebab(camel), camel] as const);

/**
 * Which interactions may legally contain a `prompt`, straight from the 2.2 content model:
 * the types deriving from `BasePromptInteraction.Type` plus the two graphic interactions
 * that declare `prompt` directly. Derived rather than listed because the inline
 * interactions (`textEntryInteraction`, `inlineChoiceInteraction`, `endAttemptInteraction`)
 * must *not* be included — relocating a prompt into one would swap one schema violation
 * for another.
 */
const qti22 = fs.readFileSync(path.join(SCHEMA_DIR, 'imsqti_v2p2.xsd'), 'utf8');
const promptBearingTypes = new Set<string>();
for (const match of qti22.matchAll(
  /<xs:complexType name="([A-Za-z0-9._]+)"[^>]*>([\s\S]*?)<\/xs:complexType>/g
)) {
  const [, name, content] = match as unknown as [string, string, string];
  if (content.includes('base="BasePromptInteraction.Type"') || content.includes('ref="prompt"')) {
    promptBearingTypes.add(name);
  }
}
const elementNameByType = new Map<string, string>();
for (const match of qti22.matchAll(/<xs:element name="([A-Za-z]+)" type="([A-Za-z0-9._]+)"/g)) {
  const [, element, type] = match as unknown as [string, string, string];
  if (!elementNameByType.has(type)) {
    elementNameByType.set(type, element);
  }
}
const promptBearing = [...promptBearingTypes]
  .map((type) => elementNameByType.get(type))
  .filter((name): name is string => Boolean(name))
  .sort();

const banner = `// GENERATED FILE — do not edit by hand.
// Regenerate with:
//   bun run packages/qti-common/scripts/generate-qti3-attribute-map.ts
//
// Derived from the IMS QTI schemas vendored in packages/to-pie (${ROOTS.join(', ')}) by taking every
// camelCase attribute name in the QTI 2.x vocabulary and kebab-casing it, which is exactly
// the QTI 3.0 attribute rename. Attributes already kebab-case in QTI 2.x (\`aria-*\`) carry
// no uppercase letter and so are absent here by construction — as are \`data-*\`,
// \`xml:lang\` and HTML attributes, since lookup is by exact name.
`;

const body = `${banner}
/** QTI 3.0 kebab-case attribute name → QTI 2.x camelCase equivalent. ${entries.length} entries. */
export const QTI3_ATTRIBUTE_TO_QTI2 = new Map<string, string>([
${entries.map(([kebab, camel]) => `  ['${kebab}', '${camel}'],`).join('\n')}
]);

/**
 * QTI 2.2 interactions whose content model permits a \`prompt\` child (it must come first).
 * The inline interactions are deliberately absent: moving a prompt into one would trade one
 * schema violation for another.
 */
export const QTI2_PROMPT_BEARING_INTERACTIONS: ReadonlySet<string> = new Set([
${promptBearing.map((name) => `  '${name}',`).join('\n')}
]);
`;

fs.writeFileSync(OUT_FILE, body);
console.log(
  `wrote ${OUT_FILE} with ${entries.length} attribute mappings and ` +
    `${promptBearing.length} prompt-bearing interactions`
);
