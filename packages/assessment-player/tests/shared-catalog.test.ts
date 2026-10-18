/**
 * G-15: shared catalog files. A manifest-listed catalog resource reaches each
 * item's delivery context as a package-scope catalog source; an item with its
 * own qti-catalog-info carries both scopes, in merge order.
 */

import './setup';
import { describe, expect, test } from 'bun:test';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const itemWithTerm = (identifier: string, term: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Term <span data-catalog-idref="term_1">${term}</span>.</p></itemBody>
</assessmentItem>`;

const itemWithOwnCatalog = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Term <span data-catalog-idref="term_1">overridden</span>.</p></itemBody>
  <qti-catalog-info xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
    <qti-catalog id="term_1">
      <qti-card><qti-card-entry usage="glossary-on-screen"><qti-html-content>Item-level definition</qti-html-content></qti-card-entry></qti-card>
    </qti-catalog>
  </qti-catalog-info>
</assessmentItem>`;

const testXml = `<assessmentTest ${NS} identifier="shared-cat-test" title="Shared catalog test">
  <testPart identifier="p1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s1" title="s1" visible="true">
      <assessmentItemRef identifier="shared" href="shared.xml"/>
      <assessmentItemRef identifier="own" href="own.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const SHARED_CATALOG_XML = `<qti-catalog-info xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0">
  <qti-catalog id="term_1">
    <qti-card><qti-card-entry usage="glossary-on-screen"><qti-html-content>Package-level definition</qti-html-content></qti-card-entry></qti-card>
  </qti-catalog>
</qti-catalog-info>`;

describe('shared catalog files', () => {
	test('manifest-listed catalogs reach every item as package-scope sources', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, {
			itemXmlMap: {
				'shared.xml': itemWithTerm('shared', 'shared'),
				'own.xml': itemWithOwnCatalog('own'),
			},
			sharedCatalogs: [{ href: 'catalogs/shared.xml' }],
			fileResolver: async (href) =>
				href === 'catalogs/shared.xml' ? SHARED_CATALOG_XML : Promise.reject(new Error('missing')),
		});

		const items = parsed.testParts.flatMap((part) =>
			part.sections.flatMap((section) => section.assessmentItemRefs),
		);
		const sharedItem = items.find((item) => item.identifier === 'shared');
		const ownItem = items.find((item) => item.identifier === 'own');
		expect(sharedItem?.deliveryContext?.catalogSources).toHaveLength(1);
		expect(sharedItem?.deliveryContext?.catalogSources[0]).toMatchObject({
			scope: 'package',
			baseHref: 'catalogs/shared.xml',
		});
		expect(sharedItem?.deliveryContext?.catalogSources[0].xml).toContain('Package-level definition');
		expect(ownItem?.deliveryContext?.catalogSources.map((source) => source.scope)).toEqual([
			'package',
			'item',
		]);
		expect(sharedItem?.deliveryContext?.validationMessages).toEqual([]);
	});

	test('an inline shared catalog xml needs no file resolver', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, {
			itemXmlMap: { 'shared.xml': itemWithTerm('shared', 'shared') },
			sharedCatalogs: [{ xml: SHARED_CATALOG_XML }],
		});

		const items = parsed.testParts.flatMap((part) =>
			part.sections.flatMap((section) => section.assessmentItemRefs),
		);
		const sharedItem = items.find((item) => item.identifier === 'shared');
		expect(sharedItem?.deliveryContext?.catalogSources[0].xml).toContain('Package-level definition');
	});
});
