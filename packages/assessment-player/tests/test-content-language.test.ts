/**
 * Test-level content keeps the language it is written in (WCAG 3.1.2): testFeedback and
 * rubricBlock (passages, instructions) carry their `xml:lang` as `language`, inherited from the
 * enclosing test part, section or test when they declare none (XML 1.0 §2.12), in QTI 2.2 and
 * QTI 3.0 alike, and delivered feedback keeps it.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const ITEM = `<assessmentItem ${NS} identifier="item-1" title="Item 1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float"><defaultValue><value>0</value></defaultValue></outcomeDeclaration>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

const feedback = (text: string, lang = '') =>
	`<testFeedback access="atEnd" outcomeIdentifier="DONE" identifier="yes" showHide="show"${lang}><p>${text}</p></testFeedback>`;

const QTI22 = `<assessmentTest ${NS} identifier="language-test" title="Language test" xml:lang="en">
  <outcomeDeclaration identifier="DONE" cardinality="single" baseType="identifier"/>
  <testPart identifier="part-1" navigationMode="linear" submissionMode="individual" xml:lang="de">
    <rubricBlock view="candidate" use="instructions"><p>Lies den Text.</p></rubricBlock>
    <assessmentSection identifier="section-1" title="One" visible="true" xml:lang="es">
      <rubricBlock view="candidate" use="passage" xml:lang="fr"><p>Le cycle de l'eau.</p></rubricBlock>
      <rubricBlock view="candidate" use="instructions"><p>Lee el texto.</p></rubricBlock>
      <rubricBlock view="candidate" use="instructions" xml:lang=""><p>No declared language.</p></rubricBlock>
      <assessmentItemRef identifier="item-1" href="item-1.xml"/>
    </assessmentSection>
    ${feedback('Teil fertig.')}
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="DONE"><baseValue baseType="identifier">yes</baseValue></setOutcomeValue>
  </outcomeProcessing>
  ${feedback('Bravo !', ' xml:lang="fr"')}
  ${feedback('Well done.')}
</assessmentTest>`;

/** QTI 3 test feedback carries its content in qti-content-body (rubric blocks are wrapped by the converter). */
const toQti3 = (xml: string) =>
	convertQti2ToQti3(xml).replace(
		/(<qti-test-feedback[^>]*>)([\s\S]*?)(<\/qti-test-feedback>)/g,
		'$1<qti-content-body>$2</qti-content-body>$3',
	);

const ITEMS = { 2.2: ITEM, '3.0': convertQti2ToQti3(ITEM) };

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

function parse(xml: string, itemXml: string, options: Parameters<typeof ReferenceBackendAdapter.parseAssessmentTestXml>[1] = {}) {
	return ReferenceBackendAdapter.parseAssessmentTestXml(xml, { itemXmlMap: { 'item-1.xml': itemXml }, ...options });
}

describe.each([
	['QTI 2.2', QTI22, 2.2],
	['QTI 3.0', toQti3(QTI22), '3.0'],
] as const)('%s test content language', (_version, xml, version) => {
	test('test feedback keeps its own xml:lang and inherits the test part or test language', async () => {
		const assessment = await parse(xml, ITEMS[version]);

		expect(assessment.testFeedback?.map((entry) => [entry.content.replace(/<[^>]+>/g, ''), entry.language])).toEqual([
			['Bravo !', 'fr'],
			['Well done.', 'en'],
		]);
		expect(assessment.testParts[0].testFeedback?.[0].language).toBe('de');
	});

	test('rubric blocks carry their language: own, else the section, test part or test language', async () => {
		const assessment = await parse(xml, ITEMS[version]);
		const part = assessment.testParts[0];

		expect(part.rubricBlocks?.map((block) => [block.use, block.language])).toEqual([['instructions', 'de']]);
		expect(part.sections[0].rubricBlocks?.map((block) => [block.use, block.language])).toEqual([
			['passage', 'fr'],
			['instructions', 'es'],
			['instructions', undefined],
		]);
		// xml:lang="" declares no language: nothing is inherited past it.
		expect(part.sections[0].rubricBlocks?.[2]).not.toHaveProperty('language');
	});

	test('delivered feedback keeps its language', async () => {
		const assessment = await parse(xml, ITEMS[version]);
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(assessment.identifier, assessment);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
		});
		players.push(player);

		player.updateResponse('RESPONSE', 'A');
		await player.submit();

		expect(
			player.getVisibleFeedback().map((entry) => [entry.content.replace(/<[^>]+>/g, ''), entry.language]),
		).toEqual([
			['Bravo !', 'fr'],
			['Well done.', 'en'],
			['Teil fertig.', 'de'],
		]);
	});
});

describe('QTI 3.0 language spellings', () => {
	test('reads a `lang` attribute and a content body language', async () => {
		const xml = toQti3(QTI22)
			.replace('xml:lang="fr"><qti-content-body><p>Bravo', 'lang="fr-CA"><qti-content-body><p>Bravo')
			.replace(
				'<qti-content-body><p>Lee el texto.</p>',
				'<qti-content-body xml:lang="pt-BR"><p>Lee el texto.</p>',
			);
		const assessment = await parse(xml, ITEMS['3.0']);

		expect(assessment.testFeedback?.[0].language).toBe('fr-CA');
		expect(assessment.testParts[0].sections[0].rubricBlocks?.[1].language).toBe('pt-BR');
	});
});

describe('external sections', () => {
	const section = (lang = '') => `<assessmentSection ${NS} identifier="external" title="External" visible="true"${lang}>
  <rubricBlock view="candidate" use="passage"><p>Passage.</p></rubricBlock>
  <assessmentSection identifier="nested" title="Nested" visible="true">
    <rubricBlock view="candidate" use="instructions"><p>Instructions.</p></rubricBlock>
    <assessmentItemRef identifier="item-1" href="item-1.xml"/>
  </assessmentSection>
</assessmentSection>`;

	const test_ = `<assessmentTest ${NS} identifier="external-test" title="External" xml:lang="nl">
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSectionRef identifier="external-ref" href="sections/external.xml"/>
  </testPart>
</assessmentTest>`;

	async function parseWith(sectionXml: string) {
		return ReferenceBackendAdapter.parseAssessmentTestXml(test_, {
			fileResolver: async (href) => {
				if (href === 'sections/external.xml') return sectionXml;
				if (href === 'sections/item-1.xml') return ITEM;
				throw new Error(`Missing ${href}`);
			},
		});
	}

	test('a referenced section inherits the language at its reference', async () => {
		const assessment = await parseWith(section());
		const external = assessment.testParts[0].sections[0];

		expect(external.rubricBlocks?.[0].language).toBe('nl');
		expect(external.sections?.[0].rubricBlocks?.[0].language).toBe('nl');
	});

	test("a referenced section's own xml:lang wins", async () => {
		const assessment = await parseWith(section(' xml:lang="fr"'));
		const external = assessment.testParts[0].sections[0];

		expect(external.rubricBlocks?.[0].language).toBe('fr');
		expect(external.sections?.[0].rubricBlocks?.[0].language).toBe('fr');
	});
});
