import { describe, it, expect } from 'bun:test';
import { extractCatalog, extractCatalogFromItemXml, mergeCatalogs } from '../catalog/catalogExtractor.js';
import { getCatalogEntry } from '../catalog/catalogLookup.js';
import { Player } from '../core/Player.js';

// ---------------------------------------------------------------------------
// extractCatalog
// ---------------------------------------------------------------------------

const CATALOG_XML = `
<qti-catalog-info>
  <qti-card identifier="term-photosynthesis">
    <qti-card-entry usage="glossary-on-screen" xml:lang="en-US">
      <qti-html-content>The process by which plants make food using sunlight.</qti-html-content>
    </qti-card-entry>
    <qti-card-entry usage="glossary-on-screen" xml:lang="es">
      <qti-html-content>El proceso por el cual las plantas producen alimento usando la luz solar.</qti-html-content>
    </qti-card-entry>
    <qti-card-entry usage="keyword-translation" xml:lang="es">
      <qti-html-content>fotosíntesis</qti-html-content>
    </qti-card-entry>
    <qti-card-entry usage="illustrated-glossary">
      <qti-file-href src="https://example.com/photosynthesis.png"/>
    </qti-card-entry>
    <qti-card-entry usage="tts-pronunciation">
      <qti-html-content>fo-to-SIN-the-sis</qti-html-content>
    </qti-card-entry>
    <qti-card-entry usage="signing-definition">
      <qti-file-href src="https://example.com/sign-photo.mp4"/>
    </qti-card-entry>
    <qti-card-entry usage="braille-text">
      <qti-html-content>⠏⠓⠕⠞⠕⠎⠽⠝⠞⠓⠑⠎⠊⠎</qti-html-content>
    </qti-card-entry>
    <qti-card-entry usage="audio-description">
      <qti-file-href src="https://example.com/audio-photo.mp3"/>
    </qti-card-entry>
    <qti-card-entry usage="extended-description">
      <qti-html-content><p>Photosynthesis occurs in the chloroplasts of plant cells.</p></qti-html-content>
    </qti-card-entry>
  </qti-card>
</qti-catalog-info>
`;

