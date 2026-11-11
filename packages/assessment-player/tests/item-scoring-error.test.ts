/**
 * Item-level response-processing failures mirror the test-level `outcomeProcessingError`:
 * the submission stands and delivery continues, the degenerate 0 result carries a
 * `scoringError`, and the host hears a coded `itemScoringFailed` through
 * `config.onError` — once per distinct item failure — so "answered wrong" is never
 * indistinguishable from "the engine failed to score".
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { isAssessmentPlayerError } from '../src/core/errors.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const BROKEN_ITEM = `<assessmentItem ${NS} identifier="broken-rp" title="Broken Response Processing" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="5">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <itemBody><p>Broken</p></itemBody>
  <responseProcessing><unknownProcessingExpression/></responseProcessing>
</assessmentItem>`;

const TEST_XML = `<assessmentTest ${NS} identifier="scoring-error" title="Scoring error">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="broken-rp" href="broken.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const GOOD_ITEM = `<assessmentItem ${NS} identifier="q2" title="Good item" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <itemBody><p>Question q2</p></itemBody>
</assessmentItem>`;

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

describe('item scoring failures', () => {
	test('a scored submission on a broken item is accepted, scores 0 of the declared max, and reports once', async () => {
		const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(TEST_XML, {
			itemXmlMap: { 'broken.xml': BROKEN_ITEM, 'q2.xml': GOOD_ITEM },
		});
		const backend = new ReferenceBackendAdapter();
		backend.registerAssessment(parsed.identifier, parsed);
		const errors: Error[] = [];
		const player = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
			onError: (error) => errors.push(error),
		});
		players.push(player);

		// The reference scorer failed to score: the degenerate result keeps the declared
		// maximum (5), not an invented 1, and carries the failure.
		player.updateResponse('RESPONSE', 'A');
		const result = await player.submitCurrentItem();
		expect(result.score).toBe(0);
		expect(result.maxScore).toBe(5);

		// The host heard the coded failure, not silence.
		const reported = errors.filter(isAssessmentPlayerError).filter((e) => e.code === 'itemScoringFailed');
		expect(reported).toHaveLength(1);
		expect(reported[0]!.params.itemIdentifier).toBe('broken-rp');

		// Delivery continues; the same failure is not reported again.
		await player.next();
		expect(player.getCurrentItem()?.identifier).toBe('q2');
		expect(
			errors.filter(isAssessmentPlayerError).filter((e) => e.code === 'itemScoringFailed'),
		).toHaveLength(1);
	});
});
