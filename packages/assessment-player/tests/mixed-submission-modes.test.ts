import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment, SubmitResponsesRequest } from '../src/integration/api-contract.js';

type SubmissionMode = 'individual' | 'simultaneous';
const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

async function fixture(modes: SubmissionMode[], failItemOnce?: string) {
	const assessment: SecureAssessment = {
		identifier: 'mixed-modes',
		title: 'Mixed submission modes',
		navigationMode: 'nonlinear',
		submissionMode: modes[0],
		testParts: modes.map((submissionMode, part) => ({
			identifier: `part-${part}`,
			navigationMode: 'nonlinear',
			submissionMode,
			sections: [{
				identifier: `section-${part}`,
				visible: true,
				assessmentItemRefs: [0, 1].map((offset) => {
					const identifier = `item-${part * 2 + offset + 1}`;
					return {
						identifier,
						role: 'candidate' as const,
						itemXml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="Choice" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>A</value></correctResponse></responseDeclaration>
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="1"/>
  <itemBody><choiceInteraction responseIdentifier="RESPONSE" maxChoices="1"><simpleChoice identifier="A">A</simpleChoice><simpleChoice identifier="B">B</simpleChoice></choiceInteraction></itemBody>
  <responseProcessing template="http://www.imsglobal.org/question/qti_v2p2/rptemplates/match_correct"/>
</assessmentItem>`,
					};
				}),
			}],
		})),
	};
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const calls: Array<SubmitResponsesRequest | 'finalize'> = [];
	const submit = backend.submitResponses.bind(backend);
	backend.submitResponses = async (request) => {
		calls.push(structuredClone(request));
		if (request.itemIdentifier === failItemOnce) {
			failItemOnce = undefined;
			throw new Error('Temporary submission failure');
		}
		return submit(request);
	};
	const finalize = backend.finalizeAssessment.bind(backend);
	backend.finalizeAssessment = async (request) => {
		calls.push('finalize');
		return finalize(request);
	};
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'candidate' },
	});
	players.push(player);
	return { player, calls, submittedIds: () => calls.map((call) => call === 'finalize' ? call : call.itemIdentifier) };
}

describe('test-part submission modes', () => {
	for (const modes of [
		['individual', 'simultaneous'],
		['simultaneous', 'individual'],
		['simultaneous', 'simultaneous'],
	] satisfies SubmissionMode[][]) {
		it(`submits ${modes.join(' then ')} parts completely and in order`, async () => {
			const { player, submittedIds } = await fixture(modes);
			player.updateResponse('RESPONSE', 'A');
			await player.next();
			expect(submittedIds()).toEqual(modes[0] === 'individual' ? ['item-1'] : []);
			player.updateResponse('RESPONSE', 'A');
			await player.next();
			expect(submittedIds()).toEqual(['item-1', 'item-2']);
			player.updateResponse('RESPONSE', 'A');
			await player.next();
			player.updateResponse('RESPONSE', 'A');
			const result = await player.submit();
			expect(submittedIds()).toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'finalize']);
			expect(result.itemResults).toHaveLength(4);
			expect(result.totalScore).toBe(4);
		});
	}

	it('keeps the current part editable after a partial failure and retries only pending items', async () => {
		const { player, calls, submittedIds } = await fixture(['simultaneous', 'individual'], 'item-2');
		player.updateResponse('RESPONSE', 'A');
		await player.next();
		player.updateResponse('RESPONSE', 'A');
		await expect(player.next()).rejects.toThrow('Temporary submission failure');
		expect(player.getNavigationState().currentIndex).toBe(1);
		expect(submittedIds()).toEqual(['item-1', 'item-2']);
		player.updateResponse('RESPONSE', 'B');
		await player.next();
		expect(player.getNavigationState().currentIndex).toBe(2);
		expect(submittedIds()).toEqual(['item-1', 'item-2', 'item-2']);
		expect(calls[2]).toMatchObject({ responses: { RESPONSE: 'B' } });
	});
});