describe('extractCatalog', () => {
	it('returns empty map for empty input', () => {
		expect(extractCatalog('').size).toBe(0);
	});

	it('returns empty map when no qti-catalog-info present', () => {
		expect(extractCatalog('<div>nothing</div>').size).toBe(0);
	});

	it('parses a card and returns it by identifier', () => {
		const index = extractCatalog(CATALOG_XML);
		expect(index.has('term-photosynthesis')).toBe(true);
	});

	it('parses all 8 standard usage types', () => {
		const index = extractCatalog(CATALOG_XML);
		const card = index.get('term-photosynthesis')!;
		const usages = card.entries.map((e) => e.usage);
		expect(usages).toContain('glossary-on-screen');
		expect(usages).toContain('keyword-translation');
		expect(usages).toContain('illustrated-glossary');
		expect(usages).toContain('tts-pronunciation');
		expect(usages).toContain('signing-definition');
		expect(usages).toContain('braille-text');
		expect(usages).toContain('audio-description');
		expect(usages).toContain('extended-description');
	});

	it('captures xml:lang on entries', () => {
		const index = extractCatalog(CATALOG_XML);
		const card = index.get('term-photosynthesis')!;
		const enEntry = card.entries.find((e) => e.usage === 'glossary-on-screen' && e.lang === 'en-US');
		expect(enEntry).toBeDefined();
		expect(enEntry!.html).toContain('plants make food');
	});

	it('captures src from qti-file-href for media entries', () => {
		const index = extractCatalog(CATALOG_XML);
		const card = index.get('term-photosynthesis')!;
		const imgEntry = card.entries.find((e) => e.usage === 'illustrated-glossary');
		expect(imgEntry?.html).toContain('photosynthesis.png');
	});

	it('parses multiple xml:lang variants for same usage', () => {
		const index = extractCatalog(CATALOG_XML);
		const card = index.get('term-photosynthesis')!;
		const glossaryEntries = card.entries.filter((e) => e.usage === 'glossary-on-screen');
		expect(glossaryEntries.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// mergeCatalogs
// ---------------------------------------------------------------------------

describe('mergeCatalogs', () => {
	it('item-level entries win on collision', () => {
		const base = extractCatalog(`
			<qti-catalog-info>
				<qti-card identifier="term-A">
					<qti-card-entry usage="glossary-on-screen">
						<qti-html-content>Base definition</qti-html-content>
					</qti-card-entry>
				</qti-card>
			</qti-catalog-info>
		`);
		const override = extractCatalog(`
			<qti-catalog-info>
				<qti-card identifier="term-A">
					<qti-card-entry usage="glossary-on-screen">
						<qti-html-content>Item definition</qti-html-content>
					</qti-card-entry>
				</qti-card>
			</qti-catalog-info>
		`);
		const merged = mergeCatalogs(base, override);
		const entry = merged.get('term-A')!.entries[0];
		expect(entry.html).toBe('Item definition');
	});

	it('shared-only entries are present in merged result', () => {
		const shared = extractCatalog(`
			<qti-catalog-info>
				<qti-card identifier="shared-term">
					<qti-card-entry usage="glossary-on-screen">
						<qti-html-content>Shared def</qti-html-content>
					</qti-card-entry>
				</qti-card>
			</qti-catalog-info>
		`);
		const item = extractCatalog(`
			<qti-catalog-info>
				<qti-card identifier="item-term">
					<qti-card-entry usage="glossary-on-screen">
						<qti-html-content>Item def</qti-html-content>
					</qti-card-entry>
				</qti-card>
			</qti-catalog-info>
		`);
		const merged = mergeCatalogs(shared, item);
		expect(merged.has('shared-term')).toBe(true);
		expect(merged.has('item-term')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getCatalogEntry — language fallback
// ---------------------------------------------------------------------------

function makeSingleCardIndex(lang?: string): ReturnType<typeof extractCatalog> {
	const langAttr = lang ? ` xml:lang="${lang}"` : '';
	return extractCatalog(`
		<qti-catalog-info>
			<qti-card identifier="t1">
				<qti-card-entry usage="glossary-on-screen"${langAttr}>
					<qti-html-content>def:${lang ?? 'nolang'}</qti-html-content>
				</qti-card-entry>
			</qti-card>
		</qti-catalog-info>
	`);
}

describe('getCatalogEntry', () => {
	it('returns null when identifier not found', () => {
		const index = extractCatalog(CATALOG_XML);
		expect(getCatalogEntry(index, 'no-such-term', 'glossary-on-screen')).toBeNull();
	});

	it('returns null when usage not found for known identifier', () => {
		const index = extractCatalog(CATALOG_XML);
		expect(getCatalogEntry(index, 'term-photosynthesis', 'no-such-usage')).toBeNull();
	});

	it('returns exact language match first', () => {
		const index = extractCatalog(CATALOG_XML);
		const result = getCatalogEntry(index, 'term-photosynthesis', 'glossary-on-screen', 'en-US');
		expect(result).toContain('plants make food');
	});

	it('falls back to language prefix (en-US request → en entry)', () => {
		const index = makeSingleCardIndex('en');
		const result = getCatalogEntry(index, 't1', 'glossary-on-screen', 'en-US');
		expect(result).toBe('def:en');
	});

	it('falls back to language prefix (en request → en-US entry)', () => {
		const index = makeSingleCardIndex('en-US');
		const result = getCatalogEntry(index, 't1', 'glossary-on-screen', 'en');
		expect(result).toBe('def:en-US');
	});

	it('falls back to no-lang entry when language does not match', () => {
		const index = makeSingleCardIndex(undefined);
		const result = getCatalogEntry(index, 't1', 'glossary-on-screen', 'fr');
		expect(result).toBe('def:nolang');
	});

	it('returns entry when no language requested and entry has no lang', () => {
		const index = makeSingleCardIndex(undefined);
		const result = getCatalogEntry(index, 't1', 'glossary-on-screen');
		expect(result).toBe('def:nolang');
	});
});

// ---------------------------------------------------------------------------
// Player.getCatalogEntry integration
// ---------------------------------------------------------------------------

const ITEM_WITH_CATALOG = `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item
  xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0"
  identifier="catalog-test" title="Catalog Test" adaptive="false" time-dependent="false">
  <qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
  <qti-outcome-declaration identifier="SCORE" cardinality="single" base-type="float"/>
  <qti-catalog-info>
    <qti-card identifier="word-mitosis">
      <qti-card-entry usage="glossary-on-screen" xml:lang="en">
        <qti-html-content>Division of a cell into two daughter cells.</qti-html-content>
      </qti-card-entry>
    </qti-card>
  </qti-catalog-info>
  <qti-item-body>
    <p>The process of <span data-catalog-idref="word-mitosis">mitosis</span> produces two identical cells.</p>
    <qti-choice-interaction response-identifier="RESPONSE" max-choices="1">
      <qti-simple-choice identifier="A">True</qti-simple-choice>
      <qti-simple-choice identifier="B">False</qti-simple-choice>
    </qti-choice-interaction>
  </qti-item-body>
</qti-assessment-item>`;

describe('Player catalog integration', () => {
	it('getCatalogEntry returns the embedded catalog entry', () => {
		const player = new Player({ itemXml: ITEM_WITH_CATALOG });
		const result = player.getCatalogEntry('word-mitosis', 'glossary-on-screen', 'en');
		expect(result).toContain('daughter cells');
	});

	it('getCatalogEntry returns null for unknown term', () => {
		const player = new Player({ itemXml: ITEM_WITH_CATALOG });
		expect(player.getCatalogEntry('no-such-word', 'glossary-on-screen')).toBeNull();
	});

	it('shared catalogXml is merged with item catalog; item wins on collision', () => {
		const sharedXml = `
			<qti-catalog-info>
				<qti-card identifier="word-mitosis">
					<qti-card-entry usage="glossary-on-screen">
						<qti-html-content>Shared definition (should be overridden)</qti-html-content>
					</qti-card-entry>
				</qti-card>
				<qti-card identifier="shared-only-word">
					<qti-card-entry usage="glossary-on-screen">
						<qti-html-content>Shared-only definition</qti-html-content>
					</qti-card-entry>
				</qti-card>
			</qti-catalog-info>
		`;
		const player = new Player({ itemXml: ITEM_WITH_CATALOG, catalogXml: sharedXml });
		// Item-level wins
		expect(player.getCatalogEntry('word-mitosis', 'glossary-on-screen', 'en')).toContain('daughter cells');
		// Shared-only entry is accessible
		expect(player.getCatalogEntry('shared-only-word', 'glossary-on-screen')).toContain('Shared-only');
	});
});
