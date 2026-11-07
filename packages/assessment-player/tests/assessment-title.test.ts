/**
 * The candidate-facing assessment title.
 *
 * Shells head the assessment with the assessmentTest `title` and fall back to a
 * localized generic title — never the raw identifier. The core reports "no title"
 * as `undefined`; the reference parser no longer invents English text for it.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const ITEM = `<assessmentItem ${NS} identifier="i1" title="i1" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice></choiceInteraction></itemBody>
</assessmentItem>`;

function testXml(titleAttribute: string) {
	return `<assessmentTest ${NS} identifier="SCIENCE-001"${titleAttribute}>
  <testPart identifier="part-1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="s1" title="Section" visible="true">
      <assessmentItemRef identifier="i1" href="i1.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;
}

async function titleOf(xml: string) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(xml, { itemXmlMap: { 'i1.xml': ITEM } });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
	});
	try {
		return { parsedTitle: parsed.title, playerTitle: player.getAssessmentTitle() };
	} finally {
		player.destroy();
	}
}

afterEach(() => localStorage.clear());

describe('assessment title', () => {
	test('is the assessmentTest title, trimmed', async () => {
		expect((await titleOf(testXml(' title="  Life Cycles Assessment "'))).playerTitle).toBe('Life Cycles Assessment');
	});

	test('is undefined — not the identifier, not English filler — when the test has none', async () => {
		const missing = await titleOf(testXml(''));
		expect(missing.parsedTitle).toBe('');
		expect(missing.playerTitle).toBeUndefined();

		const blank = await titleOf(testXml(' title="   "'));
		expect(blank.playerTitle).toBeUndefined();
	});
});
