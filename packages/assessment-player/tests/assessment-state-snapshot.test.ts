import { afterEach, describe, expect, it } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';
import type { SecureAssessment } from '../src/integration/api-contract.js';

const assessment: SecureAssessment = {
	identifier: 'snapshot-assessment',
	title: 'Save and resume',
	navigationMode: 'nonlinear',
	submissionMode: 'simultaneous',
	testParts: [{
		identifier: 'part',
		sections: [{
			identifier: 'section',
			visible: true,
			assessmentItemRefs: ['first', 'second'].map((identifier) => ({
				identifier,
				role: 'candidate',
				itemXml: `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2" identifier="${identifier}" title="Text answer" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>
  <itemBody><p>Enter an answer: <textEntryInteraction responseIdentifier="RESPONSE"/></p></itemBody>
</assessmentItem>`,
			})),
		}],
	}],
};

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

async function createPlayer() {
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(assessment.identifier, assessment);
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: assessment.identifier, candidateId: 'snapshot-candidate' },
	});
	players.push(player);
	return player;
}

describe('live assessment state snapshots', () => {
	for (const revisit of [false, true]) {
		it(`preserves the current answer ${revisit ? 'after revisiting the item' : 'on the first item visit'}`, async () => {
			const player = await createPlayer();
			player.updateResponse('RESPONSE', 'A');
			if (revisit) {
				await player.next();
				await player.previous();
			}
			player.updateResponse('RESPONSE', 'B');
			const session = player.getCurrentItemSession();
			const lifecycle = session?.state().lifecycleStatus;
			const snapshot = player.getState({ includeItemSessions: true });

			expect(snapshot.itemSessions?.first).toBeDefined();
			expect(snapshot.itemResponses.first).toEqual({ RESPONSE: 'B' });
			expect(player.getCurrentItemSession()).toBe(session);
			expect(session?.state().lifecycleStatus).toBe(lifecycle);
			// Taking a save snapshot must not suspend the live attempt or link the
			// saved value to subsequent response edits.
			player.updateResponse('RESPONSE', 'C');
			expect(player.getResponses()).toEqual({ RESPONSE: 'C' });
			expect(player.getState().itemSessions).toBeUndefined();

			const resumed = await createPlayer();
			await resumed.restoreState(structuredClone(snapshot));
			expect(resumed.getResponses()).toEqual({ RESPONSE: 'B' });
			resumed.updateResponse('RESPONSE', 'D');
			expect(resumed.getResponses()).toEqual({ RESPONSE: 'D' });
		});
	}
});
