/**
 * Swallowed item-entry failures (UX5): a failed first entry (or a failed expiry hop)
 * is recorded on the player instead of vanishing — the shell's typed failure screen
 * (localized, with Retry) replaces an eternal bare loading state — and `retryEntry()`
 * re-runs exactly that entry. A host-repaired draft recovers through `restoreState`.
 */

import './setup';
import { afterEach, describe, expect, test } from 'bun:test';
import { AssessmentPlayer } from '../src/core/AssessmentPlayer.js';
import { ReferenceBackendAdapter } from '../src/integration/ReferenceBackendAdapter.js';

const NS = 'xmlns="http://www.imsglobal.org/xsd/imsqti_v2p2"';

const choiceItem = (identifier: string) =>
	`<assessmentItem ${NS} identifier="${identifier}" title="${identifier}" adaptive="false" timeDependent="false">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>
  <itemBody><p>Question ${identifier}</p></itemBody>
</assessmentItem>`;

const testXml = `<assessmentTest ${NS} identifier="entry-fail" title="Entry failure">
  <testPart identifier="part" navigationMode="nonlinear" submissionMode="simultaneous">
    <assessmentSection identifier="s1" title="Section A" visible="true">
      <assessmentItemRef identifier="q1" href="q1.xml"/>
      <assessmentItemRef identifier="q2" href="q2.xml"/>
    </assessmentSection>
  </testPart>
</assessmentTest>`;

const players: AssessmentPlayer[] = [];
afterEach(() => {
	for (const player of players.splice(0)) player.destroy();
	localStorage.clear();
});

async function deliver(itemFiles: Record<string, string>) {
	const parsed = await ReferenceBackendAdapter.parseAssessmentTestXml(testXml, { itemXmlMap: itemFiles });
	const backend = new ReferenceBackendAdapter();
	backend.registerAssessment(parsed.identifier, parsed);
	const errors: Error[] = [];
	const player = await AssessmentPlayer.create({
		backend,
		initSession: { assessmentId: parsed.identifier, candidateId: 'candidate' },
		onError: (error) => errors.push(error),
	});
	players.push(player);
	// The entry runs fire-and-forget from the constructor; let its rejection land.
	await new Promise((resolve) => setTimeout(resolve, 50));
	return { player, backend, errors };
}

describe('item entry failures', () => {
	test('a broken first item reports the failure instead of swallowing it', async () => {
		const { player, errors } = await deliver({
			'q1.xml': 'this is not xml <<<',
			'q2.xml': choiceItem('q2'),
		});
		expect(errors).toHaveLength(1);
		expect(player.hasEntryFailure()).toBe(true);
		expect(player.getEntryError()?.message).toBeTruthy();
		// Retry re-runs the same (still broken) entry and reports the new failure.
		await expect(player.retryEntry()).rejects.toThrow();
		expect(player.hasEntryFailure()).toBe(true);
		expect(errors).toHaveLength(2);
	});

	test('a repaired draft recovers: restoreState re-enters and clears the failure', async () => {
		const { player, backend } = await deliver({
			'q1.xml': choiceItem('q1'),
			'q2.xml': choiceItem('q2'),
		});
		// Delivery entered normally; now persist a snapshot whose q1 session snapshot is
		// corrupt (what a damaged draft looks like) and resume it in a fresh player.
		player.updateResponse('RESPONSE', 'A');
		await player.flushAutosave();
		const resumeId = backend.latestSessionId('entry-fail', 'candidate');
		expect(resumeId).toBeTruthy();
		// Corrupt the persisted draft: q1's session snapshot no longer opens.
		const key = `qti_session_${resumeId}`;
		const stored = JSON.parse(localStorage.getItem(key)!);
		stored.state.itemSessions = { q1: {} };
		localStorage.setItem(key, JSON.stringify(stored));
		player.destroy();

		const resumed = await AssessmentPlayer.create({
			backend,
			initSession: { assessmentId: 'entry-fail', candidateId: 'candidate', resumeSessionId: resumeId! },
			onError: () => {},
		});
		players.push(resumed);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(resumed.hasEntryFailure()).toBe(true);

		// The host repairs the draft (the corrupt session snapshot is dropped) and the
		// shell retries: delivery enters the item and the failure is cleared.
		const repaired = resumed.getState({ includeItemSessions: true });
		delete repaired.itemSessions?.q1;
		await resumed.restoreState(repaired);
		expect(resumed.hasEntryFailure()).toBe(false);
		expect(resumed.getCurrentItem()?.identifier).toBe('q1');
		await resumed.retryEntry(); // nothing pending: a no-op, not a second entry
		expect(resumed.getCurrentItem()?.identifier).toBe('q1');
	});
});
