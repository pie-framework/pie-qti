import { describe, expect, test } from 'bun:test';
import { Player } from '../../src/core/Player.js';
import type { ResolvedItemDeliveryContext } from '@pie-qti/ims-cp-core';

describe('resolved item delivery context', () => {
	test('merges resolved catalog sources before item-local catalog entries', () => {
		// Clean-room fixture authored for this repository: verifies QTI 3 catalog
		// precedence without using sibling project or official conformance XML.
		const itemXml = `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
  <qti-item-body>
    <p data-catalog-idref="term_delta">delta</p>
  </qti-item-body>
  <qti-catalog-info>
    <qti-card identifier="term_delta">
      <qti-card-entry usage="glossary-on-screen">
        <qti-html-content>Item-local definition</qti-html-content>
      </qti-card-entry>
    </qti-card>
  </qti-catalog-info>
</qti-assessment-item>`;
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			stimuli: {},
			stylesheets: [],
			catalogSources: [
				{
					scope: 'stimulus',
					baseHref: 'stimuli/passage.xml',
					stimulusIdentifier: 'passage_1',
					xml: `<qti-catalog-info>
  <qti-card identifier="term_delta">
    <qti-card-entry usage="glossary-on-screen">
      <qti-html-content>Stimulus definition</qti-html-content>
    </qti-card-entry>
  </qti-card>
</qti-catalog-info>`,
				},
			],
			validationMessages: [],
		};

		const player = new Player({ itemXml, deliveryContext });

		expect(player.getCatalogEntry('term_delta', 'glossary-on-screen')).toBe('Item-local definition');
	});

	test('exposes resolved stimulus body content to item rendering callers', () => {
		const deliveryContext: ResolvedItemDeliveryContext = {
			itemHref: 'items/item.xml',
			stimuli: {
				passage_1: {
					identifier: 'passage_1',
					href: '../stimuli/passage.xml',
					resolvedHref: 'stimuli/passage.xml',
					bodyHtml: '<p>Shared passage body</p>',
					stylesheets: [],
					validationMessages: [],
				},
			},
			stylesheets: [],
			catalogSources: [],
			validationMessages: [],
		};
		const player = new Player({
			itemXml: `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
  <qti-item-body><p>Item body</p></qti-item-body>
</qti-assessment-item>`,
			deliveryContext,
		});

		expect(player.getDeliveryContext()?.stimuli.passage_1.bodyHtml).toContain('Shared passage body');
	});

	test('sanitizes catalog entries from resolved delivery context at lookup time', () => {
		const player = new Player({
			itemXml: `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
  <qti-item-body><p data-catalog-idref="term_1">term</p></qti-item-body>
</qti-assessment-item>`,
			deliveryContext: {
				itemHref: 'items/item.xml',
				stimuli: {},
				stylesheets: [],
				catalogSources: [
					{
						scope: 'stimulus',
						baseHref: 'stimuli/passage.xml',
						xml: `<qti-catalog-info>
  <qti-card identifier="term_1">
    <qti-card-entry usage="glossary-on-screen">
      <qti-html-content><span onclick="bad()">safe</span><script>bad()</script></qti-html-content>
    </qti-card-entry>
  </qti-card>
</qti-catalog-info>`,
					},
				],
				validationMessages: [],
			},
		});

		const html = player.getCatalogEntry('term_1', 'glossary-on-screen');
		expect(html).toContain('<span>safe</span>');
		expect(html).not.toContain('onclick');
		expect(html).not.toContain('script');
	});

	test('applies URL policy to catalog file-href values', () => {
		const player = new Player({
			itemXml: `<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="item-1">
  <qti-item-body><p data-catalog-idref="term_1">term</p></qti-item-body>
</qti-assessment-item>`,
			security: { urlPolicy: { allowHttps: true, allowHttp: false, allowedHosts: ['good.example'] } },
			deliveryContext: {
				itemHref: 'items/item.xml',
				stimuli: {},
				stylesheets: [],
				catalogSources: [
					{
						scope: 'stimulus',
						baseHref: 'stimuli/passage.xml',
						xml: `<qti-catalog-info>
  <qti-card identifier="term_1">
    <qti-card-entry usage="illustrated-glossary">
      <qti-file-href src="http://evil.example/image.png"/>
    </qti-card-entry>
  </qti-card>
</qti-catalog-info>`,
					},
				],
				validationMessages: [],
			},
		});

		expect(player.getCatalogEntry('term_1', 'illustrated-glossary')).toBeNull();
	});
});
