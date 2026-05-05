import { describe, expect, test } from 'bun:test';
import {
	Qti2xAttributeNameMapper,
	Qti2xElementNameMapper,
	Qti3AttributeNameMapper,
	Qti3ElementNameMapper,
} from '@pie-qti/qti-common';
import { parseAssessmentItemDocument } from '../../src/document/AssessmentItemDocument.js';

describe('AssessmentItemDocument', () => {
	test('serializes item body and rubric children from the XML document boundary', () => {
		const document = parseAssessmentItemDocument({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="doc" title="Doc" adaptive="false" timeDependent="false">
	<itemBody>
		<p class="stem">Stem <math><mi>x</mi></math></p>
	</itemBody>
	<rubricBlock view="candidate"><p>Read carefully.</p></rubricBlock>
</assessmentItem>`,
			elementNameMapper: new Qti2xElementNameMapper(),
			attributeNameMapper: new Qti2xAttributeNameMapper(),
		});

		expect(document.serializeItemBodyChildren()).toContain('<p class="stem"');
		expect(document.serializeItemBodyChildren()).toContain('<math>');
		expect(document.findRubricElements()).toHaveLength(1);
		expect(document.serializeChildren(document.findRubricElements()[0])).toContain('Read carefully');
	});

	test('finds processing elements through version-aware names', () => {
		const document = parseAssessmentItemDocument({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="doc" title="Doc" adaptive="false" time-dependent="false">
	<qti-response-declaration identifier="RESPONSE" cardinality="single" base-type="identifier"/>
	<qti-item-body/>
	<qti-response-processing/>
	<qti-outcome-processing/>
</qti-assessment-item>`,
			elementNameMapper: new Qti3ElementNameMapper(),
			attributeNameMapper: new Qti3AttributeNameMapper(),
		});

		expect(document.getProcessingElement('response')?.tagName).toBe('qti-response-processing');
		expect(document.getProcessingElement('outcome')?.tagName).toBe('qti-outcome-processing');
		expect(document.getProcessingElement('template')).toBeNull();
	});

	test('discovers extraction elements in item body document order using registered element types', () => {
		const document = parseAssessmentItemDocument({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="doc" title="Doc" adaptive="false" timeDependent="false">
	<itemBody>
		<pluginInteraction responseIdentifier="PLUGIN"/>
		<choiceInteraction responseIdentifier="CHOICE"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>
		<textEntryInteraction responseIdentifier="TEXT"/>
	</itemBody>
	<choiceInteraction responseIdentifier="OUTSIDE"><simpleChoice identifier="B">B</simpleChoice></choiceInteraction>
</assessmentItem>`,
			elementNameMapper: new Qti2xElementNameMapper(),
			attributeNameMapper: new Qti2xAttributeNameMapper(),
		});

		expect(
			document
				.findExtractionElements(['choiceInteraction', 'textEntryInteraction', 'pluginInteraction'])
				.map((element) => element.responseIdentifier)
		).toEqual(['PLUGIN', 'CHOICE', 'TEXT']);
	});

	test('uses QTI 3 response-identifier attributes during extraction discovery', () => {
		const document = parseAssessmentItemDocument({
			itemXml: `<?xml version="1.0" encoding="UTF-8"?>
<qti-assessment-item xmlns="http://www.imsglobal.org/xsd/imsqtiasi_v3p0" identifier="doc" title="Doc" adaptive="false" time-dependent="false">
	<qti-item-body>
		<qti-choice-interaction response-identifier="RESPONSE">
			<qti-simple-choice identifier="A">A</qti-simple-choice>
		</qti-choice-interaction>
	</qti-item-body>
</qti-assessment-item>`,
			elementNameMapper: new Qti3ElementNameMapper(),
			attributeNameMapper: new Qti3AttributeNameMapper(),
		});

		const [interaction] = document.findExtractionElements(['choiceInteraction']);

		expect(interaction.responseIdentifier).toBe('RESPONSE');
		expect(interaction.normalizedType).toBe('choiceInteraction');
	});
});
