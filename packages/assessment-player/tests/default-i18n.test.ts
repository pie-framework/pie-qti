import './setup';
import { describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const ASSESSMENT = {
	identifier: 'default-i18n',
	title: 'Default i18n fixture',
	navigationMode: 'nonlinear',
	submissionMode: 'individual',
	testParts: [
		{
			identifier: 'part-1',
			sections: [
				{
					identifier: 'section-1',
					title: 'Section 1',
					visible: true,
					assessmentItemRefs: [
						{
							identifier: 'item-1',
							role: 'candidate',
							itemXml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="item-1" title="item-1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1">
    <simpleChoice identifier="A">A</simpleChoice>
  </choiceInteraction></itemBody>
</assessmentItem>`,
						},
					],
				},
			],
		},
	],
};

describe('AssessmentPlayer without an i18n provider', () => {
	test('renders English, not message keys', async () => {
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(ASSESSMENT.identifier, ASSESSMENT as never);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: ASSESSMENT.identifier, candidateId: 'candidate' },
		});

		const i18n = player.getI18nProvider();
		expect(i18n.getLocale()).toBe('en-US');
		expect(i18n.t('common.next')).toBe('Next');
		expect(i18n.getDirection?.()).toBe('ltr');
	});
});
