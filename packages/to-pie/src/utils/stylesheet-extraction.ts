/**
 * Carry QTI `<stylesheet>` references into the PIE item as
 * `config.resources.stylesheets[]`.
 *
 * QTI packages put shared styling in a stylesheet file that items reference
 * rather than inline. The conversion used to forward nothing, so a package that
 * previewed correctly on the QTI side converted to a PIE item that rendered
 * unstyled.
 *
 * PIE needs no model change to carry this: `PieItemConfig.resources` already has
 * a `stylesheets[]` array of URLs that the players fetch and scope to the player
 * instance (`ConfigResource` in `pie-players` - `packages/players-shared`). So
 * this is a wiring gap, and the conversion deliberately does **not** flatten
 * rules to inline styles.
 *
 * **`url` carries the `href` as the conversion receives it.** A host that
 * rewrites package assets to durable asset-store references before conversion
 * gets that reference here, exactly as image references do, and resolves it to
 * an `https:` URL per surface at render time. That matters because the players
 * reject any non-`http(s)` stylesheet URL outright.
 *
 * Without such a rewrite the original relative href is carried through
 * unchanged. That is deliberate: it keeps the reference the author wrote rather
 * than inventing one, and leaves an unresolvable reference visible to the host
 * instead of silently dropping it.
 */

import type { PieItem } from '@pie-qti/transform-types';

/** `<stylesheet href="...">`, with an optional namespace prefix or the QTI 3 `qti-` name. */
const STYLESHEET_ELEMENT = /<\s*(?:[\w.-]+:)?(?:qti-)?stylesheet\b([^>]*?)\/?>/gi;

/** XML spans whose contents are not markup and must not be scanned. */
const COMMENT_OR_CDATA = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;

export interface StylesheetResource {
  url: string;
}

/**
 * Collect the stylesheet references an item declares, in document order and
 * de-duplicated. Returns `[]` when the item declares none, so callers can leave
 * `config.resources` absent rather than writing an empty array.
 */
export function extractStylesheetResources(qtiXml: string): StylesheetResource[] {
  if (!qtiXml) return [];
  const spans = maskedSpans(qtiXml);
  const urls: string[] = [];
  for (const match of qtiXml.matchAll(STYLESHEET_ELEMENT)) {
    if (match.index === undefined || isMasked(spans, match.index)) continue;
    const href = attributeValue(match[1] ?? '', 'href');
    if (href && !urls.includes(href)) urls.push(href);
  }
  return urls.map((url) => ({ url }));
}

/**
 * Attach the item's stylesheet references to its config, preserving any
 * `resources` a transformer or vendor extension already set.
 *
 * Existing `stylesheets` entries win on URL identity, so a vendor extension that
 * has already resolved a stylesheet is not duplicated by the raw href here.
 */
export function withStylesheetResources(pieItem: PieItem, qtiXml: string): PieItem {
  const stylesheets = extractStylesheetResources(qtiXml);
  if (stylesheets.length === 0) return pieItem;

  const existingResources =
    typeof pieItem.config.resources === 'object' && pieItem.config.resources !== null
      ? (pieItem.config.resources as Record<string, unknown>)
      : undefined;
  const existing = Array.isArray(existingResources?.stylesheets)
    ? (existingResources.stylesheets as unknown[])
    : [];
  const existingUrls = new Set(
    existing
      .map((entry) =>
        typeof entry === 'object' && entry !== null ? (entry as { url?: unknown }).url : undefined
      )
      .filter((url): url is string => typeof url === 'string')
  );
  const added = stylesheets.filter((stylesheet) => !existingUrls.has(stylesheet.url));
  if (added.length === 0) return pieItem;

  return {
    ...pieItem,
    config: {
      ...pieItem.config,
      resources: {
        ...(existingResources ?? {}),
        stylesheets: [...existing, ...added],
      },
    },
  };
}

function attributeValue(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = pattern.exec(attributes);
  const value = match?.[1] ?? match?.[2];
  return value?.trim() || undefined;
}

function maskedSpans(xml: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const match of xml.matchAll(COMMENT_OR_CDATA)) {
    if (match.index === undefined) continue;
    spans.push([match.index, match.index + match[0].length]);
  }
  return spans;
}

function isMasked(spans: Array<[number, number]>, index: number): boolean {
  return spans.some(([start, end]) => index >= start && index < end);
}
