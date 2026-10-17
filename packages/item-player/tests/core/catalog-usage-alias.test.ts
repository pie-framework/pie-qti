import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

/**
 * APIP-derived catalogs name a few supports by their AfA support name (`braille`,
 * `sign-language`), where QTI 3 catalogs use the newer usage strings (`braille-text`,
 * `signing-definition`). A QTI 3 usage lookup falls back to the APIP name so one
 * routing path serves both catalog flavors (G-13/G-14).
 */
function itemWithCatalogUsage(usage: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="alias">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<itemBody><p>Stimulus text.</p></itemBody>
	<qti-catalog-info xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
		<qti-card identifier="term_1">
			<qti-card-entry usage="${usage}">
				<qti-html-content>Entry under ${usage}</qti-html-content>
			</qti-card-entry>
		</qti-card>
	</qti-catalog-info>
</assessmentItem>`;
}

describe('catalog usage aliases', () => {
	test('braille-text finds an APIP-named braille entry', () => {
		const player = new Player({ itemXml: itemWithCatalogUsage('braille') });
		expect(player.getCatalogEntry('term_1', 'braille-text')).toBe('Entry under braille');
		expect(player.getCatalogEntry('term_1', 'braille')).toBe('Entry under braille');
	});

	test('signing-definition finds an APIP-named sign-language entry', () => {
		const player = new Player({ itemXml: itemWithCatalogUsage('sign-language') });
		expect(player.getCatalogEntry('term_1', 'signing-definition')).toBe('Entry under sign-language');
	});

	test('a QTI 3-named entry answers the QTI 3 usage directly', () => {
		const player = new Player({ itemXml: itemWithCatalogUsage('braille-text') });
		expect(player.getCatalogEntry('term_1', 'braille-text')).toBe('Entry under braille-text');
	});

	test('an unknown usage still returns null', () => {
		const player = new Player({ itemXml: itemWithCatalogUsage('glossary-on-screen') });
		expect(player.getCatalogEntry('term_1', 'braille-text')).toBeNull();
	});
});
