import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';

/**
 * G-15 merge order: package-scope catalog sources hold the lowest precedence —
 * below the item's own inline catalog and below config.catalogXml.
 */

const itemXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="merge-cat">
	<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
	<itemBody>
		<p>Terms <span data-catalog-idref="term_1">one</span> and <span data-catalog-idref="term_2">two</span>.</p>
	</itemBody>
	<qti-catalog-info xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
		<qti-catalog id="term_1">
			<qti-card><qti-card-entry usage="glossary-on-screen"><qti-html-content>Item-level definition</qti-html-content></qti-card-entry></qti-card>
		</qti-catalog>
	</qti-catalog-info>
</assessmentItem>`;

const packageCatalogXml = `<qti-catalog-info xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
	<qti-catalog id="term_1">
		<qti-card><qti-card-entry usage="glossary-on-screen"><qti-html-content>Package-level definition</qti-html-content></qti-card-entry></qti-card>
	</qti-catalog>
	<qti-catalog id="term_2">
		<qti-card><qti-card-entry usage="glossary-on-screen"><qti-html-content>Package-only definition</qti-html-content></qti-card-entry></qti-card>
	</qti-catalog>
</qti-catalog-info>`;

describe('shared catalog merge order', () => {
	test('the package backs identifiers the item lacks; the item wins collisions', () => {
		const player = new Player({
			itemXml,
			deliveryContext: {
				itemHref: 'items/item.xml',
				stimuli: {},
				stylesheets: [],
				validationMessages: [],
				catalogSources: [{ scope: 'package', xml: packageCatalogXml, baseHref: 'catalogs/shared.xml' }],
			},
		});

		expect(player.getCatalogEntry('term_1', 'glossary-on-screen')).toBe('Item-level definition');
		expect(player.getCatalogEntry('term_2', 'glossary-on-screen')).toBe('Package-only definition');
	});

	test('a package entry answers where the item XML has no catalog at all', () => {
		const plainItem = itemXml.replace(
			/<qti-catalog-info[\s\S]*<\/qti-catalog-info>/,
			''
		);
		const player = new Player({
			itemXml: plainItem,
			deliveryContext: {
				itemHref: 'items/item.xml',
				stimuli: {},
				stylesheets: [],
				validationMessages: [],
				catalogSources: [{ scope: 'package', xml: packageCatalogXml, baseHref: '' }],
			},
		});

		expect(player.getCatalogEntry('term_1', 'glossary-on-screen')).toBe('Package-level definition');
	});
});
