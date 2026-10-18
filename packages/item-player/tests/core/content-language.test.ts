/**
 * Content language in delivery: a QTI 2.2 item and its QTI 3.0 twin declare Spanish content with
 * `xml:lang`, which reaches the rendered body as `lang` and selects the Spanish glossary entry.
 */

import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';
import { Player } from '../../src/core/Player.js';

const QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="es-item" title="Fotosíntesis"
  adaptive="false" timeDependent="false" xml:lang="es">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <p>La <span data-catalog-idref="term-photo">fotosíntesis</span> se llama <span xml:lang="en">photosynthesis</span> en inglés.</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
      <simpleChoice identifier="A">Sí</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

const QTI30 = convertQti2ToQti3(QTI22);

/** QTI 2.2 has no per-language glossary, so the catalog is the QTI 3.0 twin's. */
const GLOSSARY = `<qti-catalog-info>
    <qti-card identifier="term-photo">
      <qti-card-entry usage="glossary-on-screen" xml:lang="en"><qti-html-content>How plants make food from light.</qti-html-content></qti-card-entry>
      <qti-card-entry usage="glossary-on-screen" xml:lang="es"><qti-html-content>Cómo las plantas fabrican alimento con la luz.</qti-html-content></qti-card-entry>
    </qti-card>
  </qti-catalog-info>
</qti-assessment-item>`;

describe.each([
	['QTI 2.2', QTI22],
	['QTI 3.0', QTI30],
])('content language (%s)', (_version, xml) => {
	test('reads the language the item declares', () => {
		expect(new Player({ itemXml: xml }).getContentLanguage()).toBe('es');
	});

	test('restates inner xml:lang as lang in the rendered body', () => {
		const body = String(new Player({ itemXml: xml }).getItemBodyHtml());
		expect(body).toContain('<span xml:lang="en" lang="en">photosynthesis</span>');
	});

	test('presents the content language for the item body', () => {
		const session = createAssessmentItemDefinition({ itemXml: xml }).openSession();
		expect(session.present().contentLanguage).toBe('es');
		session.dispose();
	});
});

describe('content language selects the glossary entry', () => {
	const player = new Player({ itemXml: QTI30.replace('</qti-assessment-item>', GLOSSARY) });

	test('the Spanish entry for Spanish content', () => {
		expect(player.getCatalogEntry('term-photo', 'glossary-on-screen', player.getContentLanguage())).toContain(
			'Cómo las plantas',
		);
	});

	test('the English entry for English content', () => {
		expect(player.getCatalogEntry('term-photo', 'glossary-on-screen', 'en-US')).toContain('How plants');
	});
});

test('an item without xml:lang declares no content language', () => {
	const xml = QTI22.replace(' xml:lang="es"', '');
	expect(new Player({ itemXml: xml }).getContentLanguage()).toBeUndefined();
	expect(createAssessmentItemDefinition({ itemXml: xml }).openSession().present().contentLanguage).toBeUndefined();
});
