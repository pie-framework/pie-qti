/**
 * CDATA section unwrapping for markup bound for PIE models
 */

/** A balanced CDATA section, capturing the payload it wraps. */
const CDATA_SECTION = /<!\[CDATA\[([\s\S]*?)\]\]>/g;

/**
 * Replace CDATA sections with the markup they carry.
 *
 * QTI 2.1 exports from ExamView-style authoring tools wrap item XHTML in CDATA,
 * and `node-html-parser` hands those delimiters back as part of `innerHTML`. A
 * PIE model holds HTML, not XML, so the delimiters have to come off before the
 * markup is stored: a browser treats `<![CDATA[` as a bogus comment and renders
 * the trailing `]]>` as visible text.
 *
 * Unbalanced markers are left alone rather than stripped, so a stray `]]>` in
 * authored prose survives instead of being silently rewritten.
 */
export function unwrapCdataSections(markup: string): string {
  return markup.replace(CDATA_SECTION, '$1');
}
