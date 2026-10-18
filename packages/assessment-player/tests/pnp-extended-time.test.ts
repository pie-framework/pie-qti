/**
 * AfA PNP in delivery: a QTI 2.2 test and its QTI 3.0 twin add the profile's `fixed-minutes`
 * to the test and item time limits, and its tool supports reach the section composition.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { parsePnpXml } from '@pie-qti/item-player';
import { convertQti2ToQti3 } from '@pie-qti/qti-common';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import { toSectionComposition } from '../src/integration/toSectionComposition.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const ITEM = `<assessmentItem ${NS} identifier="item-1" title="Item 1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction>
  </itemBody>
</assessmentItem>`;

const TEST = `<assessmentTest ${NS} identifier="timed" title="Timed">
  <timeLimits maxTime="600"/>
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="section-1" title="Section 1" visible="true">
      <assessmentItemRef identifier="item-1" href="item-1.xml"><timeLimits maxTime="60"/></assessmentItemRef>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const PNP = parsePnpXml(`<access-for-all-pnp xmlns="http://www.imsglobal.org/xsd/qtiv3p0/imsafa3p0pnp_v1p0">
	<additional-testing-time><fixed-minutes>10</fixed-minutes></additional-testing-time>
	<calculator-on-screen><calculator-type>scientific</calculator-type></calculator-on-screen>
	<prohibit-set><spoken/></prohibit-set>
</access-for-all-pnp>`);

afterEach(() => localStorage.clear());

describe.each([
	['QTI 2.2', (xml: string) => xml],
	['QTI 3.0', (xml: string) => convertQti2ToQti3(xml)],
])('AfA PNP in delivery (%s)', (_version, convert) => {
	test('adds the minutes to the test and item limits', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(convert(TEST), {
			itemXmlMap: { 'item-1.xml': convert(ITEM) },
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			pnp: PNP,
		});
		await player.navigateTo(0);
		expect(player.getCurrentEffectiveTimeLimits().timeLimits?.maxTime).toBe(660);
		expect(player.getRemainingTime()).toBeGreaterThan(600);
		player.destroy?.();
	});

	test('passes the tool supports to the section composition', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(convert(TEST), {
			itemXmlMap: { 'item-1.xml': convert(ITEM) },
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const config = {
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			pnp: PNP,
			sectionTools: [{ toolId: 'calculator', enabled: false }, { toolId: 'textToSpeech' }],
		};
		const player = await AssessmentPlayer.create(config);
		await player.navigateTo(0);
		const tools = toSectionComposition(player, config).section.tools;
		expect(tools).toEqual([
			{ toolId: 'calculator', enabled: true, scope: 'section', renderParams: { calculatorType: 'scientific' } },
		]);
		player.destroy?.();
	});
});
