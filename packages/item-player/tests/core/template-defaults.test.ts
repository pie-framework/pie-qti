import { describe, expect, test } from 'bun:test';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { createAssessmentItemDefinition } from '../../src/core/AssessmentItemDefinition.js';

const ITEM_QTI22 = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="template-defaults" adaptive="false" timeDependent="false">
	<templateDeclaration identifier="N" cardinality="single" baseType="integer">
		<defaultValue><value>1</value></defaultValue>
	</templateDeclaration>
	<templateDeclaration identifier="DOUBLE" cardinality="single" baseType="integer"/>
	<templateProcessing>
		<setTemplateValue identifier="DOUBLE">
			<product>
				<variable identifier="N"/>
				<baseValue baseType="integer">2</baseValue>
			</product>
		</setTemplateValue>
	</templateProcessing>
	<itemBody><p><printedVariable identifier="DOUBLE"/></p></itemBody>
</assessmentItem>`;

describe('templateDefaults', () => {
	for (const [version, itemXml] of [
		['QTI 2.2', ITEM_QTI22],
		['QTI 3.0', convertQti2ToQti3(ITEM_QTI22)],
	] as const) {
		test(`${version}: replaces a template variable's default before template processing`, () => {
			const definition = createAssessmentItemDefinition({ itemXml });
			const declared = definition.openSession();
			expect(declared.state().templates).toMatchObject({ N: 1, DOUBLE: 2 });
			declared.dispose();

			const session = definition.openSession({ templateDefaults: { N: 5, UNKNOWN: 3 } });
			expect(session.state().templates).toMatchObject({ N: 5, DOUBLE: 10 });
			expect(session.state().templates).not.toHaveProperty('UNKNOWN');
			session.dispose();
		});

		test(`${version}: an item session passes template defaults to its player`, () => {
			const session = createAssessmentItemDefinition({ itemXml }).openSession({ templateDefaults: { N: 4 } });
			expect(session.present().flow.some((node) => node.kind === 'html' && String(node.html).includes('8'))).toBe(
				true,
			);
			session.dispose();
		});
	}
});
