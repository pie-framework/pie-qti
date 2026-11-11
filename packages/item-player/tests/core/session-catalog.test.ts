import { describe, expect, test } from 'bun:test';
import { extractCatalog } from '../../src/catalog/catalogExtractor.js';
import { catalogEntryOf, isCatalogUrl, type SessionCatalogIndexes } from '../../src/catalog/sessionCatalog.js';

/**
 * A catalog entry that ends in a filename-looking token is not a URL: the URL
 * branch's output goes to `src` attributes and to hosts via `qti-catalog-lookup`
 * unmodified, so only markup-free entries may take it. Everything else —
 * whatever its tail — must cross sanitizeHtml, and a blocked URL stays null.
 */

const CATALOG_XML = `<qti-catalog-info xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
<qti-catalog identifier="markup-tail"><qti-card usage="glossary-on-screen"><qti-html-content><img src="x" onerror="alert(1)"/>see photo.png</qti-html-content></qti-card></qti-catalog>
<qti-catalog identifier="escaped-tail"><qti-card usage="glossary-on-screen"><qti-html-content>&lt;img src=x onerror=alert(1)&gt;see photo.png</qti-html-content></qti-card></qti-catalog>
<qti-catalog identifier="absolute"><qti-card usage="glossary-on-screen"><qti-file-href>https://example.com/photo.png</qti-file-href></qti-card></qti-catalog>
<qti-catalog identifier="relative"><qti-card usage="glossary-on-screen"><qti-html-content>images/photo.png</qti-html-content></qti-card></qti-catalog>
<qti-catalog identifier="data-html"><qti-card usage="glossary-on-screen"><qti-file-href>data:text/html;base64,PGgxPmhpPC9oMT4=</qti-file-href></qti-card></qti-catalog>
<qti-catalog identifier="blob"><qti-card usage="glossary-on-screen"><qti-file-href>blob:https://example.com/x.png</qti-file-href></qti-card></qti-catalog>
<qti-catalog identifier="scheme-png"><qti-card usage="glossary-on-screen"><qti-html-content>javascript:alert(1).png</qti-html-content></qti-card></qti-catalog>
<qti-catalog identifier="svg-data"><qti-card usage="glossary-on-screen"><qti-file-href>data:image/svg+xml,%3Csvg onload%3Dalert(1)%3E%3C/svg%3E</qti-file-href></qti-card></qti-catalog>
</qti-catalog-info>`;

function indexesOf(xml: string = CATALOG_XML): SessionCatalogIndexes {
	return { catalogIndex: extractCatalog(xml), stimulusCatalogIndexes: new Map() };
}

const entryOf = (id: string, indexes: SessionCatalogIndexes = indexesOf()) =>
	catalogEntryOf(indexes, id, 'glossary-on-screen');

describe('catalogEntryOf URL-vs-HTML decision', () => {
	test('markup that ends in a filename-looking token is HTML, never a URL', () => {
		expect(isCatalogUrl('<img src=x onerror=alert(1)>see photo.png')).toBe(false);
		const result = entryOf('markup-tail');
		expect(result).not.toBeNull();
		const html = String(result);
		expect(html).toContain('photo.png');
		expect(html).not.toContain('onerror');
	});

	test('escaped markup with a .png tail still crosses sanitizeHtml', () => {
		const html = String(entryOf('escaped-tail'));
		// The markup stays escaped, so it renders as inert text — no live element.
		expect(html).toContain('&lt;img');
		expect(html).not.toContain('<img');
		expect(html).toContain('photo.png');
	});

	test('a legitimate absolute URL entry stays a URL', () => {
		expect(entryOf('absolute')).toBe('https://example.com/photo.png');
	});

	test('a bare relative path entry stays a URL', () => {
		expect(entryOf('relative')).toBe('images/photo.png');
	});

	test('a blocked URL entry is null, like every sanitizer result', () => {
		// data:text/html is scheme-decisive but blocked for images…
		expect(entryOf('data-html')).toBeNull();
		// …blob: images are off by default…
		expect(entryOf('blob')).toBeNull();
		// …svg data images are off by default…
		expect(entryOf('svg-data')).toBeNull();
		// …and a dangerous scheme never becomes an attribute value.
		expect(entryOf('scheme-png')).toBeNull();
	});
});

describe('the fallback popup img-vs-HTML decision agrees with catalogEntryOf', () => {
	/**
	 * The popup renders an image exactly when the entry took the URL branch; what
	 * it must never do is put the URL branch's unescaped output through
	 * innerHTML, or put markup through `src`. The invariant: raw entries the URL
	 * predicate accepts come back markup-free, and everything else comes back as
	 * sanitized (entity-escaped or tagged) HTML.
	 */
	test('URL-branch outputs are markup-free (or null); HTML-branch outputs carry markup or are escaped', () => {
		for (const id of ['markup-tail', 'escaped-tail', 'absolute', 'relative', 'data-html', 'blob', 'scheme-png', 'svg-data']) {
			const raw = rawEntryHtml(id);
			const result = entryOf(id);
			if (isCatalogUrl(raw)) {
				// A URL entry becomes a policy-checked URL or is blocked to null; it
				// never reaches innerHTML.
				if (result !== null) expect(String(result)).not.toMatch(/[<>&'"]/);
			} else {
				const html = String(result ?? '');
				expect(html === '' || /[<>&'"]/.test(html), `${id}: HTML entry never renders bare`).toBe(true);
			}
		}
	});

	test('isCatalogUrl covers the shapes the URL branch accepts and nothing else', () => {
		expect(isCatalogUrl('https://example.com/a.png?x=1&y=2')).toBe(true);
		expect(isCatalogUrl('/abs/path.png')).toBe(true);
		expect(isCatalogUrl('./rel.png')).toBe(true);
		expect(isCatalogUrl('data:image/png;base64,iVBOR')).toBe(true);
		expect(isCatalogUrl('see photo.png')).toBe(true);
		expect(isCatalogUrl('')).toBe(false);
		expect(isCatalogUrl("images/a.png?x=1&y='2'")).toBe(false);
		expect(isCatalogUrl('<p>glossary text</p>')).toBe(false);
	});
});

/** The raw, unprocessed entry text the lookup returns for one fixture catalog. */
function rawEntryHtml(id: string): string {
	const card = extractCatalog(CATALOG_XML).get(id);
	if (!card || card.entries.length !== 1) throw new Error(`fixture catalog '${id}' not found`);
	return card.entries[0].html;
}
